import fs from 'node:fs'
import pg from 'pg'
import Stripe from 'stripe'

const secrets = JSON.parse(fs.readFileSync(`${process.env.HOME}/.openclaw/secrets.json`, 'utf8'))
const stripe = new Stripe(secrets.STRIPE_SECRET_KEY, { maxNetworkRetries: 5 })
const pool = new pg.Pool({
  connectionString: secrets.NEON_DATABASE_URL || secrets.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 2,
})

const todayUtc = new Date()
todayUtc.setUTCHours(0, 0, 0, 0)
const windowStart = new Date(todayUtc)
windowStart.setUTCDate(windowStart.getUTCDate() - 29)
const windowEnd = new Date(todayUtc)
windowEnd.setUTCDate(windowEnd.getUTCDate() + 1)
const gte = Math.floor(windowStart.getTime() / 1000)
const lt = Math.floor(windowEnd.getTime() / 1000)

const daily = new Map()
for (let day = new Date(windowStart); day < windowEnd; day.setUTCDate(day.getUTCDate() + 1)) {
  daily.set(day.toISOString().slice(0, 10), { cents: 0, count: 0 })
}

for await (const charge of stripe.charges.list({ created: { gte, lt }, limit: 100 })) {
  if (charge.status !== 'succeeded' || !charge.paid) continue
  const date = new Date(charge.created * 1000).toISOString().slice(0, 10)
  const row = daily.get(date)
  if (!row) continue
  row.cents += charge.amount - (charge.amount_refunded || 0)
  row.count += 1
}

const totalCents = [...daily.values()].reduce((sum, row) => sum + row.cents, 0)
const client = await pool.connect()
try {
  await client.query('BEGIN')
  for (const [date, row] of daily) {
    await client.query(`
      INSERT INTO "DailyRevenue" (date, amount, "chargeCount", "organizationId", "tenantId", "syncedAt")
      VALUES ($1, $2, $3, 'gyc', 'gyc', NOW())
      ON CONFLICT (date) DO UPDATE SET
        amount = EXCLUDED.amount,
        "chargeCount" = EXCLUDED."chargeCount",
        "organizationId" = EXCLUDED."organizationId",
        "tenantId" = EXCLUDED."tenantId",
        "syncedAt" = NOW()
    `, [date, row.cents / 100, row.count])
  }

  // Preserve the latest subscription metrics while publishing corrected cash.
  await client.query(`
    INSERT INTO "StripeMetrics"
      (mrr, "totalRevenue", "activeCustomers", "newCustomers", "churnedCustomers", "netRevenue", "syncedAt", "organizationId", "tenantId")
    SELECT mrr, $1, "activeCustomers", "newCustomers", "churnedCustomers", $1, NOW(), "organizationId", "tenantId"
    FROM "StripeMetrics"
    ORDER BY "syncedAt" DESC
    LIMIT 1
  `, [totalCents / 100])
  await client.query('COMMIT')

  console.log(JSON.stringify({
    window: { start: [...daily.keys()][0], end: [...daily.keys()].at(-1) },
    total: totalCents / 100,
    successfulChargeCount: [...daily.values()].reduce((sum, row) => sum + row.count, 0),
    days: daily.size,
  }, null, 2))
} catch (error) {
  await client.query('ROLLBACK')
  throw error
} finally {
  client.release()
  await pool.end()
}
