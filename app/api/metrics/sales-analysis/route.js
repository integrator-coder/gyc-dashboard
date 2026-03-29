import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import pkg from 'pg'

export const dynamic = 'force-dynamic'

const { Pool } = pkg
const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const SCORECARD_SHEET_ID = '1858s3B0oQ8YC4KEBDefJMc0WuD5nyjNIFxiQrqsuO-A'

const auth = new google.auth.GoogleAuth({
  keyFile: '/Users/toddthejedigmail.com/.openclaw/credentials/google-console.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
})

const SALE_SIZE_BUCKETS = [
  { label: '<$500', min: 0, max: 500 },
  { label: '$500–$999', min: 500, max: 1000 },
  { label: '$1k–$1.9k', min: 1000, max: 2000 },
  { label: '$2k–$4.9k', min: 2000, max: 5000 },
  { label: '$5k+', min: 5000, max: Infinity },
]

function getSizeBucket(amount) {
  const v = Number(amount) || 0
  return SALE_SIZE_BUCKETS.find((b) => v >= b.min && v < b.max)?.label || '$5k+'
}

function normaliseLineItem(token) {
  const s = String(token || '').toLowerCase().trim()
  if (!s) return null
  if ((s.includes('web') || s.includes('site')) && !s.includes('webinar')) return 'Website'
  if (s.includes('seo')) return 'SEO'
  if (s.includes('paid ads') || s.includes('google ads') || s.includes('paid media') || s.includes('ads')) return 'Paid Media'
  if (s.includes('crm')) return 'CRM'
  if (s.includes('blueprint')) return 'Blueprint'
  if (s.includes('command')) return 'Command'
  if (s.includes('master')) return 'Master'
  if (s.includes('s3')) return 'S3'
  if (s.includes('accelerator')) return 'Accelerator'
  const words = String(token || '').trim().split(/\s+/)
  return words.map((w) => w[0]?.toUpperCase() + w.slice(1).toLowerCase()).join(' ')
}

function splitServiceLineItems(service) {
  const raw = String(service || '').trim()
  if (!raw) return []
  const parts = raw.replace(/\s*\+\s*/g, '+').split('+').map((p) => p.trim()).filter(Boolean)
  if (parts.length <= 1) {
    const n = normaliseLineItem(raw)
    return n ? [n] : []
  }
  return parts.map(normaliseLineItem).filter(Boolean)
}

async function readTab(sheets, tab, range = 'A1:R1200') {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SCORECARD_SHEET_ID,
    range: `${tab}!${range}`,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  })
  return res.data.values || []
}

function parseDetailRows(rows, yearLabel) {
  return rows
    .slice(1)
    .filter((r) => r[5])
    .map((r) => ({
      yearLabel,
      service: String(r[2] || '').trim(),
      date: r[5],
      firstPayment: Number(r[6]) || 0,
      mrr: Number(r[7]) || 0,
      pif: String(r[11] || '').trim().toUpperCase() === 'Y',
      rep: String(r[13] || '').trim() || 'Unknown',
    }))
}

function analyseDeals(deals) {
  const byService = {}
  const bySize = Object.fromEntries(SALE_SIZE_BUCKETS.map((b) => [b.label, { count: 0, revenue: 0 }]))
  const lineItems = {}
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

    const bucket = getSizeBucket(amt)
    bySize[bucket].count++
    bySize[bucket].revenue += amt

    if (!byYear[yr]) byYear[yr] = { count: 0, revenue: 0, pifCount: 0, monthlyCount: 0 }
    byYear[yr].count++
    byYear[yr].revenue += amt
    if (deal.pif) byYear[yr].pifCount++
    else byYear[yr].monthlyCount++

    for (const component of splitServiceLineItems(svc)) {
      if (!lineItems[component]) lineItems[component] = { count: 0, revenue: 0 }
      lineItems[component].count++
      lineItems[component].revenue += amt
    }
  }

  for (const svc of Object.keys(byService)) {
    const row = byService[svc]
    row.avg = row.count ? Math.round(row.revenue / row.count) : 0
  }

  const totals = deals.reduce(
    (acc, d) => {
      acc.count += 1
      acc.revenue += d.firstPayment || 0
      acc.mrr += d.mrr || 0
      if (d.pif) acc.pifCount++
      else acc.monthlyCount++
      return acc
    },
    { count: 0, revenue: 0, mrr: 0, pifCount: 0, monthlyCount: 0 }
  )

  const sort = (obj, fn) =>
    Object.entries(obj)
      .sort((a, b) => fn(b[1]) - fn(a[1]))
      .map(([name, val]) => ({ name, ...val }))

  return {
    totals,
    byService: sort(byService, (v) => v.revenue),
    bySize: Object.entries(bySize).map(([bucket, val]) => ({ bucket, ...val })),
    lineItems: sort(lineItems, (v) => v.count),
    byYear,
  }
}

