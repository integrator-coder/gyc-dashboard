'use strict'

const path = require('path')
const fs = require('fs')

// Load .env.local
const envPath = path.resolve(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx < 0) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    if (key && !(key in process.env)) process.env[key] = val
  }
} else {
  console.warn('⚠️  .env.local not found at', envPath)
}

const { Pool } = require('pg')
const { google } = require('googleapis')
const { GoogleAuth } = require('google-auth-library')

const SPREADSHEET_ID = '1WuSCzCum1erNQByrnYaw0T7ZhtXlIgng1yQ6EYSmuFA'
const SHEET_NAME = 'HR Scorecard'
const CREDENTIALS_PATH = '/Users/toddthejedigmail.com/.openclaw/credentials/google-console.json'

function parseCurrency(str) {
  if (!str || String(str).trim() === '') return null
  const n = parseFloat(String(str).replace(/[$,]/g, ''))
  return isNaN(n) ? null : n
}

function parseNumber(str) {
  if (!str || String(str).trim() === '') return null
  const n = parseFloat(String(str).replace(/[,]/g, ''))
  return isNaN(n) ? null : n
}

// Column index → period metadata
const COLUMNS = [
  { colIdx: 1, year: 2023, quarterKey: 0, quarter: null, periodType: 'annual',    period: '2023' },
  { colIdx: 2, year: 2024, quarterKey: 0, quarter: null, periodType: 'annual',    period: '2024' },
  { colIdx: 3, year: 2025, quarterKey: 0, quarter: null, periodType: 'annual',    period: '2025' },
  { colIdx: 4, year: 2026, quarterKey: 1, quarter: 1,    periodType: 'quarterly', period: '2026-Q1' },
]

async function fetchSheetData() {
  const auth = new GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
  const sheets = google.sheets({ version: 'v4', auth })
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET_NAME}'!A1:Z50`,
  })
  return res.data.values || []
}

async function ensureTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "HRScorecard" (
      "id" SERIAL PRIMARY KEY,
      "period" TEXT NOT NULL,
      "periodType" TEXT NOT NULL,
      "year" INT NOT NULL,
      "quarter" INT,
      "quarterKey" INT NOT NULL DEFAULT 0,
      "revenue" DECIMAL(14,2),
      "headcount" DECIMAL(6,2),
      "baseSalaryTotal" DECIMAL(14,2),
      "totalComp" DECIMAL(14,2),
      "syncedAt" TIMESTAMP DEFAULT NOW(),
      "updatedAt" TIMESTAMP DEFAULT NOW(),
      UNIQUE ("year", "quarterKey")
    );
  `)
}

async function main() {
  const pool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })

  try {
    console.log('📊 Fetching HR Scorecard from Google Sheets…')
    const rows = await fetchSheetData()
    console.log(`   Got ${rows.length} rows from sheet`)

    // Find metric rows by label (case-insensitive, trimmed)
    const findRow = (label) => {
      const lower = label.toLowerCase()
      return rows.find(r => r && r[0] && r[0].trim().toLowerCase() === lower)
    }

    const revenueRow       = findRow('revenue')
    const headcountRow     = findRow('headcount')
    const totalCompRow     = findRow('total compensation')
    const baseSalaryRow    = findRow('base salaries')

    if (!revenueRow) console.warn('   ⚠️  Revenue row not found in sheet')
    if (!headcountRow) console.warn('   ⚠️  Headcount row not found in sheet')
    if (!totalCompRow) console.warn('   ⚠️  Total Compensation row not found in sheet')
    if (!baseSalaryRow) console.warn('   ℹ️  Base Salaries row not found — baseSalaryTotal will be null (add row to sheet to enable)')

    console.log('🛠️  Ensuring HRScorecard table exists…')
    await ensureTable(pool)

    let upsertCount = 0
    for (const col of COLUMNS) {
      const { colIdx, year, quarterKey, quarter, periodType, period } = col

      const revenue      = revenueRow   ? parseCurrency(revenueRow[colIdx])   : null
      const headcount    = headcountRow ? parseNumber(headcountRow[colIdx])    : null
      const totalComp    = totalCompRow ? parseCurrency(totalCompRow[colIdx])  : null
      const baseSalaryTotal = baseSalaryRow ? parseCurrency(baseSalaryRow[colIdx]) : null

      console.log(`   Upserting ${period}: revenue=${revenue}, headcount=${headcount}, totalComp=${totalComp}`)

      await pool.query(
        `INSERT INTO "HRScorecard" ("period","periodType","year","quarter","quarterKey","revenue","headcount","baseSalaryTotal","totalComp","syncedAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())
         ON CONFLICT ("year","quarterKey") DO UPDATE SET
           "revenue"=EXCLUDED."revenue",
           "headcount"=EXCLUDED."headcount",
           "baseSalaryTotal"=EXCLUDED."baseSalaryTotal",
           "totalComp"=EXCLUDED."totalComp",
           "syncedAt"=NOW(),
           "updatedAt"=NOW()`,
        [period, periodType, year, quarter, quarterKey, revenue, headcount, baseSalaryTotal, totalComp]
      )
      upsertCount++
    }

    console.log(`✅ Done — upserted ${upsertCount} rows into HRScorecard`)

    // Verify
    const { rows: dbRows } = await pool.query(
      `SELECT period, revenue, headcount, "totalComp" FROM "HRScorecard" ORDER BY year, "quarterKey"`
    )
    console.log('📋 Current HRScorecard rows:')
    for (const r of dbRows) {
      console.log(`   ${r.period}: revenue=${r.revenue}, headcount=${r.headcount}, totalComp=${r.totalComp}`)
    }

  } finally {
    await pool.end()
  }
}

main().catch(err => {
  console.error('❌ sync-hr-scorecard failed:', err)
  process.exit(1)
})
