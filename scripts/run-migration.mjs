import pg from 'pg';
const { Client } = pg;

const DATABASE_URL = 'postgresql://neondb_owner:npg_ilJbVI72fDxh@ep-red-smoke-aks7z27o-pooler.c-3.us-west-2.aws.neon.tech/neondb?channel_binding=require&connect_timeout=15&sslmode=require';

const client = new Client({ connectionString: DATABASE_URL });

async function run() {
  await client.connect();
  console.log('Connected to Neon DB');

  // Part 1: Add tenantId columns
  const alterStatements = [
    ['Client', `ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'gyc'`],
    ['ClientContract', `ALTER TABLE "ClientContract" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'gyc'`],
    ['ClientFunnelMonth', `ALTER TABLE "ClientFunnelMonth" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'gyc'`],
    ['ClientGAMetrics', `ALTER TABLE "ClientGAMetrics" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'gyc'`],
    ['ClientGoogleAds', `ALTER TABLE "ClientGoogleAds" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'gyc'`],
    ['DailyRevenue', `ALTER TABLE "DailyRevenue" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'gyc'`],
    ['StripeCustomer', `ALTER TABLE "StripeCustomer" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'gyc'`],
    ['StripeMetrics', `ALTER TABLE "StripeMetrics" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'gyc'`],
    ['User', `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'gyc'`],
    ['Organization', `ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'gyc'`],
  ];

  console.log('\n=== Part 1: Adding tenantId columns ===');
  for (const [table, sql] of alterStatements) {
    try {
      await client.query(sql);
      console.log(`✅ ${table}: tenantId column added/exists`);
    } catch (err) {
      console.error(`❌ ${table}: ${err.message}`);
    }
  }

  // Add indexes
  const indexes = [
    `CREATE INDEX IF NOT EXISTS "Client_tenantId_idx" ON "Client" ("tenantId")`,
    `CREATE INDEX IF NOT EXISTS "ClientContract_tenantId_idx" ON "ClientContract" ("tenantId")`,
    `CREATE INDEX IF NOT EXISTS "ClientFunnelMonth_tenantId_idx" ON "ClientFunnelMonth" ("tenantId")`,
    `CREATE INDEX IF NOT EXISTS "ClientGAMetrics_tenantId_idx" ON "ClientGAMetrics" ("tenantId")`,
    `CREATE INDEX IF NOT EXISTS "ClientGoogleAds_tenantId_idx" ON "ClientGoogleAds" ("tenantId")`,
    `CREATE INDEX IF NOT EXISTS "DailyRevenue_tenantId_idx" ON "DailyRevenue" ("tenantId")`,
    `CREATE INDEX IF NOT EXISTS "StripeCustomer_tenantId_idx" ON "StripeCustomer" ("tenantId")`,
    `CREATE INDEX IF NOT EXISTS "StripeMetrics_tenantId_idx" ON "StripeMetrics" ("tenantId")`,
    `CREATE INDEX IF NOT EXISTS "User_tenantId_idx" ON "User" ("tenantId")`,
  ];

  console.log('\n=== Creating indexes ===');
  for (const sql of indexes) {
    try {
      await client.query(sql);
      const tableName = sql.match(/"(\w+)_tenantId_idx"/)[1];
      console.log(`✅ Index on ${tableName}.tenantId`);
    } catch (err) {
      console.error(`❌ Index error: ${err.message}`);
    }
  }

  // Part 2: Seed ClientIdentityMap
  console.log('\n=== Part 2: Seeding ClientIdentityMap ===');
  try {
    // Check current count
    const before = await client.query(`SELECT COUNT(*) FROM "ClientIdentityMap"`);
    console.log(`Before: ${before.rows[0].count} rows`);

    const seedResult = await client.query(`
      INSERT INTO "ClientIdentityMap" (
        "tenantId",
        "clientSlug",
        "displayName",
        "stripeCustomerId",
        "ghlContactId"
      )
      SELECT
        'gyc',
        id,
        COALESCE("companyName", name),
        id,
        "ghlContactId"
      FROM "StripeCustomer"
      WHERE status IN ('active', 'past_due')
      ON CONFLICT ("tenantId", "clientSlug") DO NOTHING
    `);
    console.log(`✅ Inserted ${seedResult.rowCount} rows into ClientIdentityMap`);

    const after = await client.query(`SELECT COUNT(*) FROM "ClientIdentityMap" WHERE "tenantId" = 'gyc'`);
    console.log(`After: ${after.rows[0].count} rows for tenantId='gyc'`);
  } catch (err) {
    console.error(`❌ ClientIdentityMap seed error: ${err.message}`);
  }

  // Part 4: Verify tenantId columns
  console.log('\n=== Part 4: Verification ===');
  try {
    const verifyResult = await client.query(`
      SELECT column_name, table_name 
      FROM information_schema.columns 
      WHERE column_name = 'tenantId' 
      AND table_schema = 'public'
      ORDER BY table_name
    `);
    console.log('Tables with tenantId column:');
    for (const row of verifyResult.rows) {
      console.log(`  - ${row.table_name}`);
    }
    console.log(`Total: ${verifyResult.rows.length} tables`);

    const mapCount = await client.query(`SELECT COUNT(*) FROM "ClientIdentityMap" WHERE "tenantId" = 'gyc'`);
    console.log(`\nClientIdentityMap rows (tenantId='gyc'): ${mapCount.rows[0].count}`);
  } catch (err) {
    console.error(`❌ Verification error: ${err.message}`);
  }

  await client.end();
  console.log('\nDone!');
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
