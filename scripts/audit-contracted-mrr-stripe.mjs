import fs from 'node:fs'
import pg from 'pg'
import Stripe from 'stripe'

const secrets = JSON.parse(fs.readFileSync(`${process.env.HOME}/.openclaw/secrets.json`, 'utf8'))
const stripe = new Stripe(secrets.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })
const pool = new pg.Pool({
  connectionString: secrets.NEON_DATABASE_URL || secrets.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, max: 2,
})
const included = ['active', 'past_due', 'unpaid']
const money = n => Math.round((Number(n) || 0) * 100) / 100
const customerId = x => typeof x === 'string' ? x : x?.id
const monthly = (amount, recurring) => {
  const count = Number(recurring?.interval_count || 1)
  if (recurring?.interval === 'month') return amount / count
  if (recurring?.interval === 'year') return amount / (12 * count)
  if (recurring?.interval === 'week') return amount * 52 / (12 * count)
  if (recurring?.interval === 'day') return amount * 365 / (12 * count)
  return 0
}
function itemMrr(item) {
  const p = item.price
  const raw = p.unit_amount_decimal == null ? p.unit_amount : Number(p.unit_amount_decimal)
  if (raw == null) return null
  return monthly(raw * Number(item.quantity || 1) / 100, p.recurring)
}
function subMrr(sub, anomalies) {
  let total = 0
  for (const item of sub.items.data) {
    const inv = typeof sub.latest_invoice === 'object' ? sub.latest_invoice : null
    const matchingLines = inv?.lines?.data?.filter(l => l.price?.id === item.price.id) || []
    // Invoice line amounts are pre-discount. Contracted MRR must use the net
    // recurring obligation, so subtract line-level allocated discounts. Tiered
    // prices emit multiple lines and all tiers must be summed.
    if (matchingLines.length) {
      const netPeriodAmount = matchingLines.reduce((sum, line) => {
        const discounts = (line.discount_amounts || []).reduce((n, d) => n + Number(d.amount || 0), 0)
        return sum + Number(line.amount || 0) - discounts
      }, 0) / 100
      total += monthly(netPeriodAmount, item.price.recurring)
      continue
    }
    const value = itemMrr(item)
    if (value != null) total += value
    else anomalies.push({type:'unpriced', subscription:sub.id, price:item.price.id})
  }
  return total
}

