const { google } = require('googleapis');
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const MASTER_SHEET_ID = '1uZLqNTDWXZ3wbBU7ley-81gj8Kj4h06_Ftd2utE-pjY';
const SERVICE_ACCOUNT_PATH = path.join(process.env.HOME, '.openclaw/workspace/google-service-account.json');

// Database pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Google Sheets auth
const auth = new google.auth.GoogleAuth({
  keyFile: SERVICE_ACCOUNT_PATH,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });

const results = {
  locationCountsUpdated: 0,
  companyNamesUpdated: 0,
  gbpUrlsAdded: 0,
  addressesUpdated: 0,
  cancelledFlagged: [],
  errors: [],
  dataForSeoNeeded: []
};

async function readMasterSheet() {
  console.log('Reading master sheet...');
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: MASTER_SHEET_ID,
    range: 'A:K',
  });
  
  const rows = response.data.values;
  if (!rows || rows.length === 0) {
    throw new Error('No data found in master sheet');
  }
  
  // Skip header row, group by acronym
  const dataByAcronym = {};
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const acronym = row[0]?.trim();
    
    if (!acronym) continue; // Skip empty rows
    
    if (!dataByAcronym[acronym]) {
      dataByAcronym[acronym] = {
        acronym,
        companyName: row[1]?.trim() || null,
        locations: []
      };
    }
    
    // Check if this row has location data (website, location name, or map link)
    const hasLocationData = row[3] || row[4] || row[5];
    
    if (hasLocationData) {
      dataByAcronym[acronym].locations.push({
        locationName: row[4]?.trim() || null,
        mapLink: row[5]?.trim() || null,
        address: row[6]?.trim() || null,
        gbpLink: row[8]?.trim() || null,
        notes: row[9]?.trim() || null,
        status: row[10]?.trim() || null
      });
    }
  }
  
  console.log(`Parsed data for ${Object.keys(dataByAcronym).length} acronyms`);
  return dataByAcronym;
}

async function syncLocationCounts(dataByAcronym) {
  console.log('\n=== Step 2: Syncing location counts ===');
  
  for (const [acronym, data] of Object.entries(dataByAcronym)) {
    const locationCount = data.locations.length;
    
    const result = await pool.query(
      `UPDATE "ClientProfile" 
       SET "locationCount" = $1 
       WHERE acronym = $2 AND ("locationCount" IS NULL OR "locationCount" != $1)
       RETURNING acronym`,
      [locationCount, acronym]
    );
    
    if (result.rowCount > 0) {
      console.log(`✓ Updated ${acronym} location count to ${locationCount}`);
      results.locationCountsUpdated++;
    }
  }
  
  console.log(`Total location counts updated: ${results.locationCountsUpdated}`);
}

async function syncCompanyNames(dataByAcronym) {
  console.log('\n=== Step 3: Syncing company names ===');
  
  for (const [acronym, data] of Object.entries(dataByAcronym)) {
    if (!data.companyName) continue;
    
    const result = await pool.query(
      `UPDATE "ClientProfile" 
       SET "companyName" = $1 
       WHERE acronym = $2 AND "companyName" IS NULL
       RETURNING acronym`,
      [data.companyName, acronym]
    );
    
    if (result.rowCount > 0) {
      console.log(`✓ Set company name for ${acronym}: ${data.companyName}`);
      results.companyNamesUpdated++;
    }
  }
  
  console.log(`Total company names updated: ${results.companyNamesUpdated}`);
}

async function syncGBPUrls(dataByAcronym) {
  console.log('\n=== Step 4: Syncing GBP URLs ===');
  
  for (const [acronym, data] of Object.entries(dataByAcronym)) {
    for (const location of data.locations) {
      // Prefer GBP link, fall back to map link
      const gbpUrl = location.gbpLink || location.mapLink;
      if (!gbpUrl) continue;
      
      // Find matching GBPLocation record
      let query, params;
      
      if (data.locations.length === 1) {
        // Single location - match by acronym only
        query = `
          UPDATE "GBPLocation"
          SET "gbpUrl" = $1
          WHERE "clientAcronym" = $2 
            AND ("gbpUrl" IS NULL OR "gbpUrl" = '')
          RETURNING id, "locationName"
        `;
        params = [gbpUrl, acronym];
      } else {
        // Multiple locations - match by acronym + location name
        if (!location.locationName) continue;
        
        query = `
          UPDATE "GBPLocation"
          SET "gbpUrl" = $1
          WHERE "clientAcronym" = $2 
            AND "locationName" = $3
            AND ("gbpUrl" IS NULL OR "gbpUrl" = '')
          RETURNING id, "locationName"
        `;
        params = [gbpUrl, acronym, location.locationName];
      }
      
      const result = await pool.query(query, params);
      
      if (result.rowCount > 0) {
        const locName = result.rows[0].locationName || '(single location)';
        console.log(`✓ Set GBP URL for ${acronym} - ${locName}`);
        results.gbpUrlsAdded++;
      }
    }
  }
  
  console.log(`Total GBP URLs added: ${results.gbpUrlsAdded}`);
}

