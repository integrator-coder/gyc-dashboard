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

  let mrr = 0, newMrr = 0, churnedMrr = 0, activeCount = 0;
  let clientsAdded = 0, clientsLost = 0;

  for (const sub of subs) {
    const created = sub.created; // unix
    const canceledAt = sub.canceled_at; // unix or null
    const subMrr = calcSubMRR(sub);
    if (subMrr <= 0) continue;

    // Active during this month: started before month end AND not canceled before month start
    const activeInMonth = created <= endUnix && (canceledAt == null || canceledAt > startUnix);
    if (activeInMonth) {
      mrr += subMrr;
      activeCount++;
    }

    // New this month
    if (created >= startUnix && created <= endUnix) {
      newMrr += subMrr;
      clientsAdded++;
    }

    // Churned this month
    if (canceledAt != null && canceledAt >= startUnix && canceledAt <= endUnix) {
      churnedMrr += subMrr;
      clientsLost++;
    }
  }

  return {
    mrr: Math.round(mrr * 100) / 100,
    newMrr: Math.round(newMrr * 100) / 100,
    churnedMrr: Math.round(churnedMrr * 100) / 100,
    activeSubscriptions: activeCount,
    clientsAdded,
    clientsLost,
  };
}

// Which months to update: previous month + current month (first-of-month run finalizes last month)
function getTargetMonths() {
  const now = new Date();
  const months = [];

  // Previous month (finalized)
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  months.push(`${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}`);

  // Current month (partial, will be re-run next month)
  const curr = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  months.push(`${curr.getUTCFullYear()}-${String(curr.getUTCMonth() + 1).padStart(2, '0')}`);

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
  const churnPct = totalMRR > 0 ? Math.round((metrics.churnedMrr / totalMRR) * 1000) / 10 : 0;
  const netMRR = metrics.newMrr - metrics.churnedMrr;
  const prevMRR = prevMetrics?.mrr || 0;
  const nrr = prevMRR > 0 ? Math.round(((totalMRR - metrics.churnedMrr) / prevMRR) * 1000) / 10 : null;
  // GRR = (totalMRR - churnedMRR) / totalMRR × 100  — self-contained, matches dashboard formula
  const grr = totalMRR > 0 ? Math.round(Math.min(100, Math.max(0, (totalMRR - metrics.churnedMrr) / totalMRR * 100)) * 10) / 10 : null;

  await client.query(
    `INSERT INTO "MonthlyChurnMetrics"
      ("tenantId", "month", "totalMRR", "clientCount", "clientsAdded", "clientsLost",
       "newMRR", "churnedMRR", "netMRR", "churnPct", "nrr", "grr", "syncedAt")
     VALUES ('gyc', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
     ON CONFLICT ("tenantId", "month") DO UPDATE SET
       "totalMRR" = EXCLUDED."totalMRR",
       "clientCount" = EXCLUDED."clientCount",
       "clientsAdded" = EXCLUDED."clientsAdded",
       "clientsLost" = EXCLUDED."clientsLost",
       "newMRR" = EXCLUDED."newMRR",
       "churnedMRR" = EXCLUDED."churnedMRR",
       "netMRR" = EXCLUDED."netMRR",
       "churnPct" = EXCLUDED."churnPct",
       "nrr" = EXCLUDED."nrr",
       "grr" = EXCLUDED."grr",
       "syncedAt" = NOW()`,
    [monthStr, totalMRR, metrics.activeSubscriptions, metrics.clientsAdded, metrics.clientsLost,
     metrics.newMrr, metrics.churnedMrr, netMRR, churnPct, nrr, grr]
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
      "nrr"          NUMERIC(6,2),
      "grr"          NUMERIC(6,2),
      "syncedAt"     TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE ("tenantId", "month")
    )
  `);
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
