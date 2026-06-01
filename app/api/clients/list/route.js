export const dynamic = 'force-dynamic'

/**
 * GET /api/clients/list
 *
 * Paginated, filtered list of ClientProfile rows.
 *
 * Query params:
 *   search   — fuzzy match on acronym or companyName
 *   ga       — filter by assignedGA name (partial, case-insensitive)
 *   status   — active | onboarding | paused | cancelled
 *   overdue  — "true" to show only overdue clients
 *   service  — website | seo | crm | blueprint | google_ads | paid_media
 *   trend    — up | down | stable
 *   page     — page number (default 1)
 *   limit    — results per page (default 50)
 *   sort     — mrr | companyName | assignedGA | funnelTrend (default companyName)
 *
 * Response: { clients, total, page, totalPages }
 */

import { NextResponse } from 'next/server'
import { requireApiUser, userHasRole } from '@/lib/auth'
import { pool } from '@/lib/pg'

function computeHealthScore(row) {
  let score = 10
  // Deduct for overdue
  if (row.isOverdue) score -= 2
  if (Number(row.overdueCount || 0) > 2) score -= 1
  // Deduct for funnel trend
  if (row.funnelTrend === 'down') score -= 2
  // Deduct for stripe issues
  if (row.stripeStatus === 'past_due') score -= 2
  if (row.stripeStatus === 'canceled') score -= 3
  // Deduct for paused/cancelled
  if (row.status === 'paused') score -= 1
  if (row.status === 'cancelled') score -= 3
  return Math.max(1, Math.min(10, score))
}

const SERVICE_COLUMN = {
  website: '"hasWebsite"',
  seo: '"hasSEO"',
  crm: '"hasCRM"',
  blueprint: '"hasBlueprint"',
  google_ads: '"hasGoogleAds"',
  paid_media: '"hasPaidMedia"',
}

// Use GREATEST so the profile MRR wins when Stripe only sees partial subscriptions
const NORMALIZED_MRR_SQL = 'CASE WHEN COALESCE(linked_mrr."normalizedLinkedMrr", cp.mrr) IS NOT NULL THEN GREATEST(COALESCE(linked_mrr."normalizedLinkedMrr", 0), COALESCE(cp.mrr, 0)) END'

const SORT_COLUMN = {
  mrr: `${NORMALIZED_MRR_SQL} DESC NULLS LAST, cp."companyName" ASC`,
  companyName: 'cp."companyName" ASC NULLS LAST',
  assignedGA: 'cp."assignedGA" ASC NULLS LAST, cp."companyName" ASC',
  funnelTrend: `CASE cp."funnelTrend" WHEN 'up' THEN 1 WHEN 'stable' THEN 2 WHEN 'down' THEN 3 ELSE 4 END ASC, cp."companyName" ASC`,
}

export async function GET(request) {
  try {
    const auth = await requireApiUser(['ga', 'cx', 'admin', 'superadmin'])
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { user } = auth
    const { searchParams } = new URL(request.url)

    const search = searchParams.get('search')?.trim() || ''
    const ga = searchParams.get('ga')?.trim() || ''
    const status = searchParams.get('status')?.trim() || ''
    const overdue = searchParams.get('overdue') === 'true'
    const service = searchParams.get('service')?.trim() || ''
    const trend = searchParams.get('trend')?.trim() || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))
    const sort = searchParams.get('sort')?.trim() || 'companyName'

    const params = ['gyc']
    const conditions = [`cp."tenantId" = $1`]

    if (search) {
      params.push(`%${search.toLowerCase()}%`)
      const idx = params.length
      conditions.push(`(lower(COALESCE(cp.acronym,'')) LIKE $${idx} OR lower(COALESCE(cp."companyName",'')) LIKE $${idx})`)
    }

    if (ga) {
      params.push(`%${ga.toLowerCase()}%`)
      conditions.push(`lower(COALESCE(cp."assignedGA",'')) LIKE $${params.length}`)
    }

    if (status) {
      params.push(status.toLowerCase())
      conditions.push(`lower(COALESCE(cp.status,'')) = $${params.length}`)
    }

    if (overdue) {
      conditions.push(`cp."isOverdue" = TRUE`)
    }

    if (service && SERVICE_COLUMN[service]) {
      conditions.push(`cp.${SERVICE_COLUMN[service]} = TRUE`)
    }

    if (trend && ['up', 'down', 'stable'].includes(trend)) {
      params.push(trend)
      conditions.push(`cp."funnelTrend" = $${params.length}`)
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`
    const orderClause = `ORDER BY ${SORT_COLUMN[sort] || SORT_COLUMN.companyName}`
    const offset = (page - 1) * limit

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM "ClientProfile" cp ${whereClause}`,
      params
    )
    const total = countResult.rows[0]?.total || 0
    const totalPages = Math.ceil(total / limit)

    // Fetch page
    params.push(limit, offset)
    const dataResult = await pool.query(
      `SELECT
         cp.*,
         ${NORMALIZED_MRR_SQL} AS "normalizedMrr"
       FROM "ClientProfile" cp
       LEFT JOIN (
         SELECT
           csl."clientProfileId",
           ROUND(COALESCE(SUM(sc.mrr), 0)::numeric, 2) AS "normalizedLinkedMrr"
         FROM "ClientStripeLink" csl
         JOIN "StripeCustomer" sc
           ON sc.id = csl."stripeCustomerId"
          AND COALESCE(sc."tenantId", sc."organizationId", $1) = $1
         WHERE csl."tenantId" = $1
           AND COALESCE(sc.mrr, 0) > 0
           AND lower(COALESCE(sc.status, '')) IN ('active', 'trialing', 'past_due', 'unpaid')
         GROUP BY csl."clientProfileId"
       ) linked_mrr
         ON linked_mrr."clientProfileId" = cp.id
       ${whereClause}
       ${orderClause}
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )

    const clients = dataResult.rows.map((row) => ({
      ...row,
      mrr: row.normalizedMrr != null ? Number(row.normalizedMrr) : (row.mrr != null ? Number(row.mrr) : null),
      overdueAmount: row.overdueAmount != null ? Number(row.overdueAmount) : null,
      lifetimeValue: row.lifetimeValue != null ? Number(row.lifetimeValue) : null,
      catchUpRate: row.catchUpRate != null ? Number(row.catchUpRate) : null,
      avgMonthlyLeads: row.avgMonthlyLeads != null ? Number(row.avgMonthlyLeads) : null,
      avgMonthlyTours: row.avgMonthlyTours != null ? Number(row.avgMonthlyTours) : null,
      avgMonthlyRegistered: row.avgMonthlyRegistered != null ? Number(row.avgMonthlyRegistered) : null,
      leadToTourRate: row.leadToTourRate != null ? Number(row.leadToTourRate) : null,
      tourToRegRate: row.tourToRegRate != null ? Number(row.tourToRegRate) : null,
      healthScore: computeHealthScore(row),
    }))

    return NextResponse.json({ clients, total, page, totalPages })
  } catch (error) {
    console.error('[GET /api/clients/list]', error)
    return NextResponse.json({ error: error.message || 'Failed to load clients.' }, { status: error.status || 500 })
  }
}
