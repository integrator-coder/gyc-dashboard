CREATE TABLE IF NOT EXISTS "ClientGAMetrics" (
  acronym TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  period TEXT NOT NULL,
  sessions INTEGER NOT NULL DEFAULT 0,
  "activeUsers" INTEGER NOT NULL DEFAULT 0,
  "newUsers" INTEGER NOT NULL DEFAULT 0,
  "bounceRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "organicSearch" INTEGER NOT NULL DEFAULT 0,
  "paidSearch" INTEGER NOT NULL DEFAULT 0,
  "directSessions" INTEGER NOT NULL DEFAULT 0,
  "organicSocial" INTEGER NOT NULL DEFAULT 0,
  "paidSocial" INTEGER NOT NULL DEFAULT 0,
  referral INTEGER NOT NULL DEFAULT 0,
  "avgSessionDuration" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "syncedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "ClientGAMetrics_pkey" PRIMARY KEY (acronym, period)
);

CREATE INDEX IF NOT EXISTS "ClientGAMetrics_period_sessions_idx"
  ON "ClientGAMetrics" (period, sessions DESC);
