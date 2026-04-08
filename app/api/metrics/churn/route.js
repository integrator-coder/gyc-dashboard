import { createGoogleAuth, SHEETS_READONLY } from '@/lib/google-auth'
import { NextResponse } from 'next/server'
import { google } from 'googleapis'

const SHEET_ID = '1kLm6VWX_nlpUsFioKq6JEWLGka5Z3WCTgPUKY2C0Z6A'

const auth = createGoogleAuth(['https://www.googleapis.com/auth/spreadsheets.readonly'])

async function readTab(sheets, tab, range) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${tab}!${range}`,
    valueRenderOption: 'FORMATTED_VALUE',
  })
  return res.data.values || []
}

// Parse dollar strings like "$ 1,128", "$22,593", "-$22,593"
function parseDollar(val) {
  if (val == null || val === '') return 0
  const s = String(val).replace(/[$,\s]/g, '')
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

// Parse percent strings like "2.5%" → returns 2.5 (not 0.025)
function parsePct(val) {
  if (val == null || val === '') return 0
  const s = String(val).replace('%', '').replace(/[$,\s]/g, '')
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

// Parse plain numbers (client counts etc.)
function parseNum(val) {
  if (val == null || val === '') return 0
  const s = String(val).replace(/[,\s]/g, '')
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

/**
 * Parse Marketing or Recruiting tab.
 * Row 3 (index 2): month headers starting at column E (index 4)
 * Row 4  (index 3):  Client Count
 * Row 5  (index 4):  Avg MRR Per Client
 * Row 6  (index 5):  Total MRR
 * Row 8  (index 7):  Clients Lost
 * Row 9  (index 8):  Client Value Lost (MRR Cancelled)
 * Row 10 (index 9):  Clients Added
 * Row 11 (index 10): Client Value Added (New MRR)
 * Row 13 (index 12): Churn (client count %)
 * Row 14 (index 13): Churn (revenue %)
 * Row 16 (index 15): Current Client Reductions
 * Row 17 (index 16): Current Client Upsells
 * Row 18 (index 17): Net Upsells/Reductions
 * Row 20 (index 19): LOST MRR
 * Row 21 (index 20): NEW MRR
 * Row 22 (index 21): NET MRR Gain/Loss
 */
function parseTabData(rows) {
  const headerRow = rows[2] || []
  const months = []
  for (let i = 4; i < headerRow.length; i++) {
    if (headerRow[i] && String(headerRow[i]).trim()) {
      months.push({ month: String(headerRow[i]).trim(), col: i })
    }
  }

  const getRow = (idx) => rows[idx] || []

  const monthly = []
  for (const { month, col } of months) {
    const clientCount = parseNum(getRow(3)[col])
    const totalMRR    = parseDollar(getRow(5)[col])

    // Skip columns with no data
    if (!clientCount && !totalMRR) continue

    monthly.push({
      month,
      clientCount,
      avgMRR:       parseDollar(getRow(4)[col]),
      totalMRR,
      clientsLost:  parseNum(getRow(7)[col]),
      mrrLost:      parseDollar(getRow(8)[col]),
      clientsAdded: parseNum(getRow(9)[col]),
      mrrAdded:     parseDollar(getRow(10)[col]),
      churnPct:     parsePct(getRow(12)[col]),
      churnRevPct:  parsePct(getRow(13)[col]),
      reductions:   parseDollar(getRow(15)[col]),
      upsells:      parseDollar(getRow(16)[col]),
      netUpsells:   parseDollar(getRow(17)[col]),
      lostMRR:      parseDollar(getRow(19)[col]),
      newMRR:       parseDollar(getRow(20)[col]),
      netMRR:       parseDollar(getRow(21)[col]),
    })
  }

  return monthly
}

/**
 * Parse "Marketing Revenue by MC" tab.
 * Row 1 (index 0): "Churn By CAM" label, then month headers from column B (index 1)
 * Rows 2-N: CAM name in col A, monthly values in B onwards
 * After blank rows: churn % rows for each CAM
 */
function parseCAMData(rows) {
  const headerRow = rows[0] || []
  const months = []
  for (let i = 1; i < headerRow.length; i++) {
    if (headerRow[i] && String(headerRow[i]).trim()) {
      months.push({ month: String(headerRow[i]).trim(), col: i })
    }
  }

  const camRevenue = {}
  const camChurnPct = {}

  // Detect transition from revenue rows to churn % rows:
  // A row is a "churn %" row if at least one non-empty value contains '%'
  const isChurnRow = (row) => {
    for (let i = 1; i < row.length; i++) {
      const v = String(row[i] || '').trim()
      if (v && v.includes('%')) return true
    }
    return false
  }

  for (let rowIdx = 1; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx] || []
    const name = String(row[0] || '').trim()
    if (!name) continue

    if (isChurnRow(row)) {
      camChurnPct[name] = months
        .map(({ month, col }) => ({ month, pct: parsePct(row[col]) }))
        .filter(d => d.pct > 0)
    } else {
      camRevenue[name] = months
        .map(({ month, col }) => ({ month, mrr: parseDollar(row[col]) }))
        .filter(d => d.mrr > 0)
    }
  }

  return { camRevenue, camChurnPct }
}

/**
 * Augment monthly data with GRR and Avg Days to Churn, and return top-level aggregates.
 * GRR  = (totalMRR - mrrLost) / totalMRR × 100, capped 0–100
 * AvgDays = (1 / churnRate) × 30   where churnRate = churnPct / 100
 */
function computeGRRAndAvgDays(monthly) {
  const augmented = monthly.map(m => {
    const grr = m.totalMRR > 0
      ? Math.round(Math.min(100, Math.max(0, (m.totalMRR - m.mrrLost) / m.totalMRR * 100)) * 10) / 10
      : null
    const avgDaysToChurn = (m.churnPct > 0 && m.churnPct <= 20)
      ? Math.round((1 / (m.churnPct / 100)) * 30)
      : null
    return { ...m, grr, avgDaysToChurn }
  })

  const avgNums = (arr) => arr.length
    ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length * 10) / 10
    : null
  const avgInts = (arr) => arr.length
    ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length)
    : null

  const validGrr   = (slice) => slice.filter(m => m.grr != null).map(m => m.grr)
  const validDays  = (slice) => slice.filter(m => m.avgDaysToChurn != null).map(m => m.avgDaysToChurn)

  // Latest non-null value
  const latestGrr  = [...augmented].reverse().find(m => m.grr != null)?.grr  ?? null
  const latestDays = [...augmented].reverse().find(m => m.avgDaysToChurn != null)?.avgDaysToChurn ?? null

  return {
    augmented,
    grr: {
      current:     latestGrr,
      trailing3m:  avgNums(validGrr(augmented.slice(-3))),
      trailing12m: avgNums(validGrr(augmented.slice(-12))),
    },
    avgDaysToChurn: {
      current:     latestDays,
      trailing3m:  avgInts(validDays(augmented.slice(-3))),
      trailing12m: avgInts(validDays(augmented.slice(-12))),
    },
  }
}

/**
 * Compute NRR (Net Revenue Retention) from the monthly data array.
 * NRR(month) = (prevMRR + upsells - reductions - cancellations) / prevMRR × 100
 * Skips the first month (no prevMRR) and filters outliers (NRR > 200% or < 0%).
 */
function computeNRR(monthly) {
  const result = []

  for (let i = 1; i < monthly.length; i++) {
    const prev = monthly[i - 1]
    const curr = monthly[i]
    const prevMRR = prev.totalMRR
    if (!prevMRR) continue

    const nrrVal = ((prevMRR + (curr.upsells || 0) - (curr.reductions || 0) - (curr.mrrLost || 0)) / prevMRR) * 100

    // Filter extreme outliers
    if (nrrVal < 0 || nrrVal > 200) continue

    result.push({
      month:         curr.month,
      nrr:           Math.round(nrrVal * 10) / 10,
      startMRR:      prevMRR,
      upsells:       curr.upsells       || 0,
      reductions:    curr.reductions    || 0,
      cancellations: curr.mrrLost       || 0,
    })
  }

  const avg = (arr) => arr.length
    ? Math.round((arr.reduce((s, r) => s + r.nrr, 0) / arr.length) * 10) / 10
    : null

  return {
    monthly:      result,
    trailing3mo:  avg(result.slice(-3)),
    trailing12mo: avg(result.slice(-12)),
    currentMonth: result.length ? result[result.length - 1].nrr : null,
  }
}

export async function GET() {
  try {
    const client = await auth.getClient()
    const sheets = google.sheets({ version: 'v4', auth: client })

    const [marketingRows, camRows, recruitingRows] = await Promise.all([
      readTab(sheets, 'Marketing', 'A1:AQ200'),
      readTab(sheets, 'Marketing Revenue by MC', 'A1:AQ200'),
      readTab(sheets, 'Recruiting', 'A1:AQ200'),
    ])

    const marketingMonthly  = parseTabData(marketingRows)
    const recruitingMonthly = parseTabData(recruitingRows)
    const { camRevenue, camChurnPct } = parseCAMData(camRows)

    const { augmented: marketingAugmented, grr, avgDaysToChurn } = computeGRRAndAvgDays(marketingMonthly)

    return NextResponse.json({
      marketing: {
        monthly: marketingAugmented,
        camRevenue,
        camChurnPct,
        nrr: computeNRR(marketingMonthly),
        grr,
        avgDaysToChurn,
      },
      recruiting: {
        monthly: recruitingMonthly,
      },
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Churn API error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
