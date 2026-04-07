export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { fetchAllDocuments, fetchDocumentDetail, extractMrrFromDetail } from '@/lib/pandadoc'

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

function getAmount(doc) {
  // Try multiple fields — PandaDoc list API may use grand_total, amount, or price
  const candidates = [doc.grand_total, doc.amount, doc.price]
  for (const raw of candidates) {
    if (raw !== null && raw !== undefined && raw !== '') {
      const val = parseFloat(raw)
      if (!isNaN(val) && val > 0) return val
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
    case 'this_month': {
      const start = new Date(year, now.getMonth(), 1)
      const end = new Date(year, now.getMonth() + 1, 0, 23, 59, 59, 999)
      return { start, end }
    }
    case 'last_month': {
      const start = new Date(year, now.getMonth() - 1, 1)
      const end = new Date(year, now.getMonth(), 0, 23, 59, 59, 999)
      return { start, end }
    }
    case 'q1': {
      return { start: new Date(year, 0, 1), end: new Date(year, 2, 31, 23, 59, 59, 999) }
    }
    case 'q2': {
      return { start: new Date(year, 3, 1), end: new Date(year, 5, 30, 23, 59, 59, 999) }
    }
    case 'q3': {
      return { start: new Date(year, 6, 1), end: new Date(year, 8, 30, 23, 59, 59, 999) }
    }
    case 'q4': {
      return { start: new Date(year, 9, 1), end: new Date(year, 11, 31, 23, 59, 59, 999) }
    }
    case 'ytd': {
      return { start: new Date(year, 0, 1), end: new Date() }
    }
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
    // ── 1. Fetch all documents ────────────────────────────────────────────────
    const allDocs = await fetchAllDocuments(20)

    // ── 2. Apply period filter ────────────────────────────────────────────────
    const docs = filterByPeriod(allDocs, period)

    // ── 3. Partition documents ────────────────────────────────────────────────
    const sentDocs = docs.filter((d) => SENT_STATUSES.has(d.status))
    const signedDocs = docs.filter((d) => SIGNED_STATUSES.has(d.status))

    // ── 4. Core metrics ───────────────────────────────────────────────────────
    const agreementsSent = sentDocs.length
    const agreementsSigned = signedDocs.length

    let totalProposedAmount = 0
    let proposedAmountNull = 0
    for (const doc of sentDocs) {
      const amt = getAmount(doc)
      if (amt !== null) totalProposedAmount += amt
      else proposedAmountNull++
    }

    let closedAmount = 0
    let closedAmountNull = 0
    for (const doc of signedDocs) {
      const amt = getAmount(doc)
      if (amt !== null) closedAmount += amt
      else closedAmountNull++
    }

    // ── 5. MRR derivation ─────────────────────────────────────────────────────
    const MRR_DETAIL_CAP = 50
    const docsForMrr = signedDocs.slice(0, MRR_DETAIL_CAP)

    let mrr = null
    let mrrDerivedCount = 0
    let mrrNullCount = 0
    let mrrError = null

    if (docsForMrr.length > 0) {
      try {
        const detailResults = await Promise.allSettled(
          docsForMrr.map((d) => fetchDocumentDetail(d.id))
        )

        let mrrSum = 0
        for (const result of detailResults) {
          if (result.status === 'fulfilled') {
            const extracted = extractMrrFromDetail(result.value)
            if (extracted !== null) {
              mrrSum += extracted
              mrrDerivedCount++
            } else {
              mrrNullCount++
            }
          }
        }

        if (mrrDerivedCount > 0) {
          mrr = formatCurrency(mrrSum)
        }
      } catch (err) {
        mrrError = err.message
      }
    }

    // ── 6. Recent agreements table ────────────────────────────────────────────
    const activeDocs = [...sentDocs, ...signedDocs]
    activeDocs.sort((a, b) => new Date(b.date_modified) - new Date(a.date_modified))
    const recentAgreements = activeDocs.slice(0, 25).map((doc) => ({
      id: doc.id,
      name: doc.name,
      status: doc.status,
      amount: getAmount(doc),
      createdAt: doc.date_created,
      modifiedAt: doc.date_modified,
      completedAt: SIGNED_STATUSES.has(doc.status) ? (doc.date_completed || doc.date_modified) : null,
      recipients: (doc.recipients || []).map((r) => r.email).filter(Boolean),
    }))

    // ── 7. Build response ─────────────────────────────────────────────────────
    const caveats = []
    if (proposedAmountNull > 0) {
      caveats.push(`${proposedAmountNull} sent doc(s) had no amount — excluded from Proposed Value.`)
    }
    if (closedAmountNull > 0) {
      caveats.push(`${closedAmountNull} signed doc(s) had no amount — excluded from Closed Value.`)
    }
    if (mrrDerivedCount === 0 && signedDocs.length > 0) {
      caveats.push('MRR could not be derived: no signed documents contained a recognized MRR token/field.')
    }
    if (mrrError) {
      caveats.push(`MRR detail fetch error: ${mrrError}`)
    }

    // Get period range label for display
    const range = getPeriodRange(period)
    const periodLabel = range
      ? `${range.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${range.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
      : 'All time'

    return NextResponse.json({
      agreementsSent,
      agreementsSigned,
      totalProposedAmount: formatCurrency(totalProposedAmount),
      closedAmount: formatCurrency(closedAmount),
      mrr,
      mrrDerivedFromDocs: mrrDerivedCount,
      mrrNullDocs: mrrNullCount,
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
      {
        error: err.message || 'Unknown error fetching agreements',
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      },
      { status: 500 }
    )
  }
}
