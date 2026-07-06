#!/usr/bin/env node
/**
 * sync-all-lead-data.js
 * Loads Lead Funnel Summary data from Google Sheets for all active GYC clients
 * and upserts into the ClientFunnelMonth table in Neon PostgreSQL.
 *
 * Usage: node scripts/sync-all-lead-data.js
 */

'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

const { google } = require('googleapis');
const fs = require('fs');
const os = require('os');
const { Pool } = require('pg');

// ─── Config ───────────────────────────────────────────────────────────────────

const CREDS_PATH = os.homedir() + '/.openclaw/credentials/google-console.json';
const MAX_MONTH   = '2026-06'; // Skip any month after this
const RATE_LIMIT_MS = 200;     // Delay between sheet fetches

// ─── Google Auth ──────────────────────────────────────────────────────────────

const creds = JSON.parse(fs.readFileSync(CREDS_PATH, 'utf8'));
const auth = new google.auth.GoogleAuth({
  credentials: creds,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const sheets = google.sheets({ version: 'v4', auth });

// ─── DB Pool ──────────────────────────────────────────────────────────────────

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ─── Month utilities ──────────────────────────────────────────────────────────

const MONTH_NAMES = {
  january: '01', february: '02', march: '03', april: '04',
  may: '05', june: '06', july: '07', august: '08',
  september: '09', october: '10', november: '11', december: '12',
};

/**
 * Parse a month label like "January 2022" or "February" (year inferred).
 * Returns "YYYY-MM" or null.
 */
function parseMonthLabel(label, inferredYear) {
  if (!label || typeof label !== 'string') return null;
  const trimmed = label.trim();
  if (!trimmed) return null;

  // Try "Month YYYY" or "Month, YYYY"
  const fullMatch = trimmed.match(/^(\w+)[,\s]+(\d{4})$/);
  if (fullMatch) {
    const monthNum = MONTH_NAMES[fullMatch[1].toLowerCase()];
    if (monthNum) return `${fullMatch[2]}-${monthNum}`;
  }

  // Try just "Month" — infer year
  const shortMatch = trimmed.match(/^(\w+)$/);
  if (shortMatch && inferredYear) {
    const monthNum = MONTH_NAMES[shortMatch[1].toLowerCase()];
    if (monthNum) return `${inferredYear}-${monthNum}`;
  }

  return null;
}

/**
 * Build array of YYYY-MM strings from month header row.
 * Carries year forward when a label has no year.
 * Returns array aligned with col indices (index 0 = col 4 of the sheet).
 */
function buildMonthArray(headerRow) {
  const months = [];
  let lastYear = null;
  let lastMonthNum = null;

  for (let i = 4; i < headerRow.length; i++) {
    const label = (headerRow[i] || '').trim();
    if (!label) {
      months.push(null);
      continue;
    }

    let yearToUse = lastYear;

    // Extract year from label if present
    const fullMatch = label.match(/^(\w+)[,\s]+(\d{4})$/);
    if (fullMatch) {
      yearToUse = parseInt(fullMatch[2], 10);
    } else if (lastYear && lastMonthNum) {
      // Month-only label — detect year rollover
      const shortMatch = label.match(/^(\w+)$/);
      if (shortMatch) {
        const monthNum = parseInt(MONTH_NAMES[shortMatch[1].toLowerCase()] || '0', 10);
        if (monthNum > 0 && monthNum < lastMonthNum) {
          // Month number went backwards → year rolled over
          yearToUse = lastYear + 1;
        }
        lastMonthNum = monthNum;
      }
    }

    const yyyymm = parseMonthLabel(label, yearToUse);
    if (yyyymm) {
      const [y, m] = yyyymm.split('-');
      lastYear = parseInt(y, 10);
      lastMonthNum = parseInt(m, 10);
    }
    months.push(yyyymm);
  }

  return months; // months[0] = col 4, months[1] = col 5, ...
}

// ─── Value parser ─────────────────────────────────────────────────────────────

function parseIntValue(v) {
  if (v === null || v === undefined) return 0;
  const s = String(v).trim();
  if (!s || s.startsWith('#') || s === '-') return 0;
  // Strip $, commas, %
  const cleaned = s.replace(/[$,%]/g, '').replace(/,/g, '');
  const n = parseInt(cleaned, 10);
  return isNaN(n) ? 0 : Math.max(0, n);
}

// ─── Sheet parser ─────────────────────────────────────────────────────────────

/**
 * Given the rows from a sheet, extract all location data.
 * Returns array of { locationName, leadsRow, toursRow, regRow }
 * where each *Row is array of values aligned with month columns.
 *
 * Also returns the month array.
 */
function parseSheetData(rows) {
  if (!rows || rows.length === 0) return { months: [], locations: [] };

  // Row 0 = header with month labels
  const headerRow = rows[0] || [];
  const months = buildMonthArray(headerRow);

  // Find all location sections
  const locationSections = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const col0 = (row[0] || '').trim();
    const col1 = (row[1] || '').trim();

    // Location header: col0 non-empty, doesn't start with spaces, col1 == "Active"
    if (col0 && !row[0].startsWith(' ') && col1 === 'Active') {
      locationSections.push({ name: col0, startRow: r });
    }
  }

  // Determine which sections to process
  let sectionsToProcess = locationSections;

  // Check if we have named locations (excluding the aggregate)
  const namedSections = locationSections.filter(
    s => s.name !== 'CRM - Total All Locations'
  );

  if (namedSections.length > 0) {
    // Use named locations only
    sectionsToProcess = namedSections;
  } else if (locationSections.length > 0) {
    // Only CRM - Total All Locations exists (single-location sheet)
    // Use it but rename to "default"
    sectionsToProcess = locationSections.map(s => ({ ...s, useAsDefault: true }));
  } else {
    // No location sections found at all — look for leads rows directly in the sheet
    // Fallback: treat whole sheet as single "default" location
    sectionsToProcess = [{ name: 'default', startRow: 0, fallback: true }];
  }

  const locations = [];

  for (const section of sectionsToProcess) {
    const locationName = section.useAsDefault ? 'default' : section.name;
    let leadsRow = null;
    let toursRow = null;
    let regRow = null;

    if (section.fallback) {
      // No location headers — search entire sheet for Leads/Tours/Registered
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r] || [];
        const col0 = (row[0] || '');
        if (!leadsRow && /^\s+leads\s*$/i.test(col0)) leadsRow = row;
        if (!toursRow && /^\s+tours/i.test(col0)) toursRow = row;
        if (!regRow && /^\s+newly registered/i.test(col0)) regRow = row;
        if (leadsRow && toursRow && regRow) break;
      }
    } else {
      // Search within ~15 rows after the section header
      const limit = Math.min(section.startRow + 15, rows.length);
      for (let r = section.startRow + 1; r < limit; r++) {
        const row = rows[r] || [];
        const col0 = (row[0] || '');
        // Stop if we hit another location header
        if (col0 && !col0.startsWith(' ') && (rows[r][1] || '').trim() === 'Active') break;

        if (!leadsRow && /^\s+leads\s*$/i.test(col0)) leadsRow = row;
        if (!toursRow && /^\s+tours/i.test(col0)) toursRow = row;
        if (!regRow && /^\s+newly registered/i.test(col0)) regRow = row;
      }
    }

    if (leadsRow || toursRow || regRow) {
      locations.push({ locationName, leadsRow, toursRow, regRow });
    }
  }

  return { months, locations };
}

