export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import pkg from 'pg'
const { Pool } = pkg
import { createGoogleAuth } from '@/lib/google-auth'
import { google } from 'googleapis'

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const SHEET_ID = '1858s3B0oQ8YC4KEBDefJMc0WuD5nyjNIFxiQrqsuO-A'
const ANNUAL_TARGET = 4_200_000
const MONTHLY_TARGET = ANNUAL_TARGET / 12 // $350,000/mo

// ─── Scenario definitions ─────────────────────────────────────────────────────
const SCENARIOS = {
  base: {
    label: 'Base Case',
    description: 'Current trends continue. 2025 sales pace, churn holds at 2.5%/mo.',
    churnRate: 0.025,
    newMRRPerMonth: 9974,
    expansionMRR: 0,
    renewalRate: 0.75,
    roofingMRR: 0,
    color: '#6366f1',
  },
  target: {
    label: '$4.2M Target',
    description: 'Close rate improves 25%, churn drops to 1.8%, expansion MRR from upsells begins.',
    churnRate: 0.018,
    newMRRPerMonth: 13000,
    expansionMRR: 3000,
    renewalRate: 0.82,
    roofingMRR: 0,
    color: '#f59e0b',
  },
  stretch: {
    label: 'Stretch / Roofing 2027',
    description: 'Execution excellence + roofing pilot launch Sept 2026.',
    churnRate: 0.015,
    newMRRPerMonth: 16000,
    expansionMRR: 5000,
    renewalRate: 0.88,
    roofingMRR: 7500, // adds starting Oct 2026
    color: '#10b981',
  },
}

// ─── Avg deal MRR (base case new MRR ÷ ~11 deals/mo) ─────────────────────────
const AVG_DEAL_MRR = Math.round(9974 / 11) // ≈ 907

// ─── Google Sheets helpers ─────────────────────────────────────────────────────
async function fetchRenewalSchedule() {
  try {
    const auth = createGoogleAuth(['https://www.googleapis.com/auth/spreadsheets.readonly'])
    const client = await auth.getClient()
    const sheets = google.sheets({ version: 'v4', auth: client })

    const [res26, res25] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: '2026 Details!A1:R200',
        valueRenderOption: 'UNFORMATTED_VALUE',
        dateTimeRenderOption: 'FORMATTED_STRING',
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: '2025 Details!A1:R400',
        valueRenderOption: 'UNFORMATTED_VALUE',
        dateTimeRenderOption: 'FORMATTED_STRING',
      }),
    ])

    const rows26 = res26.data.values || []
    const rows25 = res25.data.values || []

    const parseRows = (rows) =>
      rows.slice(1).filter((r) => r[5]).map((r) => ({
        date: r[5] || '',
        pif: (r[11] || '').toString().trim().toUpperCase() === 'Y',
        term: Number(r[8]) || 0,
        renewalAmount: Number(r[12]) || 0,
        mrr: Number(r[7]) || 0,
        name: r[1] || '',
      }))

    const allDeals = [...parseRows(rows25), ...parseRows(rows26)]
    const pifTermMonths = (term) => (term === 1 ? 12 : term)
    const renewalByMonth = {}

    for (const d of allDeals) {
      if (!d.pif || !d.renewalAmount || !d.date) continue
      const termMonths = pifTermMonths(d.term)
      if (!termMonths) continue
      const saleDate = new Date(d.date)
      if (isNaN(saleDate)) continue
      saleDate.setMonth(saleDate.getMonth() + termMonths)
      const key = `${saleDate.getFullYear()}-${String(saleDate.getMonth() + 1).padStart(2, '0')}`
      const year = saleDate.getFullYear()
      if (year < 2026 || year > 2027) continue
      if (!renewalByMonth[key]) renewalByMonth[key] = 0
      renewalByMonth[key] += d.renewalAmount
    }

    return renewalByMonth
  } catch (e) {
    console.warn('Projections: could not fetch renewal schedule from Sheets:', e.message)
    return {}
  }
}

// ─── Month sequence generator ─────────────────────────────────────────────────
function monthsFrom(startYYYYMM, count) {
  const [y0, m0] = startYYYYMM.split('-').map(Number)
  const result = []
  for (let i = 0; i < count; i++) {
    const total = (y0 - 1) * 12 + (m0 - 1) + i
    const year = Math.floor(total / 12) + 1
    const month = (total % 12) + 1
    result.push(`${year}-${String(month).padStart(2, '0')}`)
  }
  return result
}

