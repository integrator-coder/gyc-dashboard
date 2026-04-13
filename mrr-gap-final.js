const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const client = await pool.connect();
  try {
    // How many customers does Stripe API report vs our DB?
    console.log('\n=== StripeMetrics: latest activeCustomers count ===');
    const q1 = await client.query(`
      SELECT "syncedAt", mrr, "activeCustomers", "newCustomers", "churnedCustomers"
      FROM "StripeMetrics" WHERE "tenantId"='gyc' ORDER BY "syncedAt" DESC LIMIT 1
    `);
    console.table(q1.rows);

    // Our DB customer count by status
    console.log('\n=== StripeCustomer: all statuses ===');
    const q2 = await client.query(`
      SELECT status, COUNT(*) as count, SUM(mrr) as total_mrr, AVG(mrr) as avg_mrr
      FROM "StripeCustomer" WHERE "tenantId"='gyc'
      GROUP BY status ORDER BY count DESC
    `);
    console.table(q2.rows);

    // Total in DB vs Stripe API
    console.log('\n=== DB total customers ===');
    const q3 = await client.query(`SELECT COUNT(*) as total FROM "StripeCustomer" WHERE "tenantId"='gyc'`);
    console.table(q3.rows);

    // Check if canceled customers might have non-zero MRR (stale data)
    console.log('\n=== Cancelled customers with MRR > 0? ===');
    const q4 = await client.query(`
      SELECT COUNT(*) as count, SUM(mrr) as mrr
      FROM "StripeCustomer" 
      WHERE "tenantId"='gyc' AND status NOT IN ('active','past_due') AND mrr > 0
    `);
    console.table(q4.rows);

    // Look at the top 10 customers by MRR
    console.log('\n=== Top 10 customers by MRR ===');
    const q5 = await client.query(`
      SELECT name, status, mrr, "stripeId"
      FROM "StripeCustomer" 
      WHERE "tenantId"='gyc' AND mrr > 0
      ORDER BY mrr DESC LIMIT 10
    `);
    console.table(q5.rows);

    // DailyRevenue - latest months available
    console.log('\n=== DailyRevenue - monthly totals all time ===');
    const q6 = await client.query(`
      SELECT to_char(date::timestamp, 'YYYY-MM') as month, SUM(amount) as cash_collected, COUNT(*) as entries
      FROM "DailyRevenue" WHERE "tenantId"='gyc'
      GROUP BY 1 ORDER BY 1 DESC LIMIT 20
    `);
    console.table(q6.rows);

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
