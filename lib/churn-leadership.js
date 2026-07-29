const BUCKETS = ['true_logo_churn','program_churn','internal_lateral','pif_deferred','billing_replacement','duplicate_artifact','unknown']

function summarizeEvents(events) {
  const out = Object.fromEntries(BUCKETS.map(bucket => [bucket, { count: 0, sourceMrr: 0, destinationMrr: 0, netMrrDelta: 0 }]))
  for (const event of events) {
    if (!BUCKETS.includes(event.cancellationType)) throw new Error(`Invalid cancellation type: ${event.cancellationType}`)
    const row = out[event.cancellationType]
    row.count += 1
    row.sourceMrr += Number(event.sourceMrr || 0)
    if (event.destinationMrr != null) row.destinationMrr += Number(event.destinationMrr)
    if (event.destinationMrr != null) row.netMrrDelta += Number(event.destinationMrr) - Number(event.sourceMrr || 0)
  }
  return out
}

function buildLeadershipView(events) {
  const mix = summarizeEvents(events)
  const logoExits = events.filter(e => e.logoOutcome === 'exited')
  const programExits = events.filter(e => e.programOutcome === 'exited' && e.logoOutcome !== 'exited')
  const needsReview = events.filter(e => e.reviewStatus === 'needs_review' || e.cancellationType === 'unknown')
  return {
    mix,
    totals: {
      logosLost: new Set(logoExits.map(e => e.logoKey)).size,
      logoMrrLost: logoExits.reduce((n,e) => n + Number(e.sourceMrr || 0), 0),
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
