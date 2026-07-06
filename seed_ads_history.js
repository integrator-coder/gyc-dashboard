require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function seed() {
  const data = JSON.parse(fs.readFileSync('/tmp/gyc_ads_full_history.json'));
  console.log(`Seeding ${data.length} months to GoogleAdsMonthlySnapshot table`);
  
  for (const m of data) {
    await prisma.googleAdsMonthlySnapshot.upsert({
      where: { monthKey: m.monthKey },
      update: m,
      create: m
    });
  }
  
  console.log('✅ Seeded successfully');
  await prisma.$disconnect();
}

seed().catch(e => {
  console.log('DB note:', e.message.slice(0, 150));
  process.exit(0);
});
