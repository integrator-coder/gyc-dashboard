import { pool, tableExists } from '@/lib/pg'

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

function absoluteDelta(current, baseline) {
  const currentNumber = toNumber(current)
  const baselineNumber = toNumber(baseline)

  if (currentNumber == null || baselineNumber == null) return null
  return Number((currentNumber - baselineNumber).toFixed(1))
}

function buildMetricComparison(current, previous, trailingThreeAverage) {
  return {
    current: toNumber(current),
    vsLastMonthPct: percentageDelta(current, previous),
    vsLastMonthDelta: absoluteDelta(current, previous),
    vsThreeMonthAvgPct: percentageDelta(current, trailingThreeAverage),
    vsThreeMonthAvgDelta: absoluteDelta(current, trailingThreeAverage),
  }
}

function formatSignedNumber(value, suffix = '') {
  const numeric = toNumber(value)
  if (numeric == null) return null
  return `${numeric > 0 ? '+' : ''}${numeric.toFixed(1)}${suffix}`
}

function buildSourceDistribution(metrics) {
  if (!metrics) {
    return {
      available: false,
      metric: 'sessions',
      label: 'Sessions',
      honestLabel: 'Latest 30d grouped channel sessions',
      note: 'Source mix uses available GA channel totals because exact users by source are not in the current schema yet.',
      total: 0,
      items: [],
    }
  }

  const organic = toNumber(metrics?.channels?.organicSearch) || 0
  const direct = toNumber(metrics?.channels?.directSessions) || 0
  const paid = (toNumber(metrics?.channels?.paidSearch) || 0) + (toNumber(metrics?.channels?.paidSocial) || 0)
  const social = toNumber(metrics?.channels?.organicSocial) || 0
  const referral = toNumber(metrics?.channels?.referral) || 0
  const currentSessions = toNumber(metrics?.sessions) || 0
  const known = organic + direct + paid + social + referral
  const inferredOther = Math.max(currentSessions - known, 0)

  const items = [
    { key: 'organic', label: 'Organic', value: organic },
    { key: 'direct', label: 'Direct', value: direct },
    { key: 'paid', label: 'Paid', value: paid },
    { key: 'social', label: 'Social', value: social },
    { key: 'referral-other', label: 'Referral / Other', value: referral + inferredOther },
  ].filter((item) => item.value > 0)

  const total = items.reduce((sum, item) => sum + item.value, 0)

  return {
    available: total > 0,
    metric: 'sessions',
    label: 'Sessions',
    honestLabel: 'Latest 30d grouped channel sessions',
    note: 'Source mix uses available GA channel totals because exact users by source are not in the current schema yet.',
    total,
    items: items
      .map((item) => ({
        ...item,
        share: total > 0 ? Number((item.value / total).toFixed(4)) : 0,
      }))
      .sort((a, b) => b.value - a.value),
  }
}

