export const dynamic = 'force-dynamic'

/**
 * GET  /api/clients/[acronym]/profile
 *   Full client profile from ClientProfile + all ZoomCall history
 *   + ActivityLog + ClientFunnelMonth + unlinked call detection
 *
 * PATCH /api/clients/[acronym]/profile
 *   Update editable client-card fields, including notes and enrollment snapshot values.
 */

import { NextResponse } from 'next/server'
import { requireApiUser, userHasRole } from '@/lib/auth'
import { pool } from '@/lib/pg'
import Stripe from 'stripe'

function computeHealthScore(row) {
  let score = 10
  if (row.isOverdue)                          score -= 3
  if (row.funnelTrend === 'down')             score -= 2
  if (Number(row.overdueCount || 0) > 1)      score -= 1
  if (row.stripeStatus === 'past_due')        score -= 2
  return Math.max(1, Math.min(10, score))
}

function calcSubscriptionMrr(sub) {
  const items = sub?.items?.data || []
  return items.reduce((sum, item) => {
    const price = item?.price || {}
    const qty = item?.quantity || 1
    const unit = (price.unit_amount || 0) / 100
    const interval = price?.recurring?.interval || 'month'
    const count = price?.recurring?.interval_count || 1

    let monthly = unit * qty
    if (interval === 'year') monthly = (unit * qty) / (12 * count)
    else if (interval === 'month') monthly = (unit * qty) / count
    else if (interval === 'week') monthly = (unit * qty * 52) / (12 * count)
    else if (interval === 'day') monthly = (unit * qty * 365) / (12 * count)

    return sum + monthly
  }, 0)
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

function parseNullableNumber(value, { label, integer = false } = {}) {
  if (value === null || value === '') return null

  const parsed = typeof value === 'number' ? value : Number(String(value).trim())
  if (!Number.isFinite(parsed)) {
    const err = new Error(`${label || 'Value'} must be a valid number.`)
    err.status = 400
    throw err
  }

  if (integer && !Number.isInteger(parsed)) {
    const err = new Error(`${label || 'Value'} must be a whole number.`)
    err.status = 400
    throw err
  }

  return integer ? parsed : parsed
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

    const [callsRes, activityRes, funnelRes, funnelByLocationRes, funnelAggregateRes, potentialCallsRes, gbpLocationsRes] = await Promise.all([

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

      // Last 12 months funnel aggregate (chronological)
      pool.query(`
        SELECT month,
               SUM(leads)::int      AS leads,
               SUM(tours)::int      AS tours,
               SUM(registered)::int AS registered
        FROM "ClientFunnelMonth"
        WHERE "clientId" = $1
          AND "locationName" = 'default'
        GROUP BY month
        ORDER BY month DESC
        LIMIT 12
      `, [upper]).catch(() => ({ rows: [] })),

      // Per-location funnel data, last 24 months (DESC for latest-first)
      pool.query(`
        SELECT "locationName", month, leads, tours, registered,
          ROUND(("leadToTour" * 100)::numeric, 1) as "tourRate",
          ROUND(("tourToReg" * 100)::numeric, 1) as "closeRate",
          ROUND(("leadToReg" * 100)::numeric, 1) as "convRate"
        FROM "ClientFunnelMonth"
        WHERE "tenantId" = 'gyc' AND "clientId" = $1
          AND "locationName" != 'default'
          AND leads > 0
        ORDER BY month DESC, "locationName" ASC
        LIMIT 500
      `, [upper]).catch(() => ({ rows: [] })),

      // Aggregate (default) rows, last 12 months chronological
      pool.query(`
        SELECT month, leads::int, tours::int, registered::int,
          ROUND(("leadToTour" * 100)::numeric, 1) as "tourRate",
          ROUND(("tourToReg" * 100)::numeric, 1) as "closeRate",
          ROUND(("leadToReg" * 100)::numeric, 1) as "convRate"
        FROM "ClientFunnelMonth"
        WHERE "tenantId" = 'gyc' AND "clientId" = $1
          AND "locationName" = 'default'
          AND leads > 0
        ORDER BY month ASC
        LIMIT 12
      `, [upper]).catch(() => ({ rows: [] })),

      // Per-location funnel data already added above

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

      pool.query(`
        SELECT id, "locationName", address, city, state, "gbpUrl", "isActive"
        FROM "GBPLocation"
        WHERE "tenantId" = 'gyc' AND "clientAcronym" = $1
        ORDER BY "locationName" ASC
      `, [upper]).catch(() => ({ rows: [] })),
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
      currentEnrollment:    profileRow.currentEnrollment    != null ? Number(profileRow.currentEnrollment)    : null,
      centerCapacity:       profileRow.centerCapacity       != null ? Number(profileRow.centerCapacity)       : null,
      avgTuition:           profileRow.avgTuition           != null ? Number(profileRow.avgTuition)           : null,
      catchUpRate:          profileRow.catchUpRate          != null ? Number(profileRow.catchUpRate)          : null,
      avgMonthlyLeads:      profileRow.avgMonthlyLeads      != null ? Number(profileRow.avgMonthlyLeads)      : null,
      avgMonthlyTours:      profileRow.avgMonthlyTours      != null ? Number(profileRow.avgMonthlyTours)      : null,
      avgMonthlyRegistered: profileRow.avgMonthlyRegistered != null ? Number(profileRow.avgMonthlyRegistered) : null,
      leadToTourRate:       profileRow.leadToTourRate       != null ? Number(profileRow.leadToTourRate)       : null,
      tourToRegRate:        profileRow.tourToRegRate        != null ? Number(profileRow.tourToRegRate)        : null,
      healthScore:          computeHealthScore(profileRow),
    }

    // ── Stripe: recent payments + LTV recalculation ──────────────────────
    let recentPayments = []
    let finalLtv = profile.lifetimeValue || 0
    let liveMrr = profile.mrr || 0

    if (profile.stripeCustomerId && process.env.STRIPE_SECRET_KEY) {
      try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })

        // Fetch live subscriptions to compute true customer-level MRR
        const subs = await stripe.subscriptions.list({
          customer: profile.stripeCustomerId,
          status: 'all',
          limit: 100,
          expand: ['data.items.data.price'],
        })
        const liveSubs = subs.data.filter(s => ['active', 'past_due', 'trialing'].includes(s.status))
        liveMrr = liveSubs.reduce((sum, sub) => sum + calcSubscriptionMrr(sub), 0)

        // Fetch ALL charges via pagination
        let allCharges = []
        let hasMore = true
        let startingAfter = undefined

        while (hasMore) {
          const params = { customer: profile.stripeCustomerId, limit: 100 }
          if (startingAfter) params.starting_after = startingAfter
          const batch = await stripe.charges.list(params)
          const succeeded = batch.data.filter(c => c.status === 'succeeded')
          allCharges = allCharges.concat(succeeded.map(c => ({
            date: new Date(c.created * 1000).toISOString().slice(0, 10),
            amount: c.amount / 100,
            description: c.description || 'Payment',
            id: c.id,
          })))
          hasMore = batch.has_more
          if (batch.data.length > 0) startingAfter = batch.data[batch.data.length - 1].id
        }

        recentPayments = allCharges // all of them, already DESC from Stripe

        // Calculate real LTV from all succeeded charges
        const ltv = allCharges.reduce((s, c) => s + c.amount, 0)
        finalLtv = ltv

        // Update DB with correct LTV / MRR if different
        if (Math.abs(ltv - (profile.lifetimeValue || 0)) > 1 || Math.abs(liveMrr - (profile.mrr || 0)) > 1) {
          await pool.query(
            `UPDATE "ClientProfile" SET "lifetimeValue" = $1, "mrr" = $2 WHERE "tenantId" = 'gyc' AND acronym = $3`,
            [ltv, liveMrr, upper]
          )
          await pool.query(
            `UPDATE "StripeCustomer" SET "mrr" = $1 WHERE id = $2`,
            [liveMrr, profile.stripeCustomerId]
          ).catch(() => null)
          profile.lifetimeValue = ltv
          profile.mrr = liveMrr
        }
      } catch (e) {
        console.error('Stripe error for', upper, e.message)
      }
    }

    return NextResponse.json({
      profile: { ...profile, mrr: liveMrr || profile.mrr, lifetimeValue: finalLtv },
      // All calls (classified + pending) for the tab
      allCalls,
      classifiedCalls,
      pendingCalls,
      // Sidebar data
      activityLog:      activityRes.rows,
      funnelHistory:    funnelRes.rows,
      funnelByLocation: funnelByLocationRes.rows,
      funnelAggregate:  funnelAggregateRes.rows,
      locations:        [...new Set(funnelByLocationRes.rows.map(r => r.locationName))],
      gbpLocations:     gbpLocationsRes.rows,
      // Auto-classification banner
      potentialUnlinkedCount: Number(potentialCallsRes.rows[0]?.count || 0),
      // Recent Stripe payments
      recentPayments,
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

    // Enrollment snapshot fields — any authenticated user
    if (hasOwn(body, 'currentEnrollment')) {
      sets.push(`"currentEnrollment" = $${idx++}`)
      vals.push(parseNullableNumber(body.currentEnrollment, { label: 'Current enrollment', integer: true }))
    }
    if (hasOwn(body, 'centerCapacity')) {
      sets.push(`"centerCapacity" = $${idx++}`)
      vals.push(parseNullableNumber(body.centerCapacity, { label: 'Center capacity', integer: true }))
    }
    if (hasOwn(body, 'avgTuition')) {
      sets.push(`"avgTuition" = $${idx++}`)
      vals.push(parseNullableNumber(body.avgTuition, { label: 'Avg tuition' }))
    }

    // Service toggles — any authenticated user
    const serviceFields = [
      'hasWebsite',
      'hasSEO',
      'hasCRM',
      'hasBlueprint',
      'hasGoogleAds',
      'hasPaidMedia',
    ]
    const serviceUpdates = {}
    for (const field of serviceFields) {
      if (typeof body[field] === 'boolean') {
        sets.push(`"${field}" = $${idx++}`)
        vals.push(body[field])
        serviceUpdates[field] = body[field]
      }
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

    if (Object.keys(serviceUpdates).length > 0) {
      const { rows } = await pool.query(
        `SELECT "hasWebsite", "hasSEO", "hasCRM", "hasBlueprint", "hasGoogleAds", "hasPaidMedia", "hasCommand"
         FROM "ClientProfile"
         WHERE "tenantId" = 'gyc' AND acronym = $1
         LIMIT 1`,
        [upper]
      )
      const row = rows[0]
      if (row) {
        const serviceList = [
          row.hasWebsite ? 'Website' : null,
          row.hasSEO ? 'SEO' : null,
          row.hasCRM ? 'CRM' : null,
          row.hasBlueprint ? 'Blueprint' : null,
          row.hasGoogleAds ? 'Google Ads' : null,
          row.hasPaidMedia ? 'Paid Media' : null,
          row.hasCommand ? 'Command' : null,
        ].filter(Boolean)

        await pool.query(
          `UPDATE "ClientProfile"
           SET "serviceList" = $1, "updatedAt" = NOW()
           WHERE "tenantId" = 'gyc' AND acronym = $2`,
          [serviceList.length ? serviceList : null, upper]
        )
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[PATCH /api/clients/[acronym]/profile]', error)
    return NextResponse.json({ error: error.message || 'Failed to save.' }, { status: 500 })
  }
}