const client = await pool.connect()
try {
  const mirrorResult = await client.query(`
    SELECT id,name,email,status,mrr,"updatedAt",acronym
    FROM "StripeCustomer"
    WHERE status IN ('active','past_due','unpaid')
  `)
  const allMirrorResult = await client.query(`SELECT id,name,email,status,mrr,"updatedAt",acronym FROM "StripeCustomer"`)
  const mirror = new Map(mirrorResult.rows.map(r => [r.id, r]))
  const allMirror = new Map(allMirrorResult.rows.map(r => [r.id, r]))

  const subs = []
  for (const status of included) {
    for await (const sub of stripe.subscriptions.list({
      status, limit:100,
      expand:['data.customer','data.latest_invoice','data.items.data.price'],
    })) subs.push(sub)
  }
  const anomalies = []
  const statusTotals = Object.fromEntries(included.map(status => [status, 0]))
  const stripeCustomers = new Map()
  for (const sub of subs) {
    const id = customerId(sub.customer)
    const row = stripeCustomers.get(id) || {
      id, name: typeof sub.customer === 'object' ? (sub.customer.name || sub.customer.email) : null,
      email: typeof sub.customer === 'object' ? sub.customer.email : null,
      mrr:0, statuses:[], subscriptions:[], intervals:[],
    }
    const value = subMrr(sub, anomalies)
    statusTotals[sub.status] += value
    row.mrr += value
    row.statuses.push(sub.status)
    row.subscriptions.push({id:sub.id,status:sub.status,mrr:money(value)})
    row.intervals.push(...sub.items.data.map(i => `${i.price.recurring?.interval || 'none'}:${i.price.recurring?.interval_count || 1}`))
    stripeCustomers.set(id,row)
  }

  const ids = new Set([...mirror.keys(), ...stripeCustomers.keys()])
  const comparisons = [...ids].map(id => {
    const d = mirror.get(id), s = stripeCustomers.get(id)
    const db = Number(d?.mrr || 0), live = Number(s?.mrr || 0), diff = db-live
    return {id,name:d?.name || s?.name || id,email:d?.email || s?.email || null,acronym:d?.acronym || null,
      dbStatus:d?.status || allMirror.get(id)?.status || 'missing',stripeStatus:s ? [...new Set(s.statuses)].join('+') : 'no_included_subscription',
      dbMrr:money(db),stripeMrr:money(live),differenceDbMinusStripe:money(diff),
      pctOfStripe:live ? money(Math.abs(diff)/live*100) : null, intervals:s ? [...new Set(s.intervals)] : [], subscriptions:s?.subscriptions || []}
  })
  const discrepancies = comparisons.filter(r => Math.abs(r.differenceDbMinusStripe)>10 || (r.stripeMrr && Math.abs(r.differenceDbMinusStripe)/r.stripeMrr>.05))
    .sort((a,b)=>Math.abs(b.differenceDbMinusStripe)-Math.abs(a.differenceDbMinusStripe))

  // Inspect one-time paid invoices for PIF evidence. This is diagnostic only: a one-time
  // invoice is not an active Stripe subscription and cannot establish a current contract term by itself.
  const since = Math.floor(Date.now()/1000) - 370*86400
  const pifInvoices = []
  for await (const inv of stripe.invoices.list({status:'paid',created:{gte:since},limit:100,expand:['data.customer','data.lines.data.price']})) {
    if (inv.subscription) continue
    const text = [inv.description, ...inv.lines.data.map(l=>l.description), JSON.stringify(inv.metadata||{})].filter(Boolean).join(' ')
    if (/\bpif\b|paid.?in.?full|6.?month|six.?month|semi.?annual|upfront/i.test(text)) {
      pifInvoices.push({id:inv.id,created:new Date(inv.created*1000).toISOString().slice(0,10),customer:customerId(inv.customer),
        name:typeof inv.customer==='object'?(inv.customer.name||inv.customer.email):null,amountPaid:money(inv.amount_paid/100),description:text.slice(0,500)})
    }
  }

  const priorNames = ['ACH','AMS','AN','BBP','CK','ELA','LA','MP','OGNS','TEN','TTS']
  const priorCorrections = comparisons.filter(r => priorNames.includes(r.acronym) || priorNames.includes(r.name))
  const report = {
    asOf:new Date().toISOString(),
    totals:{
      stripeSubscriptionCount:subs.length,stripeCustomerCount:stripeCustomers.size,
      stripeTrueMrr:money([...stripeCustomers.values()].reduce((n,r)=>n+r.mrr,0)),
      dbIncludedCustomerCount:mirror.size,dbMirrorMrr:money([...mirror.values()].reduce((n,r)=>n+Number(r.mrr||0),0)),
      stripeMrrByStatus:Object.fromEntries(included.map(status => [status, money(statusTotals[status])])),
    },
    statusCounts:{stripe:Object.fromEntries(included.map(st=>[st,subs.filter(s=>s.status===st).length])),
      db:Object.fromEntries(included.map(st=>[st,mirrorResult.rows.filter(r=>r.status===st).length]))},
    discrepancies,allComparisons:comparisons,pricingAnomalies:anomalies,
    pifEvidence:{matchedOneTimeInvoicesLast370Days:pifInvoices.length,invoices:pifInvoices},
    priorEleven:priorCorrections,
  }
  report.totals.differenceDbMinusStripe = money(report.totals.dbMirrorMrr-report.totals.stripeTrueMrr)
  fs.writeFileSync('/tmp/gyc-mrr-audit.json', JSON.stringify(report,null,2))
  console.log(JSON.stringify({totals:report.totals,statusCounts:report.statusCounts,discrepancyCount:discrepancies.length,
    discrepancies:discrepancies.map(({subscriptions,...r})=>r),pricingAnomalies:anomalies,pifEvidenceCount:pifInvoices.length,
    priorEleven:priorCorrections.map(({subscriptions,...r})=>r)},null,2))
} finally { client.release(); await pool.end() }
