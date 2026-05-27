#!/usr/bin/env node
/**
 * populate-from-todd-sheet.mjs
 * Reads Todd's location sheet, matches against GBPLocation by CID or acronym+address,
 * updates gbpUrl for missing records, writes status back to sheet.
 */
import { config } from 'dotenv';
import pg from 'pg';
import { google } from 'googleapis';
import { URL } from 'url';

const { Client } = pg;
config({ path: '/Users/toddthejedigmail.com/.openclaw/workspace/gyc-dashboard/.env.local' });

const TODD_SHEET_ID = '1uZLqNTDWXZ3wbBU7ley-81gj8Kj4h06_Ftd2utE-pjY';

const auth = new google.auth.GoogleAuth({
  keyFile: '/Users/toddthejedigmail.com/.openclaw/workspace/google-service-account.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

const dbClient = new Client({ connectionString: process.env.DATABASE_URL });
await dbClient.connect();

// ── helpers ──────────────────────────────────────────────────────────────────

function extractCid(urlStr) {
  if (!urlStr) return null;
  try {
    // Try parsing as URL
    const u = new URL(urlStr.trim());
    const cid = u.searchParams.get('cid');
    if (cid) return cid;
    // Some URLs: maps.google.com/?cid=XXXXXX or /maps?cid=XXXXXX
    const match = urlStr.match(/[?&]cid=(\d+)/);
    if (match) return match[1];
  } catch {}
  // Fallback regex
  const match = urlStr.match(/[?&]cid=(\d+)/);
  return match ? match[1] : null;
}

function normalizeAddr(addr) {
  if (!addr) return '';
  return addr.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

// ── Step 1: Read Todd's sheet ─────────────────────────────────────────────────
console.log('=== Step 1: Reading Todd\'s sheet ===');
let rows;
try {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: TODD_SHEET_ID,
    range: 'A:J',
  });
  rows = res.data.values || [];
} catch (e) {
  console.error('❌ ERROR: Cannot read Todd\'s sheet:', e.message);
  await dbClient.end();
  process.exit(1);
}

if (rows.length < 2) {
  console.log('No data rows found.');
  await dbClient.end();
  process.exit(0);
}

const headers = rows[0];
console.log('Headers:', headers);

// Fixed column indices based on actual sheet structure:
// 0: Client Abbrv.  1: Client  2: Number of Locations  3: Website Address
// 4: Location Name  5: Location Map Link  6: location address  7: Column 3  8: GBP Link  9: Notes
const COL_ABBRV    = 0;
const COL_LOC_NAME = 4;
const COL_MAP_LINK = 5;
const COL_ADDRESS  = 6;
const COL_GBP_LINK = 8;

const dataRows = rows.slice(1); // skip header
const sheetEntries = dataRows.map((r, i) => ({
  rowIdx: i + 2, // 1-based, +1 for header
  acronym:   (r[COL_ABBRV]    || '').trim().toUpperCase(),
  locName:   (r[COL_LOC_NAME] || '').trim(),
  mapLink:   (r[COL_MAP_LINK] || '').trim(),
  address:   (r[COL_ADDRESS]  || '').trim(),
  gbpLink:   (r[COL_GBP_LINK] || '').trim(),
  cid:       extractCid(r[COL_MAP_LINK]) || extractCid(r[COL_GBP_LINK]),
  status:    (r[10] || '').trim(), // existing status col if any
})).filter(e => e.acronym && (e.mapLink || e.gbpLink));

console.log(`Found ${sheetEntries.length} entries with acronym + map link`);
console.log(`CIDs extracted: ${sheetEntries.filter(e => e.cid).length}`);

// ── Step 2: Load DB records ───────────────────────────────────────────────────
console.log('\n=== Step 2: Loading GBPLocation records from DB ===');
const { rows: dbRows } = await dbClient.query(`
  SELECT id, "clientAcronym", "locationName", cid, "gbpUrl", address
  FROM "GBPLocation"
  WHERE "tenantId" = 'gyc'
`);
console.log(`Loaded ${dbRows.length} GBPLocation records`);

// Index by CID and by acronym
const byCid = {};
const byAcronym = {};
for (const row of dbRows) {
  if (row.cid) byCid[row.cid] = row;
  if (!byAcronym[row.clientAcronym]) byAcronym[row.clientAcronym] = [];
  byAcronym[row.clientAcronym].push(row);
}

// ── Step 3: Match and update ──────────────────────────────────────────────────
console.log('\n=== Step 3: Matching and updating ===');

let updatedCount = 0;
let alreadyHasUrl = 0;
let noMatch = 0;
let cidMatch = 0;
let acronymMatch = 0;

const statusByRow = {}; // rowIdx → status string

for (const entry of sheetEntries) {
  const bestUrl = entry.gbpLink || entry.mapLink;
  let matched = null;
  let matchType = '';

  // Try CID match first
  if (entry.cid && byCid[entry.cid]) {
    matched = byCid[entry.cid];
    matchType = 'CID';
  }

  // Fall back to acronym+address match
  if (!matched && entry.acronym && byAcronym[entry.acronym]) {
    const candidates = byAcronym[entry.acronym];
    if (candidates.length === 1) {
      // Only one location for this client — safe to match
      matched = candidates[0];
      matchType = 'acronym-only';
    } else if (entry.address) {
      // Try address similarity
      const normEntry = normalizeAddr(entry.address);
      let best = null, bestScore = 0;
      for (const c of candidates) {
        const normDb = normalizeAddr(c.address);
        // Simple token overlap score
        const entryTokens = new Set(normEntry.split(' ').filter(t => t.length > 2));
        const dbTokens = normDb.split(' ').filter(t => t.length > 2);
        const overlap = dbTokens.filter(t => entryTokens.has(t)).length;
        if (overlap > bestScore) { bestScore = overlap; best = c; }
      }
      if (bestScore >= 2) { matched = best; matchType = `addr(${bestScore})`; }
    }
  }

  if (!matched) {
    noMatch++;
    statusByRow[entry.rowIdx] = '❌ Not found in DB';
    continue;
  }

  if (matched.gbpUrl) {
    alreadyHasUrl++;
    statusByRow[entry.rowIdx] = '✅ Already has URL';
    continue;
  }

  // Update the DB record
  try {
    await dbClient.query(
      `UPDATE "GBPLocation" SET "gbpUrl" = $1, "updatedAt" = NOW() WHERE id = $2`,
      [bestUrl, matched.id]
    );
    updatedCount++;
    if (matchType === 'CID') cidMatch++;
    else acronymMatch++;
    statusByRow[entry.rowIdx] = `✅ Updated (${matchType})`;
    // Update in-memory so we don't double-count
    matched.gbpUrl = bestUrl;
    console.log(`  ✅ ${entry.acronym} | ${matched.locationName} → updated via ${matchType}`);
  } catch (e) {
    statusByRow[entry.rowIdx] = `⚠️ DB error: ${e.message}`;
    console.warn(`  ⚠️ ${entry.acronym}: ${e.message}`);
  }
}

console.log(`\n=== Summary ===`);
console.log(`  CID matches updated:    ${cidMatch}`);
console.log(`  Acronym matches updated: ${acronymMatch}`);
console.log(`  Already had URL:        ${alreadyHasUrl}`);
console.log(`  No match found:         ${noMatch}`);
console.log(`  Total updated:          ${updatedCount}`);

// ── Step 4: Write status back to Todd's sheet ─────────────────────────────────
console.log('\n=== Step 4: Writing status back to sheet ===');

// Build the status column data (column K = index 10)
// We need to set header + per-row statuses
const statusColData = [['Status']]; // header for row 1
for (let i = 2; i <= rows.length; i++) {
  statusColData.push([statusByRow[i] || '']);
}

try {
  await sheets.spreadsheets.values.update({
    spreadsheetId: TODD_SHEET_ID,
    range: 'K1',
    valueInputOption: 'RAW',
    requestBody: { values: statusColData },
  });
  console.log('✅ Status column written to sheet (column K)');
} catch (e) {
  console.error('❌ Failed to write status to sheet:', e.message);
}

await dbClient.end();
console.log('\n✅ Done');
