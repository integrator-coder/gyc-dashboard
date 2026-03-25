import { pool } from '@/lib/pg'

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

  const [promiseResult, dataGapResult, callsResult] = await Promise.all([
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
  ])

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
  }
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
