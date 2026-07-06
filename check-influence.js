const { Pool } = require('pg');
const fs = require('fs');

const env = fs.readFileSync('/Users/toddthejedigmail.com/.openclaw/workspace/gyc-dashboard/.env.local', 'utf8');
const match = env.match(/^DATABASE_URL=(.+)$/m);
const dbUrl = match[1].trim();
const pool = new Pool({ connectionString: dbUrl });

(async () => {
  try {
    // List all boolean columns in ClientServiceMap
    const cols = await pool.query(`
      SELECT column_name
      FROM information_schema.columns 
      WHERE table_name = 'ClientServiceMap' 
        AND table_schema = 'public'
        AND data_type = 'boolean'
      ORDER BY column_name
    `);
    console.log('\n=== BOOLEAN SERVICE FLAGS ===');
    cols.rows.forEach(r => console.log(r.column_name));
    
    // Check StripeSubscriptionHistory for product names containing "Influence"
    const influenceProducts = await pool.query(`
      SELECT DISTINCT "productName", "productCategory"
      FROM "StripeSubscriptionHistory"
      WHERE "productName" ILIKE '%influence%'
      LIMIT 20
    `);
    console.log('\n=== PRODUCTS CONTAINING "INFLUENCE" ===');
    console.log(JSON.stringify(influenceProducts.rows, null, 2));
    
    // Check for Google Ads and Command products too
    const googleProducts = await pool.query(`
      SELECT DISTINCT "productName", "productCategory"
      FROM "StripeSubscriptionHistory"
      WHERE "productName" ILIKE '%google%ads%'
      LIMIT 10
    `);
    console.log('\n=== PRODUCTS CONTAINING "GOOGLE ADS" ===');
    console.log(JSON.stringify(googleProducts.rows, null, 2));
    
    const commandProducts = await pool.query(`
      SELECT DISTINCT "productName", "productCategory"
      FROM "StripeSubscriptionHistory"
      WHERE "productName" ILIKE '%command%'
      LIMIT 10
    `);
    console.log('\n=== PRODUCTS CONTAINING "COMMAND" ===');
    console.log(JSON.stringify(commandProducts.rows, null, 2));
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
})();
