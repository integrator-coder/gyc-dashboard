import fs from 'node:fs'
import pg from 'pg'
import Stripe from 'stripe'

const secrets = JSON.parse(fs.readFileSync(`${process.env.HOME}/.openclaw/secrets.json`, 'utf8'))
const dbUrl = secrets.NEON_DATABASE_URL || secrets.DATABASE_URL
const stripe = new Stripe(secrets.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16', maxNetworkRetries: 5 })
const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false }, max: 2 })

function subMrr(sub) {
  const items = sub.items.data
  const hasTiered = items.some(item => item.price.billing_scheme === 'tiered' || item.price.unit_amount == null)
  if (hasTiered && sub.latest_invoice && typeof sub.latest_invoice === 'object') {
    const invoice = sub.latest_invoice
    const amount = ((invoice.amount_paid > 0 ? invoice.amount_paid : invoice.amount_due) || 0) / 100
    const recurring = items.find(item => item.price.recurring)?.price.recurring || {}
    const count = recurring.interval_count || 1
    if (recurring.interval === 'year') return amount / (12 * count)
    if (recurring.interval === 'month') return amount / count
    if (recurring.interval === 'week') return amount * 52 / (12 * count)
    if (recurring.interval === 'day') return amount * 365 / (12 * count)
    return amount
  }
  return items.reduce((sum, item) => {
    const amount = ((item.price.unit_amount || 0) * (item.quantity || 1)) / 100
    const recurring = item.price.recurring || {}
    const count = recurring.interval_count || 1
    if (recurring.interval === 'year') return sum + amount / (12 * count)
    if (recurring.interval === 'month') return sum + amount / count
    if (recurring.interval === 'week') return sum + amount * 52 / (12 * count)
    if (recurring.interval === 'day') return sum + amount * 365 / (12 * count)
    return sum + amount
  }, 0)
}

const byCustomer = new Map()
for (const status of ['past_due', 'unpaid']) {
  for await (const sub of stripe.subscriptions.list({
    status,
    limit: 100,
    expand: ['data.customer', 'data.latest_invoice', 'data.items.data.price'],
  })) {
    const customer = sub.customer
    const id = typeof customer === 'string' ? customer : customer.id
    const row = byCustomer.get(id) || {
      id,
      name: typeof customer === 'object' ? (customer.name || customer.email || 'Unknown') : 'Unknown',
      email: typeof customer === 'object' ? customer.email : null,
      status,
      mrr: 0,
      createdAt: new Date(sub.created * 1000),
    }
    row.mrr += subMrr(sub)
    if (status === 'unpaid') row.status = 'unpaid'
    const createdAt = new Date(sub.created * 1000)
    if (createdAt < row.createdAt) row.createdAt = createdAt
    byCustomer.set(id, row)
  }
}

const client = await pool.connect()
try {
  await client.query('BEGIN')
  for (const customer of byCustomer.values()) {
    await client.query(`
      INSERT INTO "StripeCustomer"
        (id, name, email, status, mrr, "createdAt", "updatedAt", "organizationId", "tenantId", tags)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), '1001', 'gyc', ARRAY[]::text[])
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        status = EXCLUDED.status,
        mrr = EXCLUDED.mrr,
        "updatedAt" = NOW()
    `, [customer.id, customer.name, customer.email, customer.status, customer.mrr, customer.createdAt])
  }
  await client.query('COMMIT')
  const { rows } = await client.query(`
    SELECT status, COUNT(*)::int AS clients, ROUND(SUM(mrr)::numeric, 2)::float AS mrr
    FROM "StripeCustomer"
    WHERE status IN ('past_due', 'unpaid')
    GROUP BY status ORDER BY status
  `)
  console.log(JSON.stringify({ upserted: byCustomer.size, verification: rows }, null, 2))
} catch (error) {
  await client.query('ROLLBACK')
  throw error
} finally {
  client.release()
  await pool.end()
}
