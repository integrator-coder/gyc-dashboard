export const dynamic = 'force-dynamic'

/**
 * POST /api/clients/[acronym]/gbp/[locationId]/auto-audit
 *
 * Creates a GBPAudit row seeded from the location's liveDataSnapshot.autoChecks.
 * Auto-check fields are populated from liveDataSnapshot; human-check fields are null.
 * compositeScore is calculated only from non-null fields.
 * Requires: admin, superadmin, or ga role.
 */

import { NextResponse } from 'next/server'
import { requireApiUser, userHasRole } from '@/lib/auth'
import { pool } from '@/lib/pg'

const AUTO_CHECK_FIELDS = [
  'isClaimed',
  'websiteLinked',
  'phoneListened',
  'hoursComplete',
  'secondaryCategoriesSet',
  'has50Reviews',
  'ratingAbove4',
]

const HUMAN_CHECK_FIELDS = [
  'respondedToReviews',
  'photoRecentMonth',
  'postRecentWeek',
  'qaActive',
  'servicesListed',
  'serviceAreaConfigured',
  'specialHoursUpdated',
  'primaryCategoryCorrect',
  'descriptionComplete',
]

const ALL_CHECKLIST_FIELDS = [...AUTO_CHECK_FIELDS, ...HUMAN_CHECK_FIELDS]

function calcCompositeScore(body) {
  const nonNull = ALL_CHECKLIST_FIELDS.filter((f) => body[f] != null)
  if (nonNull.length === 0) return null
  const trueCount = nonNull.filter((f) => body[f] === true).length
  return Math.round((trueCount / nonNull.length) * 100)
}

export async function POST(req, { params }) {
  const user = await requireApiUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!userHasRole(user, ['admin', 'superadmin', 'ga']))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { acronym, locationId } = await params

  // Verify location belongs to this client and get liveDataSnapshot
  const { rows: locRows } = await pool.query(
    `SELECT id, "liveDataSnapshot" FROM "GBPLocation"
     WHERE id = $1 AND "clientAcronym" = $2 AND "tenantId" = 'gyc'`,
    [locationId, acronym.toUpperCase()]
  )
  if (!locRows.length)
    return NextResponse.json({ error: 'Location not found' }, { status: 404 })

  const loc = locRows[0]
  const snapshot = loc.liveDataSnapshot || {}
  const autoChecks = snapshot.autoChecks || {}

  // Build audit body: auto fields from snapshot, human fields null
  const body = {
    ...Object.fromEntries(AUTO_CHECK_FIELDS.map((f) => [f, autoChecks[f] ?? null])),
    ...Object.fromEntries(HUMAN_CHECK_FIELDS.map((f) => [f, null])),
    reviewCount: snapshot.reviewCount ?? null,
    avgRating: snapshot.rating ?? null,
    photoCount: snapshot.totalPhotos ?? null,
  }

  const compositeScore = calcCompositeScore(body)

  const { rows } = await pool.query(
    `INSERT INTO "GBPAudit" (
       "tenantId", "locationId", "triggerType", "triggeredBy",
       "isClaimed", "reviewCount", "avgRating", "photoCount",
       "primaryCategoryCorrect", "secondaryCategoriesSet", "descriptionComplete",
       "websiteLinked", "phoneListened", "hoursComplete", "has50Reviews",
       "ratingAbove4", "respondedToReviews", "photoRecentMonth", "postRecentWeek",
       "qaActive", "servicesListed", "serviceAreaConfigured", "specialHoursUpdated",
       "checklistNotes", "compositeScore", "auditNotes", "snapshotData"
     ) VALUES (
       'gyc', $1, $2, $3,
       $4, $5, $6, $7,
       $8, $9, $10,
       $11, $12, $13, $14,
       $15, $16, $17, $18,
       $19, $20, $21, $22,
       $23, $24, $25, $26
     ) RETURNING *`,
    [
      locationId,
      'auto',
      user.email ?? null,
      body.isClaimed ?? null,
      body.reviewCount ?? null,
      body.avgRating ?? null,
      body.photoCount ?? null,
      body.primaryCategoryCorrect ?? null,
      body.secondaryCategoriesSet ?? null,
      body.descriptionComplete ?? null,
      body.websiteLinked ?? null,
      body.phoneListened ?? null,
      body.hoursComplete ?? null,
      body.has50Reviews ?? null,
      body.ratingAbove4 ?? null,
      body.respondedToReviews ?? null,
      body.photoRecentMonth ?? null,
      body.postRecentWeek ?? null,
      body.qaActive ?? null,
      body.servicesListed ?? null,
      body.serviceAreaConfigured ?? null,
      body.specialHoursUpdated ?? null,
      JSON.stringify({}),
      compositeScore,
      null,
      JSON.stringify(snapshot),
    ]
  )

  return NextResponse.json({ audit: rows[0] }, { status: 201 })
}
