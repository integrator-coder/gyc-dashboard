import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export async function GET() {
  try {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startTs = Math.floor(startOfMonth.getTime() / 1000)

    // Stripe doesn't support filtering by canceled_at directly — fetch and filter in JS
    const canceledSubs = []
    for await (const sub of stripe.subscriptions.list({
      status: 'canceled',
      limit: 100,
      expand: ['data.customer']
    })) {
      if (sub.canceled_at && sub.canceled_at >= startTs) {
        canceledSubs.push(sub)
      }
      // Stripe returns most recently canceled first — stop once we're past the window
      if (sub.canceled_at && sub.canceled_at < startTs) break
    }

    const churnedClients = canceledSubs.map(sub => {
      const customer = sub.customer
      const mrr = sub.items.data.reduce((sum, item) => {
        const amount = item.price.unit_amount / 100
        const interval = item.price.recurring?.interval
        if (interval === 'month') return sum + amount
        if (interval === 'year') return sum + amount / 12
        return sum + amount
      }, 0)

      return {
        id: sub.id,
        customerId: typeof customer === 'string' ? customer : customer.id,
        name: typeof customer === 'object' ? (customer.name || customer.email || 'Unknown') : 'Unknown',
        email: typeof customer === 'object' ? customer.email : null,
        mrr,
        canceledAt: new Date(sub.canceled_at * 1000).toISOString(),
        startedAt: new Date(sub.created * 1000).toISOString(),
        cancelReason: sub.cancellation_details?.reason || null,
        cancelComment: sub.cancellation_details?.comment || null,
      }
    })

    // Sort by canceledAt desc
    churnedClients.sort((a, b) => new Date(b.canceledAt) - new Date(a.canceledAt))

    const totalMrrLost = churnedClients.reduce((sum, c) => sum + c.mrr, 0)

    return NextResponse.json({
      month: startOfMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      count: churnedClients.length,
      totalMrrLost,
      clients: churnedClients
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
