#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

if (!GOOGLE_PLACES_API_KEY) {
  console.error('❌ GOOGLE_PLACES_API_KEY not found in .env.local');
  process.exit(1);
}

// GKLC locations to fix
const GKLC_LOCATIONS = [
  { id: 332, name: 'Ireland Road in South Bend', city: 'South Bend', address: '17850 Ireland Rd, South Bend, IN 46614' },
  { id: 333, name: 'State Road 23 in South Bend', city: 'South Bend', address: '17475 IN-23, South Bend, IN 46635' },
  { id: 334, name: 'Bendix Drive in South Bend', city: 'South Bend', address: '2601 N Bendix Dr, South Bend, IN 46628' },
  { id: 335, name: 'Bristol Street in Elkhart', city: 'Elkhart', address: '825 W Bristol St, Elkhart, IN 46514' },
  { id: 336, name: 'Elkhart Road in Goshen', city: 'Goshen', address: '3212 Elkhart Rd, Goshen, IN 46526' },
  { id: 337, name: 'Campbell Street in Valparaiso', city: 'Valparaiso', address: '3400 N Campbell St, Valparaiso, IN 46385' },
  { id: 338, name: '11th Street in Chesterton', city: 'Chesterton', address: '1828 S 11th St, Chesterton, IN 46304' },
  { id: 339, name: 'Miller Drive in Plymouth', city: 'Plymouth', address: '2680 Miller Dr #110, Plymouth, IN 46563' },
  { id: 340, name: 'E 200 North in Warsaw', city: 'Warsaw', address: '298 E 200 N, Warsaw, IN 46582' },
  { id: 341, name: 'Eastport Centre in Valparaiso', city: 'Valparaiso', address: '751 Eastport Center Dr, Valparaiso, IN 46383' }
];

// Childcare-related category keywords
const VALID_CATEGORY_KEYWORDS = [
  'childcare', 'child_care', 'daycare', 'day_care', 'preschool', 'pre_school',
  'kindergarten', 'nursery', 'learning_center', 'school', 'education'
];

function isValidChildcareBusiness(place) {
  const businessName = place.displayName?.text || place.name || '';
  const category = place.primaryType || '';
  
  // Must contain "Growing Kids" or "Kidstown" in the name
  const hasValidName = /growing\s*kids|kidstown/i.test(businessName);
  
  // Must have a childcare-related category
  const hasValidCategory = VALID_CATEGORY_KEYWORDS.some(keyword => 
    category.toLowerCase().includes(keyword)
  );
  
  return hasValidName && hasValidCategory;
}

async function searchGooglePlaces(query) {
  const url = new URL('https://places.googleapis.com/v1/places:searchText');
  
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.primaryType'
    },
    body: JSON.stringify({ textQuery: query })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Places API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.places || [];
}

async function resolveLocation(location) {
  console.log(`\n🔍 Resolving: ${location.name} (ID: ${location.id})`);
  
  // Try with full address first
  const query1 = `"Growing Kids Learning Centers" ${location.address}`;
  console.log(`   Query: ${query1}`);
  
  let places = await searchGooglePlaces(query1);
  
  // If no results, try with city fallback
  if (!places || places.length === 0) {
    const query2 = `"Growing Kids" childcare ${location.city} IN`;
    console.log(`   Fallback query: ${query2}`);
    places = await searchGooglePlaces(query2);
  }
  
  if (!places || places.length === 0) {
    console.log(`   ❌ No results found`);
    return null;
  }
  
  // Find the first valid childcare business
  for (const place of places) {
    if (isValidChildcareBusiness(place)) {
      const placeId = place.id;
      const name = place.displayName?.text || place.name;
      const address = place.formattedAddress;
      const lat = place.location?.latitude;
      const lng = place.location?.longitude;
      const rating = place.rating || null;
      const reviewCount = place.userRatingCount || null;
      const category = place.primaryType || '';
      
      console.log(`   ✅ Found: ${name}`);
      console.log(`      Place ID: ${placeId}`);
      console.log(`      Address: ${address}`);
      console.log(`      Category: ${category}`);
      console.log(`      Rating: ${rating} (${reviewCount} reviews)`);
      
      return {
        placeId,
        name,
        address,
        lat,
        lng,
        rating,
        reviewCount,
        category
      };
    }
  }
  
  console.log(`   ❌ No valid childcare business found in results`);
  console.log(`      (Found ${places.length} result(s) but none matched validation)`);
  return null;
}

async function updateLocation(locationId, placeData) {
  const liveDataSnapshot = {
    placeId: placeData.placeId,
    displayName: placeData.name,
    formattedAddress: placeData.address,
    location: placeData.lat && placeData.lng ? {
      latitude: placeData.lat,
      longitude: placeData.lng
    } : null,
    rating: placeData.rating,
    userRatingCount: placeData.reviewCount,
    primaryType: placeData.category,
    lastUpdated: new Date().toISOString()
  };
  
  await prisma.gBPLocation.update({
    where: { id: locationId },
    data: {
      placeId: placeData.placeId,
      liveDataSnapshot: liveDataSnapshot
    }
  });
  
  console.log(`   💾 Updated DB record ${locationId}`);
}

async function main() {
  console.log('🚀 Starting GKLC GBP location fix...\n');
  
  let resolvedCount = 0;
  let unresolvedLocations = [];
  const results = [];
  
  for (const location of GKLC_LOCATIONS) {
    try {
      const placeData = await resolveLocation(location);
      
      if (placeData) {
        await updateLocation(location.id, placeData);
        resolvedCount++;
        results.push({
          id: location.id,
          name: location.name,
          placeId: placeData.placeId,
          rating: placeData.rating,
          reviewCount: placeData.reviewCount,
          resolved: true
        });
      } else {
        unresolvedLocations.push(location);
        results.push({
          id: location.id,
          name: location.name,
          resolved: false
        });
      }
      
      // Rate limiting - wait 200ms between requests
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.error(`   ❌ Error processing ${location.name}:`, error.message);
      unresolvedLocations.push(location);
      results.push({
        id: location.id,
        name: location.name,
        resolved: false,
        error: error.message
      });
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Resolved: ${resolvedCount}/${GKLC_LOCATIONS.length}`);
  console.log(`❌ Unresolved: ${unresolvedLocations.length}`);
  
  if (resolvedCount > 0) {
    console.log('\n✅ Successfully resolved locations:');
    results.filter(r => r.resolved).forEach(r => {
      console.log(`   • ${r.name} (ID: ${r.id})`);
      console.log(`     Place ID: ${r.placeId}`);
      console.log(`     Rating: ${r.rating || 'N/A'} (${r.reviewCount || 0} reviews)`);
    });
  }
  
  if (unresolvedLocations.length > 0) {
    console.log('\n❌ Unresolved locations (need manual lookup):');
    unresolvedLocations.forEach(loc => {
      console.log(`   • ${loc.name} (ID: ${loc.id})`);
      console.log(`     Address: ${loc.address}`);
    });
  }
  
  console.log('\n✅ GKLC GBP location fix complete!');
}

main()
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
