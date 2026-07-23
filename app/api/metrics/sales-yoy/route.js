import { NextResponse } from 'next/server'
import pkg from 'pg'

export const dynamic = 'force-dynamic'

const { Pool } = pkg
const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export async function GET() {
  try {
    // ── Monthly breakdown from SalesDeal (deals + MRR, 2025–present) ─────
    const { rows: dealRows } = await pool.query(`
      SELECT
        "yearLabel" AS year,
        date_part('month', "dealDate"::timestamp)::int AS month_num,
        COUNT(*) AS deal_count,
        SUM("firstPayment") AS cash_collected,
        SUM(CASE WHEN pif = false THEN mrr ELSE 0 END) AS new_mrr,
        SUM(CASE WHEN pif = true THEN "firstPayment" ELSE 0 END) AS pif_cash
      FROM "SalesDeal"
      WHERE "tenantId" = 'gyc'
        AND "dealDate" IS NOT NULL
      GROUP BY "yearLabel", date_part('month', "dealDate"::timestamp)::int
      ORDER BY "yearLabel", month_num
    `)

    // ── Monthly cash from DailyRevenue (all years incl. 2024) ────────────
    // Note: date column is stored as text (YYYY-MM-DD)
    const { rows: revenueRows } = await pool.query(`
      SELECT
        LEFT(date, 4) AS year,
        CAST(SPLIT_PART(date, '-', 2) AS int) AS month_num,
        SUM(amount) AS revenue
      FROM "DailyRevenue"
      WHERE date >= '2024-01-01'
      GROUP BY LEFT(date, 4), SPLIT_PART(date, '-', 2)
      ORDER BY year, month_num
    `)

    // Build revenue lookup: year -> month_num -> revenue
    const revenueByYear = {}
    for (const row of revenueRows) {
      const y = String(row.year)
      const m = Number(row.month_num)
      if (!revenueByYear[y]) revenueByYear[y] = {}
      revenueByYear[y][m] = Number(row.revenue || 0)
    }

    // Distinct sorted years from SalesDeal
    const dealYears = [...new Set(dealRows.map((r) => r.year))].sort()

    // All years combining DailyRevenue and SalesDeal
    const revenueYears = Object.keys(revenueByYear).sort()
    const allYears = [...new Set([...revenueYears, ...dealYears])].sort()

    // Build deal lookup: year -> month_num -> data
    const byYear = {}
    for (const row of dealRows) {
      if (!byYear[row.year]) byYear[row.year] = {}
      byYear[row.year][Number(row.month_num)] = {
        deals: Number(row.deal_count),
        cash: Number(row.cash_collected || 0),
        mrr: Number(row.new_mrr || 0),
        pifCash: Number(row.pif_cash || 0),
      }
    }

    // Build 12-month array with a key per year for each metric
    const monthly = MONTH_LABELS.map((label, i) => {
      const monthNum = i + 1
      const entry = { month: label, month_num: monthNum }

      for (const year of allYears) {
        // Deal metrics (from SalesDeal — 2025+ only)
        const d = byYear[year]?.[monthNum]
        entry[`deals_${year}`] = d !== undefined ? d.deals : null
        entry[`mrr_${year}`] = d !== undefined ? d.mrr : null

        // Cash from SalesDeal (first payments at signing)
        entry[`salesCash_${year}`] = d !== undefined ? d.cash : null

        // Cash from DailyRevenue (total cash collected — includes 2024)
        const rev = revenueByYear[year]?.[monthNum]
        entry[`revenue_${year}`] = rev !== undefined ? rev : null
      }

      return entry
    })

    // YoY % change: latest vs previous year (using revenue for cash comparison)
    const sortedYears = [...allYears].sort()
    const latestYear = sortedYears[sortedYears.length - 1]
    const prevYear = sortedYears.length > 1 ? sortedYears[sortedYears.length - 2] : null

    const yoyChanges = {}
    if (prevYear) {
      for (let m = 1; m <= 12; m++) {
        const latestDeals = byYear[latestYear]?.[m]
        const prevDeals = byYear[prevYear]?.[m]
        const latestRev = revenueByYear[latestYear]?.[m]
        const prevRev = revenueByYear[prevYear]?.[m]

        const dealsChange = latestDeals && prevDeals && prevDeals.deals > 0
          ? ((latestDeals.deals - prevDeals.deals) / prevDeals.deals * 100).toFixed(1)
          : null
        const cashChange = latestRev !== undefined && prevRev !== undefined && prevRev > 0
          ? ((latestRev - prevRev) / prevRev * 100).toFixed(1)
          : null

        if (dealsChange !== null || cashChange !== null) {
          yoyChanges[m] = { deals: dealsChange, cash: cashChange }
        }
      }
    }

    // ── YTD Summary (through today's calendar date, both years) ──────────
    const { rows: revenueYtdRows } = await pool.query(`
      SELECT
        LEFT(date, 4) AS year,
        SUM(amount) AS revenue
      FROM "DailyRevenue"
      WHERE
        LEFT(date, 4) IN (
          CAST(EXTRACT(year FROM CURRENT_DATE)::int AS text),
          CAST((EXTRACT(year FROM CURRENT_DATE)::int - 1) AS text)
        )
        AND (
          CAST(SPLIT_PART(date, '-', 2) AS int) * 100 + CAST(SPLIT_PART(date, '-', 3) AS int)
        ) <= (
          CAST(EXTRACT(month FROM CURRENT_DATE)::int AS int) * 100 +
          CAST(EXTRACT(day FROM CURRENT_DATE)::int AS int)
        )
      GROUP BY LEFT(date, 4)
      ORDER BY year
    `)

    // Deal metrics from SalesDeal table (YTD same period)
    const { rows: dealYtdRows } = await pool.query(`
      SELECT
        EXTRACT(year FROM "dealDate"::timestamp)::int AS year,
        COUNT(*) AS deal_count,
        COALESCE(SUM("firstPayment"), 0) AS first_payment,
        COALESCE(SUM(CASE WHEN pif = false THEN mrr ELSE 0 END), 0) AS new_mrr
      FROM "SalesDeal"
      WHERE
        "tenantId" = 'gyc'
        AND "dealDate" IS NOT NULL
        AND EXTRACT(year FROM "dealDate"::timestamp) IN (
          EXTRACT(year FROM CURRENT_DATE)::int,
          EXTRACT(year FROM CURRENT_DATE)::int - 1
        )
        AND (
          EXTRACT(month FROM "dealDate"::timestamp) * 100 + EXTRACT(day FROM "dealDate"::timestamp)
        ) <= (
          EXTRACT(month FROM CURRENT_DATE) * 100 + EXTRACT(day FROM CURRENT_DATE)
        )
      GROUP BY year
      ORDER BY year
    `)

    // Assemble ytdSummary keyed by year
    const ytdRevByYear = {}
    for (const r of revenueYtdRows) {
      ytdRevByYear[String(r.year)] = Number(r.revenue || 0)
    }

    const ytdDealsByYear = {}
    for (const r of dealYtdRows) {
      ytdDealsByYear[r.year] = {
        deals: Number(r.deal_count || 0),
        firstPayment: Number(r.first_payment || 0),
        mrr: Number(r.new_mrr || 0),
      }
    }

    const currentYear = new Date().getFullYear()
    const priorYear = currentYear - 1

    const ytdSummary = {
      currentYear,
      priorYear,
      revenue: {
        current: ytdRevByYear[String(currentYear)] || 0,
        prior: ytdRevByYear[String(priorYear)] || 0,
      },
      deals: {
        current: ytdDealsByYear[currentYear]?.deals || 0,
        prior: ytdDealsByYear[priorYear]?.deals || 0,
      },
      cashAtSigning: {
        current: ytdDealsByYear[currentYear]?.firstPayment || 0,
        prior: ytdDealsByYear[priorYear]?.firstPayment || 0,
      },
      mrr: {
        current: ytdDealsByYear[currentYear]?.mrr || 0,
        prior: ytdDealsByYear[priorYear]?.mrr || 0,
      },
    }

    // Compute YOY % changes
    function pct(cur, prior) {
      if (!prior) return null
      return ((cur - prior) / prior * 100).toFixed(1)
    }

    ytdSummary.revenue.pctChange = pct(ytdSummary.revenue.current, ytdSummary.revenue.prior)
    ytdSummary.deals.pctChange = pct(ytdSummary.deals.current, ytdSummary.deals.prior)
    ytdSummary.cashAtSigning.pctChange = pct(ytdSummary.cashAtSigning.current, ytdSummary.cashAtSigning.prior)
    ytdSummary.mrr.pctChange = pct(ytdSummary.mrr.current, ytdSummary.mrr.prior)

    return NextResponse.json({
      years: allYears,
      monthly,
      yoyChanges,
      latestYear,
      prevYear,
      ytdSummary,
    })
  } catch (err) {
    console.error('[sales-yoy] error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