async function handleCancelledLocations(dataByAcronym) {
  console.log('\n=== Step 5: Handling cancelled locations ===');
  
  for (const [acronym, data] of Object.entries(dataByAcronym)) {
    const cancelledLocations = data.locations.filter(
      loc => loc.locationName && loc.locationName.toLowerCase().includes('cancelled')
    );
    
    if (cancelledLocations.length > 0) {
      console.log(`⚠️  ${acronym} has ${cancelledLocations.length} cancelled location(s)`);
      results.cancelledFlagged.push({
        acronym,
        count: cancelledLocations.length,
        locations: cancelledLocations.map(l => l.locationName)
      });
      
      // Add note to ClientProfile
      const note = `Master sheet shows ${cancelledLocations.length} cancelled location(s). Verify with Lex before deletion.`;
      
      await pool.query(
        `UPDATE "ClientProfile"
         SET "teamNotes" = COALESCE("teamNotes" || '\n\n', '') || $1
         WHERE acronym = $2 AND (("teamNotes" IS NULL) OR ("teamNotes" NOT LIKE '%cancelled location%'))`,
        [note, acronym]
      );
    }
  }
  
  if (results.cancelledFlagged.length > 0) {
    console.log(`Flagged ${results.cancelledFlagged.length} client(s) with cancelled locations`);
  }
}

async function syncAddresses(dataByAcronym) {
  console.log('\n=== Step 6: Syncing addresses ===');
  
  for (const [acronym, data] of Object.entries(dataByAcronym)) {
    for (const location of data.locations) {
      if (!location.address) continue;
      
      let query, params;
      
      if (data.locations.length === 1) {
        query = `
          UPDATE "GBPLocation"
          SET address = $1
          WHERE "clientAcronym" = $2 
            AND address IS NULL
          RETURNING id, "locationName"
        `;
        params = [location.address, acronym];
      } else {
        if (!location.locationName) continue;
        
        query = `
          UPDATE "GBPLocation"
          SET address = $1
          WHERE "clientAcronym" = $2 
            AND "locationName" = $3
            AND address IS NULL
          RETURNING id, "locationName"
        `;
        params = [location.address, acronym, location.locationName];
      }
      
      const result = await pool.query(query, params);
      
      if (result.rowCount > 0) {
        const locName = result.rows[0].locationName || '(single location)';
        console.log(`✓ Set address for ${acronym} - ${locName}`);
        results.addressesUpdated++;
      }
    }
  }
  
  console.log(`Total addresses updated: ${results.addressesUpdated}`);
}

async function findLocationsNeedingDataForSEO() {
  console.log('\n=== Step 7: Finding locations needing DataForSEO refresh ===');
  
  const query = `
    SELECT gl.id, gl."clientAcronym", gl."locationName", gl."gbpUrl", 
           cp."companyName", cp.city, cp.state
    FROM "GBPLocation" gl 
    JOIN "ClientProfile" cp ON cp.acronym = gl."clientAcronym"
    WHERE cp.status = 'active'
      AND gl."gbpUrl" IS NOT NULL AND gl."gbpUrl" != ''
      AND gl.address IS NULL
      AND gl."liveDataSnapshot"->'addressInfo'->>'zip' IS NULL
    ORDER BY gl."clientAcronym"
  `;
  
  const result = await pool.query(query);
  
  if (result.rows.length > 0) {
    console.log(`Found ${result.rows.length} location(s) needing DataForSEO refresh:`);
    result.rows.forEach(row => {
      console.log(`  - ${row.clientAcronym} ${row.locationName || ''} (${row.companyName}, ${row.city}, ${row.state})`);
      results.dataForSeoNeeded.push(row);
    });
  } else {
    console.log('No locations need DataForSEO refresh');
  }
}

async function markFLPCancelled() {
  console.log('\n=== Step 8: Marking FLP as cancelled ===');
  
  const result = await pool.query(
    `UPDATE "ClientProfile" 
     SET status = 'cancelled', "cancelledDate" = CURRENT_DATE 
     WHERE acronym = 'FLP' AND status != 'cancelled'
     RETURNING acronym`,
  );
  
  if (result.rowCount > 0) {
    console.log('✓ Marked FLP as cancelled');
  } else {
    console.log('FLP already marked as cancelled');
  }
}

async function main() {
  try {
    console.log('=== GYC Dashboard Master Sheet Sync ===\n');
    
    // Step 1: Read master sheet
    const dataByAcronym = await readMasterSheet();
    
    // Step 2: Sync location counts
    await syncLocationCounts(dataByAcronym);
    
    // Step 3: Sync company names
    await syncCompanyNames(dataByAcronym);
    
    // Step 4: Sync GBP URLs
    await syncGBPUrls(dataByAcronym);
    
    // Step 5: Handle cancelled locations
    await handleCancelledLocations(dataByAcronym);
    
    // Step 6: Sync addresses
    await syncAddresses(dataByAcronym);
    
    // Step 7: Find locations needing DataForSEO
    await findLocationsNeedingDataForSEO();
    
    // Step 8: Mark FLP as cancelled
    await markFLPCancelled();
    
    // Final report
    console.log('\n=== FINAL REPORT ===');
    console.log(`Location counts updated: ${results.locationCountsUpdated}`);
    console.log(`Company names filled in: ${results.companyNamesUpdated}`);
    console.log(`GBP URLs added: ${results.gbpUrlsAdded}`);
    console.log(`Addresses resolved: ${results.addressesUpdated}`);
    console.log(`Clients with cancelled locations flagged: ${results.cancelledFlagged.length}`);
    
    if (results.cancelledFlagged.length > 0) {
      console.log('\nCancelled locations:');
      results.cancelledFlagged.forEach(item => {
        console.log(`  ${item.acronym}: ${item.locations.join(', ')}`);
      });
    }
    
    if (results.dataForSeoNeeded.length > 0) {
      console.log(`\n${results.dataForSeoNeeded.length} location(s) need DataForSEO refresh`);
    }
    
    if (results.errors.length > 0) {
      console.log('\nErrors encountered:');
      results.errors.forEach(err => console.log(`  - ${err}`));
    }
    
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
