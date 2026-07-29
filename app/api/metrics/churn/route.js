export const dynamic = 'force-dynamic'


import { createGoogleAuth, SHEETS_READONLY } from '@/lib/google-auth'
import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import pkg from 'pg'
import nullableMoneyPkg from '@/lib/nullable-money'
import pifReturnQueryPkg from '@/lib/pif-return-query'
const { Pool } = pkg
const { nullableNumber } = nullableMoneyPkg
const { fetchConfirmedPifReturns } = pifReturnQueryPkg

const SHEET_ID = '1kLm6VWX_nlpUsFioKq6JEWLGka5Z3WCTgPUKY2C0Z6A'

const auth = createGoogleAuth(['https://www.googleapis.com/auth/spreadsheets.readonly'])

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

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
 * Augment monthly data with GRR and implied client lifetime, and return aggregates.
 * GRR  = (totalMRR - mrrLost) / totalMRR × 100, capped 0–100
 * ImpliedLifetimeDays = (1 / monthly churn rate) × 30. This is modeled,
 * not the observed tenure of canceled clients.
 */
function computeGRRAndAvgDays(monthly) {
  const augmented = monthly.map(m => {
    const grr = m.grr != null ? m.grr : m.totalMRR > 0
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
  const monthlyNRRSeries = []
  const pifNRRSeries = []

  for (let i = 1; i < monthly.length; i++) {
    const prev = monthly[i - 1]
    const curr = monthly[i]
    const prevMRR = prev.totalMRR
    if (!prevMRR) continue

    const nrrVal = curr.nrr != null
      ? curr.nrr
      : ((prevMRR + (curr.upsells || 0) - (curr.reductions || 0) - (curr.mrrLost || 0)) / prevMRR) * 100

    // Filter extreme outliers
    if (nrrVal < 0 || nrrVal > 200) continue

    const dataPoint = {
      month:         curr.month,
      nrr:           Math.round(nrrVal * 10) / 10,
      startMRR:      curr.nrr != null ? null : prevMRR,
      source:        curr.nrr != null ? 'Stripe cohort' : 'Google Sheets bridge',
      upsells:       curr.upsells       || 0,
      reductions:    curr.reductions    || 0,
      cancellations: curr.mrrLost       || 0,
    }
    
    // Add split NRR from DB rows if available
    if (curr.monthlyNRR !== undefined) {
      dataPoint.monthlyNRR = curr.monthlyNRR
    }
    if (curr.pifNRR !== undefined) {
      dataPoint.pifNRR = curr.pifNRR
    }
    
    result.push(dataPoint)
    
    // Build separate series for chart
    if (curr.monthlyNRR != null) {
      monthlyNRRSeries.push({ month: curr.month, nrr: curr.monthlyNRR })
    }
    if (curr.pifNRR != null) {
      pifNRRSeries.push({ month: curr.month, nrr: curr.pifNRR })
    }
  }

  const avg = (arr) => arr.length
    ? Math.round((arr.reduce((s, r) => s + r.nrr, 0) / arr.length) * 10) / 10
    : null

  return {
    monthly:      result,
    trailing3mo:  avg(result.slice(-3)),
    trailing12mo: avg(result.slice(-12)),
    currentMonth: result.length ? result[result.length - 1].nrr : null,
    monthlyCurrentMonth: monthlyNRRSeries.length ? monthlyNRRSeries[monthlyNRRSeries.length - 1].nrr : null,
    pifCurrentMonth: pifNRRSeries.length ? pifNRRSeries[pifNRRSeries.length - 1].nrr : null,
  }
}

// Fetch MonthlyChurnMetrics rows from DB for months past the Google Sheet's range
async function fetchDBChurnMetrics(sheetMonths) {
  const sheetSet = new Set(sheetMonths)
  const dbClient = await pool.connect()
  try {
    const { rows } = await dbClient.query(`
      SELECT month, "totalMRR", "clientCount", "clientsAdded", "clientsLost",
             "newMRR", "churnedMRR", "netMRR", "churnPct", "revenueChurnPct", "nrr", "grr",
             "monthlyMRR", "pifMRR", "monthlyNRR", "pifNRR", "syncedAt"
      FROM "MonthlyChurnMetrics"
      WHERE "tenantId" = 'gyc'
      ORDER BY month ASC
    `)
    // Only return months NOT already covered by the sheet
    return rows.filter(r => !sheetSet.has(r.month))
  } catch (e) {
    console.error('MonthlyChurnMetrics fetch error:', e.message)
    return []
  } finally {
    dbClient.release()
  }
}

async function fetchConfirmedLateralMovements() {
  const dbClient = await pool.connect()
  try {
    const rows = await fetchConfirmedPifReturns(dbClient)
    return rows.map(row => ({
      stripeCustomerId: row.stripeCustomerId,
      clientName: row.clientName,
      movementDate: row.movementDate,
      mrrMoved: Number(row.mrrMoved),
      pifCashReceived: nullableNumber(row.pifCashReceived),
      termMonths: Number(row.termMonths),
      scheduledReturnDate: row.scheduledReturnDate,
      returningMrr: nullableNumber(row.returningMrr),
      returningProgram: row.returningProgram,
      status: row.status,
    }))
  } catch (error) {
    // Backward-compatible during deployment before the ledger migration runs.
    if (error.code === '42P01') return []
    throw error
  } finally {
    dbClient.release()
  }
}

// Convert a MonthlyChurnMetrics DB row into the same shape parseTabData returns
function dbRowToMonthly(row) {
  const clientCount = Number(row.clientCount) || 0
  const totalMRR = parseFloat(row.totalMRR) || 0

  return {
    month:        row.month,
    clientCount,
    avgMRR:       clientCount > 0 ? Math.round(totalMRR / clientCount) : 0,
    totalMRR,
    clientsLost:  Number(row.clientsLost) || 0,
    mrrLost:      parseFloat(row.churnedMRR) || 0,
    clientsAdded: Number(row.clientsAdded) || 0,
    mrrAdded:     parseFloat(row.newMRR) || 0,
    churnPct:     parseFloat(row.churnPct) || 0,
    churnRevPct:  parseFloat(row.revenueChurnPct) || 0,
    reductions:   0,
    upsells:      0,
    netUpsells:   0,
    lostMRR:      parseFloat(row.churnedMRR) || 0,
    newMRR:       parseFloat(row.newMRR) || 0,
    netMRR:       parseFloat(row.netMRR) || 0,
    monthlyMRR:   parseFloat(row.monthlyMRR) || 0,
    pifMRR:       parseFloat(row.pifMRR) || 0,
    monthlyNRR:   row.monthlyNRR == null ? null : parseFloat(row.monthlyNRR),
    pifNRR:       row.pifNRR == null ? null : parseFloat(row.pifNRR),
    nrr:          row.nrr == null ? null : parseFloat(row.nrr),
    grr:          row.grr == null ? null : parseFloat(row.grr),
    syncedAt:     row.syncedAt,
  }
}

// Convert a month string 'YYYY-MM' to display label 'MMM-YY'
function monthToLabel(m) {
  const [y, mo] = m.split('-')
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${names[parseInt(mo,10)-1]}-${y.slice(2)}`
}

export async function getChurnMetrics() {
    const client = await auth.getClient()
    const sheets = google.sheets({ version: 'v4', auth: client })

    const [marketingRows, camRows, recruitingRows] = await Promise.all([
      readTab(sheets, 'Marketing', 'A1:AZ200'),
      readTab(sheets, 'Marketing Revenue by MC', 'A1:AZ200'),
      readTab(sheets, 'Recruiting', 'A1:AZ200'),
    ])

    const marketingMonthly  = parseTabData(marketingRows)
    const recruitingMonthly = parseTabData(recruitingRows)
    const { camRevenue, camChurnPct } = parseCAMData(camRows)

    // ── Stitch in DB data for months past the sheet's range ──────────────────
    const sheetMonths = marketingMonthly.map(m => {
      // Convert display labels like 'May-26' back to 'YYYY-MM' for dedup
      const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
      const match = m.month.match(/^([A-Za-z]{3})-(\d{2})$/)
      if (!match) return null
      const mo = names.findIndex(n => n.toLowerCase() === match[1].toLowerCase())
      if (mo === -1) return null
      const yr = parseInt(match[2], 10)
      return `${yr >= 23 ? 2000 + yr : 2100 + yr}-${String(mo + 1).padStart(2, '0')}`
    }).filter(Boolean)

    const [dbRows, lateralMovements] = await Promise.all([
      fetchDBChurnMetrics(sheetMonths),
      fetchConfirmedLateralMovements(),
    ])
    const dbMonthly = dbRows.map(r => ({ ...dbRowToMonthly(r), month: monthToLabel(r.month) }))
    const combinedMonthly = [...marketingMonthly, ...dbMonthly]

    const { augmented: marketingAugmented, grr, avgDaysToChurn } = computeGRRAndAvgDays(combinedMonthly)

    return {
      marketing: {
        monthly: marketingAugmented,
        camRevenue,
        camChurnPct,
        nrr: computeNRR(combinedMonthly),
        grr,
        avgDaysToChurn,
      },
      recruiting: {
        monthly: recruitingMonthly,
      },
      lateralMovements: {
        policy: 'Only confirmed same-customer Monthly → PIF conversions are excluded from client and revenue churn. Ambiguous PIF deals remain unclassified.',
        confirmed: lateralMovements,
        totals: lateralMovements.reduce((totals, row) => ({
          count: totals.count + 1,
          mrrMoved: totals.mrrMoved + row.mrrMoved,
          returningMrr: totals.returningMrr + (row.returningMrr ?? 0),
          returningMrrPendingCount: totals.returningMrrPendingCount + (row.returningMrr == null ? 1 : 0),
          pifCashReceived: totals.pifCashReceived + (row.pifCashReceived ?? 0),
          pifCashPendingCount: totals.pifCashPendingCount + (row.pifCashReceived == null ? 1 : 0),
        }), { count: 0, mrrMoved: 0, returningMrr: 0, returningMrrPendingCount: 0, pifCashReceived: 0, pifCashPendingCount: 0 }),
      },
      updatedAt: dbRows.length ? dbRows[dbRows.length - 1].syncedAt : new Date().toISOString(),
      latestMonthIsPartial: combinedMonthly.at(-1)?.month === monthToLabel(new Date().toISOString().slice(0, 7)),
    }
}

export async function GET() {
  try {
    return NextResponse.json(await getChurnMetrics())
  } catch (err) {
    console.error('Churn API error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
