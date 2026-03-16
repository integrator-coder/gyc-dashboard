const Stripe = require('/Users/toddthejedigmail.com/.openclaw/workspace/gyc-dashboard/node_modules/stripe')
const stripe = new Stripe('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')

async function diagnose() {
  // 1. Count subscriptions by ALL statuses
  const statuses = ['active', 'past_due', 'trialing', 'unpaid', 'paused', 'incomplete']
  
  for (const status of statuses) {
    const subs = []
    for await (const sub of stripe.subscriptions.list({ status, limit: 100, expand: ['data.customer'] })) {
      subs.push(sub)
    }
    
    let mrr = 0
    for (const sub of subs) {
      for (const item of sub.items.data) {
        const amount = item.price.unit_amount / 100
        const interval = item.price.recurring?.interval
        if (interval === 'month') mrr += amount
        else if (interval === 'year') mrr += amount / 12
        else mrr += amount
      }
    }
    
    if (subs.length > 0) {
      console.log(`Status: ${status} | Count: ${subs.length} | MRR contribution: $${mrr.toFixed(2)}`)
    }
  }

  // 2. Check price breakdown for active subs - what intervals exist?
  console.log('\n--- Price interval breakdown (active subs) ---')
  const intervalMap = {}
  const planMap = {}
  for await (const sub of stripe.subscriptions.list({ status: 'active', limit: 100, expand: ['data.items.data.price'] })) {
    for (const item of sub.items.data) {
      const interval = item.price.recurring?.interval || 'unknown'
      const amount = item.price.unit_amount / 100
      const nickname = item.price.nickname || item.price.id
      
      intervalMap[interval] = (intervalMap[interval] || 0) + 1
      if (!planMap[nickname]) planMap[nickname] = { count: 0, total: 0, interval }
      planMap[nickname].count++
      planMap[nickname].total += amount
    }
  }
  console.log('Intervals:', intervalMap)
  console.log('\nTop plans by count:')
  Object.entries(planMap)
    .sort((a,b) => b[1].count - a[1].count)
    .slice(0, 20)
    .forEach(([name, data]) => {
      console.log(`  ${name}: ${data.count} subs @ $${(data.total/data.count).toFixed(2)}/${data.interval}`)
    })

  // 3. Top 5 subscriptions by MRR - verify math
  console.log('\n--- Top 5 subscriptions by MRR (active) ---')
  const allActiveSubs = []
  for await (const sub of stripe.subscriptions.list({ 
    status: 'active', 
    limit: 100, 
    expand: ['data.customer', 'data.items.data.price'] 
  })) {
    let subMrr = 0
    for (const item of sub.items.data) {
      const amount = item.price.unit_amount / 100
      const interval = item.price.recurring?.interval
      if (interval === 'month') subMrr += amount
      else if (interval === 'year') subMrr += amount / 12
      else subMrr += amount
    }
    allActiveSubs.push({ sub, mrr: subMrr })
  }
  
  allActiveSubs.sort((a, b) => b.mrr - a.mrr)
  allActiveSubs.slice(0, 5).forEach(({ sub, mrr }) => {
    const customerName = sub.customer?.name || sub.customer?.email || sub.customer_id || 'Unknown'
    console.log(`\n  Customer: ${customerName}`)
    console.log(`  Sub ID: ${sub.id}`)
    console.log(`  MRR: $${mrr.toFixed(2)}`)
    for (const item of sub.items.data) {
      const amount = item.price.unit_amount / 100
      const interval = item.price.recurring?.interval
      const nickname = item.price.nickname || item.price.id
      console.log(`    - ${nickname}: $${amount}/${interval}`)
    }
  })
}

diagnose().catch(e => console.error(e.message))
