export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { fetchAllDocuments, fetchDocumentDetail } from '@/lib/pandadoc'

const SENT_STATUSES = new Set([
  'document.sent',
  'document.viewed',
  'document.waiting_approval',
  'document.approved',
  'document.waiting_pay',
])

const SIGNED_STATUSES = new Set([
  'document.completed',
  'document.paid',
])

/**
 * Extract contract value from a document detail's tokens.
 * Priority:
 *   1. "Pay-In-Full" token (strip $ and commas)
 *   2. grand_total.amount if > 0
 *   3. null
 *
 * We intentionally do NOT use Monthly Financing Rate for the total —
 * that would double-count vs PIF deals.
 */
function extractAmountFromDetail(detail) {
  if (!detail) return null

  // 1. Tokens — look for Pay-In-Full first, then any "total" or "value" token
  if (Array.isArray(detail.tokens)) {
    const PIF_KEYS = /pay.?in.?full|pif|contract.?value|total.?value|deal.?value/i
    for (const token of detail.tokens) {
      if (PIF_KEYS.test(token.name || '')) {
        const cleaned = String(token.value || '').replace(/[$,\s]/g, '')
        const val = parseFloat(cleaned)
        if (!isNaN(val) && val > 0) return val
      }
    }
  }

  // 2. grand_total object: { amount: "3999", currency: "USD" }
  if (detail.grand_total?.amount) {
    const val = parseFloat(detail.grand_total.amount)
    if (!isNaN(val) && val > 0) return val
  }

  return null
}

/**
 * Extract MRR from tokens — Monthly Financing Rate or similar.
 */
function extractMrrFromDetail(detail) {
  if (!detail) return null
  const MRR_KEYS = /monthly.?financ|monthly.?rate|monthly.?amount|monthly.?fee|mrr|recurring/i
  if (Array.isArray(detail.tokens)) {
    for (const token of detail.tokens) {
      if (MRR_KEYS.test(token.name || '')) {
        const cleaned = String(token.value || '').replace(/[$,\s]/g, '')
        const val = parseFloat(cleaned)
        if (!isNaN(val) && val > 0) return val
      }
    }
  }
  return null
}

function formatCurrency(n) {
  if (n === null || n === undefined) return null
  return Math.round(n * 100) / 100
}

// ─── Period filtering ─────────────────────────────────────────────────────────
function getPeriodRange(period) {
  const now = new Date()
  const year = now.getFullYear()
  switch (period) {
    case 'this_month':
      return { start: new Date(year, now.getMonth(), 1), end: new Date(year, now.getMonth() + 1, 0, 23, 59, 59, 999) }
    case 'last_month':
      return { start: new Date(year, now.getMonth() - 1, 1), end: new Date(year, now.getMonth(), 0, 23, 59, 59, 999) }
    case 'q1':
      return { start: new Date(year, 0, 1), end: new Date(year, 2, 31, 23, 59, 59, 999) }
    case 'q2':
      return { start: new Date(year, 3, 1), end: new Date(year, 5, 30, 23, 59, 59, 999) }
    case 'q3':
      return { start: new Date(year, 6, 1), end: new Date(year, 8, 30, 23, 59, 59, 999) }
    case 'q4':
      return { start: new Date(year, 9, 1), end: new Date(year, 11, 31, 23, 59, 59, 999) }
    case 'ytd':
      return { start: new Date(year, 0, 1), end: new Date() }
    default:
      return null
  }
}

function filterByPeriod(docs, period) {
  const range = getPeriodRange(period)
  if (!range) return docs
  return docs.filter((doc) => {
    const created = new Date(doc.date_created)
    return created >= range.start && created <= range.end
  })
}

