import { pool, tableExists } from '@/lib/pg'

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
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

async function getDailyTrend(propertyId, tenantId) {
  if (!propertyId || !(await tableExists('"GAMetricsDaily"'))) {
    return { available: false, points: [], message: '30-day trend will appear once daily GA sync is available.' }
  }

  const { rows } = await pool.query(
    `
      SELECT date, sessions, "activeUsers"
      FROM "GAMetricsDaily"
      WHERE "tenantId" = $1 AND "propertyId" = $2
      ORDER BY date DESC
      LIMIT 30
    `,
    [tenantId, propertyId]
  )

  if (!rows.length) {
    return { available: false, points: [], message: '30-day trend will appear once daily GA sync is available.' }
  }

  const points = rows
    .map((row) => ({
      date: row.date,
      sessions: toNumber(row.sessions),
      activeUsers: toNumber(row.activeUsers),
    }))
    .reverse()

  return { available: true, points, message: null }
}

export async function getClientWebsiteTraffic({ tenantId = 'gyc', clientAcronym }) {
  if (!clientAcronym) {
    return {
      connected: false,
      reason: 'missing_client',
      message: 'Client acronym is required.',
      metrics: null,
      trend: { available: false, points: [], message: null },
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
      metrics: null,
      trend: { available: false, points: [], message: null },
    }
  }

  const trend = await getDailyTrend(normalized.propertyId, tenantId)

  return {
    connected: true,
    reason: null,
    message: trend.message,
    ...normalized,
    trend,
  }
}
