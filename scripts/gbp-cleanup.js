require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || 'AIzaSyDKM9KUt45sL0SfoPAZu8DoktXsAIGI_5U';

const report = {
  duplicatesDeactivated: 0,
  autoVerified: 0,
  verifiedViaPlacesAPI: 0,
  needsManualReview: [],
  errors: []
};

async function findDuplicates() {
  console.log('\n=== STEP 1: Finding Duplicates ===\n');
  
  const duplicates = await prisma.$queryRaw`
    SELECT "clientAcronym", "locationName", COUNT(*) as cnt, array_agg(id) as ids
    FROM "GBPLocation"
    WHERE "isActive" = true
    GROUP BY "clientAcronym", "locationName"
    HAVING COUNT(*) > 1
    ORDER BY "clientAcronym", "locationName"
  `;
  
  console.log(`Found ${duplicates.length} duplicate groups`);
  
  for (const dup of duplicates) {
    console.log(`\nProcessing duplicates for ${dup.clientAcronym} - ${dup.locationName}`);
    
    // Get full records for these IDs
    const records = await prisma.gBPLocation.findMany({
      where: { id: { in: dup.ids } },
      orderBy: { id: 'desc' }
    });
    
    // Score each record
    const scored = records.map(r => {
      let score = 0;
      if (r.liveDataSnapshot?.latitude) score += 1000;
      if (r.locationVerified) score += 100;
      if (r.gbpPlaceId) score += 10;
      score += r.id * 0.001; // Tie-breaker for most recent
      return { record: r, score };
    });
    
    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);
    
    // Keep the best, deactivate the rest
    const best = scored[0].record;
    const toDeactivate = scored.slice(1).map(s => s.record);
    
    console.log(`  Keeping ID ${best.id} (score: ${scored[0].score.toFixed(3)})`);
    
    for (const record of toDeactivate) {
      console.log(`  Deactivating ID ${record.id}`);
      await prisma.gBPLocation.update({
        where: { id: record.id },
        data: { isActive: false }
      });
      report.duplicatesDeactivated++;
    }
  }
  
  console.log(`\nDeactivated ${report.duplicatesDeactivated} duplicate records\n`);
}

async function autoVerifyWithCoordinates() {
  console.log('\n=== STEP 2: Auto-Verify Locations with Coordinates ===\n');
  
  const result = await prisma.$executeRaw`
    UPDATE "GBPLocation"
    SET "locationVerified" = true
    WHERE "isActive" = true
      AND "locationVerified" = false
      AND (("liveDataSnapshot"->>'latitude') IS NOT NULL)
      AND "clientAcronym" IN (
        SELECT acronym FROM "ClientProfile" WHERE "hasSEO" = true AND status = 'active'
      )
  `;
  
  report.autoVerified = Number(result);
  console.log(`Auto-verified ${report.autoVerified} locations with valid coordinates\n`);
}

