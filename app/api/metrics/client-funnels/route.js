export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import pkg from 'pg'
const { Pool } = pkg

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month')

    const now2 = new Date()
    const lastCompleteMonth = `${now2.getFullYear()}-${String(now2.getMonth()).padStart(2, '0')}`

    const client = await pool.connect()
    try {
      const { rows: clients } = await client.query(`
        SELECT c.id, c.acronym, c.name, c.status, c."lastSyncAt",
               m.month, m.leads, m.tours, m.registered, m.revenue
        FROM "Client" c
        LEFT JOIN "ClientFunnelMonth" m ON m."clientId" = c.id AND m.month <= $1
        ORDER BY c.acronym, m.month DESC
      `, [lastCompleteMonth])

      // Group by client
      const byClient = {}
      for (const row of clients) {
        if (!byClient[row.acronym]) {
          byClient[row.acronym] = {
            acronym: row.acronym, name: row.name, status: row.status,
            lastSyncAt: row.lastSyncAt, months: {}
          }
        }
        if (row.month) {
          if (!byClient[row.acronym].months[row.month]) {
            byClient[row.acronym].months[row.month] = { leads: 0, tours: 0, registered: 0, revenue: 0 }
          }
          byClient[row.acronym].months[row.month].leads      += Number(row.leads) || 0
          byClient[row.acronym].months[row.month].tours      += Number(row.tours) || 0
          byClient[row.acronym].months[row.month].registered += Number(row.registered) || 0
          byClient[row.acronym].months[row.month].revenue    += Number(row.revenue) || 0
        }
      }

      const rows = Object.values(byClient).map(c => {
        const sortedMonths = Object.keys(c.months).sort().reverse()
        const latestMonth = month
          ? (c.months[month] ? month : null)
          : sortedMonths.find(m => {
              const d = c.months[m]
              return d.leads > 0 || d.tours > 0 || d.registered > 0
            })
        if (!latestMonth) return null
        const d = c.months[latestMonth]
        const leadToTour = d.leads > 0 ? d.tours / d.leads : null
        const tourToReg  = d.tours > 0 ? d.registered / d.tours : null
        const leadToReg  = d.leads > 0 ? d.registered / d.leads : null
        const prevMonth  = sortedMonths[sortedMonths.indexOf(latestMonth) + 1]
        const prev       = prevMonth ? c.months[prevMonth] : null
        return {
          acronym: c.acronym, name: c.name, status: c.status, lastSyncAt: c.lastSyncAt,
          latestMonth, mostRecentMonth: sortedMonths[0], availableMonths: sortedMonths,
          leads: d.leads, tours: d.tours, registered: d.registered, revenue: d.revenue,
          leadToTour: leadToTour ? Math.round(leadToTour * 100) : null,
          tourToReg:  tourToReg  ? Math.round(tourToReg  * 100) : null,
          leadToReg:  leadToReg  ? Math.round(leadToReg  * 100) : null,
          trend: prev ? { leads: d.leads - prev.leads, registered: d.registered - prev.registered } : null,
        }
      }).filter(Boolean)

      const allMonths = [...new Set(clients.filter(r => r.month).map(r => r.month))].sort().reverse()

      const { rows: syncRows } = await client.query(`
        SELECT * FROM "SyncLog" WHERE source = 'client_funnels' ORDER BY "syncedAt" DESC LIMIT 1
      `)

      return NextResponse.json({ clients: rows, allMonths, lastSync: syncRows[0] || null })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('[client-funnels] ERROR:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
