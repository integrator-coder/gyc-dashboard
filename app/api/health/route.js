import { NextResponse } from 'next/server'
import pkg from 'pg'

export const dynamic = 'force-dynamic'

const { Pool } = pkg
const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

export async function GET() {
  const start = Date.now()
  const checks = {}

  // ── Database connectivity ────────────────────────────────────────────────────
  try {
    const client = await pool.connect()
    const { rows } = await client.query('SELECT NOW() AS ts, COUNT(*) AS active_customers FROM "StripeCustomer" WHERE status = \'active\'')
    client.release()
    checks.db = {
      status: 'ok',
      activeCustomers: Number(rows[0]?.active_customers || 0),
      serverTime: rows[0]?.ts,
    }
  } catch (err) {
    checks.db = { status: 'error', error: err.message }
  }

  // ── Last Eve sync ─────────────────────────────────────────────────────────────
  try {
    const client = await pool.connect()
    const { rows } = await client.query(`
      SELECT source, status, "syncedAt"
      FROM "SyncLog"
      WHERE (source, "syncedAt") IN (
        SELECT source, MAX("syncedAt") FROM "SyncLog" GROUP BY source
      )
      ORDER BY source
    `)
    client.release()

    const expectedIntervals = {
      stripe:         8 * 3600 * 1000,
      'client-funnels': 26 * 3600 * 1000,
      dunning:        26 * 3600 * 1000,
      'slack-digest': 26 * 3600 * 1000,
    }

    const syncStatus = {}
    const now = Date.now()
    let allHealthy = true

    for (const row of rows) {
      const age = row.syncedAt ? now - new Date(row.syncedAt).getTime() : Infinity
      const maxAge = expectedIntervals[row.source] || 48 * 3600 * 1000
      const stale = age > maxAge
      if (stale || row.status === 'error') allHealthy = false
      syncStatus[row.source] = {
        status: row.status,
        syncedAt: row.syncedAt,
        ageMinutes: Math.round(age / 60000),
        stale,
      }
    }

    checks.eveSync = { status: allHealthy ? 'ok' : 'degraded', sources: syncStatus }
  } catch (err) {
    checks.eveSync = { status: 'error', error: err.message }
  }

  // ── Overall status ────────────────────────────────────────────────────────────
  const allOk = Object.values(checks).every((c) => c.status === 'ok')
  const anyError = Object.values(checks).some((c) => c.status === 'error')

  const overall = anyError ? 'error' : allOk ? 'ok' : 'degraded'
  const latency = Date.now() - start

  return NextResponse.json(
    {
      status: overall,
      latencyMs: latency,
      checks,
      timestamp: new Date().toISOString(),
      version: 'gyc-dashboard-v1',
    },
    { status: overall === 'error' ? 503 : 200 }
  )
}
