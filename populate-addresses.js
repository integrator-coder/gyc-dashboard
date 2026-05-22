require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const { google } = require('googleapis');
const path = require('path');

const prisma = new PrismaClient();

// Load service account credentials
const key = require('/Users/toddthejedigmail.com/.openclaw/workspace/google-service-account.json');

const auth = new google.auth.GoogleAuth({
  credentials: key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
});

const sheets = google.sheets({ version: 'v4', auth });

function extractCID(url) {
  if (!url) return null;
  const match = url.match(/[?&]cid=(\d+)/);
  return match ? match[1] : null;
}

function extractCIDFromMapsUrl(url) {
  if (!url) return null;
  // Try cid= parameter
  let match = url.match(/[?&]cid=(\d+)/);
  if (match) return match[1];
  return null;
}

function parseAddress(rawAddress) {
  if (!rawAddress) return { address: null, city: null, state: null };
  
  // Format: "103 Houston School Rd, Red Oak, TX 75154" or 
  //         "1960 S 10th St W, Missoula, MT 59801, United States"
  const parts = rawAddress.split(',').map(p => p.trim());
  
  if (parts.length >= 3) {
    const streetAddress = parts[0];
    const city = parts[1];
    // State + ZIP is usually parts[2]: "TX 75154"
    const stateZip = parts[2].trim();
    const stateMatch = stateZip.match(/^([A-Z]{2})\s+\d{5}/);
    const state = stateMatch ? stateMatch[1] : null;
    return { address: streetAddress, city, state };
  }
  return { address: rawAddress, city: null, state: null };
}

