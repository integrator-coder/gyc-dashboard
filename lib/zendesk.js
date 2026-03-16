/**
 * Zendesk API utility
 * Credentials loaded from .env by Next.js:
 *   ZENDESK_SUBDOMAIN, ZENDESK_EMAIL, ZENDESK_API_TOKEN
 */

const BASE_URL = `https://${process.env.ZENDESK_SUBDOMAIN}.zendesk.com/api/v2`

function authHeader() {
  const raw = `${process.env.ZENDESK_EMAIL}/token:${process.env.ZENDESK_API_TOKEN}`
  const encoded = Buffer.from(raw).toString('base64')
  return `Basic ${encoded}`
}

async function zFetch(path) {
  const url = `${BASE_URL}${path}`
  const res = await fetch(url, {
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
    },
    // Next.js: no-store so we always get fresh data
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`Zendesk API error ${res.status} for ${path}`)
  }
  return res.json()
}

/**
 * Count tickets by status (new, open, pending, hold, solved, closed)
 */
async function getTicketCountByStatus(status) {
  const data = await zFetch(
    `/search/count.json?query=type:ticket+status:${status}`
  )
  return data.count || 0
}

/**
 * Count tickets created since a date string e.g. '2026-03-01'
 */
async function getTicketCountSince(dateStr) {
  const data = await zFetch(
    `/search/count.json?query=type:ticket+created>${dateStr}`
  )
  return data.count || 0
}

/**
 * Count tickets solved/resolved since a date string e.g. '2026-03-01'
 */
async function getResolvedCountSince(dateStr) {
  const data = await zFetch(
    `/search/count.json?query=type:ticket+status:solved+solved>${dateStr}`
  )
  return data.count || 0
}

/**
 * Returns counts per request type for open tickets.
 * Uses custom field ID 1500011171601.
 * Types: website_build, website_helpdesk, smm, google_ads, crm
 */
async function getTicketsByType() {
  const types = ['website_build', 'website_helpdesk', 'smm', 'google_ads', 'crm']
  const counts = {}

  await Promise.all(
    types.map(async (type) => {
      try {
        // Request Type is a tagger field — values stored as tags
        const data = await zFetch(
          `/search/count.json?query=type:ticket+status:open+tags:${type}`
        )
        counts[type] = data.count || 0
      } catch {
        counts[type] = 0
      }
    })
  )

  return counts
}

// Histogram bucket definitions
const BUCKETS = [
  { label: '< 4h',  minHours: 0,    maxHours: 4    },
  { label: '4–12h', minHours: 4,    maxHours: 12   },
  { label: '12–24h',minHours: 12,   maxHours: 24   },
  { label: '1–2d',  minHours: 24,   maxHours: 48   },
  { label: '2–3d',  minHours: 48,   maxHours: 72   },
  { label: '3–5d',  minHours: 72,   maxHours: 120  },
  { label: '5–7d',  minHours: 120,  maxHours: 168  },
  { label: '> 7d',  minHours: 168,  maxHours: Infinity },
]

function calcStats(hours) {
  if (!hours.length) return { mean: 0, median: 0, mode: 0 }

  // Mean
  const mean = hours.reduce((a, b) => a + b, 0) / hours.length

  // Median
  const sorted = [...hours].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median =
    sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid]

  // Mode — round to nearest hour for bucketing
  const freq = {}
  for (const h of hours) {
    const key = Math.round(h)
    freq[key] = (freq[key] || 0) + 1
  }
  let maxFreq = 0
  let mode = 0
  for (const [val, count] of Object.entries(freq)) {
    if (count > maxFreq) {
      maxFreq = count
      mode = Number(val)
    }
  }

  return {
    mean: Math.round(mean * 10) / 10,
    median: Math.round(median * 10) / 10,
    mode,
  }
}

/**
 * Pulls last 500 closed tickets (up to 5 pages of 100),
 * calculates resolution time distribution.
 * Returns { mean, median, mode, buckets, sampleSize }
 */
async function getResolutionTimeDistribution() {
  const allHours = []
  let nextUrl = `${BASE_URL}/search.json?query=type:ticket+status:closed&per_page=100&sort_by=updated_at&sort_order=desc`
  let page = 0

  while (nextUrl && page < 5) {
    const path = nextUrl.replace(BASE_URL, '')
    const data = await zFetch(path)
    const tickets = data.results || []

    for (const t of tickets) {
      if (t.created_at && t.updated_at) {
        const created = new Date(t.created_at).getTime()
        const updated = new Date(t.updated_at).getTime()
        const hours = (updated - created) / (1000 * 60 * 60)
        if (hours >= 0) allHours.push(hours)
      }
    }

    // Pagination: use next_page if available
    nextUrl = data.next_page || null
    page++
  }

  const { mean, median, mode } = calcStats(allHours)

  const buckets = BUCKETS.map(b => ({
    label: b.label,
    minHours: b.minHours,
    maxHours: b.maxHours,
    count: allHours.filter(h => h >= b.minHours && h < b.maxHours).length,
  }))

  return {
    mean,
    median,
    mode,
    buckets,
    sampleSize: allHours.length,
  }
}

module.exports = {
  getTicketCountByStatus,
  getTicketCountSince,
  getResolvedCountSince,
  getTicketsByType,
  getResolutionTimeDistribution,
}
