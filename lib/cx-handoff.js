import { pool } from '@/lib/pg'

const TRANSCRIPT_PREVIEW_SEGMENTS = 3
const TRANSCRIPT_SEARCH_LIMIT = 10

function buildSnippet(parts = [], maxLength = 320) {
  const snippet = parts
    .filter(Boolean)
    .map((part) => String(part).trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!snippet) return ''
  if (snippet.length <= maxLength) return snippet
  return `${snippet.slice(0, maxLength - 1).trimEnd()}…`
}

const SCHEMA_SQL = `
ALTER TABLE "CXHandoff"
  ADD COLUMN IF NOT EXISTS "assignedGA" TEXT,
  ADD COLUMN IF NOT EXISTS "assignedGAEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "assignedGAAt" TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS "CXHandoffDataGap" (
  id SERIAL PRIMARY KEY,
  "handoffId" INT NOT NULL REFERENCES "CXHandoff"(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  "gapCode" TEXT NOT NULL,
  description TEXT NOT NULL,
  "filledBy" TEXT,
  "filledAt" TIMESTAMPTZ,
  "resolvedValue" TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "CXHandoffDataGap_handoffId_idx" ON "CXHandoffDataGap"("handoffId");
CREATE INDEX IF NOT EXISTS "CXHandoffDataGap_status_idx" ON "CXHandoffDataGap"(status);
CREATE UNIQUE INDEX IF NOT EXISTS "CXHandoffDataGap_handoffId_source_gapCode_description_key"
  ON "CXHandoffDataGap"("handoffId", source, "gapCode", description);
`

let schemaReadyPromise = null

function canonicalSource(source, gapCode = '', description = '') {
  const value = String(source || '').trim().toLowerCase()
  const combined = `${value} ${String(gapCode || '').toLowerCase()} ${String(description || '').toLowerCase()}`

  if (combined.includes('ghl')) return 'GHL'
  if (combined.includes('pandadoc') || combined.includes('contract')) return 'PandaDoc'
  if (combined.includes('zoom') || combined.includes('transcript') || combined.includes('recording') || combined.includes('call notes') || combined.includes('synthesis')) return 'Zoom'
  if (combined.includes('tracker') || combined.includes('activity log')) return 'Tracker'

  if (!source) return 'Tracker'
  return String(source).trim()
}

function normalizeGap(rawGap = {}) {
  const gapCode = String(rawGap.gapCode || rawGap.code || rawGap.key || 'UNSPECIFIED').trim() || 'UNSPECIFIED'
  const description = String(rawGap.description || rawGap.detail || rawGap.message || rawGap.reason || 'No description provided.').trim() || 'No description provided.'
  return {
    source: canonicalSource(rawGap.source, gapCode, description),
    gapCode,
    description,
  }
}

async function backfillDataGaps() {
  const { rows } = await pool.query(`
    SELECT id, COALESCE("rawOutputJson"->'dataGaps', '[]'::jsonb) AS "dataGaps"
    FROM "CXHandoff"
  `)

  for (const row of rows) {
    const gaps = Array.isArray(row.dataGaps) ? row.dataGaps : []
    for (const rawGap of gaps) {
      const gap = normalizeGap(rawGap)
      await pool.query(
        `
          INSERT INTO "CXHandoffDataGap" (
            "handoffId",
            source,
            "gapCode",
            description
          )
          VALUES ($1, $2, $3, $4)
          ON CONFLICT ("handoffId", source, "gapCode", description) DO NOTHING
        `,
        [row.id, gap.source, gap.gapCode, gap.description]
      )
    }
  }
}

export async function ensureCxHandoffSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await pool.query(SCHEMA_SQL)
      await backfillDataGaps()
    })().catch((error) => {
      schemaReadyPromise = null
      throw error
    })
  }

  return schemaReadyPromise
}

export async function getCxHandoffList() {
  await ensureCxHandoffSchema()

  const { rows } = await pool.query(`
    SELECT
      h.id,
      h."clientName",
      h."repName",
      h."assignedGA",
      h."assignedGAEmail",
      h."closedAt",
      COUNT(DISTINCT p.id)::int AS "promiseCount",
      COUNT(DISTINCT g.id) FILTER (WHERE g.status = 'open')::int AS "openGapCount"
    FROM "CXHandoff" h
    LEFT JOIN "PromiseLedgerItem" p ON p."handoffId" = h.id
    LEFT JOIN "CXHandoffDataGap" g ON g."handoffId" = h.id
    GROUP BY h.id
    ORDER BY h."closedAt" DESC NULLS LAST, h.id DESC
  `)

  return rows
}

