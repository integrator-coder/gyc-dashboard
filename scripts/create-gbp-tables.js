#!/usr/bin/env node
// Run: node scripts/create-gbp-tables.js
import pg from 'pg'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '..', '.env.local') })

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

const sql = `
-- GBP Locations (one per client/location, manually set up by GA)
CREATE TABLE IF NOT EXISTS "GBPLocation" (
  "id" SERIAL PRIMARY KEY,
  "tenantId" TEXT NOT NULL DEFAULT 'gyc',
  "clientAcronym" TEXT NOT NULL,
  "locationName" TEXT NOT NULL,
  "gbpPlaceId" TEXT,
  "gbpUrl" TEXT,
  "address" TEXT,
  "city" TEXT,
  "state" TEXT,
  "isActive" BOOLEAN DEFAULT TRUE,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  UNIQUE("tenantId", "clientAcronym", "locationName")
);
CREATE INDEX IF NOT EXISTS "GBPLocation_client_idx" ON "GBPLocation" ("tenantId", "clientAcronym");

-- GBP Audits (historical, append-only — never overwrite)
CREATE TABLE IF NOT EXISTS "GBPAudit" (
  "id" SERIAL PRIMARY KEY,
  "tenantId" TEXT NOT NULL DEFAULT 'gyc',
  "locationId" INTEGER NOT NULL REFERENCES "GBPLocation"("id"),
  "auditDate" TIMESTAMP DEFAULT NOW(),
  "triggerType" TEXT NOT NULL DEFAULT 'manual',
  "triggeredBy" TEXT,
  "isClaimed" BOOLEAN,
  "reviewCount" INTEGER,
  "avgRating" DECIMAL(3,2),
  "photoCount" INTEGER,
  "primaryCategoryCorrect" BOOLEAN,
  "secondaryCategoriesSet" BOOLEAN,
  "descriptionComplete" BOOLEAN,
  "websiteLinked" BOOLEAN,
  "phoneListened" BOOLEAN,
  "hoursComplete" BOOLEAN,
  "has50Reviews" BOOLEAN,
  "ratingAbove4" BOOLEAN,
  "respondedToReviews" BOOLEAN,
  "photoRecentMonth" BOOLEAN,
  "postRecentWeek" BOOLEAN,
  "qaActive" BOOLEAN,
  "servicesListed" BOOLEAN,
  "serviceAreaConfigured" BOOLEAN,
  "specialHoursUpdated" BOOLEAN,
  "checklistNotes" JSONB DEFAULT '{}',
  "compositeScore" INTEGER,
  "auditNotes" TEXT,
  "snapshotData" JSONB DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS "GBPAudit_location_idx" ON "GBPAudit" ("locationId");
CREATE INDEX IF NOT EXISTS "GBPAudit_date_idx" ON "GBPAudit" ("auditDate");

-- GBP Monthly Snapshots (automated, no human input)
CREATE TABLE IF NOT EXISTS "GBPSnapshot" (
  "id" SERIAL PRIMARY KEY,
  "tenantId" TEXT NOT NULL DEFAULT 'gyc',
  "locationId" INTEGER NOT NULL REFERENCES "GBPLocation"("id"),
  "snapshotDate" DATE NOT NULL,
  "reviewCount" INTEGER,
  "avgRating" DECIMAL(3,2),
  "photoCount" INTEGER,
  "postCount" INTEGER,
  "responseRate" DECIMAL(5,2),
  "rankKeyword1" INTEGER,
  "rankKeyword2" INTEGER,
  "syncedAt" TIMESTAMP DEFAULT NOW(),
  UNIQUE("locationId", "snapshotDate")
);
`

try {
  const client = await pool.connect()
  await client.query(sql)
  client.release()
  console.log('✅ GBP tables created successfully')
} catch (err) {
  console.error('❌ Error creating tables:', err.message)
  process.exit(1)
} finally {
  await pool.end()
}