export async function GET(request) {
  const startTime = Date.now()
  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') || 'this_month'

  try {
    // ── 1. Fetch all documents (list — no amounts) ────────────────────────────
    const allDocs = await fetchAllDocuments(20)

    // ── 2. Filter by period ───────────────────────────────────────────────────
    const docs = filterByPeriod(allDocs, period)

    // ── 3. Partition ──────────────────────────────────────────────────────────
    const sentDocs = docs.filter((d) => SENT_STATUSES.has(d.status))
    const signedDocs = docs.filter((d) => SIGNED_STATUSES.has(d.status))
    const activeDocs = [...sentDocs, ...signedDocs]

    // ── 4. Fetch details for all active docs (need tokens for amounts) ────────
    // Cap at 60 to stay within rate limits; sorted by modified desc so newest first
    const CAP = 60
    activeDocs.sort((a, b) => new Date(b.date_modified) - new Date(a.date_modified))
    const docsToDetail = activeDocs.slice(0, CAP)

    const detailMap = {}
    const detailResults = await Promise.allSettled(
      docsToDetail.map((d) => fetchDocumentDetail(d.id))
    )
    detailResults.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        detailMap[docsToDetail[i].id] = result.value
      }
    })

    // ── 5. Compute metrics ────────────────────────────────────────────────────
    let totalProposedAmount = 0
    let proposedAmountNull = 0
    for (const doc of sentDocs) {
      const amt = extractAmountFromDetail(detailMap[doc.id])
      if (amt !== null) totalProposedAmount += amt
      else proposedAmountNull++
    }

    let closedAmount = 0
    let closedAmountNull = 0
    for (const doc of signedDocs) {
      const amt = extractAmountFromDetail(detailMap[doc.id])
      if (amt !== null) closedAmount += amt
      else closedAmountNull++
    }

    // MRR from signed docs
    let mrr = null
    let mrrDerivedCount = 0
    for (const doc of signedDocs) {
      const detail = detailMap[doc.id]
      if (!detail) continue
      const val = extractMrrFromDetail(detail)
      if (val !== null) {
        mrr = (mrr || 0) + val
        mrrDerivedCount++
      }
    }

    // ── 6. Build recent agreements table ─────────────────────────────────────
    const recentAgreements = docsToDetail.slice(0, 25).map((doc) => {
      const detail = detailMap[doc.id]
      return {
        id: doc.id,
        name: doc.name,
        status: doc.status,
        amount: extractAmountFromDetail(detail),
        mrr: extractMrrFromDetail(detail),
        createdAt: doc.date_created,
        modifiedAt: doc.date_modified,
        completedAt: SIGNED_STATUSES.has(doc.status) ? (doc.date_completed || doc.date_modified) : null,
        recipients: (detail?.recipients || []).map((r) => r.email || r.shared_link).filter(Boolean),
      }
    })

    // ── 7. Period label ───────────────────────────────────────────────────────
    const range = getPeriodRange(period)
    const periodLabel = range
      ? `${range.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${range.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
      : 'All time'

    // ── 8. Caveats ────────────────────────────────────────────────────────────
    const caveats = []
    if (proposedAmountNull > 0)
      caveats.push(`${proposedAmountNull} sent doc(s) had no Pay-In-Full token — excluded from Proposed Value.`)
    if (closedAmountNull > 0)
      caveats.push(`${closedAmountNull} signed doc(s) had no Pay-In-Full token — excluded from Closed Value.`)
    if (activeDocs.length > CAP)
      caveats.push(`Showing first ${CAP} of ${activeDocs.length} active docs (API cap).`)

    return NextResponse.json({
      agreementsSent: sentDocs.length,
      agreementsSigned: signedDocs.length,
      totalProposedAmount: formatCurrency(totalProposedAmount),
      closedAmount: formatCurrency(closedAmount),
      mrr: mrr !== null ? formatCurrency(mrr) : null,
      mrrDerivedFromDocs: mrrDerivedCount,
      recentAgreements,
      totalDocsFetched: allDocs.length,
      filteredDocCount: docs.length,
      period,
      periodLabel,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      caveats,
    })
  } catch (err) {
    console.error('[agreements route]', err)
    return NextResponse.json(
      { error: err.message || 'Unknown error', timestamp: new Date().toISOString(), durationMs: Date.now() - startTime },
      { status: 500 }
    )
  }
}
