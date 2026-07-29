const test = require('node:test'); const assert = require('node:assert/strict')
const { classifyCancellation } = require('../lib/churn-classification')
test('confirmed moves/artifacts are excluded',()=>{ for(const type of ['lateral_migration','pif_lateral','billing_replacement','duplicate_artifact']) assert.equal(classifyCancellation({type,confirmed:true}).logoChurn,false) })
test('program churn is separate',()=>{ const x=classifyCancellation({type:'program_churn',confirmed:true}); assert.equal(x.logoChurn,false); assert.equal(x.programChurn,true) })
test('unknowns remain provisional logo churn',()=>{ assert.equal(classifyCancellation(null).logoChurn,true); assert.equal(classifyCancellation({type:'lateral_migration'}).logoChurn,true) })
test('audited June and July reconcile',()=>{
 const june=[['Frederick',197,'billing_replacement'],['Virginia',599,'billing_replacement'],['Early Ivy',995,'logo_churn'],['Jeffrey',499,'unclassified'],['Growing Kids',3551,'logo_churn'],['Apogee',197,'logo_churn'],['Helping',499,'unclassified'],['Montessori',995,'program_churn'],['Kiddie',1583.34,'logo_churn'],['Lehigh',1497,'lateral_migration'],['La Esperanza',2014,'logo_churn']]
 const july=[['Tweety',790,'billing_replacement'],['Casa',399,'unclassified'],['Alpha',197,'unclassified'],['Great Beginnings',1019,'billing_replacement'],['Northside',1195,'logo_churn'],['Happy Times',207,'unclassified'],['Tomorrowland',197,'logo_churn'],['Little Treehouse',795,'lateral_migration'],['Crossing Borders',1395,'lateral_migration'],['Kidstown',995,'lateral_migration']]
 const kept=r=>r.filter(([, ,type])=>classifyCancellation({type,confirmed:type!=='unclassified'}).logoChurn)
 const sum=r=>kept(r).reduce((s,[,m])=>s+m,0)
 assert.equal(sum(june),9338.34); assert.equal(kept(june).length,7); assert.equal(sum(july),2195); assert.equal(kept(july).length,5)
})
