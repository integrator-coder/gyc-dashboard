const { Pool } = require('pg');
const fs = require('fs');

const env = fs.readFileSync('/Users/toddthejedigmail.com/.openclaw/workspace/gyc-dashboard/.env.local', 'utf8');
const match = env.match(/^DATABASE_URL=(.+)$/m);
const dbUrl = match[1].trim();
const pool = new Pool({ connectionString: dbUrl });

(async () => {
  try {
    // Check ClientContract structure
    const contractCols = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'ClientContract' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    console.log('\n=== ClientContract COLUMNS ===');
    contractCols.rows.forEach(r => console.log(`${r.column_name} (${r.data_type})`));
    
    // Sample ClientContract with services
    const contractSample = await pool.query(`
      SELECT * FROM "ClientContract" 
      WHERE services IS NOT NULL 
      LIMIT 5
    `);
    console.log('\n=== SAMPLE ClientContract WITH SERVICES ===');
    console.log(JSON.stringify(contractSample.rows, null, 2));
    
    // Check ClientProfile structure
    const profileCols = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'ClientProfile' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    console.log('\n=== ClientProfile COLUMNS ===');
    profileCols.rows.forEach(r => console.log(`${r.column_name} (${r.data_type})`));
    
    // Sample ClientProfile with serviceList
    const profileSample = await pool.query(`
      SELECT id, acronym, "companyName", "serviceList", mrr
      FROM "ClientProfile" 
      WHERE "serviceList" IS NOT NULL 
      LIMIT 10
    `);
    console.log('\n=== SAMPLE ClientProfile WITH SERVICE LIST ===');
    console.log(JSON.stringify(profileSample.rows, null, 2));
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
})();
