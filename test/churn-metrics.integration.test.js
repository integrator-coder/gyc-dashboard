const test=require('node:test'); const assert=require('node:assert/strict')
const {computeMonthMetrics,calculateRates}=require('../lib/churn-metrics')
const {ensureTables,upsertChurnMetrics,migrateChurnClassificationSchema,persistCancellationEvents,loadChurnClassifications,runRecomputeTransaction}=require('../scripts/monthly-mrr-nrr-update')
const {buildLeadershipView}=require('../lib/churn-leadership')
const ts=s=>Date.parse(s)/1000
function sub(id,c,mrr,created='2026-05-01',canceled=null){return{id,customer:c,created:ts(created),canceled_at:canceled?ts(canceled):null,items:{data:[{quantity:1,price:{unit_amount:mrr*100,recurring:{interval:'month',interval_count:1}}}]}}}
test('unique-logo denominator dedupes duplicate Stripe customers',()=>{
 const rows=[sub('a','cus_1',100),sub('b','cus_2',200),sub('c','cus_3',300)]
 const m=computeMonthMetrics(rows,'2026-06',[],{cus_1:'LOGO_A',cus_2:'LOGO_A',cus_3:'LOGO_B'})
 assert.equal(m.openingClients,2);assert.equal(m.openingCohortMrr,600)
})
test('stable customer classification excludes lateral and resolves Lehigh/Ethia alias',()=>{
 const rows=[sub('lehigh-cancel','cus_ethia',1497,'2026-05-01','2026-06-15')]
 const cls=[{stripeCustomerId:'cus_ethia',logoKey:'LSAEE',canceledMonth:'2026-06',mrr:1497,type:'internal_lateral',confirmed:true}]
 const m=computeMonthMetrics(rows,'2026-06',cls,{cus_ethia:'LSAEE'})
 assert.equal(m.clientsLost,0);assert.equal(m.churnedMrr,0);assert.equal(m.lateralMovementMrr,0)
})
test('same-customer same-MRR collision refuses fallback classification',()=>{
 const rows=[sub('x1','cus_x',500,'2026-05-01','2026-06-10'),sub('x2','cus_x',500,'2026-05-01','2026-06-11')]
 const cls=[{stripeCustomerId:'cus_x',canceledMonth:'2026-06',mrr:500,type:'internal_lateral',confirmed:true}]
 const m=computeMonthMetrics(rows,'2026-06',cls,{cus_x:'X'})
 assert.equal(m.clientsLost,1);assert.equal(m.churnedMrr,1000)
})
test('GRR includes contraction while NRR follows opening-logo cohort',()=>{
 const rows=[sub('old','cus_a',1000,'2026-05-01','2026-06-10'),sub('replacement','cus_a',800,'2026-06-10')]
 const m=computeMonthMetrics(rows,'2026-06',[],{cus_a:'A'}),r=calculateRates(m)
 assert.equal(m.clientsLost,0);assert.equal(m.programChurnMrr,1000);assert.equal(r.grr,80);assert.equal(r.nrr,80)
})
test('upsert binds unique-logo fields and both retention views',async()=>{
 const calls=[];const db={query:async(sql,args)=>{calls.push({sql,args})}}; const m={mrr:800,openingClients:1,clientsLost:0,clientsAdded:0,newMrr:800,churnedMrr:0,openingCohortMrr:1000,endingOpeningLogoMrr:800,grossRetainedMrr:800,activeSubscriptions:1,programChurnClients:1,programChurnMrr:1000,openingPrograms:2,programsLost:1,programChurnRate:50,monthlyMRR:800,pifMRR:0,monthlyClients:1,pifClients:0,monthlyChurnedMRR:0,pifChurnedMRR:0,monthlyNewMRR:800,pifNewMRR:0}
 await upsertChurnMetrics(db,'2026-06',m,null);assert.match(calls[0].sql,/"openingCohortMRR"/);assert.match(calls[1].sql,/"economicNRR"/);assert.deepEqual(calls[1].args.slice(1,4),[2,1,50])
})
test('audited June and July fixtures retain lateral exclusions',()=>{
 const cohort=(month,items)=>{const rows=[],cls=[],aliases={};for(const [key,mrr,type] of items){const cid=`cus_${key}`,sid=`sub_${key}`;aliases[cid]=key;rows.push(sub(sid,cid,mrr,'2026-05-01',`${month}-15`));if(type!=='true_logo_churn'&&type!=='unknown')cls.push({stripeCustomerId:cid,canceledMonth:month,mrr,type,confirmed:true})}return computeMonthMetrics(rows,month,cls,aliases)}
 const june=cohort('2026-06',[['earlyivy',995,'true_logo_churn'],['jeffrey',499,'unknown'],['growing',3551,'true_logo_churn'],['apogee',197,'true_logo_churn'],['helping',499,'unknown'],['kiddie',1583.34,'true_logo_churn'],['laesperanza',2014,'true_logo_churn'],['frederick',197,'billing_replacement'],['virginia',599,'billing_replacement'],['montessori',995,'program_churn'],['lehigh',1497,'internal_lateral']])
 const july=cohort('2026-07',[['casa',399,'unknown'],['alpha',197,'unknown'],['northside',1195,'true_logo_churn'],['happy',207,'unknown'],['tomorrowland',197,'true_logo_churn'],['tweety',790,'billing_replacement'],['greatbeginnings',1019,'billing_replacement'],['littletreehouse',795,'internal_lateral'],['crossingborders',1395,'internal_lateral'],['kidstown',995,'internal_lateral']])
 assert.equal(june.clientsLost,7);assert.equal(june.churnedMrr,9338.34);assert.equal(june.programChurnClients,1)
 assert.equal(july.clientsLost,5);assert.equal(july.churnedMrr,2195);assert.equal(july.lateralMovementMrr,0)
})
test('lateral replacement is not double-added to NRR or GRR',()=>{
 const rows=[sub('old','cus_a',500,'2026-05-01','2026-06-10'),sub('new','cus_a',500,'2026-06-10')]
 const cls=[{stripeCustomerId:'cus_a',canceledMonth:'2026-06',mrr:500,type:'internal_lateral',confirmed:true}]
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
 const cls=[{stripeCustomerId:'cus_a',canceledMonth:'2026-06',mrr:500,type:'pif_deferred',confirmed:true}]
 const m=computeMonthMetrics(rows,'2026-06',cls,{cus_a:'A'});assert.equal(m.clientsLost,0);assert.equal(m.lateralMovementMrr,500)
})
async function withPostgresSchema(kind,fn){
 const {Client}=require('pg'),crypto=require('node:crypto');const db=new Client({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});const schema=`churn_test_${crypto.randomBytes(6).toString('hex')}`
 await db.connect();try{await db.query(`CREATE SCHEMA "${schema}"`);await db.query(`SET search_path TO "${schema}"`)
  await db.query(`CREATE TABLE "ClientProfile" (id bigint primary key, "tenantId" text default 'gyc', acronym text, "companyName" text, "stripeCustomerId" text); CREATE TABLE "ClientStripeLink" ("tenantId" text default 'gyc',"stripeCustomerId" text,"clientProfileId" bigint)`)
  if(kind==='fresh')await db.query(`CREATE TABLE "ChurnClassification" (id bigserial primary key,"tenantId" text not null,"canceledSubscriptionId" text,"stripeCustomerId" text,"logoKey" text not null,"clientName" text not null,"classificationType" text not null,"canceledMonth" text not null,mrr numeric(12,2) not null)`)
  else {await db.query(`CREATE TABLE "ChurnClassification" (id bigserial primary key,"tenantId" text not null,"canceledSubscriptionId" text not null,"stripeCustomerId" text,"clientName" text not null,"classificationType" text not null CHECK ("classificationType" IN ('logo_churn','program_churn','lateral_migration','pif_lateral','billing_replacement','duplicate_artifact','unclassified')),"normalizedClientName" text not null,"canceledMonth" text,mrr numeric(12,2),UNIQUE("tenantId","normalizedClientName","canceledMonth",mrr))`);await db.query(`INSERT INTO "ChurnClassification" ("tenantId","canceledSubscriptionId","clientName","classificationType","normalizedClientName","canceledMonth",mrr) VALUES ('gyc','sub_legacy','Legacy','lateral_migration','legacy','2026-06',100)`)}
  await fn(db)
 }finally{await db.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(()=>{});await db.end()}}
