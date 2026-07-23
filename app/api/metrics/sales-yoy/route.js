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

    return NextResponse.json({ years, monthly, yoyChanges, latestYear, prevYear })
  } catch (err) {
    console.error('[sales-yoy] error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
