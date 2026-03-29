export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import pkg from 'pg'
const { Pool } = pkg

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

function monthMinus(yyyymm, n) {
  const [y, m] = yyyymm.split('-').map(Number)
  const d = new Date(y, m - 1 - n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

async function topForWindow(db, startMonth, endMonth) {
  const q = startMonth
    ? `SELECT c.acronym, c.name,
         SUM(m.leads)::int AS leads, SUM(m.tours)::int AS tours, SUM(m.registered)::int AS registered
       FROM "ClientFunnelMonth" m JOIN "Client" c ON c.id = m."clientId"
       WHERE m.month <= $1 AND m.month >= $2 AND c.status != 'cancelled'
       GROUP BY c.acronym, c.name HAVING SUM(m.leads) > 0 OR SUM(m.registered) > 0`
    : `SELECT c.acronym, c.name,
         SUM(m.leads)::int AS leads, SUM(m.tours)::int AS tours, SUM(m.registered)::int AS registered
       FROM "ClientFunnelMonth" m JOIN "Client" c ON c.id = m."clientId"
       WHERE m.month <= $1 AND c.status != 'cancelled'
       GROUP BY c.acronym, c.name HAVING SUM(m.leads) > 0 OR SUM(m.registered) > 0`
  const params = startMonth ? [endMonth, startMonth] : [endMonth]
  const { rows } = await db.query(q, params)
  return rows.map(c => ({
    acronym: c.acronym, name: c.name,
    leads: Number(c.leads), tours: Number(c.tours), registered: Number(c.registered),
    leadToReg:  c.leads > 0 ? Math.round(c.registered / c.leads * 100) : null,
    leadToTour: c.leads > 0 ? Math.round(c.tours      / c.leads * 100) : null,
    tourToReg:  c.tours > 0 ? Math.round(c.registered / c.tours * 100) : null,
  }))
}

async function topForWindowByLocation(db, startMonth, endMonth) {
  const q = startMonth
    ? `SELECT c.acronym, c.name AS "clientName", m."locationName",
         SUM(m.leads)::int AS leads, SUM(m.tours)::int AS tours, SUM(m.registered)::int AS registered
       FROM "ClientFunnelMonth" m JOIN "Client" c ON c.id = m."clientId"
       WHERE m.month <= $1 AND m.month >= $2 AND m."locationName" != 'default' AND c.status != 'cancelled'
       GROUP BY c.acronym, c.name, m."locationName" HAVING SUM(m.leads) > 0 OR SUM(m.registered) > 0`
    : `SELECT c.acronym, c.name AS "clientName", m."locationName",
         SUM(m.leads)::int AS leads, SUM(m.tours)::int AS tours, SUM(m.registered)::int AS registered
       FROM "ClientFunnelMonth" m JOIN "Client" c ON c.id = m."clientId"
       WHERE m.month <= $1 AND m."locationName" != 'default' AND c.status != 'cancelled'
       GROUP BY c.acronym, c.name, m."locationName" HAVING SUM(m.leads) > 0 OR SUM(m.registered) > 0`
  const params = startMonth ? [endMonth, startMonth] : [endMonth]
  const { rows } = await db.query(q, params)
  return rows.map(r => {
    const leads = Number(r.leads), tours = Number(r.tours), registered = Number(r.registered)
    return {
      acronym: r.locationName, parent: r.acronym, clientName: r.clientName, locationName: r.locationName,
      leads, tours, registered,
      leadToReg:  leads > 0 ? Math.round(registered / leads * 100) : null,
      leadToTour: leads > 0 ? Math.round(tours / leads * 100) : null,
      tourToReg:  tours > 0 ? Math.round(registered / tours * 100) : null,
    }
  })
}

function buildLeaderboard(rows) {
  return {
    byLeads:         [...rows].sort((a, b) => b.leads - a.leads).slice(0, 10),
    byRegistrations: [...rows].sort((a, b) => b.registered - a.registered).slice(0, 10),
    byConversion:    [...rows].filter(c => c.leads >= 10).sort((a, b) => (b.leadToReg ?? 0) - (a.leadToReg ?? 0)).slice(0, 10),
    redFlag:         [...rows].filter(c => c.leads >= 10 && c.leadToReg !== null && c.leadToReg < 18).sort((a, b) => b.leads - a.leads).slice(0, 10),
    lowLeadFlow:     [...rows].filter(c => c.leads > 0).sort((a, b) => a.leads - b.leads).slice(0, 10),
  }
}

export async function GET() {
  const db = await pool.connect()
  try {
    const now = new Date()
    const lastCompleteMonth = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`
    const start12m = monthMinus(lastCompleteMonth, 11)
    const start3m  = monthMinus(lastCompleteMonth, 2)
    const start1m  = lastCompleteMonth

    const { rows: monthRows } = await db.query(`
      SELECT
        m.month,
        COUNT(DISTINCT m."clientId")::int                              AS "clientCount",
        COUNT(m.id)::int                                               AS "locationCount",
        SUM(m.leads)::int                                              AS leads,
        SUM(m.tours)::int                                              AS tours,
        SUM(m.registered)::int                                         AS registered,
        ROUND(AVG(m.leads))::int                                       AS "avgLeadsPerLoc",
        ROUND(AVG(m.tours))::int                                       AS "avgToursPerLoc",
        ROUND(AVG(m.registered))::int                                  AS "avgRegisteredPerLoc",
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY m.leads)           AS "medianLeads",
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY m.tours)           AS "medianTours",
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY m.registered)      AS "medianRegistered",
        MODE() WITHIN GROUP (ORDER BY m.leads)                         AS "modeLeads",
        MODE() WITHIN GROUP (ORDER BY m.tours)                         AS "modeTours",
        MODE() WITHIN GROUP (ORDER BY m.registered)                    AS "modeRegistered"
      FROM "ClientFunnelMonth" m
      JOIN "Client" c ON c.id = m."clientId"
      WHERE m.month <= $1 AND c.status != 'cancelled'
      GROUP BY m.month ORDER BY m.month ASC
    `, [lastCompleteMonth])

    const byMonth = monthRows
      .filter(m => m.leads > 0 || m.registered > 0)
      .map(m => ({
        month: m.month,
        clientCount: m.clientCount, locationCount: m.locationCount,
        leads: Number(m.leads), tours: Number(m.tours), registered: Number(m.registered),
        avgLeads:            m.clientCount > 0 ? Math.round(m.leads      / m.clientCount) : 0,
        avgTours:            m.clientCount > 0 ? Math.round(m.tours      / m.clientCount) : 0,
        avgRegistered:       m.clientCount > 0 ? Math.round(m.registered / m.clientCount) : 0,
        avgLeadsPerLoc:      Number(m.avgLeadsPerLoc)      || 0,
        avgToursPerLoc:      Number(m.avgToursPerLoc)      || 0,
        avgRegisteredPerLoc: Number(m.avgRegisteredPerLoc) || 0,
        medianLeads:         Math.round(Number(m.medianLeads))      || 0,
        medianTours:         Math.round(Number(m.medianTours))      || 0,
        medianRegistered:    Math.round(Number(m.medianRegistered)) || 0,
        modeLeads:           Math.round(Number(m.modeLeads))        || 0,
        modeTours:           Math.round(Number(m.modeTours))        || 0,
        modeRegistered:      Math.round(Number(m.modeRegistered))   || 0,
        leadToTour: m.leads > 0 ? Math.round(m.tours      / m.leads * 100) : null,
        tourToReg:  m.tours > 0 ? Math.round(m.registered / m.tours * 100) : null,
        leadToReg:  m.leads > 0 ? Math.round(m.registered / m.leads * 100) : null,
      }))

    const totLeads = byMonth.reduce((s, m) => s + m.leads, 0)
    const totTours = byMonth.reduce((s, m) => s + m.tours, 0)
    const totReg   = byMonth.reduce((s, m) => s + m.registered, 0)
    const allTimeTotals = {
      leads: totLeads, tours: totTours, registered: totReg,
      leadToTour: totLeads > 0 ? Math.round(totTours / totLeads * 100) : null,
      tourToReg:  totTours > 0 ? Math.round(totReg   / totTours * 100) : null,
      leadToReg:  totLeads > 0 ? Math.round(totReg   / totLeads * 100) : null,
    }
    const latestMonth = byMonth.length > 0 ? byMonth[byMonth.length - 1] : null

    const [rowsAllTime, rows12m, rows3m, rows1m, locAllTime, loc12m, loc3m, loc1m] = await Promise.all([
      topForWindow(db, null, lastCompleteMonth),
      topForWindow(db, start12m, lastCompleteMonth),
      topForWindow(db, start3m, lastCompleteMonth),
      topForWindow(db, start1m, lastCompleteMonth),
      topForWindowByLocation(db, null, lastCompleteMonth),
      topForWindowByLocation(db, start12m, lastCompleteMonth),
      topForWindowByLocation(db, start3m, lastCompleteMonth),
      topForWindowByLocation(db, start1m, lastCompleteMonth),
    ])

    const { rows: syncRows } = await db.query(
      `SELECT * FROM "SyncLog" WHERE source = 'client_funnels' ORDER BY "syncedAt" DESC LIMIT 1`
    )

    return NextResponse.json({
      allTimeTotals, byMonth, latestMonth,
      leaderboards: {
        allTime: buildLeaderboard(rowsAllTime), months12: buildLeaderboard(rows12m),
        lastQuarter: buildLeaderboard(rows3m),  lastMonth: buildLeaderboard(rows1m),
      },
      locationLeaderboards: {
        allTime: buildLeaderboard(locAllTime), months12: buildLeaderboard(loc12m),
        lastQuarter: buildLeaderboard(loc3m),  lastMonth: buildLeaderboard(loc1m),
      },
      lastSync: syncRows[0] || null,
      clientCount: rowsAllTime.length,
      lastCompleteMonth,
    })
  } catch (error) {
    console.error('[client-funnels/summary] ERROR:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  } finally {
    db.release()
  }
}
