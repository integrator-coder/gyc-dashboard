import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

/**
 * Syncs Stripe subscription and revenue data into the local SQLite database.
 * Calculates MRR, active customers, new customers, and churned customers.
 * Uses autopagination to fetch ALL records, not just the first 100.
 */
export async function syncStripeData(prisma) {
  const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000)

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
      create: c
    })
  }

  // Get ALL revenue from charges in last 30 days via autopagination
  const charges = []
  for await (const charge of stripe.charges.list({
    created: { gte: thirtyDaysAgo },
    limit: 100
  })) {
    charges.push(charge)
  }
  const totalRevenue = charges
    .filter(c => c.status === 'succeeded')
    .reduce((sum, c) => sum + c.amount / 100, 0)

  // Count new subscriptions started in last 30 days (based on sub.created, not customer.createdAt)
  const newCustomers = allSubscriptions.filter(s => s.created >= thirtyDaysAgo).length

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
      message: `Synced ${customers.length} active customers. MRR: $${mrr.toFixed(2)}. New (30d): ${newCustomers}. Churned (30d): ${canceledSubs.length}.`
    }
  })

  return snapshot
}
