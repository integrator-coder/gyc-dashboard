CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS "ZoomCall" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "meetingId" TEXT NOT NULL,
  "meetingUuid" TEXT,
  "meetingTopic" TEXT,
  "startedAt" TIMESTAMPTZ,
  "durationSecs" INTEGER,
  "repName" TEXT,
  "clientName" TEXT,
  "callDate" DATE,
  "callLink" TEXT,
  "matchMethod" TEXT NOT NULL,
  "matchConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "matchReasonCode" TEXT,
  "sourceRef" TEXT NOT NULL,
  purposes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "ZoomCall_meetingId_sourceRef_key"
  ON "ZoomCall" ("meetingId", "sourceRef");
CREATE INDEX IF NOT EXISTS "ZoomCall_meetingId_idx"
  ON "ZoomCall" ("meetingId");
CREATE INDEX IF NOT EXISTS "ZoomCall_callDate_idx"
  ON "ZoomCall" ("callDate");
CREATE INDEX IF NOT EXISTS "ZoomCall_clientName_idx"
  ON "ZoomCall" ("clientName");

CREATE TABLE IF NOT EXISTS "ZoomTranscript_new" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "zoomCallId" UUID NOT NULL UNIQUE REFERENCES "ZoomCall" (id) ON DELETE CASCADE,
  "vttRaw" TEXT NOT NULL,
  "parsedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "ZoomTranscript_new_zoomCallId_idx"
  ON "ZoomTranscript_new" ("zoomCallId");

CREATE TABLE IF NOT EXISTS "ZoomTranscriptSegment_new" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "transcriptId" UUID NOT NULL REFERENCES "ZoomTranscript_new" (id) ON DELETE CASCADE,
  "startMs" INTEGER NOT NULL,
  "endMs" INTEGER,
  speaker TEXT,
  text TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  purposes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "ZoomTranscriptSegment_new_transcriptId_idx"
  ON "ZoomTranscriptSegment_new" ("transcriptId");
CREATE INDEX IF NOT EXISTS "ZoomTranscriptSegment_new_startMs_idx"
  ON "ZoomTranscriptSegment_new" ("startMs");

