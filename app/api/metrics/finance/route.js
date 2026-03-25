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

    // Active customers sorted by MRR
    const { rows: customers } = await client.query(`
      SELECT * FROM "StripeCustomer"
      WHERE status = 'active'
      ORDER BY mrr DESC
    `)

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

    // Last 35 days of daily revenue (oldest first)
    const thirtyFiveDaysAgo = new Date()
    thirtyFiveDaysAgo.setDate(thirtyFiveDaysAgo.getDate() - 35)
    const cutoffDate = thirtyFiveDaysAgo.toISOString().split('T')[0]
    const { rows: dailyRevenue } = await client.query(`
      SELECT * FROM "DailyRevenue"
      WHERE date >= $1
      ORDER BY date ASC
    `, [cutoffDate])

    return NextResponse.json({
      metrics: latest,
      previous,
      customers,
      lastSync,
      history,
      dailyRevenue,
    })
  } catch (error) {
    console.error('Finance metrics error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  } finally {
    client.release()
  }
}
