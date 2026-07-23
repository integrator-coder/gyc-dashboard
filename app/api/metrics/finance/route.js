export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import pkg from 'pg'
const { Pool } = pkg

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

export async function GET() {
  const client = await pool.connect()
  try {
    // Latest and previous StripeMetrics snapshots
    const { rows: metricsRows } = await client.query(`
      SELECT * FROM "StripeMetrics"
      ORDER BY "syncedAt" DESC
      LIMIT 2
    `)
    const latest = metricsRows[0] || null
    const previous = metricsRows[1] || null

    // Active customers sorted by MRR (includes past_due/unpaid — still active clients)
    const { rows: customers } = await client.query(`
      SELECT * FROM "StripeCustomer"
      WHERE status IN ('active', 'past_due', 'unpaid')
      ORDER BY mrr DESC
    `)

    // Compute collected MRR (active + past_due) vs contracted MRR (includes unpaid)
    const mrrCollected = customers
      .filter(c => ['active', 'past_due'].includes(c.status))
      .reduce((sum, c) => sum + Number(c.mrr || 0), 0)
    const mrrContracted = customers
      .reduce((sum, c) => sum + Number(c.mrr || 0), 0)
    const mrrAtRisk = mrrContracted - mrrCollected
    const unpaidCount = customers.filter(c => c.status === 'unpaid').length

    // Last sync log for stripe
    const { rows: syncRows } = await client.query(`
      SELECT * FROM "SyncLog"
      WHERE source = 'stripe'
      ORDER BY "syncedAt" DESC
      LIMIT 1
    `)
    const lastSync = syncRows[0] || null

    // Last 35 snapshots for 30-day trend (1 per day, oldest first)
    const { rows: historyRows } = await client.query(`
      SELECT * FROM "StripeMetrics"
      ORDER BY "syncedAt" DESC
      LIMIT 35
    `)
    const history = historyRows.reverse()

    // Real 30-day MRR history built from StripeCustomer subscription lifecycle
    const { rows: mrrHistoryRows } = await client.query(`
      SELECT
        to_char(day, 'YYYY-MM-DD') AS date,
        ROUND(COALESCE(SUM(sc.mrr), 0)::numeric, 2) AS mrr
      FROM generate_series(
        CURRENT_DATE - INTERVAL '29 days',
        CURRENT_DATE,
        INTERVAL '1 day'
      ) AS day
      LEFT JOIN "StripeCustomer" sc
        ON sc.status IN ('active', 'past_due', 'unpaid')
        AND sc."createdAt"::date <= day::date
        AND (sc."canceledAt" IS NULL OR sc."canceledAt"::date > day::date)
      GROUP BY day
      ORDER BY day ASC
    `)

    const mrrHistory = mrrHistoryRows.map((row) => {
      const labelDate = new Date(`${row.date}T12:00:00Z`)
      return {
        date: row.date,
        label: labelDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
        mrr: Number(row.mrr) || 0,
      }
    })

    // Last 35 days of daily revenue (oldest first)
    const thirtyFiveDaysAgo = new Date()
    thirtyFiveDaysAgo.setDate(thirtyFiveDaysAgo.getDate() - 35)
    const cutoffDate = thirtyFiveDaysAgo.toISOString().split('T')[0]
    const { rows: dailyRevenue } = await client.query(`
      SELECT * FROM "DailyRevenue"
      WHERE date >= $1
      ORDER BY date ASC
    `, [cutoffDate])

    // YTD cash collected (Jan 1 to today)
    const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
    const { rows: ytdRows } = await client.query(`
      SELECT COALESCE(SUM(amount), 0) AS ytd_cash FROM "DailyRevenue"
      WHERE date >= $1
    `, [startOfYear])
    const ytdCash = Number(ytdRows[0]?.ytd_cash || 0)

    // Inject computed dual-MRR fields into metrics object
    const enrichedMetrics = latest ? {
      ...latest,
      mrrCollected: Math.round(mrrCollected * 100) / 100,
      mrrContracted: Math.round(mrrContracted * 100) / 100,
      mrrAtRisk: Math.round(mrrAtRisk * 100) / 100,
      arrCollected: Math.round(mrrCollected * 12 * 100) / 100,
      arrContracted: Math.round(mrrContracted * 12 * 100) / 100,
      unpaidCount,
    } : null

    return NextResponse.json({
      metrics: enrichedMetrics,
      previous,
      customers,
      lastSync,
      history,
      mrrHistory,
      dailyRevenue,
      ytdCash,
    })
  } catch (error) {
    console.error('Finance metrics error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  } finally {
    client.release()
  }
}
