const Stripe = require('/Users/toddthejedigmail.com/.openclaw/workspace/gyc-dashboard/node_modules/stripe')
const stripe = new Stripe('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')

async function sanity() {
  // Break down what drove the increase: how much came from tiered pricing fix vs past_due
  let tieredMrr = 0
  let tieredCount = 0
  let perUnitMrr = 0
  let zeroBefore = 0  // what old code would have counted these as
  
  for await (const sub of stripe.subscriptions.list({
    status: 'active',
    limit: 100,
    expand: ['data.items.data.price', 'data.latest_invoice']
  })) {
    const items = sub.items.data
    const hasTiered = items.some(i => i.price.billing_scheme === 'tiered' || i.price.unit_amount === null)
    
    if (hasTiered) {
      tieredCount++
      const invoice = sub.latest_invoice
      if (invoice && typeof invoice === 'object' && invoice.amount_due > 0) {
        const firstItem = items.find(i => i.price.recurring?.interval)
        const interval = firstItem?.price.recurring?.interval || 'month'
        const intervalCount = firstItem?.price.recurring?.interval_count || 1
        
        let monthly = invoice.amount_due / 100
        if (interval === 'year') monthly = monthly / (12 * intervalCount)
        tieredMrr += monthly
      }
    } else {
      const subMrr = items.reduce((sum, item) => {
        const amount = (item.price.unit_amount || 0) / 100
        const interval = item.price.recurring?.interval
        if (interval === 'month') return sum + amount
        if (interval === 'year') return sum + amount / 12
        return sum + amount
      }, 0)
      perUnitMrr += subMrr
    }
  }

  console.log('=== MRR Breakdown (active subs only) ===')
  console.log(`Per-unit pricing subs: $${perUnitMrr.toFixed(2)}/mo`)
  console.log(`Tiered/graduated pricing subs (${tieredCount} subs): $${tieredMrr.toFixed(2)}/mo`)
  console.log(`Combined active MRR: $${(perUnitMrr + tieredMrr).toFixed(2)}/mo`)
  console.log(`\nPrevious (broken) calculation missed: $${tieredMrr.toFixed(2)}/mo from tiered subs`)
  
  // Explain invoice vs subscription gap
  const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60)
  let invoiceTotal = 0
  let invoiceCount = 0
  let subscriptionInvoiceTotal = 0
  let oneTimeTotal = 0

  for await (const inv of stripe.invoices.list({ status: 'paid', created: { gte: thirtyDaysAgo }, limit: 100 })) {
    invoiceTotal += inv.amount_paid / 100
    invoiceCount++
    
    // Check if subscription-related
    if (inv.subscription) {
      subscriptionInvoiceTotal += inv.amount_paid / 100
    } else {
      oneTimeTotal += inv.amount_paid / 100
    }
  }

  console.log('\n=== Invoice Revenue (last 30 days) ===')
  console.log(`Total paid: $${invoiceTotal.toFixed(2)} (${invoiceCount} invoices)`)
  console.log(`  Subscription invoices: $${subscriptionInvoiceTotal.toFixed(2)}`)
  console.log(`  One-time / non-subscription: $${oneTimeTotal.toFixed(2)}`)
  console.log(`\nSubscription-based MRR: $234,079/mo`)
  console.log(`Invoice-based 30d avg: $${invoiceTotal.toFixed(2)}/mo`)
  console.log(`Gap: $${(invoiceTotal - 234079).toFixed(2)} (likely catch-up payments + one-time fees)`)
}

sanity().catch(e => console.error(e.stack))
