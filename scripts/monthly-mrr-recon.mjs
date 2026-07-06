#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env from .env.local
function loadEnv() {
  const envPath = resolve(__dirname, '../.env.local');
  const envContent = readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match) env[match[1]] = match[2];
  }
  return env;
}

// Load and set DATABASE_URL before Prisma init
const env = loadEnv();
if (!env.DATABASE_URL) {
  throw new Error('DATABASE_URL not found in .env.local');
}
process.env.DATABASE_URL = env.DATABASE_URL;

const prisma = new PrismaClient();

async function sendTelegramNotification(message) {
  const openclaw = '/opt/homebrew/bin/openclaw';
  const chatId = '8211292899';
  try {
    await execAsync(`${openclaw} message send --channel telegram --target ${chatId} --message "${message}"`);
    console.log('✅ Telegram notification sent');
  } catch (err) {
    console.error('❌ Failed to send Telegram notification:', err.message);
  }
}

async function main() {
  const startTime = new Date();
  const yearMonth = startTime.toISOString().slice(0, 7); // YYYY-MM
  console.log(`\n💰 Starting MRR Reconciliation for ${yearMonth}\n`);

  // Load Stripe key (env already loaded at top)
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY not found in .env.local');
  }
  const stripe = new Stripe(env.STRIPE_SECRET_KEY);

  // 1. Pull all active Stripe subscriptions and calculate expected MRR
  console.log('📡 Fetching active Stripe subscriptions...');
  const stripeMrrMap = {}; // customerId -> expected MRR
  
  for await (const sub of stripe.subscriptions.list({ status: 'active', limit: 100 })) {
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
    if (!customerId) continue;

    let subMrr = 0;
    for (const item of sub.items.data) {
      const amount = item.price.unit_amount / 100;
      const interval = item.price.recurring?.interval || 'once';
      
      if (interval === 'month') {
        subMrr += amount;
      } else if (interval === 'year') {
        subMrr += amount / 12;
      } else {
        subMrr += amount; // one-time or unknown, count as-is
      }
    }

    stripeMrrMap[customerId] = (stripeMrrMap[customerId] || 0) + subMrr;
  }

  console.log(`✅ Fetched ${Object.keys(stripeMrrMap).length} active Stripe customers\n`);

  // 2. Query DB ClientProfile table
  console.log('📊 Querying ClientProfile from DB...');
  const profiles = await prisma.clientProfile.findMany({
    where: {
      status: { in: ['active', 'past_due'] }
    },
    select: {
      id: true,
      acronym: true,
      companyName: true,
      status: true,
      stripeCustomerId: true,
      mrr: true
    }
  });
  console.log(`✅ Found ${profiles.length} active client profiles\n`);

  // 3. Compare and flag mismatches
  const mismatches = [];
  const TOLERANCE = 5; // $5 rounding tolerance

  for (const profile of profiles) {
    const customerId = profile.stripeCustomerId;
    if (!customerId) {
      // No Stripe customer ID — might be PIF or data issue
      if (profile.mrr > 0) {
        mismatches.push({
          acronym: profile.acronym,
          companyName: profile.companyName,
          dbMrr: profile.mrr,
          stripeMrr: 0,
          diff: -profile.mrr,
          category: 'NO_STRIPE_CUSTOMER',
          note: 'DB has MRR but no Stripe customer ID'
        });
      }
      continue;
    }

    const stripeMrr = stripeMrrMap[customerId] || 0;
    const dbMrr = Number(profile.mrr) || 0;
    const diff = Math.abs(stripeMrr - dbMrr);

    if (diff > TOLERANCE) {
      // Categorize the mismatch
      let category = 'UNKNOWN';
      let note = '';

      // Check for Evergreen transition (395 → 197)
      if (Math.abs(dbMrr - 395) < 10 && Math.abs(stripeMrr - 197) < 10) {
        category = 'EVERGREEN_TRANSITION';
        note = 'Client downgraded from $395 to $197 Evergreen';
      }
      // Note: No isPaused field in current schema
      // Check if Stripe shows higher (new service added?)
      else if (stripeMrr > dbMrr) {
        category = 'NEW_SERVICE_ADDED';
        note = 'Stripe MRR higher than DB — possible service addition';
      }
      // Check if DB shows higher (service cancelled?)
      else if (dbMrr > stripeMrr) {
        category = 'SERVICE_CANCELLED';
        note = 'DB MRR higher than Stripe — possible service cancellation';
      }

      mismatches.push({
        acronym: profile.acronym,
        companyName: profile.companyName,
        dbMrr,
        stripeMrr,
        diff: stripeMrr - dbMrr,
        category,
        note
      });
    }
  }

  console.log(`🔍 Found ${mismatches.length} mismatches (>${TOLERANCE} tolerance)\n`);

  // 4. Write correction table
  const memoryDir = resolve(__dirname, '../../memory');
  mkdirSync(memoryDir, { recursive: true });
  const reportPath = resolve(memoryDir, `mrr-recon-${yearMonth}.md`);

  const report = `# MRR Reconciliation Report — ${yearMonth}

**Run:** ${startTime.toISOString()}  
**Mismatches Found:** ${mismatches.length}  
**Tolerance:** $${TOLERANCE}

---

## Summary by Category

| Category | Count |
|----------|-------|
${Object.entries(
  mismatches.reduce((acc, m) => {
    acc[m.category] = (acc[m.category] || 0) + 1;
    return acc;
  }, {})
).map(([cat, count]) => `| ${cat} | ${count} |`).join('\n')}

---

## Correction Table

${mismatches.length === 0 ? '_No mismatches found. All MRR values are accurate._' : 
`| Acronym | Company | DB MRR | Stripe MRR | Diff | Category | Note |
|---------|---------|--------|------------|------|----------|------|
${mismatches.map(m => 
  `| ${m.acronym || 'N/A'} | ${(m.companyName || 'Unknown').substring(0, 30)} | $${m.dbMrr.toFixed(2)} | $${m.stripeMrr.toFixed(2)} | ${m.diff >= 0 ? '+' : ''}$${m.diff.toFixed(2)} | ${m.category} | ${m.note} |`
).join('\n')}`
}

---

## Recommended Actions

${mismatches.length === 0 ? '_No action needed._' : `
1. **Review each mismatch** — verify category is correct
2. **For Evergreen transitions** — update DB to $197 MRR
3. **For new services** — confirm with client records, update DB
4. **For cancelled services** — verify cancellation date, update DB
5. **For paused services** — confirm pause status and MRR should be 0 or adjusted
6. **For unknown** — investigate manually before updating

After review, approve DB writes in main session.
`}

---

_Generated by monthly-mrr-recon.mjs_
`;

  writeFileSync(reportPath, report, 'utf8');
  console.log(`✅ Report written to: ${reportPath}\n`);

  // 5. Send Telegram notification
  const message = `💰 Monthly MRR Recon complete. ${mismatches.length} mismatch${mismatches.length !== 1 ? 'es' : ''} found. Review: memory/mrr-recon-${yearMonth}.md — approve before any DB writes.`;
  await sendTelegramNotification(message);

  console.log('✅ MRR Reconciliation complete\n');
}

main()
  .catch(e => {
    console.error('❌ Error:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
