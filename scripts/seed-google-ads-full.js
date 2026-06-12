require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();
const data = JSON.parse(fs.readFileSync('/tmp/gyc_ads_analysis.json'));
const allAccounts = data.all;

async function seed() {
  let count = 0;
  for (const a of allAccounts) {
    await prisma.googleAdsAccount.upsert({
      where: { accountId: a.id },
      update: {
        accountName: a.name,
        currSpend: a.curr_cost || 0,
        currClicks: a.curr_clicks || 0,
        currImpressions: a.curr_impressions || 0,
        currCpc: a.curr_cpc || 0,
        prevSpend: 0,
        prevClicks: a.prev_clicks || 0,
        prevImpressions: a.prev_impressions || 0,
        prevCpc: a.prev_cpc || 0,
        cpcChange: a.cpc_change || null,
        clicksChange: a.clicks_change || null,
        impressionsChange: a.impressions_change || null,
        flagged: a.flagged || false,
        flags: a.flags || [],
        lastSynced: new Date(),
      },
      create: {
        accountId: a.id,
        accountName: a.name,
        currSpend: a.curr_cost || 0,
        currClicks: a.curr_clicks || 0,
        currImpressions: a.curr_impressions || 0,
        currCpc: a.curr_cpc || 0,
        prevSpend: 0,
        prevClicks: a.prev_clicks || 0,
        prevImpressions: a.prev_impressions || 0,
        prevCpc: a.prev_cpc || 0,
        cpcChange: a.cpc_change || null,
        clicksChange: a.clicks_change || null,
        impressionsChange: a.impressions_change || null,
        flagged: a.flagged || false,
        flags: a.flags || [],
        lastSynced: new Date(),
      }
    });
    count++;
  }
  console.log(`Seeded ${count} accounts`);
  await prisma.$disconnect();
}
seed();
