const { Pool } = require('pg');
const fs = require('fs');

const env = fs.readFileSync('/Users/toddthejedigmail.com/.openclaw/workspace/gyc-dashboard/.env.local', 'utf8');
const match = env.match(/^DATABASE_URL=(.+)$/m);
const dbUrl = match[1].trim();
const pool = new Pool({ connectionString: dbUrl });

(async () => {
  try {
    // Check clients with Google Ads (any MRR)
    const googleAdsClients = await pool.query(`
      SELECT 
        acronym,
        "companyName",
        "serviceList",
        mrr,
        status
      FROM "ClientProfile"
      WHERE 
        status = 'active'
        AND "serviceList" @> ARRAY['Google Ads']
      ORDER BY mrr DESC
      LIMIT 20
    `);
    
    console.log('\n=== CLIENTS WITH GOOGLE ADS (TOP 20 BY MRR) ===');
    googleAdsClients.rows.forEach(client => {
      console.log(`${client.acronym} - $${parseFloat(client.mrr).toFixed(2)} - [${client.serviceList.join(', ')}]`);
    });
    
    // Check clients with Command (any MRR)
    const commandClients = await pool.query(`
      SELECT 
        acronym,
        "companyName",
        "serviceList",
        mrr,
        status
      FROM "ClientProfile"
      WHERE 
        status = 'active'
        AND "serviceList" @> ARRAY['Command']
      ORDER BY mrr DESC
      LIMIT 20
    `);
    
    console.log('\n=== CLIENTS WITH COMMAND (TOP 20 BY MRR) ===');
    commandClients.rows.forEach(client => {
      console.log(`${client.acronym} - $${parseFloat(client.mrr).toFixed(2)} - [${client.serviceList.join(', ')}]`);
    });
    
    // Check clients with BOTH Google Ads AND Command (any MRR)
    const bothClients = await pool.query(`
      SELECT 
        acronym,
        "companyName",
        "serviceList",
        mrr,
        status
      FROM "ClientProfile"
      WHERE 
        status = 'active'
        AND "serviceList" @> ARRAY['Google Ads']
        AND "serviceList" @> ARRAY['Command']
      ORDER BY mrr DESC
    `);
    
    console.log('\n=== CLIENTS WITH BOTH GOOGLE ADS + COMMAND ===');
    console.log(`Found ${bothClients.rows.length} clients`);
    bothClients.rows.forEach(client => {
      console.log(`${client.acronym} - $${parseFloat(client.mrr).toFixed(2)} - [${client.serviceList.join(', ')}]`);
    });
    
    // Check high-spending clients (> 1200) and their services
    const highSpenders = await pool.query(`
      SELECT 
        acronym,
        "companyName",
        "serviceList",
        mrr,
        status
      FROM "ClientProfile"
      WHERE 
        status = 'active'
        AND mrr > 1200
      ORDER BY mrr DESC
      LIMIT 20
    `);
    
    console.log('\n=== HIGH SPENDERS (MRR > $1200) ===');
    highSpenders.rows.forEach(client => {
      console.log(`${client.acronym} - $${parseFloat(client.mrr).toFixed(2)} - [${client.serviceList ? client.serviceList.join(', ') : 'No services'}]`);
    });
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
})();
