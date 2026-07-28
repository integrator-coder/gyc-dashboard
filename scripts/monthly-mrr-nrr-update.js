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
  let page = await stripe.subscriptions.list({ limit: 100, status: 'all' });
  subs.push(...page.data);
  while (page.has_more) {
    page = await stripe.subscriptions.list({ limit: 100, status: 'all', starting_after: page.data[page.data.length - 1].id });
    subs.push(...page.data);
  }
  console.log(`Fetched ${subs.length} subscriptions`);
  return subs;
}

function computeMonthMetrics(subs, monthStr) {
  const { startUnix, endUnix } = monthBounds(monthStr);

  let mrr = 0, newMrr = 0, retainedNewMrr = 0, churnedMrr = 0, activeCount = 0;
  let clientsAdded = 0, clientsLost = 0;
  
  // Split by interval type
  let monthlyMRR = 0, pifMRR = 0;
  let monthlyClients = 0, pifClients = 0;
  let monthlyNewMRR = 0, pifNewMRR = 0;
  let monthlyRetainedNewMRR = 0, pifRetainedNewMRR = 0;
  let monthlyChurnedMRR = 0, pifChurnedMRR = 0;

  for (const sub of subs) {
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
      clientsAdded++;
      
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
      churnedMrr += subMrr;
      clientsLost++;
      
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
    clientsAdded,
    clientsLost,
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
  const prevClients = prevMetrics?.activeSubscriptions || 0;
  const churnPct = prevClients > 0 ? Math.round((metrics.clientsLost / prevClients) * 1000) / 10 : 0;
  const revenueChurnPct = prevMRR > 0 ? Math.round((metrics.churnedMrr / prevMRR) * 1000) / 10 : 0;
  const netMRR = metrics.newMrr - metrics.churnedMrr;
  // Ending MRR less new-logo MRR is the ending revenue from the opening cohort.
  // This correctly excludes acquisition from NRR. GRR excludes expansion and is
  // therefore capped at 100%.
  const nrr = prevMRR > 0 ? Math.round(((totalMRR - metrics.retainedNewMrr) / prevMRR) * 1000) / 10 : null;
  const grr = prevMRR > 0 ? Math.round(Math.min(100, Math.max(0, (prevMRR - metrics.churnedMrr) / prevMRR * 100)) * 10) / 10 : null;

  // Compute split NRR
  const prevMonthlyMRR = prevMetrics?.monthlyMRR || 0;
  const prevPifMRR = prevMetrics?.pifMRR || 0;
  
  const monthlyNRR = prevMonthlyMRR > 0 
    ? Math.round(((metrics.monthlyMRR - metrics.monthlyRetainedNewMRR) / prevMonthlyMRR) * 1000) / 10
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
       "monthlyNRR", "pifNRR", "syncedAt")
     VALUES ('gyc', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, NOW())
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
       "syncedAt" = NOW()`,
    [monthStr, totalMRR, metrics.activeSubscriptions, metrics.clientsAdded, metrics.clientsLost,
     metrics.newMrr, metrics.churnedMrr, netMRR, churnPct, revenueChurnPct, nrr, grr,
     metrics.monthlyMRR, metrics.pifMRR, metrics.monthlyClients, metrics.pifClients,
     metrics.monthlyChurnedMRR, metrics.pifChurnedMRR, metrics.monthlyNewMRR, metrics.pifNewMRR,
     monthlyNRR, pifNRR]
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

    // Build metrics for each target month + the month before (for NRR prev-month reference)
    const allMonths = [targets[0]]; // we need month before first target for NRR
    // Add the month before first target for prevMetrics reference
    const [y, m] = targets[0].split('-').map(Number);
    const prevMonth = new Date(Date.UTC(y, m - 2, 1));
    const prevMonthStr = `${prevMonth.getUTCFullYear()}-${String(prevMonth.getUTCMonth() + 1).padStart(2, '0')}`;

    const metricsMap = {};
    // Compute prev month metrics for NRR baseline
    metricsMap[prevMonthStr] = computeMonthMetrics(subs, prevMonthStr);

    for (const month of targets) {
      metricsMap[month] = computeMonthMetrics(subs, month);
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
