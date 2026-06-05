#!/usr/bin/env node
/**
 * Google Ads Schema Migration
 * Creates ClientGoogleAdsSnapshot table and adds googleAdsCustomerId to ClientProfile
 * Run: node scripts/migrate-google-ads-schema.mjs
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const { Client } = pg;

const SQL_MIGRATION = `
-- Add googleAdsCustomerId to ClientProfile
ALTER TABLE "ClientProfile" 
ADD COLUMN IF NOT EXISTS "googleAdsCustomerId" TEXT;

-- Create ClientGoogleAdsSnapshot table
CREATE TABLE IF NOT EXISTS "ClientGoogleAdsSnapshot" (
  id                    SERIAL PRIMARY KEY,
  "tenantId"            TEXT NOT NULL DEFAULT 'gyc',
  "clientId"            INTEGER REFERENCES "ClientProfile"(id),
  "companyAcronym"      TEXT,
  "customerId"          TEXT,        -- Google Ads customer ID (no dashes)
  "periodMonth"         TEXT,        -- YYYY-MM
  "impressions"         INTEGER,
  "clicks"              INTEGER,
  "spend"               NUMERIC(10,2),
  "conversions"         NUMERIC(8,2),
  "costPerConversion"   NUMERIC(10,2),
  "conversionRate"      NUMERIC(6,4),  -- decimal e.g. 0.0610
  "impressionShare"     NUMERIC(6,4),
  "activeCampaigns"     INTEGER,
  "campaignNames"       TEXT[],
  "topKeywords"         TEXT[],
  "budgetUtilization"   NUMERIC(6,4),  -- spend/budget
  "syncedAt"            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "dataSource"          TEXT DEFAULT 'google-ads-api',
  UNIQUE("tenantId", "companyAcronym", "periodMonth")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "CGAS_acronym_idx" ON "ClientGoogleAdsSnapshot"("companyAcronym");
CREATE INDEX IF NOT EXISTS "CGAS_period_idx" ON "ClientGoogleAdsSnapshot"("periodMonth");
CREATE INDEX IF NOT EXISTS "CGAS_tenant_idx" ON "ClientGoogleAdsSnapshot"("tenantId");

-- Create index on new ClientProfile field
CREATE INDEX IF NOT EXISTS "CP_googleAdsCustomerId_idx" ON "ClientProfile"("googleAdsCustomerId");
`;

async function runMigration() {
  const databaseUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ No database URL found. Set NEON_DATABASE_URL or DATABASE_URL in .env.local');
    process.exit(1);
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected');

    console.log('🚀 Running Google Ads schema migration...');
    await client.query(SQL_MIGRATION);
    console.log('✅ Migration complete');

    // Verify tables exist
    console.log('\n📊 Verifying schema...');
    const result = await client.query(`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE table_name IN ('ClientGoogleAdsSnapshot', 'ClientProfile')
        AND (table_name = 'ClientGoogleAdsSnapshot' 
             OR (table_name = 'ClientProfile' AND column_name = 'googleAdsCustomerId'))
      ORDER BY table_name, ordinal_position
    `);

    console.log('\n✅ Schema verification:');
    let currentTable = '';
    for (const row of result.rows) {
      if (row.table_name !== currentTable) {
        currentTable = row.table_name;
        console.log(`\n  ${currentTable}:`);
      }
      console.log(`    - ${row.column_name}`);
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration()
    .then(() => {
      console.log('\n✅ All done!');
      process.exit(0);
    })
    .catch(err => {
      console.error('\n❌ Fatal error:', err);
      process.exit(1);
    });
}

export { runMigration };
