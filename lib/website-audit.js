import { pool } from '@/lib/pg'

const DATAFORSEO_BASE_URL = (process.env.DATAFORSEO_BASE_URL || 'https://api.dataforseo.com').replace(/\/$/, '')
const WEBSITE_AUDIT_SNAPSHOT_TABLE = '"ClientWebsiteAuditSnapshot"'
const WEBSITE_AUDIT_STALE_DAYS = 45

const LIGHTHOUSE_ENDPOINT_CANDIDATES = [
  '/v3/on_page/lighthouse/live/json',
]

const LIGHTHOUSE_PAYLOAD_CANDIDATES = (websiteUrl) => [
  [{ url: websiteUrl, for_mobile: true, tag: 'gyc-dashboard-website-audit' }],
  [{ target: websiteUrl, for_mobile: true, tag: 'gyc-dashboard-website-audit' }],
  [{ url: websiteUrl, device: 'mobile', tag: 'gyc-dashboard-website-audit' }],
]

const ISSUE_AUDIT_PRIORITY = [
  'render-blocking-resources',
  'largest-contentful-paint',
  'total-blocking-time',
  'cumulative-layout-shift',
  'server-response-time',
  'uses-text-compression',
  'unused-javascript',
  'unused-css-rules',
  'modern-image-formats',
  'uses-responsive-images',
  'offscreen-images',
  'unminified-css',
  'unminified-javascript',
  'document-title',
  'meta-description',
  'link-text',
  'crawlable-anchors',
  'is-crawlable',
  'robots-txt',
  'tap-targets',
  'font-size',
  'viewport',
  'content-width',
]

const MOBILE_CHECK_METADATA = [
  {
    key: 'viewport',
    label: 'Viewport configured',
    readinessWeight: 10,
    issueWeight: 5,
    issueLabel: 'Viewport not configured',
    subscoreGroup: 'readability',
    subscoreWeight: 20,
  },
  {
    key: 'content-width',
    label: 'Fits mobile screen',
    readinessWeight: 10,
    issueWeight: 6,
    issueLabel: 'Content wider than phone screen',
    subscoreGroup: 'readability',
    subscoreWeight: 40,
  },
  {
    key: 'tap-targets',
    label: 'Tap targets usable',
    readinessWeight: 10,
    issueWeight: 7,
    issueLabel: 'Tap targets too close',
    subscoreGroup: 'tapUsability',
    subscoreWeight: 100,
  },
  {
    key: 'font-size',
    label: 'Font size readable',
    readinessWeight: 10,
    issueWeight: 7,
    issueLabel: 'Some text too small',
    subscoreGroup: 'readability',
    subscoreWeight: 40,
  },
]

const MOBILE_CHECK_METADATA_BY_KEY = Object.fromEntries(
  MOBILE_CHECK_METADATA.map((item) => [item.key, item])
)

const MOBILE_CHECK_KEY_ALIASES = Object.fromEntries(
  MOBILE_CHECK_METADATA.flatMap((item) => [
    [item.key.toLowerCase(), item.key],
    [item.label.toLowerCase(), item.key],
  ])
)

const MOBILE_PERFORMANCE_SIGNAL_WEIGHTS = {
  pageSpeedScore: 20,
  lcp: 7,
  tbt: 4,
  cls: 4,
}

const SEO_AUDIT_KEYS = [
  ['is-crawlable', 'Homepage indexable'],
  ['document-title', 'Title tag present'],
  ['meta-description', 'Meta description present'],
  ['link-text', 'Link text descriptive'],
  ['crawlable-anchors', 'Crawlable links'],
]

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toIsoMonth(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 7) : date.toISOString().slice(0, 7)
}

