const { Pool } = require('pg');
const https = require('https');
const http = require('http');
require('dotenv').config({ path: '.env.local' });

// Simple fetch replacement using native https
function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = protocol.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          url: res.headers.location || url,
          json: () => JSON.parse(data),
          text: () => data
        });
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const AUTH = Buffer.from(
  process.env.DATAFORSEO_LOGIN + ':' + process.env.DATAFORSEO_PASSWORD
).toString('base64');

const HEADERS = {
  'Authorization': 'Basic ' + AUTH,
  'Content-Type': 'application/json'
};

const childcareKeywords = [
  'child', 'daycare', 'day care', 'preschool', 'nursery',
  'kindergarten', 'learning', 'academy', 'school', 'montessori',
  'kids', 'early'
];

function parseHours(workTime) {
  if (!workTime?.timetable) return null;
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const result = {};
  Object.entries(workTime.timetable).forEach(([day, times]) => {
    if (times?.open?.hour !== undefined) {
      result[day] = {
        open: `${String(times.open.hour).padStart(2, '0')}:${String(times.open.minute || 0).padStart(2, '0')}`,
        close: `${String(times.close.hour).padStart(2, '0')}:${String(times.close.minute || 0).padStart(2, '0')}`
      };
    }
  });
  return result;
}

async function expandGbpUrl(gbpUrl) {
  // Skip if already expanded
  if (gbpUrl.includes('maps.google.com') && gbpUrl.includes('@')) {
    return gbpUrl;
  }
  
  return new Promise((resolve) => {
    const urlObj = new URL(gbpUrl);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: 'HEAD',
      headers: { 'User-Agent': 'Mozilla/5.0' }
    };

    const req = protocol.request(reqOptions, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow redirect
        resolve(res.headers.location);
      } else {
        resolve(gbpUrl);
      }
    });

    req.on('error', (err) => {
      console.log(`  ⚠️  Failed to expand URL: ${err.message}`);
      resolve(gbpUrl);
    });
    
    req.end();
  });
}

async function searchDataForSEO(keyword) {
  try {
    const response = await fetch('https://api.dataforseo.com/v3/serp/google/maps/live/advanced', {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify([{
        keyword,
        location_code: 2840,
        language_code: 'en',
        depth: 10
      }])
    });

    const data = await response.json();
    const items = (data.tasks?.[0]?.result?.[0]?.items || [])
      .filter(i => i.type === 'maps_search');
    
    return items;
  } catch (err) {
    console.log(`  ⚠️  DataForSEO error: ${err.message}`);
    return [];
  }
}

function isChildcareMatch(item) {
  const text = `${item.title || ''} ${item.category || ''}`.toLowerCase();
  return childcareKeywords.some(k => text.includes(k));
}

