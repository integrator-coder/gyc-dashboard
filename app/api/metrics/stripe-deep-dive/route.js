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

    // 2026 annualized projection: YTD / days elapsed * 365
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

    // Monthly active/churned from StripeMetrics (available data)
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

    // ─── C. Revenue by Plan (check tags column) ──────────────────────────────
    // StripeCustomer has 'tags' — use as proxy for plan tier if populated
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

    // Quarterly breakdown by year
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
    // Peak/trough per year
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

    // Month names for peak/trough lookup
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

    // ─── Assemble Response ────────────────────────────────────────────────────
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

    // Build annual summary
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

    // Transform revenueByMonth for chart (one entry per month with all years)
    const chartData = Array.from({ length: 12 }, (_, i) => {
      const entry = { month: monthNames[i] }
      for (const year of [2023, 2024, 2025, 2026]) {
        const row = revenueByMonth.find(r => r.year === year && r.month === i + 1)
        entry[year] = row?.monthly_total || null
      }
      return entry
    })

    // Quarterly chart data
    const quarterlyData = []
    for (const year of [2023, 2024, 2025, 2026]) {
      for (let q = 1; q <= 4; q++) {
        const row = quarterlyRows.find(r => r.year === year && r.quarter === q)
        // Only include 2026 Q1 (complete) and Q2 partial
        if (year === 2026 && q > 2) continue
        quarterlyData.push({
          year,
          quarter: `Q${q}`,
          label: `${year} Q${q}`,
          revenue: row?.revenue || 0,
        })
      }
    }

    // Seasonal heatmap (avg by month across 2023-2025)
    const seasonalHeatmap = monthAvg => monthNames.map((name, i) => {
      const row = monthlyAvg.find(r => r.month === i + 1)
      return { month: name, avg: row?.avg_revenue || 0 }
    })

    // Cohort data
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

    // MRR trend from StripeMetrics
    const mrrTrend = metricsHistory.map(r => ({
      month: r.month,
      mrr: r.mrr,
      activeCustomers: r.active_customers,
      churnedCustomers: r.churned_customers,
    }))

    // LTV estimate: current MRR / active customers / churn rate
    const latestMetrics = metricsHistory[metricsHistory.length - 1]
    const avgMrr = latestMetrics?.mrr && latestMetrics?.active_customers
      ? Math.round(latestMetrics.mrr / latestMetrics.active_customers)
      : 0

    return NextResponse.json({
      revenueByMonth,
      chartData,
      annualSummary,
      annualTotals: {
        ...annualTotals,
        2026: ytd2026,
        annualized2026: annualized2026,
      },
      quarterlyData,
      seasonalHeatmap: seasonalHeatmap(monthlyAvg),
      cohortData,
      mrrTrend,
      peakTroughRows,
      tagRows,
      avgMrr,
    })
  } catch (error) {
    console.error('Stripe deep dive error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  } finally {
    client.release()
  }
}
