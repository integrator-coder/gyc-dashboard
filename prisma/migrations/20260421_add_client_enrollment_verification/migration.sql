CREATE TABLE IF NOT EXISTS "ClientEnrollmentVerification" (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "tenantId" TEXT NOT NULL DEFAULT 'gyc',
  "clientAcronym" TEXT NOT NULL,
  "locationName" TEXT,
  "periodMonth" TEXT NOT NULL,
  status TEXT NOT NULL,
  capacity INTEGER,
  "currentEnrollment" INTEGER,
  "avgTuition" NUMERIC(10,2),
  "checkedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "checkedBy" TEXT,
  notes TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "ClientEnrollmentVerification_client_idx"
  ON "ClientEnrollmentVerification" ("tenantId", "clientAcronym", "periodMonth" DESC);

CREATE UNIQUE INDEX IF NOT EXISTS "ClientEnrollmentVerification_client_period_unique"
  ON "ClientEnrollmentVerification" ("tenantId", "clientAcronym", "periodMonth")
  WHERE "locationName" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "ClientEnrollmentVerification_location_period_unique"
  ON "ClientEnrollmentVerification" ("tenantId", "clientAcronym", "locationName", "periodMonth")
  WHERE "locationName" IS NOT NULL;