function parseJsonObject(value) {
  if (!value) return null
  if (typeof value === 'object' && !Array.isArray(value)) return value

  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function getAuditAgeDays(checkedAt) {
  if (!checkedAt) return null

  const checked = checkedAt instanceof Date ? checkedAt : new Date(checkedAt)
  if (Number.isNaN(checked.getTime())) return null

  return Math.max(0, Math.floor((Date.now() - checked.getTime()) / (1000 * 60 * 60 * 24)))
}

function buildSnapshotMessage({ stale, ageDays, websiteMismatch }) {
  if (websiteMismatch) {
    return 'Showing the last cached audit snapshot. The website URL changed since that snapshot, so refresh when convenient.'
  }

  if (stale && ageDays != null) {
    return `Showing cached audit data from ${ageDays} day${ageDays === 1 ? '' : 's'} ago. Refresh when you want a newer audit.`
  }

  return null
}

function normalizeSnapshotAudit(row, websiteUrl) {
  if (!row) return null

  const checkedAt = row.checkedAt || row.updatedAt || row.createdAt || null
  const ageDays = getAuditAgeDays(checkedAt)
  const stale = ageDays != null ? ageDays > WEBSITE_AUDIT_STALE_DAYS : false
  const normalizedWebsiteUrl = normalizeWebsiteUrl(websiteUrl)
  const snapshotWebsiteUrl = normalizeWebsiteUrl(row.websiteUrl)
  const websiteMismatch = Boolean(normalizedWebsiteUrl && snapshotWebsiteUrl && normalizedWebsiteUrl !== snapshotWebsiteUrl)

  const pageSpeedData = parseJsonObject(row.pageSpeedData)
  const mobileData = parseJsonObject(row.mobileData)
  const technicalSeoData = parseJsonObject(row.technicalSeoData)

  const pageSpeedScore = toNumber(row.pageSpeedScore)
  const mobileScore = toNumber(row.mobileScore)
  const mobileMaxScore = toNumber(row.mobileMaxScore)
  const technicalSeoScore = toNumber(row.technicalSeoScore)

  const normalizedPageSpeed = pageSpeedData || {
    score: pageSpeedScore,
    ...getScoreStatus(pageSpeedScore),
    lcp: toNumber(row.pageSpeedLcp),
    tbt: toNumber(row.pageSpeedTbt),
    cls: toNumber(row.pageSpeedCls),
    topIssues: [],
  }

  const storedMobile = mobileData || {
    score: mobileScore,
    maxScore: mobileMaxScore,
    ...getMobileStatus(mobileScore, mobileMaxScore),
    checks: [],
    topIssues: [],
  }

  return {
    configured: true,
    cached: true,
    stale,
    staleReason: websiteMismatch ? 'website_changed' : stale ? 'age' : null,
    ageDays,
    websiteUrl: normalizedWebsiteUrl || snapshotWebsiteUrl || null,
    checkedAt,
    reason: null,
    message: buildSnapshotMessage({ stale, ageDays, websiteMismatch }),
    source: row.source || 'db_cache',
    pageSpeed: normalizedPageSpeed,
    mobile: buildMobileFriendlinessScorecard({
      checks: normalizeStoredMobileChecks(storedMobile),
      pageSpeed: normalizedPageSpeed,
      fallbackIssues: Array.isArray(storedMobile?.topIssues) ? storedMobile.topIssues : [],
    }),
    technicalSeo: technicalSeoData || {
      score: technicalSeoScore,
      ...getSeoStatus(technicalSeoScore),
      nonIndexable: null,
      brokenIssues: null,
      duplicateMeta: null,
      healthChecks: [],
      topIssues: [],
    },
    topIssues: normalizeWebsiteTopIssues(Array.isArray(row.topIssues) ? row.topIssues : []),
  }
}

export function normalizeWebsiteUrl(value) {
  const raw = String(value || '').trim()
  if (!raw) return null

  try {
    const normalized = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`
    return new URL(normalized).toString()
  } catch {
    return null
  }
}

export function getDataForSeoConfig() {
  const login = String(
    process.env.DATAFORSEO_LOGIN ||
    process.env.DATAFORSEO_EMAIL ||
    process.env.DATAFORSEO_USERNAME ||
    ''
  ).trim()

  const password = String(
    process.env.DATAFORSEO_PASSWORD ||
    process.env.DATAFORSEO_API_PASSWORD ||
    ''
  ).trim()

  return {
    login,
    password,
    configured: Boolean(login && password),
    baseUrl: DATAFORSEO_BASE_URL,
  }
}

export async function ensureWebsiteAuditSnapshotTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${WEBSITE_AUDIT_SNAPSHOT_TABLE} (
      id BIGSERIAL PRIMARY KEY,
      "tenantId" TEXT NOT NULL DEFAULT 'gyc',
      "clientAcronym" TEXT NOT NULL,
      "periodMonth" TEXT NOT NULL,
      "websiteUrl" TEXT,
      "pageSpeedScore" INTEGER,
      "pageSpeedLcp" NUMERIC(8, 2),
      "pageSpeedTbt" NUMERIC(10, 2),
      "pageSpeedCls" NUMERIC(8, 3),
      "mobileScore" INTEGER,
      "mobileMaxScore" INTEGER,
      "technicalSeoScore" INTEGER,
      "pageSpeedData" JSONB,
      "mobileData" JSONB,
      "technicalSeoData" JSONB,
      "topIssues" JSONB NOT NULL DEFAULT '[]'::jsonb,
      source TEXT,
      "checkedAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "ClientWebsiteAuditSnapshot_client_period_unique"
      ON ${WEBSITE_AUDIT_SNAPSHOT_TABLE} ("tenantId", "clientAcronym", "periodMonth")
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS "ClientWebsiteAuditSnapshot_client_period_idx"
      ON ${WEBSITE_AUDIT_SNAPSHOT_TABLE} ("tenantId", "clientAcronym", "periodMonth" DESC)
  `)

  await pool.query(`ALTER TABLE ${WEBSITE_AUDIT_SNAPSHOT_TABLE} ADD COLUMN IF NOT EXISTS "pageSpeedData" JSONB`)
  await pool.query(`ALTER TABLE ${WEBSITE_AUDIT_SNAPSHOT_TABLE} ADD COLUMN IF NOT EXISTS "mobileData" JSONB`)
  await pool.query(`ALTER TABLE ${WEBSITE_AUDIT_SNAPSHOT_TABLE} ADD COLUMN IF NOT EXISTS "technicalSeoData" JSONB`)
}

function canPersistWebsiteAuditSnapshot(audit) {
  if (!audit || typeof audit !== 'object') return false
  if (!audit.configured || audit.reason || !audit.websiteUrl || !audit.checkedAt) return false

  return [
    audit.pageSpeed?.score,
    audit.mobile?.score,
    audit.technicalSeo?.score,
  ].some((value) => value != null)
}

export async function upsertWebsiteAuditSnapshot({ tenantId = 'gyc', clientAcronym, audit }) {
  if (!clientAcronym || !canPersistWebsiteAuditSnapshot(audit)) return null

  await ensureWebsiteAuditSnapshotTable()

  const normalizedAcronym = String(clientAcronym).trim().toUpperCase()
  const periodMonth = toIsoMonth(audit.checkedAt)
  const checkedAt = new Date(audit.checkedAt)

  const { rows } = await pool.query(
    `
      INSERT INTO ${WEBSITE_AUDIT_SNAPSHOT_TABLE} (
        "tenantId",
        "clientAcronym",
        "periodMonth",
        "websiteUrl",
        "pageSpeedScore",
        "pageSpeedLcp",
        "pageSpeedTbt",
        "pageSpeedCls",
        "mobileScore",
        "mobileMaxScore",
        "technicalSeoScore",
        "pageSpeedData",
        "mobileData",
        "technicalSeoData",
        "topIssues",
        source,
        "checkedAt",
        "createdAt",
        "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb, $14::jsonb, $15::jsonb, $16::jsonb, $17, $18, NOW(), NOW()
      )
      ON CONFLICT ("tenantId", "clientAcronym", "periodMonth") DO UPDATE SET
        "websiteUrl" = EXCLUDED."websiteUrl",
        "pageSpeedScore" = EXCLUDED."pageSpeedScore",
        "pageSpeedLcp" = EXCLUDED."pageSpeedLcp",
        "pageSpeedTbt" = EXCLUDED."pageSpeedTbt",
        "pageSpeedCls" = EXCLUDED."pageSpeedCls",
        "mobileScore" = EXCLUDED."mobileScore",
        "mobileMaxScore" = EXCLUDED."mobileMaxScore",
        "technicalSeoScore" = EXCLUDED."technicalSeoScore",
        "pageSpeedData" = EXCLUDED."pageSpeedData",
        "mobileData" = EXCLUDED."mobileData",
        "technicalSeoData" = EXCLUDED."technicalSeoData",
        "topIssues" = EXCLUDED."topIssues",
        source = EXCLUDED.source,
        "checkedAt" = EXCLUDED."checkedAt",
        "updatedAt" = NOW()
      RETURNING *
    `,
    [
      tenantId,
      normalizedAcronym,
      periodMonth,
      audit.websiteUrl,
      toNumber(audit.pageSpeed?.score),
      toNumber(audit.pageSpeed?.lcp),
      toNumber(audit.pageSpeed?.tbt),
      toNumber(audit.pageSpeed?.cls),
      toNumber(audit.mobile?.score),
      toNumber(audit.mobile?.maxScore),
      toNumber(audit.technicalSeo?.score),
      JSON.stringify(audit.pageSpeed || null),
      JSON.stringify(audit.mobile || null),
      JSON.stringify(audit.technicalSeo || null),
      JSON.stringify(Array.isArray(audit.topIssues) ? audit.topIssues : []),
      audit.source || null,
      Number.isNaN(checkedAt.getTime()) ? new Date() : checkedAt,
    ]
  )

  return rows[0] || null
}

export async function listWebsiteAuditSnapshotHistory({ tenantId = 'gyc', clientAcronym, limit = 12 }) {
  if (!clientAcronym) return []

  await ensureWebsiteAuditSnapshotTable()

  const normalizedAcronym = String(clientAcronym).trim().toUpperCase()
  const cappedLimit = Math.max(1, Math.min(Number(limit) || 12, 24))
  const { rows } = await pool.query(
    `
      SELECT
        "periodMonth",
        "websiteUrl",
        "pageSpeedScore",
        "pageSpeedLcp",
        "pageSpeedTbt",
        "pageSpeedCls",
        "mobileScore",
        "mobileMaxScore",
        "technicalSeoScore",
        "pageSpeedData",
        "mobileData",
        "technicalSeoData",
        "topIssues",
        source,
        "checkedAt",
        "createdAt",
        "updatedAt"
      FROM ${WEBSITE_AUDIT_SNAPSHOT_TABLE}
      WHERE "tenantId" = $1 AND "clientAcronym" = $2
      ORDER BY "periodMonth" DESC
      LIMIT $3
    `,
    [tenantId, normalizedAcronym, cappedLimit]
  )

  return rows.map((row) => {
    const pageSpeed = parseJsonObject(row.pageSpeedData) || {
      score: toNumber(row.pageSpeedScore),
      lcp: toNumber(row.pageSpeedLcp),
      tbt: toNumber(row.pageSpeedTbt),
      cls: toNumber(row.pageSpeedCls),
    }

    const storedMobile = parseJsonObject(row.mobileData) || {
      score: toNumber(row.mobileScore),
      maxScore: toNumber(row.mobileMaxScore),
      checks: [],
      topIssues: [],
    }

    return {
      periodMonth: row.periodMonth,
      websiteUrl: row.websiteUrl,
      pageSpeed,
      mobile: buildMobileFriendlinessScorecard({
        checks: normalizeStoredMobileChecks(storedMobile),
        pageSpeed,
        fallbackIssues: Array.isArray(storedMobile?.topIssues) ? storedMobile.topIssues : [],
      }),
      technicalSeo: parseJsonObject(row.technicalSeoData) || {
        score: toNumber(row.technicalSeoScore),
      },
      topIssues: normalizeWebsiteTopIssues(Array.isArray(row.topIssues) ? row.topIssues : []),
      source: row.source,
      checkedAt: row.checkedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  })
}

export async function getLatestWebsiteAuditSnapshot({ tenantId = 'gyc', clientAcronym, websiteUrl = null }) {
  if (!clientAcronym) return null

  await ensureWebsiteAuditSnapshotTable()

  const normalizedAcronym = String(clientAcronym).trim().toUpperCase()
  const { rows } = await pool.query(
    `
      SELECT
        "periodMonth",
        "websiteUrl",
        "pageSpeedScore",
        "pageSpeedLcp",
        "pageSpeedTbt",
        "pageSpeedCls",
        "mobileScore",
        "mobileMaxScore",
        "technicalSeoScore",
        "pageSpeedData",
        "mobileData",
        "technicalSeoData",
        "topIssues",
        source,
        "checkedAt",
        "createdAt",
        "updatedAt"
      FROM ${WEBSITE_AUDIT_SNAPSHOT_TABLE}
      WHERE "tenantId" = $1 AND "clientAcronym" = $2
      ORDER BY "checkedAt" DESC NULLS LAST, "periodMonth" DESC, "updatedAt" DESC
      LIMIT 1
    `,
    [tenantId, normalizedAcronym]
  )

  return normalizeSnapshotAudit(rows[0] || null, websiteUrl)
}

function buildBasePayload({ configured, websiteUrl, reason = null, message = null }) {
  return {
    configured,
    websiteUrl,
    checkedAt: null,
    reason,
    message,
    pageSpeed: null,
    mobile: null,
    technicalSeo: null,
    topIssues: [],
  }
}

export function buildNoWebsiteAuditPayload() {
  return buildBasePayload({
    configured: false,
    websiteUrl: null,
    reason: 'no_website',
    message: 'No website URL is on record for this client yet.',
  })
}

export function buildUnconfiguredWebsiteAuditPayload(websiteUrl) {
  return buildBasePayload({
    configured: false,
    websiteUrl,
    reason: 'unconfigured',
    message: 'DataForSEO not configured yet on this node.',
  })
}

export function buildFailedWebsiteAuditPayload(websiteUrl, message) {
  return buildBasePayload({
    configured: true,
    websiteUrl,
    reason: 'fetch_failed',
    message: message || 'Unable to fetch website audit data right now.',
  })
}

export function buildPendingWebsiteAuditPayload(websiteUrl) {
  return buildBasePayload({
    configured: true,
    websiteUrl,
    reason: 'no_cached_snapshot',
    message: 'No cached website audit yet. Use Refresh Audit to create the first snapshot.',
  })
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.headers || {}),
    },
    cache: 'no-store',
    signal: options.signal || AbortSignal.timeout(20000),
  })

  const text = await response.text()
  let json = null

  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      json = null
    }
  }

  if (!response.ok) {
    const message = json?.status_message || json?.error?.message || json?.error || text || `Request failed (${response.status})`
    throw new Error(message)
  }

  return json
}

