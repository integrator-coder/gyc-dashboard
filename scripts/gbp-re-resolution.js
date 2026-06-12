#!/usr/bin/env node

/**
 * GBP Re-Resolution Script
 * Fixes locations with:
 * - Wrong business category (not childcare-related)
 * - Missing address/zip data
 */

require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const { execSync } = require('child_process');

const prisma = new PrismaClient();

const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN;
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD;
const DATAFORSEO_AUTH = Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64');

const CHILDCARE_KEYWORDS = [
  'child', 'daycare', 'day care', 'preschool', 'nursery',
  'kindergarten', 'learning', 'academy', 'school', 'montessori', 'kids'
];

let callCount = 0;
const MAX_CALLS = 200;
const DELAY_MS = 500;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function isChildcareCategory(category) {
  if (!category) return false;
  const lower = category.toLowerCase();
  return CHILDCARE_KEYWORDS.some(kw => lower.includes(kw));
}

function extractCIDFromUrl(expandedUrl) {
  // Pattern: !1s0xKEY:0xCID
  const match = expandedUrl.match(/!1s0x[a-f0-9]+:0x([a-f0-9]+)/i);
  if (!match) return null;
  
  const hexCID = match[1];
  const decimalCID = BigInt('0x' + hexCID).toString();
  return decimalCID;
}

async function expandShortUrl(shortUrl) {
  try {
    const result = execSync(
      `curl -sL --max-redirs 10 -o /dev/null -w "%{url_effective}" "${shortUrl}"`,
      { encoding: 'utf8', timeout: 10000 }
    );
    return result.trim();
  } catch (error) {
    console.error(`Failed to expand URL ${shortUrl}:`, error.message);
    return null;
  }
}

