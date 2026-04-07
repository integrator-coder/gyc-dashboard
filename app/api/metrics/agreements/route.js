export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import pkg from 'pg'
const { Pool } = pkg

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// ─── Period helpers ────────────────────────────────────────────────────────────
function getPeriodRange(period, from, to) {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() // 0-indexed

  switch (period) {
    case 'this_month':
      return { start: new Date(y, m, 1), end: new Date(y, m + 1, 0, 23, 59, 59, 999) }
    case 'last_month':
      return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0, 23, 59, 59, 999) }
    case 'this_quarter': {
      const q = Math.floor(m / 3)
      return {
        start: new Date(y, q * 3, 1),
        end:   new Date(y, q * 3 + 3, 0, 23, 59, 59, 999),
      }
    }
    case 'ytd':
      return { start: new Date(y, 0, 1), end: now }
    case 'custom':
      if (from && to) {
        return {
          start: new Date(from + 'T00:00:00'),
          end:   new Date(to   + 'T23:59:59'),
        }
      }
      return null
    default:
      return null
  }
}

function periodLabel(period, range) {
  if (!range) return 'All time'
  const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  if (period === 'this_month') return 'This Month'
  if (period === 'last_month') return 'Last Month'
  if (period === 'this_quarter') return `This Quarter (${fmt(range.start)} – ${fmt(range.end)})`
  if (period === 'ytd') return `Year to Date (Jan 1 – Today)`
  return `${fmt(range.start)} – ${fmt(range.end)}`
}

// ─── Token extractors ──────────────────────────────────────────────────────────
function extractOwner(tokens) {
  if (!tokens) return null
  const first = tokens['Sender.FirstName'] || ''
  const last  = tokens['Sender.LastName']  || ''
  return [first, last].filter(Boolean).join(' ') || null
}

function extractRecipientName(tokens) {
  if (!tokens) return null
  const first = tokens['Client.FirstName'] || ''
  const last  = tokens['Client.LastName']  || ''
  return [first, last].filter(Boolean).join(' ') || null
}

function extractClientEmail(recipients) {
  if (!Array.isArray(recipients) || recipients.length === 0) return null
  // Last recipient is typically the client; skip @growyourcenter.com senders
  const clientEmails = recipients.filter(e => !e.includes('growyourcenter.com'))
  return clientEmails[0] || recipients[recipients.length - 1] || null
}

const n = v => (v == null ? null : parseFloat(v))

// ─── GET ───────────────────────────────────────────────────────────────────────
export async function GET(request) {
  const t0 = Date.now()
  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') || 'this_month'
  const from   = searchParams.get('from')   || null
  const to     = searchParams.get('to')     || null

  try {
    const range = getPeriodRange(period, from, to)

    const params = []
    let dateWhere = ''
    if (range) {
      params.push(range.start.toISOString(), range.end.toISOString())
      dateWhere = `WHERE "createdAt" >= $1 AND "createdAt" <= $2`
    }

    // ── KPI aggregates ──────────────────────────────────────────────────────
    const aggResult = await pool.query(`
      SELECT
        COUNT(*)  FILTER (WHERE "sentStatus" = 'sent')                     AS agreements_sent,
        COUNT(*)  FILTER (WHERE "sentStatus" = 'signed')                   AS agreements_signed,
        COUNT(*)  FILTER (WHERE status = 'document.expired' OR "sentStatus" = 'expired')               AS agreements_expired,
        SUM(amount) FILTER (WHERE "sentStatus" = 'sent')                   AS total_proposed,
        SUM(amount) FILTER (WHERE "sentStatus" = 'signed')                 AS closed_amount,
        SUM(mrr)    FILTER (WHERE "sentStatus" = 'signed')                 AS mrr,
        MAX("syncedAt")                                                    AS synced_at
      FROM "AgreementsSnapshot"
      ${dateWhere}
    `, params)
    const agg = aggResult.rows[0]

    // ── Monthly breakdown for charts ────────────────────────────────────────
    const monthlyResult = await pool.query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', "createdAt"), 'Mon YYYY') AS month,
        DATE_TRUNC('month', "createdAt") AS month_start,
        COUNT(*)    FILTER (WHERE "sentStatus" = 'sent')              AS sent,
        COUNT(*)    FILTER (WHERE "sentStatus" = 'signed')             AS signed,
        COUNT(*)    FILTER (WHERE status = 'document.expired' OR "sentStatus" = 'expired')         AS expired,
        SUM(amount) FILTER (WHERE "sentStatus" = 'sent')               AS proposed_amount,
        SUM(amount) FILTER (WHERE "sentStatus" = 'signed')             AS closed_amount
      FROM "AgreementsSnapshot"
      ${dateWhere}
      GROUP BY DATE_TRUNC('month', "createdAt"), TO_CHAR(DATE_TRUNC('month', "createdAt"), 'Mon YYYY')
      ORDER BY DATE_TRUNC('month', "createdAt") ASC
    `, params)

    const monthlyData = monthlyResult.rows.map(r => ({
      month:          r.month,
      sent:           parseInt(r.sent,    10),
      signed:         parseInt(r.signed,  10),
      expired:        parseInt(r.expired, 10),
      proposedAmount: n(r.proposed_amount) || 0,
      closedAmount:   n(r.closed_amount)   || 0,
    }))

    // ── All agreements rows ─────────────────────────────────────────────────
    const rowsResult = await pool.query(`
      SELECT
        "docId", name, status, "sentStatus",
        amount, mrr,
        "createdAt", "completedAt",
        recipients, tokens
      FROM "AgreementsSnapshot"
      ${dateWhere}
      ORDER BY "createdAt" DESC
      LIMIT 200
    `, params)

    const agreements = rowsResult.rows.map(row => {
      const tokens = row.tokens || {}
      return {
        id:             row.docId,
        name:           row.name,
        status:         row.status,
        sentStatus:     row.sentStatus,
        // Use parseFloat to ensure numeric — fixes the $1 bug from string/decimal mismatch
        amount:         n(row.amount),
        mrr:            n(row.mrr),
        sentDate:       row.createdAt,
        signedDate:     row.completedAt,
        ownerName:      extractOwner(tokens),
        recipientName:  extractRecipientName(tokens),
        recipientEmail: extractClientEmail(row.recipients),
      }
    })

    return NextResponse.json({
      agreementsSent:       parseInt(agg.agreements_sent,    10) || 0,
      agreementsSigned:     parseInt(agg.agreements_signed,  10) || 0,
      agreementsExpired:    parseInt(agg.agreements_expired, 10) || 0,
      totalProposedAmount:  n(agg.total_proposed)  || 0,
      closedAmount:         n(agg.closed_amount)   || 0,
      mrr:                  n(agg.mrr)             || 0,
      monthlyData,
      agreements,
      syncedAt:   agg.synced_at,
      period,
      periodLabel: periodLabel(period, range),
      durationMs: Date.now() - t0,
    })
  } catch (err) {
    if (err.message?.includes('does not exist')) {
      return NextResponse.json({
        agreementsSent: 0, agreementsSigned: 0, agreementsExpired: 0,
        totalProposedAmount: 0, closedAmount: 0, mrr: 0,
        monthlyData: [], agreements: [],
        syncedAt: null, period, periodLabel: '',
        durationMs: Date.now() - t0,
        notice: 'PandaDoc sync has not run yet. Check back shortly.',
      })
    }
    console.error('[agreements route]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
