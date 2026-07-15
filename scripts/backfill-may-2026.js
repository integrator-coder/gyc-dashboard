#!/usr/bin/env node
/**
 * Backfill May 2026 with PIF/Monthly split
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
  const [year, month] = monthStr.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
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
  
  let monthlyMRR = 0, pifMRR = 0;
  let monthlyClients = 0, pifClients = 0;
  let monthlyNewMRR = 0, pifNewMRR = 0;
  let monthlyChurnedMRR = 0, pifChurnedMRR = 0;

  for (const sub of subs) {
    const created = sub.created;
    const canceledAt = sub.canceled_at;
    const subMrr = calcSubMRR(sub);
    if (subMrr <= 0) continue;
    
    const items = sub.items?.data || [];
    const firstInterval = items[0]?.price?.recurring?.interval;
    const isMonthly = firstInterval === 'month';
    const isPIF = firstInterval === 'year';

    const activeInMonth = created <= endUnix && (canceledAt == null || canceledAt > startUnix);
    if (activeInMonth) {
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

    if (created >= startUnix && created <= endUnix) {
      newMrr += subMrr;
      clientsAdded++;
      
      if (isMonthly) {
        monthlyNewMRR += subMrr;
      } else if (isPIF) {
        pifNewMRR += subMrr;
      }
    }

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
    monthlyChurnedMRR: Math.round(monthlyChurnedMRR * 100) / 100,
    pifChurnedMRR: Math.round(pifChurnedMRR * 100) / 100,
  };
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
  const grr = totalMRR > 0 ? Math.round(Math.min(100, Math.max(0, (totalMRR - metrics.churnedMrr) / totalMRR * 100)) * 10) / 10 : null;

  const prevMonthlyMRR = prevMetrics?.monthlyMRR || 0;
  const prevPifMRR = prevMetrics?.pifMRR || 0;
  
  const monthlyNRR = prevMonthlyMRR > 0 
    ? Math.round(((metrics.monthlyMRR - metrics.monthlyChurnedMRR) / prevMonthlyMRR) * 1000) / 10 
    : null;
  
  const pifNRR = prevPifMRR > 0 
    ? Math.round(((metrics.pifMRR - metrics.pifChurnedMRR) / prevPifMRR) * 1000) / 10 
    : null;

  await client.query(
    `INSERT INTO "MonthlyChurnMetrics"
      ("tenantId", "month", "totalMRR", "clientCount", "clientsAdded", "clientsLost",
       "newMRR", "churnedMRR", "netMRR", "churnPct", "nrr", "grr",
       "monthlyMRR", "pifMRR", "monthlyClients", "pifClients",
       "monthlyChurnedMRR", "pifChurnedMRR", "monthlyNewMRR", "pifNewMRR",
       "monthlyNRR", "pifNRR", "syncedAt")
     VALUES ('gyc', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, NOW())
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
     metrics.newMrr, metrics.churnedMrr, netMRR, churnPct, nrr, grr,
     metrics.monthlyMRR, metrics.pifMRR, metrics.monthlyClients, metrics.pifClients,
     metrics.monthlyChurnedMRR, metrics.pifChurnedMRR, metrics.monthlyNewMRR, metrics.pifNewMRR,
     monthlyNRR, pifNRR]
  );
}

async function main() {
  console.log('\n📅 Backfilling May 2026 with PIF/Monthly split');
  
  const subs = await fetchAllSubscriptions();
  const client = await pool.connect();

  try {
    // Compute April 2026 (for baseline)
    const aprilMetrics = computeMonthMetrics(subs, '2026-04');
    console.log('\n📅 2026-04 (baseline)');
    console.log(`   Monthly MRR: $${aprilMetrics.monthlyMRR.toLocaleString()} | PIF MRR: $${aprilMetrics.pifMRR.toLocaleString()}`);
    console.log(`   Monthly Clients: ${aprilMetrics.monthlyClients} | PIF Clients: ${aprilMetrics.pifClients}`);
    
    // Compute May 2026
    const mayMetrics = computeMonthMetrics(subs, '2026-05');
    console.log('\n📅 2026-05');
    console.log(`   MRR: $${mayMetrics.mrr.toLocaleString()} | Active: ${mayMetrics.activeSubscriptions}`);
    console.log(`   Monthly MRR: $${mayMetrics.monthlyMRR.toLocaleString()} | PIF MRR: $${mayMetrics.pifMRR.toLocaleString()}`);
    console.log(`   Monthly Clients: ${mayMetrics.monthlyClients} | PIF Clients: ${mayMetrics.pifClients}`);
    console.log(`   New MRR: $${mayMetrics.newMrr.toLocaleString()} | Churned MRR: $${mayMetrics.churnedMrr.toLocaleString()}`);
    console.log(`   Clients Added: ${mayMetrics.clientsAdded} | Lost: ${mayMetrics.clientsLost}`);

    await upsertMRRHistory(client, '2026-05', mayMetrics);
    await upsertChurnMetrics(client, '2026-05', mayMetrics, aprilMetrics);
    console.log('   ✅ MRRHistory + MonthlyChurnMetrics updated');

    console.log('\n✅ Backfill complete');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => {
  console.error('❌ Fatal:', e.message);
  process.exit(1);
});
