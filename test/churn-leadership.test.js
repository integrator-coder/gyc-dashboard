const test=require('node:test'), assert=require('node:assert/strict')
const {buildLeadershipView}=require('../lib/churn-leadership')
const e=(type,mrr,extra={})=>({cancellationType:type,sourceMrr:mrr,logoKey:extra.name||type,logoOutcome:'retained',programOutcome:'migrated',reviewStatus:'confirmed',...extra})
test('June audited reconciliation',()=>{const v=buildLeadershipView([
 ...Array.from({length:7},(_,i)=>e('true_logo_churn',i?0:9338.34,{name:`x${i}`,logoOutcome:'exited',programOutcome:'exited'})),e('program_churn',995,{programOutcome:'exited'}),e('internal_lateral',1497),e('billing_replacement',197),e('billing_replacement',599)
]);assert.deepEqual([v.totals.logosLost,v.totals.logoMrrLost,v.totals.programsLost,v.totals.programMrrLost,v.totals.lateralGrossMrr,v.mix.billing_replacement.sourceMrr],[7,9338.34,1,995,1497,796])})
test('July audited reconciliation and unknown destinations stay unknown',()=>{const v=buildLeadershipView([
 ...Array.from({length:5},(_,i)=>e('true_logo_churn',i?0:2195,{name:`x${i}`,logoOutcome:'exited',programOutcome:'exited'})),...['a','b','c'].map((name,i)=>e('internal_lateral',[795,1395,995][i],{name,destinationMrr:null,reviewStatus:'needs_review'})),e('billing_replacement',790),e('billing_replacement',1019),e('pif_deferred',899,{programOutcome:'deferred'}),e('pif_deferred',317,{programOutcome:'deferred'})
]);assert.deepEqual([v.totals.logosLost,v.totals.logoMrrLost,v.totals.lateralGrossMrr,v.mix.billing_replacement.sourceMrr,v.totals.pifOfflineMrr,v.totals.needsReview],[5,2195,3185,1809,1216,3]);assert.equal(v.totals.lateralKnownNetDelta,0)})
test('taxonomy fails closed',()=>assert.throws(()=>buildLeadershipView([e('made_up',1)]),/Invalid/))
