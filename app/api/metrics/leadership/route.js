import { NextResponse } from 'next/server'
import pkg from 'pg'

export const dynamic = 'force-dynamic'
const { Pool } = pkg
const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

const SNAPSHOT_MAX_AGE_HOURS = 8

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "LeadershipSnapshot" (
      id BIGSERIAL PRIMARY KEY,
      "asOf" TIMESTAMPTZ NOT NULL DEFAULT now(),
      payload JSONB NOT NULL
    );
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS "LeadershipSnapshot_asOf_idx" ON "LeadershipSnapshot" ("asOf" DESC);`)
}

async function loadLatest() {
  const { rows } = await pool.query(`SELECT id, "asOf", payload FROM "LeadershipSnapshot" ORDER BY "asOf" DESC LIMIT 1`)
  return rows[0] || null
}

function isFresh(asOf) {
  const ageMs = Date.now() - new Date(asOf).getTime()
  return ageMs < SNAPSHOT_MAX_AGE_HOURS * 60 * 60 * 1000
}

function buildSourceHealth(payload) {
  const sources = ['finance', 'churn', 'dunning', 'sales', 'leads', 'dealSize', 'newBusiness', 'salesAnalysis', 'clientHealth', 'cx']
  const out = {}
  for (const key of sources) {
    const block = payload[key] || {}
    const asOf = block.updatedAt || block.syncedAt || block.lastSync?.syncedAt || null
    out[key] = {
      ok: !block.error,
      asOf,
      stale: asOf ? (Date.now() - new Date(asOf).getTime()) > 24 * 60 * 60 * 1000 : false,
      error: block.error || null,
    }
  }
  return out
}

async function fetchLiveBundle(origin) {
  const endpoints = {
    finance: '/api/metrics/finance',
    churn: '/api/metrics/churn',
    dunning: '/api/metrics/dunning',
    sales: '/api/metrics/sales',
    leads: '/api/metrics/ghl-leads',
    dealSize: '/api/metrics/deal-size',
    newBusiness: '/api/metrics/new-business',
    salesAnalysis: '/api/metrics/sales-analysis',
    clientHealth: '/api/metrics/client-health',
    cx: '/api/metrics/cx',
  }

  const entries = await Promise.all(Object.entries(endpoints).map(async ([k, p]) => {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 20000) // 20s per endpoint
      const res = await fetch(`${origin}${p}`, { cache: 'no-store', signal: controller.signal })
      clearTimeout(timeout)
      const json = await res.json()
      return [k, json]
    } catch (err) {
      console.error(`[leadership] endpoint ${p} failed:`, err?.message)
      return [k, { error: err?.message || 'fetch failed', partial: true }]
    }
  }))

  const payload = Object.fromEntries(entries)
  payload.meta = {
    sourceHealth: buildSourceHealth(payload),
    staleSourceCount: Object.values(buildSourceHealth(payload)).filter(s => s.stale).length,
  }
  return payload
}

export async function GET(req) {
  try {
    await ensureTable()

    const url = new URL(req.url)
    const forceRefresh = url.searchParams.get('refresh') === '1'

    const latest = await loadLatest()
    if (!forceRefresh && latest?.payload && latest?.asOf && isFresh(latest.asOf)) {
      return NextResponse.json({
        ...latest.payload,
        snapshot: {
          source: 'db-cache',
          asOf: latest.asOf,
          id: latest.id,
        },
      })
    }

    const origin = `${url.protocol}//${url.host}`
    const payload = await fetchLiveBundle(origin)

    // Guard: refuse to save if too many sources failed
    const errorCount = Object.values(payload.meta?.sourceHealth || {}).filter(s => !s.ok).length
    const totalSources = Object.keys(payload.meta?.sourceHealth || {}).length
    if (errorCount >= 6) {
      console.warn(`[leadership] Refresh blocked — ${errorCount}/${totalSources} sources failed. Returning last good snapshot.`)
      if (latest?.payload) {
        return NextResponse.json({
          ...latest.payload,
          snapshot: {
            source: 'db-cache-protected',
            asOf: latest.asOf,
            id: latest.id,
            warning: `Refresh blocked: ${errorCount}/${totalSources} sources failed. Serving last good snapshot.`,
          },
        })
      }
    }

    const insert = await pool.query(
      `INSERT INTO "LeadershipSnapshot" (payload) VALUES ($1::jsonb) RETURNING id, "asOf"`,
      [JSON.stringify(payload)]
    )

    return NextResponse.json({
      ...payload,
      snapshot: {
        source: 'live-refresh',
        asOf: insert.rows[0].asOf,
        id: insert.rows[0].id,
      },
    })
  } catch (error) {
    console.error('Leadership metrics route failed:', error)
    return NextResponse.json({ error: error.message || 'Failed to build leadership snapshot' }, { status: 500 })
  }
}
