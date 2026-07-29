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
const { classifyCancellation, classificationKey } = require('../lib/churn-classification');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function calcSubMRR(sub) {
  const items = sub.items?.data || [];
  return items.reduce((sum, item) => {
    const amount = (item.price?.unit_amount || 0) / 100;
    const qty = item.quantity || 1;
    const interval = item.price?.recurring?.interval;
    const intervalCount = item.price?.recurring?.interval_count || 1;
    if (interval === 'month') return sum + (amount * qty) / intervalCount;
    if (interval === 'year') return sum + (amount * qty) / (12 * intervalCount);
    return sum;
  }, 0);
}

function monthBounds(monthStr) {
  // monthStr = 'YYYY-MM'
  const [year, month] = monthStr.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1)); // exclusive upper bound
  return { start, end, startUnix: Math.floor(start / 1000), endUnix: Math.floor(end / 1000) - 1 };
}

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

function computeMonthMetrics(subs, monthStr, classifications = []) {
  const { startUnix, endUnix } = monthBounds(monthStr);

  let mrr = 0, newMrr = 0, retainedNewMrr = 0, churnedMrr = 0, activeCount = 0;
  const addedCustomerIds = new Set();
  const lostCustomerIds = new Set();
  const classificationByCanceledSubscription = new Map(
    classifications.map(row => [row.canceledSubscriptionId, row])
  );
  const classificationByAuditKey = new Map(classifications.filter(row => row.normalizedClientName && row.canceledMonth && row.mrr != null).map(row => [`${row.normalizedClientName}|${row.canceledMonth}|${Number(row.mrr).toFixed(2)}`, row]));
  let lateralMovementMrr = 0;
  const openingCustomerIds = new Set();
  let programChurnMrr = 0;
  const programChurnCustomerIds = new Set();
  
  // Split by interval type
  let monthlyMRR = 0, pifMRR = 0;
  let monthlyClients = 0, pifClients = 0;
  let monthlyNewMRR = 0, pifNewMRR = 0;
  let monthlyRetainedNewMRR = 0, pifRetainedNewMRR = 0;
  let monthlyChurnedMRR = 0, pifChurnedMRR = 0;

  for (const sub of subs) {
    const customerId = typeof sub.customer === 'object' ? sub.customer.id : String(sub.customer);
    const created = sub.created; // unix
    const canceledAt = sub.canceled_at; // unix or null
    const subMrr = calcSubMRR(sub);
    if (subMrr <= 0) continue;
    
    // Determine interval type from first item
    const items = sub.items?.data || [];
    const firstInterval = items[0]?.price?.recurring?.interval;
    const isMonthly = firstInterval === 'month';
    const isPIF = firstInterval === 'year';

    // Ending snapshot: active at month end. This makes MRR/client counts comparable
    // month to month instead of counting anyone who was active for a single day.
    const activeAtEnd = created <= endUnix && (canceledAt == null || canceledAt > endUnix);
    if (created < startUnix && (canceledAt == null || canceledAt >= startUnix)) openingCustomerIds.add(customerId);
    if (activeAtEnd) {
      mrr += subMrr;
      activeCount++;
      
      if (isMonthly) {
        monthlyMRR += subMrr;
        monthlyClients++;
      } else if (isPIF) {
        pifMRR += subMrr;
        pifClients++;
      }
    }

    // New this month
    if (created >= startUnix && created <= endUnix) {
      newMrr += subMrr;
      addedCustomerIds.add(customerId);
      
      if (isMonthly) {
        monthlyNewMRR += subMrr;
      } else if (isPIF) {
        pifNewMRR += subMrr;
      }
      if (activeAtEnd) {
        retainedNewMrr += subMrr;
        if (isMonthly) monthlyRetainedNewMRR += subMrr;
        else if (isPIF) pifRetainedNewMRR += subMrr;
      }
    }

    // Churned this month
    if (canceledAt != null && canceledAt >= startUnix && canceledAt <= endUnix) {
      const customerName = typeof sub.customer === 'object' ? (sub.customer.name || sub.customer.email) : '';
      const classification = classificationByCanceledSubscription.get(sub.id) || classificationByAuditKey.get(classificationKey(customerName, monthStr, subMrr));
      const decision = classifyCancellation(classification);
      // Only an evidence-backed confirmed classification can remove a cancellation
      // from logo churn. Unknowns remain provisionally included.
      if (decision.programChurn) { programChurnMrr += subMrr; programChurnCustomerIds.add(customerId); }
      if (!decision.logoChurn && (!classification.stripeCustomerId || customerId === classification.stripeCustomerId)) {
        if (decision.retainedValue) lateralMovementMrr += subMrr;
        continue;
      }
      churnedMrr += subMrr;
      lostCustomerIds.add(customerId);
      
      if (isMonthly) {
        monthlyChurnedMRR += subMrr;
      } else if (isPIF) {
        pifChurnedMRR += subMrr;
      }
    }
  }

  return {
    mrr: Math.round(mrr * 100) / 100,
    newMrr: Math.round(newMrr * 100) / 100,
    retainedNewMrr: Math.round(retainedNewMrr * 100) / 100,
    churnedMrr: Math.round(churnedMrr * 100) / 100,
    activeSubscriptions: activeCount,
    clientsAdded: addedCustomerIds.size,
    // A client can have multiple canceled subscriptions. Churn is a unique-logo
    // metric, so count Stripe customers rather than subscription objects.
    clientsLost: lostCustomerIds.size,
    openingClients: openingCustomerIds.size,
    programChurnMrr: Math.round(programChurnMrr * 100) / 100,
    programChurnClients: programChurnCustomerIds.size,
    lateralMovementMrr: Math.round(lateralMovementMrr * 100) / 100,
    monthlyMRR: Math.round(monthlyMRR * 100) / 100,
    pifMRR: Math.round(pifMRR * 100) / 100,
    monthlyClients,
    pifClients,
    monthlyNewMRR: Math.round(monthlyNewMRR * 100) / 100,
    pifNewMRR: Math.round(pifNewMRR * 100) / 100,
    monthlyRetainedNewMRR: Math.round(monthlyRetainedNewMRR * 100) / 100,
    pifRetainedNewMRR: Math.round(pifRetainedNewMRR * 100) / 100,
    monthlyChurnedMRR: Math.round(monthlyChurnedMRR * 100) / 100,
    pifChurnedMRR: Math.round(pifChurnedMRR * 100) / 100,
  };
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
  const prevMRR = prevMetrics?.mrr || 0;
  const prevClients = metrics.openingClients || 0;
  const churnPct = prevClients > 0 ? Math.round((metrics.clientsLost / prevClients) * 1000) / 10 : 0;
  const revenueChurnPct = prevMRR > 0 ? Math.round((metrics.churnedMrr / prevMRR) * 1000) / 10 : 0;
  const netMRR = metrics.newMrr - metrics.churnedMrr;
  // Ending MRR less new-logo MRR is the ending revenue from the opening cohort.
  // This correctly excludes acquisition from NRR. GRR excludes expansion and is
  // therefore capped at 100%.
  // Confirmed Monthly → PIF conversions retain the customer and contracted
  // value even though recurring MRR temporarily leaves Stripe. Add that deferred
  // cohort value back to NRR; do not add PIF cash or new-logo revenue.
  const nrr = prevMRR > 0 ? Math.round(((totalMRR - metrics.retainedNewMrr + metrics.lateralMovementMrr) / prevMRR) * 1000) / 10 : null;
  const grr = prevMRR > 0 ? Math.round(Math.min(100, Math.max(0, (prevMRR - metrics.churnedMrr) / prevMRR * 100)) * 10) / 10 : null;

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
       "monthlyNRR", "pifNRR", "openingClients", "programChurnClients", "programChurnMRR", "syncedAt")
     VALUES ('gyc', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, NOW())
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
       "syncedAt" = NOW()`,
    [monthStr, totalMRR, metrics.activeSubscriptions, metrics.clientsAdded, metrics.clientsLost,
     metrics.newMrr, metrics.churnedMrr, netMRR, churnPct, revenueChurnPct, nrr, grr,
     metrics.monthlyMRR, metrics.pifMRR, metrics.monthlyClients, metrics.pifClients,
     metrics.monthlyChurnedMRR, metrics.pifChurnedMRR, metrics.monthlyNewMRR, metrics.pifNewMRR,
     monthlyNRR, pifNRR, metrics.openingClients, metrics.programChurnClients, metrics.programChurnMrr]
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
  await client.query(`CREATE TABLE IF NOT EXISTS "ChurnClassification" (
    "id" BIGSERIAL PRIMARY KEY, "tenantId" TEXT NOT NULL DEFAULT 'gyc', "canceledSubscriptionId" TEXT,
    "stripeCustomerId" TEXT, "clientName" TEXT NOT NULL, "classificationType" TEXT NOT NULL,
    "normalizedClientName" TEXT NOT NULL, "canceledMonth" TEXT NOT NULL, "mrr" NUMERIC(12,2) NOT NULL,
    "reason" TEXT, "evidence" TEXT, "status" TEXT NOT NULL DEFAULT 'confirmed', "classifiedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE ("tenantId", "normalizedClientName", "canceledMonth", "mrr"),
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
  await client.query(`INSERT INTO "ChurnClassification" ("tenantId","clientName","normalizedClientName","canceledMonth",mrr,"classificationType",reason,evidence,status) VALUES
    ('gyc','Frederick Country Day Montessori & Art School','frederickcountrydaymontessoriartschool','2026-06',197,'billing_replacement','Replacement/duplicate subscription; other subscriptions remain active','Stripe + offboarding audit 2026-07-29','confirmed'),
    ('gyc','Virginia Montessori Academy','virginiamontessoriacademy','2026-06',599,'billing_replacement','Payments continued on active replacement subscription','Stripe audit 2026-07-29','confirmed'),
    ('gyc','Montessori Children''s Academy','montessorichildrensacademy','2026-06',995,'program_churn','Canceled Google Ads; retained website service','Asana offboarding audit 2026-07-29','confirmed'),
    ('gyc','Lehigh School Academy','lehighschoolacademy','2026-06',1497,'lateral_migration','Moved Google Ads to SEO; replacement subscription active','Asana + Stripe audit 2026-07-29','confirmed'),
    ('gyc','TweetyB''s','tweetybs','2026-07',790,'billing_replacement','Subscription replacement/reactivation; logo retained','Stripe audit 2026-07-29','confirmed'),
    ('gyc','Great Beginnings Daycare and Preschool','greatbeginningsdaycareandpreschool','2026-07',1019,'billing_replacement','Subscription replacement; logo retained','Stripe audit 2026-07-29','confirmed'),
    ('gyc','Little Treehouse Academy','littletreehouseacademy','2026-07',795,'lateral_migration','Moved Google Ads to Reputation Engine; retained website','Asana offboarding audit 2026-07-29','confirmed'),
    ('gyc','Crossing Borders Language Center','crossingborderslanguagecenter','2026-07',1395,'lateral_migration','Moved Google Ads to Reputation Engine Core; retained website','Asana offboarding audit 2026-07-29','confirmed'),
    ('gyc','Kidstown Learning Center','kidstownlearningcenter','2026-07',995,'lateral_migration','Moved Google Ads to SEO; transition services remain active','Asana offboarding audit 2026-07-29','confirmed')
    ON CONFLICT ("tenantId","normalizedClientName","canceledMonth",mrr) DO UPDATE SET "classificationType"=EXCLUDED."classificationType",reason=EXCLUDED.reason,evidence=EXCLUDED.evidence,status=EXCLUDED.status,"updatedAt"=NOW()`);
  const { rows: classified } = await client.query(`SELECT "canceledSubscriptionId", "stripeCustomerId", "normalizedClientName", "canceledMonth", mrr, "classificationType", reason, evidence, status FROM "ChurnClassification" WHERE "tenantId"='gyc'`);
  const existing = new Set(classified.map(row => row.canceledSubscriptionId));
  return classified.concat(rows.filter(row => !existing.has(row.canceledSubscriptionId)).map(row => ({ ...row, classificationType: 'pif_lateral', status: 'confirmed' })));
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

    // Build metrics for each target month + the month before (for NRR prev-month reference)
    const allMonths = [targets[0]]; // we need month before first target for NRR
    // Add the month before first target for prevMetrics reference
    const [y, m] = targets[0].split('-').map(Number);
    const prevMonth = new Date(Date.UTC(y, m - 2, 1));
    const prevMonthStr = `${prevMonth.getUTCFullYear()}-${String(prevMonth.getUTCMonth() + 1).padStart(2, '0')}`;

    const metricsMap = {};
    // Compute prev month metrics for NRR baseline
    metricsMap[prevMonthStr] = computeMonthMetrics(subs, prevMonthStr, confirmedLaterals);

    for (const month of targets) {
      metricsMap[month] = computeMonthMetrics(subs, month, confirmedLaterals);
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

main().catch(e => {
  console.error('❌ Fatal:', e.message);
  process.exit(1);
});
