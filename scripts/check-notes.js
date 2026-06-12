const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.local' });
const prisma = new PrismaClient();

async function check() {
  const clients = await prisma.clientProfile.findMany({
    where: { 
      acronym: { in: ['CTI', 'HAA', 'PPELC', 'TATLC'] }
    },
    select: {
      acronym: true,
      companyName: true,
      notes: true,
      teamNotes: true
    }
  });
  
  for (const c of clients) {
    console.log('\n' + '='.repeat(60));
    console.log(`${c.acronym} - ${c.companyName}`);
    console.log('='.repeat(60));
    console.log('NOTES (last 3 meetings):');
    console.log(c.notes?.slice(0, 300) + (c.notes?.length > 300 ? '...' : ''));
    console.log('\nTEAM NOTES (full context):');
    console.log(c.teamNotes?.slice(0, 300) + (c.teamNotes?.length > 300 ? '...' : ''));
  }
  
  await prisma.$disconnect();
}

check();
