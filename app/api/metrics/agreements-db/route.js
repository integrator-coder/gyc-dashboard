export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import pkg from 'pg'
const { Pool } = pkg

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

function getPeriodRange(period) {
  const now = new Date()
  const y = now.getFullYear()
  switch (period) {
    case 'this_month':  return { start: new Date(y, now.getMonth(), 1),     end: new Date(y, now.getMonth() + 1, 0, 23, 59, 59) }
    case 'last_month':  return { start: new Date(y, now.getMonth() - 1, 1), end: new Date(y, now.getMonth(), 0, 23, 59, 59) }
    case 'q1':          return { start: new Date(y, 0, 1),  end: new Date(y, 2, 31, 23, 59, 59) }
    case 'q2':          return { start: new Date(y, 3, 1),  end: new Date(y, 5, 30, 23, 59, 59) }
    case 'q3':          return { start: new Date(y, 6, 1),  end: new Date(y, 8, 30, 23, 59, 59) }
    case 'q4':          return { start: new Date(y, 9, 1),  end: new Date(y, 11, 31, 23, 59, 59) }
    case 'ytd':         return { start: new Date(y, 0, 1),  end: now }
    case 'last_30':     return { start: new Date(Date.now() - 30 * 86400000), end: now }
    case 'last_90':     return { start: new Date(Date.now() - 90 * 86400000), end: now }
    default:            return null
  }
}

const VALID_SORT_COLS = ['createdAt', 'modifiedAt', 'completedAt', 'amount', 'mrr', 'name', 'status']

export async function GET(request) {
  const t0 = Date.now()
  const { searchParams } = new URL(request.url)
  const period   = searchParams.get('period')   || 'this_month'
  const sortBy   = VALID_SORT_COLS.includes(searchParams.get('sort')) ? searchParams.get('sort') : 'createdAt'
  const sortDir  = searchParams.get('dir') === 'asc' ? 'ASC' : 'DESC'
  const filter   = searchParams.get('status') || 'all' // 'all' | 'sent' | 'signed'
  const page     = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const pageSize = 50

  try {
    const range = getPeriodRange(period)

    // Build WHERE clauses
    const conditions = []
    const params = []

    if (range) {
      params.push(range.start.toISOString(), range.end.toISOString())
      conditions.push(`"createdAt" >= $${params.length - 1} AND "createdAt" <= $${params.length}`)
    }

    if (filter === 'sent') {
      conditions.push(`"sentStatus" = 'sent'`)
    } else if (filter === 'signed') {
      conditions.push(`"sentStatus" = 'signed'`)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const colMap = { createdAt: '"createdAt"', modifiedAt: '"modifiedAt"', completedAt: '"completedAt"', amount: 'amount', mrr: 'mrr', name: 'name', status: 'status' }
    const orderCol = colMap[sortBy] || '"createdAt"'

    // KPI aggregates
    const aggSql = `
      SELECT
        COUNT(*) FILTER (WHERE "sentStatus" = 'sent')   AS sent_count,
        COUNT(*) FILTER (WHERE "sentStatus" = 'signed') AS signed_count,
        SUM(amount) FILTER (WHERE "sentStatus" = 'sent')   AS proposed_value,
        SUM(amount) FILTER (WHERE "sentStatus" = 'signed') AS closed_value,
        SUM(mrr)    FILTER (WHERE "sentStatus" = 'signed') AS total_mrr,
        MAX("syncedAt") AS last_synced
      FROM "AgreementsSnapshot" ${where}
    `
    const aggResult = await pool.query(aggSql, params)
    const agg = aggResult.rows[0]

    // Paginated rows
    const offset = (page - 1) * pageSize
    params.push(pageSize, offset)
    const rowSql = `
      SELECT
        "docId", name, status, "sentStatus",
        amount, mrr,
        "createdAt", "modifiedAt", "completedAt",
        recipients, tokens
      FROM "AgreementsSnapshot"
      ${where}
      ORDER BY ${orderCol} ${sortDir} NULLS LAST
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `
    const rowResult = await pool.query(rowSql, params)

    // Total count for pagination
    const countSql = `SELECT COUNT(*) AS total FROM "AgreementsSnapshot" ${where}`
    const countResult = await pool.query(countSql, params.slice(0, params.length - 2))
    const total = parseInt(countResult.rows[0].total, 10)

    // Period label
    const periodLabel = range
      ? `${range.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${range.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
      : 'All time'

    return NextResponse.json({
      kpis: {
        sentCount:      parseInt(agg.sent_count, 10),
        signedCount:    parseInt(agg.signed_count, 10),
        proposedValue:  agg.proposed_value ? parseFloat(agg.proposed_value) : 0,
        closedValue:    agg.closed_value   ? parseFloat(agg.closed_value)   : 0,
        totalMrr:       agg.total_mrr      ? parseFloat(agg.total_mrr)      : 0,
        lastSynced:     agg.last_synced,
      },
      rows: rowResult.rows,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      period,
      periodLabel,
      sort: { by: sortBy, dir: sortDir.toLowerCase() },
      durationMs: Date.now() - t0,
    })
  } catch (err) {
    // Table doesn't exist yet — sync hasn't run
    if (err.message?.includes('does not exist')) {
      return NextResponse.json({
        kpis: { sentCount: 0, signedCount: 0, proposedValue: 0, closedValue: 0, totalMrr: 0, lastSynced: null },
        rows: [],
        pagination: { page: 1, pageSize, total: 0, totalPages: 0 },
        period, periodLabel: '', sort: { by: sortBy, dir: sortDir.toLowerCase() },
        durationMs: Date.now() - t0,
        notice: 'Data sync has not run yet. Check back shortly.',
      })
    }
    console.error('[agreements-db]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
