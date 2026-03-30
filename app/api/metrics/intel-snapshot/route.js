import { NextResponse } from 'next/server'
import pkg from 'pg'

export const dynamic = 'force-dynamic'
const { Pool } = pkg
const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
const MAX_AGE_HOURS = 8

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "IntelSnapshot" (
      id BIGSERIAL PRIMARY KEY,
      "asOf" TIMESTAMPTZ NOT NULL DEFAULT now(),
      payload JSONB NOT NULL
    );
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS "IntelSnapshot_asOf_idx" ON "IntelSnapshot" ("asOf" DESC);`)
}

async function latest() {
  const { rows } = await pool.query(`SELECT id, "asOf", payload FROM "IntelSnapshot" ORDER BY "asOf" DESC LIMIT 1`)
  return rows[0] || null
}

function fresh(asOf) {
  return (Date.now() - new Date(asOf).getTime()) < MAX_AGE_HOURS * 3600 * 1000
}

async function fetchBundle(origin) {
  const endpoints = {
    clientHealth: '/api/metrics/client-health',
    cx: '/api/metrics/cx',
    missionIntel: '/api/mission-control/intel',
  }
  const entries = await Promise.all(Object.entries(endpoints).map(async ([k, p]) => {
    const res = await fetch(`${origin}${p}`, { cache: 'no-store' })
    return [k, await res.json()]
  }))
  return Object.fromEntries(entries)
}

export async function GET(req) {
  try {
    await ensureTable()
    const url = new URL(req.url)
    const force = url.searchParams.get('refresh') === '1'

    const current = await latest()
    if (!force && current?.asOf && current?.payload && fresh(current.asOf)) {
      return NextResponse.json({ ...current.payload, snapshot: { source: 'db-cache', asOf: current.asOf, id: current.id } })
    }

    const origin = `${url.protocol}//${url.host}`
    const payload = await fetchBundle(origin)
    const ins = await pool.query(`INSERT INTO "IntelSnapshot" (payload) VALUES ($1::jsonb) RETURNING id, "asOf"`, [JSON.stringify(payload)])

    return NextResponse.json({ ...payload, snapshot: { source: 'live-refresh', asOf: ins.rows[0].asOf, id: ins.rows[0].id } })
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to build intel snapshot' }, { status: 500 })
  }
}