async function fetchText(url) {
  const response = await fetch(url, {
    cache: 'no-store',
    redirect: 'follow',
    signal: AbortSignal.timeout(8000),
  })

  const text = await response.text()
  return {
    ok: response.ok,
    status: response.status,
    url: response.url,
    text,
  }
}

async function fetchDataForSeoLighthouse(websiteUrl, config) {
  const authHeader = `Basic ${Buffer.from(`${config.login}:${config.password}`).toString('base64')}`
  let lastError = null

  for (const endpoint of LIGHTHOUSE_ENDPOINT_CANDIDATES) {
    for (const payload of LIGHTHOUSE_PAYLOAD_CANDIDATES(websiteUrl)) {
      try {
        const json = await fetchJson(`${config.baseUrl}${endpoint}`, {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })

        return json
      } catch (error) {
        lastError = error
      }
    }
  }

  throw lastError || new Error('DataForSEO Lighthouse request failed.')
}

function collectObjects(value, matcher, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 8) return []
  const hits = []

  if (matcher(value)) hits.push(value)

  if (Array.isArray(value)) {
    for (const item of value) hits.push(...collectObjects(item, matcher, depth + 1))
    return hits
  }

  for (const nested of Object.values(value)) {
    hits.push(...collectObjects(nested, matcher, depth + 1))
  }

  return hits
}

