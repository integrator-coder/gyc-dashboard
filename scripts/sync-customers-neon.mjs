// sync-customers-neon.mjs
// One-time (and repeatable) sync: Stripe active customers → Neon StripeCustomer table
import Stripe from 'stripe'
import pkg from 'pg'
const { Pool } = pkg

const stripe = new Stripe('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')
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_ilJbVI72fDxh@ep-red-smoke-aks7z27o-pooler.c-3.us-west-2.aws.neon.tech/neondb?channel_binding=require&connect_timeout=15&sslmode=require',
  ssl: { rejectUnauthorized: false },
})

const ORG_ID = '1001'

function calcMrr(sub) {
  const items = sub.items.data
  const hasTiered = items.some(i => i.price.billing_scheme === 'tiered' || i.price.unit_amount === null)
  if (hasTiered) {
    const invoice = sub.latest_invoice
    if (invoice && typeof invoice === 'object' && invoice.amount_due > 0) {
      const amount = invoice.amount_due / 100
      const first = items.find(i => i.price.recurring?.interval)
      const interval = first?.price.recurring?.interval || 'month'
      const count = first?.price.recurring?.interval_count || 1
      if (interval === 'month') return amount / count
      if (interval === 'year') return amount / (12 * count)
      return amount
    }
    return 0
  }
  return items.reduce((sum, item) => {
    const price = item.price
    const qty = item.quantity || 1
    const amount = (price.unit_amount || 0) / 100 * qty
    const interval = price.recurring?.interval || 'month'
    const count = price.recurring?.interval_count || 1
    if (interval === 'month') return sum + amount / count
    if (interval === 'year') return sum + amount / (12 * count)
    return sum + amount
  }, 0)
}

async function run() {
  const client = await pool.connect()
  try {
    let synced = 0
    let page = 0

    for await (const sub of stripe.subscriptions.list({
      status: 'active',
      limit: 100,
      expand: ['data.customer', 'data.latest_invoice', 'data.items.data.price'],
    })) {
      const customer = sub.customer
      if (typeof customer === 'string') continue // not expanded — skip

      const mrr = calcMrr(sub)
      const name = customer.name || customer.email || 'Unknown'
      const email = customer.email || null
      const createdAt = new Date(sub.created * 1000)

      await client.query(`
        INSERT INTO "StripeCustomer" (id, name, email, status, mrr, "createdAt", "canceledAt", "updatedAt", "organizationId")
        VALUES ($1, $2, $3, 'active', $4, $5, NULL, NOW(), $6)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          email = EXCLUDED.email,
          status = 'active',
          mrr = EXCLUDED.mrr,
          "canceledAt" = NULL,
          "updatedAt" = NOW(),
          "organizationId" = EXCLUDED."organizationId"
      `, [customer.id, name, email, mrr, createdAt, ORG_ID])

      synced++
      if (synced % 50 === 0) console.log(`  synced ${synced} customers...`)
    }

    const { rows } = await client.query(
      `SELECT COUNT(*) as total FROM "StripeCustomer" WHERE "organizationId" = $1 AND status = 'active'`,
      [ORG_ID]
    )

    console.log(`✅ Done. ${synced} customers synced. Neon now has ${rows[0].total} active customers.`)
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(err => { console.error('❌ Error:', err.message); process.exit(1) })
