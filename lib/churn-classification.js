const EXCLUDED = new Set(['internal_lateral','pif_deferred','billing_replacement','duplicate_artifact','program_churn'])
// Only value genuinely moved offline (monthly -> paid-in-full) needs an
// addback. Replacements and service migrations are already present in ending MRR.
const RETAINED = new Set(['pif_deferred'])
const OUTCOMES={true_logo_churn:['exited','exited'],program_churn:['retained','exited'],internal_lateral:['retained','migrated'],pif_deferred:['retained','deferred'],billing_replacement:['retained','replaced'],duplicate_artifact:['retained','replaced'],unknown:['unknown','unknown']}
function classifyCancellation(row) {
  const type = row?.classificationType || row?.type || 'unknown'
  const confirmed = row?.status === 'confirmed' || row?.confirmed === true
  if(!OUTCOMES[type]) throw new Error(`Invalid v2 cancellation taxonomy: ${type}`)
  const expected=OUTCOMES[type]
  if(row?.logoOutcome&&row.logoOutcome!==expected[0]||row?.programOutcome&&row.programOutcome!==expected[1])throw new Error(`Contradictory outcomes for ${type}`)
  return { type, confirmed, reason: row?.reason || null,
    logoChurn: !(confirmed && EXCLUDED.has(type)),
    programChurn: confirmed && type === 'program_churn',
    retainedValue: confirmed && RETAINED.has(type) }
}
function normalizeClientName(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '') }
function classificationKey(clientName, canceledMonth, mrr) { return `${normalizeClientName(clientName)}|${canceledMonth}|${Number(mrr).toFixed(2)}` }
function pifLifecycleStatus(row, now=new Date()) { if(row.returnedAt)return 'returned';if(row.renewedPif)return 'renewed_pif';if(row.trueChurnAtTerm)return 'true_churn_at_term';if(!row.pifCash&&!row.expectedReturnDate)return 'proposed';if(!row.pifCash)return 'pending_payment';if(!row.expectedReturnDate)return 'active';const days=Math.ceil((new Date(row.expectedReturnDate)-now)/86400000);if(days<0)return 'overdue_unresolved';if(days<=7)return 'return_due_7';if(days<=30)return 'return_due_30';if(days<=60)return 'return_due_60';return 'active'}
module.exports = { classifyCancellation, normalizeClientName, classificationKey, pifLifecycleStatus, OUTCOMES }
