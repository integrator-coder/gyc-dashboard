const { PrismaClient } = require('@prisma/client');
const Stripe = require('stripe');
const fs = require('fs');

// Load env
const envContent = fs.readFileSync('/Users/toddthejedigmail.com/.openclaw/workspace/gyc-dashboard/.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const eqIdx = line.indexOf('=');
  if (eqIdx > 0 && !line.startsWith('#')) {
    env[line.substring(0, eqIdx).trim()] = line.substring(eqIdx + 1).trim();
  }
});

process.env.DATABASE_URL = env.DATABASE_URL;
const stripe = new Stripe(env.STRIPE_SECRET_KEY);
const prisma = new PrismaClient();

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('🔍 Starting ACL reconciliation...\n');
  
  const clients = await prisma.clientProfile.findMany({
    where: { stripeCustomerId: { not: null } },
    select: {
      id: true, companyName: true, acronym: true,
      stripeCustomerId: true, stripeStatus: true,
      mrr: true
    }
  });

  console.log(`Checking ${clients.length} clients...\n`);

  const autoApplied = [];
  const escalated = [];
  const noChange = [];
  let apiErrors = 0;

  // Clear existing pending discrepancies first (we'll re-populate from fresh data)
  await prisma.aclDiscrepancy.deleteMany({ where: { status: 'pending' } });

  for (let i = 0; i < clients.length; i++) {
    const client = clients[i];
    
    // Rate limit: pause every 50 clients
    if (i > 0 && i % 50 === 0) {
      console.log(`  ... ${i}/${clients.length} processed`);
      await delay(1000);
    }

    try {
      const subs = await stripe.subscriptions.list({
        customer: client.stripeCustomerId,
        limit: 10,
        status: 'all'
      });
      
      await delay(50); // gentle rate limiting

      const activeSubs = subs.data.filter(s => ['active','past_due','unpaid','trialing'].includes(s.status));
      const cancelledSubs = subs.data.filter(s => s.status === 'canceled');
      const pausedSubs = subs.data.filter(s => s.status === 'paused');

      // Convert Decimal to number for calculations
      const clientMRR = parseFloat(String(client.mrr || 0));

      // Calculate actual Stripe MRR
      const stripeMRR = Math.round(activeSubs.reduce((sum, s) => {
        return sum + s.items.data.reduce((a, item) => {
          const amount = item.price.unit_amount || 0;
          const qty = item.quantity || 1;
          const interval = item.price.recurring?.interval;
          // Convert to monthly
          if (interval === 'year') return a + (amount * qty / 100 / 12);
          return a + (amount * qty / 100);
        }, 0);
      }, 0));

      // Determine current Stripe status
      let stripeCurrentStatus = client.stripeStatus;
      if (activeSubs.length > 0) {
        // Priority: past_due > unpaid > active > trialing
        if (activeSubs.some(s => s.status === 'past_due')) stripeCurrentStatus = 'past_due';
        else if (activeSubs.some(s => s.status === 'unpaid')) stripeCurrentStatus = 'unpaid';
        else stripeCurrentStatus = activeSubs[0].status;
      } else if (cancelledSubs.length > 0 && pausedSubs.length === 0) {
        stripeCurrentStatus = 'cancelled';
      }

      // === DECISION LOGIC ===

      // 1. CANCELLATION — escalate to Lex
      if (activeSubs.length === 0 && cancelledSubs.length > 0 && client.stripeStatus !== 'cancelled') {
        escalated.push({ name: client.companyName, acronym: client.acronym, reason: 'Cancellation detected', detail: `DB: ${client.stripeStatus} | MRR: $${clientMRR}` });
        await prisma.aclDiscrepancy.create({
          data: {
            clientId: String(client.id),
            clientName: client.companyName,
            acronym: client.acronym || '',
            changeType: 'cancellation',
            dbValue: client.stripeStatus || '',
            stripeValue: 'cancelled',
            mrrImpact: clientMRR * -1,
            status: 'pending'
          }
        });
        continue;
      }

      // 2. STATUS SYNC — auto-apply for past_due/unpaid
      if (stripeCurrentStatus !== client.stripeStatus && 
          client.stripeStatus !== 'cancelled' &&
          ['past_due', 'unpaid', 'active', 'trialing'].includes(stripeCurrentStatus)) {
        
        await prisma.clientProfile.update({
          where: { id: client.id },
          data: { stripeStatus: stripeCurrentStatus }
        });
        autoApplied.push({ name: client.companyName, acronym: client.acronym, action: `Status: ${client.stripeStatus} → ${stripeCurrentStatus}` });
        continue;
      }

      // 3. MRR DISCREPANCY
      if (activeSubs.length > 0 && Math.abs(stripeMRR - clientMRR) > 5 && client.stripeStatus !== 'cancelled') {
        const diff = stripeMRR - clientMRR;
        const isEvergreen = stripeMRR <= 200 && clientMRR >= 390; // $395 → $197 transition
        const isLargeDiff = Math.abs(diff) > 500;

        if (isEvergreen) {
          // Auto-apply Evergreen transition
          await prisma.clientProfile.update({
            where: { id: client.id },
            data: { mrr: stripeMRR }
          });
          autoApplied.push({ name: client.companyName, acronym: client.acronym, action: `Evergreen: $${clientMRR} → $${stripeMRR}/mo` });
        } else if (isLargeDiff) {
          // Escalate large discrepancies
          escalated.push({ name: client.companyName, acronym: client.acronym, reason: 'Large MRR discrepancy', detail: `DB: $${clientMRR} vs Stripe: $${stripeMRR} (${diff > 0 ? '+' : ''}$${diff})` });
          await prisma.aclDiscrepancy.create({
            data: {
              clientId: String(client.id),
              clientName: client.companyName,
              acronym: client.acronym || '',
              changeType: 'mrr_mismatch',
              dbValue: String(clientMRR),
              stripeValue: String(stripeMRR),
              mrrImpact: parseFloat(String(diff)),
              status: 'pending'
            }
          });
        } else {
          // Auto-apply small clear MRR corrections
          await prisma.clientProfile.update({
            where: { id: client.id },
            data: { mrr: stripeMRR }
          });
          autoApplied.push({ name: client.companyName, acronym: client.acronym, action: `MRR: $${clientMRR} → $${stripeMRR}/mo` });
        }
        continue;
      }

      noChange.push(client.companyName);

    } catch (err) {
      if (!err.message.includes('No such customer') && !err.message.includes('resource_missing')) {
        apiErrors++;
        if (apiErrors < 5) console.log(`  ⚠️ Error on ${client.companyName}: ${err.message.substring(0, 80)}`);
      }
    }
  }

  // Log the sync run
  await prisma.aclSyncLog.create({
    data: {
      clientsChecked: clients.length,
      discrepanciesFound: autoApplied.length + escalated.length,
      syncType: 'full_resolution'
    }
  });

  // Print results
  console.log('\n' + '='.repeat(60));
  console.log(`✅ AUTO-APPLIED (${autoApplied.length} changes):`);
  autoApplied.forEach(a => console.log(`  • ${a.name} (${a.acronym}): ${a.action}`));
  
  console.log(`\n⚠️  ESCALATED TO LEX (${escalated.length} items):`);
  escalated.forEach(e => console.log(`  • ${e.name} (${e.acronym}): ${e.reason} — ${e.detail}`));
  
  console.log(`\n✓ No change: ${noChange.length} clients`);
  console.log(`⚡ API errors: ${apiErrors}`);
  console.log('\nDone. Escalated items are in the ACL Review page for Lex.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
