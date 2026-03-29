CREATE TABLE IF NOT EXISTS "CXHandoff" (
  id SERIAL PRIMARY KEY,
  "clientName" TEXT NOT NULL,
  "clientId" TEXT,
  "repName" TEXT,
  "closedAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "pipelinePhase" TEXT NOT NULL DEFAULT 'phase1-mvp',
  "rawOutputJson" JSONB NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "CXHandoff_clientName_closedAt_key"
  ON "CXHandoff" ("clientName", "closedAt");

CREATE INDEX IF NOT EXISTS "CXHandoff_closedAt_idx"
  ON "CXHandoff" ("closedAt");

CREATE TABLE IF NOT EXISTS "PromiseLedgerItem" (
  id SERIAL PRIMARY KEY,
  "handoffId" INTEGER NOT NULL REFERENCES "CXHandoff" (id) ON DELETE CASCADE,
  "promiseText" TEXT NOT NULL,
  category TEXT NOT NULL,
  owner TEXT,
  confidence TEXT,
  "riskFlag" TEXT,
  "reviewStatus" TEXT NOT NULL DEFAULT 'Pending Review',
  "reviewComment" TEXT,
  "evidenceSource" TEXT,
  "evidenceLink" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "PromiseLedgerItem_handoffId_idx"
  ON "PromiseLedgerItem" ("handoffId");

CREATE INDEX IF NOT EXISTS "PromiseLedgerItem_category_idx"
  ON "PromiseLedgerItem" (category);

CREATE TABLE IF NOT EXISTS "HandoffEvidence" (
  id SERIAL PRIMARY KEY,
  "handoffId" INTEGER NOT NULL REFERENCES "CXHandoff" (id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  "sourceRef" TEXT,
  "callDate" TIMESTAMPTZ,
  "callLink" TEXT,
  "matchMethod" TEXT,
  "matchConfidence" DOUBLE PRECISION,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "HandoffEvidence_handoffId_idx"
  ON "HandoffEvidence" ("handoffId");

CREATE INDEX IF NOT EXISTS "HandoffEvidence_source_sourceRef_idx"
  ON "HandoffEvidence" (source, "sourceRef");

CREATE TABLE IF NOT EXISTS "ZoomTranscript" (
  id SERIAL PRIMARY KEY,
  "handoffEvidenceId" INTEGER NOT NULL UNIQUE REFERENCES "HandoffEvidence" (id) ON DELETE CASCADE,
  "meetingId" TEXT NOT NULL,
  "meetingTopic" TEXT,
  "startedAt" TIMESTAMPTZ,
  "durationSecs" INTEGER,
  "vttRaw" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "ZoomTranscript_meetingId_idx"
  ON "ZoomTranscript" ("meetingId");

CREATE TABLE IF NOT EXISTS "ZoomTranscriptSegment" (
  id SERIAL PRIMARY KEY,
  "transcriptId" INTEGER NOT NULL REFERENCES "ZoomTranscript" (id) ON DELETE CASCADE,
  "startMs" INTEGER NOT NULL,
  "endMs" INTEGER,
  speaker TEXT,
  text TEXT NOT NULL,
  tag TEXT
);

CREATE INDEX IF NOT EXISTS "ZoomTranscriptSegment_transcriptId_idx"
  ON "ZoomTranscriptSegment" ("transcriptId");

CREATE INDEX IF NOT EXISTS "ZoomTranscriptSegment_tag_idx"
  ON "ZoomTranscriptSegment" (tag);

CREATE INDEX IF NOT EXISTS "ZoomTranscriptSegment_startMs_idx"
  ON "ZoomTranscriptSegment" ("startMs");
