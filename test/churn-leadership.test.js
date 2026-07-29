const test=require('node:test'), assert=require('node:assert/strict')
const {buildLeadershipView}=require('../lib/churn-leadership')
const outcomes={true_logo_churn:['exited','exited'],program_churn:['retained','exited'],internal_lateral:['retained','migrated'],pif_deferred:['retained','deferred'],billing_replacement:['retained','replaced'],duplicate_artifact:['retained','replaced'],unknown:['unknown','unknown']}
const e=(type,mrr,extra={})=>({cancellationType:type,sourceMrr:mrr,logoKey:extra.name||type,logoOutcome:outcomes[type][0],programOutcome:outcomes[type][1],reviewStatus:'confirmed',...extra})
test('June audited reconciliation',()=>{const v=buildLeadershipView([
 ...Array.from({length:7},(_,i)=>e('true_logo_churn',i?0:9338.34,{name:`x${i}`,logoOutcome:'exited',programOutcome:'exited'})),e('program_churn',995,{programOutcome:'exited'}),e('internal_lateral',1497),e('billing_replacement',197),e('billing_replacement',599)
]);assert.deepEqual([v.totals.logosLost,v.totals.logoMrrLost,v.totals.programsLost,v.totals.programMrrLost,v.totals.lateralGrossMrr,v.mix.billing_replacement.sourceMrr],[7,9338.34,1,995,1497,796])})
test('July audited reconciliation and unknown destinations stay unknown',()=>{const v=buildLeadershipView([
 ...Array.from({length:5},(_,i)=>e('true_logo_churn',i?0:2195,{name:`x${i}`,logoOutcome:'exited',programOutcome:'exited'})),...['a','b','c'].map((name,i)=>e('internal_lateral',[795,1395,995][i],{name,destinationMrr:null,reviewStatus:'needs_review'})),e('billing_replacement',790),e('billing_replacement',1019),e('pif_deferred',899,{programOutcome:'deferred'}),e('pif_deferred',317,{programOutcome:'deferred'})
]);assert.deepEqual([v.totals.logosLost,v.totals.logoMrrLost,v.totals.lateralGrossMrr,v.mix.billing_replacement.sourceMrr,v.totals.pifOfflineMrr,v.totals.needsReview],[5,2195,3185,1809,1216,3]);assert.equal(v.totals.lateralKnownNetDelta,0)})
test('taxonomy fails closed',()=>assert.throws(()=>buildLeadershipView([{cancellationType:'made_up',sourceMrr:1,logoOutcome:'unknown',programOutcome:'unknown'}]),/Invalid/))
test('contradictory outcome fails closed',()=>assert.throws(()=>buildLeadershipView([e('program_churn',10,{logoOutcome:'exited'})]),/Contradictory/))
test('duplicate subscription event is counted once',()=>{const x=e('true_logo_churn',100,{name:'A',canceledSubscriptionId:'sub_1'});const v=buildLeadershipView([x,{...x}]);assert.equal(v.totals.logosLost,1);assert.equal(v.totals.logoMrrLost,100)})
