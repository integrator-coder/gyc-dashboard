import Stripe from 'stripe'
import { NextResponse } from 'next/server'
import pg from 'pg'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })

// ── DB helpers ────────────────────────────────────────────────────────────────

let _pool = null
function getPool() {
  if (!_pool) {
    _pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3 })
  }
  return _pool
}

async function loadDunningHistory() {
  const pool = getPool()
  const { rows } = await pool.query(`
    SELECT "clientName","companyAcronym","inCollections","totalAmountDue",
           "totalCatchUpAmount","catchUpRate","firstDueDate","services","reasons","notes"
    FROM "DunningHistory" WHERE "tenantId" = 'gyc'
  `)
  return rows
}

async function loadClientServiceMap() {
  const pool = getPool()
  const { rows } = await pool.query(`
    SELECT "acronym","companyName","crmType","assignedGA","locations",
           "hasGoogleAds","hasBlueprint","hasCommand"
    FROM "ClientServiceMap" WHERE "tenantId" = 'gyc'
  `)
  return rows
}

// ── Fuzzy matching ─────────────────────────────────────────────────────────────

function normalize(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Extract acronym from "Company Name (ACR)" */
function extractAcronym(name) {
  const m = (name || '').match(/\(([A-Z0-9\-&]{1,10})\)\s*$/)
  return m ? m[1].toUpperCase() : null
}

/** Find best ClientServiceMap match for a Stripe customer name */
function matchServiceMap(stripeName, serviceMap) {
  if (!stripeName) return null

  // 1. Try acronym extracted from the Stripe name
  const acr = extractAcronym(stripeName)
  if (acr) {
    const hit = serviceMap.find(r => r.acronym === acr)
    if (hit) return hit
  }

  // 2. Exact normalized company name
  const normName = normalize(stripeName)
  let hit = serviceMap.find(r => normalize(r.companyName) === normName)
  if (hit) return hit

  // 3. Substring — Stripe name contains known company name fragment
  hit = serviceMap.find(r => {
    const rn = normalize(r.companyName)
    return rn.length > 4 && (normName.includes(rn) || rn.includes(normName))
  })
  return hit || null
}

/** Find DunningHistory record for a given acronym or client/company name */
function matchDunningHistory(acronym, stripeName, history) {
  if (!history.length) return null

  // 1. Match by companyAcronym (most reliable — from sheet)
  if (acronym) {
    const hit = history.find(r => r.companyAcronym === acronym)
    if (hit) return hit
  }

  // 2. Normalized client name vs stripe name
  const normStripe = normalize(stripeName)
  const hit = history.find(r => {
    const nc = normalize(r.clientName)
    return nc.length > 3 && (normStripe.includes(nc) || nc.includes(normStripe))
  })
  return hit || null
}

// ── Stripe helpers ────────────────────────────────────────────────────────────

function daysPastDue(currentPeriodEnd) {
  const now = Date.now() / 1000
  const diff = now - currentPeriodEnd
  return diff > 0 ? Math.floor(diff / 86400) : 0
}

function getBucket(days) {
  if (days <= 7) return '0–7 days'
  if (days <= 14) return '8–14 days'
  if (days <= 30) return '15–30 days'
  return '30+ days'
}

// ── GET /api/metrics/dunning ───────────────────────────────────────────────────

export async function GET() {
  try {
    // Load historical data from Neon (parallel)
    const [subsResponse, invoicesResponse, history, serviceMap] = await Promise.all([
      stripe.subscriptions.list({
        status: 'past_due',
        limit: 100,
        expand: ['data.customer', 'data.latest_invoice'],
      }),
      stripe.invoices.list({
        status: 'open',
        limit: 100,
        expand: ['data.customer'],
      }),
      loadDunningHistory().catch(() => []),
      loadClientServiceMap().catch(() => []),
    ])

    // ── Past-due subscriptions ────────────────────────────────────────────────
    const pastDue = []

    for (const sub of subsResponse.data) {
      const customer = sub.customer
      const invoice  = sub.latest_invoice

      const name =
        (typeof customer === 'object' && customer?.name) ||
        (typeof customer === 'object' && customer?.email) ||
        'Unknown'
      const email = (typeof customer === 'object' && customer?.email) || ''

      const mrr = (sub.items?.data?.[0]?.price?.unit_amount ?? 0) / 100
      const days = daysPastDue(sub.current_period_end)

      const attemptCount = typeof invoice === 'object' ? (invoice?.attempt_count ?? 0) : 0
      const amountDue    = typeof invoice === 'object' ? (invoice?.amount_due ?? 0) / 100 : 0
      const nextAttemptTs = typeof invoice === 'object' ? invoice?.next_payment_attempt : null
      const nextAttempt  = nextAttemptTs
        ? new Date(nextAttemptTs * 1000).toISOString().slice(0, 10)
        : null

      // ── Enrich with ClientServiceMap ───────────────────────────────────────
      const svcMatch = matchServiceMap(name, serviceMap)
      const assignedGA = svcMatch?.assignedGA || null
      const crmType    = svcMatch?.crmType    || null
      const acronym    = svcMatch?.acronym    || extractAcronym(name) || null

      // ── Enrich with DunningHistory ─────────────────────────────────────────
      const dhMatch = matchDunningHistory(acronym, name, history)

      let paymentHistory = null
      if (dhMatch) {
        const reasons = (() => { try { return JSON.parse(dhMatch.reasons) } catch { return [] } })()
        const services = (() => { try { return JSON.parse(dhMatch.services) } catch { return [] } })()
        paymentHistory = {
          hasHistory:       true,
          totalAmountDue:   parseFloat(dhMatch.totalAmountDue)   || 0,
          totalCatchUpPaid: parseFloat(dhMatch.totalCatchUpAmount) || 0,
          catchUpRate:      parseFloat(dhMatch.catchUpRate)       || 0,
          firstDueDate:     dhMatch.firstDueDate,
          inCollections:    dhMatch.inCollections,
          isRepeatOffender: true,  // appears in history sheet = at least one prior episode
          reasons,
          services,
          lastReason:       reasons[0] || null,
          notes:            dhMatch.notes,
        }
      } else {
        paymentHistory = {
          hasHistory:       false,
          catchUpRate:      null,
          isRepeatOffender: false,
          reasons:          [],
          services:         [],
          lastReason:       null,
        }
      }

      pastDue.push({
        name,
        email,
        mrr,
        daysPastDue: days,
        attemptCount,
        nextAttempt,
        amountDue,
        // New enrichment fields
        assignedGA,
        crmType,
        acronym,
        paymentHistory,
      })
    }

    // Sort by days past due descending
    pastDue.sort((a, b) => b.daysPastDue - a.daysPastDue)

    // ── Failed invoices ────────────────────────────────────────────────────────
    const ninetyDaysAgo = Math.floor(Date.now() / 1000) - 90 * 86400
    const failedInvoices = invoicesResponse.data.filter(
      (inv) => inv.attempt_count > 0 && !inv.paid && inv.created >= ninetyDaysAgo
    )

    // ── Summary stats ─────────────────────────────────────────────────────────
    const pastDueCount    = pastDue.length
    const mrrAtRisk       = pastDue.reduce((s, r) => s + r.mrr, 0)
    const totalOutstanding =
      failedInvoices.reduce((s, inv) => s + (inv.amount_due ?? 0), 0) / 100
    const avgAttempts =
      failedInvoices.length > 0
        ? parseFloat(
            (failedInvoices.reduce((s, inv) => s + inv.attempt_count, 0) /
              failedInvoices.length).toFixed(1)
          )
        : 0

    // Aggregate stats from history
    const repeatOffenders = pastDue.filter(r => r.paymentHistory?.isRepeatOffender).length
    const histCatchUpRates = history
      .filter(r => !r.inCollections)
      .map(r => parseFloat(r.catchUpRate) || 0)
    const avgCatchUpRate =
      histCatchUpRates.length > 0
        ? parseFloat((histCatchUpRates.reduce((s, x) => s + x, 0) / histCatchUpRates.length).toFixed(4))
        : null

    // Most common reason code across all history
    const allReasons = history.flatMap(r => {
      try { return JSON.parse(r.reasons) } catch { return [] }
    })
    const reasonCounts = {}
    allReasons.forEach(r => { reasonCounts[r] = (reasonCounts[r] || 0) + 1 })
    const topReason = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null

    // Buckets
    const bucketDefs = [
      { label: '0–7 days',  min: 0,  max: 7          },
      { label: '8–14 days', min: 8,  max: 14         },
      { label: '15–30 days',min: 15, max: 30         },
      { label: '30+ days',  min: 31, max: Infinity   },
    ]
    const buckets = bucketDefs.map(({ label, min, max }) => {
      const subs = pastDue.filter(s => s.daysPastDue >= min && s.daysPastDue <= max)
      return { label, count: subs.length, mrr: subs.reduce((s, r) => s + r.mrr, 0) }
    })

    // Failed list (simplified)
    const failedList = failedInvoices.map((inv) => {
      const customer = inv.customer
      const name =
        (typeof customer === 'object' && customer?.name) ||
        (typeof customer === 'object' && customer?.email) ||
        'Unknown'
      const email = (typeof customer === 'object' && customer?.email) || ''
      return {
        name, email,
        amountDue:    (inv.amount_due ?? 0) / 100,
        attemptCount: inv.attempt_count,
        nextAttempt:  inv.next_payment_attempt
          ? new Date(inv.next_payment_attempt * 1000).toISOString().slice(0, 10)
          : null,
        created: new Date(inv.created * 1000).toISOString().slice(0, 10),
      }
    })

    return NextResponse.json({
      summary: {
        pastDueCount,
        mrrAtRisk,
        totalOutstanding,
        avgAttempts,
        repeatOffenders,
        avgCatchUpRate,
        topReason,
        historyLoaded: history.length,
      },
      buckets,
      pastDue,
      failedInvoices: failedList,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[dunning] error:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to fetch dunning data' },
      { status: 500 }
    )
  }
}
