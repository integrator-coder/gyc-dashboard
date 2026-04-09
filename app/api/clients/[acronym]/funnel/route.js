export const dynamic = 'force-dynamic'

/**
 * GET /api/clients/[acronym]/funnel
 *
 * Returns funnel history + summary KPIs for a specific client.
 *
 * Response shape:
 * {
 *   acronym, companyName, assignedGA,
 *   funnelHistory: [{ month, leads, tours, registered, leadToTour, tourToReg }],
 *   summary: { avgLeads, avgTours, avgRegistered, leadToTourRate, tourToRegRate, trend, monthsOfData }
 * }
 */

import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/auth'
import { pool } from '@/lib/pg'

export async function GET(_request, { params }) {
  try {
    const auth = await requireApiUser(['ga', 'cx', 'admin', 'superadmin'])
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { acronym } = await params
    const upper = acronym.toUpperCase()

    // ── Fetch profile basics ──────────────────────────────────────────────────
    const profileRes = await pool.query(`
      SELECT
        acronym,
        "companyName",
        "assignedGA",
        "latestFunnelMonth",
        "avgMonthlyLeads",
        "avgMonthlyTours",
        "avgMonthlyRegistered",
        "leadToTourRate",
        "tourToRegRate",
        "funnelDataMonths",
        "funnelTrend"
      FROM "ClientProfile"
      WHERE "tenantId" = 'gyc'
        AND acronym = $1
      LIMIT 1
    `, [upper])

    if (!profileRes.rows.length) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    const profile = profileRes.rows[0]

    // ── Fetch monthly funnel history ──────────────────────────────────────────
    const historyRes = await pool.query(`
      SELECT
        month,
        SUM(leads)      AS leads,
        SUM(tours)      AS tours,
        SUM(registered) AS registered
      FROM "ClientFunnelMonth"
      WHERE "tenantId" = 'gyc'
        AND "clientId"  = $1
      GROUP BY month
      ORDER BY month ASC
    `, [upper])

    const funnelHistory = historyRes.rows.map(r => {
      const leads = Number(r.leads) || 0
      const tours = Number(r.tours) || 0
      const registered = Number(r.registered) || 0
      return {
        month: r.month,
        leads,
        tours,
        registered,
        leadToTour: leads > 0 ? Math.round((tours / leads) * 1000) / 10 : 0,
        tourToReg:  tours > 0 ? Math.round((registered / tours) * 1000) / 10 : 0,
      }
    })

    return NextResponse.json({
      acronym: profile.acronym,
      companyName: profile.companyName,
      assignedGA: profile.assignedGA,
      funnelHistory,
      summary: {
        avgLeads:       profile.avgMonthlyLeads      != null ? Number(profile.avgMonthlyLeads)      : null,
        avgTours:       profile.avgMonthlyTours      != null ? Number(profile.avgMonthlyTours)      : null,
        avgRegistered:  profile.avgMonthlyRegistered != null ? Number(profile.avgMonthlyRegistered) : null,
        leadToTourRate: profile.leadToTourRate       != null ? Number(profile.leadToTourRate)       : null,
        tourToRegRate:  profile.tourToRegRate        != null ? Number(profile.tourToRegRate)        : null,
        trend:          profile.funnelTrend || null,
        monthsOfData:   profile.funnelDataMonths     != null ? Number(profile.funnelDataMonths)     : 0,
      },
    })
  } catch (error) {
    console.error('Client funnel endpoint error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to load funnel data.' },
      { status: error.status || 500 }
    )
  }
}
