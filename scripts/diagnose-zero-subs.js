const Stripe = require('/Users/toddthejedigmail.com/.openclaw/workspace/gyc-dashboard/node_modules/stripe')
const stripe = new Stripe('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')

async function investigateZeroSubs() {
  console.log('=== Investigating $0 price subscriptions ===\n')

  const zeroPriceIds = new Set()
  const zeroSubs = []
  
  for await (const sub of stripe.subscriptions.list({ 
    status: 'active', 
    limit: 100, 
    expand: ['data.items.data.price', 'data.customer'] 
  })) {
    for (const item of sub.items.data) {
      if (item.price.unit_amount === 0 || item.price.unit_amount === null) {
        zeroPriceIds.add(item.price.id)
        if (!zeroSubs.find(z => z.sub.id === sub.id)) {
          zeroSubs.push({ sub, item })
        }
      }
    }
  }

  console.log(`Found ${zeroSubs.length} active subs with at least one $0 price item`)
  console.log(`Unique $0 price IDs: ${zeroPriceIds.size}`)
  
  // Inspect a few $0 price objects to understand their billing type
  console.log('\n--- Sample $0 prices ---')
  let inspected = 0
  for (const priceId of zeroPriceIds) {
    if (inspected >= 5) break
    const price = await stripe.prices.retrieve(priceId)
    console.log(`\nPrice ${priceId}:`)
    console.log(`  billing_scheme: ${price.billing_scheme}`)
    console.log(`  unit_amount: ${price.unit_amount}`)
    console.log(`  unit_amount_decimal: ${price.unit_amount_decimal}`)
    console.log(`  nickname: ${price.nickname}`)
    console.log(`  tiers_mode: ${price.tiers_mode}`)
    console.log(`  recurring: ${JSON.stringify(price.recurring)}`)
    if (price.tiers) console.log(`  tiers: ${JSON.stringify(price.tiers)}`)
    inspected++
  }

  // Check recent invoices for zero-price subs to see what they actually charge
  console.log('\n--- Recent invoices for $0 price subs (sample of 5) ---')
  let checked = 0
  for (const { sub, item } of zeroSubs) {
    if (checked >= 5) break
    const customerName = sub.customer?.name || sub.customer?.email || 'Unknown'
    
    // Get latest invoice for this subscription
    const invoices = await stripe.invoices.list({ 
      subscription: sub.id, 
      limit: 2,
      status: 'paid'
    })
    
    const latestInvoice = invoices.data[0]
    if (latestInvoice) {
      console.log(`\nSub ${sub.id} | Customer: ${customerName}`)
      console.log(`  Latest paid invoice: $${(latestInvoice.amount_paid / 100).toFixed(2)}`)
      console.log(`  Invoice lines:`)
      for (const line of latestInvoice.lines.data) {
        console.log(`    - ${line.description || line.price?.nickname || line.price?.id}: $${(line.amount / 100).toFixed(2)}`)
      }
    } else {
      console.log(`\nSub ${sub.id} | Customer: ${customerName} | No paid invoices found`)
    }
    checked++
  }

  // What's the actual revenue from invoices in the last 30 days?
  console.log('\n--- Actual invoiced revenue (last 30 days, paid) ---')
  const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60)
  let totalInvoiced = 0
  let invoiceCount = 0
  
  for await (const invoice of stripe.invoices.list({
    status: 'paid',
    created: { gte: thirtyDaysAgo },
    limit: 100
  })) {
    totalInvoiced += invoice.amount_paid / 100
    invoiceCount++
  }
  
  console.log(`Total paid invoices (last 30d): ${invoiceCount} invoices | $${totalInvoiced.toFixed(2)}`)
  console.log(`Annualized: $${(totalInvoiced * 12).toFixed(2)}`)
}

investigateZeroSubs().catch(e => console.error(e.stack || e.message))
