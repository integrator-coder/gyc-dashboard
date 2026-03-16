import { google } from 'googleapis'

const SPREADSHEET_ID = '1TgcF29SDHWPG3N-P4tGx3Pa7r1mSl_U0FeFP-PpPF9Q'

const auth = new google.auth.GoogleAuth({
  keyFile: '/Users/toddthejedigmail.com/.openclaw/credentials/google-console.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
})

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

  const metrics = {}

  // First pass: collect raw sums for all metrics
  kpiNames.forEach((name, i) => {
    const row = kpiRows[i] || []
    const isRate = name.includes('Rate')

    const todayVal = todayColIdx >= 0 ? (parseFloat(row[todayColIdx]) || 0) : 0

    let weekTotal = 0
    let monthTotal = 0

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

      if (inWeek) weekTotal += val
      if (inMonth) monthTotal += val
    }

    // Store raw sums for all metrics — rates will be recalculated below
    metrics[name] = { today: todayVal, week: weekTotal, month: monthTotal }
  })

  // Second pass: recalculate rates from raw numerator/denominator
  // Show Rate = Shown / Scheduled Calls
  // Close Rate = Agreements Closed / Agreements Sent
  const shown = metrics['Shown'] || { today: 0, week: 0, month: 0 }
  const scheduled = metrics['Scheduled Calls'] || { today: 0, week: 0, month: 0 }
  const closed = metrics['Agreements Closed'] || { today: 0, week: 0, month: 0 }
  const sent = metrics['Agreements Sent'] || { today: 0, week: 0, month: 0 }

  metrics['Show Rate'] = {
    today: scheduled.today > 0 ? shown.today / scheduled.today : 0,
    week:  scheduled.week  > 0 ? shown.week  / scheduled.week  : 0,
    month: scheduled.month > 0 ? shown.month / scheduled.month : 0,
  }

  metrics['Close Rate'] = {
    today: sent.today > 0 ? closed.today / sent.today : 0,
    week:  sent.week  > 0 ? closed.week  / sent.week  : 0,
    month: sent.month > 0 ? closed.month / sent.month : 0,
  }

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