function buildTrafficInsights({ comparisons, sourceDistribution }) {
  const insights = []

  const topSource = sourceDistribution?.items?.[0] || null
  if (topSource && topSource.share != null) {
    insights.push(`${topSource.label} drove ${(topSource.share * 100).toFixed(0)}% of tracked channel traffic this month.`)
  }

  const sessionChange = comparisons?.sessions
  const engagementChange = comparisons?.engagementRate

  if (sessionChange?.vsLastMonthPct != null && engagementChange?.vsLastMonthDelta != null) {
    const sessionDirection = sessionChange.vsLastMonthPct >= 0 ? 'up' : 'down'
    const engagementDirection = engagementChange.vsLastMonthDelta >= 0 ? 'improved' : 'dipped'
    insights.push(
      `Sessions are ${sessionDirection} ${Math.abs(sessionChange.vsLastMonthPct).toFixed(1)}% vs last month, and engagement ${engagementDirection} ${Math.abs(engagementChange.vsLastMonthDelta).toFixed(1)} pts.`
    )
  } else if (sessionChange?.vsThreeMonthAvgPct != null) {
    const sessionDirection = sessionChange.vsThreeMonthAvgPct >= 0 ? 'above' : 'below'
    insights.push(`Sessions are ${Math.abs(sessionChange.vsThreeMonthAvgPct).toFixed(1)}% ${sessionDirection} the 3-month average.`)
  }

  if (!insights.length && engagementChange?.vsThreeMonthAvgDelta != null) {
    const engagementDirection = engagementChange.vsThreeMonthAvgDelta >= 0 ? 'above' : 'below'
    insights.push(`Engagement rate is ${Math.abs(engagementChange.vsThreeMonthAvgDelta).toFixed(1)} pts ${engagementDirection} the 3-month average.`)
  }

  return insights.slice(0, 2)
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

  const bounceRate = toNumber(row.bounceRate)
  const engagementRate = toNumber(row.engagementRate) ?? (bounceRate == null ? null : clamp(Math.round(100 - bounceRate), 0, 100))

  return {
    periodMonth: row.periodMonth,
    sessions: toNumber(row.sessions),
    activeUsers: toNumber(row.activeUsers),
    newUsers: toNumber(row.newUsers),
    engagementRate,
    bounceRate,
    avgSessionDuration: toNumber(row.avgSessionDuration),
    checkedAt: row.checkedAt || row.updatedAt || row.createdAt || null,
    source: row.source || 'ClientWebsiteTrafficMonthly',
    derivedFromDaily: row.source === 'GAMetricsDaily',
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
        source,
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

async function getDailyBackfillHistory({ tenantId = 'gyc', propertyId, limit = 12 }) {
  if (!propertyId) return []
  if (!(await tableExists('"GAMetricsDaily"'))) return []

  const cappedLimit = Math.max(1, Math.min(Number(limit) || 12, 24))
  const { rows } = await pool.query(
    `
      SELECT
        to_char(date_trunc('month', date), 'YYYY-MM') AS "periodMonth",
        SUM(COALESCE(sessions, 0))::bigint AS sessions,
        SUM(COALESCE("newUsers", 0))::bigint AS "newUsers",
        CASE
          WHEN SUM(CASE WHEN "bounceRate" IS NOT NULL THEN COALESCE(sessions, 0) ELSE 0 END) > 0 THEN
            ROUND(
              (
                SUM(CASE WHEN "bounceRate" IS NOT NULL THEN "bounceRate" * COALESCE(sessions, 0) ELSE 0 END)::numeric /
                NULLIF(SUM(CASE WHEN "bounceRate" IS NOT NULL THEN COALESCE(sessions, 0) ELSE 0 END), 0)::numeric
              ) * 100,
              1
            )
          ELSE NULL
        END AS "bounceRate",
        CASE
          WHEN SUM(CASE WHEN "avgSessionDuration" IS NOT NULL THEN COALESCE(sessions, 0) ELSE 0 END) > 0 THEN
            ROUND(
              SUM(CASE WHEN "avgSessionDuration" IS NOT NULL THEN "avgSessionDuration" * COALESCE(sessions, 0) ELSE 0 END)::numeric /
              NULLIF(SUM(CASE WHEN "avgSessionDuration" IS NOT NULL THEN COALESCE(sessions, 0) ELSE 0 END), 0)::numeric,
              2
            )
          ELSE NULL
        END AS "avgSessionDuration",
        MAX("syncedAt") AS "checkedAt",
        'GAMetricsDaily' AS source
      FROM "GAMetricsDaily"
      WHERE "tenantId" = $1 AND "propertyId" = $2
      GROUP BY 1
      ORDER BY 1 DESC
      LIMIT $3
    `,
    [tenantId, propertyId, cappedLimit]
  )

  return rows.map(normalizeHistoryPoint).filter(Boolean).reverse()
}

function mergeHistoryPoints(...collections) {
  const merged = new Map()

  collections.flat().filter(Boolean).forEach((point) => {
    const key = point.periodMonth
    if (!key) return

    const existing = merged.get(key)
    if (!existing) {
      merged.set(key, point)
      return
    }

    merged.set(key, {
      ...existing,
      ...point,
      sessions: point.sessions ?? existing.sessions,
      activeUsers: point.activeUsers ?? existing.activeUsers,
      newUsers: point.newUsers ?? existing.newUsers,
      engagementRate: point.engagementRate ?? existing.engagementRate,
      bounceRate: point.bounceRate ?? existing.bounceRate,
      avgSessionDuration: point.avgSessionDuration ?? existing.avgSessionDuration,
      checkedAt: point.checkedAt ?? existing.checkedAt,
      source: point.source || existing.source,
      derivedFromDaily: Boolean(existing.derivedFromDaily || point.derivedFromDaily),
    })
  })

  return [...merged.values()]
    .sort((a, b) => String(a.periodMonth).localeCompare(String(b.periodMonth)))
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
  const trailingThreeSessionsAvg = average(trailingThree.map((point) => point.sessions))
  const trailingThreeUsersAvg = average(trailingThree.map((point) => point.activeUsers))
  const trailingThreeNewUsersAvg = average(trailingThree.map((point) => point.newUsers))
  const trailingThreeEngagementAvg = average(trailingThree.map((point) => point.engagementRate))
  const backfilledMonths = points.filter((point) => point.derivedFromDaily).length
  const exactMonths = points.length - backfilledMonths
  const activeUsersCoverageMonths = points.filter((point) => point.activeUsers != null).length
  const source = backfilledMonths > 0 && exactMonths > 0
    ? 'ClientWebsiteTrafficMonthly + GAMetricsDaily'
    : backfilledMonths > 0
      ? 'GAMetricsDaily'
      : 'ClientWebsiteTrafficMonthly'

  const summary = {
    available: true,
    points,
    source,
    coverageMonths: points.length,
    backfilledMonths,
    exactMonths,
    activeUsersCoverageMonths,
    comparisons: {
      sessions: buildMetricComparison(latest?.sessions, previous?.sessions, trailingThreeSessionsAvg),
      activeUsers: buildMetricComparison(latest?.activeUsers, previous?.activeUsers, trailingThreeUsersAvg),
      newUsers: buildMetricComparison(latest?.newUsers, previous?.newUsers, trailingThreeNewUsersAvg),
      engagementRate: {
        ...buildMetricComparison(latest?.engagementRate, previous?.engagementRate, trailingThreeEngagementAvg),
        vsLastMonthLabel: formatSignedNumber(absoluteDelta(latest?.engagementRate, previous?.engagementRate), ' pts'),
        vsThreeMonthAvgLabel: formatSignedNumber(absoluteDelta(latest?.engagementRate, trailingThreeEngagementAvg), ' pts'),
      },
    },
    message: null,
  }

  if (backfilledMonths > 0 && activeUsersCoverageMonths < points.length) {
    summary.message = `Backfilled ${backfilledMonths} month${backfilledMonths === 1 ? '' : 's'} from daily GA history. Sessions, new users, and engagement are backfilled where possible. Active users appear once monthly snapshots have been captured.`
  } else if (points.length === 1) {
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
  const [storedHistoryPoints, dailyHistoryPoints] = await Promise.all([
    getMonthlyHistory({ tenantId, clientAcronym: normalizedAcronym, limit: 12 }),
    getDailyBackfillHistory({ tenantId, propertyId: normalized.propertyId, limit: 12 }),
  ])
  const historyPoints = mergeHistoryPoints(dailyHistoryPoints, storedHistoryPoints).slice(-12)
  const history = buildHistorySummary(historyPoints)
  const sourceDistribution = buildSourceDistribution(normalized.metrics)
  const insights = buildTrafficInsights({ comparisons: history.comparisons, sourceDistribution })

  return {
    connected: true,
    reason: null,
    message: null,
    ...normalized,
    history,
    sourceDistribution,
    insights,
  }
}
