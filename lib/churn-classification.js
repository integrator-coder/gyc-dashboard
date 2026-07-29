const EXCLUDED = new Set(['lateral_migration','pif_lateral','billing_replacement','duplicate_artifact','program_churn'])
const RETAINED = new Set(['lateral_migration','pif_lateral','billing_replacement'])
function classifyCancellation(row) {
  const type = row?.classificationType || row?.type || 'unclassified'
  const confirmed = row?.status === 'confirmed' || row?.confirmed === true
  return { type, confirmed, reason: row?.reason || null,
    logoChurn: !(confirmed && EXCLUDED.has(type)),
    programChurn: confirmed && type === 'program_churn',
    retainedValue: confirmed && RETAINED.has(type) }
}
function normalizeClientName(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '') }
function classificationKey(clientName, canceledMonth, mrr) { return `${normalizeClientName(clientName)}|${canceledMonth}|${Number(mrr).toFixed(2)}` }
module.exports = { classifyCancellation, normalizeClientName, classificationKey }
