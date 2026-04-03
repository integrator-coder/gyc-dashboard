/**
 * sync-sales-deals.mjs
 * Phase 3 — Syncs sales deal rows from Google Sheets into the Neon SalesDeal table.
 * Reads: 2025 Details, 2026 Details tabs from the Sales Scorecard sheet.
 * Uses ON CONFLICT DO NOTHING on the unique constraint (yearLabel, dealDate, clientName, service, rep).
 * Writes a SyncLog entry on completion.
 *
 * Run:  node scripts/sync-sales-deals.mjs
 * Cron: Add alongside refresh-snapshots.mjs (runs independently, not via HTTP).
 */

import dotenv from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import os from 'os'
import pkg from 'pg'
import { google } from 'googleapis'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '../.env.local') })

const { Pool } = pkg
const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// ─── Google Sheets Auth ──────────────────────────────────────────────────────
function createGoogleAuth(scopes) {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
    return new google.auth.GoogleAuth({ credentials, scopes })
  }
  const keyFile = process.env.GOOGLE_CREDENTIALS_PATH
    || `${os.homedir()}/.openclaw/credentials/google-console.json`
  return new google.auth.GoogleAuth({ keyFile, scopes })
}

const SHEET_ID = '1858s3B0oQ8YC4KEBDefJMc0WuD5nyjNIFxiQrqsuO-A'

