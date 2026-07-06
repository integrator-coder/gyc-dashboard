const { Pool } = require('pg');
const fs = require('fs');

const env = fs.readFileSync('/Users/toddthejedigmail.com/.openclaw/workspace/gyc-dashboard/.env.local', 'utf8');
const match = env.match(/^DATABASE_URL=(.+)$/m);
const dbUrl = match[1].trim();
const pool = new Pool({ connectionString: dbUrl });

(async () => {
  try {
    // First, let's see all distinct service values
    const distinctServices = await pool.query(`
      SELECT DISTINCT unnest("serviceList") as service
      FROM "ClientProfile"
      WHERE "serviceList" IS NOT NULL
      ORDER BY service
    `);
    console.log('\n=== DISTINCT SERVICES ===');
    distinctServices.rows.forEach(r => console.log(r.service));
    
    // Now query for clients with Google Ads, Command, and Influence AND mrr > 1200
    // Need to check what "Influence" is called in the serviceList
    const qualifyingClients = await pool.query(`
      SELECT 
        id,
        acronym,
        "companyName",
        "ownerName",
        email,
        phone,
        "serviceList",
        mrr,
        "stripeCustomerId",
        status
      FROM "ClientProfile"
      WHERE 
        status = 'active'
        AND mrr > 1200
        AND "serviceList" @> ARRAY['Google Ads']
        AND "serviceList" @> ARRAY['Command']
      ORDER BY mrr DESC
    `);
    
    console.log('\n=== CLIENTS WITH GOOGLE ADS + COMMAND + MRR > 1200 ===');
    console.log(`Found ${qualifyingClients.rows.length} clients`);
    qualifyingClients.rows.forEach(client => {
      console.log(`\n${client.acronym} - ${client.companyName}`);
      console.log(`  MRR: $${parseFloat(client.mrr).toFixed(2)}`);
      console.log(`  Services: ${client.serviceList.join(', ')}`);
    });
    
    // Now check for "Influence" - might be named differently
    const withInfluence = await pool.query(`
      SELECT 
        id,
        acronym,
        "companyName",
        "serviceList",
        mrr
      FROM "ClientProfile"
      WHERE 
        status = 'active'
        AND mrr > 1200
        AND "serviceList" && ARRAY['Influence', 'influence', 'INFLUENCE']
      ORDER BY mrr DESC
    `);
    
    console.log('\n=== CLIENTS WITH "INFLUENCE" SERVICE ===');
    console.log(`Found ${withInfluence.rows.length} clients`);
    withInfluence.rows.forEach(client => {
      console.log(`${client.acronym}: ${client.serviceList.join(', ')}`);
    });
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
})();
