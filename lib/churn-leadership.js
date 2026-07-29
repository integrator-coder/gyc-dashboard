const BUCKETS = ['true_logo_churn','program_churn','internal_lateral','pif_deferred','billing_replacement','duplicate_artifact','unknown']
const VALID={true_logo_churn:['exited','exited'],program_churn:['retained','exited'],internal_lateral:['retained','migrated'],pif_deferred:['retained','deferred'],billing_replacement:['retained','replaced'],duplicate_artifact:['retained','replaced'],unknown:['unknown','unknown']}

function summarizeEvents(events) {
  const out = Object.fromEntries(BUCKETS.map(bucket => [bucket, { count: 0, sourceMrr: 0, destinationMrr: 0, netMrrDelta: 0 }]))
  for (const event of events) {
    if (!BUCKETS.includes(event.cancellationType)) throw new Error(`Invalid cancellation type: ${event.cancellationType}`)
    const expected=VALID[event.cancellationType];if(event.logoOutcome!==expected[0]||event.programOutcome!==expected[1])throw new Error(`Contradictory outcomes for ${event.cancellationType}`)
    const row = out[event.cancellationType]
    row.count += 1
    row.sourceMrr += Number(event.sourceMrr || 0)
    if (event.destinationMrr != null) row.destinationMrr += Number(event.destinationMrr)
    if (event.destinationMrr != null) row.netMrrDelta += Number(event.destinationMrr) - Number(event.sourceMrr || 0)
  }
  return out
}

function buildLeadershipView(events) {
  const seen=new Set();events=events.filter((e,i)=>{const k=e.canceledSubscriptionId||`${e.logoKey}|${e.canceledMonth}|${e.cancellationType}|${e.sourceMrr}|${i}`;if(seen.has(k))return false;seen.add(k);return true})
  const mix = summarizeEvents(events)
  const logoExits = events.filter(e => e.logoOutcome === 'exited')
  const programExits = events.filter(e => e.programOutcome === 'exited' && e.logoOutcome !== 'exited')
  const needsReview = events.filter(e => e.reviewStatus === 'needs_review' || e.cancellationType === 'unknown')
  return {
    mix,
    totals: {
      logosLost: new Set(logoExits.map(e => e.logoKey)).size,
      logoMrrLost: logoExits.reduce((n,e) => n + Number(e.sourceMrr || 0), 0),
      programsLostWithLogoExit: logoExits.length,
      programMrrLostWithLogoExit: logoExits.reduce((n,e)=>n+Number(e.sourceMrr||0),0),
      programsLost: programExits.length,
      programMrrLost: programExits.reduce((n,e) => n + Number(e.sourceMrr || 0), 0),
      lateralGrossMrr: mix.internal_lateral.sourceMrr,
      lateralKnownNetDelta: mix.internal_lateral.netMrrDelta,
      pifOfflineMrr: mix.pif_deferred.sourceMrr,
      pifCash: events.filter(e=>e.cancellationType==='pif_deferred').reduce((n,e)=>n+Number(e.pifCash||0),0),
      needsReview: needsReview.length,
    },
    logoExits, programExits,
    laterals: events.filter(e => e.cancellationType === 'internal_lateral'),
    pifLifecycle: events.filter(e => e.cancellationType === 'pif_deferred'),
    replacements: events.filter(e => ['billing_replacement','duplicate_artifact'].includes(e.cancellationType)),
    needsReview,
  }
}

module.exports = { BUCKETS, summarizeEvents, buildLeadershipView }
