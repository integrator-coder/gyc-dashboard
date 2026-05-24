// scripts/sync-stripe.js
// Standalone Stripe sync script — fetches ALL subscriptions via autopagination
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') })

const { PrismaClient } = require('@prisma/client')
const Stripe = require('stripe')
const pg = require('pg')

const prisma = new PrismaClient()
const stripe = new Stripe('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')
const invoicePool = new pg.Pool({
  connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL,
  ssl: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
})

/**
 * Calculate MRR for a single subscription.
 * 
 * Handles two price types:
 *  - per_unit: use unit_amount * quantity directly
 *  - tiered/graduated: unit_amount is null; fall back to latest_invoice amount_due
 *
 * @param {Object} sub - Stripe subscription (with items.data.price and latest_invoice expanded)
 * @returns {number} Monthly recurring revenue in dollars
 */
function calcSubMrr(sub) {
  const items = sub.items.data

  // Check if any item uses tiered pricing (unit_amount === null)
  const hasTiered = items.some(
    item => item.price.billing_scheme === 'tiered' || item.price.unit_amount === null
  )

  if (hasTiered) {
    // Use the latest invoice amount_due as the source of truth for MRR.
    // amount_due reflects the actual contracted amount regardless of billing scheme.
    const invoice = sub.latest_invoice
    if (invoice && typeof invoice === 'object' && invoice.amount_due > 0) {
      const amountDue = invoice.amount_due / 100

      // Determine billing interval from the first item with a recurring price
      const firstItem = items.find(i => i.price.recurring?.interval)
      const interval = firstItem?.price.recurring?.interval || 'month'
      const intervalCount = firstItem?.price.recurring?.interval_count || 1

      if (interval === 'month') return amountDue / intervalCount
      if (interval === 'year') return amountDue / (12 * intervalCount)
      if (interval === 'week') return (amountDue / intervalCount) * (52 / 12)
      if (interval === 'day') return (amountDue / intervalCount) * (365 / 12)
      return amountDue
    }
    // No invoice yet (e.g. brand new trial) — return 0
    return 0
  }

  // Standard per-unit pricing: sum each item
  return items.reduce((sum, item) => {
    const amount = (item.price.unit_amount || 0) / 100
    const qty = item.quantity || 1
    const interval = item.price.recurring?.interval
    const intervalCount = item.price.recurring?.interval_count || 1

    let monthly
    if (interval === 'month') monthly = (amount * qty) / intervalCount
    else if (interval === 'year') monthly = (amount * qty) / (12 * intervalCount)
    else if (interval === 'week') monthly = (amount * qty * 52) / 12
    else if (interval === 'day') monthly = (amount * qty * 365) / 12
    else monthly = amount * qty

    return sum + monthly
  }, 0)
}

