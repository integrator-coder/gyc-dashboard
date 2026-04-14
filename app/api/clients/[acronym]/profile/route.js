export const dynamic = 'force-dynamic'

/**
 * GET  /api/clients/[acronym]/profile
 *   Full client profile from ClientProfile + all ZoomCall history
 *   + ActivityLog + ClientFunnelMonth + unlinked call detection
 *
 * PATCH /api/clients/[acronym]/profile
 *   Update teamNotes. Body: { teamNotes: string }
 */

import { NextResponse } from 'next/server'
import { requireApiUser, userHasRole } from '@/lib/auth'
import { pool } from '@/lib/pg'

function computeHealthScore(row) {
  let score = 10
  if (row.isOverdue)                          score -= 3
  if (row.funnelTrend === 'down')             score -= 2
  if (Number(row.overdueCount || 0) > 1)      score -= 1
  if (row.stripeStatus === 'past_due')        score -= 2
  return Math.max(1, Math.min(10, score))
}

// All ZoomCall columns we want to surface on the client card
const CALL_SELECT = `
  zc.id,
  zc.topic,
  zc."meetingId",
  zc."startTime",
  zc."startedAt",
  zc."callDate",
  zc.duration,
  zc."durationSecs",
  zc."recordingUrl",
  zc."callLink",
  zc."transcriptText",
  zc."transcriptUrl",
  zc."aiSummary",
  zc."aiClassification",
  zc."aiConfidence",
  zc."classifiedAs",
  zc."classifiedBy",
  zc."classifiedAt",
  zc."classificationStatus",
  zc.status,
  zc.purposes,
  zc."repName",
  zc."hostName",
  zc."hostEmail",
  zc."assignedRepName",
  zc."assignedRepEmail",
  zc."gaName",
  zc."gaEmail",
  zc."clientName",
  zc.acronym,
  zc."ghlContactId",
  zc."clientProfileId",
  zc.participants,
  zc.notes,
  zc."dealClosed",
  zc."onboardingAgentName",
  zc."onboardingAgentEmail"
`

export async function GET(_request, { params }) {
  try {
    const auth = await requireApiUser(['ga', 'cx', 'admin', 'superadmin'])
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { user } = auth
    const { acronym } = await params
    const upper = String(acronym || '').toUpperCase()

    // ── 1. Fetch ClientProfile ─────────────────────────────────────────────
    let profileQuery = `SELECT * FROM "ClientProfile" WHERE "tenantId" = $1 AND acronym = $2 LIMIT 1`
    let profileParams = ['gyc', upper]

    if (userHasRole(user, ['ga']) && !userHasRole(user, ['admin', 'superadmin', 'cx'])) {
      profileQuery = `SELECT * FROM "ClientProfile"
        WHERE "tenantId" = $1 AND acronym = $2
          AND lower(COALESCE("assignedGAEmail",'')) = $3
        LIMIT 1`
      profileParams = ['gyc', upper, user.email.toLowerCase()]
    }

    const profileRes = await pool.query(profileQuery, profileParams)
    if (!profileRes.rows.length) {
      return NextResponse.json({ error: 'Client not found.' }, { status: 404 })
    }

    const profileRow = profileRes.rows[0]

    // ── 2. All linked calls (no limit) + activity + funnel — parallel ──────
    const ghlId = profileRow.ghlContactId || '__none__'
    const profileId = profileRow.id || -1

    const [callsRes, activityRes, funnelRes, potentialCallsRes] = await Promise.all([

      // All ZoomCall rows linked by acronym, clientProfileId, or ghlContactId
      pool.query(`
        SELECT ${CALL_SELECT}
        FROM "ZoomCall" zc
        WHERE upper(COALESCE(zc.acronym,'')) = $1
           OR zc."clientProfileId" = $2
           OR (zc."ghlContactId" IS NOT NULL AND zc."ghlContactId" = $3)
        ORDER BY COALESCE(zc."startTime", zc."startedAt", zc."callDate"::timestamp, zc."createdAt") DESC NULLS LAST
      `, [upper, profileId, ghlId]),

      // Last 20 ActivityLog entries
      pool.query(`
        SELECT id, type, "referenceId", "referenceType", "entityId", "entityType",
               summary, detail, "actorEmail", "actorName", "createdAt"
        FROM "ActivityLog"
        WHERE "referenceId" = $1 OR "entityId" = $1
        ORDER BY "createdAt" DESC NULLS LAST
        LIMIT 20
      `, [upper]).catch(() => ({ rows: [] })),

      // Last 12 months funnel (chronological)
      pool.query(`
        SELECT month,
               SUM(leads)::int      AS leads,
               SUM(tours)::int      AS tours,
               SUM(registered)::int AS registered
        FROM "ClientFunnelMonth"
        WHERE "clientId" = $1
        GROUP BY month
        ORDER BY month ASC
        LIMIT 12
      `, [upper]).catch(() => ({ rows: [] })),

      // Potential unlinked calls: participant emails match client email or ghlContactId,
      // but not already linked by acronym or clientProfileId
      profileRow.email
        ? pool.query(`
          SELECT COUNT(*)::int AS count
          FROM "ZoomCall" zc
          WHERE upper(COALESCE(zc.acronym,'')) != $1
            AND (zc."clientProfileId" IS NULL OR zc."clientProfileId" != $2)
            AND (
              zc.participants @> jsonb_build_array(jsonb_build_object('email', lower($3)))
              OR zc.participants::text ILIKE $4
            )
          `, [upper, profileId, profileRow.email.toLowerCase(), `%${profileRow.email.toLowerCase()}%`]
          ).catch(() => ({ rows: [{ count: 0 }] }))
        : Promise.resolve({ rows: [{ count: 0 }] }),
    ])

    const allCalls = callsRes.rows

    // Split into classified vs pending-classification
    const classifiedCalls = allCalls.filter((c) => c.classifiedAs || c.aiClassification || (c.purposes && c.purposes.length > 0))
    const pendingCalls    = allCalls.filter((c) => !c.classifiedAs && !c.aiClassification && (!c.purposes || c.purposes.length === 0))

    const profile = {
      ...profileRow,
      mrr:                  profileRow.mrr                  != null ? Number(profileRow.mrr)                  : null,
      overdueAmount:        profileRow.overdueAmount        != null ? Number(profileRow.overdueAmount)        : null,
      lifetimeValue:        profileRow.lifetimeValue        != null ? Number(profileRow.lifetimeValue)        : null,
      catchUpRate:          profileRow.catchUpRate          != null ? Number(profileRow.catchUpRate)          : null,
      avgMonthlyLeads:      profileRow.avgMonthlyLeads      != null ? Number(profileRow.avgMonthlyLeads)      : null,
      avgMonthlyTours:      profileRow.avgMonthlyTours      != null ? Number(profileRow.avgMonthlyTours)      : null,
      avgMonthlyRegistered: profileRow.avgMonthlyRegistered != null ? Number(profileRow.avgMonthlyRegistered) : null,
      leadToTourRate:       profileRow.leadToTourRate       != null ? Number(profileRow.leadToTourRate)       : null,
      tourToRegRate:        profileRow.tourToRegRate        != null ? Number(profileRow.tourToRegRate)        : null,
      healthScore:          computeHealthScore(profileRow),
    }

    return NextResponse.json({
      profile,
      // All calls (classified + pending) for the tab
      allCalls,
      classifiedCalls,
      pendingCalls,
      // Sidebar data
      activityLog:    activityRes.rows,
      funnelHistory:  funnelRes.rows,
      // Auto-classification banner
      potentialUnlinkedCount: Number(potentialCallsRes.rows[0]?.count || 0),
    })
  } catch (error) {
    console.error('[GET /api/clients/[acronym]/profile]', error)
    return NextResponse.json({ error: error.message || 'Failed to load client profile.' }, { status: error.status || 500 })
  }
}

