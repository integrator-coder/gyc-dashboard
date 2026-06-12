#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  console.log('Re-querying GBP fixable locations with website data...');
  
  const fixableLocations = await prisma.$queryRaw`
    SELECT 
      gl.*,
      cp."companyName",
      cp."assignedGA",
      cp.city,
      cp.state,
      cp.website
    FROM "GBPLocation" gl
    JOIN "ClientProfile" cp ON cp.acronym = gl."clientAcronym"
    WHERE cp.status = 'active'
      AND gl."gbpUrl" IS NOT NULL
      AND gl."gbpUrl" != ''
      AND (
        (gl.category NOT IN ('Child care service', 'Day care center', 'Preschool') AND gl.category IS NOT NULL)
        OR gl.address IS NULL
        OR gl.address = ''
      )
    ORDER BY cp."companyName", gl."locationName"
  `;

  console.log(`Found ${fixableLocations.length} fixable locations`);

  // Save to file
  fs.writeFileSync(
    '/tmp/gbp_fixable_with_website.json',
    JSON.stringify(fixableLocations, null, 2)
  );

  console.log('Data saved to /tmp/gbp_fixable_with_website.json');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
