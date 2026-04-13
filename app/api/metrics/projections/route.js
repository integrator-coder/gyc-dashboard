export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import pkg from 'pg'
const { Pool } = pkg

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const ANNUAL_TARGET = 4_200_000
const MONTHLY_TARGET = ANNUAL_TARGET / 12 // $350,000/mo

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
  const endMonth = '2027-12'
  const startParts = startMonth.split('-').map(Number)
  const endParts = endMonth.split('-').map(Number)
  const totalMonths =
    (endParts[0] - startParts[0]) * 12 + (endParts[1] - startParts[1]) + 1
  const months = monthsFrom(startMonth, totalMonths)

  let mrr = startMRR
  const points = []

  for (const key of months) {
    const rawRenewal = renewalByMonth[key] || 0
    const appliedRenewal = rawRenewal * scenario.renewalRate

    // Correct MRR calc: start MRR + new additions - churn loss
    const churnLoss = mrr * scenario.churnRate
    const newMrr = mrr + scenario.newMRRPerMonth + scenario.expansionMRR + appliedRenewal - churnLoss

    points.push({
      month: key,
      mrr: Math.round(newMrr),
      renewalMRR: Math.round(appliedRenewal),
    })

    mrr = newMrr
  }

  const points2026 = points.filter((p) => p.month >= startMonth && p.month <= '2026-12')
  const points2027 = points.filter((p) => p.month >= '2027-01' && p.month <= '2027-12')

  const dec2026Mrr = points2026.find((p) => p.month === '2026-12')?.mrr || 0
  const dec2027Mrr = points2027.find((p) => p.month === '2027-12')?.mrr || 0

  // Total revenue = MRR + new deal first payments + PIF cash (~6 PIFs/mo at $8,693 avg)
  const dealsPerMonth = scenario.newMRRPerMonth > 0 ? Math.round(scenario.newMRRPerMonth / 748) : 10
  const pifPerMonth = 6  // current GYC PIF pace
  const AVG_FP = 2039    // avg first payment per monthly deal
  const AVG_PIF = 8693   // avg PIF deal amount
  const monthlyNonMRR = (dealsPerMonth * AVG_FP) + (pifPerMonth * AVG_PIF)  // ~$72K/mo
  const revenue2026 = Math.round(points2026.reduce((s, p) => s + p.mrr + monthlyNonMRR, 0))
  const revenue2027 = Math.round(points2027.reduce((s, p) => s + p.mrr + monthlyNonMRR, 0))

  return { points, points2026, points2027, dec2026Mrr, dec2027Mrr, revenue2026, revenue2027 }
}

