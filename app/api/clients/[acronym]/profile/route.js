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
import {
  computeEnrollmentRollup,
  getCurrentPeriodMonth,
  syncClientProfileEnrollmentRollup,
  upsertClientEnrollmentVerification,
} from '@/lib/enrollment-verification'

function computeHealthScore(row, gbpLocations = []) {
  let score = 10
  if (row.isOverdue)                          score -= 3
  if (row.funnelTrend === 'down')             score -= 2
  if (Number(row.overdueCount || 0) > 1)      score -= 1
  if (row.stripeStatus === 'past_due')        score -= 2

  // GBP signals
  const activeGbp = gbpLocations.filter(l => l.isActive !== false)
  if (activeGbp.length > 0) {
    // −2: any location unclaimed
    const anyUnclaimed = activeGbp.some(l => l.liveDataSnapshot?.isClaimed === false)
    if (anyUnclaimed)                         score -= 2

    // −1: any location missing a verified placeId (not properly linked)
    const anyMissingPlaceId = activeGbp.some(l => !l.gbpPlaceId && !l.placeId)
    if (anyMissingPlaceId)                    score -= 1

    // −1: any location rating below 4.0
    const anyLowRating = activeGbp.some(l => {
      const r = l.liveDataSnapshot?.rating
      return r != null && Number(r) < 4.0
    })
    if (anyLowRating)                         score -= 1

    // −1: any location with fewer than 10 reviews
    const anyLowReviews = activeGbp.some(l => {
      const rc = l.liveDataSnapshot?.reviewCount
      return rc != null && Number(rc) < 10
    })
    if (anyLowReviews)                        score -= 1

    // −1: any location missing hours or phone on GBP
    const anyMissingContactInfo = activeGbp.some(l => {
      const ac = l.liveDataSnapshot?.autoChecks
      if (!ac) return false
      return ac.hoursComplete === false || ac.phoneListened === false
    })
    if (anyMissingContactInfo)                score -= 1

    // −1: any location with zero photos
    const anyNoPhotos = activeGbp.some(l => {
      const tp = l.liveDataSnapshot?.totalPhotos
      return tp != null && Number(tp) === 0
    })
    if (anyNoPhotos)                          score -= 1
  }

  return Math.max(1, Math.min(10, score))
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

function toNullableNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
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
    const auth = await requireApiUser(['ga', 'cx', 'manager', 'admin', 'superadmin'])
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { user } = auth
    const { acronym } = await params
    const upper = String(acronym || '').toUpperCase()

    // ── 1. Fetch ClientProfile ─────────────────────────────────────────────
    let profileQuery = `SELECT * FROM "ClientProfile" WHERE "tenantId" = $1 AND acronym = $2 LIMIT 1`
    let profileParams = ['gyc', upper]


    const profileRes = await pool.query(profileQuery, profileParams)
    if (!profileRes.rows.length) {
      return NextResponse.json({ error: 'Client not found.' }, { status: 404 })
    }

    const profileRow = profileRes.rows[0]

    // ── 2. All linked calls (no limit) + activity + funnel — parallel ──────
    const ghlId = profileRow.ghlContactId || '__none__'
    const profileId = profileRow.id || -1

    const [callsRes, activityRes, funnelRes, funnelByLocationRes, funnelAggregateRes, potentialCallsRes, gbpLocationsRes, stripeLinksRes, paymentsRes] = await Promise.all([

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
        SELECT id, "locationName", address, city, state, "gbpUrl", "isActive", capacity, "currentEnrollment", "avgTuition"
        FROM "GBPLocation"
        WHERE "tenantId" = 'gyc' AND "clientAcronym" = $1
        ORDER BY "locationName" ASC
      `, [upper]).catch(() => ({ rows: [] })),

      pool.query(`
        SELECT csl."stripeCustomerId", csl."isPrimary", sc.mrr, sc.status, sc.email, sc.name, sc."companyName"
        FROM "ClientStripeLink" csl
        LEFT JOIN "StripeCustomer" sc ON sc.id = csl."stripeCustomerId"
        WHERE csl."tenantId" = 'gyc'
          AND csl."clientProfileId" = $1
        ORDER BY csl."isPrimary" DESC, sc.mrr DESC NULLS LAST, csl."createdAt" ASC
      `, [profileId]).catch(() => ({ rows: [] })),

      // Recent payments from StripeInvoiceSnapshot
      pool.query(`
        SELECT sis.id, sis."amountPaid", sis."paidAt", sis."invoiceCreatedAt", sis.status,
               sis."invoiceNumber", sis."hostedInvoiceUrl", sis.description,
               sis."periodStart", sis."periodEnd"
        FROM "StripeInvoiceSnapshot" sis
        JOIN "ClientStripeLink" csl ON csl."stripeCustomerId" = sis."stripeCustomerId"
        WHERE csl."tenantId" = 'gyc'
          AND csl."clientProfileId" = $1
          AND sis.status = 'paid'
        ORDER BY sis."paidAt" DESC NULLS LAST
        LIMIT 100
      `, [profileId]).catch(() => ({ rows: [] })),
    ])

    const allCalls = callsRes.rows

    // Split into classified vs pending-classification
    const classifiedCalls = allCalls.filter((c) => c.classifiedAs || c.aiClassification || (c.purposes && c.purposes.length > 0))
    const pendingCalls    = allCalls.filter((c) => !c.classifiedAs && !c.aiClassification && (!c.purposes || c.purposes.length === 0))

    const liveLinkedStripeRows = (stripeLinksRes.rows || []).filter((row) => {
      const status = String(row.status || '').toLowerCase()
      return Number(row.mrr || 0) > 0 && ['active', 'trialing', 'past_due', 'unpaid'].includes(status)
    })
    const normalizedLinkedMrr = liveLinkedStripeRows.length
      ? liveLinkedStripeRows.reduce((sum, row) => sum + Number(row.mrr || 0), 0)
      : null

    const profile = {
      ...profileRow,
      mrr:                  (() => {
        const stripeMrr = normalizedLinkedMrr != null ? Number(normalizedLinkedMrr) : null
        const profileMrr = profileRow.mrr != null ? Number(profileRow.mrr) : null
        // Use the higher of Stripe MRR vs profile MRR — Stripe may only see partial subscriptions
        if (stripeMrr != null && profileMrr != null) return Math.max(stripeMrr, profileMrr)
        return stripeMrr ?? profileMrr
      })(),
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
      healthScore:          0, // recalculated below once GBP data is loaded
    }

    const recentPayments = (paymentsRes.rows || []).map((r) => ({
      id:          r.id,
      amount:      Number(r.amountPaid || 0),
      date:        r.paidAt || r.invoiceCreatedAt,
      paidAt:      r.paidAt,
      status:      r.status,
      invoiceNumber: r.invoiceNumber,
      invoiceUrl:  r.hostedInvoiceUrl,
      description: r.description,
      periodStart: r.periodStart,
      periodEnd:   r.periodEnd,
    }))

    // Derive next billing date from most recent invoice's periodEnd
    const nextBillingDate = recentPayments.length > 0
      ? recentPayments[0].periodEnd || null
      : null
    // Subscription start = oldest invoice date
    const subscriptionStartDate = recentPayments.length > 0
      ? recentPayments[recentPayments.length - 1].periodStart || recentPayments[recentPayments.length - 1].paidAt || null
      : null

    const gbpLocations = gbpLocationsRes.rows.map((row) => ({
      ...row,
      capacity: row.capacity != null ? Number(row.capacity) : null,
      currentEnrollment: row.currentEnrollment != null ? Number(row.currentEnrollment) : null,
      avgTuition: row.avgTuition != null ? Number(row.avgTuition) : null,
    }))

    const activeGbpLocations = gbpLocations.filter((row) => row.isActive !== false)
    const enrollmentRollupActive = activeGbpLocations.length > 0

    // Override locationCount with live GBP record count when data exists
    // (master sheet sync is the source but can lag behind actual GBP records)
    if (activeGbpLocations.length > 0) {
      profile.locationCount = activeGbpLocations.length
    }

    // Recompute health score now that GBP data is available
    profile.healthScore = computeHealthScore(profileRow, gbpLocations)

    if (enrollmentRollupActive) {
      const rollup = computeEnrollmentRollup(activeGbpLocations)
      profile.centerCapacity = rollup.centerCapacity
      profile.currentEnrollment = rollup.currentEnrollment
    }

    const latestEnrollmentVerificationRes = await pool.query(
      `SELECT *
       FROM "ClientEnrollmentVerification"
       WHERE "tenantId" = $1
         AND "clientAcronym" = $2
         AND "locationName" IS NULL
       ORDER BY "periodMonth" DESC, "checkedAt" DESC, id DESC
       LIMIT 1`,
      ['gyc', upper]
    ).catch(() => ({ rows: [] }))

    const latestEnrollmentVerificationRow = latestEnrollmentVerificationRes.rows[0] || null
    const latestEnrollmentVerification = latestEnrollmentVerificationRow
      ? {
          ...latestEnrollmentVerificationRow,
          capacity: latestEnrollmentVerificationRow.capacity != null ? Number(latestEnrollmentVerificationRow.capacity) : null,
          currentEnrollment: latestEnrollmentVerificationRow.currentEnrollment != null ? Number(latestEnrollmentVerificationRow.currentEnrollment) : null,
          avgTuition: latestEnrollmentVerificationRow.avgTuition != null ? Number(latestEnrollmentVerificationRow.avgTuition) : null,
        }
      : null

    profile.centerCapacity = toNullableNumber(profile.centerCapacity)
    profile.currentEnrollment = toNullableNumber(profile.currentEnrollment)
    profile.enrollmentRollupSource = enrollmentRollupActive ? 'locations' : 'profile'
    profile.enrollmentRollupActive = enrollmentRollupActive

    return NextResponse.json({
      profile,
      // All calls (classified + pending) for the tab
      allCalls,
      classifiedCalls,
      pendingCalls,
      // Sidebar data
      activityLog:      activityRes.rows,
      funnelHistory:    funnelRes.rows,
      funnelByLocation: funnelByLocationRes.rows,
      funnelAggregate:  funnelAggregateRes.rows,
      locations:        [...new Set([...funnelByLocationRes.rows.map((r) => r.locationName), ...gbpLocations.map((r) => r.locationName)].filter(Boolean))],
      gbpLocations,
      enrollmentVerification: {
        currentPeriodMonth: getCurrentPeriodMonth(),
        latest: latestEnrollmentVerification,
      },
      // Auto-classification banner
      potentialUnlinkedCount: Number(potentialCallsRes.rows[0]?.count || 0),
      // Recent Stripe payments
      recentPayments,
      nextBillingDate,
      subscriptionStartDate,
    })
  } catch (error) {
    console.error('[GET /api/clients/[acronym]/profile]', error)
    return NextResponse.json({ error: error.message || 'Failed to load client profile.' }, { status: error.status || 500 })
  }
}

export async function PATCH(request, { params }) {
  const client = await pool.connect()

  try {
    // Notes can be saved by any authenticated user
    // GBP baseline fields require admin or superadmin
    const auth = await requireApiUser(['ga', 'cx', 'manager', 'admin', 'superadmin'])
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { user }  = auth
    const { acronym } = await params
    const upper       = String(acronym || '').toUpperCase()
    const body        = await request.json()

    const wantsTopLevelEnrollmentEdit = hasOwn(body, 'currentEnrollment') || hasOwn(body, 'centerCapacity')

    const { rows: rollupRows } = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM "GBPLocation"
       WHERE "tenantId" = 'gyc' AND "clientAcronym" = $1 AND "isActive" = TRUE`,
      [upper]
    )

    const enrollmentRollupActive = Number(rollupRows[0]?.count || 0) > 0

    if (enrollmentRollupActive && wantsTopLevelEnrollmentEdit) {
      return NextResponse.json(
        { error: 'Capacity and current enrollment are rolled up from locations. Update the location rows instead.' },
        { status: 400 }
      )
    }

    await client.query('BEGIN')

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

    // Client folder URL — any authenticated user
    if (typeof body.clientFolderUrl === 'string') {
      sets.push(`"clientFolderUrl" = $${idx++}`)
      vals.push(body.clientFolderUrl.trim() || null)
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
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'No updatable fields provided.' }, { status: 400 })
    }

    sets.push(`"updatedAt" = NOW()`)
    vals.push(upper)

    await client.query(
      `UPDATE "ClientProfile" SET ${sets.join(', ')} WHERE "tenantId" = 'gyc' AND acronym = $${idx}`,
      vals
    )

    if (Object.keys(serviceUpdates).length > 0) {
      const { rows } = await client.query(
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

        await client.query(
          `UPDATE "ClientProfile"
           SET "serviceList" = $1, "updatedAt" = NOW()
           WHERE "tenantId" = 'gyc' AND acronym = $2`,
          [serviceList.length ? serviceList : null, upper]
        )
      }
    }

    const touchedEnrollmentSnapshot = hasOwn(body, 'avgTuition') || wantsTopLevelEnrollmentEdit

    if (enrollmentRollupActive && touchedEnrollmentSnapshot) {
      await syncClientProfileEnrollmentRollup(client, {
        tenantId: 'gyc',
        clientAcronym: upper,
      })
    }

    let verification = null
    if (touchedEnrollmentSnapshot) {
      verification = await upsertClientEnrollmentVerification(client, {
        tenantId: 'gyc',
        clientAcronym: upper,
        status: 'updated',
        checkedBy: user.email || user.name || null,
      })
    }

    await client.query('COMMIT')

    return NextResponse.json({ ok: true, verification })
  } catch (error) {
    await client.query('ROLLBACK').catch(() => null)
    console.error('[PATCH /api/clients/[acronym]/profile]', error)
    return NextResponse.json({ error: error.message || 'Failed to save.' }, { status: error.status || 500 })
  } finally {
    client.release()
  }
}
