export const dynamic = 'force-dynamic'

/**
 * GET /api/clients/profile
 *
 * Returns paginated ClientProfile records.
 *
 * Query params:
 *   ?ga=Sebastian          filter by assignedGA (case-insensitive)
 *   ?status=active         filter by status (active | onboarding | paused | cancelled)
 *   ?overdue=true          only overdue clients
 *   ?search=abc            fuzzy search on acronym or companyName
 *   ?page=1                page number (default 1)
 *   ?limit=50              per-page (max 200, default 50)
 *   ?sort=mrr_desc         sort: mrr_desc | mrr_asc | name_asc | name_desc | ga_asc
 */

import { NextResponse } from 'next/server'
import { pool } from '@/lib/pg'

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)

    const ga        = searchParams.get('ga')        || null
    const status    = searchParams.get('status')    || null
    const overdue   = searchParams.get('overdue')   === 'true'
    const search    = searchParams.get('search')    || null
    const page      = Math.max(1, parseInt(searchParams.get('page')  || '1',   10))
    const rawLimit  = parseInt(searchParams.get('limit') || '50', 10)
    const limit     = Math.min(200, Math.max(1, rawLimit))
    const offset    = (page - 1) * limit
    const sort      = searchParams.get('sort') || 'name_asc'

    const conditions = [`"tenantId" = 'gyc'`]
    const values = []

    if (ga) {
      values.push(ga)
      conditions.push(`LOWER("assignedGA") = LOWER($${values.length})`)
    }
    if (status) {
      values.push(status)
      conditions.push(`"status" = $${values.length}`)
    }
    if (overdue) {
      conditions.push(`"isOverdue" = TRUE`)
    }
    if (search) {
      values.push(`%${search.toLowerCase()}%`)
      conditions.push(`(LOWER("companyName") LIKE $${values.length} OR LOWER("acronym") LIKE $${values.length})`)
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''

    const orderMap = {
      mrr_desc:  '"mrr" DESC NULLS LAST, "companyName" ASC',
      mrr_asc:   '"mrr" ASC NULLS LAST, "companyName" ASC',
      name_asc:  '"companyName" ASC',
      name_desc: '"companyName" DESC',
      ga_asc:    '"assignedGA" ASC NULLS LAST, "companyName" ASC',
    }
    const orderBy = orderMap[sort] || orderMap.name_asc

    // Total count
    const countRes = await pool.query(
      `SELECT COUNT(*) AS total FROM "ClientProfile" ${where}`,
      values
    )
    const total = parseInt(countRes.rows[0].total, 10)

    // Data query
    values.push(limit, offset)
    const dataRes = await pool.query(
      `SELECT
        id, "acronym", "companyName", "ownerName", "email", "phone",
        "locationCount", "status", "assignedGA", "crmType",
        "hasWebsite", "hasSEO", "hasCRM", "hasGoogleAds", "hasBlueprint", "hasPaidMedia", "hasCommand",
        "serviceList",
        "mrr", "stripeCustomerId", "stripeStatus", "isOverdue", "overdueAmount",
        "overdueCount", "lastOverdueDate",
        "ghlContactId", "ghlPipelineStage",
        "startDate", "cancelledDate",
        "lastEnrichedAt", "updatedAt"
       FROM "ClientProfile"
       ${where}
       ORDER BY ${orderBy}
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    )

    return NextResponse.json({
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      clients: dataRes.rows,
    })
  } catch (err) {
    console.error('[GET /api/clients/profile] error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
