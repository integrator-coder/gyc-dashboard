export const dynamic = 'force-dynamic'

/**
 * POST /api/clients/[acronym]/gbp/audit
 *
 * Create a new (append-only) audit record.
 * Body: {
 *   locationId, triggerType,
 *   isClaimed, reviewCount, avgRating, photoCount,
 *   primaryCategoryCorrect, secondaryCategoriesSet, descriptionComplete,
 *   websiteLinked, phoneListened, hoursComplete, has50Reviews, ratingAbove4,
 *   respondedToReviews, photoRecentMonth, postRecentWeek, qaActive,
 *   servicesListed, serviceAreaConfigured, specialHoursUpdated,
 *   checklistNotes, auditNotes, snapshotData
 * }
 * compositeScore is calculated server-side.
 * Requires: admin, superadmin, or ga role.
 */

import { NextResponse } from 'next/server'
import { requireApiUser, userHasRole } from '@/lib/auth'
import { pool } from '@/lib/pg'

const CHECKLIST_FIELDS = [
  'isClaimed',
  'primaryCategoryCorrect',
  'secondaryCategoriesSet',
  'descriptionComplete',
  'websiteLinked',
  'phoneListened',
  'hoursComplete',
  'has50Reviews',
  'ratingAbove4',
  'respondedToReviews',
  'photoRecentMonth',
  'postRecentWeek',
  'qaActive',
  'servicesListed',
  'serviceAreaConfigured',
  'specialHoursUpdated',
]

function calcCompositeScore(body) {
  const nonNull = CHECKLIST_FIELDS.filter((f) => body[f] != null)
  if (nonNull.length === 0) return null
  const trueCount = nonNull.filter((f) => body[f] === true).length
  return Math.round((trueCount / nonNull.length) * 100)
}

export async function POST(req, { params }) {
  const auth = await requireApiUser(['admin', 'superadmin', 'ga'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { user } = auth

  const { acronym } = await params
  const body = await req.json()
  const { locationId, triggerType = 'manual' } = body

  if (!locationId)
    return NextResponse.json({ error: 'locationId is required' }, { status: 400 })

  // Verify location belongs to this client
  const { rows: locRows } = await pool.query(
    `SELECT id FROM "GBPLocation"
     WHERE id = $1 AND "clientAcronym" = $2 AND "tenantId" = 'gyc'`,
    [locationId, acronym.toUpperCase()]
  )
  if (!locRows.length)
    return NextResponse.json({ error: 'Location not found' }, { status: 404 })

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
      triggerType,
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
      JSON.stringify(body.checklistNotes ?? {}),
      compositeScore,
      body.auditNotes ?? null,
      JSON.stringify(body.snapshotData ?? {}),
    ]
  )

  return NextResponse.json({ audit: rows[0] }, { status: 201 })
}
