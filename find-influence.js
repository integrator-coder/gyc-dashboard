const { Pool } = require('pg');
const fs = require('fs');

const env = fs.readFileSync('/Users/toddthejedigmail.com/.openclaw/workspace/gyc-dashboard/.env.local', 'utf8');
const match = env.match(/^DATABASE_URL=(.+)$/m);
const dbUrl = match[1].trim();
const pool = new Pool({ connectionString: dbUrl });

(async () => {
  try {
    // Check Client table structure
    const clientCols = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'Client' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    console.log('\n=== CLIENT TABLE COLUMNS ===');
    clientCols.rows.forEach(r => console.log(`${r.column_name} (${r.data_type})`));
    
    // Sample Client records
    const clientSample = await pool.query(`
      SELECT * FROM "Client" LIMIT 3
    `);
    console.log('\n=== SAMPLE CLIENT RECORDS ===');
    console.log(JSON.stringify(clientSample.rows, null, 2));
    
    // Check ClientStripeLink
    const linkCols = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'ClientStripeLink' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    console.log('\n=== ClientStripeLink COLUMNS ===');
    linkCols.rows.forEach(r => console.log(`${r.column_name} (${r.data_type})`));
    
    // Try to find any table/column that might contain "Influence" service data
    const allCols = await pool.query(`
      SELECT table_name, column_name
      FROM information_schema.columns 
      WHERE table_schema = 'public'
        AND (column_name ILIKE '%influence%' OR column_name ILIKE '%service%')
      ORDER BY table_name, column_name
    `);
    console.log('\n=== COLUMNS WITH "INFLUENCE" OR "SERVICE" ===');
    allCols.rows.forEach(r => console.log(`${r.table_name}.${r.column_name}`));
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
})();