async function sync() {
  console.log('Starting Stripe sync...')

  const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000)

  // Fetch active + past_due + trialing subscriptions
  // past_due = contracted revenue not yet collected (should count for MRR)
  // trialing = committed customers who will convert to paid
  const statusesToSync = ['active', 'past_due', 'trialing']
  const allSubscriptions = []

  for (const status of statusesToSync) {
    let count = 0
    for await (const sub of stripe.subscriptions.list({
      status,
      limit: 100,
      expand: ['data.customer', 'data.items.data.price', 'data.latest_invoice']
    })) {
      allSubscriptions.push({ ...sub, _syncStatus: status })
      count++
    }
    console.log(`Fetched ${count} ${status} subscriptions`)
  }
  console.log(`Total subscriptions: ${allSubscriptions.length}`)

  // Fetch canceled subscriptions (last 30 days)
  console.log('Fetching canceled subscriptions (last 30d)...')
  const canceledSubs = []
  for await (const sub of stripe.subscriptions.list({
    status: 'canceled',
    created: { gte: thirtyDaysAgo },
    limit: 100
  })) {
    canceledSubs.push(sub)
  }
  console.log(`Found ${canceledSubs.length} canceled subs in last 30 days`)

  // Calculate total MRR and aggregate at the customer level
  let mrr = 0
  const customersById = new Map()

  for (const sub of allSubscriptions) {
    const subMrr = calcSubMrr(sub)
    mrr += subMrr

    const customer = sub.customer
    const id = typeof customer === 'string' ? customer : customer.id
    const name = typeof customer === 'object' ? (customer.name || customer.email || 'Unknown') : 'Unknown'
    const email = typeof customer === 'object' ? customer.email : null
    const createdAt = new Date(sub.created * 1000)

    const existing = customersById.get(id)
    if (!existing) {
      customersById.set(id, {
        id,
        name,
        email,
        status: sub._syncStatus,
        mrr: subMrr,
        createdAt,
      })
      continue
    }

    existing.mrr += subMrr
    if (createdAt < existing.createdAt) existing.createdAt = createdAt
    if (existing.status !== 'active' && sub._syncStatus === 'active') existing.status = 'active'
    else if (existing.status === 'trialing' && sub._syncStatus === 'past_due') existing.status = 'past_due'
  }

  const customers = Array.from(customersById.values())

  // Count distinct customers (not subscriptions)
  const newSubsWindow = allSubscriptions.filter(s => s.created >= thirtyDaysAgo)
  const newCustomerIds = new Set(newSubsWindow.map(s => typeof s.customer === 'string' ? s.customer : s.customer.id))
  const newCustomers = newCustomerIds.size

  // Clear old customer data and insert fresh
  console.log('Clearing old data...')
  await prisma.stripeMetrics.deleteMany()
  await prisma.stripeCustomer.deleteMany()
  await prisma.syncLog.deleteMany()

  console.log('Inserting customers...')
  for (const c of customers) {
    await prisma.stripeCustomer.upsert({
      where: { id: c.id },
      update: { name: c.name, email: c.email, status: c.status, mrr: c.mrr },
      create: { ...c, updatedAt: new Date() }
    })
  }

  // Fetch revenue (last 30 days via invoices for accuracy)
  console.log('Fetching paid invoices (last 30d)...')
  const paidInvoices = []
  for await (const invoice of stripe.invoices.list({
    status: 'paid',
    created: { gte: thirtyDaysAgo },
    limit: 100
  })) {
    paidInvoices.push(invoice)
  }
  const totalRevenue = paidInvoices.reduce((sum, inv) => sum + inv.amount_paid / 100, 0)

  // Group paid invoices by day for daily revenue chart
  const dailyMap = {}
  for (const invoice of paidInvoices) {
    const date = new Date(invoice.created * 1000).toISOString().split('T')[0]
    if (!dailyMap[date]) dailyMap[date] = { amount: 0, count: 0 }
    dailyMap[date].amount += invoice.amount_paid / 100
    dailyMap[date].count += 1
  }

  for (const [date, data] of Object.entries(dailyMap)) {
    await prisma.dailyRevenue.upsert({
      where: { date },
      update: { amount: data.amount, chargeCount: data.count },
      create: { date, amount: data.amount, chargeCount: data.count }
    })
  }
  console.log(`Saved daily revenue for ${Object.keys(dailyMap).length} days`)

  const { syncStripeInvoiceSnapshots } = await import('../lib/stripe-normalization.mjs')
  const invoiceSync = await syncStripeInvoiceSnapshots({
    stripe,
    queryable: invoicePool,
    tenantId: 'gyc',
    lookbackDays: 365,
  })

  // Save metrics snapshot
  await prisma.stripeMetrics.create({
    data: {
      mrr,
      totalRevenue,
      activeCustomers: customers.length,
      newCustomers,
      churnedCustomers: canceledSubs.length,
      netRevenue: totalRevenue
    }
  })

  const statusBreakdown = statusesToSync.map(s => {
    const subs = allSubscriptions.filter(sub => sub._syncStatus === s)
    const subMrr = subs.reduce((sum, sub) => sum + calcSubMrr(sub), 0)
    return `${s}: ${subs.length} subs ($${subMrr.toFixed(2)}/mo)`
  }).join(' | ')

  await prisma.syncLog.create({
    data: {
      source: 'stripe',
      status: 'success',
      message: `Synced ${customers.length} customers (${statusBreakdown}). MRR: $${mrr.toFixed(2)}. New (30d): ${newCustomers}. Churned (30d): ${canceledSubs.length}. Invoices synced: ${invoiceSync.synced}.`
    }
  })

  console.log('\n✅ Sync complete!')
  console.log(`   Total customers synced: ${customers.length}`)
  console.log(`   MRR: $${mrr.toFixed(2)}`)
  console.log(`   ARR: $${(mrr * 12).toFixed(2)}`)
  console.log(`   Status breakdown: ${statusBreakdown}`)
  console.log(`   New (30d): ${newCustomers}`)
  console.log(`   Churned (30d): ${canceledSubs.length}`)
  console.log(`   Revenue (30d): $${totalRevenue.toFixed(2)}`)
  console.log(`   Invoice snapshots synced (365d): ${invoiceSync.synced}`)

  await prisma.$disconnect()
  await invoicePool.end()
}

sync().catch(async e => {
  console.error('Error:', e.message)
  await prisma.$disconnect()
  await invoicePool.end().catch(() => null)
  process.exit(1)
})
