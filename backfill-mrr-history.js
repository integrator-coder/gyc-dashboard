require('dotenv').config({ path: '.env.local', override: true });
const Stripe = require('stripe');
const { Pool } = require('pg');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Target months to backfill
const TARGET_MONTHS = ['2026-05', '2026-06', '2026-07'];

function getMonthBoundaries(monthStr) {
  const [year, month] = monthStr.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return {
    start,
    end,
    startUnix: Math.floor(start.getTime() / 1000),
    endUnix: Math.floor(end.getTime() / 1000)
  };
}

function calculateMRR(subscription) {
  if (!subscription.items || !subscription.items.data || subscription.items.data.length === 0) {
    return 0;
  }
  
  let mrr = 0;
  for (const item of subscription.items.data) {
    const amount = item.price.unit_amount || 0;
    const interval = item.price.recurring?.interval;
    
    if (interval === 'month') {
      mrr += amount / 100;
    } else if (interval === 'year') {
      mrr += amount / 1200;
    }
  }
  
  return mrr;
}

async function fetchAllSubscriptions() {
  console.log('Fetching all Stripe subscriptions...');
  const subscriptions = [];
  
  for await (const subscription of stripe.subscriptions.list({
    limit: 100,
    expand: ['data.latest_invoice']
  })) {
    subscriptions.push(subscription);
  }
  
  console.log(`Fetched ${subscriptions.length} total subscriptions from Stripe`);
  return subscriptions;
}

function calculateMonthMetrics(subscriptions, monthStr) {
  const { startUnix, endUnix } = getMonthBoundaries(monthStr);
  
  let totalMRR = 0;
  let activeCount = 0;
  let newMrr = 0;
  let churnedMrr = 0;
  
  for (const sub of subscriptions) {
    const createdAt = sub.created;
    const canceledAt = sub.canceled_at;
    const status = sub.status;
    const mrr = calculateMRR(sub);
    
    // Active for the month
    const isActiveForMonth = 
      createdAt <= endUnix &&
      (canceledAt === null || canceledAt > endUnix) &&
      ['active', 'past_due', 'trialing'].includes(status) &&
      mrr > 0;
    
    if (isActiveForMonth) {
      totalMRR += mrr;
      activeCount++;
    }
    
    // New MRR - created within the month
    if (createdAt >= startUnix && createdAt <= endUnix && mrr > 0) {
      newMrr += mrr;
    }
    
    // Churned MRR - canceled within the month
    if (canceledAt && canceledAt >= startUnix && canceledAt <= endUnix && mrr > 0) {
      churnedMrr += mrr;
    }
  }
  
  return {
    month: monthStr,
    mrr: Math.round(totalMRR * 100) / 100,
    newMrr: Math.round(newMrr * 100) / 100,
    churnedMrr: Math.round(churnedMrr * 100) / 100,
    activeSubscriptions: activeCount
  };
}

async function upsertMRRHistory(metrics) {
  const query = `
    INSERT INTO "MRRHistory" 
      ("tenantId", "month", "mrr", "newMrr", "churnedMrr", "expansionMrr", "activeSubscriptions", "syncedAt")
    VALUES 
      ($1, $2, $3, $4, $5, $6, $7, NOW())
    ON CONFLICT ("tenantId", "month")
    DO UPDATE SET
      "mrr" = EXCLUDED."mrr",
      "newMrr" = EXCLUDED."newMrr",
      "churnedMrr" = EXCLUDED."churnedMrr",
      "expansionMrr" = EXCLUDED."expansionMrr",
      "activeSubscriptions" = EXCLUDED."activeSubscriptions",
      "syncedAt" = NOW()
    RETURNING *;
  `;
  
  const values = [
    'gyc',
    metrics.month,
    metrics.mrr,
    metrics.newMrr,
    metrics.churnedMrr,
    0, // expansionMrr - not calculated in this simplified version
    metrics.activeSubscriptions
  ];
  
  const result = await pool.query(query, values);
  return result.rows[0];
}

async function main() {
  try {
    console.log('Starting MRRHistory backfill for May, June, July 2026...\n');
    
    // Fetch all subscriptions once
    const allSubscriptions = await fetchAllSubscriptions();
    
    // Process each target month
    for (const month of TARGET_MONTHS) {
      console.log(`\nProcessing ${month}...`);
      const metrics = calculateMonthMetrics(allSubscriptions, month);
      
      console.log(`  MRR: $${metrics.mrr}`);
      console.log(`  Active Subscriptions: ${metrics.activeSubscriptions}`);
      console.log(`  New MRR: $${metrics.newMrr}`);
      console.log(`  Churned MRR: $${metrics.churnedMrr}`);
      
      const dbRow = await upsertMRRHistory(metrics);
      console.log(`  ✓ Upserted to database`);
    }
    
    // Verify by fetching from DB
    console.log('\n\nVerification - Fetching from database:');
    const verifyQuery = `
      SELECT * FROM "MRRHistory" 
      WHERE "tenantId" = 'gyc' 
      AND "month" IN ('2026-05', '2026-06', '2026-07')
      ORDER BY "month";
    `;
    const verifyResult = await pool.query(verifyQuery);
    
    console.log('\nFinal DB Rows:');
    console.table(verifyResult.rows);
    
    console.log('\n✅ Backfill complete!');
    
  } catch (error) {
    console.error('Error during backfill:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

main();