// ─── Run scenario projection ──────────────────────────────────────────────────
function runScenario(scenario, startMRR, startMonth, renewalByMonth) {
  // Generate months from startMonth to Dec 2027
  const endMonth = '2027-12'
  const startParts = startMonth.split('-').map(Number)
  const endParts = endMonth.split('-').map(Number)
  const totalMonths =
    (endParts[0] - startParts[0]) * 12 + (endParts[1] - startParts[1]) + 1
  const months = monthsFrom(startMonth, totalMonths)

  let mrr = startMRR
  const points = []

  for (const key of months) {
    const [year, mon] = key.split('-').map(Number)
    const rawRenewal = renewalByMonth[key] || 0
    const appliedRenewal = rawRenewal * scenario.renewalRate

    // Add roofing MRR starting Oct 2026 for stretch
    const isOct2026OrLater =
      year > 2026 || (year === 2026 && mon >= 10)
    const roofing = scenario.roofingMRR && isOct2026OrLater ? scenario.roofingMRR : 0

    const newMrr = mrr * (1 - scenario.churnRate) + scenario.newMRRPerMonth + scenario.expansionMRR + appliedRenewal + roofing

    points.push({
      month: key,
      mrr: Math.round(newMrr),
      renewalMRR: Math.round(appliedRenewal),
      roofingMRR: Math.round(roofing),
    })

    mrr = newMrr
  }

  // Split into 2026 (May–Dec) and 2027
  const points2026 = points.filter((p) => p.month >= startMonth && p.month <= '2026-12')
  const points2027 = points.filter((p) => p.month >= '2027-01' && p.month <= '2027-12')

  // Dec 2026 and Dec 2027 MRR
  const dec2026Mrr = points2026.find((p) => p.month === '2026-12')?.mrr || 0
  const dec2027Mrr = points2027.find((p) => p.month === '2027-12')?.mrr || 0

  // Revenue = sum of monthly MRR (simplified: MRR ≈ monthly cash)
  const revenue2026 = Math.round(points2026.reduce((s, p) => s + p.mrr, 0))
  const revenue2027 = Math.round(points2027.reduce((s, p) => s + p.mrr, 0))

  return { points, points2026, points2027, dec2026Mrr, dec2027Mrr, revenue2026, revenue2027 }
}

