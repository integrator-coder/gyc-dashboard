#!/usr/bin/env node

const base = process.env.SNAPSHOT_BASE_URL || 'http://localhost:3000'
const endpoints = [
  '/api/metrics/agreements-db?period=last_90',  // warms agreements cache (not a snapshot route, just validates DB reachable)
  '/api/metrics/leadership?refresh=1',
  '/api/metrics/intel-snapshot?refresh=1',
  '/api/metrics/recon-snapshot?refresh=1',
  '/api/metrics/sales-analysis-snapshot?refresh=1',
  '/api/metrics/new-business-snapshot?refresh=1',
  '/api/metrics/sales-activity-snapshot?refresh=1',
  '/api/metrics/web-analytics-snapshot?refresh=1',
  '/api/metrics/production-snapshot?refresh=1',
]

const ENDPOINT_TIMEOUT_MS = 30000 // 30s per endpoint max

async function fetchWithTimeout(url, ms) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)
    return res
  } catch (e) {
    clearTimeout(timer)
    throw e
  }
}

async function run() {
  const started = new Date().toISOString()
  const results = []

  for (const path of endpoints) {
    const url = `${base}${path}`
    const t0 = Date.now()
    try {
      const res = await fetchWithTimeout(url, ENDPOINT_TIMEOUT_MS)
      const json = await res.json().catch(() => ({}))
      results.push({
        path,
        ok: res.ok && !json.error,
        status: res.status,
        ms: Date.now() - t0,
        snapshot: json?.snapshot?.source || null,
        error: json?.error || null,
      })
    } catch (e) {
      const isTimeout = e.name === 'AbortError'
      results.push({ path, ok: false, status: 0, ms: Date.now() - t0, error: isTimeout ? `timed out after ${ENDPOINT_TIMEOUT_MS}ms` : e.message })
    }
  }

  const payload = { started, finished: new Date().toISOString(), base, results }
  console.log(JSON.stringify(payload, null, 2))

  const failed = results.filter(r => !r.ok)
  process.exit(failed.length ? 1 : 0)
}

run()