async function searchDataForSEO(keyword) {
  if (callCount >= MAX_CALLS) {
    throw new Error(`Reached maximum DataForSEO call limit (${MAX_CALLS})`);
  }
  
  await sleep(DELAY_MS);
  callCount++;
  
  const payload = [{
    keyword: keyword,
    location_code: 2840,
    language_code: "en",
    depth: 10
  }];
  
  try {
    const response = await axios.post(
      'https://api.dataforseo.com/v3/serp/google/maps/live/advanced',
      payload,
      {
        headers: {
          'Authorization': `Basic ${DATAFORSEO_AUTH}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );
    
    if (response.data?.tasks?.[0]?.result?.[0]?.items) {
      return response.data.tasks[0].result[0].items;
    }
    return [];
  } catch (error) {
    console.error(`DataForSEO search failed for "${keyword}":`, error.message);
    return [];
  }
}

function findMatchingResult(results, targetCID, companyName) {
  // First try exact CID match
  if (targetCID) {
    const exactMatch = results.find(r => r.cid === targetCID);
    if (exactMatch) return exactMatch;
  }
  
  // Fallback to name match with childcare category
  const nameLower = companyName.toLowerCase();
  return results.find(r => {
    const titleMatch = r.title?.toLowerCase().includes(nameLower);
    const categoryMatch = isChildcareCategory(r.category);
    return titleMatch && categoryMatch;
  });
}

async function processWrongCategory() {
  console.log('\n=== BATCH A: Wrong Category ===\n');
  
  const locations = await prisma.$queryRaw`
    SELECT gl.id, gl."clientAcronym", gl."locationName", gl."gbpUrl", gl."gbpPlaceId",
           gl."liveDataSnapshot"->>'primaryCategory' AS category,
           gl."liveDataSnapshot"->>'address' AS bad_address,
           cp."companyName", cp.city, cp.state
    FROM "GBPLocation" gl
    JOIN "ClientProfile" cp ON cp.acronym = gl."clientAcronym"
    WHERE cp.status = 'active'
      AND gl."liveDataSnapshot" IS NOT NULL
      AND gl."gbpUrl" IS NOT NULL AND gl."gbpUrl" != ''
      AND NOT (
        gl."liveDataSnapshot"->>'primaryCategory' ILIKE ANY(
          ARRAY['%child%','%daycare%','%day care%','%preschool%','%nursery%',
                '%kindergarten%','%learning%','%academy%','%school%','%montessori%','%kids%']
        )
      )
    ORDER BY gl."clientAcronym"
  `;
  
  console.log(`Found ${locations.length} locations with wrong category\n`);
  
  const resolved = [];
  const unresolved = [];
  
  for (const loc of locations) {
    console.log(`\nProcessing: ${loc.clientAcronym} - ${loc.locationName}`);
    console.log(`  Current category: ${loc.category}`);
    console.log(`  GBP URL: ${loc.gbpUrl}`);
    
    try {
      // Step 1: Expand URL
      const expandedUrl = await expandShortUrl(loc.gbpUrl);
      if (!expandedUrl) {
        console.log('  ❌ Failed to expand URL');
        unresolved.push({ ...loc, reason: 'URL expansion failed' });
        continue;
      }
      
      // Step 2: Extract CID
      const cid = extractCIDFromUrl(expandedUrl);
      console.log(`  CID: ${cid || 'not found'}`);
      
      // Step 3: DataForSEO search
      const keyword = `"${loc.companyName} ${loc.city} ${loc.state}"`;
      console.log(`  Searching: ${keyword}`);
      const results = await searchDataForSEO(keyword);
      
      if (results.length === 0) {
        console.log('  ❌ No results from DataForSEO');
        unresolved.push({ ...loc, reason: 'No DataForSEO results' });
        continue;
      }
      
      // Step 4: Find and validate match
      const match = findMatchingResult(results, cid, loc.companyName);
      
      if (!match) {
        console.log('  ❌ No matching result found');
        unresolved.push({ ...loc, reason: 'No matching result' });
        continue;
      }
      
      if (!isChildcareCategory(match.category)) {
        console.log(`  ❌ Match found but not childcare category: ${match.category}`);
        unresolved.push({ ...loc, reason: `Not childcare: ${match.category}` });
        continue;
      }
      
      console.log(`  ✅ Valid match: ${match.category}`);
      
      // Step 5: Build snapshot and update
      const snapshot = {
        place_id: match.place_id,
        title: match.title,
        address: match.address,
        rating: match.rating?.value || null,
        reviews_count: match.rating?.votes_count || null,
        primaryCategory: match.category,
        phone: match.phone || null,
        website: match.domain || null,
        cid: match.cid,
        addressInfo: {
          address: match.address_info?.address || match.address || null,
          city: match.address_info?.city || loc.city,
          region: match.address_info?.region || loc.state,
          zip: match.address_info?.zip || null,
          country_code: match.address_info?.country_code || 'US'
        }
      };
      
      // Check if placeId already exists on another location
      const existingPlaceId = await prisma.gBPLocation.findFirst({
        where: {
          placeId: match.place_id,
          id: { not: loc.id }
        },
        select: { id: true, clientAcronym: true, locationName: true }
      });
      
      if (existingPlaceId) {
        console.log(`  ⚠️  PlaceId collision: already used by ${existingPlaceId.clientAcronym} - ${existingPlaceId.locationName}`);
        unresolved.push({ ...loc, reason: `PlaceId collision with ${existingPlaceId.clientAcronym}` });
        continue;
      }
      
      await prisma.gBPLocation.update({
        where: { id: loc.id },
        data: {
          liveDataSnapshot: snapshot,
          liveDataUpdatedAt: new Date(),
          placeId: match.place_id,
          gbpPlaceId: match.place_id,
          cid: match.cid,
          latitude: match.latitude || null,
          longitude: match.longitude || null,
          address: match.address_info?.address || match.address || null,
          city: match.address_info?.city || loc.city,
          state: match.address_info?.region || loc.state,
          locationVerified: true
        }
      });
      
      resolved.push(loc);
      console.log(`  💾 Updated successfully`);
      
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
      unresolved.push({ ...loc, reason: error.message });
    }
  }
  
  return { resolved, unresolved };
}

async function processMissingAddress() {
  console.log('\n=== BATCH B: Missing Address/Zip ===\n');
  
  const locations = await prisma.$queryRaw`
    SELECT gl.id, gl."clientAcronym", gl."locationName", gl."gbpUrl",
           gl.address, gl.city, gl.state,
           gl."liveDataSnapshot"->'addressInfo'->>'zip' AS snap_zip,
           gl."liveDataSnapshot",
           cp."companyName"
    FROM "GBPLocation" gl
    JOIN "ClientProfile" cp ON cp.acronym = gl."clientAcronym"
    WHERE cp.status = 'active'
      AND gl."gbpUrl" IS NOT NULL AND gl."gbpUrl" != ''
      AND (
        gl.address IS NULL
        OR gl."liveDataSnapshot"->'addressInfo'->>'zip' IS NULL
      )
    ORDER BY gl."clientAcronym"
  `;
  
  console.log(`Found ${locations.length} locations with missing address/zip\n`);
  
  const tier1 = []; // Fixed from existing snapshot
  const tier2 = []; // Fixed from URL expansion
  const tier3 = []; // Fixed from DataForSEO
  const unresolved = [];
  
  for (const loc of locations) {
    console.log(`\nProcessing: ${loc.clientAcronym} - ${loc.locationName}`);
    console.log(`  Address: ${loc.address || 'MISSING'}`);
    console.log(`  Zip: ${loc.snap_zip || 'MISSING'}`);
    
    try {
      // Tier 1: Check if snapshot has the data
      const snapshot = loc.liveDataSnapshot;
      if (snapshot?.addressInfo?.address && snapshot?.addressInfo?.zip) {
        console.log('  ✅ Tier 1: Found in existing snapshot');
        
        await prisma.gBPLocation.update({
          where: { id: loc.id },
          data: {
            address: snapshot.addressInfo.address,
            city: snapshot.addressInfo.city || loc.city,
            state: snapshot.addressInfo.region || loc.state
          }
        });
        
        tier1.push(loc);
        console.log(`  💾 Updated from snapshot`);
        continue;
      }
      
      // Tier 2 & 3: Need to fetch fresh data
      const expandedUrl = await expandShortUrl(loc.gbpUrl);
      if (!expandedUrl) {
        console.log('  ❌ Failed to expand URL');
        unresolved.push({ ...loc, reason: 'URL expansion failed' });
        continue;
      }
      
      const cid = extractCIDFromUrl(expandedUrl);
      
      // DataForSEO search
      const keyword = `"${loc.companyName} ${loc.city} ${loc.state}"`;
      console.log(`  Searching: ${keyword}`);
      const results = await searchDataForSEO(keyword);
      
      if (results.length === 0) {
        console.log('  ❌ No results from DataForSEO');
        unresolved.push({ ...loc, reason: 'No DataForSEO results' });
        continue;
      }
      
      const match = findMatchingResult(results, cid, loc.companyName);
      
      if (!match) {
        console.log('  ❌ No matching result found');
        unresolved.push({ ...loc, reason: 'No matching result' });
        continue;
      }
      
      // Validate it's childcare
      if (!isChildcareCategory(match.category)) {
        console.log(`  ⚠️  Warning: Not childcare category: ${match.category}`);
        unresolved.push({ ...loc, reason: `Not childcare: ${match.category}` });
        continue;
      }
      
      console.log(`  ✅ Tier 3: Found via DataForSEO`);
      
      // Build complete snapshot
      const newSnapshot = {
        place_id: match.place_id,
        title: match.title,
        address: match.address,
        rating: match.rating?.value || null,
        reviews_count: match.rating?.votes_count || null,
        primaryCategory: match.category,
        phone: match.phone || null,
        website: match.domain || null,
        cid: match.cid,
        addressInfo: {
          address: match.address_info?.address || match.address || null,
          city: match.address_info?.city || loc.city,
          region: match.address_info?.region || loc.state,
          zip: match.address_info?.zip || null,
          country_code: match.address_info?.country_code || 'US'
        }
      };
      
      // Check if placeId already exists on another location
      const existingPlaceId = await prisma.gBPLocation.findFirst({
        where: {
          placeId: match.place_id,
          id: { not: loc.id }
        },
        select: { id: true, clientAcronym: true, locationName: true }
      });
      
      if (existingPlaceId) {
        console.log(`  ⚠️  PlaceId collision: already used by ${existingPlaceId.clientAcronym} - ${existingPlaceId.locationName}`);
        unresolved.push({ ...loc, reason: `PlaceId collision with ${existingPlaceId.clientAcronym}` });
        continue;
      }
      
      await prisma.gBPLocation.update({
        where: { id: loc.id },
        data: {
          liveDataSnapshot: newSnapshot,
          liveDataUpdatedAt: new Date(),
          placeId: match.place_id,
          gbpPlaceId: match.place_id,
          cid: match.cid,
          latitude: match.latitude || null,
          longitude: match.longitude || null,
          address: match.address_info?.address || match.address || null,
          city: match.address_info?.city || loc.city,
          state: match.address_info?.region || loc.state,
          locationVerified: true
        }
      });
      
      tier3.push(loc);
      console.log(`  💾 Updated successfully`);
      
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
      unresolved.push({ ...loc, reason: error.message });
    }
  }
  
  return { tier1, tier2, tier3, unresolved };
}

async function main() {
  console.log('🚀 Starting GBP Re-Resolution\n');
  console.log(`Max DataForSEO calls: ${MAX_CALLS}`);
  console.log(`Rate limit: ${DELAY_MS}ms between calls\n`);
  
  try {
    // Process Batch A
    const batchA = await processWrongCategory();
    
    // Process Batch B
    const batchB = await processMissingAddress();
    
    // Final Report
    console.log('\n' + '='.repeat(60));
    console.log('📊 FINAL REPORT');
    console.log('='.repeat(60));
    
    console.log('\n📦 BATCH A - Wrong Category:');
    console.log(`  ✅ Resolved: ${batchA.resolved.length}`);
    console.log(`  ❌ Unresolved: ${batchA.unresolved.length}`);
    
    console.log('\n📦 BATCH B - Missing Address/Zip:');
    console.log(`  ✅ Tier 1 (existing snapshot): ${batchB.tier1.length}`);
    console.log(`  ✅ Tier 2 (URL expansion): ${batchB.tier2.length}`);
    console.log(`  ✅ Tier 3 (DataForSEO): ${batchB.tier3.length}`);
    console.log(`  ❌ Unresolved: ${batchB.unresolved.length}`);
    
    console.log(`\n💰 DataForSEO Calls Used: ${callCount} / ${MAX_CALLS}`);
    console.log(`   Estimated cost: $${(callCount * 0.02).toFixed(2)}`);
    
    if (batchA.unresolved.length > 0 || batchB.unresolved.length > 0) {
      console.log('\n⚠️  UNRESOLVED LOCATIONS NEEDING MANUAL ATTENTION:\n');
      
      if (batchA.unresolved.length > 0) {
        console.log('Batch A (Wrong Category):');
        batchA.unresolved.forEach(loc => {
          console.log(`  • ${loc.clientAcronym} - ${loc.locationName}`);
          console.log(`    Reason: ${loc.reason}`);
          console.log(`    URL: ${loc.gbpUrl}\n`);
        });
      }
      
      if (batchB.unresolved.length > 0) {
        console.log('Batch B (Missing Address/Zip):');
        batchB.unresolved.forEach(loc => {
          console.log(`  • ${loc.clientAcronym} - ${loc.locationName}`);
          console.log(`    Reason: ${loc.reason}`);
          console.log(`    URL: ${loc.gbpUrl}\n`);
        });
      }
    }
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