// ─── Upsert ───────────────────────────────────────────────────────────────────

async function upsertRows(client, records) {
  if (records.length === 0) return { inserted: 0, updated: 0 };

  let inserted = 0;
  let updated = 0;

  for (const r of records) {
    const result = await pool.query(
      `INSERT INTO "ClientFunnelMonth" 
         (id, "clientId", month, "locationName", leads, tours, registered, revenue,
          "leadToTour", "tourToReg", "leadToReg", "syncedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
       ON CONFLICT (id) DO UPDATE SET
         leads       = EXCLUDED.leads,
         tours       = EXCLUDED.tours,
         registered  = EXCLUDED.registered,
         "leadToTour"= EXCLUDED."leadToTour",
         "tourToReg" = EXCLUDED."tourToReg",
         "leadToReg" = EXCLUDED."leadToReg",
         "syncedAt"  = NOW()
       RETURNING (xmax = 0) AS is_insert`,
      [
        r.id, r.clientId, r.month, r.locationName,
        r.leads, r.tours, r.registered, 0,
        r.leadToTour, r.tourToReg, r.leadToReg,
      ]
    );
    if (result.rows[0]?.is_insert) inserted++;
    else updated++;
  }

  return { inserted, updated };
}

// ─── Process one client ───────────────────────────────────────────────────────

