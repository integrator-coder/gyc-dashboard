#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');

const prisma = new PrismaClient();

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

if (!GOOGLE_PLACES_API_KEY) {
  console.error('❌ GOOGLE_PLACES_API_KEY not found in .env.local');
  process.exit(1);
}

// GKLC locations with their correct gbpUrl values
const GKLC_LOCATIONS = [
  { id: 332, name: 'Ireland Road in South Bend', gbpUrl: 'https://maps.app.goo.gl/Ry5thoNWMoha7j1v5' },
  { id: 333, name: 'State Road 23 in South Bend', gbpUrl: 'https://maps.app.goo.gl/NnafQ3Sva1evRSpo7' },
  { id: 334, name: 'Bendix Drive in South Bend', gbpUrl: 'https://maps.app.goo.gl/sLZoYTCPFo8qk6dS8' },
  { id: 335, name: 'Bristol Street in Elkhart', gbpUrl: 'https://maps.app.goo.gl/mSpuoczT4xUBoeQF7' },
  { id: 336, name: 'Elkhart Road in Goshen', gbpUrl: 'https://maps.app.goo.gl/2eemf48uJXoMmzMJ6' },
  { id: 337, name: 'Campbell Street in Valparaiso', gbpUrl: 'https://maps.app.goo.gl/8uyYQnC4Afgtwozm6' },
  { id: 338, name: '11th Street in Chesterton', gbpUrl: 'https://maps.app.goo.gl/TmnxByJSCYcMLMFDA' },
  { id: 339, name: 'Miller Drive in Plymouth', gbpUrl: 'https://maps.app.goo.gl/Cac9hoy6akuT32TEA' },
  { id: 340, name: 'E 200 North in Warsaw', gbpUrl: 'https://maps.app.goo.gl/DwZZ2M9TvUEfLuap6' },
  { id: 341, name: 'Eastport Centre in Valparaiso', gbpUrl: 'https://maps.app.goo.gl/QJPF7oWhGu4c6HFXA' }
];

// Childcare-related category keywords
const VALID_CATEGORY_KEYWORDS = [
  'childcare', 'child_care', 'daycare', 'day_care', 'preschool', 'pre_school',
  'kindergarten', 'nursery', 'learning_center', 'school', 'education'
];

function expandGbpUrl(shortUrl) {
  try {
    const command = `curl -L --max-redirs 5 -o /dev/null -s -w "%{url_effective}" "${shortUrl}"`;
    const expandedUrl = execSync(command, { encoding: 'utf8' }).trim();
    console.log(`   Expanded: ${expandedUrl}`);
    return expandedUrl;
  } catch (error) {
    console.error(`   ❌ Error expanding URL: ${error.message}`);
    return null;
  }
}

function extractPlaceId(url) {
  // Try to extract placeId from URL patterns:
  // 1. /maps/place/... with place_id parameter
  // 2. Encoded Google Place ID in the path (16s%2Fg%2F... format)
  // 3. /maps/place/... with CID parameter
  // 4. Hex-encoded in the data parameter (1s value)
  
  // Check for place_id parameter
  const placeIdMatch = url.match(/[?&]place_id=([^&]+)/);
  if (placeIdMatch) {
    return { type: 'placeId', value: placeIdMatch[1] };
  }
  
  // Check for encoded Google Place ID in 16s parameter (format: 16s%2Fg%2F...)
  // Example: 16s%2Fg%2F1td13wms decodes to: 16s/g/1td13wms
  // The actual place ID needs to be looked up via the Google shortlink
  const encodedGMatch = url.match(/16s%2Fg%2F([a-zA-Z0-9_-]+)/);
  if (encodedGMatch) {
    // This is a Google Knowledge Graph ID, not a Place ID
    // We'll need to use the CID approach instead
  }
  
  // Check for CID parameter
  const cidMatch = url.match(/[?&]cid=(\d+)/);
  if (cidMatch) {
    return { type: 'cid', value: cidMatch[1] };
  }
  
  // Check for hex-encoded placeId in data parameter (format: 1s0x...:0x...)
  // Example: 1s0x8816cc62ba9b2863:0x139d7a8e4c80ae92
  const hexMatch = url.match(/1s(0x[0-9a-f]+:0x[0-9a-f]+)/);
  if (hexMatch) {
    // Convert hex coordinates to placeId format
    // The 1s parameter is actually the CID in hex format
    const hexValue = hexMatch[1];
    const parts = hexValue.split(':');
    if (parts.length === 2) {
      // The second part (after :) is the actual CID in hex
      const cidHex = parts[1];
      const cid = parseInt(cidHex, 16).toString();
      return { type: 'cid', value: cid };
    }
  }
  
  return null;
}

