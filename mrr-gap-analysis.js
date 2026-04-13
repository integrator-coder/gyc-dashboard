const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('\n=== STEP 1: StripeMetrics MRR History ===');
    const q1 = await client.query(`
      SELECT to_char("syncedAt", 'YYYY-MM') as month, 
        MAX(mrr) as mrr,
        MAX("activeCustomers") as active_customers
      FROM "StripeMetrics" WHERE "tenantId"='gyc'
      GROUP BY 1 ORDER BY 1
    `);
    console.table(q1.rows);

    console.log('\n=== STEP 2: StripeCustomer Status Breakdown ===');
    const q2 = await client.query(`
      SELECT status, COUNT(*) as count, SUM(mrr) as total_mrr 
      FROM "StripeCustomer" WHERE "tenantId"='gyc'
      GROUP BY status ORDER BY count DESC
    `);
    console.table(q2.rows);

    console.log('\n=== STEP 3: MRR Distribution (active + past_due) ===');
    const q3 = await client.query(`
      SELECT 
        CASE 
          WHEN mrr = 0 THEN 'zero'
          WHEN mrr < 200 THEN '<$200'
          WHEN mrr < 500 THEN '$200-500'
          WHEN mrr < 1000 THEN '$500-1000'
          WHEN mrr < 2000 THEN '$1000-2000'
          ELSE '$2000+'
        END as mrr_bucket,
        COUNT(*) as clients,
        SUM(mrr) as total_mrr
      FROM "StripeCustomer" 
      WHERE "tenantId"='gyc' AND status IN ('active','past_due')
      GROUP BY 1 ORDER BY MIN(mrr)
    `);
    console.table(q3.rows);

    console.log('\n=== STEP 6: DailyRevenue Jan-Mar 2025 ===');
    const q6 = await client.query(`
      SELECT to_char(date::timestamp, 'YYYY-MM') as month, SUM(amount) as cash_collected
      FROM "DailyRevenue" WHERE "tenantId"='gyc' AND date >= '2025-01-01' AND date < '2025-04-01'
      GROUP BY 1 ORDER BY 1
    `);
    console.table(q6.rows);

    // Extra: Total active MRR and count for reference
    console.log('\n=== EXTRA: Active Subscribers Total ===');
    const qx = await client.query(`
      SELECT COUNT(*) as count, SUM(mrr) as total_mrr
      FROM "StripeCustomer"
      WHERE "tenantId"='gyc' AND status='active' AND mrr > 0
    `);
    console.table(qx.rows);

    // Extra: Check for zero-MRR active clients (PIF candidates)
    console.log('\n=== EXTRA: Zero-MRR Active Clients ===');
    const qz = await client.query(`
      SELECT COUNT(*) as zero_mrr_active
      FROM "StripeCustomer"
      WHERE "tenantId"='gyc' AND status='active' AND mrr = 0
    `);
    console.table(qz.rows);

    // Extra: Check StripeMetrics table columns
    console.log('\n=== EXTRA: StripeMetrics recent rows ===');
    const qm = await client.query(`
      SELECT * FROM "StripeMetrics" WHERE "tenantId"='gyc' ORDER BY "syncedAt" DESC LIMIT 5
    `);
    console.table(qm.rows);

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
