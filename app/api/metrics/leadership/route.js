import { NextResponse } from 'next/server'
import pkg from 'pg'
import { getFinanceMetrics } from '../finance/route'
import { getChurnMetrics } from '../churn/route'
import { getDunningMetrics } from '../dunning/route'
import { getSalesMetrics } from '../sales/route'
import { getLeadMetrics } from '../ghl-leads/route'
import { getDealSizeMetrics } from '../deal-size/route'
import { getNewBusinessMetrics } from '../new-business/route'
import { getSalesAnalysisMetrics } from '../sales-analysis/route'
import { getClientHealthMetrics } from '../client-health/route'
import { getCxMetrics } from '../cx/route'

export const dynamic = 'force-dynamic'
const { Pool } = pkg
const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

const SNAPSHOT_MAX_AGE_HOURS = 1
const BUNDLE_SCHEMA_VERSION = 2

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

function isFresh(asOf, payload) {
  const ageMs = Date.now() - new Date(asOf).getTime()
  return payload?.meta?.schemaVersion === BUNDLE_SCHEMA_VERSION && ageMs < SNAPSHOT_MAX_AGE_HOURS * 60 * 60 * 1000
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

async function fetchLiveBundle() {
  const sources = {
    finance: getFinanceMetrics,
    churn: getChurnMetrics,
    dunning: getDunningMetrics,
    sales: getSalesMetrics,
    leads: getLeadMetrics,
    dealSize: getDealSizeMetrics,
    newBusiness: getNewBusinessMetrics,
    salesAnalysis: getSalesAnalysisMetrics,
    clientHealth: getClientHealthMetrics,
    cx: getCxMetrics,
  }

  const entries = Object.entries(sources)
  const results = []
  const BATCH_SIZE = entries.length

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const slice = entries.slice(i, i + BATCH_SIZE)
    const settled = await Promise.all(slice.map(async ([k, load]) => {
      try {
        return [k, await load()]
      } catch (err) {
        console.error(`[leadership] source ${k} failed:`, err?.message)
        return [k, { error: err?.message || 'fetch failed', partial: true }]
      }
    }))
    results.push(...settled)
  }

  const payload = Object.fromEntries(results)
  payload.meta = {
    schemaVersion: BUNDLE_SCHEMA_VERSION,
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
    if (!forceRefresh && latest?.payload && latest?.asOf && isFresh(latest.asOf, latest.payload)) {
      return NextResponse.json({
        ...latest.payload,
        snapshot: {
          source: 'db-cache',
          asOf: latest.asOf,
          id: latest.id,
        },
      })
    }

    const payload = await fetchLiveBundle()

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