function findFirstLighthousePayload(response) {
  const directTaskPayload = response?.tasks
    ?.flatMap((task) => Array.isArray(task?.result) ? task.result : [])
    ?.find((candidate) => candidate?.categories?.performance && candidate?.audits)

  if (directTaskPayload) return directTaskPayload

  return collectObjects(
    response,
    (candidate) => candidate?.categories?.performance && candidate?.audits
  )[0] || null
}

function getAudit(audits, key) {
  return audits && typeof audits === 'object' ? audits[key] || null : null
}

function getAuditPassed(audit) {
  if (!audit || typeof audit !== 'object') return null
  if (typeof audit.score === 'number') return audit.score >= 0.9
  if (audit.score_display_mode === 'binary' || audit.scoreDisplayMode === 'binary') {
    return audit.score === 1
  }
  return null
}

function getScoreStatus(score) {
  if (score == null) return { status: 'unknown', label: 'Unavailable' }
  if (score >= 90) return { status: 'healthy', label: 'Fast' }
  if (score >= 50) return { status: 'warning', label: 'Needs improvement' }
  return { status: 'critical', label: 'Poor' }
}

function getMobileStatus(score, maxScore) {
  if (score == null || maxScore == null) return { status: 'unknown', label: 'Unavailable' }
  if (score >= maxScore) return { status: 'healthy', label: 'Looks good' }
  if (score >= Math.max(1, maxScore - 1)) return { status: 'warning', label: 'Needs attention' }
  return { status: 'critical', label: 'High risk' }
}

function getMobileFriendlinessStatus(score) {
  if (score == null) {
    return {
      status: 'unknown',
      label: 'Unavailable',
      interpretation: 'We do not have enough mobile audit data in this snapshot yet.',
    }
  }

  if (score >= 85) {
    return {
      status: 'healthy',
      label: 'Strong',
      interpretation: 'Easy for parents to read, trust, and take the next step on a phone.',
    }
  }

  if (score >= 70) {
    return {
      status: 'warning',
      label: 'Good but needs improvement',
      interpretation: 'Mostly usable on mobile, with a few friction points that could cost conversions.',
    }
  }

  if (score >= 50) {
    return {
      status: 'critical',
      label: 'Weak',
      interpretation: 'Parents will likely feel friction on mobile before they act.',
    }
  }

  return {
    status: 'critical',
    label: 'Poor / urgent',
    interpretation: 'Mobile visitors are likely struggling to read, trust, or take the next step.',
  }
}

function getSeoStatus(score) {
  if (score == null) return { status: 'unknown', label: 'Unavailable' }
  if (score >= 90) return { status: 'healthy', label: 'Healthy' }
  if (score >= 70) return { status: 'warning', label: 'Needs attention' }
  return { status: 'critical', label: 'At risk' }
}

function normalizeNumericScore(score) {
  const n = toNumber(score)
  if (n == null) return null
  return n <= 1 ? Math.round(n * 100) : Math.round(n)
}

function roundScore(value) {
  return value == null ? null : Math.round(value)
}

function scoreLowerIsBetter(value, goodThreshold, poorThreshold) {
  const n = toNumber(value)
  if (n == null) return null
  if (n <= goodThreshold) return 1
  if (n >= poorThreshold) return 0
  return clamp(1 - ((n - goodThreshold) / (poorThreshold - goodThreshold)), 0, 1)
}

function buildWeightedScore({ items = [], maxPoints }) {
  const availableItems = items.filter((item) => item && item.value != null && item.weight > 0)

  if (!availableItems.length) {
    return {
      score: null,
      maxPoints,
      availableWeight: 0,
      totalWeight: items.reduce((sum, item) => sum + (item?.weight || 0), 0),
    }
  }

  const availableWeight = availableItems.reduce((sum, item) => sum + item.weight, 0)
  const weightedValue = availableItems.reduce((sum, item) => sum + (item.value * item.weight), 0)

  return {
    score: roundScore((weightedValue / availableWeight) * maxPoints),
    maxPoints,
    availableWeight,
    totalWeight: items.reduce((sum, item) => sum + (item?.weight || 0), 0),
  }
}

