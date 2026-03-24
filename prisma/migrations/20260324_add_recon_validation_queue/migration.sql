CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS "ReconDraft" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "prospectName" TEXT NOT NULL,
  "websiteUrl" TEXT NOT NULL,
  "requestedBy" TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  "rawAutoData" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "validatedData" JSONB,
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMPTZ,
  notes TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "ReconDraft_status_createdAt_idx"
  ON "ReconDraft" (status, "createdAt" DESC);

CREATE TABLE IF NOT EXISTS "ReconLocation" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "reconDraftId" UUID NOT NULL REFERENCES "ReconDraft" (id) ON DELETE CASCADE,
  "locationName" TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  "googleMapsUrl" TEXT,
  "gbpClaimed" TEXT NOT NULL DEFAULT 'unknown',
  "gbpStatus" TEXT NOT NULL DEFAULT 'not-found',
  "reviewNotes" TEXT,
  "autoData" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "manualData" JSONB,
  "locationIndex" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "ReconLocation_reconDraftId_locationIndex_idx"
  ON "ReconLocation" ("reconDraftId", "locationIndex");

CREATE OR REPLACE FUNCTION set_recon_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recon_draft_updated_at ON "ReconDraft";
CREATE TRIGGER trg_recon_draft_updated_at
BEFORE UPDATE ON "ReconDraft"
FOR EACH ROW
EXECUTE FUNCTION set_recon_updated_at();

DROP TRIGGER IF EXISTS trg_recon_location_updated_at ON "ReconLocation";
CREATE TRIGGER trg_recon_location_updated_at
BEFORE UPDATE ON "ReconLocation"
FOR EACH ROW
EXECUTE FUNCTION set_recon_updated_at();
