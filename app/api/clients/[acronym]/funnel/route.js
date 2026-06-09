export const dynamic = 'force-dynamic'

// ── Inline funnel benchmark logic (avoids ESM import issues in route handlers) ──
const FUNNEL_BENCHMARKS = {
  leadToTour: 50,
  tourToReg: 50,
  overallConversion: 25,
}

function funnelStatus(leadToTour, tourToReg) {
  const ltt = leadToTour != null ? Number(leadToTour) : null
  const ttr = tourToReg  != null ? Number(tourToReg)  : null
  const overall = ltt != null && ttr != null ? (ltt * ttr) / 100 : null
  const lttGap     = ltt     != null ? FUNNEL_BENCHMARKS.leadToTour      - ltt     : null
  const ttrGap     = ttr     != null ? FUNNEL_BENCHMARKS.tourToReg        - ttr     : null
  const overallGap = overall != null ? FUNNEL_BENCHMARKS.overallConversion - overall : null
  function computeStatus(value, benchmark) {
    if (value == null) return 'above'
    if (value >= benchmark) return 'above'
    if (value >= benchmark * 0.5) return 'warning'
    return 'critical'
  }
  const lttStatus     = computeStatus(ltt,     FUNNEL_BENCHMARKS.leadToTour)
  const ttrStatus     = computeStatus(ttr,     FUNNEL_BENCHMARKS.tourToReg)
  const overallStatus = computeStatus(overall, FUNNEL_BENCHMARKS.overallConversion)
  const lttBelow = lttStatus !== 'above'
  const ttrBelow = ttrStatus !== 'above'
  let primaryConstraint
  if (lttBelow && ttrBelow)       primaryConstraint = 'both'
  else if (lttBelow && !ttrBelow) primaryConstraint = 'lead-to-tour'
  else if (!lttBelow && ttrBelow) primaryConstraint = 'tour-to-reg'
  else                            primaryConstraint = 'none'
  const nextSteps = []
  if (primaryConstraint === 'none') {
    nextSteps.push('All funnel metrics are above benchmark — strong performance across the board')
  } else {
    if (primaryConstraint === 'both') nextSteps.push('Both touring rate and close rate need attention — prioritize speed to lead first')
    if (lttBelow) {
      nextSteps.push('Check speed to lead — response within 5 minutes dramatically increases tour bookings')
      nextSteps.push('Review follow-up volume — most leads need 5–8 touches before they book a tour')
      nextSteps.push('Add human touch points — personal phone calls convert at a significantly higher rate than automated messages')
      nextSteps.push('Review booking friction — is online booking available? Can parents book outside business hours?')
      if (lttStatus === 'critical') nextSteps.push('Consider lead quality — are your campaigns targeting high-intent search terms?')
    }
    if (ttrBelow) {
      nextSteps.push('Review tour process — close rate is below benchmark; consider a tour script or checklist')
      nextSteps.push('Add a follow-up sequence after tours — many families need a nudge to commit')
      nextSteps.push("Capture objections — ask families what's holding them back and address it directly")
    }
  }
  return { leadToTour: ltt, tourToReg: ttr, overallConversion: overall, leadToTourGap: lttGap, tourToRegGap: ttrGap, overallConversionGap: overallGap, leadToTourStatus: lttStatus, tourToRegStatus: ttrStatus, overallStatus, primaryConstraint, nextSteps }
}

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
    const auth = await requireApiUser(['ga', 'cx', 'admin', 'superadmin', 'manager'])
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

    const summaryLTT = profile.leadToTourRate != null ? Number(profile.leadToTourRate) : null
    const summaryTTR = profile.tourToRegRate  != null ? Number(profile.tourToRegRate)  : null
    const benchmarkAnalysis = funnelStatus(summaryLTT, summaryTTR)

    return NextResponse.json({
      acronym: profile.acronym,
      companyName: profile.companyName,
      assignedGA: profile.assignedGA,
      funnelHistory,
      summary: {
        avgLeads:       profile.avgMonthlyLeads      != null ? Number(profile.avgMonthlyLeads)      : null,
        avgTours:       profile.avgMonthlyTours      != null ? Number(profile.avgMonthlyTours)      : null,
        avgRegistered:  profile.avgMonthlyRegistered != null ? Number(profile.avgMonthlyRegistered) : null,
        leadToTourRate: summaryLTT,
        tourToRegRate:  summaryTTR,
        trend:          profile.funnelTrend || null,
        monthsOfData:   profile.funnelDataMonths     != null ? Number(profile.funnelDataMonths)     : 0,
      },
      benchmarkAnalysis,
    })
  } catch (error) {
    console.error('Client funnel endpoint error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to load funnel data.' },
      { status: error.status || 500 }
    )
  }
}