function getMobileCheckKey(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return MOBILE_CHECK_KEY_ALIASES[normalized] || null
}

function normalizeStoredMobileChecks(mobile) {
  const checks = Array.isArray(mobile?.checks) ? mobile.checks : []
  const byKey = {}

  for (const check of checks) {
    const key = getMobileCheckKey(check?.key || check?.label)
    if (!key) continue

    const passed = typeof check?.passed === 'boolean' ? check.passed : null
    if (passed === null) continue

    byKey[key] = {
      key,
      label: MOBILE_CHECK_METADATA_BY_KEY[key]?.label || check.label || key,
      passed,
    }
  }

  return MOBILE_CHECK_METADATA
    .map((meta) => byKey[meta.key] || null)
    .filter(Boolean)
}

function normalizeMobileChecksFromAudits(audits) {
  return MOBILE_CHECK_METADATA
    .map((meta) => ({
      key: meta.key,
      label: meta.label,
      passed: getAuditPassed(getAudit(audits, meta.key)),
    }))
    .filter((item) => item.passed !== null)
}

function buildMobilePerformanceSignals(pageSpeed) {
  return [
    {
      key: 'pageSpeedScore',
      label: 'Mobile PageSpeed score',
      weight: MOBILE_PERFORMANCE_SIGNAL_WEIGHTS.pageSpeedScore,
      value: (() => {
        const score = toNumber(pageSpeed?.score)
        return score == null ? null : clamp(score / 100, 0, 1)
      })(),
    },
    {
      key: 'lcp',
      label: 'Largest Contentful Paint',
      weight: MOBILE_PERFORMANCE_SIGNAL_WEIGHTS.lcp,
      value: scoreLowerIsBetter(pageSpeed?.lcp, 2.5, 6),
    },
    {
      key: 'tbt',
      label: 'Total Blocking Time',
      weight: MOBILE_PERFORMANCE_SIGNAL_WEIGHTS.tbt,
      value: scoreLowerIsBetter(pageSpeed?.tbt, 200, 1000),
    },
    {
      key: 'cls',
      label: 'Cumulative Layout Shift',
      weight: MOBILE_PERFORMANCE_SIGNAL_WEIGHTS.cls,
      value: scoreLowerIsBetter(pageSpeed?.cls, 0.1, 0.3),
    },
  ]
}

function getMobilePerformanceIssueLabel(pageSpeed, performanceRatio) {
  const pageSpeedScore = toNumber(pageSpeed?.score)
  const lcp = toNumber(pageSpeed?.lcp)
  const tbt = toNumber(pageSpeed?.tbt)
  const cls = toNumber(pageSpeed?.cls)

  if (pageSpeedScore != null && pageSpeedScore < 50) return 'Mobile speed dragging experience'
  if (lcp != null && lcp >= 4) return 'Slow mobile load on key content'
  if (tbt != null && tbt >= 600) return 'Heavy scripts slowing phone interaction'
  if (cls != null && cls >= 0.25) return 'Mobile layout shifts feel jumpy'
  if (performanceRatio != null && performanceRatio < 0.85) return 'Mobile speed needs improvement'
  return null
}

function buildMobileSubscore(checks, group, fallbackValue = null) {
  const relevantChecks = checks
    .map((check) => ({
      ...check,
      meta: MOBILE_CHECK_METADATA_BY_KEY[check.key],
    }))
    .filter((check) => check.meta?.subscoreGroup === group)

  if (!relevantChecks.length) return fallbackValue

  const totalWeight = relevantChecks.reduce((sum, check) => sum + (check.meta?.subscoreWeight || 0), 0)
  if (!totalWeight) return fallbackValue

  const earnedWeight = relevantChecks.reduce((sum, check) => sum + (check.passed ? (check.meta?.subscoreWeight || 0) : 0), 0)
  return roundScore((earnedWeight / totalWeight) * 100)
}

function buildMobileCoverageNote({ missingLabels = [] }) {
  if (!missingLabels.length) {
    return 'V1 score using the current technical mobile audit signals.'
  }

  const preview = missingLabels.slice(0, 2).join(', ')
  const extraCount = Math.max(missingLabels.length - 2, 0)
  return `V1 score scaled to available signals. Missing: ${preview}${extraCount ? ` +${extraCount} more` : ''}.`
}

