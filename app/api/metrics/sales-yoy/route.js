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
    // ── Monthly breakdown from SalesDeal ──────────────────────────────────
    const { rows } = await pool.query(`
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

    // Distinct sorted years
    const years = [...new Set(rows.map((r) => r.year))].sort()

    // Build lookup: year -> month_num (1-12) -> data
    const byYear = {}
    for (const row of rows) {
      if (!byYear[row.year]) byYear[row.year] = {}
      byYear[row.year][Number(row.month_num)] = {
        deals: Number(row.deal_count),
        cash: Number(row.cash_collected || 0),
        mrr: Number(row.new_mrr || 0),
        pifCash: Number(row.pif_cash || 0),
      }
    }

    // Build 12-month array with a key per year
    const monthly = MONTH_LABELS.map((label, i) => {
      const monthNum = i + 1
      const entry = { month: label, month_num: monthNum }
      for (const year of years) {
        const d = byYear[year]?.[monthNum]
        entry[`deals_${year}`] = d !== undefined ? d.deals : null
        entry[`cash_${year}`] = d !== undefined ? d.cash : null
        entry[`mrr_${year}`] = d !== undefined ? d.mrr : null
      }
      return entry
    })

    // YoY % change: latest year vs previous year
    const sortedYears = [...years].sort()
    const latestYear = sortedYears[sortedYears.length - 1]
    const prevYear = sortedYears.length > 1 ? sortedYears[sortedYears.length - 2] : null

    const yoyChanges = {}
    if (prevYear) {
      for (let m = 1; m <= 12; m++) {
        const latest = byYear[latestYear]?.[m]
        const prev = byYear[prevYear]?.[m]
        if (latest && prev) {
          yoyChanges[m] = {
            deals: prev.deals > 0 ? ((latest.deals - prev.deals) / prev.deals * 100).toFixed(1) : null,
            cash: prev.cash > 0 ? ((latest.cash - prev.cash) / prev.cash * 100).toFixed(1) : null,
          }
        }
      }
    }

    // ── YTD Summary (through today's calendar date, both years) ──────────
    // Revenue from DailyRevenue table
    const { rows: revenueYtdRows } = await pool.query(`
      SELECT
        EXTRACT(year FROM date::date)::int AS year,
        COALESCE(SUM(amount), 0) AS revenue
      FROM "DailyRevenue"
      WHERE
        EXTRACT(year FROM date::date) IN (
          EXTRACT(year FROM CURRENT_DATE)::int,
          EXTRACT(year FROM CURRENT_DATE)::int - 1
        )
        AND (
          EXTRACT(month FROM date::date) * 100 + EXTRACT(day FROM date::date)
        ) <= (
          EXTRACT(month FROM CURRENT_DATE) * 100 + EXTRACT(day FROM CURRENT_DATE)
        )
      GROUP BY year
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
      ytdRevByYear[r.year] = Number(r.revenue || 0)
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
        current: ytdRevByYear[currentYear] || 0,
        prior: ytdRevByYear[priorYear] || 0,
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

    return NextResponse.json({ years, monthly, yoyChanges, latestYear, prevYear, ytdSummary })
  } catch (err) {
    console.error('[sales-yoy] error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
