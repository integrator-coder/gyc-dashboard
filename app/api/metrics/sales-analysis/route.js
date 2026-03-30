import { createGoogleAuth, SHEETS_READONLY } from '@/lib/google-auth'
import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import Stripe from 'stripe'
import pkg from 'pg'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const { Pool } = pkg
const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false } })

const SCORECARD_SHEET_ID = '1858s3B0oQ8YC4KEBDefJMc0WuD5nyjNIFxiQrqsuO-A'
const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_CREDENTIALS_PATH || `${require('os').homedir()}/.openclaw/credentials/google-console.json`,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
})

const SALE_SIZE_BUCKETS = [
  { label: '<$500', min: 0, max: 500 },
  { label: '$500–$999', min: 500, max: 1000 },
  { label: '$1k–$1.9k', min: 1000, max: 2000 },
  { label: '$2k–$4.9k', min: 2000, max: 5000 },
  { label: '$5k+', min: 5000, max: Infinity },
]

function getSizeBucket(v) {
  return SALE_SIZE_BUCKETS.find((b) => v >= b.min && v < b.max)?.label || '$5k+'
}

// ── Scorecard service normalisation ─────────────────────────────────────────
function normServiceScorecard(name) {
  const s = String(name || '').toLowerCase().trim()
  if (!s) return null
  if (s.includes('web') || s.includes('site')) return 'Website'
  if (s.includes('seo')) return 'SEO'
  if (s.includes('paid ads') || s.includes('google ads') || s.includes('paid media')) return 'Paid Media'
  if (s.includes('crm')) return 'CRM'
  if (s.includes('blueprint')) return 'Blueprint'
  if (s.includes('command')) return 'Command'
  if (s.includes('master')) return 'Master'
  if (s.includes('s3')) return 'S3'
  if (s.includes('accelerator')) return 'Accelerator'
  return name
}

// Split "Website + SEO + CRM" into ["Website", "SEO", "CRM"]
function splitLineItems(service) {
  const raw = String(service || '').trim()
  if (!raw) return []
  const parts = raw.replace(/\s*\+\s*/g, '+').split('+').map((p) => p.trim()).filter(Boolean)
  const components = parts.length > 1
    ? parts.map(normServiceScorecard)
    : [normServiceScorecard(raw)]
  return components.filter(Boolean)
}

// ── Stripe product normalisation ─────────────────────────────────────────────
function normServiceStripe(name) {
  const s = String(name || '').toLowerCase().trim()
  if (!s || s === 'unknown') return null
  if (s.includes('maintenance') || s.includes('evergreen') || s.includes('unlimited support')) return 'Website Maintenance'
  if (s.includes('organic social') || s.includes('social media')) return 'Social Media'
  if (s.includes('staffing') || s.includes('recruitment')) return 'Staffing'
  if (s.includes('catch up') || s === 'delay') return null // skip catch-up
  if (s.includes('setup fee') || s.includes('location fee') || s.includes('autorenewal') || s.includes('auto renewal')) return null
  if (s.includes('test 1') || s.includes('test 2') || s.includes('payment capture')) return null
  if (s.includes('boss mode') || s.includes('multi-platform digital ad')) return 'Paid Media'
  if (s.includes('seo core')) return 'SEO Core'
  if (s.includes('blueprint + seo') || (s.includes('blueprint') && s.includes('seo'))) return 'Blueprint + SEO'
  if (s.includes('website+crm') || s.includes('website + crm')) return 'Website + CRM'
  if (s.includes('website+seo') || s.includes('web+seo')) return 'Website + SEO'
  if ((s.includes('web') || s.includes('site') || s.includes('gyc website') || s.includes('core site') || s.includes('big site')) && !s.includes('webinar')) return 'Website'
  if (s.includes('blueprint')) return 'Blueprint'
  if (s.includes('command')) return 'Command'
  if (s.includes('master')) return 'Master'
  if (s.includes('seo')) return 'SEO'
  if (s.includes('paid ads') || s.includes('paid media') || s.includes('google ads')) return 'Paid Media'
  if (s.includes('crm')) return 'CRM'
  if (s.includes('s3')) return 'S3'
  if (s.includes('accelerator') || s.includes('enrollment') || s.includes('launchpad') || s.includes('inspire') || s.includes('influence')) return 'Accelerator/Enrollment'
  if (s.includes('virtual tour')) return 'Virtual Tour'
  return null // skip uncategorised old products
}