test('fresh Postgres classification schema migration executes twice',()=>withPostgresSchema('fresh',async db=>{
 await migrateChurnClassificationSchema(db);await migrateChurnClassificationSchema(db);const x=await db.query(`select column_name from information_schema.columns where table_schema=current_schema() and table_name='ChurnClassification'`);assert.equal(x.rows.some(r=>r.column_name==='logoKey'),true)
}))
test('legacy Postgres schema migration executes twice and relaxes name key',()=>withPostgresSchema('legacy',async db=>{
 await migrateChurnClassificationSchema(db);await migrateChurnClassificationSchema(db);const x=await db.query(`select is_nullable from information_schema.columns where table_schema=current_schema() and table_name='ChurnClassification' and column_name='normalizedClientName'`);assert.equal(x.rows[0].is_nullable,'YES');const row=await db.query(`SELECT "classificationType","logoOutcome","programOutcome" FROM "ChurnClassification" WHERE "canceledSubscriptionId"='sub_legacy'`);assert.deepEqual(row.rows[0],{classificationType:'internal_lateral',logoOutcome:'retained',programOutcome:'migrated'})
}))
test('real Postgres recompute persists every cancellation and aggregates board events',()=>withPostgresSchema('fresh',async db=>{
 await migrateChurnClassificationSchema(db);const subs=[sub('sub_exit','cus_exit',500,'2026-05-01','2026-06-15'),sub('sub_old','cus_keep',300,'2026-05-01','2026-06-10'),sub('sub_new','cus_keep',250,'2026-06-01')];subs[0].customer={id:'cus_exit',name:'Exit Center'};subs[1].customer={id:'cus_keep',name:'Keep Center'};subs[2].customer={id:'cus_keep',name:'Keep Center'}
 await persistCancellationEvents(db,subs,['2026-06'],{cus_exit:'EXIT',cus_keep:'KEEP'});const {rows}=await db.query(`SELECT "canceledSubscriptionId","logoKey","classificationType" AS "cancellationType","logoOutcome","programOutcome",mrr AS "sourceMrr","reviewStatus","canceledMonth" FROM "ChurnClassification" ORDER BY "canceledSubscriptionId"`);assert.equal(rows.length,2);assert.deepEqual(rows.map(r=>r.cancellationType),['true_logo_churn','program_churn']);const board=buildLeadershipView(rows);assert.equal(board.totals.logosLost,1);assert.equal(board.totals.logoMrrLost,500);assert.equal(board.totals.programsLost,1)
}))
test('lateral destination is one verified transition subscription, never all logo MRR',()=>withPostgresSchema('fresh',async db=>{await migrateChurnClassificationSchema(db);await db.query(`INSERT INTO "ChurnClassification" ("tenantId","stripeCustomerId","logoKey","clientName","classificationType","logoOutcome","programOutcome","canceledMonth",mrr) VALUES ('gyc','cus_l','L','Lateral','internal_lateral','retained','migrated','2026-06',500)`);const old=sub('old','cus_l',500,'2026-05-01','2026-06-15'),dest=sub('dest','cus_l',400,'2026-06-16'),unrelated=sub('web','cus_l',197,'2026-01-01');dest.items.data[0].price.nickname='SEO';dest.items.data[0].price.product='prod_seo';await persistCancellationEvents(db,[old,dest,unrelated],['2026-06'],{cus_l:'L'});const x=(await db.query(`SELECT "destinationMRR","destinationProgram","destinationSubscriptionId","reviewStatus" FROM "ChurnClassification" WHERE "classificationType"='internal_lateral'`)).rows[0];assert.equal(Number(x.destinationMRR),400);assert.deepEqual([x.destinationProgram,x.destinationSubscriptionId,x.reviewStatus],['SEO','dest','confirmed'])}))
test('ambiguous lateral destination remains null and needs review',()=>withPostgresSchema('fresh',async db=>{await migrateChurnClassificationSchema(db);await db.query(`INSERT INTO "ChurnClassification" ("tenantId","stripeCustomerId","logoKey","clientName","classificationType","logoOutcome","programOutcome","canceledMonth",mrr) VALUES ('gyc','cus_l','L','Lateral','internal_lateral','retained','migrated','2026-06',500)`);const old=sub('old','cus_l',500,'2026-05-01','2026-06-15'),a=sub('a','cus_l',200,'2026-06-16'),b=sub('b','cus_l',300,'2026-06-17');a.items.data[0].price.nickname='A';b.items.data[0].price.nickname='B';await persistCancellationEvents(db,[old,a,b],['2026-06'],{cus_l:'L'});const x=(await db.query(`SELECT "destinationMRR","reviewStatus" FROM "ChurnClassification" WHERE "classificationType"='internal_lateral'`)).rows[0];assert.equal(x.destinationMRR,null);assert.equal(x.reviewStatus,'needs_review')}))
test('PIF bridge resolves profile logo and persists lifecycle facts',()=>withPostgresSchema('fresh',async db=>{await migrateChurnClassificationSchema(db);await db.query(`CREATE TABLE "ChurnLateralMovement" ("tenantId" text,"stripeCustomerId" text,"canceledSubscriptionId" text,"clientName" text,"movementDate" date,"mrrMoved" numeric,"pifCashReceived" numeric,"termMonths" int,"scheduledReturnDate" date,status text);INSERT INTO "ClientProfile" (id,acronym,"companyName") VALUES (1,'PIF','PIF Center');INSERT INTO "ClientStripeLink" ("stripeCustomerId","clientProfileId") VALUES ('cus_p',1);INSERT INTO "ChurnLateralMovement" VALUES ('gyc','cus_p','sub_p','PIF Center','2026-07-01',899,10000,12,'2027-07-01','confirmed')`);await loadChurnClassifications(db);const x=(await db.query(`SELECT "logoKey","clientName","pifTermMonths","pifCash","expectedReturnDate","pifLifecycleStatus" FROM "ChurnClassification" WHERE "canceledSubscriptionId"='sub_p'`)).rows[0];assert.equal(x.logoKey,'PIF');assert.equal(x.clientName,'PIF Center');assert.equal(x.pifTermMonths,12);assert.equal(Number(x.pifCash),10000);assert.equal(x.pifLifecycleStatus,'active')}))
test('atomic recompute rolls back every write on injected failure and commits on success',()=>withPostgresSchema('fresh',async db=>{await db.query(`CREATE TABLE "MRRHistory" (id serial primary key,"tenantId" text,"month" text,mrr numeric,"newMrr" numeric,"churnedMrr" numeric,"expansionMrr" numeric,"activeSubscriptions" int,"syncedAt" timestamptz,UNIQUE("tenantId","month"));INSERT INTO "ClientProfile" (id,acronym,"companyName") VALUES (1,'ATOMIC','Atomic Center');INSERT INTO "ClientStripeLink" ("stripeCustomerId","clientProfileId") VALUES ('cus_atomic',1)`);await ensureTables(db);await db.query(`INSERT INTO "MonthlyChurnMetrics" ("tenantId",month,"totalMRR") VALUES ('gyc','2026-06',777)`);const rows=[sub('atomic','cus_atomic',500,'2026-05-01','2026-06-15')];rows[0].customer={id:'cus_atomic',name:'Atomic Center'};await assert.rejects(()=>runRecomputeTransaction(db,rows,['2026-06'],{beforeCommit:async()=>{throw new Error('INJECTED_FAILURE')}}),/INJECTED_FAILURE/);let metric=await db.query(`SELECT "totalMRR" FROM "MonthlyChurnMetrics" WHERE month='2026-06'`);assert.equal(Number(metric.rows[0].totalMRR),777);assert.equal(Number((await db.query(`SELECT count(*) FROM "ChurnClassification" WHERE "canceledSubscriptionId"='atomic'`)).rows[0].count),0);await runRecomputeTransaction(db,rows,['2026-06']);metric=await db.query(`SELECT "totalMRR" FROM "MonthlyChurnMetrics" WHERE month='2026-06'`);assert.notEqual(Number(metric.rows[0].totalMRR),777);assert.equal(Number((await db.query(`SELECT count(*) FROM "ChurnClassification" WHERE "canceledSubscriptionId"='atomic'`)).rows[0].count),1)}))
