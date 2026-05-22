const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

(async () => {
  try {
    const withNotes = await prisma.clientProfile.count({
      where: {
        seoNotes: {
          not: null
        }
      }
    });
    
    const withSheetId = await prisma.clientProfile.count({
      where: {
        seoSheetId: {
          not: null
        }
      }
    });
    
    console.log('✅ ClientProfile records with seoNotes populated:', withNotes);
    console.log('✅ ClientProfile records with seoSheetId populated:', withSheetId);
    
    await prisma.$disconnect();
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