// ── Scorecard data ────────────────────────────────────────────────────────────
async function readTab(sheets, tab, range = 'A1:R1200') {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SCORECARD_SHEET_ID,
    range: `${tab}!${range}`,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  })
  return res.data.values || []
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

function parseSheetDate(raw) {
  if (!raw) return null
  // Formats: "Mar 27, 2026" or "3/27/26" or "3/27/2026"
  const s = String(raw).trim()
  // Try "Mon DD, YYYY"
  let d = new Date(s)
  if (!isNaN(d.getTime())) return d
  // Try M/D/YY
  const parts = s.split('/')
  if (parts.length === 3) {
    const [m, day, y] = parts
    const year = Number(y) < 100 ? 2000 + Number(y) : Number(y)
    d = new Date(year, Number(m) - 1, Number(day))
    if (!isNaN(d.getTime())) return d
  }
  return null
}

function parseDetailRows(rows, yearLabel) {
  return rows.slice(1).filter((r) => r[5]).map((r) => {
    const dateObj = parseSheetDate(r[5])
    return {
      yearLabel,
      service: String(r[2] || '').trim(),
      date: r[5],
      dateObj: dateObj ? dateObj.toISOString() : null,
      year: dateObj ? dateObj.getFullYear() : Number(yearLabel),
      month: dateObj ? dateObj.getMonth() + 1 : null,        // 1-12
      monthName: dateObj ? MONTH_NAMES[dateObj.getMonth()] : null,
      firstPayment: Number(r[6]) || 0,
      mrr: Number(r[7]) || 0,
      pif: String(r[11] || '').trim().toUpperCase() === 'Y',
      rep: String(r[13] || '').trim() || 'Unknown',
    }
  })
}

function analyseDeals(deals) {
  const byService = {}
  const bySize = Object.fromEntries(SALE_SIZE_BUCKETS.map((b) => [b.label, { count: 0, revenue: 0 }]))
  const lineItems = {} // individual service components
  const byYear = {}

  for (const deal of deals) {
    const svc = deal.service || 'Unknown'
    const amt = deal.firstPayment || 0
    const yr = deal.yearLabel

    if (!byService[svc]) byService[svc] = { count: 0, revenue: 0, avg: 0, mrr: 0, pifCount: 0, monthlyCount: 0 }
    byService[svc].count++
    byService[svc].revenue += amt
    byService[svc].mrr += deal.mrr || 0
    if (deal.pif) byService[svc].pifCount++
    else byService[svc].monthlyCount++

    bySize[getSizeBucket(amt)].count++
    bySize[getSizeBucket(amt)].revenue += amt

    if (!byYear[yr]) byYear[yr] = { count: 0, revenue: 0, pifCount: 0, monthlyCount: 0, lineItems: {} }
    byYear[yr].count++
    byYear[yr].revenue += amt
    if (deal.pif) byYear[yr].pifCount++
    else byYear[yr].monthlyCount++

    // Decompose bundles into individual service line items
    for (const component of splitLineItems(svc)) {
      if (!lineItems[component]) lineItems[component] = { count: 0, revenue: 0 }
      lineItems[component].count++
      lineItems[component].revenue += amt
      if (!byYear[yr].lineItems[component]) byYear[yr].lineItems[component] = 0
      byYear[yr].lineItems[component]++
    }
  }

  for (const svc of Object.keys(byService)) {
    byService[svc].avg = byService[svc].count ? Math.round(byService[svc].revenue / byService[svc].count) : 0
  }

  const totals = deals.reduce((acc, d) => {
    acc.count++
    acc.revenue += d.firstPayment || 0
    acc.mrr += d.mrr || 0
    if (d.pif) acc.pifCount++
    else acc.monthlyCount++
    return acc
  }, { count: 0, revenue: 0, mrr: 0, pifCount: 0, monthlyCount: 0 })

  const sortBy = (obj, fn) => Object.entries(obj).sort((a, b) => fn(b[1]) - fn(a[1])).map(([name, val]) => ({ name, ...val }))

  return {
    totals,
    byService: sortBy(byService, (v) => v.revenue),
    bySize: Object.entries(bySize).map(([bucket, val]) => ({ bucket, ...val })),
    lineItems: sortBy(lineItems, (v) => v.count),
    byYear,
  }
}

