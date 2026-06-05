#!/usr/bin/env node
/**
 * Google Ads Setup Verification
 * Confirms all components are in place and ready
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const prisma = new PrismaClient();

console.log('🔍 Verifying Google Ads Setup\n');

const checks = [];

// 1. Check database schema
try {
  console.log('1️⃣  Checking database schema...');
  
  // Check ClientGoogleAdsSnapshot table
  const snapshots = await prisma.clientGoogleAdsSnapshot.findMany({
    take: 1
  });
  checks.push({ name: 'ClientGoogleAdsSnapshot table', status: 'pass' });
  
  // Check ClientProfile.googleAdsCustomerId field
  const profiles = await prisma.clientProfile.findMany({
    where: { googleAdsCustomerId: { not: null } },
    take: 1,
    select: { acronym: true, googleAdsCustomerId: true }
  });
  checks.push({ name: 'ClientProfile.googleAdsCustomerId field', status: 'pass' });
  
  console.log('   ✅ Database schema ready\n');
} catch (error) {
  console.error('   ❌ Database schema error:', error.message);
  checks.push({ name: 'Database schema', status: 'fail', error: error.message });
}

// 2. Check API route files exist
console.log('2️⃣  Checking API routes...');
const apiFiles = [
  '../app/api/clients/[acronym]/google-ads/route.js',
  '../app/api/metrics/leadership-ads-summary/route.js'
];

for (const file of apiFiles) {
  const path = join(__dirname, file);
  if (existsSync(path)) {
    checks.push({ name: `API route: ${file}`, status: 'pass' });
  } else {
    checks.push({ name: `API route: ${file}`, status: 'fail', error: 'File not found' });
  }
}
console.log('   ✅ API routes exist\n');

// 3. Check sync script
console.log('3️⃣  Checking sync script...');
const syncScriptPath = join(__dirname, 'sync-google-ads.mjs');
if (existsSync(syncScriptPath)) {
  const content = readFileSync(syncScriptPath, 'utf-8');
  if (content.includes('fetchAdsData') && content.includes('upsertAdsSnapshot')) {
    checks.push({ name: 'Sync script (sync-google-ads.mjs)', status: 'pass' });
    console.log('   ✅ Sync script ready\n');
  } else {
    checks.push({ name: 'Sync script', status: 'fail', error: 'Missing key functions' });
  }
} else {
  checks.push({ name: 'Sync script', status: 'fail', error: 'File not found' });
}

// 4. Check environment variables
console.log('4️⃣  Checking environment variables...');
const requiredEnvVars = [
  'GOOGLE_ADS_DEVELOPER_TOKEN',
  'GOOGLE_ADS_REFRESH_TOKEN',
  'GOOGLE_ADS_CLIENT_ID',
  'GOOGLE_ADS_CLIENT_SECRET'
];

let envReady = true;
for (const envVar of requiredEnvVars) {
  if (process.env[envVar]) {
    checks.push({ name: `ENV: ${envVar}`, status: 'pass' });
  } else {
    checks.push({ name: `ENV: ${envVar}`, status: 'warn', error: 'Not set (expected until OAuth token arrives)' });
    envReady = false;
  }
}

if (!envReady) {
  console.log('   ⚠️  Environment variables not set (expected until OAuth arrives)\n');
} else {
  console.log('   ✅ Environment variables configured\n');
}

// 5. Summary
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 VERIFICATION SUMMARY\n');

const passed = checks.filter(c => c.status === 'pass').length;
const warnings = checks.filter(c => c.status === 'warn').length;
const failed = checks.filter(c => c.status === 'fail').length;

console.log(`✅ Passed: ${passed}`);
if (warnings > 0) console.log(`⚠️  Warnings: ${warnings}`);
if (failed > 0) console.log(`❌ Failed: ${failed}`);

console.log('\n📋 DETAILED RESULTS:\n');
for (const check of checks) {
  const icon = check.status === 'pass' ? '✅' : check.status === 'warn' ? '⚠️ ' : '❌';
  console.log(`${icon} ${check.name}`);
  if (check.error) {
    console.log(`   └─ ${check.error}`);
  }
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

if (failed === 0) {
  console.log('\n🎉 Setup verified! Ready for OAuth token.');
} else {
  console.log('\n⚠️  Some checks failed. Review errors above.');
}

await prisma.$disconnect();
