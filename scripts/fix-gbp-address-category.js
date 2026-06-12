/**
 * DataForSEO Fix Script for GBP Locations
 * Resolves address/category data for locations with GBP URLs
 * Pattern: exactly matching the proven GKLC approach
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN;
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD;
const authHeader = 'Basic ' + Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64');

// Childcare validation keywords (exactly as in GKLC)
const childcareKw = ['child', 'daycare', 'day care', 'preschool', 'nursery', 'kindergarten', 'learning', 'academy', 'school', 'montessori', 'kids', 'early'];

// Rate limiting
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const RATE_LIMIT_MS = 500;
const MAX_CALLS = 250;

async function fixLocations() {
  console.log('🔍 Starting DataForSEO fix for GBP locations...\n');

  // Query locations needing resolution
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
  `;

  const result = await pool.query(query);
  const locations = result.rows;
  
  console.log(`📋 Found ${locations.length} locations needing resolution\n`);

  let processed = 0;
  let resolved = 0;
  let skipped = 0;
  let apiCallCount = 0;

  for (const loc of locations) {
    if (apiCallCount >= MAX_CALLS) {
      console.log(`\n⚠️  Reached max API call limit (${MAX_CALLS}). Stopping.`);
      break;
    }

    const { id: locationId, acronym, locationName, gbpUrl, companyName, city, state } = loc;
    
    console.log(`\n[${processed + 1}/${locations.length}] ${acronym} - ${locationName}`);
    console.log(`   Company: ${companyName}, ${city}, ${state}`);

    // KEYWORD = business name + city + state (EXACT GKLC pattern)
    const keyword = `${companyName} ${city} ${state}`;
    console.log(`   Keyword: "${keyword}"`);

    // DataForSEO call
    try {
      const response = await fetch('https://api.dataforseo.com/v3/serp/google/maps/live/advanced', {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([{
          keyword,
          location_code: 2840, // United States
          language_code: 'en',
          depth: 10
        }])
      });

      apiCallCount++;
      const data = await response.json();
      
      if (!data.tasks || data.tasks[0].status_code !== 20000) {
        console.log(`   ❌ API error: ${data.tasks?.[0]?.status_message || 'Unknown'}`);
        processed++;
        await sleep(RATE_LIMIT_MS);
        continue;
      }

      const items = data.tasks[0].result?.[0]?.items || [];
      
      // VALIDATE — childcare only (EXACT GKLC pattern)
      const match = items.find(item => 
        childcareKw.some(k => 
          item.title?.toLowerCase().includes(k) || 
          item.category?.toLowerCase().includes(k)
        )
      );

      if (!match) {
        console.log(`   ⏭️  SKIP — no childcare match in results`);
        skipped++;
        processed++;
        await sleep(RATE_LIMIT_MS);
        continue;
      }

      console.log(`   ✅ Match: ${match.title} (${match.category})`);

      // Build liveDataSnapshot (EXACT GKLC structure)
      const snapshot = {
        placeId: match.place_id,
        cid: match.cid?.toString(),
        rating: match.rating?.value,
        reviewCount: match.rating?.votes_count,
        ratingDistribution: match.rating?.rating_distribution,
        totalPhotos: match.total_photos,
        isClaimed: match.is_claimed,
        phone: match.phone,
        address: match.address,
        addressInfo: match.address_info || null, // CRITICAL for demographics
        website: match.url,
        latitude: match.latitude,
        longitude: match.longitude,
        primaryCategory: match.category,
        additionalCategories: match.additional_categories || [],
        mainImage: match.main_image,
        keyword,
        resolvedAt: new Date().toISOString()
      };

      // Update DB
      await pool.query(`
        UPDATE "GBPLocation" 
        SET "liveDataSnapshot" = $1,
            "liveDataUpdatedAt" = NOW(),
            "placeId" = $2,
            "gbpPlaceId" = $2,
            cid = $3,
            latitude = $4,
            longitude = $5,
            address = $6,
            city = $7,
            state = $8,
            "locationVerified" = true
        WHERE id = $9
      `, [
        JSON.stringify(snapshot),
        match.place_id,
        match.cid?.toString(),
        match.latitude,
        match.longitude,
        match.address,
        match.address_info?.city || null,
        match.address_info?.region || null,
        locationId
      ]);

      console.log(`   💾 Saved to DB`);
      resolved++;

    } catch (err) {
      console.error(`   ❌ Error: ${err.message}`);
    }

    processed++;
    await sleep(RATE_LIMIT_MS);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total locations processed: ${processed}`);
  console.log(`Successfully resolved:     ${resolved}`);
  console.log(`Skipped (no match):        ${skipped}`);
  console.log(`API calls made:            ${apiCallCount}`);
  console.log(`Estimated cost:            $${(apiCallCount * 0.02).toFixed(2)} (at $0.02/call)`);
  console.log('='.repeat(60));

  await pool.end();
}

// Run
fixLocations().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
