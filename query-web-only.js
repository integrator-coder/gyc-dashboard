require('dotenv').config({ path: '.env.local', silent: true });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const clients = await prisma.clientProfile.findMany({
    where: {
      status: 'active',
      hasWebsite: true,
      hasSEO: false,
      hasGoogleAds: false,
      hasPaidMedia: false,
      hasCRM: false,
      hasBlueprint: false,
      hasCommand: false
    },
    orderBy: [{ state: 'asc' }, { city: 'asc' }, { companyName: 'asc' }],
    select: {
      acronym: true,
      companyName: true,
      ownerName: true,
      email: true,
      phone: true,
      city: true,
      state: true,
      zipCode: true,
      website: true,
      assignedGA: true,
      assignedGAEmail: true,
      mrr: true,
      locationCount: true,
      startDate: true,
      directorName: true,
      directorEmail: true,
      directorPhone: true,
      notes: true,
      teamNotes: true,
      serviceList: true
    }
  });
  
  console.log(JSON.stringify(clients, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
