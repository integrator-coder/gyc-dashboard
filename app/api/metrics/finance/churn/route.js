export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createGoogleAuth } from '@/lib/google-auth'
import pkg from 'pg'
const { Pool } = pkg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const SHEET_ID = '1kLm6VWX_nlpUsFioKq6JEWLGka5Z3WCTgPUKY2C0Z6A'

// Col index 4 = Jan-23 (offset 0)
// Derive correct label from column position — don't trust cell value
function colToMonthLabel(colIndex) {
  const offset = colIndex - 4
  const baseYear = 2023
  const baseMonth = 0 // January (0-indexed)
  const totalMonths = baseMonth + offset
  const year = baseYear + Math.floor(totalMonths / 12)
  const month = totalMonths % 12
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${monthNames[month]}-${String(year).slice(2)}`
}

function colToMonthKey(colIndex) {
  const offset = colIndex - 4
  const totalMonths = offset
  const year = 2023 + Math.floor(totalMonths / 12)
  const month = totalMonths % 12
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

function colToMonthFull(colIndex) {
  const offset = colIndex - 4
  const year = 2023 + Math.floor(offset / 12)
  const month = offset % 12
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December']
  return `${monthNames[month]} ${year}`
}

// Short label for charts: "Oct 25"
function colToMonthShort(colIndex) {
  const offset = colIndex - 4
  const year = 2023 + Math.floor(offset / 12)
  const month = offset % 12
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${monthNames[month]} ${String(year).slice(2)}`
}

// Parse " $ 3,797 " → 3797
function parseCurrency(str) {
  if (!str || typeof str !== 'string') return 0
  const cleaned = str.replace(/[^0-9.\-]/g, '')
  const val = parseFloat(cleaned)
  // Handle negative represented as "-$15,919" — check original for minus sign
  if (str.trim().startsWith('-')) return -Math.abs(val)
  return isNaN(val) ? 0 : Math.round(val)
}

// Parse "1.4%" → 1.4
function parsePercent(str) {
  if (!str || typeof str !== 'string') return 0
  const val = parseFloat(str.replace('%', '').trim())
  return isNaN(val) ? 0 : val
}

// Parse integer string "  295 " → 295
function parseInt2(str) {
  if (!str || typeof str !== 'string') return 0
  const val = parseInt(str.trim(), 10)
  return isNaN(val) ? 0 : val
}

function getCell(rows, rowIndex, colIndex) {
  return rows[rowIndex]?.[colIndex] ?? ''
}

