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
  await client.query(`CREATE TABLE IF NOT EXISTS "ChurnClassification" (
    "id" BIGSERIAL PRIMARY KEY, "tenantId" TEXT NOT NULL DEFAULT 'gyc', "canceledSubscriptionId" TEXT,
    "stripeCustomerId" TEXT, "logoKey" TEXT NOT NULL, "clientName" TEXT NOT NULL, "classificationType" TEXT NOT NULL,
    "canceledMonth" TEXT NOT NULL, "mrr" NUMERIC(12,2) NOT NULL,
    "reason" TEXT, "evidence" TEXT, "status" TEXT NOT NULL DEFAULT 'confirmed', "classifiedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE ("tenantId", "stripeCustomerId", "canceledMonth", "mrr"),
    CHECK ("classificationType" IN ('logo_churn','program_churn','lateral_migration','pif_lateral','billing_replacement','duplicate_artifact','unclassified')))`);
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

async function loadChurnClassifications(client) {
  const { rows } = await client.query(`
    SELECT "stripeCustomerId", "canceledSubscriptionId", "movementDate",
           "mrrMoved", "pifCashReceived", "termMonths", "scheduledReturnDate"
    FROM "ChurnLateralMovement"
    WHERE "tenantId" = 'gyc' AND status = 'confirmed'
  `);
  await client.query(`INSERT INTO "ChurnClassification" ("tenantId","stripeCustomerId","logoKey","clientName","canceledMonth",mrr,"classificationType",reason,evidence,status) VALUES
    ('gyc','cus_TBiLmxI5k77n9M','FCDMA','Frederick Country Day Montessori & Art School','2026-06',197,'billing_replacement','Replacement/duplicate subscription; other subscriptions remain active','Stripe + offboarding audit 2026-07-29','confirmed'),
    ('gyc','cus_TuFXrjd5lWfrY0','VMA','Virginia Montessori Academy','2026-06',599,'billing_replacement','Payments continued on active replacement subscription','Stripe audit 2026-07-29','confirmed'),
    ('gyc','cus_TZiZXkevvJJIKQ','MCA','Montessori Children''s Academy','2026-06',995,'program_churn','Canceled Google Ads; retained website service','Asana offboarding audit 2026-07-29','confirmed'),
    ('gyc','cus_PMAwGfJRWlcJYi','LSAEE','Lehigh School Academy / Ethia Dulorie','2026-06',1497,'lateral_migration','Moved Google Ads to SEO; replacement subscription active','Asana + Stripe audit 2026-07-29','confirmed'),
    ('gyc','cus_SzkLjCYYzyfHJR','TB','TweetyB''s','2026-07',790,'billing_replacement','Subscription replacement/reactivation; logo retained','Stripe audit 2026-07-29','confirmed'),
    ('gyc','cus_QpYD9QWOGXqoaq','GBD','Great Beginnings Daycare and Preschool','2026-07',1019,'billing_replacement','Subscription replacement; logo retained','Stripe audit 2026-07-29','confirmed'),
    ('gyc','cus_JcT1Nlf1rmMdz4','LTA','Little Treehouse Academy','2026-07',795,'lateral_migration','Moved Google Ads to Reputation Engine; retained website','Asana offboarding audit 2026-07-29','confirmed'),
    ('gyc','cus_TOqwelOnvSvBvk','CBG','Crossing Borders Language Center','2026-07',1395,'lateral_migration','Moved Google Ads to Reputation Engine Core; retained website','Asana offboarding audit 2026-07-29','confirmed'),
    ('gyc','cus_T6SGYZlDqyNQaC','KLC','Kidstown Learning Center','2026-07',995,'lateral_migration','Moved Google Ads to SEO; transition services remain active','Asana offboarding audit 2026-07-29','confirmed')
    ON CONFLICT ("tenantId","stripeCustomerId","canceledMonth",mrr) DO UPDATE SET "classificationType"=EXCLUDED."classificationType",reason=EXCLUDED.reason,evidence=EXCLUDED.evidence,status=EXCLUDED.status,"updatedAt"=NOW()`);
  const { rows: classified } = await client.query(`SELECT "canceledSubscriptionId", "stripeCustomerId", "logoKey", "canceledMonth", mrr, "classificationType", reason, evidence, status FROM "ChurnClassification" WHERE "tenantId"='gyc'`);
  const existing = new Set(classified.map(row => row.canceledSubscriptionId));
  return classified.concat(rows.filter(row => !existing.has(row.canceledSubscriptionId)).map(row => ({ ...row, classificationType: 'pif_lateral', status: 'confirmed' })));
}

async function loadCustomerToLogo(client) {
  const { rows } = await client.query(`SELECT l."stripeCustomerId", COALESCE(NULLIF(p.acronym,''), 'profile:' || p.id::text) AS "logoKey" FROM "ClientStripeLink" l JOIN "ClientProfile" p ON p.id=l."clientProfileId" WHERE l."tenantId"='gyc'`);
  const map=Object.fromEntries(rows.map(r=>[r.stripeCustomerId,r.logoKey]));
  // Audited alias: Ethia's Stripe record is the Lehigh School Academy logo.
  map['cus_PMAwGfJRWlcJYi']='LSAEE';
  return map;
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
    const confirmedLaterals = await loadChurnClassifications(client);
    const customerToLogo = await loadCustomerToLogo(client);

    // Build metrics for each target month + the month before (for NRR prev-month reference)
    const allMonths = [targets[0]]; // we need month before first target for NRR
    // Add the month before first target for prevMetrics reference
    const [y, m] = targets[0].split('-').map(Number);
    const prevMonth = new Date(Date.UTC(y, m - 2, 1));
    const prevMonthStr = `${prevMonth.getUTCFullYear()}-${String(prevMonth.getUTCMonth() + 1).padStart(2, '0')}`;

    const metricsMap = {};
    // Compute prev month metrics for NRR baseline
    metricsMap[prevMonthStr] = computeMonthMetrics(subs, prevMonthStr, confirmedLaterals, customerToLogo);

    for (const month of targets) {
      metricsMap[month] = computeMonthMetrics(subs, month, confirmedLaterals, customerToLogo);
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
module.exports = { upsertChurnMetrics };
