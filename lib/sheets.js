import { google } from 'googleapis'
import { createGoogleAuth, SHEETS_READONLY } from '@/lib/google-auth'

const SPREADSHEET_ID = '1TgcF29SDHWPG3N-P4tGx3Pa7r1mSl_U0FeFP-PpPF9Q'

const auth = createGoogleAuth(SHEETS_READONLY)

export async function getRepData(repName) {
  const client = await auth.getClient()
  const sheets = google.sheets({ version: 'v4', auth: client })

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${repName}!A1:ZZ20`,
    valueRenderOption: 'UNFORMATTED_VALUE',    // get raw decimals, not formatted "67%"
    dateTimeRenderOption: 'FORMATTED_STRING'   // keep dates as "3/11/26" strings
  })

  return res.data.values || []
}

export function parseRepSheet(rows) {
  // Row 2 (index 1) has dates starting at column E (index 4)
  // Column D (index 3) is the label "Date"
  const dateRow = rows[1] || []
  const kpiRows = rows.slice(4, 17) // rows 5-17 (0-indexed: 4-16)

  const today = new Date()
  today.setHours(23, 59, 59, 999) // end of today

  const todayStr = `${today.getMonth() + 1}/${today.getDate()}/${String(today.getFullYear()).slice(-2)}`

  // Find today's column index
  let todayColIdx = -1
  for (let i = 4; i < dateRow.length; i++) {
    const cellDate = dateRow[i]
    if (cellDate && cellDate.trim() === todayStr) {
      todayColIdx = i
      break
    }
  }

  const weekStart = getWeekStart(today)

  const kpiNames = [
    'Scheduled Calls', 'New Inbound', 'Follow ups', 'Outbound Activity',
    'Shown', 'No Show', 'Show Rate', 'Cancelled', 'Rebooked',
    'Agreements Sent', 'Agreements Closed', 'Close Rate', 'Touchpoints to close'
  ]

  // Extended period date ranges
  const yr = today.getFullYear()
  const lastMonthStart = new Date(yr, today.getMonth() - 1, 1)
  const lastMonthEnd = new Date(yr, today.getMonth(), 0, 23, 59, 59)
  const Q1_START = new Date(yr, 0, 1),  Q1_END = new Date(yr, 2, 31, 23, 59, 59)
  const Q2_START = new Date(yr, 3, 1),  Q2_END = new Date(yr, 5, 30, 23, 59, 59)
  const Q3_START = new Date(yr, 6, 1),  Q3_END = new Date(yr, 8, 30, 23, 59, 59)
  const Q4_START = new Date(yr, 9, 1),  Q4_END = new Date(yr, 11, 31, 23, 59, 59)
  const YTD_START = new Date(yr, 0, 1)

  const metrics = {}

  // First pass: collect raw sums for all metrics
  kpiNames.forEach((name, i) => {
    const row = kpiRows[i] || []

    const todayVal = todayColIdx >= 0 ? (parseFloat(row[todayColIdx]) || 0) : 0

    let weekTotal = 0
    let monthTotal = 0
    let lastMonthTotal = 0
    let q1Total = 0, q2Total = 0, q3Total = 0, q4Total = 0
    let ytdTotal = 0

    for (let j = 4; j < dateRow.length; j++) {
      const cellDateStr = dateRow[j]
      if (!cellDateStr) continue
      const cellDate = parseSheetDate(String(cellDateStr))
      if (!cellDate) continue

      const val = parseFloat(row[j]) || 0

      const inWeek = cellDate >= weekStart && cellDate <= today
      const inMonth = cellDate.getMonth() === today.getMonth() &&
        cellDate.getFullYear() === today.getFullYear() &&
        cellDate <= today
      const inLastMonth = cellDate >= lastMonthStart && cellDate <= lastMonthEnd
      const inQ1  = cellDate >= Q1_START  && cellDate <= Q1_END
      const inQ2  = cellDate >= Q2_START  && cellDate <= Q2_END
      const inQ3  = cellDate >= Q3_START  && cellDate <= Q3_END
      const inQ4  = cellDate >= Q4_START  && cellDate <= Q4_END
      const inYtd = cellDate >= YTD_START && cellDate <= today

      if (inWeek)      weekTotal      += val
      if (inMonth)     monthTotal     += val
      if (inLastMonth) lastMonthTotal += val
      if (inQ1)        q1Total        += val
      if (inQ2)        q2Total        += val
      if (inQ3)        q3Total        += val
      if (inQ4)        q4Total        += val
      if (inYtd)       ytdTotal       += val
    }

    // Store raw sums for all metrics — rates will be recalculated below
    metrics[name] = {
      today: todayVal,
      week: weekTotal,
      month: monthTotal,
      lastMonth: lastMonthTotal,
      q1: q1Total, q2: q2Total, q3: q3Total, q4: q4Total,
      ytd: ytdTotal,
    }
  })

  // Second pass: recalculate rates from raw numerator/denominator
  // Show Rate = Shown / Scheduled Calls
  // Close Rate = Agreements Closed / Agreements Sent
  const allPeriods = ['today', 'week', 'month', 'lastMonth', 'q1', 'q2', 'q3', 'q4', 'ytd']
  const shown     = metrics['Shown']               || {}
  const scheduled = metrics['Scheduled Calls']     || {}
  const closed    = metrics['Agreements Closed']   || {}
  const sent      = metrics['Agreements Sent']     || {}

  const showRate  = {}
  const closeRate = {}
  for (const p of allPeriods) {
    showRate[p]  = (scheduled[p] || 0) > 0 ? (shown[p]  || 0) / scheduled[p] : 0
    closeRate[p] = (sent[p]      || 0) > 0 ? (closed[p] || 0) / sent[p]      : 0
  }

  metrics['Show Rate']  = showRate
  metrics['Close Rate'] = closeRate

  return metrics
}

function getWeekStart(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function parseSheetDate(str) {
  // Format: "1/5/26" → Jan 5 2026
  if (!str) return null
  const parts = str.trim().split('/')
  if (parts.length !== 3) return null
  const [m, d, y] = parts
  const year = parseInt(y) < 100 ? 2000 + parseInt(y) : parseInt(y)
  const result = new Date(year, parseInt(m) - 1, parseInt(d))
  if (isNaN(result.getTime())) return null
  return result
}
