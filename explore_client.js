const { Pool } = require('pg');
const fs = require('fs');

async function main() {
  const env = fs.readFileSync('/Users/toddthejedigmail.com/.openclaw/workspace/gyc-dashboard/.env.local', 'utf8');
  const match = env.match(/^DATABASE_URL=(.+)$/m);
  const dbUrl = match[1].trim();
  const pool = new Pool({ connectionString: dbUrl });

  try {
    // Check Client table columns
    console.log('=== CLIENT TABLE COLUMNS ===\n');
    const clientCols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Client' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    clientCols.rows.forEach(r => {
      console.log(`${r.column_name}: ${r.data_type}`);
    });

    // Sample clients
    console.log('\n\n=== SAMPLE CLIENTS ===\n');
    const sample = await pool.query(`
      SELECT id, name, email, status, mrr, services
      FROM "Client" 
      WHERE mrr > 0
      ORDER BY mrr DESC
      LIMIT 3
    `);
    console.log(JSON.stringify(sample.rows, null, 2));

    // Check if service flag columns exist
    console.log('\n\n=== CHECKING FOR SERVICE FLAGS ===\n');
    const hasFlags = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Client' 
        AND table_schema = 'public'
        AND column_name LIKE '%has%'
      ORDER BY column_name
    `);
    console.log('Flag columns:', hasFlags.rows.map(r => r.column_name).join(', '));

    // Check StripeSubscriptionHistory for service info
    console.log('\n\n=== STRIPE SUBSCRIPTION HISTORY SAMPLE ===\n');
    const subSample = await pool.query(`
      SELECT DISTINCT status, COUNT(*) as count
      FROM "StripeSubscriptionHistory"
      GROUP BY status
      ORDER BY count DESC
    `);
    console.log('Subscription statuses:', JSON.stringify(subSample.rows, null, 2));

    // Check what metadata exists in subscriptions
    console.log('\n\n=== SUBSCRIPTION METADATA SAMPLE ===\n');
    const metaSample = await pool.query(`
      SELECT metadata, status
      FROM "StripeSubscriptionHistory"
      WHERE status = 'active'
      LIMIT 5
    `);
    console.log(JSON.stringify(metaSample.rows, null, 2));

  } finally {
    await pool.end();
  }
}

main().catch(console.error);