export async function PATCH(request, { params }) {
  try {
    // Notes can be saved by any authenticated user
    // GBP baseline fields require admin or superadmin
    const auth = await requireApiUser(['ga', 'cx', 'admin', 'superadmin'])
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { user }  = auth
    const { acronym } = await params
    const upper       = String(acronym || '').toUpperCase()
    const body        = await request.json()

    const sets = []
    const vals = []
    let idx = 1

    // teamNotes — any authenticated user
    if (typeof body.teamNotes === 'string') {
      sets.push(`"teamNotes" = $${idx++}`)
      vals.push(body.teamNotes)
    }
    // note fields — any authenticated user (internal team notes)
    if (typeof body.websiteNotes === 'string') {
      sets.push(`"websiteNotes" = $${idx++}`)
      vals.push(body.websiteNotes)
    }
    if (typeof body.seoNotes === 'string') {
      sets.push(`"seoNotes" = $${idx++}`)
      vals.push(body.seoNotes)
    }
    if (typeof body.crmNotes === 'string') {
      sets.push(`"crmNotes" = $${idx++}`)
      vals.push(body.crmNotes)
    }

    // Admin-only fields
    const isAdmin = userHasRole(user, ['admin', 'superadmin'])
    if (isAdmin) {
      if (body.gbpBaselineReviews !== undefined) {
        sets.push(`"gbpBaselineReviews" = $${idx++}`)
        vals.push(body.gbpBaselineReviews === null ? null : parseInt(body.gbpBaselineReviews, 10))
      }
      if (body.gbpBaselineRating !== undefined) {
        sets.push(`"gbpBaselineRating" = $${idx++}`)
        vals.push(body.gbpBaselineRating === null ? null : parseFloat(body.gbpBaselineRating))
      }
      if (body.gbpBaselineDate !== undefined) {
        sets.push(`"gbpBaselineDate" = $${idx++}`)
        vals.push(body.gbpBaselineDate || null)
      }
      if (typeof body.gmbAccess === 'string') {
        sets.push(`"gmbAccess" = $${idx++}`)
        vals.push(body.gmbAccess)
      }
    }

    if (sets.length === 0) {
      return NextResponse.json({ error: 'No updatable fields provided.' }, { status: 400 })
    }

    sets.push(`"updatedAt" = NOW()`)
    vals.push(upper)

    await pool.query(
      `UPDATE "ClientProfile" SET ${sets.join(', ')} WHERE "tenantId" = 'gyc' AND acronym = $${idx}`,
      vals
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[PATCH /api/clients/[acronym]/profile]', error)
    return NextResponse.json({ error: error.message || 'Failed to save.' }, { status: 500 })
  }
}
