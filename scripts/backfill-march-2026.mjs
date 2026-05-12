/**
 * One-off backfill: March 2026 DailyRevenue
 * Fetches all succeeded Stripe charges for March 2026 and upserts into DailyRevenue.
 */

import Stripe from 'stripe'
import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(__dirname, '../.env.local')
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const idx = t.indexOf('=')
    if (idx < 0) continue
    const key = t.slice(0, idx).trim()
    const val = t.slice(idx + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

const FROM = Math.floor(new Date('2026-03-01T00:00:00Z').getTime() / 1000)
const TO   = Math.floor(new Date('2026-04-01T00:00:00Z').getTime() / 1000)

console.log('🔄 Fetching March 2026 charges from Stripe...')

const dailyAmount = {}
const dailyCount  = {}
let total = 0, count = 0

for await (const charge of stripe.charges.list({ created: { gte: FROM, lt: TO }, limit: 100 })) {
  if (charge.status !== 'succeeded' || charge.refunded) continue
  const date = new Date(charge.created * 1000).toISOString().split('T')[0]
  const amt = charge.amount / 100
  dailyAmount[date] = (dailyAmount[date] ?? 0) + amt
  dailyCount[date]  = (dailyCount[date]  ?? 0) + 1
  total += amt
  count++
}

console.log(`✅ Found ${count} succeeded charges → $${total.toLocaleString(undefined, { maximumFractionDigits: 0 })} total`)
console.log('\nDay-by-day breakdown:')
Object.keys(dailyAmount).sort().forEach(d => {
  console.log(`  ${d}: $${Math.round(dailyAmount[d]).toLocaleString()} (${dailyCount[d]} charges)`)
})

// Upsert into DailyRevenue
const entries = Object.entries(dailyAmount)
if (!entries.length) { console.log('Nothing to upsert.'); process.exit(0) }

const values = []
const placeholders = entries.map(([date, amount], i) => {
  values.push(date, Math.round(amount * 100) / 100, dailyCount[date] ?? 0)
  return `($${i*3+1}, $${i*3+2}, $${i*3+3}, NOW())`
}).join(', ')

await pool.query(`
  INSERT INTO "DailyRevenue" ("date", "amount", "chargeCount", "syncedAt")
  VALUES ${placeholders}
  ON CONFLICT ("date") DO UPDATE SET
    amount = EXCLUDED.amount,
    "chargeCount" = EXCLUDED."chargeCount",
    "syncedAt" = NOW()
`, values)

console.log(`\n✅ Upserted ${entries.length} days into DailyRevenue`)

// Verify
const check = await pool.query(
  `SELECT ROUND(SUM(amount)) as total, COUNT(*) as days FROM "DailyRevenue" WHERE date >= '2026-03-01' AND date <= '2026-03-31'`
)
console.log(`\n📊 March 2026 in DB now: $${Number(check.rows[0].total).toLocaleString()} across ${check.rows[0].days} days`)

await pool.end()
