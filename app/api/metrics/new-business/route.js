import { createGoogleAuth, SHEETS_READONLY } from '@/lib/google-auth'
import { NextResponse } from 'next/server'
import { google } from 'googleapis'

const SHEET_ID = '1858s3B0oQ8YC4KEBDefJMc0WuD5nyjNIFxiQrqsuO-A'

const MONTH_ORDER = ['January','February','March','April','May','June','July','August','September','October','November','December']

const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_CREDENTIALS_PATH || `${require('os').homedir()}/.openclaw/credentials/google-console.json`,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
})

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
  'Zu/Bruce': 'Zu',
  'zu': 'Zu',
  'seb': 'Sebastian',
  'jesse': 'Jesse',
  'briana': 'Briana',
  'jc': 'JC',
  'pia': 'Pia',
}

function normaliseRep(raw) {
  if (!raw) return 'Unknown'
  const trimmed = raw.trim()
  return REP_ALIASES[trimmed] || trimmed
}

function parseDeals(rows) {
  return rows.slice(1).filter(r => r[5]).map(r => ({
    client:       r[0]  || '',
    name:         r[1]  || '',
    service:      r[2]  || '',
    quarter:      r[3]  || '',
    month:        r[4]  || '',
    date:         r[5]  || '',
    firstPayment: Number(r[6])  || 0,
    mrr:          Number(r[7])  || 0,
    term:         Number(r[8])  || 0,
    fullTerm:     Number(r[9])  || 0,
    firstYear:    Number(r[10]) || 0,
    pif:          (r[11] || '').toString().trim().toUpperCase() === 'Y',
    renewalAmount: Number(r[12]) || 0,
    rep:          normaliseRep(r[13]),
  }))
}

function summariseByMonth(deals) {
  const byMonth = {}
  for (const d of deals) {
    if (!byMonth[d.month]) byMonth[d.month] = { firstPayment: 0, mrr: 0, count: 0, pifFP: 0, pifCount: 0, recurFP: 0, recurCount: 0 }
    const m = byMonth[d.month]
    m.firstPayment += d.firstPayment
    m.mrr += d.mrr
    m.count++
    if (d.pif) { m.pifFP += d.firstPayment; m.pifCount++ }
    else        { m.recurFP += d.firstPayment; m.recurCount++ }
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

export async function GET() {
  try {
    const client = await auth.getClient()
    const sheets = google.sheets({ version: 'v4', auth: client })

    const [rows26, rows25] = await Promise.all([
      readTab(sheets, '2026 Details', 'A1:R200'),
      readTab(sheets, '2025 Details', 'A1:R400'),
    ])

    const deals26 = parseDeals(rows26)
    const deals25 = parseDeals(rows25)

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

    // Renewal projections — PIF deals with term + renewalAmount
    // term=1 for PIF = 1 year (12 months); term=6/12 = months as stated
    const pifTermMonths = (term) => term === 1 ? 12 : term
    const allDeals = [...deals25, ...deals26]
    const renewalByMonth = {}
    const missingRenewal = []

    for (const d of allDeals) {
      if (!d.pif) continue
      const termMonths = pifTermMonths(d.term)
      if (!termMonths || !d.date) continue

      const saleDate = new Date(d.date)
      if (isNaN(saleDate)) continue

      saleDate.setMonth(saleDate.getMonth() + termMonths)
      const key = `${saleDate.getFullYear()}-${String(saleDate.getMonth() + 1).padStart(2, '0')}`
      const label = saleDate.toLocaleString('default', { month: 'long', year: 'numeric' })

      if (d.renewalAmount > 0) {
        if (!renewalByMonth[key]) renewalByMonth[key] = { label, mrr: 0, count: 0, deals: [] }
        renewalByMonth[key].mrr += d.renewalAmount
        renewalByMonth[key].count++
        renewalByMonth[key].deals.push({ name: d.name, service: d.service, renewal: d.renewalAmount, rep: d.rep })
      } else {
        missingRenewal.push({ name: d.name, service: d.service, fp: d.firstPayment, date: d.date, rep: d.rep, renewalMonth: label })
      }
    }

    const renewalProjection = Object.entries(renewalByMonth)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, val]) => ({ key, ...val }))

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

    // Q1 YoY (Jan–current month)
    const q1Months = MONTH_ORDER.slice(0, now.getMonth() + 1)
    const q1_26 = deals26.filter(d => q1Months.includes(d.month)).reduce((s, d) => s + d.firstPayment, 0)
    const q1_25 = deals25.filter(d => q1Months.includes(d.month)).reduce((s, d) => s + d.firstPayment, 0)
    const yoyPct = q1_25 > 0 ? ((q1_26 - q1_25) / q1_25) * 100 : null

    // This month
    const thisMonthFP = monthly26[currentMonth]?.firstPayment || 0
    const thisMonthCount = monthly26[currentMonth]?.count || 0

    // Recent deals (last 10)
    const recent = [...deals26]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10)

    const commissionTracker = buildCommissionTracker(deals26, currentMonth)

    return NextResponse.json({
      commissionTracker,
      summary: {
        ytdFirstPayment: ytdFP,
        ytdDeals: ytdCount,
        ytdAvgDeal,
        thisMonthFirstPayment: thisMonthFP,
        thisMonthDeals: thisMonthCount,
        thisMonthMRR: thisMonthMRR26,
        q1_2026: q1_26,
        q1_2025: q1_25,
        yoyPct,
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
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