async function processLocation(loc) {
  console.log(`\n📍 ${loc.acronym} - ${loc.locationName}`);
  console.log(`   Company: ${loc.companyName}`);
  console.log(`   City/State: ${loc.city}, ${loc.state}`);
  
  // Skip if no valid gbpUrl
  if (!loc.gbpUrl || loc.gbpUrl === 'No GBP' || loc.gbpUrl === 'Cancelled' || loc.gbpUrl === 'Caneelled') {
    console.log('   ⏭️  SKIP - No valid GBP URL');
    return { skipped: true, reason: 'no_gbp_url' };
  }

  // Skip if multiple URLs (needs manual review)
  if (loc.gbpUrl.includes(' - ') || loc.gbpUrl.includes('\n')) {
    console.log('   ⏭️  SKIP - Multiple URLs (needs manual review)');
    return { skipped: true, reason: 'multiple_urls' };
  }

  // Expand URL
  console.log('   🔗 Expanding URL...');
  const expandedUrl = await expandGbpUrl(loc.gbpUrl);
  
  // Build search keyword
  const keyword = `${loc.companyName} ${loc.city} ${loc.state}`;
  console.log(`   🔍 Searching: "${keyword}"`);
  
  // Search DataForSEO
  const items = await searchDataForSEO(keyword);
  console.log(`   📊 Found ${items.length} results`);
  
  // Find childcare match
  const match = items.find(isChildcareMatch);
  
  if (!match) {
    console.log('   ❌ SKIP - No childcare match found');
    return { skipped: true, reason: 'no_childcare_match' };
  }

  console.log(`   ✅ Match: ${match.title} (${match.category})`);
  console.log(`   📍 Address: ${match.address}`);
  
  // Build snapshot
  const snapshot = {
    placeId: match.place_id,
    cid: match.cid?.toString(),
    rating: match.rating?.value,
    reviewCount: match.rating?.votes_count,
    ratingDistribution: match.rating?.rating_distribution,
    totalPhotos: match.total_photos,
    isClaimed: match.is_claimed,
    hours: parseHours(match.work_time),
    phone: match.phone,
    address: match.address,
    addressInfo: match.address_info || null,
    website: match.url,
    latitude: match.latitude,
    longitude: match.longitude,
    primaryCategory: match.category,
    additionalCategories: match.additional_categories || [],
    mainImage: match.main_image,
    keyword,
    resolvedAt: new Date().toISOString(),
    autoChecks: {
      isClaimed: match.is_claimed,
      ratingAbove4: (match.rating?.value || 0) >= 4,
      has50Reviews: (match.rating?.votes_count || 0) >= 50,
      phoneListened: !!match.phone,
      websiteLinked: !!match.url,
      hoursComplete: !!(match.work_time?.timetable),
      secondaryCategoriesSet: !!(match.additional_categories?.length)
    }
  };

  // Get location ID from database
  const idQuery = `
    SELECT id FROM "GBPLocation"
    WHERE "clientAcronym" = $1 
    AND "locationName" = $2
    LIMIT 1
  `;
  const idResult = await pool.query(idQuery, [loc.acronym, loc.locationName]);
  
  if (idResult.rows.length === 0) {
    console.log('   ⚠️  Location not found in database');
    return { skipped: true, reason: 'not_in_db' };
  }

  const locationId = idResult.rows[0].id;

  // Update database - use ON CONFLICT to handle duplicate placeIds
  // We want to update THIS specific location even if another location already has this placeId
  const updateQuery = `
    UPDATE "GBPLocation"
    SET 
      "liveDataSnapshot" = $1,
      "liveDataUpdatedAt" = NOW(),
      cid = $2,
      latitude = $3,
      longitude = $4,
      address = $5,
      city = $6,
      state = $7,
      "locationVerified" = true
    WHERE id = $8
  `;

  // Extract city/state from address_info if available
  const city = match.address_info?.city || loc.city;
  const state = match.address_info?.region || loc.state;

  await pool.query(updateQuery, [
    JSON.stringify(snapshot),
    match.cid?.toString(),
    match.latitude,
    match.longitude,
    match.address,
    city,
    state,
    locationId
  ]);

  console.log('   💾 Updated successfully');
  
  return { 
    success: true, 
    acronym: loc.acronym,
    locationName: loc.locationName,
    address: match.address
  };
}

async function main() {
  console.log('🚀 Starting GBP Location Fix Script\n');
  console.log('Reading locations from /tmp/gbp_fixable.json...\n');

  const fs = require('fs');
  const locations = JSON.parse(fs.readFileSync('/tmp/gbp_fixable.json', 'utf8'));
  
  console.log(`Found ${locations.length} locations to process\n`);
  console.log('⚠️  Rate limit: 500ms between calls, max 200 calls\n');

  const results = {
    success: [],
    skipped: [],
    errors: []
  };

  let callCount = 0;
  const maxCalls = 200;

  for (const loc of locations) {
    if (callCount >= maxCalls) {
      console.log('\n⚠️  Reached maximum call limit (200)');
      break;
    }

    try {
      const result = await processLocation(loc);
      
      if (result.success) {
        results.success.push(result);
      } else if (result.skipped) {
        results.skipped.push({
          ...loc,
          reason: result.reason
        });
      }

      callCount++;
      
      // Rate limiting - 500ms between calls
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (err) {
      console.log(`   ❌ ERROR: ${err.message}`);
      results.errors.push({
        ...loc,
        error: err.message
      });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 FINAL REPORT');
  console.log('='.repeat(60));
  console.log(`✅ Successfully fixed: ${results.success.length}`);
  console.log(`⏭️  Skipped: ${results.skipped.length}`);
  console.log(`❌ Errors: ${results.errors.length}`);
  console.log(`📞 DataForSEO API calls: ${callCount}`);
  console.log(`💰 Estimated cost: $${(callCount * 0.02).toFixed(2)}`);
  
  if (results.success.length > 0) {
    console.log('\n✅ Successfully Fixed:');
    results.success.forEach(r => {
      console.log(`   - ${r.acronym} / ${r.locationName}`);
      console.log(`     ${r.address}`);
    });
  }

  if (results.skipped.length > 0) {
    console.log('\n⏭️  Skipped Locations:');
    const skipReasons = {};
    results.skipped.forEach(s => {
      skipReasons[s.reason] = (skipReasons[s.reason] || 0) + 1;
    });
    Object.entries(skipReasons).forEach(([reason, count]) => {
      console.log(`   - ${reason}: ${count}`);
    });
  }

  // Affected clients
  const affectedClients = [...new Set(results.success.map(r => r.acronym))];
  console.log(`\n🏢 Clients benefited: ${affectedClients.length}`);
  if (affectedClients.length > 0) {
    console.log(`   ${affectedClients.join(', ')}`);
  }

  await pool.end();
  console.log('\n✅ Done!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
