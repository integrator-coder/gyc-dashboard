export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import pkg from 'pg'
const { Pool } = pkg

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

export async function GET() {
  const client = await pool.connect()
  try {
    // ─── A. Year-over-Year Revenue ───────────────────────────────────────────
    const { rows: revenueByMonth } = await client.query(`
      SELECT 
        date_part('year', date::timestamp)::int  AS year,
        date_part('month', date::timestamp)::int AS month,
        ROUND(SUM(amount)::numeric, 0)::float AS monthly_total
      FROM "DailyRevenue"
      WHERE date >= '2023-01-01'
      GROUP BY 1, 2
      ORDER BY 1, 2
    `)

    // Annual totals
    const { rows: annualRows } = await client.query(`
      SELECT 
        date_part('year', date::timestamp)::int AS year,
        ROUND(SUM(amount)::numeric, 0)::float AS total
      FROM "DailyRevenue"
      WHERE date >= '2023-01-01'
      GROUP BY 1 ORDER BY 1
    `)
    const annualTotals = {}
    for (const r of annualRows) annualTotals[r.year] = r.total

    // 2026 annualized projection
    const { rows: ytdRow } = await client.query(`
      SELECT 
        ROUND(SUM(amount)::numeric, 0)::float AS ytd,
        COUNT(DISTINCT date::date) AS days_with_data
      FROM "DailyRevenue"
      WHERE date >= '2026-01-01'
    `)
    const ytd2026 = ytdRow[0]?.ytd || 0
    const dayOfYear2026 = Math.floor(
      (new Date() - new Date('2026-01-01')) / (1000 * 60 * 60 * 24)
    ) + 1
    const annualized2026 = Math.round((ytd2026 / dayOfYear2026) * 365)

    // ─── B. Customer Cohort Analysis ─────────────────────────────────────────
    const { rows: cohortRows } = await client.query(`
      SELECT 
        date_part('year', "createdAt"::timestamp)::int AS year,
        COUNT(*)::int AS acquired,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END)::int AS still_active,
        SUM(CASE WHEN status = 'past_due' THEN 1 ELSE 0 END)::int AS past_due,
        SUM(CASE WHEN status NOT IN ('active','past_due') THEN 1 ELSE 0 END)::int AS churned
      FROM "StripeCustomer"
      GROUP BY 1
      ORDER BY 1
    `)

    // ─── C. Revenue by Plan tags ──────────────────────────────────────────────
    const { rows: tagRows } = await client.query(`
      SELECT tags, COUNT(*)::int AS cnt, ROUND(SUM(mrr)::numeric, 0)::float AS total_mrr
      FROM "StripeCustomer"
      WHERE tags IS NOT NULL AND tags != '{}'
      GROUP BY tags
      ORDER BY total_mrr DESC
      LIMIT 20
    `)

    // ─── D. Seasonal Trends ───────────────────────────────────────────────────
    const { rows: monthlyAvg } = await client.query(`
      SELECT 
        sub.month,
        ROUND(AVG(sub.monthly_total)::numeric, 0)::float AS avg_revenue
      FROM (
        SELECT 
          date_part('year', dr.date::timestamp)::int AS year,
          date_part('month', dr.date::timestamp)::int AS month,
          SUM(amount) AS monthly_total
        FROM "DailyRevenue" dr
        WHERE dr.date >= '2023-01-01' AND dr.date < '2026-01-01'
        GROUP BY 1, 2
      ) sub
      GROUP BY 1
      ORDER BY 1
    `)

    // Quarterly breakdown
    const { rows: quarterlyRows } = await client.query(`
      SELECT 
        date_part('year', date::timestamp)::int AS year,
        CEIL(date_part('month', date::timestamp) / 3.0)::int AS quarter,
        ROUND(SUM(amount)::numeric, 0)::float AS revenue
      FROM "DailyRevenue"
      WHERE date >= '2023-01-01'
      GROUP BY 1, 2
      ORDER BY 1, 2
    `)

    // ─── E. Key Metrics Summary ───────────────────────────────────────────────
    const { rows: peakTroughRows } = await client.query(`
      SELECT 
        year,
        MAX(monthly_total) AS peak,
        MIN(monthly_total) AS trough,
        ROUND(AVG(monthly_total)::numeric, 0)::float AS avg_monthly
      FROM (
        SELECT 
          date_part('year', date::timestamp)::int AS year,
          date_part('month', date::timestamp)::int AS month,
          SUM(amount) AS monthly_total
        FROM "DailyRevenue"
        WHERE date >= '2023-01-01'
        GROUP BY 1, 2
      ) sub
      GROUP BY year
      ORDER BY year
    `)

    const { rows: peakMonthRows } = await client.query(`
      WITH monthly AS (
        SELECT 
          date_part('year', date::timestamp)::int AS year,
          date_part('month', date::timestamp)::int AS month,
          SUM(amount) AS monthly_total
        FROM "DailyRevenue"
        WHERE date >= '2023-01-01'
        GROUP BY 1, 2
      ),
      ranked AS (
        SELECT *, 
          RANK() OVER (PARTITION BY year ORDER BY monthly_total DESC) AS peak_rank,
          RANK() OVER (PARTITION BY year ORDER BY monthly_total ASC) AS trough_rank
        FROM monthly
      )
      SELECT year, month, ROUND(monthly_total::numeric, 0)::float AS monthly_total, peak_rank, trough_rank
      FROM ranked
      WHERE peak_rank = 1 OR trough_rank = 1
      ORDER BY year, peak_rank
    `)

    // ─── F. MRR History (from MRRHistory table) ───────────────────────────────
    let mrrTrend = []
    try {
      const { rows: mrrHistoryRows } = await client.query(`
        SELECT 
          "month",
          "mrr"::float,
          "newMrr"::float,
          "churnedMrr"::float,
          "activeSubscriptions"
        FROM "MRRHistory"
        WHERE "tenantId" = 'gyc' AND "mrr" > 0
        ORDER BY "month"
      `)

      if (mrrHistoryRows.length > 0) {
        mrrTrend = mrrHistoryRows.map(r => ({
          month: r.month,
          mrr: r.mrr,
          newMrr: r.newmrr,
          churnedMrr: r.churnedmrr,
          activeSubscriptions: r.activesubscriptions,
        }))
      } else {
        // Fallback to StripeMetrics
        const { rows: metricsHistory } = await client.query(`
          SELECT 
            to_char("syncedAt", 'YYYY-MM') AS month,
            MAX("activeCustomers")::int AS active_customers,
            MAX("churnedCustomers")::int AS churned_customers,
            MAX(mrr)::float AS mrr
          FROM "StripeMetrics"
          WHERE "tenantId" = 'gyc'
          GROUP BY 1
          ORDER BY 1
        `)
        mrrTrend = metricsHistory.map(r => ({
          month: r.month,
          mrr: r.mrr,
          activeCustomers: r.active_customers,
          churnedCustomers: r.churned_customers,
        }))
      }
    } catch (e) {
      console.error('MRRHistory query error:', e.message)
      // Fallback silently
    }

    // ─── G. Program Churn Analysis ────────────────────────────────────────────
    let programChurn = []
    try {
      const { rows } = await client.query(`
        SELECT 
          "productCategory",
          date_part('year', "startDate"::timestamp)::int AS start_year,
          COUNT(*) AS total_started,
          SUM(CASE WHEN "canceledAt" IS NOT NULL THEN 1 ELSE 0 END) AS total_canceled,
          ROUND(100.0 * SUM(CASE WHEN "canceledAt" IS NOT NULL THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) AS churn_rate
        FROM "StripeSubscriptionHistory"
        WHERE "tenantId" = 'gyc' AND "productCategory" NOT IN ('other', 'legacy', 'fee')
        GROUP BY 1, 2
        ORDER BY 1, 2
      `)
      programChurn = rows.map(r => ({
        category: r.productcategory,
        year: r.start_year,
        totalStarted: parseInt(r.total_started),
        totalCanceled: parseInt(r.total_canceled),
        churnRate: parseFloat(r.churn_rate) || 0,
      }))
    } catch (e) {
      console.error('programChurn query error:', e.message)
    }

    // ─── H. Revenue by Program per Year ──────────────────────────────────────
    let revenueByProgram = []
    try {
      const { rows } = await client.query(`
        SELECT 
          "productCategory",
          date_part('year', "startDate"::timestamp)::int AS year,
          COUNT(DISTINCT "customerId") AS clients,
          ROUND(SUM(
            CASE WHEN "interval" = 'year' THEN "amount" / 12.0 ELSE "amount" END
          )::numeric, 2)::float AS mrr_contribution
        FROM "StripeSubscriptionHistory"
        WHERE "tenantId" = 'gyc' 
          AND "productCategory" NOT IN ('other', 'legacy', 'fee')
          AND "amount" > 0
        GROUP BY 1, 2
        ORDER BY 2, mrr_contribution DESC
      `)
      revenueByProgram = rows.map(r => ({
        category: r.productcategory,
        year: r.year,
        clients: parseInt(r.clients),
        mrrContribution: parseFloat(r.mrr_contribution) || 0,
      }))
    } catch (e) {
      console.error('revenueByProgram query error:', e.message)
    }

    // ─── I. Program Retention at 3/6/12/24 months ────────────────────────────
    let programRetention = []
    try {
      const { rows } = await client.query(`
        WITH cohort AS (
          SELECT 
            "productCategory",
            "id",
            "startDate",
            "canceledAt",
            EXTRACT(EPOCH FROM (COALESCE("canceledAt", NOW()) - "startDate")) / (30.44 * 24 * 3600) AS tenure_months
          FROM "StripeSubscriptionHistory"
          WHERE "tenantId" = 'gyc'
            AND "productCategory" NOT IN ('other', 'legacy', 'fee')
            AND "startDate" IS NOT NULL
            AND "amount" > 0
        )
        SELECT
          "productCategory",
          COUNT(*) AS total,
          SUM(CASE WHEN tenure_months >= 3 THEN 1 ELSE 0 END) AS retained_3m,
          SUM(CASE WHEN tenure_months >= 6 THEN 1 ELSE 0 END) AS retained_6m,
          SUM(CASE WHEN tenure_months >= 12 THEN 1 ELSE 0 END) AS retained_12m,
          SUM(CASE WHEN tenure_months >= 24 THEN 1 ELSE 0 END) AS retained_24m,
          ROUND(AVG(CASE WHEN "canceledAt" IS NOT NULL THEN tenure_months END)::numeric, 1) AS avg_tenure_churned
        FROM cohort
        GROUP BY 1
        ORDER BY 1
      `)
      programRetention = rows.map(r => ({
        category: r.productcategory,
        total: parseInt(r.total),
        pct3m: r.total > 0 ? Math.round(100 * r.retained_3m / r.total) : 0,
        pct6m: r.total > 0 ? Math.round(100 * r.retained_6m / r.total) : 0,
        pct12m: r.total > 0 ? Math.round(100 * r.retained_12m / r.total) : 0,
        pct24m: r.total > 0 ? Math.round(100 * r.retained_24m / r.total) : 0,
        avgTenureChurned: parseFloat(r.avg_tenure_churned) || null,
      }))
    } catch (e) {
      console.error('programRetention query error:', e.message)
    }

    // ─── J. Client Program Mix ────────────────────────────────────────────────
    let clientProgramMix = []
    try {
      const { rows } = await client.query(`
        WITH active_client_programs AS (
          SELECT 
            "customerId",
            COUNT(DISTINCT "productCategory") AS program_count
          FROM "StripeSubscriptionHistory"
          WHERE "tenantId" = 'gyc'
            AND "status" = 'active'
            AND "productCategory" NOT IN ('other', 'legacy', 'fee')
          GROUP BY "customerId"
        )
        SELECT 
          CASE 
            WHEN program_count = 1 THEN '1 program'
            WHEN program_count = 2 THEN '2 programs'
            WHEN program_count = 3 THEN '3 programs'
            ELSE '4+ programs'
          END AS label,
          program_count,
          COUNT(*) AS client_count
        FROM active_client_programs
        GROUP BY 1, 2
        ORDER BY 2
      `)
      clientProgramMix = rows.map(r => ({
        label: r.label,
        programCount: parseInt(r.program_count),
        clientCount: parseInt(r.client_count),
      }))
    } catch (e) {
      console.error('clientProgramMix query error:', e.message)
    }

    // ─── K. Avg Client Tenure + Seasonal Acquisition ─────────────────────────
    let avgClientTenure = null
    let seasonalAcquisition = []
    try {
      const { rows: tenureRow } = await client.query(`
        SELECT 
          ROUND(AVG(
            EXTRACT(EPOCH FROM ("canceledAt" - "startDate")) / (30.44 * 24 * 3600)
          )::numeric, 1) AS avg_tenure_months
        FROM "StripeSubscriptionHistory"
        WHERE "tenantId" = 'gyc'
          AND "canceledAt" IS NOT NULL
          AND "startDate" IS NOT NULL
          AND "productCategory" NOT IN ('other', 'fee')
      `)
      avgClientTenure = parseFloat(tenureRow[0]?.avg_tenure_months) || null

      const { rows: seasonRows } = await client.query(`
        SELECT 
          date_part('month', "startDate"::timestamp)::int AS month_num,
          to_char("startDate"::timestamp, 'Mon') AS month_name,
          COUNT(*) AS new_subs
        FROM "StripeSubscriptionHistory"
        WHERE "tenantId" = 'gyc'
          AND "startDate" IS NOT NULL
          AND "productCategory" NOT IN ('other', 'fee')
        GROUP BY 1, 2
        ORDER BY 1
      `)
      seasonalAcquisition = seasonRows.map(r => ({
        month: r.month_name,
        monthNum: parseInt(r.month_num),
        newSubs: parseInt(r.new_subs),
      }))
    } catch (e) {
      console.error('tenure/seasonal query error:', e.message)
    }

    // ─── L. Revenue Concentration (top 20% of clients) ───────────────────────
    let revenueConcentration = null
    try {
      const { rows: concRows } = await client.query(`
        WITH client_mrr AS (
          SELECT 
            "customerId",
            SUM(CASE WHEN "interval" = 'year' THEN "amount" / 12.0 ELSE "amount" END) AS monthly_value
          FROM "StripeSubscriptionHistory"
          WHERE "tenantId" = 'gyc' AND "status" = 'active' AND "amount" > 0
          GROUP BY "customerId"
          ORDER BY monthly_value DESC
        ),
        ranked AS (
          SELECT *, 
            ROW_NUMBER() OVER (ORDER BY monthly_value DESC) AS rank,
            COUNT(*) OVER () AS total_clients,
            SUM(monthly_value) OVER () AS total_mrr
          FROM client_mrr
        )
        SELECT 
          ROUND(100.0 * SUM(CASE WHEN rank <= CEIL(total_clients * 0.2) THEN monthly_value ELSE 0 END) / NULLIF(total_mrr, 0), 1) AS top20_pct,
          COUNT(*) AS total_clients,
          ROUND(SUM(monthly_value)::numeric, 0)::float AS total_mrr
        FROM ranked
      `)
      if (concRows[0]) {
        revenueConcentration = {
          top20Pct: parseFloat(concRows[0].top20_pct) || 0,
          totalClients: parseInt(concRows[0].total_clients),
          totalMrr: parseFloat(concRows[0].total_mrr) || 0,
        }
      }
    } catch (e) {
      console.error('revenueConcentration query error:', e.message)
    }

    // ─── M. Upsell Velocity ─────────────────────────────────────────────────
    let upsellVelocity = []
    try {
      const { rows: uvRows } = await client.query(`
        SELECT 
          s2."productCategory" AS added_program,
          ROUND(AVG(EXTRACT(EPOCH FROM (s2."startDate" - s1.first_start)) / 86400)::numeric, 0)::int AS avg_days_to_upsell,
          COUNT(*) AS count
        FROM "StripeSubscriptionHistory" s2
        JOIN (
          SELECT "customerId", MIN("startDate") AS first_start
          FROM "StripeSubscriptionHistory"
          WHERE "tenantId" = 'gyc'
          GROUP BY "customerId"
        ) s1 ON s2."customerId" = s1."customerId"
        WHERE s2."tenantId" = 'gyc'
          AND s2."startDate" > s1.first_start
          AND s2."productCategory" NOT IN ('other', 'legacy')
        GROUP BY 1
        HAVING COUNT(*) >= 3
        ORDER BY 2 ASC
      `)
      upsellVelocity = uvRows.map(r => ({
        program: r.added_program,
        avgDays: parseInt(r.avg_days_to_upsell),
        count: parseInt(r.count),
      }))
    } catch (e) {
      console.error('upsellVelocity query error:', e.message)
    }

    // ─── N. Churn Sequence Analysis ───────────────────────────────────────────
    let churnSequence = { firstToGo: [], lastToGo: [] }
    try {
      const { rows: lastRows } = await client.query(`
        SELECT 
          last_cancel."productCategory" AS last_to_go,
          COUNT(*) AS count
        FROM (
          SELECT 
            "customerId",
            "productCategory",
            "canceledAt",
            ROW_NUMBER() OVER (PARTITION BY "customerId" ORDER BY "canceledAt" DESC) AS rn
          FROM "StripeSubscriptionHistory"
          WHERE "tenantId" = 'gyc' AND "canceledAt" IS NOT NULL
            AND "productCategory" NOT IN ('other', 'legacy')
        ) last_cancel
        WHERE rn = 1
        GROUP BY 1
        ORDER BY 2 DESC
      `)
      const { rows: firstRows } = await client.query(`
        SELECT 
          first_cancel."productCategory" AS first_to_go,
          COUNT(*) AS count
        FROM (
          SELECT 
            "customerId",
            "productCategory",
            "canceledAt",
            ROW_NUMBER() OVER (PARTITION BY "customerId" ORDER BY "canceledAt" ASC) AS rn
          FROM "StripeSubscriptionHistory"
          WHERE "tenantId" = 'gyc' AND "canceledAt" IS NOT NULL
            AND "productCategory" NOT IN ('other', 'legacy')
        ) first_cancel
        WHERE rn = 1
        GROUP BY 1
        ORDER BY 2 DESC
      `)
      churnSequence = {
        lastToGo: lastRows.map(r => ({ program: r.last_to_go, count: parseInt(r.count) })),
        firstToGo: firstRows.map(r => ({ program: r.first_to_go, count: parseInt(r.count) })),
      }
    } catch (e) {
      console.error('churnSequence query error:', e.message)
    }

    // ─── O. Program Bundle Retention ─────────────────────────────────────────
    let bundleRetention = []
    try {
      const { rows: brRows } = await client.query(`
        SELECT 
          bundle,
          COUNT(*) AS clients,
          SUM(CASE WHEN all_active THEN 1 ELSE 0 END) AS still_active,
          ROUND(100.0 * SUM(CASE WHEN all_active THEN 1 ELSE 0 END) / COUNT(*), 0) AS retention_pct
        FROM (
          SELECT 
            "customerId",
            STRING_AGG(DISTINCT "productCategory", ',' ORDER BY "productCategory") AS bundle,
            BOOL_AND("canceledAt" IS NULL) AS all_active
          FROM "StripeSubscriptionHistory"
          WHERE "tenantId" = 'gyc' AND "productCategory" NOT IN ('other', 'legacy')
          GROUP BY "customerId"
        ) bundles
        GROUP BY bundle
        HAVING COUNT(*) >= 2
        ORDER BY clients DESC
        LIMIT 15
      `)
      bundleRetention = brRows.map(r => ({
        bundle: r.bundle,
        clients: parseInt(r.clients),
        stillActive: parseInt(r.still_active),
        retentionPct: parseInt(r.retention_pct),
      }))
    } catch (e) {
      console.error('bundleRetention query error:', e.message)
    }

    // ─── P. Cohort LTV Analysis ───────────────────────────────────────────────
    let cohortLtv = []
    try {
      const { rows: ltvRows } = await client.query(`
        SELECT 
          date_part('year', cohort_start)::int AS cohort_year,
          COUNT(DISTINCT "customerId") AS clients,
          ROUND(SUM(monthly_amount * months_active)::numeric, 0)::float AS estimated_ltv,
          ROUND((SUM(monthly_amount * months_active) / COUNT(DISTINCT "customerId"))::numeric, 0)::float AS avg_ltv_per_client
        FROM (
          SELECT 
            "customerId",
            MIN("startDate") OVER (PARTITION BY "customerId") AS cohort_start,
            amount AS monthly_amount,
            GREATEST(
              EXTRACT(EPOCH FROM (COALESCE("canceledAt", NOW()) - "startDate")) / (30.44 * 86400),
              0
            ) AS months_active
          FROM "StripeSubscriptionHistory"
          WHERE "tenantId" = 'gyc'
        ) sub
        WHERE cohort_start >= '2023-01-01'
        GROUP BY 1
        ORDER BY 1
      `)
      cohortLtv = ltvRows.map(r => ({
        year: parseInt(r.cohort_year),
        clients: parseInt(r.clients),
        estimatedLtv: parseFloat(r.estimated_ltv) || 0,
        avgLtvPerClient: parseFloat(r.avg_ltv_per_client) || 0,
      }))
    } catch (e) {
      console.error('cohortLtv query error:', e.message)
    }

    // ─── Assemble Response ────────────────────────────────────────────────────
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

    const annualSummary = []
    const years = [2023, 2024, 2025, 2026]
    for (const year of years) {
      const pt = peakTroughRows.find(r => r.year === year)
      const peak = peakMonthRows.find(r => r.year === year && r.peak_rank === 1)
      const trough = peakMonthRows.find(r => r.year === year && r.trough_rank === 1)
      const prevYear = annualTotals[year - 1]
      const currYear = year === 2026 ? annualized2026 : annualTotals[year]
      const yoyGrowth = prevYear && currYear
        ? Math.round(((currYear - prevYear) / prevYear) * 100 * 10) / 10
        : null
      annualSummary.push({
        year,
        total: year === 2026 ? ytd2026 : (annualTotals[year] || 0),
        annualized: year === 2026 ? annualized2026 : (annualTotals[year] || 0),
        ytdFlag: year === 2026,
        yoyGrowth,
        avgMonthly: pt?.avg_monthly || 0,
        peakMonth: peak ? monthNames[peak.month - 1] : null,
        peakAmount: peak?.monthly_total || 0,
        troughMonth: trough ? monthNames[trough.month - 1] : null,
        troughAmount: trough?.monthly_total || 0,
      })
    }

    const chartData = Array.from({ length: 12 }, (_, i) => {
      const entry = { month: monthNames[i] }
      for (const year of [2023, 2024, 2025, 2026]) {
        const row = revenueByMonth.find(r => r.year === year && r.month === i + 1)
        entry[year] = row?.monthly_total || null
      }
      return entry
    })

    const quarterlyData = []
    for (const year of [2023, 2024, 2025, 2026]) {
      for (let q = 1; q <= 4; q++) {
        const row = quarterlyRows.find(r => r.year === year && r.quarter === q)
        if (year === 2026 && q > 2) continue
        quarterlyData.push({
          year,
          quarter: `Q${q}`,
          label: `${year} Q${q}`,
          revenue: row?.revenue || 0,
        })
      }
    }

    const seasonalHeatmap = monthNames.map((name, i) => {
      const row = monthlyAvg.find(r => r.month === i + 1)
      return { month: name, avg: row?.avg_revenue || 0 }
    })

    const cohortData = cohortRows.map(r => ({
      year: r.year,
      acquired: r.acquired,
      stillActive: r.still_active,
      pastDue: r.past_due,
      churned: r.churned,
      retentionPct: r.acquired > 0
        ? Math.round(((r.still_active + r.past_due) / r.acquired) * 100)
        : 0,
    }))

    const latestMrr = mrrTrend[mrrTrend.length - 1]
    const avgMrr = latestMrr?.mrr && latestMrr?.activeSubscriptions
      ? Math.round(latestMrr.mrr / latestMrr.activeSubscriptions)
      : 0

    return NextResponse.json({
      revenueByMonth,
      chartData,
      annualSummary,
      annualTotals: {
        ...annualTotals,
        2026: ytd2026,
        annualized2026,
      },
      quarterlyData,
      seasonalHeatmap,
      cohortData,
      mrrTrend,
      peakTroughRows,
      tagRows,
      avgMrr,
      // New subscription-level data
      programChurn,
      revenueByProgram,
      programRetention,
      clientProgramMix,
      avgClientTenure,
      seasonalAcquisition,
      revenueConcentration,
      // Advanced intelligence sections
      upsellVelocity,
      churnSequence,
      bundleRetention,
      cohortLtv,
    })
  } catch (error) {
    console.error('Stripe deep dive error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  } finally {
    client.release()
  }
}