export async function GET() {
  try {
    const auth = createGoogleAuth(['https://www.googleapis.com/auth/spreadsheets.readonly'])

    const client = await auth.getClient()
    const sheets = google.sheets({ version: 'v4', auth: client })

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'A1:BB60',
    })

    const rows = res.data.values || []

    // Find last data column: scan row index 3 (Client Count) from right
    const clientCountRow = rows[3] || []
    let lastDataCol = 4
    for (let c = 4; c < clientCountRow.length; c++) {
      if (clientCountRow[c] && clientCountRow[c].trim() !== '') {
        lastDataCol = c
      }
    }

    // Extract last 3 months (for tabs — newest first)
    const months = []
    for (let i = 2; i >= 0; i--) {
      const col = lastDataCol - i
      if (col < 4) continue

      const key = colToMonthKey(col)
      const month = colToMonthFull(col)

      const clientCount    = parseInt2(getCell(rows, 3, col))
      const avgMrrPerClient = parseCurrency(getCell(rows, 4, col))
      const totalMrr       = parseCurrency(getCell(rows, 5, col))
      const clientsLost    = parseInt2(getCell(rows, 7, col))
      const mrrLost        = parseCurrency(getCell(rows, 8, col))
      const clientsAdded   = parseInt2(getCell(rows, 9, col))
      const mrrAdded       = parseCurrency(getCell(rows, 10, col))
      const churnRateCount   = parsePercent(getCell(rows, 12, col))
      const churnRateRevenue = parsePercent(getCell(rows, 13, col))
      const reductions     = parseCurrency(getCell(rows, 15, col))
      const upsells        = parseCurrency(getCell(rows, 16, col))
      const netUpsells     = parseCurrency(getCell(rows, 17, col))
      const lostMrr        = parseCurrency(getCell(rows, 19, col))
      const newMrr         = parseCurrency(getCell(rows, 20, col))

      months.push({
        key,
        month,
        clientCount,
        avgMrrPerClient,
        totalMrr,
        clientsLost,
        mrrLost,
        clientsAdded,
        mrrAdded,
        churnRateCount,
        churnRateRevenue,
        reductions,
        upsells,
        netUpsells,
        lostMrr,
        newMrr,
      })
    }

    // Newest first
    months.reverse()

    // Extract last 6 months for charts (oldest → newest)
    const chartData = []
    for (let i = 5; i >= 0; i--) {
      const col = lastDataCol - i
      if (col < 4) continue

      chartData.push({
        month: colToMonthShort(col),
        churnRateCount: parsePercent(getCell(rows, 12, col)),
        mrrLost: Math.abs(parseCurrency(getCell(rows, 8, col))),
        mrrAdded: parseCurrency(getCell(rows, 10, col)),
      })
    }

    // ── Stitch in DB rows for months after the sheet's last column ──────────
    const sheetLastKey = colToMonthKey(lastDataCol) // e.g. '2026-04'
    let dbRows = []
    try {
      const dbClient = await pool.connect()
      try {
        const { rows: dbData } = await dbClient.query(`
          SELECT month, "totalMRR", "clientCount", "clientsAdded", "clientsLost",
                 "newMRR", "churnedMRR", "netMRR", "churnPct"
          FROM "MonthlyChurnMetrics"
          WHERE "tenantId" = 'gyc' AND month > $1
          ORDER BY month ASC
        `, [sheetLastKey])
        dbRows = dbData
      } finally {
        dbClient.release()
      }
    } catch (e) {
      console.error('finance/churn DB error:', e.message)
    }

    // Convert DB rows to the same shape used by months[] and chartData[]
    const dbMonths = dbRows.map(r => {
      const [y, m] = r.month.split('-')
      const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']
      const shortNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
      const mi = parseInt(m, 10) - 1
      const totalMrr = parseFloat(r.totalMRR) || 0
      const clientCount = r.clientcount || 0
      const avgMrrPerClient = clientCount > 0 ? Math.round(totalMrr / clientCount) : 0
      const churnedMRR = parseFloat(r.churnedMRR) || 0
      const newMRR = parseFloat(r.newMRR) || 0
      const churnPct = parseFloat(r.churnPct) || 0
      return {
        key: r.month,
        month: `${monthNames[mi]} ${y}`,
        monthShort: `${shortNames[mi]} ${y.slice(2)}`,
        clientCount,
        avgMrrPerClient,
        totalMrr,
        clientsLost: r.clientslost || 0,
        mrrLost: churnedMRR,
        clientsAdded: r.clientsadded || 0,
        mrrAdded: newMRR,
        churnRateCount: churnPct,
        churnRateRevenue: churnPct,
        reductions: 0,
        upsells: 0,
        netUpsells: 0,
        lostMrr: churnedMRR,
        newMrr: newMRR,
      }
    })

    // Merge: sheet months (newest first) + DB months (newest first), take last 3
    const allMonths = [...months, ...dbMonths].sort((a, b) => b.key.localeCompare(a.key))
    const finalMonths = allMonths.slice(0, 3)

    // Merge chart data: all sheet chart points + DB points, take last 6
    const dbChartPoints = dbRows.map(r => {
      const [y, m] = r.month.split('-')
      const shortNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
      const mi = parseInt(m, 10) - 1
      return {
        month: `${shortNames[mi]} ${y.slice(2)}`,
        key: r.month,
        churnRateCount: parseFloat(r.churnPct) || 0,
        mrrLost: Math.abs(parseFloat(r.churnedMRR) || 0),
        mrrAdded: parseFloat(r.newMRR) || 0,
      }
    })

    // Build full chart history: existing chartData (last 6 from sheet) + DB points
    // Re-derive last 6 from all available data chronologically
    const allChartKeyed = {}
    // Sheet contributions (up to lastDataCol)
    for (let i = Math.max(4, lastDataCol - 11); i <= lastDataCol; i++) {
      const k = colToMonthKey(i)
      allChartKeyed[k] = {
        month: colToMonthShort(i),
        key: k,
        churnRateCount: parsePercent(getCell(rows, 12, i)),
        mrrLost: Math.abs(parseCurrency(getCell(rows, 8, i))),
        mrrAdded: parseCurrency(getCell(rows, 10, i)),
      }
    }
    // DB contributions
    for (const pt of dbChartPoints) allChartKeyed[pt.key] = pt
    const allChartSorted = Object.values(allChartKeyed).sort((a, b) => a.key.localeCompare(b.key))
    const finalChartData = allChartSorted.slice(-6)

    return NextResponse.json({ months: finalMonths, chartData: finalChartData })
  } catch (error) {
    console.error('Churn sheet error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