async function verifyViaPlacesAPI() {
  console.log('\n=== STEP 3: Verify Remaining via Google Places API ===\n');
  
  const unverified = await prisma.gBPLocation.findMany({
    where: {
      isActive: true,
      locationVerified: false,
      clientAcronym: {
        in: (await prisma.clientProfile.findMany({
          where: { hasSEO: true, status: 'active' },
          select: { acronym: true }
        })).map(c => c.acronym)
      }
    }
  });
  
  console.log(`Found ${unverified.length} unverified locations to process\n`);
  
  for (const location of unverified) {
    console.log(`Processing: ${location.locationName} (${location.clientAcronym})`);
    
    // Skip CPC Alvarado if missing address
    if (location.clientAcronym === 'CPC' && location.locationName.includes('Alvarado') && !location.address) {
      console.log('  ⚠️  Skipping CPC Alvarado - missing address');
      report.needsManualReview.push({
        id: location.id,
        name: location.locationName,
        acronym: location.clientAcronym,
        reason: 'Missing address'
      });
      continue;
    }
    
    // Build search query
    const query = [
      location.locationName,
      location.city,
      location.state
    ].filter(Boolean).join(' ');
    
    if (!query || query.trim().length < 5) {
      console.log('  ⚠️  Insufficient data to search');
      report.needsManualReview.push({
        id: location.id,
        name: location.locationName,
        acronym: location.clientAcronym,
        reason: 'Insufficient search data'
      });
      continue;
    }
    
    try {
      const response = await axios.get('https://maps.googleapis.com/maps/api/place/textsearch/json', {
        params: {
          query,
          key: GOOGLE_PLACES_API_KEY
        }
      });
      
      if (response.data.status !== 'OK' || !response.data.results || response.data.results.length === 0) {
        console.log(`  ⚠️  No results found`);
        report.needsManualReview.push({
          id: location.id,
          name: location.locationName,
          acronym: location.clientAcronym,
          reason: 'No Places API results'
        });
        continue;
      }
      
      const place = response.data.results[0];
      
      // Check if this looks like a reasonable match
      const nameSimilar = place.name.toLowerCase().includes(location.locationName.toLowerCase().split(' ')[0]) ||
                         location.locationName.toLowerCase().includes(place.name.toLowerCase().split(' ')[0]);
      
      if (!nameSimilar) {
        console.log(`  ⚠️  Name mismatch: "${place.name}" vs "${location.locationName}"`);
        report.needsManualReview.push({
          id: location.id,
          name: location.locationName,
          acronym: location.clientAcronym,
          reason: `Name mismatch: got "${place.name}"`,
          placeData: place
        });
        continue;
      }
      
      // Good match - update the location
      console.log(`  ✓ Match found: ${place.name} (${place.place_id})`);
      
      await prisma.gBPLocation.update({
        where: { id: location.id },
        data: {
          liveDataSnapshot: {
            ...location.liveDataSnapshot,
            latitude: place.geometry.location.lat,
            longitude: place.geometry.location.lng,
            place_id: place.place_id,
            formatted_address: place.formatted_address
          },
          placeId: place.place_id,
          gbpPlaceId: place.place_id,
          locationVerified: true
        }
      });
      
      report.verifiedViaPlacesAPI++;
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
      report.errors.push({
        id: location.id,
        name: location.locationName,
        acronym: location.clientAcronym,
        error: error.message
      });
    }
  }
  
  console.log(`\nVerified ${report.verifiedViaPlacesAPI} locations via Places API\n`);
}

async function main() {
  try {
    await findDuplicates();
    await autoVerifyWithCoordinates();
    await verifyViaPlacesAPI();
    
    console.log('\n=== CLEANUP COMPLETE ===\n');
    console.log('Summary:');
    console.log(`  Duplicates deactivated: ${report.duplicatesDeactivated}`);
    console.log(`  Auto-verified (had coordinates): ${report.autoVerified}`);
    console.log(`  Verified via Places API: ${report.verifiedViaPlacesAPI}`);
    console.log(`  Need manual review: ${report.needsManualReview.length}`);
    console.log(`  Errors: ${report.errors.length}`);
    
    if (report.needsManualReview.length > 0) {
      console.log('\nLocations needing manual review:');
      report.needsManualReview.forEach(l => {
        console.log(`  - ${l.acronym}: ${l.name} (ID ${l.id}) - ${l.reason}`);
      });
    }
    
    if (report.errors.length > 0) {
      console.log('\nErrors encountered:');
      report.errors.forEach(e => {
        console.log(`  - ${e.acronym}: ${e.name} (ID ${e.id}) - ${e.error}`);
      });
    }
    
    // Save full report
    const fs = require('fs');
    fs.writeFileSync(
      'gbp-cleanup-report.json',
      JSON.stringify(report, null, 2)
    );
    console.log('\nFull report saved to: gbp-cleanup-report.json\n');
    
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
