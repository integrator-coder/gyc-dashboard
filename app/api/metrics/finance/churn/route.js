
import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createGoogleAuth } from '@/lib/google-auth'

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

    return NextResponse.json({ months, chartData })
  } catch (error) {
    console.error('Churn sheet error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