async function getStripeHistorical(client) {
  // Use the StripeCustomer table — createdAt represents when the subscription was first created
  // This is a reasonable proxy for "new client acquisition by year"
  const { rows: byYear } = await client.query(`
    SELECT
      EXTRACT(YEAR FROM "createdAt")::int AS year,
      COUNT(*) AS count,
      ROUND(SUM(mrr)::numeric, 0) AS total_mrr,
      COUNT(CASE WHEN status = 'active' THEN 1 END) AS active_count,
      COUNT(CASE WHEN status = 'past_due' THEN 1 END) AS past_due_count,
      COUNT(CASE WHEN status = 'canceled' THEN 1 END) AS canceled_count
    FROM "StripeCustomer"
    GROUP BY year
    ORDER BY year ASC
  `)

  // MRR by year-month for the trend line  
  const { rows: mrrTrend } = await client.query(`
    SELECT
      TO_CHAR("createdAt", 'YYYY-MM') AS month,
      COUNT(*) AS new_subs,
      ROUND(SUM(mrr)::numeric, 0) AS new_mrr
    FROM "StripeCustomer"
    WHERE "createdAt" >= '2024-01-01'
    GROUP BY month
    ORDER BY month ASC
  `)

  // Top clients by MRR (all active)
  const { rows: topClients } = await client.query(`
    SELECT name, email, mrr, status, "createdAt"
    FROM "StripeCustomer"
    WHERE mrr > 0
    ORDER BY mrr DESC
    LIMIT 20
  `)

  return {
    byYear: byYear.map((r) => ({
      year: r.year,
      count: Number(r.count),
      totalMrr: Number(r.total_mrr),
      activeCount: Number(r.active_count),
      pastDueCount: Number(r.past_due_count),
      canceledCount: Number(r.canceled_count),
    })),
    mrrTrend: mrrTrend.map((r) => ({
      month: r.month,
      newSubs: Number(r.new_subs),
      newMrr: Number(r.new_mrr),
    })),
    topClients: topClients.map((r) => ({
      name: r.name,
      email: r.email,
      mrr: Number(r.mrr),
      status: r.status,
      since: r.createdAt ? new Date(r.createdAt).getFullYear() : null,
    })),
  }
}

export async function GET() {
  let dbClient = null
  try {
    const [client, sheets] = await Promise.all([
      auth.getClient(),
      auth.getClient().then(() => google.sheets({ version: 'v4', auth })),
    ])
    const sheetsApi = google.sheets({ version: 'v4', auth: client })

    dbClient = await pool.connect()

    const [rows2026, rows2025, stripeHistorical] = await Promise.all([
      readTab(sheetsApi, '2026 Details', 'A1:R400'),
      readTab(sheetsApi, '2025 Details', 'A1:R800'),
      getStripeHistorical(dbClient),
    ])

    const deals2026 = parseDetailRows(rows2026, '2026')
    const deals2025 = parseDetailRows(rows2025, '2025')
    const allDeals = [...deals2025, ...deals2026]

    const analysis = analyseDeals(allDeals)
    const analysis2025 = analyseDeals(deals2025)
    const analysis2026 = analyseDeals(deals2026)

    return NextResponse.json({
      overall: {
        totals: analysis.totals,
        byService: analysis.byService,
        bySize: analysis.bySize,
        lineItems: analysis.lineItems,
        byYear: analysis.byYear,
      },
      year2025: {
        totals: analysis2025.totals,
        byService: analysis2025.byService,
        bySize: analysis2025.bySize,
        lineItems: analysis2025.lineItems,
      },
      year2026: {
        totals: analysis2026.totals,
        byService: analysis2026.byService,
        bySize: analysis2026.bySize,
        lineItems: analysis2026.lineItems,
      },
      stripe: stripeHistorical,
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  } finally {
    if (dbClient) dbClient.release()
  }
}
