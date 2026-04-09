/**
 * scripts/backfill-daily-revenue.mjs
 *
 * Backfills DailyRevenue table with 3 years of Stripe charge data.
 * - Fetches successful charges month by month (Jan 2023 → today)
 * - Groups by calendar date (America/New_York / ET)
 * - Upserts into DailyRevenue using `date` unique constraint
 * - Saves checkpoint to /tmp/stripe-backfill-checkpoint.json to support resume
 */

import Stripe from 'stripe'
import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Load .env.local ──────────────────────────────────────────────────────────
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
  console.log('✅ Loaded .env.local')
}

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY
const DATABASE_URL = process.env.DATABASE_URL

if (!STRIPE_KEY) throw new Error('Missing STRIPE_SECRET_KEY')
if (!DATABASE_URL) throw new Error('Missing DATABASE_URL')

const stripe = new Stripe(STRIPE_KEY)
const { Pool } = pg
const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })

const CHECKPOINT_FILE = '/tmp/stripe-backfill-checkpoint.json'
const ORG_ID = 'gyc'
const TZ = 'America/New_York'

// ── Helpers ──────────────────────────────────────────────────────────────────

function toEasternDateStr(unixTimestamp) {
  const d = new Date(unixTimestamp * 1000)
  return d.toLocaleDateString('en-CA', { timeZone: TZ }) // yields YYYY-MM-DD
}

function loadCheckpoint() {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'))
    } catch {}
  }
  return { completedMonths: [], lastUpdated: null }
}

function saveCheckpoint(cp) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(cp, null, 2))
}

function monthKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`
}

/** Generate all (year, month) pairs from Jan 2023 to current month */
function allMonths() {
  const months = []
  const now = new Date()
  const endYear = now.getFullYear()
  const endMonth = now.getMonth() + 1 // 1-indexed

  for (let y = 2023; y <= endYear; y++) {
    const startM = 1
    const stopM = y < endYear ? 12 : endMonth
    for (let m = startM; m <= stopM; m++) {
      months.push({ year: y, month: m })
    }
  }
  return months
}

/** Fetch all succeeded charges for a given month window */
async function fetchMonthCharges(monthStart, monthEnd) {
  const charges = []
  let lastId = null

  while (true) {
    const params = {
      created: { gte: monthStart, lt: monthEnd },
      limit: 100,
    }
    if (lastId) params.starting_after = lastId

    const resp = await stripe.charges.list(params)
    for (const charge of resp.data) {
      if (charge.status === 'succeeded') {
        charges.push(charge)
      }
    }

    if (!resp.has_more) break
    lastId = resp.data[resp.data.length - 1].id
  }

  return charges
}

/** Upsert daily revenue rows for a map of date→{amount, count} */
async function upsertDailyRevenue(dailyMap) {
  if (dailyMap.size === 0) return 0

  const client = await pool.connect()
  try {
    let upserted = 0
    for (const [date, { amount, count }] of dailyMap) {
      await client.query(
        `INSERT INTO "DailyRevenue" (date, amount, "chargeCount", "organizationId", "syncedAt")
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (date) DO UPDATE SET
           amount = EXCLUDED.amount,
           "chargeCount" = EXCLUDED."chargeCount",
           "organizationId" = EXCLUDED."organizationId",
           "syncedAt" = NOW()`,
        [date, amount, count, ORG_ID]
      )
      upserted++
    }
    return upserted
  } finally {
    client.release()
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Starting Stripe → DailyRevenue backfill')
  console.log(`   Org: ${ORG_ID} | TZ: ${TZ}`)
  console.log(`   Checkpoint: ${CHECKPOINT_FILE}\n`)

  const cp = loadCheckpoint()
  const completed = new Set(cp.completedMonths || [])
  console.log(`📂 Already completed months: ${completed.size}`)

  const months = allMonths()
  console.log(`📅 Total months to process: ${months.length}\n`)

  let totalCharges = 0
  let totalDays = 0
  let processedMonths = 0

  for (const { year, month } of months) {
    const key = monthKey(year, month)
    if (completed.has(key)) {
      process.stdout.write(`  ⏭  ${key} (skipped — already done)\n`)
      processedMonths++
      continue
    }

    // Compute Unix timestamps for month start/end
    const monthStart = Math.floor(new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00Z`).getTime() / 1000)
    const nextMonth = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`
    const monthEnd = Math.floor(new Date(`${nextMonth}-01T00:00:00Z`).getTime() / 1000)

    process.stdout.write(`  ⏳ ${key} ... `)

    try {
      const charges = await fetchMonthCharges(monthStart, monthEnd)

      // Group by ET date
      const dailyMap = new Map()
      for (const charge of charges) {
        const dateStr = toEasternDateStr(charge.created)
        const existing = dailyMap.get(dateStr) || { amount: 0, count: 0 }
        existing.amount += charge.amount / 100
        existing.count += 1
        dailyMap.set(dateStr, existing)
      }

      // Round amounts to 2 decimal places
      for (const [k, v] of dailyMap) {
        v.amount = Math.round(v.amount * 100) / 100
      }

      const upserted = await upsertDailyRevenue(dailyMap)

      totalCharges += charges.length
      totalDays += upserted
      processedMonths++

      completed.add(key)
      cp.completedMonths = [...completed]
      cp.lastUpdated = new Date().toISOString()
      saveCheckpoint(cp)

      console.log(`✅ ${charges.length} charges → ${upserted} days`)
    } catch (err) {
      console.error(`\n❌ Error on ${key}: ${err.message}`)
      // Don't mark as complete — will retry on resume
    }
  }

  console.log('\n─────────────────────────────────────────')
  console.log(`✅ Backfill complete`)
  console.log(`   Months processed: ${processedMonths}/${months.length}`)
  console.log(`   Total charges:    ${totalCharges}`)
  console.log(`   Total day rows:   ${totalDays}`)
  console.log('─────────────────────────────────────────\n')

  // Final DB summary
  console.log('📊 DB Summary by year:')
  const client = await pool.connect()
  try {
    const res = await client.query(`
      SELECT 
        EXTRACT(YEAR FROM date::date) as year,
        COUNT(*) as days,
        ROUND(SUM(amount)::numeric, 2) as total
      FROM "DailyRevenue"
      WHERE "organizationId" = $1
      GROUP BY 1
      ORDER BY 1
    `, [ORG_ID])

    console.log('  Year  | Days | Total Revenue')
    console.log('  ------|------|---------------')
    for (const row of res.rows) {
      console.log(`  ${row.year}  | ${String(row.days).padStart(4)} | $${Number(row.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}`)
    }
  } finally {
    client.release()
  }

  await pool.end()
  console.log('\n🏁 Done.')
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
