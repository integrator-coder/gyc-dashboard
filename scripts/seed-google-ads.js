#!/usr/bin/env node
/**
 * Seed Google Ads Account data from /tmp/gyc_ads_analysis.json
 * Upserts into GoogleAdsAccount table
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  console.log('📊 Seeding Google Ads data...\n');

  // Read the analysis JSON
  const dataPath = '/tmp/gyc_ads_analysis.json';
  if (!fs.existsSync(dataPath)) {
    console.error(`❌ File not found: ${dataPath}`);
    process.exit(1);
  }

  const rawData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  
  // Combine flagged and performing accounts
  const allAccounts = [
    ...(rawData.flagged || []),
    ...(rawData.performing || [])
  ];

  console.log(`Found ${allAccounts.length} accounts total`);
  console.log(`  - Flagged: ${rawData.flagged?.length || 0}`);
  console.log(`  - Performing: ${rawData.performing?.length || 0}\n`);

  let upserted = 0;
  let errors = 0;

  for (const account of allAccounts) {
    try {
      const data = {
        accountId: account.id,
        accountName: account.name,
        currSpend: account.curr_cost || 0,
        currClicks: account.curr_clicks || 0,
        currImpressions: account.curr_impressions || 0,
        currCpc: account.curr_cpc || 0,
        currCtr: account.curr_ctr || 0,
        prevSpend: account.prev_cost || 0,
        prevClicks: account.prev_clicks || 0,
        prevImpressions: account.prev_impressions || 0,
        prevCpc: account.prev_cpc || 0,
        cpcChange: account.cpc_change || null,
        clicksChange: account.clicks_change || null,
        impressionsChange: account.impr_change || null,
        flagged: account.flagged || false,
        flags: account.flags || [],
        lastSynced: new Date(),
      };

      await prisma.googleAdsAccount.upsert({
        where: { accountId: account.id },
        create: data,
        update: data,
      });

      upserted++;
      if (upserted % 50 === 0) {
        process.stdout.write(`  ✓ Processed ${upserted} accounts...\r`);
      }
    } catch (error) {
      console.error(`\n❌ Error processing ${account.name}:`, error.message);
      errors++;
    }
  }

  console.log(`\n\n✅ Seeding complete!`);
  console.log(`   Upserted: ${upserted}`);
  console.log(`   Errors: ${errors}`);
}

main()
  .catch((e) => {
    console.error('❌ Fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
