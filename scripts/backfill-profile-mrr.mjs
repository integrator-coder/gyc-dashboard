import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting MRR backfill — ClientProfile.mrr ← sum of linked StripeCustomer MRR\n');

  // Get all active client profiles
  const profiles = await prisma.clientProfile.findMany({
    where: { status: { in: ['active', 'past_due', 'unpaid'] } },
    select: { id: true, acronym: true, mrr: true, companyName: true }
  });

  console.log(`Total active profiles: ${profiles.length}`);

  // Get all StripeCustomer records with MRR > 0
  const stripeCustomers = await prisma.stripeCustomer.findMany({
    where: { mrr: { gt: 0 } },
    select: { id: true, acronym: true, mrr: true, name: true, companyName: true }
  });

  // Get all ClientStripeLink records
  const links = await prisma.clientStripeLink.findMany({
    select: { clientProfileId: true, stripeCustomerId: true }
  }).catch(() => {
    console.log('ClientStripeLink table not found, falling back to acronym matching only');
    return [];
  });

  // Build map: clientProfileId → [stripeCustomerIds]
  const linkMap = {};
  for (const l of links) {
    if (!linkMap[l.clientProfileId]) linkMap[l.clientProfileId] = [];
    linkMap[l.clientProfileId].push(l.stripeCustomerId);
  }

  // Build map: stripeCustomerId → mrr
  const stripeMrrMap = {};
  for (const sc of stripeCustomers) {
    stripeMrrMap[sc.id] = Number(sc.mrr) || 0;
  }

  // Build map: acronym → sum of stripe MRR (for fallback)
  const acronymMrrMap = {};
  for (const sc of stripeCustomers) {
    if (sc.acronym) {
      acronymMrrMap[sc.acronym] = (acronymMrrMap[sc.acronym] || 0) + (Number(sc.mrr) || 0);
    }
  }

  let updated = 0;
  let skipped = 0;
  let noStripeData = 0;
  const changes = [];

  for (const profile of profiles) {
    let stripeMrr = 0;
    let source = '';

    // Try link table first
    const linkedIds = linkMap[profile.id] || [];
    if (linkedIds.length > 0) {
      stripeMrr = linkedIds.reduce((sum, id) => sum + (stripeMrrMap[id] || 0), 0);
      source = 'ClientStripeLink';
    }

    // Fallback to acronym matching
    if (stripeMrr === 0 && profile.acronym && acronymMrrMap[profile.acronym]) {
      stripeMrr = acronymMrrMap[profile.acronym];
      source = 'acronym';
    }

    if (stripeMrr === 0) {
      noStripeData++;
      continue;
    }

    const currentMrr = Number(profile.mrr) || 0;
    const diff = Math.abs(stripeMrr - currentMrr);
    const pctDiff = currentMrr > 0 ? (diff / currentMrr) * 100 : 100;

    // Only update if there's a meaningful difference (>5%)
    if (pctDiff > 5) {
      await prisma.clientProfile.update({
        where: { id: profile.id },
        data: { mrr: stripeMrr }
      });
      changes.push({
        acronym: profile.acronym,
        name: profile.companyName,
        old: currentMrr.toFixed(2),
        new: stripeMrr.toFixed(2),
        diff: (stripeMrr - currentMrr).toFixed(2),
        source
      });
      updated++;
    } else {
      skipped++;
    }
  }

  console.log(`\n✅ Results:`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Already accurate (within 5%): ${skipped}`);
  console.log(`  No Stripe data found: ${noStripeData}`);
  console.log(`\nChanges made:`);
  changes.forEach(c => {
    const acronym = (c.acronym || 'N/A').padEnd(10);
    const name = (c.name || 'Unknown').substring(0,30).padEnd(32);
    console.log(`  ${acronym} ${name} $${c.old.padStart(8)} → $${c.new.padStart(8)}  (${Number(c.diff) >= 0 ? '+' : ''}${c.diff})  [${c.source}]`);
  });

  // Specifically check the 20 known mismatches
  const knownMismatches = ['CPAC','TTS','TLCCC','GBD','WOA','CPC','WKA','TCALC','LTA','CPMD','SOSH','SWDLC','HTCDC','YHS','TLC','FM','TGHP','CAEC'];
  console.log('\n\nVerification — known problem clients:');
  const verified = await prisma.clientProfile.findMany({
    where: { acronym: { in: knownMismatches } },
    select: { acronym: true, mrr: true, companyName: true }
  });
  verified.forEach(v => console.log(`  ${(v.acronym || 'N/A').padEnd(10)} $${Number(v.mrr).toFixed(2).padStart(10)}`));
}

main()
  .catch(e => { console.error('Error:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
