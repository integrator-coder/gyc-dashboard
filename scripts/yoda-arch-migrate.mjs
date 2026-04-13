import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

// Load .env.local manually
const __filename = fileURLToPath(import.meta.url);
const __dir = dirname(__filename);
const envPath = join(__dir, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf8');
let dbUrl = '';
for (const line of envContent.split('\n')) {
  if (line.startsWith('DATABASE_URL=') && !line.startsWith('#')) {
    dbUrl = line.slice('DATABASE_URL='.length).trim();
    break;
  }
}

const { Client } = pg;
const client = new Client({ connectionString: dbUrl });

async function runSql(label, sql) {
  try {
    const res = await client.query(sql);
    if (res.rows) console.log(`✅ ${label}:`, JSON.stringify(res.rows.slice(0,3)));
    else console.log(`✅ ${label}`);
  } catch (e) {
    if (e.message.includes('already exists') || e.message.includes('does not exist')) {
      console.log(`⏭️  ${label}: ${e.message}`);
    } else {
      console.log(`❌ ${label}: ${e.message}`);
    }
  }
}

await client.connect();
console.log('Connected to DB\n');

// ===== STEP 1: Client + Financial tables =====
console.log('--- STEP 1: Client + Financial tables ---');
await runSql('Client.tenantId', `ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'gyc'`);
await runSql('Client_tenantId_idx', `CREATE INDEX IF NOT EXISTS "Client_tenantId_idx" ON "Client" ("tenantId")`);
await runSql('DailyRevenue.tenantId', `ALTER TABLE "DailyRevenue" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'gyc'`);
await runSql('StripeCustomer.tenantId', `ALTER TABLE "StripeCustomer" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'gyc'`);
await runSql('StripeMetrics.tenantId', `ALTER TABLE "StripeMetrics" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'gyc'`);
await runSql('PromiseLedgerItem.tenantId', `ALTER TABLE "PromiseLedgerItem" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'gyc'`);
await runSql('ReconDraft.tenantId', `ALTER TABLE "ReconDraft" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'gyc'`);
await runSql('ReconLocation.tenantId', `ALTER TABLE "ReconLocation" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'gyc'`);
await runSql('DailyRevenue_tenantId_idx', `CREATE INDEX IF NOT EXISTS "DailyRevenue_tenantId_idx" ON "DailyRevenue" ("tenantId")`);
await runSql('StripeCustomer_tenantId_idx', `CREATE INDEX IF NOT EXISTS "StripeCustomer_tenantId_idx" ON "StripeCustomer" ("tenantId")`);
await runSql('StripeMetrics_tenantId_idx', `CREATE INDEX IF NOT EXISTS "StripeMetrics_tenantId_idx" ON "StripeMetrics" ("tenantId")`);

// ===== STEP 2: Seed ClientIdentityMap =====
console.log('\n--- STEP 2: ClientIdentityMap seed ---');
await runSql('ClientIdentityMap count check', `SELECT COUNT(*) FROM "ClientIdentityMap" WHERE "tenantId" = 'gyc'`);
await runSql('ClientIdentityMap seed', `
  INSERT INTO "ClientIdentityMap" ("tenantId", "clientSlug", "displayName", "stripeCustomerId", "ghlContactId")
  SELECT 
    'gyc',
    id as "clientSlug",
    COALESCE("companyName", name) as "displayName",
    id as "stripeCustomerId",
    "ghlContactId"
  FROM "StripeCustomer"
  WHERE status IN ('active', 'past_due')
  ON CONFLICT ("tenantId", "clientSlug") DO NOTHING
`);
await runSql('ClientIdentityMap final count', `SELECT COUNT(*) FROM "ClientIdentityMap" WHERE "tenantId" = 'gyc'`);

// ===== STEP 3: HIGH priority integration tables =====
console.log('\n--- STEP 3: Integration tables ---');
const integrationTables = [
  'CXHandoff', 'CXHandoffCall', 'CXHandoffDataGap',
  'ZoomCall', 'ZoomTranscript', 'CallAnalysis',
  'ClientFunnelMonth', 'ClientGAMetrics', 'ClientGoogleAds',
  'ApiConnection', 'AsanaSnapshot', 'AsanaAssigneeLoad',
];
for (const t of integrationTables) {
  await runSql(`${t}.tenantId`, `ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'gyc'`);
}

// ===== STEP 4: Final counts =====
console.log('\n--- STEP 4: Final counts ---');
await runSql('tables_with_tenantId count', `
  SELECT COUNT(DISTINCT table_name) as tables_with_tenantId
  FROM information_schema.columns
  WHERE column_name = 'tenantId' AND table_schema = 'public'
`);
await runSql('tables WITHOUT tenantId', `
  SELECT table_name 
  FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    AND table_name NOT IN (
      SELECT DISTINCT table_name FROM information_schema.columns 
      WHERE column_name = 'tenantId' AND table_schema = 'public'
    )
  ORDER BY table_name
`);

await client.end();
console.log('\nDone.');
