CREATE TABLE IF NOT EXISTS "ClientWebsiteAuditSnapshot" (
  id BIGSERIAL PRIMARY KEY,
  "tenantId" TEXT NOT NULL DEFAULT 'gyc',
  "clientAcronym" TEXT NOT NULL,
  "periodMonth" TEXT NOT NULL,
  "websiteUrl" TEXT,
  "pageSpeedScore" INTEGER,
  "pageSpeedLcp" NUMERIC(8, 2),
  "pageSpeedTbt" NUMERIC(10, 2),
  "pageSpeedCls" NUMERIC(8, 3),
  "mobileScore" INTEGER,
  "mobileMaxScore" INTEGER,
  "technicalSeoScore" INTEGER,
  "topIssues" JSONB NOT NULL DEFAULT '[]'::jsonb,
  source TEXT,
  "checkedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClientWebsiteAuditSnapshot_client_period_unique"
  ON "ClientWebsiteAuditSnapshot" ("tenantId", "clientAcronym", "periodMonth");

CREATE INDEX IF NOT EXISTS "ClientWebsiteAuditSnapshot_client_period_idx"
  ON "ClientWebsiteAuditSnapshot" ("tenantId", "clientAcronym", "periodMonth" DESC);