// ─── Sensitivity matrix ───────────────────────────────────────────────────────
function buildSensitivityMatrix(startMRR, ytdActuals, startMonth, renewalByMonth) {
  const dealCounts = [8, 10, 12, 14, 16]
  const churnRates = [0.015, 0.020, 0.025, 0.030, 0.035]

  const matrix = dealCounts.map((deals) =>
    churnRates.map((churn) => {
      const newMRRPerMonth = deals * AVG_DEAL_MRR
      const scenario = { churnRate: churn, newMRRPerMonth, expansionMRR: 0, renewalRate: 0.75, roofingMRR: 0 }
      const { revenue2026 } = runScenario(scenario, startMRR, startMonth, renewalByMonth)
      const total2026 = Math.round(ytdActuals + revenue2026)
      return total2026
    })
  )

  return { dealCounts, churnRates, matrix }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function GET() {
  const dbClient = await pool.connect()
  try {
    const now = new Date()
    const startOfYear = `${now.getFullYear()}-01-01`
    const daysElapsed = Math.floor((now - new Date(`${now.getFullYear()}-01-01`)) / 86400000) + 1
    const daysInYear = now.getFullYear() % 4 === 0 ? 366 : 365
    const daysRemaining = daysInYear - daysElapsed

    // ─── A. Scoreboard KPIs from DB ───────────────────────────────────────────
    const [metricsRes, activeClientsRes, ytdRes, monthlyActualsRes, mrrHistoryRes] =
      await Promise.all([
        dbClient.query(
          `SELECT * FROM "StripeMetrics" ORDER BY "syncedAt" DESC LIMIT 2`
        ),
        dbClient.query(
          `SELECT COUNT(*) AS cnt FROM "StripeCustomer" WHERE status = 'active'`
        ),
        dbClient.query(
          `SELECT COALESCE(SUM(amount), 0)::float AS ytd_cash FROM "DailyRevenue" WHERE date >= $1`,
          [startOfYear]
        ),
        dbClient.query(`
          SELECT
            date_part('year', date::timestamp)::int AS year,
            date_part('month', date::timestamp)::int AS month,
            ROUND(SUM(amount)::numeric, 0)::float AS revenue
          FROM "DailyRevenue"
          WHERE date >= '2025-01-01'
          GROUP BY 1, 2
          ORDER BY 1, 2
        `),
        // Trailing 14 months of monthly MRR snapshots (one per month, latest)
        dbClient.query(`
          SELECT DISTINCT ON (date_trunc('month', "syncedAt"))
            date_trunc('month', "syncedAt") AS month_ts,
            to_char(date_trunc('month', "syncedAt"), 'YYYY-MM') AS month_key,
            mrr,
            "newCustomers",
            "churnedCustomers",
            "activeCustomers"
          FROM "StripeMetrics"
          WHERE "syncedAt" >= NOW() - INTERVAL '14 months'
          ORDER BY date_trunc('month', "syncedAt") DESC, "syncedAt" DESC
          LIMIT 14
        `),
      ])

    const latestMetrics = metricsRes.rows[0] || {}
    const previousMetrics = metricsRes.rows[1] || {}
    const activeClients = Number(activeClientsRes.rows[0]?.cnt || 0)
    const ytdCash = Number(ytdRes.rows[0]?.ytd_cash || 0)
    const currentMRR = Number(latestMetrics.mrr || 213334)

    // Annualized from YTD
    const onTrackFor = daysElapsed > 0 ? Math.round((ytdCash / daysElapsed) * daysInYear) : 0
    const gapToTarget = ANNUAL_TARGET - onTrackFor

    // Quick Ratio approximation
    const avgMrr = currentMRR > 0 ? currentMRR / Math.max(activeClients, 1) : 907
    const newCusts = Number(latestMetrics.newCustomers || 0)
    const churnedCusts = Number(latestMetrics.churnedCustomers || 0)
    const newMrrEst = newCusts * avgMrr
    const churnedMrrEst = churnedCusts * avgMrr
    const quickRatio = churnedMrrEst > 0 ? Math.round((newMrrEst / churnedMrrEst) * 10) / 10 : null

    // Churn cost (monthly re-earn burden at 2.5% base)
    const churnCost = Math.round(currentMRR * 0.025)

    // Days to $4.2M
    const dailyRate = daysElapsed > 0 ? ytdCash / daysElapsed : 0
    const remaining = Math.max(ANNUAL_TARGET - ytdCash, 0)
    const daysToTarget = dailyRate > 0 ? Math.round(remaining / dailyRate) : null

    // NRR approximation: (starting MRR + expansion - churn) / starting MRR
    const prevMrr = Number(previousMetrics.mrr || currentMRR)
    const nrr = prevMrr > 0 ? Math.round((currentMRR / prevMrr) * 100) : 100

    // ─── B. Monthly Actuals ───────────────────────────────────────────────────
    const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const monthlyActuals = monthlyActualsRes.rows.map((r) => ({
      key: `${r.year}-${String(r.month).padStart(2, '0')}`,
      label: `${MONTH_NAMES[r.month - 1]} ${String(r.year).slice(2)}`,
      year: r.year,
      month: r.month,
      revenue: r.revenue,
    }))

    // ─── C. Renewal schedule from Google Sheets ───────────────────────────────
    const renewalByMonth = await fetchRenewalSchedule()

    // Current projection start = next calendar month
    const projStartYear = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear()
    const projStartMonth = now.getMonth() === 11 ? 1 : now.getMonth() + 2
    const projStartKey = `${projStartYear}-${String(projStartMonth).padStart(2, '0')}`

    // ─── C. Three scenario projections ───────────────────────────────────────
    const scenarioResults = {}
    for (const [key, scenario] of Object.entries(SCENARIOS)) {
      const result = runScenario(scenario, currentMRR, projStartKey, renewalByMonth)
      scenarioResults[key] = {
        ...scenario,
        ...result,
        // For 2027 stretch with roofing, compute a "w/ roofing" variant
        revenue2027WithRoofing: key === 'stretch' ? result.revenue2027 : null,
      }
    }

    // ─── D. Sensitivity matrix ────────────────────────────────────────────────
    const ytdActualsCash = ytdCash
    const sensitivity = buildSensitivityMatrix(currentMRR, ytdActualsCash, projStartKey, renewalByMonth)

    // ─── E. MRR Waterfall (trailing 12 months) ───────────────────────────────
    const mrrHistory = mrrHistoryRes.rows.reverse() // oldest first
    const mrrWaterfall = []
    for (let i = 0; i < mrrHistory.length; i++) {
      const row = mrrHistory[i]
      const prevRow = mrrHistory[i - 1]
      const beginMrr = prevRow ? Number(prevRow.mrr || 0) : Number(row.mrr || 0)
      const endMrr = Number(row.mrr || 0)
      const newCustsM = Number(row.newCustomers || 0)
      const churnedCustsM = Number(row.churnedCustomers || 0)
      const avgMrrM = Number(row.activeCustomers || 1) > 0 ? endMrr / Number(row.activeCustomers) : avgMrr
      const newMrrM = Math.round(newCustsM * avgMrrM)
      const churnedMrrM = Math.round(churnedCustsM * avgMrrM)

      mrrWaterfall.push({
        month: row.month_key,
        label: row.month_key ? row.month_key.replace(/^(\d{4})-0?(\d+)$/, (_, y, m) => `${MONTH_NAMES[Number(m) - 1]} ${y.slice(2)}`) : '',
        beginMrr: Math.round(beginMrr),
        newMrr: newMrrM,
        churnMrr: churnedMrrM,
        endMrr: Math.round(endMrr),
        netChange: Math.round(endMrr - beginMrr),
      })
    }

    // ─── F. Renewal pipeline by month (Jan–Dec 2026) ─────────────────────────
    const renewalPipeline = []
    for (let m = 1; m <= 12; m++) {
      const key = `2026-${String(m).padStart(2, '0')}`
      renewalPipeline.push({
        key,
        label: MONTH_NAMES[m - 1],
        mrr: Math.round(renewalByMonth[key] || 0),
        isPast: m < now.getMonth() + 1 || now.getFullYear() > 2026,
        isCurrent: m === now.getMonth() + 1 && now.getFullYear() === 2026,
      })
    }

    // ─── Build scenario summary table rows ───────────────────────────────────
    const scenarioTable = {
      rows: [
        { label: 'Churn Rate/mo', base: '2.5%', target: '1.8%', stretch: '1.5%' },
        { label: 'New Deals/mo', base: '11', target: '~14', stretch: '~18' },
        { label: 'Expansion MRR', base: '$0', target: '$3K', stretch: '$5K' },
        {
          label: 'Dec 2026 MRR',
          base: scenarioResults.base.dec2026Mrr,
          target: scenarioResults.target.dec2026Mrr,
          stretch: scenarioResults.stretch.dec2026Mrr,
          format: 'currency',
        },
        {
          label: '2026 Total Revenue (projected)',
          base: Math.round(ytdActualsCash + scenarioResults.base.revenue2026),
          target: Math.round(ytdActualsCash + scenarioResults.target.revenue2026),
          stretch: Math.round(ytdActualsCash + scenarioResults.stretch.revenue2026),
          format: 'currency',
        },
        {
          label: '2027 Total Revenue',
          base: scenarioResults.base.revenue2027,
          target: scenarioResults.target.revenue2027,
          stretch: scenarioResults.stretch.revenue2027,
          format: 'currency',
        },
        {
          label: '2027 w/ Roofing',
          base: null,
          target: null,
          stretch: scenarioResults.stretch.revenue2027,
          format: 'currency',
        },
      ],
    }

    return NextResponse.json({
      scoreboard: {
        mrr: currentMRR,
        ytdCash,
        onTrackFor,
        gapToTarget,
        quickRatio,
        churnCost,
        activeClients,
        daysElapsed,
        daysRemaining,
        daysToTarget,
        nrr,
      },
      monthlyActuals,
      scenarios: scenarioResults,
      scenarioTable,
      sensitivity,
      renewalPipeline,
      mrrWaterfall,
      keyMetrics: { nrr, quickRatio, daysToTarget, churnCost, currentMRR },
      meta: {
        projStartKey,
        currentMRR,
        ytdCash,
        annualTarget: ANNUAL_TARGET,
        monthlyTarget: MONTHLY_TARGET,
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Projections error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  } finally {
    dbClient.release()
  }
}