async function readTab(sheets, tab, range) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${tab}!${range}`,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  })
  return res.data.values || []
}

// ─── Rep Normalisation (exact copy from /api/metrics/new-business/route.js) ──
const REP_ALIASES = {
  'Seb': 'Sebastian',
  'seb': 'Sebastian',
  'Sebastian': 'Sebastian',
  'Zu/Bruce': 'Zu',
  'Zu / Bruce': 'Zu',
  'Zu/Seb': 'Zu',
  'Zu / Seb': 'Zu',
  'zu': 'Zu',
  'jesse': 'Jesse',
  'briana': 'Briana',
  'jc': 'JC',
  'pia': 'Pia',
  'stefen': 'Stefen',
  'todd': 'Todd',
  'travis': 'Travis',
  'lex': 'Lex',
  'kim': 'Kim',
  'matt': 'Matt',
}

const SALES_REPS = new Set(['Jesse', 'Pia', 'Briana', 'Matt', 'Lex'])
const UPSELL_REPS = new Set(['JC', 'Zu', 'Stefen', 'Todd', 'Travis', 'Kim'])

function normaliseRep(raw) {
  if (!raw) return 'Unknown'
  const trimmed = raw.trim()
  return REP_ALIASES[trimmed] || REP_ALIASES[trimmed.toLowerCase()] || trimmed
}

function classifyDealType(rep, year) {
  if (rep === 'Sebastian') return Number(year) >= 2026 ? 'Upsell' : 'Sales'
  if (SALES_REPS.has(rep)) return 'Sales'
  if (UPSELL_REPS.has(rep)) return 'Upsell'
  return 'Unclassified'
}

function parseDeals(rows, yearLabel) {
  return rows.slice(1).filter(r => r[5]).map(r => {
    const rep = normaliseRep(r[13])
    const year = Number(yearLabel) || new Date(r[5]).getFullYear()
    return {
      yearLabel: String(yearLabel),
      clientName: r[0] || '',
      name:        r[1] || '',
      service:     r[2] || '',
      quarter:     r[3] || '',
      month:       r[4] || '',
      date:        r[5] || '',
      firstPayment: Number(r[6])  || 0,
      mrr:          Number(r[7])  || 0,
      term:         Number(r[8])  || 0,
      fullTerm:     Number(r[9])  || 0,
      firstYear:    Number(r[10]) || 0,
      pif:          (r[11] || '').toString().trim().toUpperCase() === 'Y',
      renewalAmount: Number(r[12]) || 0,
      rep,
      dealType: classifyDealType(rep, year),
    }
  })
}

// ─── Upsert ───────────────────────────────────────────────────────────────────
async function upsertDeals(client, deals) {
  let inserted = 0
  let skipped = 0

  for (const d of deals) {
    // Parse dealDate — may be a formatted string like "1/15/2025" or a serial number
    let dealDate = null
    if (d.date) {
      const parsed = new Date(d.date)
      if (!isNaN(parsed)) {
        dealDate = parsed.toISOString().split('T')[0]
      }
    }

    const res = await client.query(
      `INSERT INTO "SalesDeal"
         ("tenantId","sourceSystem","yearLabel","dealDate","clientName",service,quarter,month,
          "firstPayment",mrr,term,"fullTerm","firstYear",pif,"renewalAmount",rep,"dealType")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       ON CONFLICT ("yearLabel","dealDate","clientName",service,rep) DO NOTHING`,
      [
        'gyc',
        'google-sheets',
        d.yearLabel,
        dealDate,
        d.clientName,
        d.service,
        d.quarter,
        d.month,
        d.firstPayment,
        d.mrr,
        d.term,
        d.fullTerm,
        d.firstYear,
        d.pif,
        d.renewalAmount,
        d.rep,
        d.dealType,
      ]
    )
    if (res.rowCount > 0) inserted++
    else skipped++
  }

  return { inserted, skipped }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  const startTime = Date.now()
  console.log('🔄 sync-sales-deals: starting...')

  const auth = createGoogleAuth(['https://www.googleapis.com/auth/spreadsheets.readonly'])
  const authClient = await auth.getClient()
  const sheets = google.sheets({ version: 'v4', auth: authClient })

  const [rows26, rows25] = await Promise.all([
    readTab(sheets, '2026 Details', 'A1:R400'),
    readTab(sheets, '2025 Details', 'A1:R400'),
  ])

  const deals26 = parseDeals(rows26, 2026)
  const deals25 = parseDeals(rows25, 2025)
  const allDeals = [...deals25, ...deals26]

  console.log(`📋 Parsed ${deals25.length} deals from 2025, ${deals26.length} from 2026 (${allDeals.length} total)`)

  const client = await pool.connect()
  let totalInserted = 0
  let totalSkipped = 0

  try {
    await client.query('BEGIN')
    const result = await upsertDeals(client, allDeals)
    totalInserted = result.inserted
    totalSkipped = result.skipped
    await client.query('COMMIT')

    console.log(`✅ Upsert complete: ${totalInserted} inserted, ${totalSkipped} skipped`)

    // Write SyncLog entry
    await client.query(
      `INSERT INTO "SyncLog" (source, status, message, "syncedAt", "organizationId")
       VALUES ($1, $2, $3, now(), $4)`,
      ['sales-deals', 'success', `inserted=${totalInserted} skipped=${totalSkipped}`, 'default']
    )
    console.log('📝 SyncLog entry written')

    // Write AgentAuditLog entry
    const durationMs = Date.now() - startTime
    try {
      await client.query(
        `INSERT INTO "AgentAuditLog" ("tenantId","agentId","agentName","action","target","summary","status","durationMs","recordsAffected")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        ['gyc', 'main', 'Wall·E', 'sync', 'SalesDeal', `inserted=${totalInserted} skipped=${totalSkipped}`, 'ok', durationMs, totalInserted]
      )
      console.log('🔒 AgentAuditLog entry written')
    } catch (auditErr) {
      console.error('[agent-audit] Failed to log:', auditErr.message)
    }
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('❌ Sync failed:', err.message)

    // Log failure to SyncLog
    try {
      await client.query(
        `INSERT INTO "SyncLog" (source, status, message, "syncedAt", "organizationId")
         VALUES ($1, $2, $3, now(), $4)`,
        ['sales-deals', 'error', err.message, 'default']
      )
    } catch (_) {}

    throw err
  } finally {
    client.release()
    await pool.end()
  }

  return { totalInserted, totalSkipped }
}

run()
  .then(({ totalInserted, totalSkipped }) => {
    console.log(`\n🏁 Done. Inserted: ${totalInserted} | Skipped (already exist): ${totalSkipped}`)
    process.exit(0)
  })
  .catch(err => {
    console.error('Fatal:', err)
    process.exit(1)
  })
