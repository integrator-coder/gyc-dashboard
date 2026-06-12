const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// DataForSEO credentials
const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN;
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD;

// Childcare keywords for validation
const CHILDCARE_KEYWORDS = [
  'child', 'daycare', 'day care', 'preschool', 'nursery',
  'kindergarten', 'learning', 'academy', 'school', 'montessori', 'kids'
];

// Stats tracking
let stats = {
  total: 0,
  resolved: 0,
  skipped: 0,
  errors: 0,
  apiCalls: 0
};

function containsChildcareKeyword(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return CHILDCARE_KEYWORDS.some(kw => lower.includes(kw));
}

async function callDataForSEO(keyword, locationCode = 2840) {
  const url = 'https://api.dataforseo.com/v3/serp/google/maps/live/advanced';
  const auth = Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64');

  const body = [{
    keyword,
    location_code: locationCode,
    language_code: 'en',
    depth: 10
  }];

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`DataForSEO API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  stats.apiCalls++;
  return data;
}

function validateMatch(match, companyName) {
  // Check if primaryCategory or title contains childcare keywords
  const categoryMatch = containsChildcareKeyword(match.category || '');
  const titleMatch = containsChildcareKeyword(match.title || '');
  
  return categoryMatch || titleMatch;
}

async function processLocation(location) {
  const { id, acronym, locationName, companyName, city, state } = location;
  
  console.log(`\n[${acronym}] Processing: ${companyName} (${city}, ${state})`);
  
  // Build search keyword
  const keyword = `${companyName} ${city} ${state}`;
  
  try {
    // Call DataForSEO
    const result = await callDataForSEO(keyword);
    
    if (result.status_code !== 20000) {
      console.log(`  ❌ API error: ${result.status_message}`);
      stats.errors++;
      return;
    }
    
    const items = result.tasks?.[0]?.result?.[0]?.items || [];
    
    if (items.length === 0) {
      console.log(`  ⚠️  No results found`);
      stats.skipped++;
      return;
    }
    
    // Find first valid match
    let match = null;
    for (const item of items) {
      if (validateMatch(item, companyName)) {
        match = item;
        break;
      }
    }
    
    if (!match) {
      console.log(`  ⚠️  No valid childcare match found in ${items.length} results`);
      stats.skipped++;
      return;
    }
    
    // Extract data
    const liveDataSnapshot = {
      title: match.title,
      primaryCategory: match.category,
      rating: match.rating?.value || null,
      reviews: match.rating?.votes_count || null,
      addressInfo: match.address_info || null,
      phone: match.phone || null,
      website: match.domain || null,
      cid: match.cid || null,
      placeId: match.place_id || null,
      latitude: match.latitude || null,
      longitude: match.longitude || null
    };
    
    const updateData = {
      liveDataSnapshot: JSON.stringify(liveDataSnapshot),
      placeId: match.place_id || null,
      gbpPlaceId: match.place_id || null,
      cid: match.cid || null,
      latitude: match.latitude || null,
      longitude: match.longitude || null,
      address: match.address || null,
      city: match.address_info?.city || city,
      state: match.address_info?.region || state,
      locationVerified: true
    };
    
    // Update database
    await pool.query(
      `UPDATE "GBPLocation" SET
        "liveDataSnapshot" = $1::jsonb,
        "placeId" = $2,
        "gbpPlaceId" = $3,
        "cid" = $4,
        "latitude" = $5,
        "longitude" = $6,
        "address" = $7,
        "city" = $8,
        "state" = $9,
        "locationVerified" = $10
      WHERE id = $11`,
      [
        updateData.liveDataSnapshot,
        updateData.placeId,
        updateData.gbpPlaceId,
        updateData.cid,
        updateData.latitude,
        updateData.longitude,
        updateData.address,
        updateData.city,
        updateData.state,
        updateData.locationVerified,
        id
      ]
    );
    
    console.log(`  ✅ Resolved: ${match.title}`);
    console.log(`     Category: ${match.category}`);
    console.log(`     Address: ${match.address}`);
    stats.resolved++;
    
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    stats.errors++;
  }
}

async function main() {
  console.log('🔧 DataForSEO GBP Fix - Starting...\n');
  
  // Fetch locations to fix
  const query = `
    SELECT gl.id, gl."clientAcronym" AS acronym, gl."locationName",
           gl."gbpUrl", cp."companyName", cp.city, cp.state
    FROM "GBPLocation" gl
    JOIN "ClientProfile" cp ON cp.acronym = gl."clientAcronym"
    WHERE cp.status = 'active'
      AND gl."gbpUrl" IS NOT NULL AND gl."gbpUrl" != ''
      AND (
        (gl."liveDataSnapshot" IS NOT NULL AND NOT (
          gl."liveDataSnapshot"->>'primaryCategory' ILIKE ANY(
            ARRAY['%child%','%daycare%','%day care%','%preschool%','%nursery%',
                  '%kindergarten%','%learning%','%academy%','%school%','%montessori%','%kids%']
          )
        ))
        OR (gl.address IS NULL AND gl."liveDataSnapshot"->'addressInfo'->>'zip' IS NULL)
      )
    ORDER BY gl."clientAcronym"
    LIMIT 150
  `;
  
  const result = await pool.query(query);
  const locations = result.rows;
  
  console.log(`📍 Found ${locations.length} locations to process\n`);
  stats.total = locations.length;
  
  // Process each location with rate limiting (500ms between calls)
  for (const location of locations) {
    await processLocation(location);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary Report');
  console.log('='.repeat(60));
  console.log(`Total locations:     ${stats.total}`);
  console.log(`✅ Resolved:         ${stats.resolved}`);
  console.log(`⚠️  Skipped:          ${stats.skipped}`);
  console.log(`❌ Errors:           ${stats.errors}`);
  console.log(`🔍 API calls:        ${stats.apiCalls}`);
  console.log(`💰 Estimated cost:   $${(stats.apiCalls * 0.02).toFixed(2)}`);
  console.log('='.repeat(60));
  
  await pool.end();
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
