#!/usr/bin/env node

const base = process.env.SNAPSHOT_BASE_URL || 'http://localhost:3000'
const endpoints = [
  '/api/metrics/leadership?refresh=1',
  '/api/metrics/intel-snapshot?refresh=1',
  '/api/metrics/recon-snapshot?refresh=1',
]

async function run() {
  const started = new Date().toISOString()
  const results = []

  for (const path of endpoints) {
    const url = `${base}${path}`
    const t0 = Date.now()
    try {
      const res = await fetch(url)
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
      results.push({ path, ok: false, status: 0, ms: Date.now() - t0, error: e.message })
    }
  }

  const payload = { started, finished: new Date().toISOString(), base, results }
  console.log(JSON.stringify(payload, null, 2))

  const failed = results.filter(r => !r.ok)
  process.exit(failed.length ? 1 : 0)
}

run()
