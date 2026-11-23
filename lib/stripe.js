import Stripe from 'stripe'
import { pool } from '@/lib/pg'
import { syncStripeInvoiceSnapshots } from '@/lib/stripe-normalization.mjs'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

/**
 * Syncs Stripe subscription and revenue data into the local SQLite database.
 * Calculates MRR, active customers, new customers, and churned customers.
 * Uses autopagination to fetch ALL records, not just the first 100.
 */
export async function syncStripeData(prisma) {
  const todayUtc = new Date()
  todayUtc.setUTCHours(0, 0, 0, 0)
  const windowStart = new Date(todayUtc)
  windowStart.setUTCDate(windowStart.getUTCDate() - 29)
  const windowEnd = new Date(todayUtc)
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 1)
  const thirtyDaysAgo = Math.floor(windowStart.getTime() / 1000)
  const windowEndExclusive = Math.floor(windowEnd.getTime() / 1000)

  // Get ALL active subscriptions via autopagination
  const allSubscriptions = []
  for await (const sub of stripe.subscriptions.list({
    status: 'active',
    limit: 100,
    expand: ['data.customer']
  })) {
    allSubscriptions.push(sub)
  }

  // Get ALL canceled subscriptions from last 30 days via autopagination
  const canceledSubs = []
  for await (const sub of stripe.subscriptions.list({
    status: 'canceled',
    created: { gte: thirtyDaysAgo },
    limit: 100,
    expand: ['data.customer']
  })) {
    canceledSubs.push(sub)
  }

  // Calculate MRR from active subscriptions
  let mrr = 0
  const customers = []

  for (const sub of allSubscriptions) {
    const subMrr = sub.items.data.reduce((sum, item) => {
      const amount = item.price.unit_amount / 100
      const interval = item.price.recurring?.interval
      if (interval === 'month') return sum + amount
      if (interval === 'year') return sum + (amount / 12)
      return sum + amount
    }, 0)

    mrr += subMrr

    const customer = sub.customer
    customers.push({
      id: typeof customer === 'string' ? customer : customer.id,
      name: typeof customer === 'object' ? (customer.name || null) : null,
      email: typeof customer === 'object' ? (customer.email || null) : null,
      status: 'active',
      mrr: subMrr,
      createdAt: new Date(sub.created * 1000)
    })
  }

  // Upsert all active customers
  for (const c of customers) {
    await prisma.stripeCustomer.upsert({
      where: { id: c.id },
      update: { name: c.name, email: c.email, status: c.status, mrr: c.mrr },
      create: { ...c, updatedAt: new Date() }
    })
  }

  // Get ALL revenue from charges in last 30 days via autopagination
  const charges = []
  for await (const charge of stripe.charges.list({
    created: { gte: thirtyDaysAgo, lt: windowEndExclusive },
    limit: 100
  })) {
    if (charge.status === 'succeeded' && charge.paid) charges.push(charge)
  }
  const totalRevenue = charges
    .reduce((sum, c) => sum + (c.amount - (c.amount_refunded || 0)) / 100, 0)

  // DailyRevenue is the dashboard's cash ledger. Populate every day in the
  // exact rolling 30-day window from all successful charges (subscription,
  // setup, PIF, and direct one-time), net of refunds attached to those charges.
  const dailyMap = new Map()
  for (let day = new Date(windowStart); day < windowEnd; day.setUTCDate(day.getUTCDate() + 1)) {
    dailyMap.set(day.toISOString().slice(0, 10), { amount: 0, count: 0 })
  }
  for (const charge of charges) {
    const date = new Date(charge.created * 1000).toISOString().slice(0, 10)
    const daily = dailyMap.get(date)
    if (!daily) continue
    daily.amount += (charge.amount - (charge.amount_refunded || 0)) / 100
    daily.count += 1
  }
  for (const [date, daily] of dailyMap) {
    await prisma.dailyRevenue.upsert({
      where: { date },
      update: { amount: daily.amount, chargeCount: daily.count, syncedAt: new Date() },
      create: { date, amount: daily.amount, chargeCount: daily.count, organizationId: 'gyc' },
    })
  }

  // Count new subscriptions started in last 30 days (based on sub.created, not customer.createdAt)
  const newCustomers = allSubscriptions.filter(s => s.created >= thirtyDaysAgo).length

  const invoiceSync = await syncStripeInvoiceSnapshots({
    stripe,
    queryable: pool,
    tenantId: 'gyc',
    lookbackDays: 365,
  })

  // Save metrics snapshot
  const snapshot = await prisma.stripeMetrics.create({
    data: {
      mrr,
      totalRevenue,
      activeCustomers: customers.length,
      newCustomers,
      churnedCustomers: canceledSubs.length,
      netRevenue: totalRevenue
    }
  })

  // Log the sync
  await prisma.syncLog.create({
    data: {
      source: 'stripe',
      status: 'success',
      message: `Synced ${customers.length} active customers. MRR: $${mrr.toFixed(2)}. New (30d): ${newCustomers}. Churned (30d): ${canceledSubs.length}. Invoices synced: ${invoiceSync.synced}.`
    }
  })

  return { ...snapshot, invoicesSynced: invoiceSync.synced, invoiceLookbackDays: invoiceSync.lookbackDays }
}