async function main() {
  console.log('Starting address population from Google Sheets...\n');

  // Step 1: Read all rows from spreadsheet
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: '1uZLqNTDWXZ3wbBU7ley-81gj8Kj4h06_Ftd2utE-pjY',
    range: 'Sheet1!A1:J1000'
  });

  const rows = result.data.values || [];
  console.log(`Loaded ${rows.length} rows from spreadsheet\n`);

  // Skip header row
  const dataRows = rows.slice(1);

  let stats = {
    totalRows: 0,
    matchedByCID: 0,
    matchedByName: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    errorDetails: []
  };

  // Process each row
  for (const row of dataRows) {
    stats.totalRows++;
    
    try {
      const acronym = (row[0] || '').trim().toUpperCase();
      const locationName = (row[4] || 'Main').trim();
      const rawAddress = (row[6] || '').trim();
      const gbpLinkUrl = (row[8] || '').trim();
      const fullMapsUrl = (row[5] || '').trim();

      if (!acronym) {
        console.log(`Row ${stats.totalRows}: Skipping - no acronym`);
        stats.skipped++;
        continue;
      }

      // Extract CID
      let cid = extractCID(gbpLinkUrl);
      if (!cid) {
        cid = extractCIDFromMapsUrl(fullMapsUrl);
      }

      // Parse address
      const parsed = parseAddress(rawAddress);

      console.log(`\nProcessing: ${acronym} - ${locationName}`);
      console.log(`  CID: ${cid || 'none'}`);
      console.log(`  Address: ${parsed.address || 'none'}`);
      console.log(`  City: ${parsed.city || 'none'}`);
      console.log(`  State: ${parsed.state || 'none'}`);

      // Try to find existing record
      let existing = null;

      if (cid) {
        existing = await prisma.gBPLocation.findFirst({
          where: { cid: cid }
        });
        if (existing) {
          console.log(`  ✓ Found by CID`);
          stats.matchedByCID++;
        }
      }

      // If not found by CID, try by acronym + locationName
      if (!existing) {
        existing = await prisma.gBPLocation.findFirst({
          where: {
            clientAcronym: acronym,
            locationName: locationName
          }
        });
        if (existing) {
          console.log(`  ✓ Found by name`);
          stats.matchedByName++;
        }
      }

      // Update or create
      if (existing) {
        // Update only if address fields are null
        const needsUpdate = 
          existing.address === null || 
          existing.city === null || 
          existing.state === null;

        if (needsUpdate && parsed.address) {
          const updateData = {};
          if (existing.address === null && parsed.address) updateData.address = parsed.address;
          if (existing.city === null && parsed.city) updateData.city = parsed.city;
          if (existing.state === null && parsed.state) updateData.state = parsed.state;
          if (cid && existing.cid === null) updateData.cid = cid;

          await prisma.gBPLocation.update({
            where: { id: existing.id },
            data: updateData
          });
          console.log(`  → Updated address fields`);
          stats.updated++;
        } else {
          console.log(`  → Already has address data`);
          stats.skipped++;
        }
      } else {
        // Create new record
        if (parsed.address) {
          await prisma.gBPLocation.create({
            data: {
              clientAcronym: acronym,
              locationName: locationName,
              cid: cid,
              address: parsed.address,
              city: parsed.city,
              state: parsed.state
            }
          });
          console.log(`  → Created new record`);
          stats.created++;
        } else {
          console.log(`  → No address data to create`);
          stats.skipped++;
        }
      }
    } catch (error) {
      stats.errors++;
      stats.errorDetails.push({
        row: stats.totalRows,
        error: error.message
      });
      console.error(`  ✗ Error: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total sheet rows processed: ${stats.totalRows}`);
  console.log(`Matched by CID: ${stats.matchedByCID}`);
  console.log(`Matched by name: ${stats.matchedByName}`);
  console.log(`Created new: ${stats.created}`);
  console.log(`Updated addresses: ${stats.updated}`);
  console.log(`Skipped (already had address): ${stats.skipped}`);
  console.log(`Errors: ${stats.errors}`);

  if (stats.errorDetails.length > 0) {
    console.log('\nError details:');
    stats.errorDetails.forEach(e => {
      console.log(`  Row ${e.row}: ${e.error}`);
    });
  }

  // Check for wrong snapshots
  console.log('\n' + '='.repeat(60));
  console.log('CHECKING FOR WRONG SNAPSHOTS');
  console.log('='.repeat(60));

  const wrongSnapshots = await prisma.$queryRaw`
    SELECT id, "clientAcronym", "locationName", 
           "liveDataSnapshot"->>'primaryCategory' as category,
           "liveDataSnapshot"->>'website' as website
    FROM "GBPLocation"
    WHERE "liveDataSnapshot" IS NOT NULL
      AND "liveDataSnapshot"->>'primaryCategory' NOT IN ('Child Care', 'Preschool', 'Childcare Center', 'Day Care Center', 'School')
      AND "liveDataSnapshot"->>'primaryCategory' NOT LIKE '%Child%'
      AND "liveDataSnapshot"->>'primaryCategory' NOT LIKE '%School%'
      AND "liveDataSnapshot"->>'primaryCategory' NOT LIKE '%Education%'
      AND "liveDataSnapshot"->>'primaryCategory' IS NOT NULL
    LIMIT 50
  `;

  console.log(`Potentially wrong snapshots found: ${wrongSnapshots.length}`);
  if (wrongSnapshots.length > 0) {
    console.log('\nRecords with suspicious categories:');
    wrongSnapshots.forEach(snap => {
      console.log(`  ${snap.clientAcronym} - ${snap.locationName}: ${snap.category}`);
      if (snap.website) console.log(`    Website: ${snap.website}`);
    });
  }

  // Check for clients with addresses but no live data
  const missingLiveData = await prisma.$queryRaw`
    SELECT "clientAcronym", "locationName"
    FROM "GBPLocation"
    WHERE address IS NOT NULL
      AND "liveDataSnapshot" IS NULL
  `;

  console.log(`\nClients with addresses but no live GBP data: ${missingLiveData.length}`);
  if (missingLiveData.length > 0 && missingLiveData.length <= 20) {
    console.log('Need DataForSEO sync:');
    missingLiveData.forEach(loc => {
      console.log(`  ${loc.clientAcronym} - ${loc.locationName}`);
    });
  }

  await prisma.$disconnect();
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