function buildMobileFriendlinessScorecard({ checks = [], pageSpeed = null, fallbackIssues = [] }) {
  const normalizedChecks = MOBILE_CHECK_METADATA
    .map((meta) => {
      const check = checks.find((candidate) => candidate?.key === meta.key)
      return check ? { ...check, label: meta.label } : null
    })
    .filter(Boolean)

  const readinessBreakdown = buildWeightedScore({
    items: normalizedChecks.map((check) => ({
      weight: MOBILE_CHECK_METADATA_BY_KEY[check.key]?.readinessWeight || 0,
      value: check.passed ? 1 : 0,
    })),
    maxPoints: 40,
  })

  const performanceSignals = buildMobilePerformanceSignals(pageSpeed)
  const performanceBreakdown = buildWeightedScore({
    items: performanceSignals,
    maxPoints: 35,
  })

  const performanceRatio = performanceBreakdown.score == null
    ? null
    : clamp(performanceBreakdown.score / 35, 0, 1)

  const performanceIssueLabel = getMobilePerformanceIssueLabel(pageSpeed, performanceRatio)
  const issueBreakdown = buildWeightedScore({
    items: [
      ...normalizedChecks.map((check) => ({
        weight: MOBILE_CHECK_METADATA_BY_KEY[check.key]?.issueWeight || 0,
        value: check.passed ? 1 : 0,
      })),
      {
        weight: 5,
        value: performanceRatio,
      },
    ],
    maxPoints: 25,
  })

  const availableBucketMax = [readinessBreakdown, performanceBreakdown, issueBreakdown]
    .filter((bucket) => bucket.score != null)
    .reduce((sum, bucket) => sum + bucket.maxPoints, 0)

  const earnedPoints = [readinessBreakdown, performanceBreakdown, issueBreakdown]
    .reduce((sum, bucket) => sum + (bucket.score || 0), 0)

  const overallScore = availableBucketMax > 0
    ? roundScore((earnedPoints / availableBucketMax) * 100)
    : null

  const statusMeta = getMobileFriendlinessStatus(overallScore)
  const missingLabels = [
    ...MOBILE_CHECK_METADATA
      .filter((meta) => !normalizedChecks.some((check) => check.key === meta.key))
      .map((meta) => meta.label),
    ...performanceSignals
      .filter((signal) => signal.value == null)
      .map((signal) => signal.label),
  ]

  const topIssues = [
    ...normalizedChecks
      .filter((check) => check.passed === false)
      .map((check) => MOBILE_CHECK_METADATA_BY_KEY[check.key]?.issueLabel || check.label),
    ...(performanceIssueLabel ? [performanceIssueLabel] : []),
    ...fallbackIssues,
  ].filter((label, index, items) => {
    const normalized = String(label || '').trim().toLowerCase()
    return normalized && items.findIndex((candidate) => String(candidate || '').trim().toLowerCase() === normalized) === index
  }).slice(0, 3)

  return {
    score: overallScore,
    maxScore: 100,
    ...statusMeta,
    interpretation: statusMeta.interpretation,
    explanation: 'Can a parent on their phone easily read, trust, and take the next step?',
    methodologyNote: 'This is a v1 technical scorecard built from the current audit signals, not a manual UX review.',
    checks: normalizedChecks,
    topIssues,
    breakdown: [
      { label: 'Readiness', score: readinessBreakdown.score, maxScore: 40 },
      { label: 'Mobile performance', score: performanceBreakdown.score, maxScore: 35 },
      { label: 'Issue burden', score: issueBreakdown.score, maxScore: 25 },
    ],
    subscores: [
      { label: 'Readability', score: buildMobileSubscore(normalizedChecks, 'readability') },
      { label: 'Tap usability', score: buildMobileSubscore(normalizedChecks, 'tapUsability') },
      {
        label: 'Mobile performance',
        score: performanceBreakdown.score == null ? null : roundScore((performanceBreakdown.score / 35) * 100),
      },
    ],
    coverage: {
      partial: missingLabels.length > 0,
      missingLabels,
      note: buildMobileCoverageNote({ missingLabels }),
    },
    rawChecksPassed: normalizedChecks.filter((check) => check.passed).length,
    rawChecksAvailable: normalizedChecks.length,
  }
}

function normalizeIssueSeverity(value, fallback = 'medium') {
  if (value === 'high' || value === 'medium' || value === 'low') return value
  return fallback
}

