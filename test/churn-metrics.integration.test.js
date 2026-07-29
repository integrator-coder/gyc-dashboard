const test=require('node:test'); const assert=require('node:assert/strict')
const {computeMonthMetrics,calculateRates}=require('../lib/churn-metrics')
const {upsertChurnMetrics,migrateChurnClassificationSchema}=require('../scripts/monthly-mrr-nrr-update')
const ts=s=>Date.parse(s)/1000
function sub(id,c,mrr,created='2026-05-01',canceled=null){return{id,customer:c,created:ts(created),canceled_at:canceled?ts(canceled):null,items:{data:[{quantity:1,price:{unit_amount:mrr*100,recurring:{interval:'month',interval_count:1}}}]}}}
test('unique-logo denominator dedupes duplicate Stripe customers',()=>{
 const rows=[sub('a','cus_1',100),sub('b','cus_2',200),sub('c','cus_3',300)]
 const m=computeMonthMetrics(rows,'2026-06',[],{cus_1:'LOGO_A',cus_2:'LOGO_A',cus_3:'LOGO_B'})
 assert.equal(m.openingClients,2);assert.equal(m.openingCohortMrr,600)
})
test('stable customer classification excludes lateral and resolves Lehigh/Ethia alias',()=>{
 const rows=[sub('lehigh-cancel','cus_ethia',1497,'2026-05-01','2026-06-15')]
 const cls=[{stripeCustomerId:'cus_ethia',logoKey:'LSAEE',canceledMonth:'2026-06',mrr:1497,type:'lateral_migration',confirmed:true}]
 const m=computeMonthMetrics(rows,'2026-06',cls,{cus_ethia:'LSAEE'})
 assert.equal(m.clientsLost,0);assert.equal(m.churnedMrr,0);assert.equal(m.lateralMovementMrr,0)
})
test('same-customer same-MRR collision refuses fallback classification',()=>{
 const rows=[sub('x1','cus_x',500,'2026-05-01','2026-06-10'),sub('x2','cus_x',500,'2026-05-01','2026-06-11')]
 const cls=[{stripeCustomerId:'cus_x',canceledMonth:'2026-06',mrr:500,type:'lateral_migration',confirmed:true}]
 const m=computeMonthMetrics(rows,'2026-06',cls,{cus_x:'X'})
 assert.equal(m.clientsLost,1);assert.equal(m.churnedMrr,1000)
})
test('GRR includes contraction while NRR follows opening-logo cohort',()=>{
 const rows=[sub('old','cus_a',1000,'2026-05-01','2026-06-10'),sub('replacement','cus_a',800,'2026-06-10')]
 const m=computeMonthMetrics(rows,'2026-06',[],{cus_a:'A'}),r=calculateRates(m)
 assert.equal(m.clientsLost,0);assert.equal(m.programChurnMrr,1000);assert.equal(r.grr,80);assert.equal(r.nrr,80)
})
test('upsert binds unique-logo fields and derived cohort rates',async()=>{
 let call;const db={query:async(sql,args)=>{call={sql,args}}}; const m={mrr:800,openingClients:1,clientsLost:0,clientsAdded:0,newMrr:800,churnedMrr:0,openingCohortMrr:1000,endingOpeningLogoMrr:800,grossRetainedMrr:800,activeSubscriptions:1,programChurnClients:1,programChurnMrr:1000,monthlyMRR:800,pifMRR:0,monthlyClients:1,pifClients:0,monthlyChurnedMRR:0,pifChurnedMRR:0,monthlyNewMRR:800,pifNewMRR:0}
 await upsertChurnMetrics(db,'2026-06',m,null);assert.match(call.sql,/"openingCohortMRR"/);assert.equal(call.args[8],0);assert.equal(call.args[9],0);assert.equal(call.args[10],80);assert.equal(call.args[11],80)
})
test('audited June and July fixtures retain lateral exclusions',()=>{
 const cohort=(month,items)=>{const rows=[],cls=[],aliases={};for(const [key,mrr,type] of items){const cid=`cus_${key}`,sid=`sub_${key}`;aliases[cid]=key;rows.push(sub(sid,cid,mrr,'2026-05-01',`${month}-15`));if(type!=='logo_churn'&&type!=='unclassified')cls.push({stripeCustomerId:cid,canceledMonth:month,mrr,type,confirmed:true})}return computeMonthMetrics(rows,month,cls,aliases)}
 const june=cohort('2026-06',[['earlyivy',995,'logo_churn'],['jeffrey',499,'unclassified'],['growing',3551,'logo_churn'],['apogee',197,'logo_churn'],['helping',499,'unclassified'],['kiddie',1583.34,'logo_churn'],['laesperanza',2014,'logo_churn'],['frederick',197,'billing_replacement'],['virginia',599,'billing_replacement'],['montessori',995,'program_churn'],['lehigh',1497,'lateral_migration']])
 const july=cohort('2026-07',[['casa',399,'unclassified'],['alpha',197,'unclassified'],['northside',1195,'logo_churn'],['happy',207,'unclassified'],['tomorrowland',197,'logo_churn'],['tweety',790,'billing_replacement'],['greatbeginnings',1019,'billing_replacement'],['littletreehouse',795,'lateral_migration'],['crossingborders',1395,'lateral_migration'],['kidstown',995,'lateral_migration']])
 assert.equal(june.clientsLost,7);assert.equal(june.churnedMrr,9338.34);assert.equal(june.programChurnClients,1)
 assert.equal(july.clientsLost,5);assert.equal(july.churnedMrr,2195);assert.equal(july.lateralMovementMrr,0)
})
test('lateral replacement is not double-added to NRR or GRR',()=>{
 const rows=[sub('old','cus_a',500,'2026-05-01','2026-06-10'),sub('new','cus_a',500,'2026-06-10')]
 const cls=[{stripeCustomerId:'cus_a',canceledMonth:'2026-06',mrr:500,type:'lateral_migration',confirmed:true}]
 const m=computeMonthMetrics(rows,'2026-06',cls,{cus_a:'A'}),r=calculateRates(m)
 assert.equal(m.lateralMovementMrr,0);assert.equal(r.nrr,100);assert.equal(r.grr,100)
})
test('in-month additions do not inflate exited-logo revenue churn',()=>{
 const rows=[sub('opening','cus_a',100,'2026-05-01','2026-06-10'),sub('inmonth','cus_a',500,'2026-06-01','2026-06-11')]
 const m=computeMonthMetrics(rows,'2026-06',[],{cus_a:'A'});assert.equal(m.clientsLost,1);assert.equal(m.churnedMrr,100)
})
test('annual subscriptions preserve PIF MRR and annualized calc',()=>{
 const annual=sub('annual','cus_p',1200);annual.items.data[0].price.recurring.interval='year'
 const m=computeMonthMetrics([annual],'2026-06',[],{cus_p:'P'});assert.equal(m.pifMRR,100);assert.equal(m.monthlyMRR,0);assert.equal(m.pifClients,1)
})
test('unmapped opening customers are explicitly flagged',()=>{
 const m=computeMonthMetrics([sub('x','cus_unmapped',100)],'2026-06',[],{});assert.deepEqual(m.unmappedOpeningCustomers,['cus_unmapped'])
})
test('cross-month cancellation does not create a false collision',()=>{
 const rows=[sub('june','cus_a',500,'2026-05-01','2026-06-10'),sub('july','cus_a',500,'2026-05-01','2026-07-10')]
 const cls=[{stripeCustomerId:'cus_a',canceledMonth:'2026-06',mrr:500,type:'pif_lateral',confirmed:true}]
 const m=computeMonthMetrics(rows,'2026-06',cls,{cus_a:'A'});assert.equal(m.clientsLost,0);assert.equal(m.lateralMovementMrr,500)
})
test('legacy classification schema migration is idempotent and removes name-key dependency',async()=>{
 const calls=[];const db={query:async sql=>{calls.push(sql);return{rows:[]}}};await migrateChurnClassificationSchema(db);await migrateChurnClassificationSchema(db)
 const sql=calls.join('\n');assert.match(sql,/ADD COLUMN IF NOT EXISTS "logoKey"/);assert.match(sql,/DROP NOT NULL/);assert.match(sql,/normalizedClientName/);assert.match(sql,/stable_customer_month_mrr_uq/)
})
