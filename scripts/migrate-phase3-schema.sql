-- Phase 3: Historical data schema
-- SalesDeal: accumulates all sales deal rows from Google Sheets
-- GAMetricsDaily: daily GA metrics per property (populated by Eve later)

-- ─── SalesDeal ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "SalesDeal" (
  id BIGSERIAL PRIMARY KEY,
  "yearLabel" TEXT NOT NULL,
  "dealDate" DATE,
  "clientName" TEXT,
  service TEXT,
  quarter TEXT,
  month TEXT,
  "firstPayment" NUMERIC(10,2) DEFAULT 0,
  mrr NUMERIC(10,2) DEFAULT 0,
  term NUMERIC(5,2) DEFAULT 0,
  "fullTerm" NUMERIC(10,2) DEFAULT 0,
  "firstYear" NUMERIC(10,2) DEFAULT 0,
  pif BOOLEAN DEFAULT FALSE,
  "renewalAmount" NUMERIC(10,2) DEFAULT 0,
  rep TEXT,
  "dealType" TEXT,
  "syncedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE("yearLabel", "dealDate", "clientName", service, rep)
);

CREATE INDEX IF NOT EXISTS "SalesDeal_yearLabel_idx" ON "SalesDeal" ("yearLabel");
CREATE INDEX IF NOT EXISTS "SalesDeal_dealDate_idx" ON "SalesDeal" ("dealDate");
CREATE INDEX IF NOT EXISTS "SalesDeal_rep_idx" ON "SalesDeal" (rep);

-- ─── GAMetricsDaily ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "GAMetricsDaily" (
  id BIGSERIAL PRIMARY KEY,
  "propertyId" TEXT NOT NULL,
  "propertyName" TEXT,
  "date" DATE NOT NULL,
  sessions BIGINT DEFAULT 0,
  "activeUsers" BIGINT DEFAULT 0,
  "newUsers" BIGINT DEFAULT 0,
  "bounceRate" NUMERIC(5,4) DEFAULT 0,
  "avgSessionDuration" NUMERIC(10,2) DEFAULT 0,
  "organicSearch" BIGINT DEFAULT 0,
  "paidSearch" BIGINT DEFAULT 0,
  "directSessions" BIGINT DEFAULT 0,
  "organicSocial" BIGINT DEFAULT 0,
  "syncedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE("propertyId", "date")
);

CREATE INDEX IF NOT EXISTS "GAMetricsDaily_date_idx" ON "GAMetricsDaily" ("date");
CREATE INDEX IF NOT EXISTS "GAMetricsDaily_propertyId_idx" ON "GAMetricsDaily" ("propertyId");
