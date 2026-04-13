const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const client = await pool.connect();
  try {
    // Top 10 by MRR - check columns
    console.log('\n=== StripeCustomer columns ===');
    const cols = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name='StripeCustomer' ORDER BY ordinal_position
    `);
    console.log(cols.rows.map(r => r.column_name).join(', '));

    console.log('\n=== Top 10 customers by MRR ===');
    const q5 = await client.query(`
      SELECT name, status, mrr
      FROM "StripeCustomer" 
      WHERE "tenantId"='gyc' AND mrr > 0
      ORDER BY mrr DESC LIMIT 10
    `);
    console.table(q5.rows);

    // DailyRevenue - monthly totals all time
    console.log('\n=== DailyRevenue - monthly totals (all) ===');
    const q6 = await client.query(`
      SELECT to_char(date::timestamp, 'YYYY-MM') as month, 
        SUM(amount) as cash_collected, 
        COUNT(*) as entries
      FROM "DailyRevenue" WHERE "tenantId"='gyc'
      GROUP BY 1 ORDER BY 1 DESC LIMIT 20
    `);
    console.table(q6.rows);

    // Check if StripeMetrics has activeSubscriptions different from customers
    console.log('\n=== StripeMetrics earliest records ===');
    const q7 = await client.query(`
      SELECT "syncedAt", mrr, "activeCustomers"
      FROM "StripeMetrics" WHERE "tenantId"='gyc' ORDER BY "syncedAt" ASC LIMIT 3
    `);
    console.table(q7.rows);

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