function buildWebsiteIssueBrief({ key = '', label = '', area = 'Website', severity = 'medium' }) {
  const normalizedKey = String(key || '').trim()
  const normalizedLabel = String(label || '').trim() || 'Website issue'
  const normalizedArea = String(area || 'Website').trim()
  const lookup = `${normalizedKey} ${normalizedLabel}`.toLowerCase()

  const genericByArea = {
    'Page Speed': {
      summary: `${normalizedLabel} is slowing down the first impression of the site.`,
      whyItMatters: 'A slower page makes parents wait longer to see the message and can reduce trust and conversions.',
      likelyCause: 'Check homepage assets, third-party scripts, theme files, and server response times.',
      recommendedFix: 'Prioritize above-the-fold content, trim heavy assets, and defer anything non-essential on initial load.',
      talkingPoint: 'The site is likely leaving some parent attention on the table because the first experience is heavier than it should be.',
    },
    'Mobile Friendliness': {
      summary: `${normalizedLabel} is making the phone experience harder than it should be.`,
      whyItMatters: 'Most parents first visit on mobile, so friction here can directly hurt inquiries and tour requests.',
      likelyCause: 'Inspect responsive layout rules, typography, button spacing, and mobile-specific template behavior.',
      recommendedFix: 'Review the affected mobile template, tighten responsive styling, and re-test the core conversion path on phone.',
      talkingPoint: 'Parents should be able to read and tap through the site easily on their phone; right now there is visible friction.',
    },
    'Technical SEO': {
      summary: `${normalizedLabel} is limiting how clearly search engines can understand or trust the site.`,
      whyItMatters: 'If search engines cannot crawl, interpret, or present the page well, organic visibility and click-through suffer.',
      likelyCause: 'Inspect crawl settings, templates, metadata, and internal linking on the homepage and key enrollment pages.',
      recommendedFix: 'Correct the technical signal, then re-crawl the homepage and highest-intent pages to confirm the fix.',
      talkingPoint: 'This is a technical visibility issue: even good content can underperform if search engines are getting weak signals.',
    },
  }

  let content = genericByArea[normalizedArea] || genericByArea['Page Speed']

  if (lookup.includes('largest-contentful-paint') || lookup.includes('server-response-time') || lookup.includes('render-blocking')) {
    content = {
      summary: 'The page is taking too long to show its main content.',
      whyItMatters: 'Parents form an opinion fast. If the hero section or first CTA appears slowly, more visitors drop before engaging.',
      likelyCause: 'Inspect server response, large hero media, font loading, and scripts or styles that block the first render.',
      recommendedFix: 'Reduce critical-path assets, compress the hero experience, defer non-essential scripts, and improve server response time.',
      talkingPoint: 'The first impression is arriving too slowly. Speeding up the hero area should help more parents stay engaged.',
    }
  } else if (lookup.includes('total-blocking-time') || lookup.includes('unused-javascript')) {
    content = {
      summary: 'Too much JavaScript is delaying when the page becomes responsive.',
      whyItMatters: 'A page can look loaded but still feel broken if taps, scrolling, or forms lag on mobile.',
      likelyCause: 'Inspect theme bundles, third-party widgets, chat tools, tracking scripts, and unused front-end code.',
      recommendedFix: 'Remove or defer non-critical scripts, split heavy bundles, and limit third-party tools on key conversion pages.',
      talkingPoint: 'The site is doing too much work in the browser before it becomes easy to use, especially on phones.',
    }
  } else if (lookup.includes('cumulative-layout-shift')) {
    content = {
      summary: 'Page elements are shifting while the page loads.',
      whyItMatters: 'Unexpected movement can cause parents to lose their place or tap the wrong thing, which hurts trust.',
      likelyCause: 'Inspect image dimensions, font swaps, embeds, sticky elements, and late-loading banners or popups.',
      recommendedFix: 'Reserve space for images and embeds, stabilize fonts, and prevent late content injections above the fold.',
      talkingPoint: 'The page feels jumpy during load, which makes the experience feel less polished and reliable.',
    }
  } else if (lookup.includes('modern-image-formats') || lookup.includes('responsive-images') || lookup.includes('offscreen-images')) {
    content = {
      summary: 'Images are heavier than they need to be for the device and screen size.',
      whyItMatters: 'Large or poorly served images slow the site down and make the mobile experience feel less efficient.',
      likelyCause: 'Inspect homepage and landing-page images, lazy-loading behavior, responsive image markup, and export sizes.',
      recommendedFix: 'Serve modern formats, right-size assets per viewport, and lazy-load non-critical images lower on the page.',
      talkingPoint: 'A chunk of the slowdown is likely image-related, which is usually a fixable web-team optimization.',
    }
  } else if (lookup.includes('text-compression') || lookup.includes('unminified-css') || lookup.includes('unminified-javascript') || lookup.includes('unused-css')) {
    content = {
      summary: 'The site is shipping front-end files less efficiently than it should.',
      whyItMatters: 'Bloated CSS and JavaScript increase load time and make every page visit more expensive for the browser.',
      likelyCause: 'Inspect build output, caching/compression settings, plugin CSS/JS, and whether unused assets are loading globally.',
      recommendedFix: 'Enable compression, minify assets, and remove unused CSS or JS from the pages that matter most.',
      talkingPoint: 'This is mostly web-team cleanup work that can improve speed without changing the client-facing message.',
    }
  } else if (lookup.includes('tap-target') || lookup.includes('font-size') || lookup.includes('viewport') || lookup.includes('content wider')) {
    content = {
      summary: 'The mobile layout is making content harder to read or interact with.',
      whyItMatters: 'If parents need to zoom, mis-tap buttons, or fight the layout, conversion intent drops quickly.',
      likelyCause: 'Inspect responsive breakpoints, font sizing, button spacing, sticky UI, and how the theme behaves on smaller screens.',
      recommendedFix: 'Adjust mobile typography and spacing, fix the viewport/layout rules, and QA the key CTA path on actual phones.',
      talkingPoint: 'This is a usability issue more than a messaging issue — parents should be able to move through the site without friction.',
    }
  } else if (lookup.includes('document-title') || lookup.includes('title tag') || lookup.includes('meta-description')) {
    content = {
      summary: 'Important search-result metadata is missing or weak.',
      whyItMatters: 'Titles and descriptions help search engines understand the page and influence whether parents click from results.',
      likelyCause: 'Inspect page templates, homepage metadata settings, and whether core enrollment pages have custom SEO fields filled in.',
      recommendedFix: 'Write clear, location-aware titles and descriptions for the homepage and top intent pages, then confirm they render correctly.',
      talkingPoint: 'Search visibility is partly a packaging problem — the page needs stronger titles and descriptions to earn better clicks.',
    }
  } else if (lookup.includes('link-text') || lookup.includes('crawlable-anchors')) {
    content = {
      summary: 'Links are not giving users and search engines enough clarity.',
      whyItMatters: 'Weak link language makes navigation less clear for parents and reduces the semantic value search engines get from the site.',
      likelyCause: 'Inspect button copy, repeated generic anchor text, and any navigation or CTA elements rendered in non-standard ways.',
      recommendedFix: 'Replace vague link text with descriptive copy and ensure important navigation and CTA links are rendered as crawlable anchors.',
      talkingPoint: 'Some of the site navigation is not communicating clearly enough to either parents or search engines.',
    }
  } else if (lookup.includes('is-crawlable') || lookup.includes('robots-txt') || lookup.includes('homepage indexable')) {
    content = {
      summary: 'Search engines may have trouble crawling or indexing the site correctly.',
      whyItMatters: 'If the homepage or key pages are blocked or unclear to crawlers, rankings and discoverability can suffer fast.',
      likelyCause: 'Inspect robots.txt, noindex directives, canonical tags, security settings, and platform-level SEO controls.',
      recommendedFix: 'Confirm the homepage is crawlable and indexable, fix robots or meta directives, and revalidate with a fresh crawl.',
      talkingPoint: 'This is a foundational SEO issue: if search engines cannot properly access the site, growth gets capped upstream.',
    }
  }

  return {
    key: normalizedKey || null,
    label: normalizedLabel,
    area: normalizedArea,
    severity: normalizeIssueSeverity(severity),
    summary: content.summary,
    whyItMatters: content.whyItMatters,
    likelyCause: content.likelyCause,
    recommendedFix: content.recommendedFix,
    talkingPoint: content.talkingPoint,
  }
}

function normalizeWebsiteTopIssues(items = []) {
  if (!Array.isArray(items)) return []

  const seen = new Set()

  return items
    .map((item) => {
      if (!item) return null

      const base = typeof item === 'string' ? { label: item } : item
      const label = String(base?.label || '').trim()
      if (!label) return null

      const normalized = buildWebsiteIssueBrief({
        key: base?.key,
        label,
        area: base?.area,
        severity: base?.severity,
      })

      return {
        ...normalized,
        summary: String(base?.summary || normalized.summary || '').trim(),
        whyItMatters: String(base?.whyItMatters || normalized.whyItMatters || '').trim(),
        likelyCause: String(base?.likelyCause || normalized.likelyCause || '').trim(),
        recommendedFix: String(base?.recommendedFix || normalized.recommendedFix || '').trim(),
        talkingPoint: String(base?.talkingPoint || normalized.talkingPoint || '').trim(),
      }
    })
    .filter((issue) => {
      if (!issue) return false
      const dedupeKey = `${String(issue.label || '').toLowerCase()}::${String(issue.area || '').toLowerCase()}`
      if (seen.has(dedupeKey)) return false
      seen.add(dedupeKey)
      return true
    })
}

