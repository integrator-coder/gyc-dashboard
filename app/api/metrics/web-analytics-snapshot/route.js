import { NextResponse } from 'next/server'
import pkg from 'pg'

export const dynamic = 'force-dynamic'
const { Pool } = pkg
const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

const SNAPSHOT_MAX_AGE_HOURS = 12

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "WebAnalyticsSnapshot" (
      id BIGSERIAL PRIMARY KEY,
      "asOf" TIMESTAMPTZ NOT NULL DEFAULT now(),
      payload JSONB NOT NULL
    );
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS "WebAnalyticsSnapshot_asOf_idx" ON "WebAnalyticsSnapshot" ("asOf" DESC);`)
}

async function loadLatest() {
  const { rows } = await pool.query(`SELECT id, "asOf", payload FROM "WebAnalyticsSnapshot" ORDER BY "asOf" DESC LIMIT 1`)
  return rows[0] || null
}

function isFresh(asOf) {
  const ageMs = Date.now() - new Date(asOf).getTime()
  return ageMs < SNAPSHOT_MAX_AGE_HOURS * 60 * 60 * 1000
}

async function fetchLive(origin) {
  const res = await fetch(`${origin}/api/metrics/ga-overview`, { cache: 'no-store' })
  return res.json()
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
    const payload = await fetchLive(origin)

    const insert = await pool.query(
      `INSERT INTO "WebAnalyticsSnapshot" (payload) VALUES ($1::jsonb) RETURNING id, "asOf"`,
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
    console.error('Web analytics snapshot route failed:', error)
    return NextResponse.json({ error: error.message || 'Failed to build web analytics snapshot' }, { status: 500 })
  }
}
