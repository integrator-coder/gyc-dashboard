const DATAFORSEO_BASE_URL = (process.env.DATAFORSEO_BASE_URL || 'https://api.dataforseo.com').replace(/\/$/, '')

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

const MOBILE_AUDIT_KEYS = [
  ['viewport', 'Viewport configured'],
  ['content-width', 'Fits mobile screen'],
  ['tap-targets', 'Tap targets usable'],
  ['font-size', 'Font size readable'],
]

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

function normalizeMobile(lighthouse) {
  const audits = lighthouse?.audits || {}
  const checks = MOBILE_AUDIT_KEYS.map(([key, label]) => ({
    label,
    passed: getAuditPassed(getAudit(audits, key)),
  })).filter((item) => item.passed !== null)

  const score = checks.reduce((sum, item) => sum + (item.passed ? 1 : 0), 0)
  const maxScore = checks.length || null
  const statusMeta = getMobileStatus(score, maxScore)

  return {
    score: maxScore == null ? null : score,
    maxScore,
    ...statusMeta,
    checks,
    topIssues: checks.filter((item) => item.passed === false).map((item) => item.label),
  }
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
    issues.push({ severity: 'high', label })
  }
  for (const label of mobile?.topIssues || []) {
    issues.push({ severity: 'medium', label })
  }
  for (const label of technicalSeo?.topIssues || []) {
    issues.push({ severity: 'medium', label })
  }

  const seen = new Set()
  return issues.filter((issue) => {
    const key = issue.label.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 5)
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
  const mobile = normalizeMobile(lighthouse)
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
