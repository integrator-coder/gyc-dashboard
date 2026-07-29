const BUCKETS = ['true_logo_churn','program_churn','internal_lateral','pif_deferred','billing_replacement','duplicate_artifact','unknown']
const VALID={true_logo_churn:['exited','exited'],program_churn:['retained','exited'],internal_lateral:['retained','migrated'],pif_deferred:['retained','deferred'],billing_replacement:['retained','replaced'],duplicate_artifact:['retained','replaced'],unknown:['unknown','unknown']}
const V2_FIELDS=['canceledSubscriptionId','logoKey','clientName','cancellationType','logoOutcome','programOutcome','sourceMrr','sourceProgram','sourceProgramKey','openingProgramMrr','destinationMrr','destinationProgram','destinationSubscriptionId','pifCash','pifTermMonths','expectedReturnDate','pifLifecycleStatus','reviewStatus','confidence','evidence','reason','reasonCategory','canceledMonth']
function serializeLeadershipRow(row){return Object.fromEntries(V2_FIELDS.map(k=>[k,row[k]??null]))}

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
  const canonicalPrograms=rows=>{const groups=new Map();for(const e of rows){const key=`${e.logoKey}|${e.sourceProgramKey||e.sourceProgram||e.canceledSubscriptionId}`;groups.set(key,Math.max(groups.get(key)||0,Number(e.openingProgramMrr??e.sourceMrr??0)))}return {count:groups.size,mrr:[...groups.values()].reduce((a,b)=>a+b,0)}}
  const standalone=canonicalPrograms(programExits),withLogoExit=canonicalPrograms(logoExits)
  const needsReview = events.filter(e => e.reviewStatus === 'needs_review' || e.cancellationType === 'unknown')
  const pifEvents=events.filter(e=>e.cancellationType==='pif_deferred'),pifCashPending=pifEvents.filter(e=>e.pifCash===null||e.pifCash===undefined).length
  return {
    mix,
    totals: {
      logosLost: new Set(logoExits.map(e => e.logoKey)).size,
      logoMrrLost: logoExits.reduce((n,e) => n + Number(e.sourceMrr || 0), 0),
      programsLostWithLogoExit: withLogoExit.count,
      programMrrLostWithLogoExit: withLogoExit.mrr,
      programsLost: standalone.count,
      programMrrLost: standalone.mrr,
      lateralGrossMrr: mix.internal_lateral.sourceMrr,
      lateralKnownNetDelta: mix.internal_lateral.netMrrDelta,
      pifOfflineMrr: mix.pif_deferred.sourceMrr,
      pifCash: pifEvents.reduce((n,e)=>n+(e.pifCash==null?0:Number(e.pifCash)),0),
      pifCashPending,
      needsReview: needsReview.length,
    },
    logoExits, programExits,
    laterals: events.filter(e => e.cancellationType === 'internal_lateral'),
    pifLifecycle: events.filter(e => e.cancellationType === 'pif_deferred'),
    replacements: events.filter(e => ['billing_replacement','duplicate_artifact'].includes(e.cancellationType)),
    needsReview,
  }
}

module.exports = { BUCKETS, V2_FIELDS, serializeLeadershipRow, summarizeEvents, buildLeadershipView }
