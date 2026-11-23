import fs from 'node:fs'
import pg from 'pg'
import Stripe from 'stripe'

const secrets = JSON.parse(fs.readFileSync(`${process.env.HOME}/.openclaw/secrets.json`, 'utf8'))
const stripe = new Stripe(secrets.STRIPE_SECRET_KEY)
const pool = new pg.Pool({
  connectionString: secrets.NEON_DATABASE_URL || secrets.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 2,
})

const targetMonth = process.argv[2] || new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 1)).toISOString().slice(0, 7)
const start = new Date(`${targetMonth}-01T00:00:00Z`)
const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1))
const created = { gte: Math.floor(start.getTime() / 1000), lt: Math.floor(end.getTime() / 1000) }

let stripeCents = 0
let chargeCount = 0
for await (const charge of stripe.charges.list({ created, limit: 100 })) {
  if (charge.status !== 'succeeded' || !charge.paid) continue
  stripeCents += charge.amount - (charge.amount_refunded || 0)
  chargeCount++
}

const { rows } = await pool.query(`
  SELECT ROUND(COALESCE(SUM(amount), 0)::numeric, 2)::float AS cash,
         COALESCE(SUM("chargeCount"), 0)::int AS charge_count
  FROM "DailyRevenue"
  WHERE "tenantId" = 'gyc' AND LEFT(date, 7) = $1
`, [targetMonth])

const stripeCash = Math.round(stripeCents) / 100
const dailyRevenueCash = Number(rows[0].cash || 0)
console.log(JSON.stringify({
  month: targetMonth,
  definition: 'successful Stripe charges created in month, less refunds attached to those charges; includes invoice, PIF, setup, and direct one-time charges',
  stripe: { cash: stripeCash, chargeCount },
  dailyRevenue: { cash: dailyRevenueCash, chargeCount: rows[0].charge_count },
  difference: Math.round((dailyRevenueCash - stripeCash) * 100) / 100,
  reconciled: Math.abs(dailyRevenueCash - stripeCash) < 0.01,
}, null, 2))

await pool.end()
