
import Stripe from 'stripe'
import { NextResponse } from 'next/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })

function daysPastDue(currentPeriodEnd) {
  const now = Date.now() / 1000
  const diff = now - currentPeriodEnd
  return diff > 0 ? Math.floor(diff / 86400) : 0
}

function getBucket(days) {
  if (days <= 7) return '0–7 days'
  if (days <= 14) return '8–14 days'
  if (days <= 30) return '15–30 days'
  return '30+ days'
}

export async function GET() {
  try {
    // 1. Past-due subscriptions
    const subsResponse = await stripe.subscriptions.list({
      status: 'past_due',
      limit: 100,
      expand: ['data.customer', 'data.latest_invoice'],
    })

    const pastDue = []

    for (const sub of subsResponse.data) {
      const customer = sub.customer
      const invoice = sub.latest_invoice

      const name =
        (typeof customer === 'object' && customer?.name) ||
        (typeof customer === 'object' && customer?.email) ||
        'Unknown'
      const email =
        (typeof customer === 'object' && customer?.email) || ''

      // MRR in cents → dollars
      const mrr = (sub.items?.data?.[0]?.price?.unit_amount ?? 0) / 100

      const days = daysPastDue(sub.current_period_end)

      const attemptCount =
        (typeof invoice === 'object' ? (invoice?.attempt_count ?? 0) : 0)
      const amountDue =
        (typeof invoice === 'object' ? (invoice?.amount_due ?? 0) : 0) / 100
      const nextAttemptTs =
        typeof invoice === 'object' ? invoice?.next_payment_attempt : null
      const nextAttempt = nextAttemptTs
        ? new Date(nextAttemptTs * 1000).toISOString().slice(0, 10)
        : null

      pastDue.push({
        name,
        email,
        mrr,
        daysPastDue: days,
        attemptCount,
        nextAttempt,
        amountDue,
      })
    }

    // Sort by days past due descending
    pastDue.sort((a, b) => b.daysPastDue - a.daysPastDue)

    // 2. Failed invoices (last 90 days, open + attempted)
    const ninetyDaysAgo = Math.floor(Date.now() / 1000) - 90 * 86400

    const invoicesResponse = await stripe.invoices.list({
      status: 'open',
      limit: 100,
      expand: ['data.customer'],
    })

    const failedInvoices = invoicesResponse.data.filter(
      (inv) => inv.attempt_count > 0 && !inv.paid && inv.created >= ninetyDaysAgo
    )

    // 3. Summary stats
    const pastDueCount = pastDue.length
    const mrrAtRisk = pastDue.reduce((sum, s) => sum + s.mrr, 0)
    const totalOutstanding =
      failedInvoices.reduce((sum, inv) => sum + (inv.amount_due ?? 0), 0) / 100
    const avgAttempts =
      failedInvoices.length > 0
        ? parseFloat(
            (
              failedInvoices.reduce((sum, inv) => sum + inv.attempt_count, 0) /
              failedInvoices.length
            ).toFixed(1)
          )
        : 0

    // Buckets
    const bucketDefs = [
      { label: '0–7 days', min: 0, max: 7 },
      { label: '8–14 days', min: 8, max: 14 },
      { label: '15–30 days', min: 15, max: 30 },
      { label: '30+ days', min: 31, max: Infinity },
    ]

    const buckets = bucketDefs.map(({ label, min, max }) => {
      const subs = pastDue.filter(
        (s) => s.daysPastDue >= min && s.daysPastDue <= max
      )
      return {
        label,
        count: subs.length,
        mrr: subs.reduce((sum, s) => sum + s.mrr, 0),
      }
    })

    // Failed invoices simplified list (for potential future use)
    const failedList = failedInvoices.map((inv) => {
      const customer = inv.customer
      const name =
        (typeof customer === 'object' && customer?.name) ||
        (typeof customer === 'object' && customer?.email) ||
        'Unknown'
      const email =
        (typeof customer === 'object' && customer?.email) || ''
      return {
        name,
        email,
        amountDue: (inv.amount_due ?? 0) / 100,
        attemptCount: inv.attempt_count,
        nextAttempt: inv.next_payment_attempt
          ? new Date(inv.next_payment_attempt * 1000).toISOString().slice(0, 10)
          : null,
        created: new Date(inv.created * 1000).toISOString().slice(0, 10),
      }
    })

    return NextResponse.json({
      summary: {
        pastDueCount,
        mrrAtRisk,
        totalOutstanding,
        avgAttempts,
      },
      buckets,
      pastDue,
      failedInvoices: failedList,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[dunning] Stripe error:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to fetch dunning data' },
      { status: 500 }
    )
  }
}
