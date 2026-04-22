import { pool } from '@/lib/pg'

const WEBSITE_TRAFFIC_MONTHLY_TABLE = '"ClientWebsiteTrafficMonthly"'

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function toIsoMonth(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 7) : date.toISOString().slice(0, 7)
}

function average(values = []) {
  const filtered = values.filter((value) => value != null && Number.isFinite(Number(value))).map(Number)
  if (!filtered.length) return null
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length
}

function percentageDelta(current, baseline) {
  const currentNumber = toNumber(current)
  const baselineNumber = toNumber(baseline)

  if (currentNumber == null || baselineNumber == null || baselineNumber === 0) return null
  return Number((((currentNumber - baselineNumber) / baselineNumber) * 100).toFixed(1))
}

export async function ensureWebsiteTrafficMonthlyTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${WEBSITE_TRAFFIC_MONTHLY_TABLE} (
      id BIGSERIAL PRIMARY KEY,
      "tenantId" TEXT NOT NULL DEFAULT 'gyc',
      "clientAcronym" TEXT NOT NULL,
      "propertyId" TEXT,
      "periodMonth" TEXT NOT NULL,
      sessions INTEGER,
      "activeUsers" INTEGER,
      "newUsers" INTEGER,
      "engagementRate" INTEGER,
      "bounceRate" INTEGER,
      "avgSessionDuration" NUMERIC(10, 2),
      source TEXT,
      "checkedAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "ClientWebsiteTrafficMonthly_client_period_unique"
      ON ${WEBSITE_TRAFFIC_MONTHLY_TABLE} ("tenantId", "clientAcronym", "periodMonth")
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS "ClientWebsiteTrafficMonthly_client_period_idx"
      ON ${WEBSITE_TRAFFIC_MONTHLY_TABLE} ("tenantId", "clientAcronym", "periodMonth" DESC)
  `)
}

function normalizeTrafficRow(row) {
  if (!row) return null

  const bounceRate = toNumber(row.bounceRate)
  const engagementRate = bounceRate == null ? null : clamp(Math.round((1 - bounceRate) * 100), 0, 100)

  return {
    propertyId: row.propertyId || null,
    checkedAt: row.syncedAt || null,
    period: row.period || '30d',
    source: 'ClientGAMetrics',
    metrics: {
      activeUsers: toNumber(row.activeUsers),
      sessions: toNumber(row.sessions),
      newUsers: toNumber(row.newUsers),
      engagementRate,
      bounceRate: bounceRate == null ? null : Math.round(bounceRate * 100),
      avgSessionDuration: toNumber(row.avgSessionDuration),
      channels: {
        organicSearch: toNumber(row.organicSearch),
        paidSearch: toNumber(row.paidSearch),
        directSessions: toNumber(row.directSessions),
        organicSocial: toNumber(row.organicSocial),
        paidSocial: toNumber(row.paidSocial),
        referral: toNumber(row.referral),
      },
    },
  }
}

async function upsertWebsiteTrafficMonthlySnapshot({ tenantId = 'gyc', clientAcronym, traffic }) {
  if (!clientAcronym || !traffic?.checkedAt || !traffic?.metrics) return null

  await ensureWebsiteTrafficMonthlyTable()

  const periodMonth = toIsoMonth(traffic.checkedAt)
  const checkedAt = new Date(traffic.checkedAt)
  const normalizedAcronym = String(clientAcronym).trim().toUpperCase()

  const { rows } = await pool.query(
    `
      INSERT INTO ${WEBSITE_TRAFFIC_MONTHLY_TABLE} (
        "tenantId",
        "clientAcronym",
        "propertyId",
        "periodMonth",
        sessions,
        "activeUsers",
        "newUsers",
        "engagementRate",
        "bounceRate",
        "avgSessionDuration",
        source,
        "checkedAt",
        "createdAt",
        "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW()
      )
      ON CONFLICT ("tenantId", "clientAcronym", "periodMonth") DO UPDATE SET
        "propertyId" = EXCLUDED."propertyId",
        sessions = EXCLUDED.sessions,
        "activeUsers" = EXCLUDED."activeUsers",
        "newUsers" = EXCLUDED."newUsers",
        "engagementRate" = EXCLUDED."engagementRate",
        "bounceRate" = EXCLUDED."bounceRate",
        "avgSessionDuration" = EXCLUDED."avgSessionDuration",
        source = EXCLUDED.source,
        "checkedAt" = EXCLUDED."checkedAt",
        "updatedAt" = NOW()
      RETURNING *
    `,
    [
      tenantId,
      normalizedAcronym,
      traffic.propertyId || null,
      periodMonth,
      toNumber(traffic.metrics.sessions),
      toNumber(traffic.metrics.activeUsers),
      toNumber(traffic.metrics.newUsers),
      toNumber(traffic.metrics.engagementRate),
      toNumber(traffic.metrics.bounceRate),
      toNumber(traffic.metrics.avgSessionDuration),
      traffic.source || 'ClientGAMetrics',
      Number.isNaN(checkedAt.getTime()) ? new Date() : checkedAt,
    ]
  )

  return rows[0] || null
}

function normalizeHistoryPoint(row) {
  if (!row) return null

  return {
    periodMonth: row.periodMonth,
    sessions: toNumber(row.sessions),
    activeUsers: toNumber(row.activeUsers),
    newUsers: toNumber(row.newUsers),
    engagementRate: toNumber(row.engagementRate),
    bounceRate: toNumber(row.bounceRate),
    avgSessionDuration: toNumber(row.avgSessionDuration),
    checkedAt: row.checkedAt || row.updatedAt || row.createdAt || null,
  }
}

async function getMonthlyHistory({ tenantId = 'gyc', clientAcronym, limit = 12 }) {
  if (!clientAcronym) return []

  await ensureWebsiteTrafficMonthlyTable()

  const normalizedAcronym = String(clientAcronym).trim().toUpperCase()
  const cappedLimit = Math.max(1, Math.min(Number(limit) || 12, 24))
  const { rows } = await pool.query(
    `
      SELECT
        "periodMonth",
        sessions,
        "activeUsers",
        "newUsers",
        "engagementRate",
        "bounceRate",
        "avgSessionDuration",
        "checkedAt",
        "createdAt",
        "updatedAt"
      FROM ${WEBSITE_TRAFFIC_MONTHLY_TABLE}
      WHERE "tenantId" = $1 AND "clientAcronym" = $2
      ORDER BY "periodMonth" DESC
      LIMIT $3
    `,
    [tenantId, normalizedAcronym, cappedLimit]
  )

  return rows.map(normalizeHistoryPoint).filter(Boolean).reverse()
}

function buildHistorySummary(points) {
  if (!Array.isArray(points) || !points.length) {
    return {
      available: false,
      points: [],
      source: 'ClientWebsiteTrafficMonthly',
      comparisons: null,
      message: 'Monthly traffic history will build automatically from GA snapshots once data is available.',
    }
  }

  const latest = points[points.length - 1]
  const previous = points.length > 1 ? points[points.length - 2] : null
  const trailingThree = points.slice(Math.max(0, points.length - 4), points.length - 1)

  const summary = {
    available: true,
    points,
    source: 'ClientWebsiteTrafficMonthly',
    comparisons: {
      sessions: {
        vsLastMonthPct: percentageDelta(latest?.sessions, previous?.sessions),
        vsThreeMonthAvgPct: percentageDelta(latest?.sessions, average(trailingThree.map((point) => point.sessions))),
      },
      activeUsers: {
        vsLastMonthPct: percentageDelta(latest?.activeUsers, previous?.activeUsers),
        vsThreeMonthAvgPct: percentageDelta(latest?.activeUsers, average(trailingThree.map((point) => point.activeUsers))),
      },
    },
    message: null,
  }

  if (points.length === 1) {
    summary.message = 'Only the latest GA snapshot is available so far. Monthly history will fill in automatically over time.'
  } else if (points.length < 4) {
    summary.message = 'Monthly history is building. Three-month average comparisons will get stronger as more snapshots accumulate.'
  }

  return summary
}

export async function getClientWebsiteTraffic({ tenantId = 'gyc', clientAcronym }) {
  if (!clientAcronym) {
    return {
      connected: false,
      reason: 'missing_client',
      message: 'Client acronym is required.',
      history: buildHistorySummary([]),
      metrics: null,
    }
  }

  const normalizedAcronym = String(clientAcronym).trim().toUpperCase()
  const { rows } = await pool.query(
    `
      SELECT
        acronym,
        "propertyId",
        period,
        sessions,
        "activeUsers",
        "newUsers",
        "bounceRate",
        "organicSearch",
        "paidSearch",
        "directSessions",
        "organicSocial",
        "paidSocial",
        referral,
        "avgSessionDuration",
        "syncedAt"
      FROM "ClientGAMetrics"
      WHERE "tenantId" = $1 AND upper(COALESCE(acronym, '')) = $2
      ORDER BY CASE WHEN period = '30d' THEN 0 ELSE 1 END, "syncedAt" DESC NULLS LAST
      LIMIT 1
    `,
    [tenantId, normalizedAcronym]
  )

  const normalized = normalizeTrafficRow(rows[0])
  if (!normalized) {
    return {
      connected: false,
      reason: 'no_mapping',
      message: 'Google Analytics traffic data is not mapped for this client yet.',
      propertyId: null,
      checkedAt: null,
      history: buildHistorySummary([]),
      metrics: null,
    }
  }

  await upsertWebsiteTrafficMonthlySnapshot({ tenantId, clientAcronym: normalizedAcronym, traffic: normalized })
  const historyPoints = await getMonthlyHistory({ tenantId, clientAcronym: normalizedAcronym, limit: 12 })

  return {
    connected: true,
    reason: null,
    message: null,
    ...normalized,
    history: buildHistorySummary(historyPoints),
  }
}