async function processClient(client) {
  const { id: acronym, sheetId, funnelTab } = client;

  // 1. Fetch sheet data
  let rows;
  let tabUsed = funnelTab;

  try {
    // First try the configured tab
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `'${funnelTab}'!A1:BZ500`,
      });
      rows = res.data.values || [];
    } catch (tabErr) {
      // Fallback: try first sheet tab
      const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
      const firstTab = meta.data.sheets?.[0]?.properties?.title;
      if (!firstTab) throw new Error('No tabs found in sheet');
      tabUsed = firstTab;
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `'${firstTab}'!A1:BZ500`,
      });
      rows = res.data.values || [];
    }
  } catch (err) {
    return {
      acronym,
      error: `Sheet fetch failed: ${err.message}`,
      inserted: 0, updated: 0, skipped: 0,
    };
  }

  if (!rows || rows.length < 3) {
    return { acronym, error: 'Sheet has fewer than 3 rows', inserted: 0, updated: 0, skipped: 0 };
  }

  // 2. Parse sheet
  const { months, locations } = parseSheetData(rows);

  if (locations.length === 0) {
    return { acronym, error: 'No location sections found', inserted: 0, updated: 0, skipped: 0 };
  }

  // 3. Build records to upsert
  const records = [];
  let skipped = 0;

  for (const loc of locations) {
    const { locationName, leadsRow, toursRow, regRow } = loc;

    for (let ci = 0; ci < months.length; ci++) {
      const month = months[ci];
      if (!month) continue;
      if (month > MAX_MONTH) continue; // Skip future months

      const colIdx = ci + 4; // ci=0 → col 4

      const leads = leadsRow ? parseIntValue(leadsRow[colIdx]) : 0;
      if (leads === 0) { skipped++; continue; } // Skip 0-lead months

      const tours = toursRow ? parseIntValue(toursRow[colIdx]) : 0;
      const registered = regRow ? parseIntValue(regRow[colIdx]) : 0;

      const leadToTour = leads > 0 ? tours / leads : null;
      const tourToReg  = tours > 0 ? registered / tours : null;
      const leadToReg  = leads > 0 ? registered / leads : null;

      const id = `${acronym}:${locationName}:${month}`;

      records.push({
        id,
        clientId: acronym,
        month,
        locationName,
        leads,
        tours,
        registered,
        leadToTour,
        tourToReg,
        leadToReg,
      });
    }
  }

  if (records.length === 0) {
    return { acronym, error: null, inserted: 0, updated: 0, skipped, noData: true };
  }

  // 4. Upsert
  const { inserted, updated } = await upsertRows(acronym, records);

  return { acronym, error: null, inserted, updated, skipped };
}

// ─── Sleep ────────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== GYC Lead Data Sync ===');
  console.log(`Max month: ${MAX_MONTH}`);
  console.log(`Rate limit: ${RATE_LIMIT_MS}ms between clients\n`);

  // Load all active clients from ClientProfile
  const TARGET = process.argv[2] ? process.argv[2].toUpperCase().split(',') : null
  const dbRes = await pool.query(
    `SELECT acronym AS id,
            regexp_replace("leadDataUrl", '.*/spreadsheets/d/([^/]+).*', '\\1') AS "sheetId",
            'Lead Funnel Summary' AS "funnelTab"
     FROM "ClientProfile"
     WHERE "leadDataUrl" IS NOT NULL AND "leadDataUrl" != ''
       AND status = 'active'
       ${TARGET ? `AND acronym = ANY($1)` : ''}
     ORDER BY acronym`,
    TARGET ? [TARGET] : []
  );
  const clients = dbRes.rows.filter(c => c.sheetId && c.sheetId.length > 10);
  console.log(`Loaded ${clients.length} active clients\n`);

  let totalInserted = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  const errors = [];
  const noData = [];
  let processed = 0;

  for (const client of clients) {
    processed++;
    process.stdout.write(`[${processed}/${clients.length}] ${client.id} ... `);

    const result = await processClient(client);

    if (result.error) {
      console.log(`ERROR: ${result.error}`);
      errors.push({ acronym: result.acronym, error: result.error });
    } else if (result.noData) {
      console.log(`NO DATA (skipped: ${result.skipped})`);
      noData.push(result.acronym);
    } else {
      console.log(`+${result.inserted} inserted, ~${result.updated} updated, ${result.skipped} skipped`);
      totalInserted += result.inserted;
      totalUpdated += result.updated;
      totalSkipped += result.skipped;
    }

    // Rate limit between clients
    if (processed < clients.length) await sleep(RATE_LIMIT_MS);
  }

  console.log('\n=== FINAL SUMMARY ===');
  console.log(`Total clients processed : ${clients.length}`);
  console.log(`Total rows inserted     : ${totalInserted}`);
  console.log(`Total rows updated      : ${totalUpdated}`);
  console.log(`Total months skipped    : ${totalSkipped} (0 leads or future)`);
  console.log(`Clients with no data    : ${noData.length}`);
  console.log(`Clients with errors     : ${errors.length}`);

  if (noData.length > 0) {
    console.log('\nNo data clients:', noData.join(', '));
  }

  if (errors.length > 0) {
    console.log('\nErrors:');
    for (const e of errors) {
      console.log(`  ${e.acronym}: ${e.error}`);
    }
  }

  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
