require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const AUTH = Buffer.from(`${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`).toString('base64');
const HEADERS = { 'Authorization': `Basic ${AUTH}`, 'Content-Type': 'application/json' };

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchGBPLiveData(location) {
  const keyword = location.gbpPlaceId || `${location.locationName} ${location.city} ${location.state}`;
  
  const payload = [{
    location_coordinate: location.address,
    language_code: "en",
    keyword: keyword.trim(),
    depth: 1
  }];

  try {
    const response = await fetch('https://api.dataforseo.com/v3/business_data/google/maps/live/advanced', {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    
    if (data.status_code === 20000 && data.tasks?.[0]?.result?.[0]?.items) {
      return data.tasks[0].result[0].items[0] || null;
    }
    
    console.error(`❌ API error for ${location.clientAcronym}/${location.locationName}:`, data.status_message || 'No items returned');
    return null;
  } catch (error) {
    console.error(`❌ Fetch error for ${location.clientAcronym}/${location.locationName}:`, error.message);
    return null;
  }
}

async function updateLiveData(locationId, liveData) {
  try {
    // Update GBPLocation with liveDataSnapshot
    await pool.query(
      'UPDATE "GBPLocation" SET "liveDataSnapshot" = $1, "lastSyncedAt" = NOW() WHERE id = $2',
      [JSON.stringify(liveData), locationId]
    );

    // Insert into GBPSnapshot table
    await pool.query(
      `INSERT INTO "GBPSnapshot" ("locationId", "snapshotData", "snapshotDate")
       VALUES ($1, $2, NOW())`,
      [locationId, JSON.stringify(liveData)]
    );

    return true;
  } catch (error) {
    console.error(`❌ DB update error for location ${locationId}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting GBP Live Data Sync for ALL locations...\n');

  // Get all locations without live data
  const { rows: locations } = await pool.query(`
    SELECT id, "clientAcronym", "locationName", "gbpPlaceId", address, city, state, cid
    FROM "GBPLocation"
    WHERE address IS NOT NULL 
      AND ("liveDataSnapshot" IS NULL OR "liveDataSnapshot" = 'null'::jsonb)
    ORDER BY "clientAcronym", "locationName"
  `);

  console.log(`📍 Found ${locations.length} locations to sync\n`);

  let successCount = 0;
  let failureCount = 0;
  const batchSize = 50;

  for (let i = 0; i < locations.length; i++) {
    const location = locations[i];
    const progress = `[${i + 1}/${locations.length}]`;

    console.log(`${progress} Syncing ${location.clientAcronym}/${location.locationName}...`);

    const liveData = await fetchGBPLiveData(location);

    if (liveData) {
      const updated = await updateLiveData(location.id, liveData);
      if (updated) {
        successCount++;
        console.log(`✅ ${progress} Success: ${location.clientAcronym}/${location.locationName}`);
      } else {
        failureCount++;
      }
    } else {
      failureCount++;
    }

    // Add delay after each batch
    if ((i + 1) % batchSize === 0 && i < locations.length - 1) {
      console.log(`\n⏸️  Batch ${Math.floor((i + 1) / batchSize)} complete. Pausing 1 second...\n`);
      await sleep(1000);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 GBP LIVE DATA SYNC COMPLETE');
  console.log('='.repeat(60));
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failures: ${failureCount}`);
  console.log(`📍 Total: ${locations.length}`);
  console.log('='.repeat(60));

  await pool.end();
}

main().catch(console.error);