// ─── Unified Deal Mix Matrix (Bruce's design) ────────────────────────────────
function buildUnifiedMatrix(churnRate, currentMRR, ytdCash, avgDealMRR = 864) {
  const totalDealCounts = [8, 10, 12, 14, 16, 18]
  const mixColumns = [
    { label: 'All MRR', mrrFraction: 1.0 },
    { label: '8/2',     mrrFraction: 0.8 },
    { label: '6/4',     mrrFraction: 0.6 },
    { label: '5/5',     mrrFraction: 0.5 },
    { label: '4/6',     mrrFraction: 0.4 },
    { label: '2/8',     mrrFraction: 0.2 },
    { label: 'All PIF', mrrFraction: 0.0 },
  ]

  const AVG_MRR_PER_MRR_DEAL      = avgDealMRR
  const AVG_FIRST_PAYMENT_MRR_DEAL = 2039
  const AVG_PIF_AMOUNT             = 8693
  const MONTHS_REMAINING           = 8.63

  const matrix = totalDealCounts.map((totalDeals) =>
    mixColumns.map(({ mrrFraction }) => {
      const mrrDeals = Math.round(totalDeals * mrrFraction)
      const pifDeals = totalDeals - mrrDeals
      const newMRRPerMonth = mrrDeals * AVG_MRR_PER_MRR_DEAL
      let mrr = currentMRR
      let revRemaining = 0
      for (let m = 0; m < 9; m++) {
        mrr = mrr + newMRRPerMonth - mrr * churnRate
        revRemaining += mrr
      }
      const monthlyCash = mrrDeals * AVG_FIRST_PAYMENT_MRR_DEAL * MONTHS_REMAINING
      const pifCash     = pifDeals * AVG_PIF_AMOUNT * MONTHS_REMAINING
      return Math.round(ytdCash + revRemaining + monthlyCash + pifCash)
    })
  )

  return {
    totalDealCounts,
    mixColumns,
    churnRate,
    matrix,
    avgDealStats: { avgDealMRR: AVG_MRR_PER_MRR_DEAL, avgPifAmount: AVG_PIF_AMOUNT, avgFirstPayment: AVG_FIRST_PAYMENT_MRR_DEAL },
  }
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
    const [metricsRes, activeClientsRes, ytdRes, monthlyActualsRes, dealMrrRes] =
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
        // Live avg deal MRR: PIF deals use renewalAmount, monthly deals use mrr
        dbClient.query(`
          SELECT
            AVG(CASE WHEN pif = true THEN "renewalAmount" ELSE mrr END)::float AS avg_deal_mrr,
            AVG("firstPayment")::float AS avg_first_payment,
            COUNT(*) AS deal_count,
            SUM(CASE WHEN pif = true THEN "renewalAmount" ELSE mrr END)::float AS total_deal_mrr
          FROM "SalesDeal"
          WHERE "tenantId" = 'gyc'
            AND "dealDate" >= '2025-01-01' AND "dealDate" < '2026-01-01'
            AND (mrr > 0 OR "renewalAmount" > 0)
        `),
      ])

    const latestMetrics = metricsRes.rows[0] || {}
    const previousMetrics = metricsRes.rows[1] || {}
    const activeClients = Number(activeClientsRes.rows[0]?.cnt || 0)
    const ytdCash = Number(ytdRes.rows[0]?.ytd_cash || 0)
    const currentMRR = Number(latestMetrics.mrr || 213334)

    // Live avg deal MRR (fallback to 2025 hardcoded values if query fails)
    const dealMrrRow = dealMrrRes.rows[0] || {}
    const AVG_DEAL_MRR = Math.round(Number(dealMrrRow.avg_deal_mrr) || 748)
    const AVG_DEAL_FIRST_PAYMENT = Math.round(Number(dealMrrRow.avg_first_payment) || 2039)
    const DEAL_COUNT_2025 = Number(dealMrrRow.deal_count) || 0

    // ─── Build scenarios dynamically using live avgDealMRR ────────────────────
    const scenarios = {
      base: {
        label: 'Base Case',
        description: 'Current pace — 10 deals/month, 2.5% churn, no GA expansion.',
        churnRate: 0.025,
        newMRRPerMonth: 10 * AVG_DEAL_MRR,
        expansionMRR: 0,
        renewalRate: 1.0,
        color: '#731494',
      },
      jesse: {
        label: 'Jesse Hits 15 Deals/Month',
        description: 'Lead flow restored by May. Jesse at 15 deals/month. 2% churn.',
        churnRate: 0.020,
        newMRRPerMonth: 15 * AVG_DEAL_MRR,
        expansionMRR: 0,
        renewalRate: 1.0,
        color: '#C19C46',
      },
      full: {
        label: 'Jesse + GA Upsells',
        description: 'Jesse at 15/month + GAs adding $4,500/month expansion MRR. 1.8% churn.',
        churnRate: 0.018,
        newMRRPerMonth: 15 * AVG_DEAL_MRR,
        expansionMRR: 4500,
        renewalRate: 1.0,
        color: '#340B67',
      },
    }

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

    // NRR approximation
    const prevMrr = Number(previousMetrics.mrr || currentMRR)
    const nrr = prevMrr > 0 ? Math.round((currentMRR / prevMrr) * 100) : 100

    // ─── Monthly revenue decomposition ───────────────────────────────────────
    const avgDealsPerMonth = 10  // base assumption
    const avgFirstPayment = 2039
    const avgPIFPerMonth = 6
    const avgPIFAmount = 8693
    const monthlyRevenue = {
      mrrComponent: currentMRR,
      firstPaymentComponent: avgDealsPerMonth * avgFirstPayment,
      pifCashComponent: avgPIFPerMonth * avgPIFAmount,
      totalMonthlyRevenue: currentMRR + (avgDealsPerMonth * avgFirstPayment) + (avgPIFPerMonth * avgPIFAmount),
      totalAnnualized: (currentMRR + (avgDealsPerMonth * avgFirstPayment) + (avgPIFPerMonth * avgPIFAmount)) * 12,
    }

    // ─── B. Monthly Actuals ───────────────────────────────────────────────────
    const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const monthlyActuals = monthlyActualsRes.rows.map((r) => ({
      key: `${r.year}-${String(r.month).padStart(2, '0')}`,
      label: `${MONTH_NAMES[r.month - 1]} ${String(r.year).slice(2)}`,
      year: r.year,
      month: r.month,
      revenue: r.revenue,
    }))

    // ─── C. Renewal schedule from DB (same source as New Business dashboard) ──
    const { rows: renewalRows } = await dbClient.query(`
      SELECT
        to_char("dealDate"::date + (term * interval '1 month'), 'YYYY-MM') as renewal_month,
        SUM("renewalAmount") as renewal_mrr
      FROM "SalesDeal"
      WHERE "tenantId" = 'gyc'
        AND "renewalAmount" > 0
      GROUP BY 1
      ORDER BY 1
    `)
    const renewalByMonth = {}
    renewalRows.forEach(r => { renewalByMonth[r.renewal_month] = parseFloat(r.renewal_mrr) })

    // Current projection start = next calendar month
    const projStartYear = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear()
    const projStartMonth = now.getMonth() === 11 ? 1 : now.getMonth() + 2
    const projStartKey = `${projStartYear}-${String(projStartMonth).padStart(2, '0')}`

    // ─── D. Three scenario projections ───────────────────────────────────────
    const scenarioResults = {}
    for (const [key, scenario] of Object.entries(scenarios)) {
      const result = runScenario(scenario, currentMRR, projStartKey, renewalByMonth)
      scenarioResults[key] = {
        ...scenario,
        ...result,
      }
    }

    // ─── E. Unified deal mix matrices (4 churn rates) ─────────────────────────
    const unifiedMatrix_2  = buildUnifiedMatrix(0.020, currentMRR, ytdCash, AVG_DEAL_MRR)
    const unifiedMatrix_25 = buildUnifiedMatrix(0.025, currentMRR, ytdCash, AVG_DEAL_MRR)
    const unifiedMatrix_3  = buildUnifiedMatrix(0.030, currentMRR, ytdCash, AVG_DEAL_MRR)
    const unifiedMatrix_4  = buildUnifiedMatrix(0.040, currentMRR, ytdCash, AVG_DEAL_MRR)

    // ─── F. Forward MRR Bridge (6-month forward projection, Base Case) ─────────
    const BASE_SCENARIO = scenarios.base
    const bridgeMonths = ['May 26','Jun 26','Jul 26','Aug 26','Sep 26','Oct 26']
    const bridgeKeys =   ['2026-05','2026-06','2026-07','2026-08','2026-09','2026-10']
    const forwardMrrBridge = []
    let mrrBridgeCurrent = currentMRR

    for (let i = 0; i < 6; i++) {
      const beginMrr = mrrBridgeCurrent
      const newMrr = BASE_SCENARIO.newMRRPerMonth
      const renewalMrr = Math.round((renewalByMonth[bridgeKeys[i]] || 0) * BASE_SCENARIO.renewalRate)
      const churnMrr = Math.round(mrrBridgeCurrent * BASE_SCENARIO.churnRate)
      const endMrr = Math.round(beginMrr + newMrr + renewalMrr - churnMrr)

      forwardMrrBridge.push({
        month: bridgeKeys[i],
        label: bridgeMonths[i],
        beginMrr: Math.round(beginMrr),
        newMrr,
        renewalMrr,
        churnMrr: -churnMrr,
        churnMrrAbs: churnMrr,
        netChange: endMrr - Math.round(beginMrr),
        endMrr,
      })

      mrrBridgeCurrent = endMrr
    }

    // ─── G. Renewal pipeline by month (rolling 12-month forward window) ────────
    const today = new Date()
    const pipelineStart = today.toISOString().slice(0, 7) // current month YYYY-MM
    const pipelineEndDate = new Date(today)
    pipelineEndDate.setMonth(pipelineEndDate.getMonth() + 12)
    const pipelineEnd = pipelineEndDate.toISOString().slice(0, 7)
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    const [psYear, psMonth] = pipelineStart.split('-').map(Number)
    const [peYear, peMonth] = pipelineEnd.split('-').map(Number)
    const pipelineMonthCount = (peYear - psYear) * 12 + (peMonth - psMonth) + 1

    const renewalPipeline = monthsFrom(pipelineStart, pipelineMonthCount).map((key) => {
      const [y, m] = key.split('-').map(Number)
      return {
        key,
        label: `${MONTH_NAMES[m - 1]} ${String(y).slice(2)}`,
        mrr: Math.round(renewalByMonth[key] || 0),
        isPast: key < thisMonthKey,
        isCurrent: key === thisMonthKey,
      }
    })

    // ─── Build scenario summary table rows ───────────────────────────────────
    const scenarioTable = {
      rows: [
        { label: 'Churn Rate/mo', base: '2.5%', jesse: '2.0%', full: '1.8%' },
        { label: 'New Deals/mo', base: '10', jesse: '15', full: '15' },
        { label: 'Expansion MRR', base: '$0', jesse: '$0', full: '$4,500' },
        {
          label: 'Dec 2026 MRR',
          base: scenarioResults.base.dec2026Mrr,
          jesse: scenarioResults.jesse.dec2026Mrr,
          full: scenarioResults.full.dec2026Mrr,
          format: 'currency',
        },
        {
          label: '2026 Total Revenue (projected)',
          base: Math.round(ytdCash + scenarioResults.base.revenue2026),
          jesse: Math.round(ytdCash + scenarioResults.jesse.revenue2026),
          full: Math.round(ytdCash + scenarioResults.full.revenue2026),
          format: 'currency',
        },
        {
          label: '2027 Total Revenue',
          base: scenarioResults.base.revenue2027,
          jesse: scenarioResults.jesse.revenue2027,
          full: scenarioResults.full.revenue2027,
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
        monthlyRevenue,
      },
      monthlyActuals,
      scenarios: scenarioResults,
      scenarioTable,
      renewalPipeline,
      forwardMrrBridge,
      unifiedMatrix_2,
      unifiedMatrix_25,
      unifiedMatrix_3,
      unifiedMatrix_4,
      avgDealStats: { avgDealMRR: AVG_DEAL_MRR, avgFirstPayment: AVG_DEAL_FIRST_PAYMENT, dealCount: DEAL_COUNT_2025 },
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
