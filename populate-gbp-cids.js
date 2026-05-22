const { google } = require('googleapis');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const SHEET_ID = '1uZLqNTDWXZ3wbBU7ley-81gj8Kj4h06_Ftd2utE-pjY';
const SERVICE_ACCOUNT_PATH = process.env.HOME + '/.openclaw/workspace/google-service-account.json';

// Extract CID from Google Maps URL
function extractCid(url) {
  if (!url) return null;
  
  try {
    const u = new URL(url);
    
    // Check ?cid= param
    const cidParam = u.searchParams.get('cid');
    if (cidParam) return cidParam;
    
    // Check for :0x hex format in path
    const hexMatch = url.match(/:0x([0-9a-f]+)/i);
    if (hexMatch) {
      return BigInt('0x' + hexMatch[1]).toString(10);
    }
  } catch (e) {
    // Invalid URL
  }
  
  return null;
}

async function main() {
  console.log('🚀 Starting GBP CID population pipeline...\n');
  
  // Step 1: Authenticate and read the sheet
  console.log('📊 Reading Google Sheet...');
  const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  
  const sheets = google.sheets({ version: 'v4', auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'A:F',
  });
  
  const rows = response.data.values;
  if (!rows || rows.length === 0) {
    console.log('❌ No data found in sheet');
    return;
  }
  
  // Skip header row
  const dataRows = rows.slice(1);
  console.log(`✅ Found ${dataRows.length} rows to process\n`);
  
  // Step 2: Dry run first 5 rows
  console.log('🔍 DRY RUN - First 5 rows:\n');
  for (let i = 0; i < Math.min(5, dataRows.length); i++) {
    const row = dataRows[i];
    const [clientAcronym, clientName, numLocations, website, locationName, mapUrl] = row;
    
    if (!clientAcronym || !locationName || !mapUrl) {
      console.log(`⚠️  Row ${i + 2}: Missing required fields - skipping`);
      continue;
    }
    
    const cid = extractCid(mapUrl);
    
    console.log(`Row ${i + 2}:`);
    console.log(`  Client: ${clientAcronym} - ${locationName}`);
    console.log(`  Map URL: ${mapUrl}`);
    console.log(`  Extracted CID: ${cid || 'NONE'}`);
    
    // Check if exists
    const existing = await prisma.gBPLocation.findUnique({
      where: {
        tenantId_clientAcronym_locationName: {
          tenantId: 'gyc',
          clientAcronym: clientAcronym,
          locationName: locationName,
        },
      },
    });
    
    if (existing) {
      console.log(`  ✓ Exists (id=${existing.id}, current cid=${existing.cid || 'null'})`);
      if (cid && !existing.cid) {
        console.log(`  → Would UPDATE with CID`);
      } else if (cid && existing.cid && existing.cid !== cid) {
        console.log(`  → Would UPDATE CID (different value)`);
      } else {
        console.log(`  → No change needed`);
      }
    } else {
      console.log(`  ✗ Does not exist`);
      console.log(`  → Would CREATE new record`);
    }
    console.log('');
  }
  
  // Ask for confirmation to proceed
  console.log('\n⏸️  DRY RUN COMPLETE. Review output above.');
  console.log('Continue with full pipeline? (Ctrl+C to abort, or wait 5 seconds to proceed)\n');
  
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Step 3: Process all rows
  console.log('🔄 Starting full pipeline...\n');
  
  let created = 0;
  let updated = 0;
  let skippedNoCid = 0;
  let skippedNoChange = 0;
  let errors = [];
  
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const [clientAcronym, clientName, numLocations, website, locationName, mapUrl] = row;
    
    if (!clientAcronym || !locationName || !mapUrl) {
      console.log(`⚠️  Row ${i + 2}: Missing required fields - skipping`);
      continue;
    }
    
    const cid = extractCid(mapUrl);
    
    if (!cid) {
      skippedNoCid++;
      if (skippedNoCid <= 10) {
        console.log(`⚠️  Row ${i + 2}: No CID extractable from ${mapUrl}`);
      }
      continue;
    }
    
    try {
      const result = await prisma.gBPLocation.upsert({
        where: {
          tenantId_clientAcronym_locationName: {
            tenantId: 'gyc',
            clientAcronym: clientAcronym,
            locationName: locationName,
          },
        },
        update: {
          cid: cid,
          updatedAt: new Date(),
        },
        create: {
          tenantId: 'gyc',
          clientAcronym: clientAcronym,
          locationName: locationName,
          cid: cid,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      
      // Check if it was created or updated
      const wasCreated = result.createdAt.getTime() === result.updatedAt.getTime();
      
      if (wasCreated) {
        created++;
        if (created <= 10) {
          console.log(`✅ Row ${i + 2}: Created ${clientAcronym} - ${locationName} (CID: ${cid})`);
        }
      } else {
        // It was an update
        const existing = await prisma.gBPLocation.findUnique({
          where: {
            tenantId_clientAcronym_locationName: {
              tenantId: 'gyc',
              clientAcronym: clientAcronym,
              locationName: locationName,
            },
          },
        });
        
        if (existing && existing.cid !== cid) {
          updated++;
          if (updated <= 10) {
            console.log(`🔄 Row ${i + 2}: Updated ${clientAcronym} - ${locationName} (CID: ${cid})`);
          }
        } else {
          skippedNoChange++;
        }
      }
      
      // Progress checkpoint every 25 rows
      if ((i + 1) % 25 === 0) {
        console.log(`\n📊 Progress: ${i + 1}/${dataRows.length} rows processed`);
        console.log(`   Created: ${created} | Updated: ${updated} | Skipped (no CID): ${skippedNoCid} | No change: ${skippedNoChange}\n`);
        
        // Small delay to avoid DB overload
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      errors.push({
        row: i + 2,
        client: clientAcronym,
        location: locationName,
        error: error.message,
      });
      
      if (errors.length <= 10) {
        console.error(`❌ Row ${i + 2}: Error upserting ${clientAcronym} - ${locationName}: ${error.message}`);
      }
    }
  }
  
  // Final report
  console.log('\n\n📈 FINAL REPORT');
  console.log('═══════════════════════════════════════════');
  console.log(`Total rows processed: ${dataRows.length}`);
  console.log(`✅ Created: ${created}`);
  console.log(`🔄 Updated: ${updated}`);
  console.log(`⚠️  Skipped (no extractable CID): ${skippedNoCid}`);
  console.log(`ℹ️  Skipped (no change needed): ${skippedNoChange}`);
  console.log(`❌ Errors: ${errors.length}`);
  
  if (errors.length > 0) {
    console.log('\n⚠️  ERRORS:');
    errors.forEach(e => {
      console.log(`  Row ${e.row} (${e.client} - ${e.location}): ${e.error}`);
    });
  }
  
  console.log('\n✨ Pipeline complete!');
}

main()
  .catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
