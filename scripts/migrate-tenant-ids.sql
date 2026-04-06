-- migrate-tenant-ids.sql
-- M3 Multi-tenancy: Add tenantId to core client data tables and seed ClientIdentityMap
-- Run date: 2026-04-06
-- Author: R2 (Wall·E builder agent)

-- ============================================================
-- Part 1: Core client data tables
-- ============================================================
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'gyc';
ALTER TABLE "ClientContract" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'gyc';
ALTER TABLE "ClientFunnelMonth" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'gyc';
ALTER TABLE "ClientGAMetrics" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'gyc';
ALTER TABLE "ClientGoogleAds" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'gyc';
ALTER TABLE "DailyRevenue" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'gyc';
ALTER TABLE "StripeCustomer" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'gyc';
ALTER TABLE "StripeMetrics" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'gyc';

-- Auth tables (access control foundation)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'gyc';
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'gyc';

-- ============================================================
-- Part 2: Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS "Client_tenantId_idx" ON "Client" ("tenantId");
CREATE INDEX IF NOT EXISTS "ClientContract_tenantId_idx" ON "ClientContract" ("tenantId");
CREATE INDEX IF NOT EXISTS "ClientFunnelMonth_tenantId_idx" ON "ClientFunnelMonth" ("tenantId");
CREATE INDEX IF NOT EXISTS "ClientGAMetrics_tenantId_idx" ON "ClientGAMetrics" ("tenantId");
CREATE INDEX IF NOT EXISTS "ClientGoogleAds_tenantId_idx" ON "ClientGoogleAds" ("tenantId");
CREATE INDEX IF NOT EXISTS "DailyRevenue_tenantId_idx" ON "DailyRevenue" ("tenantId");
CREATE INDEX IF NOT EXISTS "StripeCustomer_tenantId_idx" ON "StripeCustomer" ("tenantId");
CREATE INDEX IF NOT EXISTS "StripeMetrics_tenantId_idx" ON "StripeMetrics" ("tenantId");
CREATE INDEX IF NOT EXISTS "User_tenantId_idx" ON "User" ("tenantId");

-- ============================================================
-- Part 3: Seed ClientIdentityMap from active StripeCustomers
-- clientSlug = Stripe customer ID (unique, deduplication-proof)
-- Can be enriched with proper acronym slugs later
-- ============================================================
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
ON CONFLICT ("tenantId", "clientSlug") DO NOTHING;

-- ============================================================
-- Verification queries
-- ============================================================
-- SELECT column_name, table_name 
-- FROM information_schema.columns 
-- WHERE column_name = 'tenantId' 
-- AND table_schema = 'public'
-- ORDER BY table_name;

-- SELECT COUNT(*) FROM "ClientIdentityMap" WHERE "tenantId" = 'gyc';