function collectIssueCandidates(audits) {
  if (!audits || typeof audits !== 'object') return []

  const preferred = ISSUE_AUDIT_PRIORITY
    .map((key) => [key, audits[key]])
    .filter(([, audit]) => audit)

  const fallback = Object.entries(audits).filter(([key]) => !ISSUE_AUDIT_PRIORITY.includes(key))

  return [...preferred, ...fallback]
    .map(([key, audit]) => {
      const score = typeof audit?.score === 'number' ? audit.score : null
      const passed = getAuditPassed(audit)
      const informative = (audit?.score_display_mode || audit?.scoreDisplayMode) !== 'notApplicable'
      const shouldInclude = informative && ((passed === false) || (score != null && score < 0.9))

      if (!shouldInclude) return null

      const severity = score != null && score < 0.5 ? 'high' : score != null && score < 0.9 ? 'medium' : 'medium'
      return {
        key,
        severity,
        label: audit?.title || key,
      }
    })
    .filter(Boolean)
}

async function getTechnicalChecks(websiteUrl, audits) {
  const parsedUrl = new URL(websiteUrl)
  let robotsOk = null
  let sitemapOk = null

  try {
    const robots = await fetchText(new URL('/robots.txt', parsedUrl).toString())
    robotsOk = robots.ok

    if (robots.ok) {
      const robotsText = String(robots.text || '')
      const sitemapDirective = robotsText.match(/^\s*Sitemap:\s*(.+)$/im)?.[1]?.trim()

      if (sitemapDirective) {
        try {
          const sitemap = await fetchText(sitemapDirective)
          sitemapOk = sitemap.ok
        } catch {
          sitemapOk = false
        }
      }
    }
  } catch {
    robotsOk = false
  }

  if (sitemapOk == null) {
    try {
      const sitemap = await fetchText(new URL('/sitemap.xml', parsedUrl).toString())
      sitemapOk = sitemap.ok
    } catch {
      sitemapOk = false
    }
  }

  const healthChecks = [
    { label: 'SSL', passed: parsedUrl.protocol === 'https:' },
    { label: 'Robots', passed: robotsOk },
    { label: 'Sitemap', passed: sitemapOk },
    ...SEO_AUDIT_KEYS.map(([key, label]) => ({ label, passed: getAuditPassed(getAudit(audits, key)) })),
  ]

  return healthChecks.filter((item) => item.passed !== null)
}

function normalizePageSpeed(lighthouse) {
  const audits = lighthouse?.audits || {}
  const score = normalizeNumericScore(lighthouse?.categories?.performance?.score)
  const statusMeta = getScoreStatus(score)

  return {
    score,
    ...statusMeta,
    lcp: (() => {
      const value = toNumber(getAudit(audits, 'largest-contentful-paint')?.numericValue)
      return value == null ? null : Number((value / 1000).toFixed(1))
    })(),
    tbt: toNumber(getAudit(audits, 'total-blocking-time')?.numericValue),
    cls: (() => {
      const value = toNumber(getAudit(audits, 'cumulative-layout-shift')?.numericValue)
      return value == null ? null : Number(value.toFixed(2))
    })(),
    topIssues: collectIssueCandidates(audits).slice(0, 3).map((issue) => issue.label),
  }
}

function normalizeMobile(lighthouse, pageSpeed) {
  const audits = lighthouse?.audits || {}
  const checks = normalizeMobileChecksFromAudits(audits)

  return buildMobileFriendlinessScorecard({
    checks,
    pageSpeed,
  })
}

async function normalizeTechnicalSeo(lighthouse, websiteUrl) {
  const audits = lighthouse?.audits || {}
  const score = normalizeNumericScore(lighthouse?.categories?.seo?.score)
  const statusMeta = getSeoStatus(score)
  const healthChecks = await getTechnicalChecks(websiteUrl, audits)
  const issueLabels = collectIssueCandidates(audits)
    .filter((issue) => SEO_AUDIT_KEYS.some(([key]) => key === issue.key) || ['robots-txt', 'is-crawlable'].includes(issue.key))
    .map((issue) => issue.label)

  return {
    score,
    ...statusMeta,
    nonIndexable: null,
    brokenIssues: null,
    duplicateMeta: null,
    healthChecks,
    topIssues: issueLabels.slice(0, 3),
  }
}

function mergeTopIssues(pageSpeed, mobile, technicalSeo) {
  const issues = []

  for (const label of pageSpeed?.topIssues || []) {
    issues.push({ severity: 'high', area: 'Page Speed', label })
  }
  for (const label of mobile?.topIssues || []) {
    issues.push({ severity: 'medium', area: 'Mobile Friendliness', label })
  }
  for (const label of technicalSeo?.topIssues || []) {
    issues.push({ severity: 'medium', area: 'Technical SEO', label })
  }

  return normalizeWebsiteTopIssues(issues).slice(0, 5)
}

export async function getLiveWebsiteAudit(websiteUrl) {
  const normalizedUrl = normalizeWebsiteUrl(websiteUrl)
  if (!normalizedUrl) return buildNoWebsiteAuditPayload()

  const config = getDataForSeoConfig()
  if (!config.configured) return buildUnconfiguredWebsiteAuditPayload(normalizedUrl)

  const response = await fetchDataForSeoLighthouse(normalizedUrl, config)
  const lighthouse = findFirstLighthousePayload(response)

  if (!lighthouse) {
    throw new Error('DataForSEO returned no Lighthouse payload for this website.')
  }

  const pageSpeed = normalizePageSpeed(lighthouse)
  const mobile = normalizeMobile(lighthouse, pageSpeed)
  const technicalSeo = await normalizeTechnicalSeo(lighthouse, normalizedUrl)

  return {
    configured: true,
    websiteUrl: normalizedUrl,
    checkedAt: new Date().toISOString(),
    reason: null,
    message: null,
    source: 'dataforseo_lighthouse',
    pageSpeed,
    mobile,
    technicalSeo,
    topIssues: mergeTopIssues(pageSpeed, mobile, technicalSeo),
  }
}
