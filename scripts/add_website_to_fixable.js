#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  console.log('Adding website data to fixable locations...');
  
  // Read the existing fixable data
  const fixableData = JSON.parse(fs.readFileSync('/tmp/gbp_fixable.json', 'utf8'));
  
  console.log(`Processing ${fixableData.length} locations...`);
  
  // For each location, query to get the website
  const enrichedData = [];
  
  for (const loc of fixableData) {
    const clientProfile = await prisma.clientProfile.findFirst({
      where: { 
        tenantId: 'gyc',
        acronym: loc.acronym 
      },
      select: { website: true }
    });
    
    enrichedData.push({
      ...loc,
      website: clientProfile?.website || null
    });
  }
  
  console.log(`Enriched ${enrichedData.length} locations with website data`);
  
  // Save to file
  fs.writeFileSync(
    '/tmp/gbp_fixable_with_website.json',
    JSON.stringify(enrichedData, null, 2)
  );
  
  console.log('Data saved to /tmp/gbp_fixable_with_website.json');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
