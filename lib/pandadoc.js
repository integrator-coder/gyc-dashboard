/**
 * PandaDoc API helper
 * Auth: Bearer token (API key)
 * Docs: https://developers.pandadoc.com/reference/
 */

const BASE_URL = 'https://api.pandadoc.com/public/v1'

function getHeaders() {
  const key = process.env.PANDADOC_API_KEY
  if (!key) throw new Error('PANDADOC_API_KEY environment variable is not set')
  return {
    Authorization: `API-Key ${key}`,
    'Content-Type': 'application/json',
  }
}

/**
 * Sleep for ms milliseconds.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Fetch with automatic retry on 429 (Retry-After header respected).
 * @param {string} url
 * @param {RequestInit} opts
 * @param {number} maxRetries
 */
async function fetchWithRetry(url, opts = {}, maxRetries = 2) {
  let attempt = 0
  while (true) {
    const res = await fetch(url, { ...opts, cache: 'no-store' })
    if (res.status !== 429 || attempt >= maxRetries) return res
    const retryAfter = parseInt(res.headers.get('Retry-After') || '10', 10)
    const waitMs = (isNaN(retryAfter) ? 10 : retryAfter) * 1000
    await sleep(waitMs)
    attempt++
  }
}

/**
 * Fetch a single page of documents.
 * @param {number} page  1-indexed page number
 * @param {number} count Number of docs per page (max 100)
 */
export async function fetchDocumentsPage(page = 1, count = 100) {
  const url = `${BASE_URL}/documents?count=${count}&page=${page}&order_by=-date_created`
  const res = await fetchWithRetry(url, { headers: getHeaders() })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`PandaDoc list error ${res.status}: ${body}`)
  }
  return res.json()
}

/**
 * Fetch ALL documents across all pages.
 * Stops when a page returns fewer results than requested.
 * @param {number} maxPages  Safety cap (default 20 = up to 2 000 docs)
 */
export async function fetchAllDocuments(maxPages = 20) {
  const all = []
  let page = 1
  const count = 100

  while (page <= maxPages) {
    const json = await fetchDocumentsPage(page, count)
    const results = json.results || []
    all.push(...results)
    if (results.length < count) break
    page++
  }

  return all
}

/**
 * Fetch the detailed document object including tokens and pricing tables.
 * Used to derive MRR from custom tokens on signed documents.
 */
export async function fetchDocumentDetail(documentId) {
  const url = `${BASE_URL}/documents/${documentId}/details`
  const res = await fetchWithRetry(url, { headers: getHeaders() })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`PandaDoc detail error ${res.status} for ${documentId}: ${body}`)
  }
  return res.json()
}

/**
 * Attempt to extract a recurring monthly value (MRR) from a document detail.
 * Looks through tokens, fields, and pricing table sections for keys that
 * suggest a monthly/recurring amount.
 *
 * Returns a number (USD) or null if not found.
 */
export function extractMrrFromDetail(detail) {
  const MRR_KEYS = /mrr|monthly[_\s]?(amount|price|fee|value|total|recurring)|recurring[_\s]?(monthly|amount|fee)/i

  // 1. Check tokens (key-value pairs set at send time)
  if (Array.isArray(detail.tokens)) {
    for (const token of detail.tokens) {
      if (MRR_KEYS.test(token.name || '')) {
        const val = parseFloat(token.value)
        if (!isNaN(val) && val > 0) return val
      }
    }
  }

  // 2. Check fields (form fields filled by recipient)
  if (Array.isArray(detail.fields)) {
    for (const field of detail.fields) {
      if (MRR_KEYS.test(field.name || '') || MRR_KEYS.test(field.field_id || '')) {
        const val = parseFloat(field.value)
        if (!isNaN(val) && val > 0) return val
      }
    }
  }

  // 3. Check pricing table sections for recurring line items
  if (Array.isArray(detail.pricing?.tables)) {
    for (const table of detail.pricing.tables) {
      for (const section of table.items || []) {
        const item = section
        if (MRR_KEYS.test(item.description || '') || MRR_KEYS.test(item.name || '')) {
          const qty = parseFloat(item.qty) || 1
          const price = parseFloat(item.price) || 0
          if (price > 0) return qty * price
        }
      }
    }
  }

  return null
}
