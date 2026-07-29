const { classifyCancellation } = require('./churn-classification')

function calcSubMRR(sub) {
  return (sub.items?.data || []).reduce((sum, item) => {
    const amount = (item.price?.unit_amount || 0) / 100, qty = item.quantity || 1
    const interval = item.price?.recurring?.interval, count = item.price?.recurring?.interval_count || 1
    return sum + (interval === 'year' ? amount * qty / (12 * count) : interval === 'month' ? amount * qty / count : 0)
  }, 0)
}
function bounds(month) { const [y,m]=month.split('-').map(Number); return { start:Date.UTC(y,m-1,1)/1000, end:Date.UTC(y,m,1)/1000-1 } }
function idOf(sub) { return typeof sub.customer === 'object' ? sub.customer.id : String(sub.customer) }
function add(map,key,n){map.set(key,(map.get(key)||0)+n)}

function buildClassificationMatcher(subs, month, rows, logoFor) {
  const bySub = new Map(rows.filter(r=>r.canceledSubscriptionId).map(r=>[r.canceledSubscriptionId,r]))
  const byStable = new Map(), candidateCounts = new Map()
  for (const row of rows.filter(r=>r.stripeCustomerId && r.canceledMonth && r.mrr != null)) byStable.set(`${row.stripeCustomerId}|${row.canceledMonth}|${Number(row.mrr).toFixed(2)}`,row)
  for(const sub of subs){ if(!sub.canceled_at)continue; const k=`${idOf(sub)}|${month}|${calcSubMRR(sub).toFixed(2)}`; candidateCounts.set(k,(candidateCounts.get(k)||0)+1) }
  return sub => {
    if(bySub.has(sub.id)) return bySub.get(sub.id)
    const k=`${idOf(sub)}|${month}|${calcSubMRR(sub).toFixed(2)}`
    // Customer/month/MRR is permitted only when it resolves exactly one cancel.
    return candidateCounts.get(k)===1 ? byStable.get(k) : undefined
  }
}

function computeMonthMetrics(subs, month, classifications=[], customerToLogo={}) {
  const {start,end}=bounds(month), logoFor=id=>customerToLogo[id]||`stripe:${id}`
  const match=buildClassificationMatcher(subs,month,classifications,logoFor)
  const opening=new Map(), ending=new Map(), retained=new Map(), added=new Set(), lost=new Set(), program=new Set()
  let mrr=0,newMrr=0,retainedNewMrr=0,churnedMrr=0,programChurnMrr=0,activeSubscriptions=0,lateralMovementMrr=0
  // Establish cohort state before interpreting any event; subscription order
  // from Stripe must never change whether a logo is considered retained.
  for(const sub of subs){const amount=calcSubMRR(sub);if(amount<=0)continue;const cid=idOf(sub),logo=logoFor(cid),created=sub.created,canceled=sub.canceled_at
    if(created<start&&(canceled==null||canceled>=start))add(opening,logo,amount)
    if(created<=end&&(canceled==null||canceled>end))add(ending,logo,amount)
  }
  for(const sub of subs){ const amount=calcSubMRR(sub); if(amount<=0)continue; const cid=idOf(sub), logo=logoFor(cid), created=sub.created, canceled=sub.canceled_at
    const atEnd=created<=end&&(canceled==null||canceled>end)
    if(atEnd){mrr+=amount;activeSubscriptions++}
    if(created>=start&&created<=end){newMrr+=amount;added.add(logo);if(atEnd)retainedNewMrr+=amount}
    if(canceled!=null&&canceled>=start&&canceled<=end){ const row=match(sub), d=classifyCancellation(row)
      if(d.programChurn){program.add(logo);programChurnMrr+=amount}
      if(!d.logoChurn){if(d.retainedValue){add(retained,logo,amount);lateralMovementMrr+=amount};continue}
      // A logo with another live program did not churn as a logo. Treat its
      // cancellation as unclassified program contraction, not logo churn.
      if((ending.get(logo)||0)>0){program.add(logo);programChurnMrr+=amount;continue}
      churnedMrr+=amount;lost.add(logo)
    }
  }
  const openingCohortMrr=[...opening.values()].reduce((a,b)=>a+b,0)
  let endingOpeningLogoMrr=0,grossRetainedMrr=0
  for(const [logo,open] of opening){ const close=(ending.get(logo)||0)+(retained.get(logo)||0); endingOpeningLogoMrr+=close; grossRetainedMrr+=Math.min(open,close) }
  const round=n=>Math.round(n*100)/100
  return {mrr:round(mrr),newMrr:round(newMrr),retainedNewMrr:round(retainedNewMrr),churnedMrr:round(churnedMrr),activeSubscriptions,
    clientsAdded:added.size,clientsLost:lost.size,openingClients:opening.size,openingCohortMrr:round(openingCohortMrr),endingOpeningLogoMrr:round(endingOpeningLogoMrr),grossRetainedMrr:round(grossRetainedMrr),
    programChurnMrr:round(programChurnMrr),programChurnClients:program.size,lateralMovementMrr:round(lateralMovementMrr),
    monthlyMRR:round(mrr),pifMRR:0,monthlyClients:activeSubscriptions,pifClients:0,monthlyChurnedMRR:round(churnedMrr),pifChurnedMRR:0,monthlyNewMRR:round(newMrr),pifNewMRR:0,monthlyRetainedNewMRR:round(retainedNewMrr),pifRetainedNewMRR:0}
}
function calculateRates(m){const d=m.openingCohortMrr||0;return {churnPct:m.openingClients?Math.round(m.clientsLost/m.openingClients*1000)/10:0,revenueChurnPct:d?Math.round(m.churnedMrr/d*1000)/10:0,nrr:d?Math.round(m.endingOpeningLogoMrr/d*1000)/10:null,grr:d?Math.round(m.grossRetainedMrr/d*1000)/10:null}}
module.exports={calcSubMRR,computeMonthMetrics,calculateRates,buildClassificationMatcher}
