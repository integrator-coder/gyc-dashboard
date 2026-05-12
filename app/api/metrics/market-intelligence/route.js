import { NextResponse } from 'next/server'
import pg from 'pg'

export const dynamic = 'force-dynamic'

function getPool() {
  const { Pool } = pg
  return new Pool({
    connectionString: process.env.DATABASE_URL || process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 3,
  })
}

/**
 * GET /api/metrics/market-intelligence
 *
 * Query params:
 *   ?zip=33414        — single ZIP lookup (for Recon integration)
 *   ?acronym=XYZ      — filter by client acronym
 *   ?limit=50         — cap results (default 200)
 *   ?sortBy=opportunityScore|childrenUnder5|medianHouseholdIncome  (default: opportunityScore)
 */
export async function GET(request) {
  const pool = getPool()
  try {
    const { searchParams } = new URL(request.url)
    const zip = searchParams.get('zip')
    const acronym = searchParams.get('acronym')
    const limit = Math.min(500, parseInt(searchParams.get('limit') || '200'))
    const sortBy = ['opportunityScore', 'childrenUnder5', 'medianHouseholdIncome', 'birthsPerCenter'].includes(searchParams.get('sortBy'))
      ? searchParams.get('sortBy')
      : 'opportunityScore'

    // ── Single ZIP lookup (Recon integration) ──────────────────────────────
    if (zip) {
      const result = await pool.query(
        `SELECT * FROM "ClientMarketIntelligence" WHERE zip = $1 ORDER BY year DESC LIMIT 1`,
        [zip.slice(0, 5)]
      )
      if (!result.rows.length) {
        return NextResponse.json({ error: 'No data for that ZIP', zip }, { status: 404 })
      }
      return NextResponse.json({ zip, data: result.rows[0] })
    }

    // ── Acronym filter ──────────────────────────────────────────────────────
    if (acronym) {
      const result = await pool.query(
        `SELECT * FROM "ClientMarketIntelligence"
         WHERE "tenantId" = 'gyc' AND acronym = $1
         ORDER BY year DESC LIMIT 10`,
        [acronym.toUpperCase()]
      )
      return NextResponse.json({ acronym, clients: result.rows })
    }

    // ── Full dataset ────────────────────────────────────────────────────────
    const [clientsResult, summaryResult, topMarketsResult, updatedAtResult] = await Promise.all([
      pool.query(`
        SELECT
          "stripeCustomerId", "companyName", acronym, zip,
          "countyName", "stateFips",
          "childrenUnder5", "children5to9", "children10to14",
          "totalPopulation", "medianHouseholdIncome",
          "workingParentsUnder6", "belowPovertyLine", "spanishSpeakingHouseholds",
          "birthsLastYear", "childcareCenterCount", "childcareEmployment",
          "opportunityScore", "birthsPerCenter", "syncedAt"
        FROM "ClientMarketIntelligence"
        WHERE "tenantId" = 'gyc' AND year = 2023
        ORDER BY "${sortBy}" DESC NULLS LAST
        LIMIT $1
      `, [limit]),

      pool.query(`
        SELECT
          COUNT(*) AS "clientsWithData",
          ROUND(AVG("opportunityScore")) AS "avgOpportunityScore",
          ROUND(AVG("childrenUnder5")) AS "avgChildrenUnder5",
          ROUND(AVG("medianHouseholdIncome")) AS "avgMedianIncome",
          ROUND(AVG("birthsLastYear")) AS "avgBirthsLastYear",
          ROUND(AVG("childcareCenterCount")) AS "avgChildcareCenters",
          MAX("opportunityScore") AS "maxOpportunityScore",
          MIN("opportunityScore") AS "minOpportunityScore"
        FROM "ClientMarketIntelligence"
        WHERE "tenantId" = 'gyc' AND year = 2023
          AND "opportunityScore" IS NOT NULL
      `),

      pool.query(`
        SELECT DISTINCT ON (zip)
          zip, "countyName", "stateFips",
          "childrenUnder5", "medianHouseholdIncome",
          "birthsLastYear", "childcareCenterCount",
          "opportunityScore", "birthsPerCenter"
        FROM "ClientMarketIntelligence"
        WHERE "tenantId" = 'gyc' AND year = 2023
          AND "opportunityScore" IS NOT NULL
        ORDER BY zip, "opportunityScore" DESC
        LIMIT 20
      `),

      pool.query(`
        SELECT MAX("syncedAt") AS "updatedAt"
        FROM "ClientMarketIntelligence"
        WHERE "tenantId" = 'gyc'
      `),
    ])

    const summary = summaryResult.rows[0] || {}
    const clients = clientsResult.rows.map(r => ({
      stripeCustomerId: r.stripeCustomerId,
      companyName: r.companyName,
      acronym: r.acronym,
      zip: r.zip,
      countyName: r.countyName,
      stateFips: r.stateFips,
      totalPopulation: r.totalPopulation,
      childrenUnder5: r.childrenUnder5,
      children5to9: r.children5to9,
      children10to14: r.children10to14,
      medianHouseholdIncome: r.medianHouseholdIncome,
      workingParentsUnder6: r.workingParentsUnder6,
      belowPovertyLine: r.belowPovertyLine,
      spanishSpeakingHouseholds: r.spanishSpeakingHouseholds,
      birthsLastYear: r.birthsLastYear,
      childcareCenterCount: r.childcareCenterCount,
      childcareEmployment: r.childcareEmployment,
      opportunityScore: r.opportunityScore,
      birthsPerCenter: r.birthsPerCenter ? parseFloat(r.birthsPerCenter) : null,
      syncedAt: r.syncedAt,
    }))

    return NextResponse.json({
      summary: {
        clientsWithData: parseInt(summary.clientsWithData) || 0,
        avgOpportunityScore: parseInt(summary.avgOpportunityScore) || null,
        avgChildrenUnder5: parseInt(summary.avgChildrenUnder5) || null,
        avgMedianIncome: parseInt(summary.avgMedianIncome) || null,
        avgBirthsLastYear: parseInt(summary.avgBirthsLastYear) || null,
        avgChildcareCenters: parseInt(summary.avgChildcareCenters) || null,
        maxOpportunityScore: parseInt(summary.maxOpportunityScore) || null,
        minOpportunityScore: parseInt(summary.minOpportunityScore) || null,
      },
      clients,
      topOpportunityMarkets: topMarketsResult.rows.map(r => ({
        zip: r.zip,
        countyName: r.countyName,
        childrenUnder5: r.childrenUnder5,
        medianHouseholdIncome: r.medianHouseholdIncome,
        birthsLastYear: r.birthsLastYear,
        childcareCenterCount: r.childcareCenterCount,
        opportunityScore: r.opportunityScore,
        birthsPerCenter: r.birthsPerCenter ? parseFloat(r.birthsPerCenter) : null,
      })),
      updatedAt: updatedAtResult.rows[0]?.updatedAt || null,
    })
  } catch (error) {
    console.error('[market-intelligence] error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  } finally {
    await pool.end()
  }
}
