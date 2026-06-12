const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function verify() {
  console.log('=== Verification of Sync Results ===\n');
  
  // Check location counts
  console.log('1. Location Counts Updated:');
  const countResult = await pool.query(
    `SELECT acronym, "locationCount" 
     FROM "ClientProfile" 
     WHERE acronym IN ('APC', 'AZBB', 'BED', 'CCCA', 'CPDS')
     ORDER BY acronym`
  );
  console.table(countResult.rows);
  
  // Check GBP URLs added today
  console.log('\n2. GBP URLs Added (sample of 10):');
  const urlResult = await pool.query(
    `SELECT "clientAcronym", "locationName", LEFT("gbpUrl", 50) as "gbpUrl_preview"
     FROM "GBPLocation" 
     WHERE "gbpUrl" IS NOT NULL 
       AND "updatedAt"::date = CURRENT_DATE
     ORDER BY "clientAcronym"
     LIMIT 10`
  );
  console.table(urlResult.rows);
  console.log(`... (showing 10 of ${urlResult.rowCount} total)\n`);
  
  // Check cancelled location flags
  console.log('3. Clients with Cancelled Location Notes:');
  const cancelledResult = await pool.query(
    `SELECT acronym, 
            CASE 
              WHEN LENGTH("teamNotes") > 100 THEN LEFT("teamNotes", 100) || '...'
              ELSE "teamNotes"
            END as notes_preview
     FROM "ClientProfile" 
     WHERE "teamNotes" LIKE '%cancelled location%'
     ORDER BY acronym
     LIMIT 10`
  );
  console.table(cancelledResult.rows);
  console.log(`... (showing 10 of ${cancelledResult.rowCount} total)\n`);
  
  // Check DataForSEO updates
  console.log('4. DataForSEO Updated Locations:');
  const seoResult = await pool.query(
    `SELECT "clientAcronym", "locationName", 
            LEFT(address, 40) as address_preview,
            "liveDataSnapshot"->>'category' as category,
            "liveDataUpdatedAt"
     FROM "GBPLocation" 
     WHERE "liveDataUpdatedAt"::date = CURRENT_DATE
     ORDER BY "clientAcronym"`
  );
  console.table(seoResult.rows);
  
  // Verify FLP cancelled
  console.log('\n5. FLP Cancellation:');
  const flpResult = await pool.query(
    `SELECT acronym, status, "cancelledDate" 
     FROM "ClientProfile" 
     WHERE acronym = 'FLP'`
  );
  console.table(flpResult.rows);
  
  console.log('\n✅ Verification Complete');
}

async function main() {
  try {
    await verify();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
