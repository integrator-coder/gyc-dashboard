export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import pkg from 'pg'
const { Pool } = pkg

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

export async function GET() {
  const db = await pool.connect()
  try {
    const { rows } = await db.query(`
      SELECT acronym, "propertyId", sessions, "activeUsers", "newUsers",
             "bounceRate", "organicSearch", "paidSearch", "directSessions",
             "organicSocial", "paidSocial", referral, "avgSessionDuration", "syncedAt"
      FROM "ClientGAMetrics"
      WHERE period = '30d' AND sessions > 0
      ORDER BY sessions DESC
    `)

    const lastSync = rows.length > 0 ? rows[0].syncedAt : null

    const clients = rows.map(r => ({
      acronym:            r.acronym,
      propertyId:         r.propertyId,
      sessions:           r.sessions,
      activeUsers:        r.activeUsers,
      newUsers:           r.newUsers,
      bounceRate:         Math.round(r.bounceRate * 100),
      avgSessionDuration: Math.round(r.avgSessionDuration),
      organicSearch:      r.organicSearch,
      paidSearch:         r.paidSearch,
      directSessions:     r.directSessions,
      organicSocial:      r.organicSocial,
      paidSocial:         r.paidSocial,
      referral:           r.referral,
      paidTotal:          r.paidSearch + r.paidSocial,
      organicTotal:       r.organicSearch + r.organicSocial,
    }))

    // Totals across all clients
    const totals = clients.reduce((acc, c) => ({
      sessions:      acc.sessions + c.sessions,
      newUsers:      acc.newUsers + c.newUsers,
      organicSearch: acc.organicSearch + c.organicSearch,
      paidTotal:     acc.paidTotal + c.paidTotal,
    }), { sessions: 0, newUsers: 0, organicSearch: 0, paidTotal: 0 })

    return NextResponse.json({ clients, totals, lastSync, clientCount: clients.length })
  } catch (error) {
    console.error('[ga-overview] ERROR:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  } finally {
    db.release()
  }
}
