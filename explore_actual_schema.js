const { Pool } = require('pg');
const fs = require('fs');

async function main() {
  const env = fs.readFileSync('/Users/toddthejedigmail.com/.openclaw/workspace/gyc-dashboard/.env.local', 'utf8');
  const match = env.match(/^DATABASE_URL=(.+)$/m);
  const dbUrl = match[1].trim();
  const pool = new Pool({ connectionString: dbUrl });

  try {
    // Sample clients with actual columns
    console.log('=== SAMPLE CLIENTS ===\n');
    const sample = await pool.query(`
      SELECT *
      FROM "Client" 
      LIMIT 1
    `);
    console.log('Sample row:', JSON.stringify(sample.rows[0], null, 2));

    // Check StripeCustomer table
    console.log('\n\n=== STRIPE CUSTOMER TABLE ===\n');
    const customerCols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'StripeCustomer' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    console.log('StripeCustomer columns:');
    customerCols.rows.forEach(r => {
      console.log(`  ${r.column_name}: ${r.data_type}`);
    });

    // Sample StripeCustomer
    const customerSample = await pool.query(`
      SELECT * FROM "StripeCustomer" LIMIT 1
    `);
    console.log('\nSample StripeCustomer:', JSON.stringify(customerSample.rows[0], null, 2));

    // Check StripeSubscriptionHistory
    console.log('\n\n=== STRIPE SUBSCRIPTION HISTORY ===\n');
    const subCols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'StripeSubscriptionHistory' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    console.log('StripeSubscriptionHistory columns:');
    subCols.rows.forEach(r => {
      console.log(`  ${r.column_name}: ${r.data_type}`);
    });

    // Sample subscription
    const subSample = await pool.query(`
      SELECT * FROM "StripeSubscriptionHistory" 
      WHERE status = 'active'
      LIMIT 1
    `);
    console.log('\nSample subscription:', JSON.stringify(subSample.rows[0], null, 2));

    // Check if there's a relationship table
    console.log('\n\n=== CLIENT SERVICE MAP ===\n');
    const serviceCols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'ClientServiceMap' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    console.log('ClientServiceMap columns:');
    serviceCols.rows.forEach(r => {
      console.log(`  ${r.column_name}: ${r.data_type}`);
    });

    const serviceMapSample = await pool.query(`
      SELECT * FROM "ClientServiceMap" LIMIT 5
    `);
    console.log('\nSample ClientServiceMap:', JSON.stringify(serviceMapSample.rows, null, 2));

  } finally {
    await pool.end();
  }
}

main().catch(console.error);
