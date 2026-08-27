export const dynamic = 'force-dynamic'


import { createGoogleAuth, SHEETS_READONLY } from '@/lib/google-auth'
import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import pkg from 'pg'
const { Pool } = pkg

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const SHEET_ID = '1858s3B0oQ8YC4KEBDefJMc0WuD5nyjNIFxiQrqsuO-A'

const MONTH_ORDER = ['January','February','March','April','May','June','July','August','September','October','November','December']

const auth = createGoogleAuth(['https://www.googleapis.com/auth/spreadsheets.readonly'])

async function readTab(sheets, tab, range) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${tab}!${range}`,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING'
  })
  return res.data.values || []
}

const REP_ALIASES = {
  'Seb': 'Sebastian',
  'seb': 'Sebastian',
  'Sebastian': 'Sebastian',
  'Zu/Bruce': 'Zu',
  'Zu / Bruce': 'Zu',
  'Zu/Seb': 'Zu',
  'Zu / Seb': 'Zu',
  'zu': 'Zu',
  'jesse': 'Jesse',
  'briana': 'Briana',
  'jc': 'JC',
  'pia': 'Pia',
  'stefen': 'Stefen',
  'todd': 'Todd',
  'travis': 'Travis',
  'lex': 'Lex',
  'kim': 'Kim',
  'matt': 'Matt',
}

const SALES_REPS = new Set(['Jesse', 'Pia', 'Briana', 'Matt', 'Lex'])  // Kept for historical attribution. Active sales: Jesse only. Briana now GA. Pia starting.
const UPSELL_REPS = new Set(['JC', 'Zu', 'Stefen', 'Todd', 'Travis', 'Kim'])

function normaliseRep(raw) {
  if (!raw) return 'Unknown'
  const trimmed = raw.trim()
  return REP_ALIASES[trimmed] || REP_ALIASES[trimmed.toLowerCase()] || trimmed
}

function classifyDealType(rep, year) {
  // Year-specific rule from Todd: Sebastian = Sales in 2025, Upsell in 2026+
  if (rep === 'Sebastian') return Number(year) >= 2026 ? 'Upsell' : 'Sales'

  if (SALES_REPS.has(rep)) return 'Sales'
  if (UPSELL_REPS.has(rep)) return 'Upsell'
  return 'Unclassified'
}

// Resolve column indices by matching header names, so the parser survives
// column reorders / inserted columns and does NOT depend on fixed positions.
// (Root cause of the 2026 breakage: the 2026 tab inserted an "Old MRR" column
// and renamed Service, shifting every downstream field vs the 2025 layout.)
function buildColMap(headerRow) {
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const idx = {}
  ;(headerRow || []).forEach((h, i) => {
    const key = norm(h)
    if (key && !(key in idx)) idx[key] = i
  })
  // Return an index for the first header alias that matches, else -1.
  const find = (...aliases) => {
    for (const a of aliases) {
      const k = norm(a)
      if (k in idx) return idx[k]
    }
    return -1
  }
  return {
    client:       find('Client'),
    name:         find('Client Name'),
    service:      find('Service(s)', 'New Service', 'Service'),
    quarter:      find('Quarter'),
    month:        find('Month'),
    date:         find('Date of Sale', 'Date'),
    firstPayment: find('First Payment'),
    mrr:          find('MRR'),
    term:         find('Term'),
    fullTerm:     find('Full Term Amount', 'Full Term'),
    firstYear:    find('First Year Amount', 'First Year'),
    pif:          find('PiF?', 'PIF', 'Pif'),
    renewalAmount: find('Renewal Amount', 'Renewal'),
    rep:          find('Sales Person', 'Salesperson', 'Rep'),
  }
}

function parseDeals(rows, yearLabel) {
  const col = buildColMap(rows[0] || [])
  // Safe accessor: returns undefined when a column wasn't found (index -1).
  const get = (r, key) => (col[key] >= 0 ? r[col[key]] : undefined)
  return rows.slice(1).filter(r => get(r, 'date')).map(r => {
    const rep = normaliseRep(get(r, 'rep'))
    const year = Number(yearLabel) || new Date(get(r, 'date')).getFullYear()
    return {
      client:       get(r, 'client')  || '',
      name:         get(r, 'name')    || '',
      service:      get(r, 'service') || '',
      quarter:      get(r, 'quarter') || '',
      month:        get(r, 'month')   || '',
      date:         get(r, 'date')    || '',
      firstPayment: Number(get(r, 'firstPayment')) || 0,
      mrr:          Number(get(r, 'mrr'))          || 0,
      term:         Number(get(r, 'term'))         || 0,
      fullTerm:     Number(get(r, 'fullTerm'))     || 0,
      firstYear:    Number(get(r, 'firstYear'))    || 0,
      pif:          (get(r, 'pif') || '').toString().trim().toUpperCase() === 'Y',
      renewalAmount: Number(get(r, 'renewalAmount')) || 0,
      rep,
      year,
      dealType: classifyDealType(rep, year),
    }
  })
}

function summariseByMonth(deals) {
  const byMonth = {}
  for (const d of deals) {
    if (!byMonth[d.month]) byMonth[d.month] = {
      firstPayment: 0, mrr: 0, count: 0, fullTerm: 0,
      pifFP: 0, pifCount: 0, pifFullTerm: 0,
      recurFP: 0, recurCount: 0, recurFullTerm: 0
    }
    const m = byMonth[d.month]
    m.firstPayment += d.firstPayment
    m.fullTerm += d.fullTerm
    m.mrr += d.mrr
    m.count++
    if (d.pif) { m.pifFP += d.firstPayment; m.pifCount++; m.pifFullTerm += d.fullTerm }
    else        { m.recurFP += d.firstPayment; m.recurCount++; m.recurFullTerm += d.fullTerm }
  }
  return byMonth
}

// ─── Commission Tier Logic ────────────────────────────────────────────────────

const COMMISSION_TIERS = {
  website: [
    { min: 1,  max: 9,        rate: 0.06  },
    { min: 10, max: 14,       rate: 0.065 },
    { min: 15, max: 19,       rate: 0.075 },
    { min: 20, max: 24,       rate: 0.085 },
    { min: 25, max: Infinity, rate: 0.095 },
  ],
  blueprint: [
    { min: 1,  max: 9,        rate: 0.04  },
    { min: 10, max: 14,       rate: 0.045 },
    { min: 15, max: 19,       rate: 0.055 },
    { min: 20, max: Infinity, rate: 0.065 },
  ],
  seo: [
    // Combined SEO Core + Advanced until sheet differentiates Core vs Advanced
    // Using SEO Core rates (4/4.5/5.5/6.5%) as default
    { min: 1,  max: 9,        rate: 0.04  },
    { min: 10, max: 14,       rate: 0.045 },
    { min: 15, max: 19,       rate: 0.055 },
    { min: 20, max: Infinity, rate: 0.065 },
  ],
}

function parseServiceTypes(service) {
  const s = (service || '').toLowerCase()
  const types = []
  if (s.includes('web') && !s.includes('webinar')) types.push('website')
  if (s.includes('blueprint'))                       types.push('blueprint')
  if (s.includes('seo'))                             types.push('seo')
  return types
}

function getCurrentTier(tiers, count) {
  if (count === 0) return null
  return tiers.find(t => count >= t.min && count <= t.max) || null
}

function getNextTier(tiers, count) {
  return tiers.find(t => t.min > count) || null
}

function buildCommissionTracker(deals, currentMonth) {
  const monthDeals = deals.filter(d => d.month === currentMonth)

  // Per rep, per product: count + total first payment value
  const tracker = {}

  for (const deal of monthDeals) {
    const rep = deal.rep
    if (!tracker[rep]) tracker[rep] = {}

    const types = parseServiceTypes(deal.service)
    for (const type of types) {
      if (!tracker[rep][type]) tracker[rep][type] = { count: 0, totalValue: 0 }
      tracker[rep][type].count++
      tracker[rep][type].totalValue += deal.firstPayment
    }
  }

  // Build output per rep
  const result = {}
  for (const [rep, products] of Object.entries(tracker)) {
    result[rep] = {}
    for (const [product, data] of Object.entries(products)) {
      const tiers = COMMISSION_TIERS[product]
      if (!tiers) continue

      const { count, totalValue } = data
      const current = getCurrentTier(tiers, count)
      const next    = getNextTier(tiers, count)

      const currentRate  = current?.rate || 0
      const nextRate     = next?.rate    || null
      const dealsToNext  = next ? next.min - count : null
      // Retroactive gain = difference in rate applied to ALL this month's deals
      const retroGain    = (nextRate && totalValue > 0)
        ? totalValue * (nextRate - currentRate)
        : null

      result[rep][product] = {
        count,
        totalValue,
        currentTier: current ? `Tier ${tiers.indexOf(current) + 1}` : null,
        currentRate,
        currentRatePct: currentRate ? `${(currentRate * 100).toFixed(1)}%` : '0%',
        nextRate,
        nextRatePct: nextRate ? `${(nextRate * 100).toFixed(1)}%` : null,
        dealsToNext,
        retroactiveGain: retroGain,
        maxTier: !next,
      }
    }
  }

  return result
}

function summariseByRep(deals) {
  const byRep = {}
  for (const d of deals) {
    const rep = d.rep
    if (!byRep[rep]) byRep[rep] = { firstPayment: 0, fullTerm: 0, count: 0 }
    byRep[rep].firstPayment += d.firstPayment
    byRep[rep].fullTerm += d.fullTerm
    byRep[rep].count++
  }
  return byRep
}

function summariseByDealType(deals) {
  const out = {
    Sales: { count: 0, firstPayment: 0, mrr: 0, pifCount: 0, monthlyCount: 0 },
    Upsell: { count: 0, firstPayment: 0, mrr: 0, pifCount: 0, monthlyCount: 0 },
    Unclassified: { count: 0, firstPayment: 0, mrr: 0, pifCount: 0, monthlyCount: 0 },
  }

  for (const d of deals) {
    const type = d.dealType || 'Unclassified'
    if (!out[type]) out[type] = { count: 0, firstPayment: 0, mrr: 0, pifCount: 0, monthlyCount: 0 }
    out[type].count++
    out[type].firstPayment += d.firstPayment || 0
    out[type].mrr += d.mrr || 0
    if (d.pif) out[type].pifCount++
    else out[type].monthlyCount++
  }

  return out
}

function summariseDealTypeByMonth(deals) {
  const out = MONTH_ORDER.map((m) => ({
    month: m.slice(0, 3),
    salesFP: 0,
    upsellFP: 0,
    unclassifiedFP: 0,
    salesCount: 0,
    upsellCount: 0,
    unclassifiedCount: 0,
  }))

  const idx = Object.fromEntries(MONTH_ORDER.map((m, i) => [m, i]))

  for (const d of deals) {
    const i = idx[d.month]
    if (i == null) continue
    const type = d.dealType || 'Unclassified'
    if (type === 'Sales') {
      out[i].salesFP += d.firstPayment || 0
      out[i].salesCount += 1
    } else if (type === 'Upsell') {
      out[i].upsellFP += d.firstPayment || 0
      out[i].upsellCount += 1
    } else {
      out[i].unclassifiedFP += d.firstPayment || 0
      out[i].unclassifiedCount += 1
    }
  }

  return out.filter((r) => (r.salesCount + r.upsellCount + r.unclassifiedCount) > 0)
}

function summariseServiceByDealType(deals) {
  const out = {}
  for (const d of deals) {
    const service = d.service || 'Unknown'
    const type = d.dealType || 'Unclassified'
    if (!out[service]) {
      out[service] = {
        service,
        salesFP: 0,
        upsellFP: 0,
        unclassifiedFP: 0,
        salesDeals: 0,
        upsellDeals: 0,
        unclassifiedDeals: 0,
      }
    }
    if (type === 'Sales') {
      out[service].salesFP += d.firstPayment || 0
      out[service].salesDeals += 1
    } else if (type === 'Upsell') {
      out[service].upsellFP += d.firstPayment || 0
      out[service].upsellDeals += 1
    } else {
      out[service].unclassifiedFP += d.firstPayment || 0
      out[service].unclassifiedDeals += 1
    }
  }

  return Object.values(out)
    .map((r) => ({ ...r, totalFP: r.salesFP + r.upsellFP + r.unclassifiedFP }))
    .sort((a, b) => b.totalFP - a.totalFP)
}

export async function getNewBusinessMetrics() {
    const client = await auth.getClient()
    const sheets = google.sheets({ version: 'v4', auth: client })

    const [rows26, rows25] = await Promise.all([
      readTab(sheets, '2026 Details', 'A1:R200'),
      readTab(sheets, '2025 Details', 'A1:R400'),
    ])

    const deals26 = parseDeals(rows26, 2026)
    const deals25 = parseDeals(rows25, 2025)

    const now = new Date()
    const currentMonth = MONTH_ORDER[now.getMonth()]

    // Monthly summaries
    const monthly26 = summariseByMonth(deals26)
    const monthly25 = summariseByMonth(deals25)

    // YoY chart data — side-by-side for all 12 months
    const monthlyComparison = MONTH_ORDER.map(m => ({
      month: m.slice(0, 3),
      '2026': monthly26[m]?.firstPayment || 0,
      '2025': monthly25[m]?.firstPayment || 0,
      fullTerm26: monthly26[m]?.fullTerm || 0,
      fullTerm25: monthly25[m]?.fullTerm || 0,
      count26: monthly26[m]?.count || 0,
      count25: monthly25[m]?.count || 0,
      mrr26: monthly26[m]?.mrr || 0,
      mrr25: monthly25[m]?.mrr || 0,
      pif26: monthly26[m]?.pifFP || 0,
      recur26: monthly26[m]?.recurFP || 0,
      pif25: monthly25[m]?.pifFP || 0,
      recur25: monthly25[m]?.recurFP || 0,
    }))

    // Rep leaderboards
    const thisMonthDeals26 = deals26.filter(d => d.month === currentMonth)
    const repYTD = summariseByRep(deals26)
    const repThisMonth = summariseByRep(thisMonthDeals26)

    // PIF leaderboards
    const pifDeals26YTD = deals26.filter(d => d.pif)
    const pifDeals26Month = thisMonthDeals26.filter(d => d.pif)
    const repPifYTD = summariseByRep(pifDeals26YTD)
    const repPifMonth = summariseByRep(pifDeals26Month)

    // Renewal projections — sourced from SalesDeal DB (uses corrected terms, not raw sheet data)
    // term=1 in DB = 12 months (PIF annual); term=6 or 12 = months as stated
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,'0')}`
    const renewalByMonth = {}
    const missingRenewal = []

    // Query DB for PIF deals with renewalAmount set (the projection data)
    const [renewalRes, missingRes, mrrMetricsRes, mrrHistoryRes, dailyRevRes] = await Promise.all([
      pool.query(`
        SELECT
          to_char("dealDate"::date + (
            CASE WHEN term::numeric = 1 THEN 12 ELSE term::numeric END
          ) * INTERVAL '1 month', 'YYYY-MM') AS renewal_month,
          to_char("dealDate"::date + (
            CASE WHEN term::numeric = 1 THEN 12 ELSE term::numeric END
          ) * INTERVAL '1 month', 'FMMonth YYYY') AS renewal_label,
          SUM("renewalAmount"::numeric) AS renewal_mrr,
          COUNT(*) AS deal_count,
          json_agg(json_build_object(
            'name', "clientName",
            'renewal', "renewalAmount"::numeric,
            'rep', rep
          )) AS deals
        FROM "SalesDeal"
        WHERE "tenantId" = 'gyc'
          AND pif = true
          AND "renewalAmount" IS NOT NULL
          AND "renewalAmount"::numeric > 0
          AND "dealDate" IS NOT NULL
          AND term IS NOT NULL
          AND term::numeric > 0
        GROUP BY 1, 2
        ORDER BY 1
      `),
      pool.query(`
        SELECT
          "clientName" AS name,
          service,
          "firstPayment"::numeric AS fp,
          "dealDate"::text AS date,
          rep,
          to_char("dealDate"::date + (
            CASE WHEN term::numeric = 1 THEN 12 ELSE term::numeric END
          ) * INTERVAL '1 month', 'YYYY-MM') AS renewal_month_key,
          to_char("dealDate"::date + (
            CASE WHEN term::numeric = 1 THEN 12 ELSE term::numeric END
          ) * INTERVAL '1 month', 'FMMonth YYYY') AS renewal_month_label
        FROM "SalesDeal"
        WHERE "tenantId" = 'gyc'
          AND pif = true
          AND ("renewalAmount" IS NULL OR "renewalAmount"::numeric = 0)
          AND "dealDate" IS NOT NULL
          AND term IS NOT NULL
          AND term::numeric > 0
        ORDER BY renewal_month_key
      `),
      pool.query(`SELECT mrr FROM "StripeMetrics" ORDER BY "syncedAt" DESC LIMIT 1`),
      pool.query(`SELECT month, mrr::numeric AS mrr FROM "MRRHistory" WHERE "tenantId" = 'gyc' ORDER BY month DESC LIMIT 12`),
      pool.query(`
        SELECT to_char(date::date, 'YYYY-MM') AS month, SUM(amount) AS mrr
        FROM "DailyRevenue"
        WHERE "tenantId" = 'gyc'
        GROUP BY 1 ORDER BY 1 DESC LIMIT 15
      `),
    ])

    for (const row of renewalRes.rows) {
      renewalByMonth[row.renewal_month] = {
        label: row.renewal_label,
        mrr: parseFloat(row.renewal_mrr),
        count: parseInt(row.deal_count),
        deals: row.deals || [],
      }
    }

    for (const row of missingRes.rows) {
      if (row.renewal_month_key >= todayKey) {
        missingRenewal.push({
          name: row.name,
          service: row.service,
          fp: parseFloat(row.fp || 0),
          date: row.date,
          rep: row.rep,
          renewalMonth: row.renewal_month_label,
        })
      }
    }

    const renewalProjection = Object.entries(renewalByMonth)
      .filter(([key]) => key >= todayKey)   // only current + future months
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, val]) => ({ key, ...val }))

    // ─── MRR Growth Projection ────────────────────────────────────────────────────
    const MONTH_LABELS_SHORT = {
      '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
      '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug',
      '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec'
    }

    const currentMRR = parseFloat(mrrMetricsRes.rows[0]?.mrr || 0)
    const PROJECTION_START_MRR = 230354  // Fixed starting MRR for projection baseline

    // Build historical MRR for last 12 months: MRRHistory primary, DailyRevenue fallback
    const mrrHistoryByMonth = {}
    for (const r of mrrHistoryRes.rows) {
      mrrHistoryByMonth[r.month] = parseFloat(r.mrr)
    }
    const dailyRevByMonth = {}
    for (const r of dailyRevRes.rows) {
      dailyRevByMonth[r.month] = parseFloat(r.mrr)
    }
    const historical = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const yr = d.getFullYear()
      const mo = String(d.getMonth() + 1).padStart(2, '0')
      const key = `${yr}-${mo}`
      const mrr = mrrHistoryByMonth[key] ?? dailyRevByMonth[key] ?? 0
      historical.push({
        month: key,
        label: `${MONTH_LABELS_SHORT[mo]} ${String(yr).slice(2)}`,
        mrr,
        type: 'actual'
      })
    }

    // Build 13 future months starting from next month (Aug 2026 → Aug 2027)
    const CHURN_RATES = [0, 0.03, 0.05, 0.08]
    const futureMonths = []
    for (let i = 1; i <= 13; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const yr = d.getFullYear()
      const mo = String(d.getMonth() + 1).padStart(2, '0')
      futureMonths.push({ i, key: `${yr}-${mo}`, label: `${MONTH_LABELS_SHORT[mo]} ${String(yr).slice(2)}` })
    }

    const projected = futureMonths.map(({ i, key, label }) => {
      const renewalThisMonth = renewalByMonth[key]?.mrr || 0
      const scenarios = {}
      for (const rate of CHURN_RATES) {
        const rateKey = String(Math.round(rate * 100))
        const base = Math.round(PROJECTION_START_MRR * Math.pow(1 - rate, i))
        let priorRenewals = 0
        for (let j = 1; j < i; j++) {
          const prevRenewal = renewalByMonth[futureMonths[j - 1].key]?.mrr || 0
          priorRenewals += prevRenewal * Math.pow(1 - rate, i - j)
        }
        scenarios[rateKey] = {
          base,
          priorRenewals: Math.round(priorRenewals),
          thisMonthRenewal: Math.round(renewalThisMonth),
          total: Math.round(base + priorRenewals + renewalThisMonth)
        }
      }
      return { month: key, label, renewalThisMonth: Math.round(renewalThisMonth), scenarios }
    })

    const mrrProjection = { currentMRR, projectionStartMRR: PROJECTION_START_MRR, historical, projected }
    // ─── End MRR Growth Projection ────────────────────────────────────────────────

    // PIF vs Recurring stats
    const pifDeals26  = deals26.filter(d => d.pif)
    const recurDeals26 = deals26.filter(d => !d.pif)
    const pifDeals25  = deals25.filter(d => d.pif)
    const recurDeals25 = deals25.filter(d => !d.pif)
    const pifFP26  = pifDeals26.reduce((s, d) => s + d.firstPayment, 0)
    const recurFP26 = recurDeals26.reduce((s, d) => s + d.firstPayment, 0)
    const pifFP25  = pifDeals25.reduce((s, d) => s + d.firstPayment, 0)
    const recurFP25 = recurDeals25.reduce((s, d) => s + d.firstPayment, 0)

    // MRR stats
    const ytdMRR26 = deals26.reduce((s, d) => s + d.mrr, 0)
    const ytdMRR25 = deals25.reduce((s, d) => s + d.mrr, 0)
    const thisMonthMRR26 = deals26.filter(d => d.month === currentMonth).reduce((s, d) => s + d.mrr, 0)

    // YTD totals
    const ytdFP = deals26.reduce((s, d) => s + d.firstPayment, 0)
    const ytdCount = deals26.length
    const ytdAvgDeal = ytdCount > 0 ? ytdFP / ytdCount : 0

    // Quarter definitions (fixed)
    const Q1_MONTHS = MONTH_ORDER.slice(0, 3)   // Jan-Mar
    const Q2_MONTHS = MONTH_ORDER.slice(3, 6)   // Apr-Jun  
    const Q3_MONTHS = MONTH_ORDER.slice(6, 9)   // Jul-Sep
    const Q4_MONTHS = MONTH_ORDER.slice(9, 12)  // Oct-Dec

    // YTD = Jan through current month (same month count for both years for fair comparison)
    const ytdMonths = MONTH_ORDER.slice(0, now.getMonth() + 1)

    // Q1 2026 vs Q1 2025 (Jan-Mar fixed)
    const q1Deals26 = deals26.filter(d => Q1_MONTHS.includes(d.month))
    const q1Deals25 = deals25.filter(d => Q1_MONTHS.includes(d.month))
    const q1FP26    = q1Deals26.reduce((s,d) => s + d.firstPayment, 0)
    const q1FP25    = q1Deals25.reduce((s,d) => s + d.firstPayment, 0)
    const q1FT26    = q1Deals26.reduce((s,d) => s + d.fullTerm, 0)
    const q1FT25    = q1Deals25.reduce((s,d) => s + d.fullTerm, 0)
    const q1Count26 = q1Deals26.length
    const q1Count25 = q1Deals25.length
    const q1YoYFP   = q1FP25 > 0 ? ((q1FP26 - q1FP25) / q1FP25) * 100 : null
    const q1YoYFT   = q1FT25 > 0 ? ((q1FT26 - q1FT25) / q1FT25) * 100 : null

    // Q2 2026 vs Q2 2025 (Apr-Jun fixed)
    const q2Deals26 = deals26.filter(d => Q2_MONTHS.includes(d.month))
    const q2Deals25 = deals25.filter(d => Q2_MONTHS.includes(d.month))
    const q2FP26    = q2Deals26.reduce((s,d) => s + d.firstPayment, 0)
    const q2FP25    = q2Deals25.reduce((s,d) => s + d.firstPayment, 0)
    const q2FT26    = q2Deals26.reduce((s,d) => s + d.fullTerm, 0)
    const q2FT25    = q2Deals25.reduce((s,d) => s + d.fullTerm, 0)
    const q2Count26 = q2Deals26.length
    const q2Count25 = q2Deals25.length
    const q2YoYFP   = q2FP25 > 0 ? ((q2FP26 - q2FP25) / q2FP25) * 100 : null
    const q2YoYFT   = q2FT25 > 0 ? ((q2FT26 - q2FT25) / q2FT25) * 100 : null

    // Q3 2026 vs Q3 2025 (Jul-Sep fixed)
    const q3Deals26 = deals26.filter(d => Q3_MONTHS.includes(d.month))
    const q3Deals25 = deals25.filter(d => Q3_MONTHS.includes(d.month))
    const q3FP26    = q3Deals26.reduce((s,d) => s + d.firstPayment, 0)
    const q3FP25    = q3Deals25.reduce((s,d) => s + d.firstPayment, 0)
    const q3FT26    = q3Deals26.reduce((s,d) => s + d.fullTerm, 0)
    const q3FT25    = q3Deals25.reduce((s,d) => s + d.fullTerm, 0)
    const q3Count26 = q3Deals26.length
    const q3Count25 = q3Deals25.length
    const q3YoYFP   = q3FP25 > 0 ? ((q3FP26 - q3FP25) / q3FP25) * 100 : null
    const q3YoYFT   = q3FT25 > 0 ? ((q3FT26 - q3FT25) / q3FT25) * 100 : null

    // Full Term YTD
    const ytdFullTerm = deals26.reduce((s, d) => s + d.fullTerm, 0)

    // YTD 2026 vs YTD 2025 (Jan through current month)
    const ytdDeals25FairComp = deals25.filter(d => ytdMonths.includes(d.month))
    const ytdFP25      = ytdDeals25FairComp.reduce((s,d) => s + d.firstPayment, 0)
    const ytdFT25      = ytdDeals25FairComp.reduce((s,d) => s + d.fullTerm, 0)
    const ytdCount25   = ytdDeals25FairComp.length
    const ytdYoYFP     = ytdFP25 > 0 ? ((ytdFP - ytdFP25) / ytdFP25) * 100 : null
    const ytdYoYFT     = ytdFT25 > 0 ? ((ytdFullTerm - ytdFT25) / ytdFT25) * 100 : null

    // This month
    const thisMonthFP = monthly26[currentMonth]?.firstPayment || 0
    const thisMonthCount = monthly26[currentMonth]?.count || 0

    // Recent deals (last 10)
    const recent = [...deals26]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10)

    const commissionTracker = buildCommissionTracker(deals26, currentMonth)

    const splitYTD26 = summariseByDealType(deals26)
    const splitThisMonth26 = summariseByDealType(thisMonthDeals26)
    const splitByRep26 = Object.entries(summariseByRep(deals26)).map(([rep, vals]) => ({
      rep,
      type: classifyDealType(rep, 2026),
      deals: vals.count,
      firstPayment: vals.firstPayment,
      fullTerm: vals.fullTerm,
    })).sort((a, b) => b.firstPayment - a.firstPayment)
    const splitMonthly26 = summariseDealTypeByMonth(deals26)
    const splitByService26 = summariseServiceByDealType(deals26)

    return {
      commissionTracker,
      summary: {
        ytdFirstPayment: ytdFP,
        ytdDeals: ytdCount,
        ytdAvgDeal,
        thisMonthFirstPayment: thisMonthFP,
        thisMonthDeals: thisMonthCount,
        thisMonthMRR: thisMonthMRR26,
        // Q1
        q1FP26, q1FP25, q1FT26, q1FT25, q1Count26, q1Count25, q1YoYFP, q1YoYFT,
        // Q2
        q2FP26, q2FP25, q2FT26, q2FT25, q2Count26, q2Count25, q2YoYFP, q2YoYFT,
        // Q3
        q3FP26, q3FP25, q3FT26, q3FT25, q3Count26, q3Count25, q3YoYFP, q3YoYFT,
        // YTD
        ytdFullTerm,
        ytdFP25, ytdFT25, ytdCount25, ytdYoYFP, ytdYoYFT,
        currentMonth,
        pif: {
          fp26: pifFP26, count26: pifDeals26.length, pct26: ytdFP > 0 ? pifFP26 / ytdFP * 100 : 0,
          fp25: pifFP25, count25: pifDeals25.length, pct25: (pifFP25 + recurFP25) > 0 ? pifFP25 / (pifFP25 + recurFP25) * 100 : 0,
        },
        mrr: {
          ytd26: ytdMRR26,
          ytd25: ytdMRR25,
        },
      },
      monthlyComparison,
      repYTD,
      repThisMonth,
      repPifYTD,
      repPifMonth,
      recentDeals: recent,
      renewalProjection,
      missingRenewal,
      salesVsUpsells: {
        ytd2026: splitYTD26,
        thisMonth2026: splitThisMonth26,
        byRep2026: splitByRep26,
        byMonth2026: splitMonthly26,
        byService2026: splitByService26,
      },
      mrrProjection,
      updatedAt: new Date().toISOString(),
    }
}

export async function GET() {
  try {
    return NextResponse.json(await getNewBusinessMetrics())
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
