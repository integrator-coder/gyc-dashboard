const { Pool } = require('pg');
const fs = require('fs');

const env = fs.readFileSync('/Users/toddthejedigmail.com/.openclaw/workspace/gyc-dashboard/.env.local', 'utf8');
const match = env.match(/^DATABASE_URL=(.+)$/m);
const dbUrl = match[1].trim();
const pool = new Pool({ connectionString: dbUrl });

(async () => {
  try {
    // Check StripeSubscriptionHistory structure
    const histCols = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'StripeSubscriptionHistory' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    console.log('\n=== StripeSubscriptionHistory COLUMNS ===');
    histCols.rows.forEach(r => {
      console.log(`${r.column_name} (${r.data_type}, nullable: ${r.is_nullable})`);
    });
    
    // Check ClientServiceMap structure - this might be where services are tracked
    const svcCols = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'ClientServiceMap' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    console.log('\n=== ClientServiceMap COLUMNS ===');
    svcCols.rows.forEach(r => {
      console.log(`${r.column_name} (${r.data_type}, nullable: ${r.is_nullable})`);
    });
    
    // Sample ClientServiceMap to see what services look like
    const svcSample = await pool.query(`
      SELECT * FROM "ClientServiceMap" 
      LIMIT 10
    `);
    console.log('\n=== SAMPLE ClientServiceMap ===');
    console.log(JSON.stringify(svcSample.rows, null, 2));
    
    // Check StripeCustomer with MRR > 1200
    const highSpenders = await pool.query(`
      SELECT id, name, email, mrr, status
      FROM "StripeCustomer"
      WHERE status = 'active' AND mrr > 1200
      ORDER BY mrr DESC
      LIMIT 5
    `);
    console.log('\n=== HIGH SPENDERS (MRR > 1200) ===');
    console.log(JSON.stringify(highSpenders.rows, null, 2));
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
})();
