require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function reseed() {
  console.log('📊 Fetching all accounts from API...');
  
  const response = await fetch('http://localhost:3000/api/google-ads');
  const data = await response.json();
  const accounts = data.accounts;
  
  console.log(`✓ Found ${accounts.length} accounts from API\n`);
  console.log('Reseeding database...\n');
  
  let count = 0;
  for (const a of accounts) {
    await prisma.googleAdsAccount.upsert({
      where: { accountId: a.accountId },
      update: {
        accountName: a.accountName,
        currSpend: a.currSpend || 0,
        currClicks: a.currClicks || 0,
        currImpressions: a.currImpressions || 0,
        currCpc: a.currCpc || 0,
        currCtr: a.currCtr || 0,
        prevSpend: a.prevSpend || 0,
        prevClicks: a.prevClicks || 0,
        prevImpressions: a.prevImpressions || 0,
        prevCpc: a.prevCpc || 0,
        cpcChange: a.cpcChange || null,
        clicksChange: a.clicksChange || null,
        impressionsChange: a.impressionsChange || null,
        flagged: a.flagged || false,
        flags: a.flags || [],
        lastSynced: a.lastSynced ? new Date(a.lastSynced) : new Date(),
      },
      create: {
        accountId: a.accountId,
        accountName: a.accountName,
        currSpend: a.currSpend || 0,
        currClicks: a.currClicks || 0,
        currImpressions: a.currImpressions || 0,
        currCpc: a.currCpc || 0,
        currCtr: a.currCtr || 0,
        prevSpend: a.prevSpend || 0,
        prevClicks: a.prevClicks || 0,
        prevImpressions: a.prevImpressions || 0,
        prevCpc: a.prevCpc || 0,
        cpcChange: a.cpcChange || null,
        clicksChange: a.clicksChange || null,
        impressionsChange: a.impressionsChange || null,
        flagged: a.flagged || false,
        flags: a.flags || [],
        lastSynced: a.lastSynced ? new Date(a.lastSynced) : new Date(),
      }
    });
    count++;
    if (count % 10 === 0) {
      console.log(`  ✓ Processed ${count}/${accounts.length}`);
    }
  }
  
  console.log(`\n✅ Reseeded ${count} accounts`);
  await prisma.$disconnect();
}

reseed().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
