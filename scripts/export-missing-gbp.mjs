import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

function escapeCsv(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function toCsvRow(obj, keys) {
  return keys.map(k => escapeCsv(obj[k])).join(',');
}

async function main() {
  const clients = await prisma.clientProfile.findMany({
    where: { status: { in: ['active', 'past_due', 'unpaid'] } },
    select: {
      acronym: true,
      companyName: true,
      assignedGA: true,
      website: true,
      serviceList: true,
      mrr: true,
    },
    orderBy: { companyName: 'asc' },
  });

  const gbpLocations = await prisma.gBPLocation.findMany({
    select: {
      clientAcronym: true,
      gbpPlaceId: true,
      gbpUrl: true,
      locationName: true,
    },
  });

  const gbpMap = {};
  for (const loc of gbpLocations) {
    if (!gbpMap[loc.clientAcronym]) gbpMap[loc.clientAcronym] = [];
    gbpMap[loc.clientAcronym].push(loc);
  }

  const missing = [];
  for (const client of clients) {
    const locs = gbpMap[client.acronym] || [];
    const hasGBP = locs.length > 0;
    const hasPlaceId = locs.some(l => l.gbpPlaceId);

    if (!hasGBP || !hasPlaceId) {
      missing.push({
        acronym: client.acronym || '',
        companyName: client.companyName || '',
        assignedGA: client.assignedGA || '',
        serviceType: (client.serviceList || []).join('; '),
        domain: client.website || '',
        mrr: client.mrr ? Number(client.mrr).toFixed(2) : '0.00',
        issue: !hasGBP ? 'No GBP record' : 'Has GBP record but no place_id',
        existingMapsUrl: locs.map(l => l.gbpUrl).filter(Boolean).join('; '),
        googleMapsUrlNeeded: '',
      });
    }
  }

  console.log(`Active clients: ${clients.length}`);
  console.log(`Missing GBP/place_id: ${missing.length}`);

  const keys = ['acronym','companyName','assignedGA','serviceType','domain','mrr','issue','existingMapsUrl','googleMapsUrlNeeded'];
  const headers = ['Acronym','Company Name','Assigned GA','Service Type','Domain','MRR ($)','Issue','Existing Maps URL','★ Google Maps URL (fill this in)'];

  const rows = [headers.join(','), ...missing.map(r => toCsvRow(r, keys))];
  const outPath = path.join(__dirname, '../reports/missing-gbp-maps-urls.csv');
  writeFileSync(outPath, rows.join('\n'), 'utf8');

  console.log(`\nCSV written: ${outPath}`);
  console.log('\nSample:');
  missing.slice(0, 5).forEach(r => console.log(`  ${r.acronym.padEnd(10)} | ${(r.companyName||'').padEnd(35)} | ${r.issue}`));
}

main()
  .catch(e => { console.error(e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
