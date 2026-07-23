export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/auth'
import pkg from 'pg'

const { Pool } = pkg
const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

export async function GET(request) {
  try {
    const auth = await requireApiUser(['sales', 'ga', 'staff', 'cx', 'admin', 'superadmin', 'manager'])
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { searchParams } = new URL(request.url)
    const search  = (searchParams.get('search') || '').trim()
    const rep     = (searchParams.get('rep')    || '').trim()
    const pifOnly = searchParams.get('pif') === 'true'
    const from    = searchParams.get('from') || ''
    const to      = searchParams.get('to')   || ''
    const page    = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit   = 50
    const offset  = (page - 1) * limit

    // ── Build WHERE clause ─────────────────────────────────────────────────────
    const conditions = [`d."tenantId" = 'gyc'`]
    const params = []

    if (rep) {
      params.push(rep)
      conditions.push(`d."rep" = $${params.length}`)
    }
    if (pifOnly) {
      conditions.push(`d."pif" = TRUE`)
    }
    if (from) {
      params.push(from)
      conditions.push(`d."dealDate" >= $${params.length}`)
    }
    if (to) {
      params.push(to)
      conditions.push(`d."dealDate" <= $${params.length}`)
    }
    if (search) {
      params.push(`%${search.toLowerCase()}%`)
      const idx = params.length
      conditions.push(
        `(LOWER(d."clientName") LIKE $${idx}
          OR LOWER(cp."companyName") LIKE $${idx}
          OR LOWER(cp."ownerName") LIKE $${idx}
          OR LOWER(d."rep") LIKE $${idx}
          OR LOWER(d."service") LIKE $${idx})`
      )
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    // ── Main query ─────────────────────────────────────────────────────────────
    const sql = `
      WITH deal_groups AS (
        SELECT
          "clientName",
          "dealDate",
          "yearLabel",
          "month",
          "quarter",
          "rep",
          MAX("dealType")                                               AS "dealType",
          MAX("syncedAt")                                               AS "syncedAt",
          SUM("firstPayment")                                           AS "firstPayment",
          SUM("mrr")                                                    AS "mrr",
          MAX("term")                                                   AS "term",
          MAX("fullTerm")                                               AS "fullTerm",
          MAX("firstYear")                                              AS "firstYear",
          BOOL_OR("pif")                                                AS "pif",
          SUM("renewalAmount")                                          AS "renewalAmount",
          STRING_AGG(DISTINCT "service", ' · ' ORDER BY "service")     AS "services",
          COUNT(*)                                                       AS "serviceCount",
          "tenantId"
        FROM "SalesDeal"
        GROUP BY "clientName", "dealDate", "yearLabel", "month", "quarter", "rep", "tenantId"
      ),
      zoom_stats AS (
        SELECT
          acronym,
          COUNT(DISTINCT id)           AS "callCount",
          SUM("durationSecs")          AS "totalCallSecs"
        FROM "ZoomCall"
        WHERE acronym IS NOT NULL
          AND "tenantId" = 'gyc'
        GROUP BY acronym
      )
      SELECT
        d."clientName"    AS acronym,
        d."dealDate",
        d."yearLabel",
        d."month",
        d."quarter",
        d."rep",
        d."dealType",
        d."syncedAt",
        d."firstPayment",
        d."mrr",
        d."term",
        d."fullTerm",
        d."firstYear",
        d."pif",
        d."renewalAmount",
        d."services",
        d."serviceCount",
        -- Client profile
        cp."companyName",
        cp."ownerName",
        cp."directorName",
        cp."email",
        cp."phone",
        cp."city",
        cp."state",
        cp."website",
        cp."assignedGA",
        cp."assignedGAEmail",
        cp."ghlContactId",
        cp."stripeCustomerId",
        cp."notionPageId",
        cp."status"       AS "clientStatus",
        -- Zoom call stats
        COALESCE(zs."callCount", 0)    AS "callCount",
        COALESCE(zs."totalCallSecs", 0) AS "totalCallSecs",
        -- PandaDoc — most recent completed agreement for this client
        (
          SELECT pa.id
          FROM "PandaDocAgreement" pa
          WHERE (
            (cp.email IS NOT NULL AND LOWER(pa."recipientEmail") = LOWER(cp.email))
            OR LOWER(pa."recipientName") ILIKE '%' || LOWER(COALESCE(cp."ownerName", '')) || '%'
          )
            AND cp.email IS NOT NULL
          ORDER BY pa."completedAt" DESC NULLS LAST
          LIMIT 1
        ) AS "pandaDocId",
        -- ReconDraft — check by acronym stored in prospectName or companyName match
        (
          SELECT rd.id
          FROM "ReconDraft" rd
          WHERE LOWER(rd."prospectName") = LOWER(COALESCE(cp."companyName", ''))
             OR LOWER(rd."prospectName") = LOWER(d."clientName")
          ORDER BY rd."createdAt" DESC
          LIMIT 1
        ) AS "reconDraftId"
      FROM deal_groups d
      LEFT JOIN "ClientProfile" cp
        ON cp.acronym = d."clientName"
        AND cp."tenantId" = 'gyc'
      LEFT JOIN zoom_stats zs
        ON zs.acronym = d."clientName"
      ${where}
      ORDER BY
        COALESCE(d."dealDate", '1900-01-01'::date) DESC,
        d."syncedAt" DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `

    params.push(limit, offset)

    // Count query (same WHERE, no pagination)
    const countSql = `
      WITH deal_groups AS (
        SELECT
          "clientName", "dealDate", "yearLabel", "month", "quarter", "rep", "tenantId",
          BOOL_OR("pif") AS "pif",
          MAX("syncedAt") AS "syncedAt",
          STRING_AGG(DISTINCT "service", ' · ') AS "service"
        FROM "SalesDeal"
        GROUP BY "clientName", "dealDate", "yearLabel", "month", "quarter", "rep", "tenantId"
      )
      SELECT COUNT(*) AS total
      FROM deal_groups d
      LEFT JOIN "ClientProfile" cp
        ON cp.acronym = d."clientName"
        AND cp."tenantId" = 'gyc'
      ${where}
    `

    const countParams = params.slice(0, params.length - 2) // exclude LIMIT/OFFSET
    const [rowResult, countResult] = await Promise.all([
      pool.query(sql, params),
      pool.query(countSql, countParams),
    ])

    const total = parseInt(countResult.rows[0].total, 10)

    // ── Transform rows ─────────────────────────────────────────────────────────
    const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID || 'hmTIYUexYXIXgmJzbx3s'

    const deals = rowResult.rows.map(row => {
      // Calculate TCV
      const firstPayment   = parseFloat(row.firstPayment   || 0)
      const renewalAmount  = parseFloat(row.renewalAmount  || 0)
      const term           = parseFloat(row.term           || 0)
      // TCV = firstPayment + (renewalAmount × (fullTerm_months - term_months))
      // Simpler: fullTerm already represents total value if all months at MRR
      const fullTerm       = parseFloat(row.fullTerm || 0)
      const tcv            = fullTerm || (firstPayment + renewalAmount * Math.max(0, term - 1))

      // Renewal date
      let renewalDate = null
      if (row.dealDate && term) {
        const d = new Date(row.dealDate)
        d.setMonth(d.getMonth() + Math.round(term))
        renewalDate = d.toISOString().split('T')[0]
      }

      // External links
      const links = {
        acl: `/clients/${row.acronym}`,
        ghl: row.ghlContactId
          ? `https://app.gohighlevel.com/v2/location/${GHL_LOCATION_ID}/contacts/detail/${row.ghlContactId}`
          : null,
        stripe: row.stripeCustomerId
          ? `https://dashboard.stripe.com/customers/${row.stripeCustomerId}`
          : null,
        pandaDoc: row.pandaDocId ? `/agreements` : null,
        recon: row.reconDraftId ? `/team/recon` : null,
        zoom: row.callCount > 0 ? `/zoom?client=${row.acronym}` : null,
      }

      return {
        // Deal identity
        acronym:       row.acronym,
        dealDate:      row.dealDate,
        yearLabel:     row.yearLabel,
        month:         row.month,
        quarter:       row.quarter,
        rep:           row.rep,
        dealType:      row.dealType,
        syncedAt:      row.syncedAt,
        // Financials
        firstPayment,
        mrr:           parseFloat(row.mrr || 0),
        term,
        renewalAmount,
        fullTerm,
        tcv,
        pif:           Boolean(row.pif),
        renewalDate,
        // Services
        services:      row.services || '',
        serviceCount:  parseInt(row.serviceCount || 0, 10),
        // Client
        companyName:   row.companyName || row.acronym,
        ownerName:     row.ownerName   || row.directorName || null,
        email:         row.email,
        phone:         row.phone,
        city:          row.city,
        state:         row.state,
        website:       row.website,
        assignedGA:    row.assignedGA,
        assignedGAEmail: row.assignedGAEmail,
        clientStatus:  row.clientStatus,
        // Calls
        callCount:     parseInt(row.callCount || 0, 10),
        totalCallSecs: parseInt(row.totalCallSecs || 0, 10),
        // Links
        links,
        // Flags for UI
        hasRecon:      Boolean(row.reconDraftId),
        hasPandaDoc:   Boolean(row.pandaDocId),
      }
    })

    // Distinct reps for filter dropdown
    const repListSql = `
      SELECT DISTINCT rep FROM "SalesDeal"
      WHERE "tenantId" = 'gyc' AND rep IS NOT NULL AND rep != ''
      ORDER BY rep
    `
    const repListResult = await pool.query(repListSql)

    return NextResponse.json({
      deals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      reps: repListResult.rows.map(r => r.rep),
    })
  } catch (err) {
    console.error('[deals/closed]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
