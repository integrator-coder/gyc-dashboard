/**
 * Builds MRRHistory from DailyRevenue data.
 * Groups daily revenue by month, uses last-day-of-month as MRR estimate.
 */
import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(__dirname, '../.env.local')
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
}

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

// Get last revenue entry per month (most accurate MRR proxy)
const { rows: dailyRows } = await pool.query(`
  SELECT
    TO_CHAR(date, 'YYYY-MM') AS month,
    MAX(date) AS last_date,
    -- Use the revenue from the last day of each month as MRR
    (array_agg("mrr" ORDER BY date DESC))[1] AS mrr,
    (array_agg("activeSubscriptions" ORDER BY date DESC))[1] AS active_subs
  FROM "DailyRevenue"
  WHERE "tenantId" = 'gyc'
  GROUP BY TO_CHAR(date, 'YYYY-MM')
  ORDER BY month ASC
`)

console.log(`📊 Found ${dailyRows.length} months of DailyRevenue data`)
console.log(`📅 Range: ${dailyRows[0]?.month} → ${dailyRows[dailyRows.length - 1]?.month}`)

let upserted = 0
for (const row of dailyRows) {
  if (!row.mrr || Number(row.mrr) === 0) continue
  await pool.query(`
    INSERT INTO "MRRHistory" (
      "tenantId", "month", "mrr", "newMrr", "churnedMrr", "expansionMrr", "activeSubscriptions"
    ) VALUES ($1, $2, $3, NULL, NULL, NULL, $4)
    ON CONFLICT ("tenantId", "month") DO UPDATE SET
      "mrr" = EXCLUDED."mrr",
      "activeSubscriptions" = EXCLUDED."activeSubscriptions"
  `, ['gyc', row.month, row.mrr, row.active_subs])
  upserted++
}

console.log(`✅ Upserted ${upserted} MRRHistory rows`)

// Show last 6 months
const { rows: recent } = await pool.query(`
  SELECT month, mrr, "activeSubscriptions"
  FROM "MRRHistory"
  WHERE "tenantId" = 'gyc'
  ORDER BY month DESC
  LIMIT 6
`)
console.log('\n📊 Recent MRR History:')
for (const r of recent) {
  console.log(`  ${r.month}: $${Number(r.mrr).toLocaleString()} (${r.activeSubscriptions || '?'} subs)`)
}

pool.end()
