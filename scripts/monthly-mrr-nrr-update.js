#!/usr/bin/env node
/**
 * monthly-mrr-nrr-update.js
 *
 * Runs on the 1st of each month. Updates:
 *   1. MRRHistory — powers the 3-Year MRR Trend graph on Finance Overview tab
 *   2. MonthlyChurnMetrics — powers the NRR Over Time graph on Finance Churn tab
 *
 * Both tables fill in months that the Google Sheet doesn't cover (sheet stops at Apr-26).
 * The dashboard API routes fall back to these tables for any month past the sheet's range.
 *
 * Cron: 1st of every month at 6:00 AM ET
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local'), override: true });

const Stripe = require('stripe');
const { Pool } = require('pg');
const { calcSubMRR, computeMonthMetrics, calculateRates } = require('../lib/churn-metrics');
const { pifLifecycleStatus, OUTCOMES } = require('../lib/churn-classification');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function fetchAllSubscriptions() {
  console.log('Fetching all Stripe subscriptions...');
  const subs = [];
  let page = await stripe.subscriptions.list({ limit: 100, status: 'all', expand: ['data.customer'] });
  subs.push(...page.data);
  while (page.has_more) {
    page = await stripe.subscriptions.list({ limit: 100, status: 'all', starting_after: page.data[page.data.length - 1].id, expand: ['data.customer'] });
    subs.push(...page.data);
  }
  console.log(`Fetched ${subs.length} subscriptions`);
  return subs;
}

// Refresh the current month and the prior two months. Stripe cancellations and
// subscription changes can be back-dated, so a one-month lookback is not enough.
function getTargetMonths() {
  const now = new Date();
  const months = [];
  for (let offset = 2; offset >= 0; offset--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }

  // Only return months after Apr-26 (sheet covers through then)
  return months.filter(m => m > '2026-04');
}

async function upsertMRRHistory(client, monthStr, metrics) {
  await client.query(
    `INSERT INTO "MRRHistory"
      ("tenantId", "month", "mrr", "newMrr", "churnedMrr", "expansionMrr", "activeSubscriptions", "syncedAt")
     VALUES ('gyc', $1, $2, $3, $4, 0, $5, NOW())
     ON CONFLICT ("tenantId", "month") DO UPDATE SET
       "mrr" = EXCLUDED."mrr",
       "newMrr" = EXCLUDED."newMrr",
       "churnedMrr" = EXCLUDED."churnedMrr",
       "activeSubscriptions" = EXCLUDED."activeSubscriptions",
       "syncedAt" = NOW()`,
    [monthStr, metrics.mrr, metrics.newMrr, metrics.churnedMrr, metrics.activeSubscriptions]
  );
}

async function upsertChurnMetrics(client, monthStr, metrics, prevMetrics) {
  const totalMRR = metrics.mrr;
  const prevMRR = metrics.openingCohortMrr || 0;
  const { churnPct, revenueChurnPct, nrr, grr } = calculateRates(metrics);
  const netMRR = metrics.newMrr - metrics.churnedMrr;
  // Ending MRR less new-logo MRR is the ending revenue from the opening cohort.
  // This correctly excludes acquisition from NRR. GRR excludes expansion and is
  // therefore capped at 100%.
  // Confirmed Monthly → PIF conversions retain the customer and contracted
  // value even though recurring MRR temporarily leaves Stripe. Add that deferred
  // cohort value back to NRR; do not add PIF cash or new-logo revenue.

  // Compute split NRR
  const prevMonthlyMRR = prevMetrics?.monthlyMRR || 0;
  const prevPifMRR = prevMetrics?.pifMRR || 0;
  
  const monthlyNRR = prevMonthlyMRR > 0 
    ? Math.round(((metrics.monthlyMRR - metrics.monthlyRetainedNewMRR + metrics.lateralMovementMrr) / prevMonthlyMRR) * 1000) / 10
    : null;
  
  const pifNRR = prevPifMRR > 0 
    ? Math.round(((metrics.pifMRR - metrics.pifRetainedNewMRR) / prevPifMRR) * 1000) / 10
    : null;

  await client.query(
    `INSERT INTO "MonthlyChurnMetrics"
      ("tenantId", "month", "totalMRR", "clientCount", "clientsAdded", "clientsLost",
       "newMRR", "churnedMRR", "netMRR", "churnPct", "revenueChurnPct", "nrr", "grr",
       "monthlyMRR", "pifMRR", "monthlyClients", "pifClients",
       "monthlyChurnedMRR", "pifChurnedMRR", "monthlyNewMRR", "pifNewMRR",
       "monthlyNRR", "pifNRR", "openingClients", "programChurnClients", "programChurnMRR", "openingCohortMRR", "syncedAt")
     VALUES ('gyc', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, NOW())
     ON CONFLICT ("tenantId", "month") DO UPDATE SET
       "totalMRR" = EXCLUDED."totalMRR",
       "clientCount" = EXCLUDED."clientCount",
       "clientsAdded" = EXCLUDED."clientsAdded",
       "clientsLost" = EXCLUDED."clientsLost",
       "newMRR" = EXCLUDED."newMRR",
       "churnedMRR" = EXCLUDED."churnedMRR",
       "netMRR" = EXCLUDED."netMRR",
       "churnPct" = EXCLUDED."churnPct",
       "revenueChurnPct" = EXCLUDED."revenueChurnPct",
       "nrr" = EXCLUDED."nrr",
       "grr" = EXCLUDED."grr",
       "monthlyMRR" = EXCLUDED."monthlyMRR",
       "pifMRR" = EXCLUDED."pifMRR",
       "monthlyClients" = EXCLUDED."monthlyClients",
       "pifClients" = EXCLUDED."pifClients",
       "monthlyChurnedMRR" = EXCLUDED."monthlyChurnedMRR",
       "pifChurnedMRR" = EXCLUDED."pifChurnedMRR",
       "monthlyNewMRR" = EXCLUDED."monthlyNewMRR",
       "pifNewMRR" = EXCLUDED."pifNewMRR",
       "monthlyNRR" = EXCLUDED."monthlyNRR",
       "pifNRR" = EXCLUDED."pifNRR",
       "openingClients" = EXCLUDED."openingClients",
       "programChurnClients" = EXCLUDED."programChurnClients",
       "programChurnMRR" = EXCLUDED."programChurnMRR",
       "openingCohortMRR" = EXCLUDED."openingCohortMRR",
       "syncedAt" = NOW()`,
    [monthStr, totalMRR, metrics.activeSubscriptions, metrics.clientsAdded, metrics.clientsLost,
     metrics.newMrr, metrics.churnedMrr, netMRR, churnPct, revenueChurnPct, nrr, grr,
     metrics.monthlyMRR, metrics.pifMRR, metrics.monthlyClients, metrics.pifClients,
     metrics.monthlyChurnedMRR, metrics.pifChurnedMRR, metrics.monthlyNewMRR, metrics.pifNewMRR,
     monthlyNRR, pifNRR, metrics.openingClients, metrics.programChurnClients, metrics.programChurnMrr, metrics.openingCohortMrr]
  );
  await client.query(`UPDATE "MonthlyChurnMetrics" SET "openingPrograms"=$2,"programsLost"=$3,"programChurnRate"=$4,"economicNRR"=$5,"economicGRR"=$6,"stripeNRR"=$7,"stripeGRR"=$8 WHERE "tenantId"='gyc' AND month=$1`,[monthStr,metrics.openingPrograms||0,metrics.programsLost||0,metrics.programChurnRate||0,calculateRates(metrics).economicNrr,calculateRates(metrics).economicGrr,calculateRates(metrics).stripeNrr,calculateRates(metrics).stripeGrr]);
}

async function ensureTables(client) {
  // MRRHistory should already exist; create MonthlyChurnMetrics if not
  await client.query(`
    CREATE TABLE IF NOT EXISTS "MonthlyChurnMetrics" (
      "id"           SERIAL PRIMARY KEY,
      "tenantId"     TEXT NOT NULL DEFAULT 'gyc',
      "month"        TEXT NOT NULL,
      "totalMRR"     NUMERIC(12,2),
      "clientCount"  INT,
      "clientsAdded" INT,
      "clientsLost"  INT,
      "newMRR"       NUMERIC(12,2),
      "churnedMRR"   NUMERIC(12,2),
      "netMRR"       NUMERIC(12,2),
      "churnPct"     NUMERIC(6,2),
      "revenueChurnPct" NUMERIC(6,2),
      "nrr"          NUMERIC(6,2),
      "grr"          NUMERIC(6,2),
      "monthlyMRR"   NUMERIC(12,2),
      "pifMRR"       NUMERIC(12,2),
      "monthlyClients" INT,
      "pifClients"   INT,
      "monthlyChurnedMRR" NUMERIC(12,2),
      "pifChurnedMRR" NUMERIC(12,2),
      "monthlyNewMRR" NUMERIC(12,2),
      "pifNewMRR"    NUMERIC(12,2),
      "monthlyNRR"   NUMERIC(6,2),
      "pifNRR"       NUMERIC(6,2),
      "syncedAt"     TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE ("tenantId", "month")
    )
  `);
  await client.query(`ALTER TABLE "MonthlyChurnMetrics" ADD COLUMN IF NOT EXISTS "revenueChurnPct" NUMERIC(6,2)`);
  await client.query(`ALTER TABLE "MonthlyChurnMetrics" ADD COLUMN IF NOT EXISTS "openingClients" INT`);
  await client.query(`ALTER TABLE "MonthlyChurnMetrics" ADD COLUMN IF NOT EXISTS "programChurnClients" INT`);
  await client.query(`ALTER TABLE "MonthlyChurnMetrics" ADD COLUMN IF NOT EXISTS "programChurnMRR" NUMERIC(12,2)`);
  await client.query(`ALTER TABLE "MonthlyChurnMetrics" ADD COLUMN IF NOT EXISTS "openingCohortMRR" NUMERIC(12,2)`);
  await client.query(`ALTER TABLE "MonthlyChurnMetrics" ADD COLUMN IF NOT EXISTS "openingPrograms" INT`);
  await client.query(`ALTER TABLE "MonthlyChurnMetrics" ADD COLUMN IF NOT EXISTS "programsLost" INT`);
  await client.query(`ALTER TABLE "MonthlyChurnMetrics" ADD COLUMN IF NOT EXISTS "programChurnRate" NUMERIC(6,2)`);
  await client.query(`ALTER TABLE "MonthlyChurnMetrics" ADD COLUMN IF NOT EXISTS "economicNRR" NUMERIC(6,2)`);
  await client.query(`ALTER TABLE "MonthlyChurnMetrics" ADD COLUMN IF NOT EXISTS "economicGRR" NUMERIC(6,2)`);
  await client.query(`ALTER TABLE "MonthlyChurnMetrics" ADD COLUMN IF NOT EXISTS "stripeNRR" NUMERIC(6,2)`);
  await client.query(`ALTER TABLE "MonthlyChurnMetrics" ADD COLUMN IF NOT EXISTS "stripeGRR" NUMERIC(6,2)`);
  await client.query(`CREATE TABLE IF NOT EXISTS "ChurnClassification" (
    "id" BIGSERIAL PRIMARY KEY, "tenantId" TEXT NOT NULL DEFAULT 'gyc', "canceledSubscriptionId" TEXT,
    "stripeCustomerId" TEXT, "logoKey" TEXT NOT NULL, "clientName" TEXT NOT NULL, "classificationType" TEXT NOT NULL,
    "canceledMonth" TEXT NOT NULL, "mrr" NUMERIC(12,2) NOT NULL,
    "reason" TEXT, "evidence" TEXT, "status" TEXT NOT NULL DEFAULT 'confirmed', "classifiedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE ("tenantId", "stripeCustomerId", "canceledMonth", "mrr"),
    CHECK ("classificationType" IN ('true_logo_churn','program_churn','internal_lateral','pif_deferred','billing_replacement','duplicate_artifact','unknown')))`);
  await migrateChurnClassificationSchema(client);
  await client.query(`
    CREATE TABLE IF NOT EXISTS "ChurnLateralMovement" (
      "id" BIGSERIAL PRIMARY KEY,
      "tenantId" TEXT NOT NULL DEFAULT 'gyc',
      "stripeCustomerId" TEXT NOT NULL,
      "canceledSubscriptionId" TEXT NOT NULL,
      "clientName" TEXT NOT NULL,
      "movementDate" DATE NOT NULL,
      "mrrMoved" NUMERIC(12,2) NOT NULL,
      "pifCashReceived" NUMERIC(12,2) NOT NULL,
      "termMonths" INT NOT NULL,
      "scheduledReturnDate" DATE NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'confirmed',
      "evidence" TEXT,
      "confirmedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE ("tenantId", "canceledSubscriptionId")
    )
  `);
}

async function migrateChurnClassificationSchema(client) {
  await client.query(`
    ALTER TABLE "ChurnClassification" ADD COLUMN IF NOT EXISTS "logoKey" TEXT;
    ALTER TABLE "ChurnClassification" ADD COLUMN IF NOT EXISTS "canceledMonth" TEXT;
    ALTER TABLE "ChurnClassification" ADD COLUMN IF NOT EXISTS mrr NUMERIC(12,2);
    ALTER TABLE "ChurnClassification" ALTER COLUMN "canceledSubscriptionId" DROP NOT NULL;
    UPDATE "ChurnClassification" c SET "logoKey"=COALESCE(NULLIF(p.acronym,''),'profile:'||p.id::text)
      FROM "ClientStripeLink" l JOIN "ClientProfile" p ON p.id=l."clientProfileId"
      WHERE c."logoKey" IS NULL AND c."stripeCustomerId"=l."stripeCustomerId";
  `);
  await client.query(`DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='ChurnClassification' AND column_name='normalizedClientName') THEN
      ALTER TABLE "ChurnClassification" ALTER COLUMN "normalizedClientName" DROP NOT NULL;
    END IF;
  END $$`);
  await client.query(`DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT conname FROM pg_constraint WHERE conrelid='"ChurnClassification"'::regclass AND contype='u'
      AND pg_get_constraintdef(oid) LIKE '%normalizedClientName%'
    LOOP EXECUTE format('ALTER TABLE "ChurnClassification" DROP CONSTRAINT %I',r.conname); END LOOP;
  END $$`);
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "ChurnClassification_stable_customer_month_mrr_uq" ON "ChurnClassification" ("tenantId","stripeCustomerId","canceledMonth",mrr) WHERE "stripeCustomerId" IS NOT NULL`);
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "ChurnClassification_subscription_uq" ON "ChurnClassification" ("tenantId","canceledSubscriptionId") WHERE "canceledSubscriptionId" IS NOT NULL`);
  const fs=require('node:fs'),path=require('node:path');
  await client.query(fs.readFileSync(path.resolve(__dirname,'../prisma/migrations/20260729190000_leadership_churn_v2/migration.sql'),'utf8'));
}

async function loadChurnClassifications(client) {
  const { rows } = await client.query(`
    SELECT m."stripeCustomerId",m."canceledSubscriptionId",m."clientName",m."movementDate",m."mrrMoved",m."pifCashReceived",m."termMonths",m."scheduledReturnDate",COALESCE(NULLIF(p.acronym,''),'profile:'||p.id::text) AS "logoKey",p."companyName" AS "profileName"
    FROM "ChurnLateralMovement" m LEFT JOIN "ClientStripeLink" l ON l."tenantId"=m."tenantId" AND l."stripeCustomerId"=m."stripeCustomerId" LEFT JOIN "ClientProfile" p ON p.id=l."clientProfileId"
    WHERE m."tenantId" = 'gyc' AND m.status = 'confirmed'
  `);
  const pifMappings=new Map();for(const row of rows){const set=pifMappings.get(row.canceledSubscriptionId)||new Set();if(row.logoKey)set.add(row.logoKey);pifMappings.set(row.canceledSubscriptionId,set)};for(const [id,logos] of pifMappings)if(logos.size!==1)throw new Error(`DATA_QUALITY: PIF movement ${id} has ${logos.size?'ambiguous':'no'} stable logo mapping`)
  await client.query(`INSERT INTO "ChurnClassification" ("tenantId","stripeCustomerId","logoKey","clientName","canceledMonth",mrr,"classificationType","logoOutcome","programOutcome",reason,evidence,status) VALUES
    ('gyc','cus_TBiLmxI5k77n9M','FCDMA','Frederick Country Day Montessori & Art School','2026-06',197,'billing_replacement','retained','replaced','Replacement/duplicate subscription; other subscriptions remain active','Stripe + offboarding audit 2026-07-29','confirmed'),
    ('gyc','cus_TuFXrjd5lWfrY0','VMA','Virginia Montessori Academy','2026-06',599,'billing_replacement','retained','replaced','Payments continued on active replacement subscription','Stripe audit 2026-07-29','confirmed'),
    ('gyc','cus_TZiZXkevvJJIKQ','MCA','Montessori Children''s Academy','2026-06',995,'program_churn','retained','exited','Canceled Google Ads; retained website service','Asana offboarding audit 2026-07-29','confirmed'),
    ('gyc','cus_PMAwGfJRWlcJYi','LSAEE','Lehigh School Academy / Ethia Dulorie','2026-06',1497,'internal_lateral','retained','migrated','Moved Google Ads to SEO; replacement subscription active','Asana + Stripe audit 2026-07-29','confirmed'),
    ('gyc','cus_SzkLjCYYzyfHJR','TB','TweetyB''s','2026-07',790,'billing_replacement','retained','replaced','Subscription replacement/reactivation; logo retained','Stripe audit 2026-07-29','confirmed'),
    ('gyc','cus_QpYD9QWOGXqoaq','GBD','Great Beginnings Daycare and Preschool','2026-07',1019,'billing_replacement','retained','replaced','Subscription replacement; logo retained','Stripe audit 2026-07-29','confirmed'),
    ('gyc','cus_JcT1Nlf1rmMdz4','LTA','Little Treehouse Academy','2026-07',795,'internal_lateral','retained','migrated','Moved Google Ads to Reputation Engine; retained website','Asana offboarding audit 2026-07-29','confirmed'),
    ('gyc','cus_TOqwelOnvSvBvk','CBG','Crossing Borders Language Center','2026-07',1395,'internal_lateral','retained','migrated','Moved Google Ads to Reputation Engine Core; retained website','Asana offboarding audit 2026-07-29','confirmed'),
    ('gyc','cus_T6SGYZlDqyNQaC','KLC','Kidstown Learning Center','2026-07',995,'internal_lateral','retained','migrated','Moved Google Ads to SEO; transition services remain active','Asana offboarding audit 2026-07-29','confirmed')
    ON CONFLICT ("tenantId","stripeCustomerId","canceledMonth",mrr) WHERE "stripeCustomerId" IS NOT NULL DO UPDATE SET "classificationType"=EXCLUDED."classificationType","logoOutcome"=EXCLUDED."logoOutcome","programOutcome"=EXCLUDED."programOutcome",reason=EXCLUDED.reason,evidence=EXCLUDED.evidence,status=EXCLUDED.status,"updatedAt"=NOW()`);
  await client.query(`UPDATE "ChurnClassification" SET "reviewStatus"='confirmed',confidence='verified' WHERE "tenantId"='gyc' AND status='confirmed' AND evidence IS NOT NULL AND "classificationType"<>'unknown'`);
  const { rows: classified } = await client.query(`SELECT "canceledSubscriptionId", "stripeCustomerId", "logoKey", "canceledMonth", mrr, "classificationType", reason, evidence, status FROM "ChurnClassification" WHERE "tenantId"='gyc'`);
  const existing = new Set(classified.map(row => row.canceledSubscriptionId));
  for(const row of rows.filter(row => !existing.has(row.canceledSubscriptionId))){const month=String(row.movementDate).slice(0,7),logoKey=row.logoKey;if(!logoKey)throw new Error(`DATA_QUALITY: PIF movement ${row.canceledSubscriptionId} lacks stable logo mapping`);await client.query(`INSERT INTO "ChurnClassification" ("tenantId","canceledSubscriptionId","stripeCustomerId","logoKey","clientName","canceledMonth",mrr,"classificationType","logoOutcome","programOutcome","pifCash","pifTermMonths","expectedReturnDate","pifLifecycleStatus",evidence,status,"reviewStatus",confidence) VALUES ('gyc',$1,$2,$3,$4,$5,$6,'pif_deferred','retained','deferred',$7,$8,$9,$10,'ChurnLateralMovement bridge','confirmed','confirmed','verified') ON CONFLICT ("tenantId","canceledSubscriptionId") WHERE "canceledSubscriptionId" IS NOT NULL DO UPDATE SET "classificationType"='pif_deferred',"logoOutcome"='retained',"programOutcome"='deferred',"pifCash"=EXCLUDED."pifCash","pifTermMonths"=EXCLUDED."pifTermMonths","expectedReturnDate"=EXCLUDED."expectedReturnDate","pifLifecycleStatus"=EXCLUDED."pifLifecycleStatus"`,[row.canceledSubscriptionId,row.stripeCustomerId,logoKey,row.clientName||logoKey,month,row.mrrMoved,row.pifCashReceived,row.termMonths,row.scheduledReturnDate,pifLifecycleStatus({pifCash:row.pifCashReceived,expectedReturnDate:row.scheduledReturnDate})])}
  const refreshed=await client.query(`SELECT * FROM "ChurnClassification" WHERE "tenantId"='gyc'`);return refreshed.rows;
}

async function loadCustomerToLogo(client) {
  const { rows } = await client.query(`
    SELECT DISTINCT x."stripeCustomerId", COALESCE(NULLIF(p.acronym,''), 'profile:' || p.id::text) AS "logoKey"
    FROM (
      SELECT "stripeCustomerId", "clientProfileId" FROM "ClientStripeLink" WHERE "tenantId"='gyc'
      UNION SELECT "stripeCustomerId", id FROM "ClientProfile" WHERE "tenantId"='gyc' AND "stripeCustomerId" IS NOT NULL
    ) x JOIN "ClientProfile" p ON p.id=x."clientProfileId"`);
  const grouped=new Map(); for(const row of rows){if(!grouped.has(row.stripeCustomerId))grouped.set(row.stripeCustomerId,new Set());grouped.get(row.stripeCustomerId).add(row.logoKey)}
  const collisions=[...grouped].filter(([,logos])=>logos.size>1); if(collisions.length) throw new Error(`Ambiguous customer-to-logo aliases: ${collisions.map(([id])=>id).join(', ')}`)
  const map=Object.fromEntries([...grouped].map(([id,logos])=>[id,[...logos][0]]));
  // Audited alias: Ethia's Stripe record is the Lehigh School Academy logo.
  map['cus_PMAwGfJRWlcJYi']='LSAEE';
  return map;
}

async function persistCancellationEvents(client, subs, months, customerToLogo) {
  for (const sub of subs) {
    if (!sub.canceled_at) continue
    const canceledMonth=new Date(sub.canceled_at*1000).toISOString().slice(0,7);if(!months.includes(canceledMonth))continue
    const customerId=typeof sub.customer==='object'?sub.customer.id:String(sub.customer),logoKey=customerToLogo[customerId]
    if(!logoKey)throw new Error(`DATA_QUALITY: canceled customer ${customerId} lacks stable logo mapping`)
    const amount=calcSubMRR(sub),[y,m]=canceledMonth.split('-').map(Number),end=Date.UTC(y,m,1)/1000-1
    const retained=subs.some(x=>x.id!==sub.id&&(customerToLogo[typeof x.customer==='object'?x.customer.id:String(x.customer)]===logoKey)&&x.created<=end&&(!x.canceled_at||x.canceled_at>end))
    const transition=31*86400,destinations=subs.filter(x=>x.id!==sub.id&&(customerToLogo[typeof x.customer==='object'?x.customer.id:String(x.customer)]===logoKey)&&Math.abs(x.created-sub.canceled_at)<=transition&&x.created<=end&&(!x.canceled_at||x.canceled_at>end)),destination=destinations.length===1?destinations[0]:null
    const destinationMrr=destination?calcSubMRR(destination):null,destinationProgram=destination?.items?.data?.[0]?.price?.nickname||destination?.items?.data?.[0]?.price?.product?.name||null,destinationSubscriptionId=destination?.id||null,sourceProgram=sub.items?.data?.[0]?.price?.nickname||sub.items?.data?.[0]?.price?.product?.name||null,sourceProgramKey=String(sub.items?.data?.[0]?.price?.product?.id||sub.items?.data?.[0]?.price?.product||sub.items?.data?.[0]?.price?.id||sub.id),start=Date.UTC(y,m-1,1)/1000,openingProgramMrr=subs.filter(x=>customerToLogo[typeof x.customer==='object'?x.customer.id:String(x.customer)]===logoKey&&String(x.items?.data?.[0]?.price?.product?.id||x.items?.data?.[0]?.price?.product||x.items?.data?.[0]?.price?.id||x.id)===sourceProgramKey&&x.created<start&&(!x.canceled_at||x.canceled_at>=start)).reduce((n,x)=>n+calcSubMRR(x),0)
    await client.query(`UPDATE "ChurnClassification" SET "canceledSubscriptionId"=COALESCE("canceledSubscriptionId",$1),"sourceProgram"=$8,"sourceProgramKey"=$9,"openingProgramMRR"=$10,"destinationMRR"=CASE WHEN "classificationType"='internal_lateral' AND $5::numeric IS NOT NULL AND $6::text IS NOT NULL AND $7::text IS NOT NULL THEN $5::numeric ELSE NULL END,"destinationProgram"=CASE WHEN "classificationType"='internal_lateral' THEN $6::text ELSE "destinationProgram" END,"destinationSubscriptionId"=CASE WHEN "classificationType"='internal_lateral' THEN $7::text ELSE "destinationSubscriptionId" END,"reviewStatus"=CASE WHEN "classificationType"='internal_lateral' AND $5::numeric IS NOT NULL AND $6::text IS NOT NULL AND $7::text IS NOT NULL THEN 'confirmed' WHEN "classificationType"='internal_lateral' THEN 'needs_review' ELSE "reviewStatus" END,"confidence"=CASE WHEN "classificationType"='internal_lateral' AND $5::numeric IS NOT NULL AND $6::text IS NOT NULL AND $7::text IS NOT NULL THEN 'verified' WHEN "classificationType"='internal_lateral' THEN 'unknown' ELSE "confidence" END WHERE "tenantId"='gyc' AND "stripeCustomerId"=$2 AND "canceledMonth"=$3 AND mrr=$4`,[sub.id,customerId,canceledMonth,amount,destinationMrr,destinationProgram,destinationSubscriptionId,sourceProgram,sourceProgramKey,openingProgramMrr])
    const type=retained?'program_churn':'true_logo_churn',out=OUTCOMES[type],name=sub.customer?.name||sub.customer?.email||logoKey
    await client.query(`INSERT INTO "ChurnClassification" ("tenantId","canceledSubscriptionId","stripeCustomerId","logoKey","clientName","classificationType","logoOutcome","programOutcome","canceledMonth",mrr,"sourceProgram","sourceProgramKey","openingProgramMRR",status,"reviewStatus",confidence,evidence) VALUES ('gyc',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'provisional','needs_review','derived','Derived from Stripe cohort; business reason needs review') ON CONFLICT ("tenantId","canceledSubscriptionId") WHERE "canceledSubscriptionId" IS NOT NULL DO NOTHING`,[sub.id,customerId,logoKey,name,type,out[0],out[1],canceledMonth,amount,sourceProgram,sourceProgramKey,openingProgramMrr])
  }
}

async function main() {
  console.log(`\n🗓  Monthly MRR + NRR Update — ${new Date().toISOString()}`);
  const targets = getTargetMonths();
  if (targets.length === 0) {
    console.log('No months to update (all covered by Google Sheet).');
    process.exit(0);
  }
  console.log('Target months:', targets.join(', '));

  const subs = await fetchAllSubscriptions();
  const client = await pool.connect();

  try {
    await ensureTables(client);
    await loadChurnClassifications(client);
    const customerToLogo = await loadCustomerToLogo(client);
    await persistCancellationEvents(client,subs,targets,customerToLogo);
    const {rows: persistedClassifications}=await client.query(`SELECT * FROM "ChurnClassification" WHERE "tenantId"='gyc'`);

    // Build metrics for each target month + the month before (for NRR prev-month reference)
    const allMonths = [targets[0]]; // we need month before first target for NRR
    // Add the month before first target for prevMetrics reference
    const [y, m] = targets[0].split('-').map(Number);
    const prevMonth = new Date(Date.UTC(y, m - 2, 1));
    const prevMonthStr = `${prevMonth.getUTCFullYear()}-${String(prevMonth.getUTCMonth() + 1).padStart(2, '0')}`;

    const metricsMap = {};
    // Compute prev month metrics for NRR baseline
    metricsMap[prevMonthStr] = computeMonthMetrics(subs, prevMonthStr, persistedClassifications, customerToLogo);

    for (const month of targets) {
      metricsMap[month] = computeMonthMetrics(subs, month, persistedClassifications, customerToLogo);
      if (metricsMap[month].unmappedOpeningCustomers.length) throw new Error(`DATA_QUALITY: ${metricsMap[month].unmappedOpeningCustomers.length} opening Stripe customers lack a stable logo mapping for ${month}`);
    }

    for (const month of targets) {
      const metrics = metricsMap[month];
      const [my, mm] = month.split('-').map(Number);
      const pmDate = new Date(Date.UTC(my, mm - 2, 1));
      const pmStr = `${pmDate.getUTCFullYear()}-${String(pmDate.getUTCMonth() + 1).padStart(2, '0')}`;
      const prevMetrics = metricsMap[pmStr] || null;

      console.log(`\n📅 ${month}`);
      console.log(`   MRR: $${metrics.mrr.toLocaleString()} | Active: ${metrics.activeSubscriptions}`);
      console.log(`   New MRR: $${metrics.newMrr.toLocaleString()} | Churned MRR: $${metrics.churnedMrr.toLocaleString()}`);
      console.log(`   Clients Added: ${metrics.clientsAdded} | Lost: ${metrics.clientsLost}`);

      await upsertMRRHistory(client, month, metrics);
      await upsertChurnMetrics(client, month, metrics, prevMetrics);
      console.log(`   ✅ MRRHistory + MonthlyChurnMetrics updated`);
    }

    console.log('\n✅ Monthly update complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) main().catch(e => { console.error('❌ Fatal:', e.message); process.exit(1); });
module.exports = { upsertChurnMetrics, migrateChurnClassificationSchema, persistCancellationEvents, loadChurnClassifications };