// ── Stripe historical analysis ────────────────────────────────────────────────
async function analyseStripeHistory() {
  const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY)

  // Build complete price → product name map (auto-paginate)
  const priceMap = {}
  for await (const price of stripeClient.prices.list({ limit: 100, expand: ['data.product'] })) {
    const name = typeof price.product === 'object' ? price.product.name : 'Unknown'
    priceMap[price.id] = name
  }

  // Collect all sub price IDs
  const allPriceIds = new Set()
  const rawSubs = []
  for await (const sub of stripeClient.subscriptions.list({
    limit: 100, status: 'all',
    created: { gte: Math.floor(new Date('2022-01-01').getTime() / 1000) },
    expand: ['data.items.data.price'],
  })) {
    rawSubs.push(sub)
    for (const item of sub.items.data) {
      if (item.price?.id) allPriceIds.add(item.price.id)
    }
  }

  // Resolve missing price IDs
  const missing = [...allPriceIds].filter((id) => !priceMap[id] || priceMap[id] === 'Unknown')
  await Promise.all(missing.map(async (id) => {
    try {
      const p = await stripeClient.prices.retrieve(id, { expand: ['product'] })
      priceMap[id] = typeof p.product === 'object' ? p.product.name : 'Unknown'
    } catch {
      priceMap[id] = 'Unknown'
    }
  }))

  // Analyse subs
  const byYear = {}
  const linesByYear = {}

  for (const sub of rawSubs) {
    const yr = new Date(sub.created * 1000).getFullYear()
    if (!byYear[yr]) byYear[yr] = { total: 0, active: 0, canceled: 0 }
    byYear[yr].total++
    if (sub.status === 'active') byYear[yr].active++
    if (sub.status === 'canceled') byYear[yr].canceled++
    if (!linesByYear[yr]) linesByYear[yr] = {}

    for (const item of sub.items.data) {
      const rawName = priceMap[item.price?.id] || 'Unknown'
      const cat = normServiceStripe(rawName)
      if (!cat) continue
      if (!linesByYear[yr][cat]) linesByYear[yr][cat] = 0
      linesByYear[yr][cat]++
    }
  }

  return {
    byYear: Object.entries(byYear).sort((a, b) => Number(a[0]) - Number(b[0])).map(([year, stats]) => ({
      year: Number(year),
      ...stats,
      services: Object.entries(linesByYear[year] || {}).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
    })),
    allYearsLineItems: Object.entries(
      Object.values(linesByYear).reduce((acc, yearMap) => {
        for (const [name, count] of Object.entries(yearMap)) {
          acc[name] = (acc[name] || 0) + count
        }
        return acc
      }, {})
    ).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET() {
  let dbClient = null
  try {
    const client = await auth.getClient()
    const sheetsApi = google.sheets({ version: 'v4', auth: client })

    dbClient = await pool.connect()

    const [rows2026, rows2025, stripeHistory] = await Promise.all([
      readTab(sheetsApi, '2026 Details', 'A1:R400'),
      readTab(sheetsApi, '2025 Details', 'A1:R800'),
      analyseStripeHistory(),
    ])

    const deals2026 = parseDetailRows(rows2026, '2026')
    const deals2025 = parseDetailRows(rows2025, '2025')
    const allDeals = [...deals2025, ...deals2026]

    const overall = analyseDeals(allDeals)
    const y2025 = analyseDeals(deals2025)
    const y2026 = analyseDeals(deals2026)

    // Build available months from all deals (for the month picker)
    const monthSet = new Map()
    for (const d of allDeals) {
      if (d.year && d.month) {
        const key = `${d.year}-${String(d.month).padStart(2, '0')}`
        if (!monthSet.has(key)) {
          monthSet.set(key, { key, year: d.year, month: d.month, label: `${d.monthName} ${d.year}` })
        }
      }
    }
    const availableMonths = [...monthSet.values()].sort((a, b) => a.key.localeCompare(b.key))

    return NextResponse.json({
      overall,
      year2025: y2025,
      year2026: y2026,
      // Raw deals for client-side filtering by month/range
      rawDeals: allDeals.map(({ service, dateObj, year, month, monthName, yearLabel, firstPayment, mrr, pif, rep }) => ({
        service, dateObj, year, month, monthName, yearLabel, firstPayment, mrr, pif, rep,
      })),
      availableMonths,
      stripe: stripeHistory,
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  } finally {
    if (dbClient) dbClient.release()
  }
}
