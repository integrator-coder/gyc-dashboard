const { Pool } = require('pg');
const fs = require('fs');

// Load DATABASE_URL from .env.local
const env = fs.readFileSync('/Users/toddthejedigmail.com/.openclaw/workspace/gyc-dashboard/.env.local', 'utf8');
const match = env.match(/^DATABASE_URL=(.+)$/m);
if (!match) {
  console.error('DATABASE_URL not found in .env.local');
  process.exit(1);
}

const dbUrl = match[1].trim();
const pool = new Pool({ connectionString: dbUrl });

(async () => {
  try {
    // List all tables
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log('\n=== TABLES ===');
    console.log(tables.rows.map(r => r.table_name).join(', '));
    
    // Check StripeSubscription structure
    const subCols = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'StripeSubscription' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    console.log('\n=== StripeSubscription COLUMNS ===');
    subCols.rows.forEach(r => {
      console.log(`${r.column_name} (${r.data_type}, nullable: ${r.is_nullable})`);
    });
    
    // Check StripeCustomer structure
    const custCols = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'StripeCustomer' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    console.log('\n=== StripeCustomer COLUMNS ===');
    custCols.rows.forEach(r => {
      console.log(`${r.column_name} (${r.data_type}, nullable: ${r.is_nullable})`);
    });
    
    // Sample a few subscriptions to see the data structure
    const sample = await pool.query(`
      SELECT * FROM "StripeSubscription" 
      WHERE status IN ('active', 'past_due')
      LIMIT 3
    `);
    console.log('\n=== SAMPLE SUBSCRIPTIONS ===');
    console.log(JSON.stringify(sample.rows, null, 2));
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
})();
