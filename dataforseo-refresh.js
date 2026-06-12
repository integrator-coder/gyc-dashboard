const { Pool } = require('pg');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN;
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD;

const results = {
  success: [],
  skipped: [],
  errors: []
};

async function searchDataForSEO(companyName, city, state) {
  const searchQuery = `${companyName} ${city} ${state}`;
  
  console.log(`  Searching: "${searchQuery}"`);
  
  const auth = Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64');
  
  try {
    const response = await axios.post(
      'https://api.dataforseo.com/v3/business_data/google/my_business_info/live',
      [{
        keyword: searchQuery,
        location_code: 2840, // United States
        language_code: 'en'
      }],
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.data?.tasks?.[0]?.result?.[0]?.items) {
      console.log('  ⚠️  No results from DataForSEO');
      return null;
    }
    
    const items = response.data.tasks[0].result[0].items;
    
    // Find the best match - look for childcare related categories
    const childcareKeywords = [
      'child care', 'childcare', 'daycare', 'day care', 'preschool', 
      'pre-school', 'learning center', 'academy', 'early learning',
      'kindergarten', 'nursery school'
    ];
    
    for (const item of items) {
      const categories = (item.category || '').toLowerCase();
      const title = (item.title || '').toLowerCase();
      
      const isChildcare = childcareKeywords.some(keyword => 
        categories.includes(keyword) || title.includes(keyword)
      );
      
      if (isChildcare) {
        console.log(`  ✓ Found childcare match: ${item.title}`);
        return item;
      }
    }
    
    // If no clear childcare match, return first result but warn
    console.log(`  ⚠️  No childcare-specific match, using first result: ${items[0].title}`);
    return items[0];
    
  } catch (error) {
    console.error(`  ❌ DataForSEO API error:`, error.message);
    return null;
  }
}

async function refreshLocations() {
  console.log('=== DataForSEO Refresh for Locations ===\n');
  
  // Get locations needing refresh
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
  
  const locationsResult = await pool.query(query);
  
  console.log(`Found ${locationsResult.rows.length} location(s) to process\n`);
  
  for (const location of locationsResult.rows) {
    console.log(`\n${location.clientAcronym} - ${location.locationName || 'Main'}`);
    
    if (!location.companyName || !location.city || !location.state) {
      console.log('  ⚠️  Missing company name, city, or state - skipping');
      results.skipped.push({
        acronym: location.clientAcronym,
        reason: 'Missing search parameters'
      });
      continue;
    }
    
    const data = await searchDataForSEO(location.companyName, location.city, location.state);
    
    if (!data) {
      results.errors.push({
        acronym: location.clientAcronym,
        error: 'No DataForSEO results'
      });
      continue;
    }
    
    // Build the snapshot
    const snapshot = {
      title: data.title || null,
      category: data.category || null,
      phone: data.phone || null,
      website: data.domain || null,
      rating: data.rating?.value || null,
      reviewCount: data.rating?.votes_count || null,
      addressInfo: {
        street: data.address || null,
        city: data.address_info?.city || null,
        state: data.address_info?.region || null,
        zip: data.address_info?.zip || null,
        country: data.address_info?.country || null
      },
      hours: data.work_hours || null,
      fetchedAt: new Date().toISOString()
    };
    
    // Update the location
    const updateQuery = `
      UPDATE "GBPLocation"
      SET 
        address = COALESCE(address, $1),
        "liveDataSnapshot" = $2,
        "liveDataUpdatedAt" = NOW()
      WHERE id = $3
      RETURNING "clientAcronym", "locationName"
    `;
    
    const address = data.address || 
      [snapshot.addressInfo.street, snapshot.addressInfo.city, snapshot.addressInfo.state, snapshot.addressInfo.zip]
        .filter(Boolean)
        .join(', ');
    
    await pool.query(updateQuery, [
      address,
      JSON.stringify(snapshot),
      location.id
    ]);
    
    console.log(`  ✓ Updated with DataForSEO data`);
    console.log(`     Address: ${address}`);
    console.log(`     Category: ${snapshot.category}`);
    
    results.success.push({
      acronym: location.clientAcronym,
      locationName: location.locationName,
      category: snapshot.category
    });
    
    // Rate limit: wait 1 second between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Final report
  console.log('\n=== DataForSEO Refresh Complete ===');
  console.log(`Successfully updated: ${results.success.length}`);
  console.log(`Skipped: ${results.skipped.length}`);
  console.log(`Errors: ${results.errors.length}`);
  
  if (results.skipped.length > 0) {
    console.log('\nSkipped:');
    results.skipped.forEach(item => {
      console.log(`  ${item.acronym}: ${item.reason}`);
    });
  }
  
  if (results.errors.length > 0) {
    console.log('\nErrors:');
    results.errors.forEach(item => {
      console.log(`  ${item.acronym}: ${item.error}`);
    });
  }
}

async function main() {
  try {
    await refreshLocations();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