export async function getCxHandoffDetail(handoffId) {
  await ensureCxHandoffSchema()

  const handoffResult = await pool.query(
    `
      SELECT
        id,
        "clientName",
        "clientId",
        "repName",
        "closedAt",
        "createdAt",
        "pipelinePhase",
        "assignedGA",
        "assignedGAEmail",
        "assignedGAAt",
        "rawOutputJson"
      FROM "CXHandoff"
      WHERE id = $1
      LIMIT 1
    `,
    [handoffId]
  )

  const handoff = handoffResult.rows[0]
  if (!handoff) return null

  const [promiseResult, dataGapResult, callsResult, transcriptResult, transcriptCountResult] = await Promise.all([
    pool.query(
      `
        SELECT
          id,
          "promiseText",
          category,
          owner,
          confidence,
          "riskFlag",
          "reviewStatus",
          "reviewComment",
          "evidenceSource",
          "evidenceLink",
          "createdAt"
        FROM "PromiseLedgerItem"
        WHERE "handoffId" = $1
        ORDER BY id ASC
      `,
      [handoffId]
    ),
    pool.query(
      `
        SELECT
          id,
          source,
          "gapCode",
          description,
          "filledBy",
          "filledAt",
          "resolvedValue",
          status,
          "createdAt"
        FROM "CXHandoffDataGap"
        WHERE "handoffId" = $1
        ORDER BY CASE WHEN status = 'open' THEN 0 ELSE 1 END, source ASC, id ASC
      `,
      [handoffId]
    ),
    pool.query(
      `
        SELECT
          zc.id,
          zc."meetingTopic",
          zc."callDate",
          zc."startedAt",
          zc."durationSecs",
          zc."callLink",
          zc."repName",
          zc."clientName",
          zc.acronym,
          zc."matchMethod",
          zc."matchConfidence"
        FROM "CXHandoffCall" hc
        JOIN "ZoomCall" zc ON zc.id = hc."zoomCallId"
        WHERE hc."handoffId" = $1
        ORDER BY COALESCE(zc."callDate", zc."startedAt") DESC NULLS LAST
      `,
      [handoffId]
    ),
    pool.query(
      `
        SELECT
          zc.id AS "zoomCallId",
          zt.id AS "transcriptId",
          zt."parsedAt",
          zt."createdAt",
          COALESCE(segment_counts."segmentCount", 0)::int AS "segmentCount",
          COALESCE(preview.preview_segments, '[]'::json) AS preview_segments,
          zc."meetingTopic",
          zc."callDate",
          zc."startedAt",
          zc."durationSecs",
          zc."callLink",
          zc."repName",
          zc."clientName"
        FROM "CXHandoffCall" hc
        JOIN "ZoomCall" zc ON zc.id = hc."zoomCallId"
        JOIN "ZoomTranscript" zt ON zt."zoomCallId" = hc."zoomCallId"
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS "segmentCount"
          FROM "ZoomTranscriptSegment" zs
          WHERE zs."transcriptId" = zt.id
        ) segment_counts ON TRUE
        LEFT JOIN LATERAL (
          SELECT JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', preview_rows.id,
              'speaker', preview_rows.speaker,
              'startMs', preview_rows."startMs",
              'text', preview_rows.text
            )
            ORDER BY preview_rows."startMs" ASC, preview_rows.id ASC
          ) AS preview_segments
          FROM (
            SELECT zs.id, zs.speaker, zs."startMs", zs.text
            FROM "ZoomTranscriptSegment" zs
            WHERE zs."transcriptId" = zt.id
            ORDER BY zs."startMs" ASC, zs.id ASC
            LIMIT ${TRANSCRIPT_PREVIEW_SEGMENTS}
          ) preview_rows
        ) preview ON TRUE
        WHERE hc."handoffId" = $1
        ORDER BY COALESCE(zc."callDate", zc."startedAt") DESC NULLS LAST
      `,
      [handoffId]
    ),
    pool.query(
      `
        SELECT COUNT(zs.id)::int AS "transcriptCount"
        FROM "CXHandoffCall" hc
        JOIN "ZoomTranscript" zt ON zt."zoomCallId" = hc."zoomCallId"
        LEFT JOIN "ZoomTranscriptSegment" zs ON zs."transcriptId" = zt.id
        WHERE hc."handoffId" = $1
      `,
      [handoffId]
    ),
  ])

  const transcripts = transcriptResult.rows.map((row) => {
    const previewSegments = Array.isArray(row.preview_segments) ? row.preview_segments : []
    return {
      zoomCallId: row.zoomCallId,
      transcriptId: row.transcriptId,
      parsedAt: row.parsedAt,
      createdAt: row.createdAt,
      segmentCount: row.segmentCount,
      meetingTopic: row.meetingTopic,
      callDate: row.callDate,
      startedAt: row.startedAt,
      durationSecs: row.durationSecs,
      zoomLink: row.callLink,
      repName: row.repName,
      clientName: row.clientName,
      previewSegments,
      snippet: buildSnippet(previewSegments.map((segment) => segment.text)),
    }
  })

  return {
    id: handoff.id,
    clientName: handoff.clientName,
    clientId: handoff.clientId,
    repName: handoff.repName,
    closedAt: handoff.closedAt,
    createdAt: handoff.createdAt,
    pipelinePhase: handoff.pipelinePhase,
    assignedGA: handoff.assignedGA,
    assignedGAEmail: handoff.assignedGAEmail,
    assignedGAAt: handoff.assignedGAAt,
    rawOutputJson: handoff.rawOutputJson || {},
    promiseLedgerItems: promiseResult.rows,
    dataGaps: dataGapResult.rows,
    salesCalls: callsResult.rows,
    transcripts,
    transcriptCount: transcriptCountResult.rows[0]?.transcriptCount || 0,
  }
}

