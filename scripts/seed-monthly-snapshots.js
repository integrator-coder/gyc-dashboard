require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MONTHLY_DATA = [
  { monthKey: '2026-01', monthLabel: 'Jan 2026', isPartial: false, spend: 135250.52, clicks: 82815, impressions: 2860260, avgCpc: 1.63, accountCount: 97 },
  { monthKey: '2026-02', monthLabel: 'Feb 2026', isPartial: false, spend: 136060.76, clicks: 67031, impressions: 1843744, avgCpc: 2.03, accountCount: 96 },
  { monthKey: '2026-03', monthLabel: 'Mar 2026', isPartial: false, spend: 145995.44, clicks: 42469, impressions: 1365627, avgCpc: 3.44, accountCount: 93 },
  { monthKey: '2026-04', monthLabel: 'Apr 2026', isPartial: false, spend: 137406.09, clicks: 30125, impressions: 1199192, avgCpc: 4.56, accountCount: 88 },
  { monthKey: '2026-05', monthLabel: 'May 2026', isPartial: false, spend: 137801.49, clicks: 30460, impressions: 1080944, avgCpc: 4.52, accountCount: 87 },
  { monthKey: '2026-06', monthLabel: 'Jun 2026', isPartial: true,  spend: 57940.17,  clicks: 12294, impressions: 313249,  avgCpc: 4.71, accountCount: 86 },
];

async function seed() {
  for (const m of MONTHLY_DATA) {
    await prisma.googleAdsMonthlySnapshot.upsert({
      where: { monthKey: m.monthKey },
      update: m,
      create: m
    });
  }
  console.log('Seeded', MONTHLY_DATA.length, 'monthly snapshots');
  await prisma.$disconnect();
}

seed().catch(console.error);
