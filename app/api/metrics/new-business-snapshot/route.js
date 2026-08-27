import { NextResponse } from 'next/server'
import pkg from 'pg'
import { getNewBusinessMetrics } from '../new-business/route'

export const dynamic = 'force-dynamic'
const { Pool } = pkg
const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

const SNAPSHOT_MAX_AGE_HOURS = 6

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "NewBusinessSnapshot" (
      id BIGSERIAL PRIMARY KEY,
      "asOf" TIMESTAMPTZ NOT NULL DEFAULT now(),
      payload JSONB NOT NULL
    );
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS "NewBusinessSnapshot_asOf_idx" ON "NewBusinessSnapshot" ("asOf" DESC);`)
}

async function loadLatest() {
  const { rows } = await pool.query(`SELECT id, "asOf", payload FROM "NewBusinessSnapshot" ORDER BY "asOf" DESC LIMIT 1`)
  return rows[0] || null
}

function isFresh(asOf) {
  const ageMs = Date.now() - new Date(asOf).getTime()
  return ageMs < SNAPSHOT_MAX_AGE_HOURS * 60 * 60 * 1000
}

// Build the metrics IN-PROCESS. Do NOT self-fetch over HTTP:
// on Render the container can't reliably reach its own public hostname,
// which made this route throw "fetch failed" and 500 whenever the cache
// went stale (>6h). Calling the exported builder directly avoids the network
// hop entirely and is faster.
async function fetchLive() {
  return getNewBusinessMetrics()
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

    // Try a live refresh. If it fails for any reason, fall back to the last
    // cached snapshot rather than 500ing the whole page.
    let payload
    try {
      payload = await fetchLive()
    } catch (refreshErr) {
      console.error('New business snapshot live refresh failed, falling back to cache:', refreshErr)
      if (latest?.payload) {
        return NextResponse.json({
          ...latest.payload,
          snapshot: {
            source: 'db-cache-stale',
            asOf: latest.asOf,
            id: latest.id,
            refreshError: refreshErr.message || 'live refresh failed',
          },
        })
      }
      throw refreshErr
    }

    const insert = await pool.query(
      `INSERT INTO "NewBusinessSnapshot" (payload) VALUES ($1::jsonb) RETURNING id, "asOf"`,
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
    console.error('New business snapshot route failed:', error)
    return NextResponse.json({ error: error.message || 'Failed to build new business snapshot' }, { status: 500 })
  }
}
