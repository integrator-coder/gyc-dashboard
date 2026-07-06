#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import { readFileSync } from 'fs';
import { writeFileSync, mkdirSync } from 'fs';
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
  console.log(`\n🔄 Starting ACL Sync for ${yearMonth}\n`);

  // Load Stripe key (env already loaded at top)
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY not found in .env.local');
  }
  const stripe = new Stripe(env.STRIPE_SECRET_KEY);

  // 1. Pull all Stripe subscriptions
  console.log('📡 Fetching Stripe subscriptions...');
  const stripeSubsMap = {}; // customerId -> { status, activeSubs: [{amount, interval, id}] }
  
  for (const status of ['active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'trialing']) {
    for await (const sub of stripe.subscriptions.list({ status, limit: 100, expand: ['data.customer'] })) {
      const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
      if (!customerId) continue;

      if (!stripeSubsMap[customerId]) {
        stripeSubsMap[customerId] = { statuses: new Set(), subs: [] };
      }
      stripeSubsMap[customerId].statuses.add(sub.status);

      for (const item of sub.items.data) {
        const amount = item.price.unit_amount / 100;
        const interval = item.price.recurring?.interval || 'once';
        stripeSubsMap[customerId].subs.push({
          id: sub.id,
          status: sub.status,
          amount,
          interval,
          nickname: item.price.nickname || item.price.id
        });
      }
    }
  }

  console.log(`✅ Fetched ${Object.keys(stripeSubsMap).length} Stripe customers\n`);

  // 2. Query DB ClientProfile table
  console.log('📊 Querying ClientProfile from DB...');
  const profiles = await prisma.clientProfile.findMany({
    select: {
      id: true,
      acronym: true,
      companyName: true,
      status: true,
      stripeStatus: true,
      stripeCustomerId: true,
      mrr: true
    }
  });
  console.log(`✅ Found ${profiles.length} client profiles\n`);

  // 3. Build diff
  const changes = [];

  for (const profile of profiles) {
    const customerId = profile.stripeCustomerId;
    if (!customerId) continue;

    const stripeData = stripeSubsMap[customerId];
    if (!stripeData) {
      // Client in DB but not in Stripe — possible PIF or data mismatch
      if (profile.mrr > 0) {
        changes.push({
          type: 'ORPHANED_MRR',
          acronym: profile.acronym,
          companyName: profile.companyName,
          dbStatus: profile.stripeStatus,
          dbMrr: profile.mrr,
          stripeStatus: 'N/A',
          stripeMrr: 0,
          note: 'Client has MRR in DB but no Stripe data found'
        });
      }
      continue;
    }

    const activeSubs = stripeData.subs.filter(s => s.status === 'active');
    const canceledSubs = stripeData.subs.filter(s => s.status === 'canceled');
    const stripeMrr = activeSubs.reduce((sum, s) => {
      return sum + (s.interval === 'month' ? s.amount : s.interval === 'year' ? s.amount / 12 : s.amount);
    }, 0);

    const stripeStatus = activeSubs.length > 0 ? 'active' : 
                         stripeData.statuses.has('past_due') ? 'past_due' :
                         stripeData.statuses.has('canceled') ? 'canceled' : 'unknown';

    // Check for cancellations
    if (stripeStatus === 'canceled' && profile.stripeStatus !== 'cancelled') {
      // Check for Evergreen transition (395 canceled + 197 active)
      const has395Canceled = canceledSubs.some(s => Math.abs(s.amount - 395) < 5);
      const has197Active = activeSubs.some(s => Math.abs(s.amount - 197) < 5);
      
      if (has395Canceled && has197Active) {
        changes.push({
          type: 'EVERGREEN_TRANSITION',
          acronym: profile.acronym,
          companyName: profile.companyName,
          dbStatus: profile.stripeStatus,
          dbMrr: profile.mrr,
          stripeStatus,
          stripeMrr,
          note: '$395 canceled but $197 active → Evergreen downgrade, NOT a cancellation'
        });
      } else {
        changes.push({
          type: 'NEW_CANCELLATION',
          acronym: profile.acronym,
          companyName: profile.companyName,
          dbStatus: profile.stripeStatus,
          dbMrr: profile.mrr,
          stripeStatus,
          stripeMrr,
          note: 'Stripe shows canceled but DB does not'
        });
      }
    }

    // Check for status flips
    if (stripeStatus !== profile.stripeStatus && profile.stripeStatus !== 'cancelled') {
      changes.push({
        type: 'STATUS_FLIP',
        acronym: profile.acronym,
        companyName: profile.companyName,
        dbStatus: profile.stripeStatus,
        dbMrr: profile.mrr,
        stripeStatus,
        stripeMrr,
        note: `Status changed: ${profile.stripeStatus} → ${stripeStatus}`
      });
    }

    // Check for PIF activation (DB has no stripeCustomerId, but now exists)
    if (!profile.stripeCustomerId && stripeData) {
      changes.push({
        type: 'PIF_ACTIVATION',
        acronym: profile.acronym,
        companyName: profile.companyName,
        dbStatus: profile.stripeStatus,
        dbMrr: profile.mrr,
        stripeStatus,
        stripeMrr,
        note: 'Client now has Stripe customer ID (PIF → subscription)'
      });
    }

    // Note: No isPaused field in current schema, skipping that check
  }

  // 4. Write report
  const memoryDir = resolve(__dirname, '../../memory');
  mkdirSync(memoryDir, { recursive: true });
  const reportPath = resolve(memoryDir, `acl-sync-${yearMonth}.md`);

  const report = `# ACL Sync Report — ${yearMonth}

**Run:** ${startTime.toISOString()}  
**Changes Detected:** ${changes.length}

---

## Summary

| Type | Count |
|------|-------|
${Object.entries(
  changes.reduce((acc, c) => {
    acc[c.type] = (acc[c.type] || 0) + 1;
    return acc;
  }, {})
).map(([type, count]) => `| ${type} | ${count} |`).join('\n')}

---

## Changes

${changes.length === 0 ? '_No changes detected._' : changes.map((c, i) => `
### ${i + 1}. ${c.type}

- **Client:** ${c.acronym} — ${c.companyName}
- **DB Status:** ${c.dbStatus} | MRR: $${c.dbMrr}
- **Stripe Status:** ${c.stripeStatus} | MRR: $${c.stripeMrr.toFixed(2)}
- **Note:** ${c.note}
`).join('\n')}

---

## Next Steps

1. Review this report
2. Approve changes in main session
3. Wall·E will apply DB writes after approval

**DO NOT** manually edit the database until Wall·E processes this report.

---

_Generated by monthly-acl-sync.mjs_
`;

  writeFileSync(reportPath, report, 'utf8');
  console.log(`✅ Report written to: ${reportPath}\n`);

  // 5. Send Telegram notification
  const message = `📋 Monthly ACL Sync complete. ${changes.length} change${changes.length !== 1 ? 's' : ''} detected. Review: memory/acl-sync-${yearMonth}.md — approve before any DB writes.`;
  await sendTelegramNotification(message);

  console.log('✅ ACL Sync complete\n');
}

main()
  .catch(e => {
    console.error('❌ Error:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