CREATE TABLE IF NOT EXISTS "CallAnalysis" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "zoomCallId" UUID NOT NULL REFERENCES "ZoomCall" (id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  "analysisJson" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "CallAnalysis_zoomCallId_purpose_key"
  ON "CallAnalysis" ("zoomCallId", purpose);
CREATE INDEX IF NOT EXISTS "CallAnalysis_purpose_idx"
  ON "CallAnalysis" (purpose);

CREATE TABLE IF NOT EXISTS "CXHandoffCall" (
  "handoffId" INTEGER NOT NULL REFERENCES "CXHandoff" (id) ON DELETE CASCADE,
  "zoomCallId" UUID NOT NULL REFERENCES "ZoomCall" (id) ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("handoffId", "zoomCallId")
);

CREATE INDEX IF NOT EXISTS "CXHandoffCall_zoomCallId_idx"
  ON "CXHandoffCall" ("zoomCallId");

WITH evidence_source AS (
  SELECT
    e.id AS evidence_id,
    e."handoffId",
    COALESCE(z."meetingId", CONCAT('legacy-evidence:', e.id)) AS meeting_id,
    NULL::TEXT AS meeting_uuid,
    z."meetingTopic" AS meeting_topic,
    z."startedAt" AS started_at,
    z."durationSecs" AS duration_secs,
    h."repName" AS rep_name,
    h."clientName" AS client_name,
    (e."callDate")::DATE AS call_date,
    e."callLink" AS call_link,
    COALESCE(e."matchMethod", CASE WHEN z.id IS NOT NULL THEN 'legacy' ELSE 'unresolved' END) AS match_method,
    COALESCE(e."matchConfidence", 0) AS match_confidence,
    e."sourceRef" AS match_reason_code,
    CONCAT(COALESCE(LOWER(e.source), 'legacy'), ':row:', COALESCE(e."sourceRef", e.id::TEXT)) AS source_ref,
    CASE WHEN LOWER(COALESCE(e.source, '')) = 'zoom' OR z.id IS NOT NULL THEN ARRAY['handoff']::TEXT[] ELSE ARRAY[]::TEXT[] END AS purposes,
    e."createdAt" AS created_at
  FROM "HandoffEvidence" e
  JOIN "CXHandoff" h ON h.id = e."handoffId"
  LEFT JOIN "ZoomTranscript" z ON z."handoffEvidenceId" = e.id
), inserted_calls AS (
  INSERT INTO "ZoomCall"
    ("meetingId", "meetingUuid", "meetingTopic", "startedAt", "durationSecs", "repName", "clientName", "callDate", "callLink", "matchMethod", "matchConfidence", "matchReasonCode", "sourceRef", purposes, "createdAt")
  SELECT
    meeting_id,
    meeting_uuid,
    meeting_topic,
    started_at,
    duration_secs,
    rep_name,
    client_name,
    call_date,
    call_link,
    match_method,
    match_confidence,
    match_reason_code,
    source_ref,
    purposes,
    created_at
  FROM evidence_source
  ON CONFLICT ("meetingId", "sourceRef") DO NOTHING
  RETURNING id, "meetingId", "sourceRef"
)
INSERT INTO "CXHandoffCall" ("handoffId", "zoomCallId", "createdAt")
SELECT DISTINCT
  es."handoffId",
  zc.id,
  COALESCE(es.created_at, NOW())
FROM evidence_source es
JOIN "ZoomCall" zc
  ON zc."meetingId" = es.meeting_id
 AND zc."sourceRef" = es.source_ref
WHERE es.purposes <> ARRAY[]::TEXT[]
ON CONFLICT ("handoffId", "zoomCallId") DO NOTHING;

INSERT INTO "ZoomTranscript_new" ("zoomCallId", "vttRaw", "parsedAt", "createdAt")
SELECT
  zc.id,
  z."vttRaw",
  NOW(),
  z."createdAt"
FROM "ZoomTranscript" z
JOIN "HandoffEvidence" e ON e.id = z."handoffEvidenceId"
JOIN "ZoomCall" zc
  ON zc."meetingId" = COALESCE(z."meetingId", CONCAT('legacy-evidence:', e.id))
 AND zc."sourceRef" = CONCAT(COALESCE(LOWER(e.source), 'legacy'), ':row:', COALESCE(e."sourceRef", e.id::TEXT))
ON CONFLICT ("zoomCallId") DO NOTHING;

INSERT INTO "ZoomTranscriptSegment_new" ("transcriptId", "startMs", "endMs", speaker, text, tags, purposes, "createdAt")
SELECT
  ztn.id,
  s."startMs",
  s."endMs",
  s.speaker,
  s.text,
  CASE WHEN s.tag IS NULL OR s.tag = '' THEN ARRAY[]::TEXT[] ELSE ARRAY[s.tag]::TEXT[] END,
  ARRAY['handoff']::TEXT[],
  NOW()
FROM "ZoomTranscriptSegment" s
JOIN "ZoomTranscript" z ON z.id = s."transcriptId"
JOIN "HandoffEvidence" e ON e.id = z."handoffEvidenceId"
JOIN "ZoomCall" zc
  ON zc."meetingId" = COALESCE(z."meetingId", CONCAT('legacy-evidence:', e.id))
 AND zc."sourceRef" = CONCAT(COALESCE(LOWER(e.source), 'legacy'), ':row:', COALESCE(e."sourceRef", e.id::TEXT))
JOIN "ZoomTranscript_new" ztn ON ztn."zoomCallId" = zc.id;

DROP TABLE IF EXISTS "ZoomTranscriptSegment";
DROP TABLE IF EXISTS "ZoomTranscript";
DROP TABLE IF EXISTS "HandoffEvidence";

ALTER TABLE "ZoomTranscript_new" RENAME TO "ZoomTranscript";
ALTER TABLE "ZoomTranscriptSegment_new" RENAME TO "ZoomTranscriptSegment";

ALTER INDEX IF EXISTS "ZoomTranscript_new_zoomCallId_idx" RENAME TO "ZoomTranscript_zoomCallId_idx";
ALTER INDEX IF EXISTS "ZoomTranscriptSegment_new_transcriptId_idx" RENAME TO "ZoomTranscriptSegment_transcriptId_idx";
ALTER INDEX IF EXISTS "ZoomTranscriptSegment_new_startMs_idx" RENAME TO "ZoomTranscriptSegment_startMs_idx";

CREATE OR REPLACE FUNCTION set_call_analysis_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_call_analysis_updated_at ON "CallAnalysis";
CREATE TRIGGER trg_call_analysis_updated_at
BEFORE UPDATE ON "CallAnalysis"
FOR EACH ROW
EXECUTE FUNCTION set_call_analysis_updated_at();