async function cidToPlaceId(cid) {
  // Use the old Places API to look up by CID
  const url = `https://maps.googleapis.com/maps/api/place/details/json?cid=${cid}&key=${GOOGLE_PLACES_API_KEY}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Places API error: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  
  if (data.status !== 'OK' || !data.result || !data.result.place_id) {
    throw new Error(`Could not resolve CID to placeId: ${data.status}`);
  }
  
  return data.result.place_id;
}

async function getPlaceDetails(placeId) {
  const url = `https://places.googleapis.com/v1/places/${placeId}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,rating,userRatingCount,primaryType,types'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Places API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

function isValidChildcareBusiness(place) {
  const businessName = place.displayName?.text || place.name || '';
  const primaryType = place.primaryType || '';
  const types = place.types || [];
  
  // Must contain "Growing Kids" in the name
  const hasValidName = /growing\s*kids/i.test(businessName);
  
  // Must have a childcare-related category
  const allTypes = [primaryType, ...types].join(' ').toLowerCase();
  const hasValidCategory = VALID_CATEGORY_KEYWORDS.some(keyword => 
    allTypes.includes(keyword)
  );
  
  return hasValidName && hasValidCategory;
}

async function resolveLocation(location) {
  console.log(`\n🔍 Resolving: ${location.name} (ID: ${location.id})`);
  console.log(`   Short URL: ${location.gbpUrl}`);
  
  // Step 1: Expand the short URL
  const expandedUrl = expandGbpUrl(location.gbpUrl);
  if (!expandedUrl) {
    return null;
  }
  
  // Step 2: Extract placeId or CID
  const extracted = extractPlaceId(expandedUrl);
  if (!extracted) {
    console.log(`   ❌ Could not extract placeId or CID from URL`);
    return null;
  }
  
  console.log(`   Extracted ${extracted.type}: ${extracted.value}`);
  
  // Step 3: Convert CID to placeId if needed
  let placeId = extracted.value;
  
  if (extracted.type === 'cid') {
    console.log(`   🔄 Converting CID to placeId...`);
    try {
      placeId = await cidToPlaceId(extracted.value);
      console.log(`   ✓ Resolved placeId: ${placeId}`);
    } catch (error) {
      console.log(`   ❌ Failed to convert CID to placeId: ${error.message}`);
      return null;
    }
  }
  
  try {
    const place = await getPlaceDetails(placeId);
    
    // Step 4: Validate the result
    if (!isValidChildcareBusiness(place)) {
      console.log(`   ❌ Place does not match validation criteria`);
      console.log(`      Name: ${place.displayName?.text || 'N/A'}`);
      console.log(`      Type: ${place.primaryType || 'N/A'}`);
      return null;
    }
    
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
  } catch (error) {
    console.error(`   ❌ Error fetching place details: ${error.message}`);
    return null;
  }
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
  console.log('🚀 Starting GKLC GBP location fix (URL expansion method)...\n');
  
  let resolvedCount = 0;
  let unresolvedLocations = [];
  const results = [];
  
  for (const location of GKLC_LOCATIONS) {
    try {
      const placeData = await resolveLocation(location);
      
      if (placeData && !placeData.needsManualLookup) {
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
        unresolvedLocations.push({ ...location, reason: placeData?.needsManualLookup ? 'CID only' : 'Failed to resolve' });
        results.push({
          id: location.id,
          name: location.name,
          resolved: false,
          reason: placeData?.needsManualLookup ? 'CID only' : 'Failed to resolve'
        });
      }
      
      // Rate limiting - wait 200ms between requests
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.error(`   ❌ Error processing ${location.name}:`, error.message);
      unresolvedLocations.push({ ...location, reason: error.message });
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
    console.log('\n❌ Unresolved locations:');
    unresolvedLocations.forEach(loc => {
      console.log(`   • ${loc.name} (ID: ${loc.id})`);
      console.log(`     Reason: ${loc.reason}`);
      console.log(`     URL: ${loc.gbpUrl}`);
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