export async function searchCxHandoffTranscriptSegments(handoffId, query) {
  await ensureCxHandoffSchema()

  const trimmedQuery = String(query || '').trim()
  if (!trimmedQuery) return []

  const { rows } = await pool.query(
    `
      SELECT
        zs.id,
        zs.speaker,
        zs."startMs",
        zs.text,
        zc."callDate",
        zc."startedAt",
        zc."repName",
        zc."callLink"
      FROM "CXHandoffCall" hc
      JOIN "ZoomCall" zc ON zc.id = hc."zoomCallId"
      JOIN "ZoomTranscript" zt ON zt."zoomCallId" = hc."zoomCallId"
      JOIN "ZoomTranscriptSegment" zs ON zs."transcriptId" = zt.id
      WHERE hc."handoffId" = $1
        AND zs.text ILIKE $2
      ORDER BY COALESCE(zc."callDate", zc."startedAt") DESC NULLS LAST, zs."startMs" ASC, zs.id ASC
      LIMIT ${TRANSCRIPT_SEARCH_LIMIT}
    `,
    [handoffId, `%${trimmedQuery}%`]
  )

  return rows.map((row) => ({
    id: row.id,
    speaker: row.speaker,
    startMs: row.startMs,
    callDate: row.callDate || row.startedAt,
    repName: row.repName,
    zoomLink: row.callLink,
    text: row.text,
    snippet: buildSnippet([row.text], 420),
  }))
}

export async function updateCxHandoffAssignment(handoffId, assignedGA, assignedGAEmail) {
  await ensureCxHandoffSchema()

  const cleanedName = String(assignedGA || '').trim() || null
  const cleanedEmail = String(assignedGAEmail || '').trim() || null
  const assignedGAAt = cleanedName ? new Date() : null

  const { rows } = await pool.query(
    `
      UPDATE "CXHandoff"
      SET
        "assignedGA" = $2,
        "assignedGAEmail" = $3,
        "assignedGAAt" = $4
      WHERE id = $1
      RETURNING id, "assignedGA", "assignedGAEmail", "assignedGAAt"
    `,
    [handoffId, cleanedName, cleanedEmail, assignedGAAt]
  )

  return rows[0] || null
}

export async function updateCxHandoffGap(handoffId, gapId, { resolvedValue, filledBy, status }) {
  await ensureCxHandoffSchema()

  const nextStatus = ['open', 'filled', 'not-applicable'].includes(String(status || '').trim())
    ? String(status).trim()
    : 'filled'

  const cleanedValue = String(resolvedValue || '').trim() || null
  const cleanedFilledBy = String(filledBy || '').trim() || null
  const filledAt = nextStatus === 'filled' ? new Date() : null

  const { rows } = await pool.query(
    `
      UPDATE "CXHandoffDataGap"
      SET
        "resolvedValue" = $3,
        "filledBy" = $4,
        status = $5,
        "filledAt" = CASE
          WHEN $5 = 'filled' THEN COALESCE("filledAt", $6)
          ELSE NULL
        END
      WHERE id = $2
        AND "handoffId" = $1
      RETURNING id, source, "gapCode", description, "filledBy", "filledAt", "resolvedValue", status, "createdAt"
    `,
    [handoffId, gapId, cleanedValue, cleanedFilledBy, nextStatus, filledAt]
  )

  return rows[0] || null
}

export async function updatePromiseReview(handoffId, promiseId, { reviewStatus, reviewComment }) {
  const cleanedStatus = String(reviewStatus || '').trim()
  const cleanedComment = String(reviewComment || '').trim() || null

  const { rows } = await pool.query(
    `
      UPDATE "PromiseLedgerItem"
      SET
        "reviewStatus" = $3,
        "reviewComment" = $4
      WHERE id = $2
        AND "handoffId" = $1
      RETURNING id, "reviewStatus", "reviewComment"
    `,
    [handoffId, promiseId, cleanedStatus || 'Pending Review', cleanedComment]
  )

  return rows[0] || null
}
