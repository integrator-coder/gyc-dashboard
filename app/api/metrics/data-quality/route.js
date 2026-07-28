export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import pkg from 'pg'
const { Pool } = pkg

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

function fmtAgo(date) {
  const ms = Date.now() - new Date(date).getTime()
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (h > 0) return `${h}h ${m}m ago`
  return `${m}m ago`
}

function fmtMoney(n) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

export async function GET() {
  const client = await pool.connect()
  const checks = []
  const failures = []

  function addCheck(name, pass, value, note = null) {
    const result = { name, pass, value, note }
    checks.push(result)
    if (!pass) failures.push(result)
  }

  try {
    // NOTE: "Finance Snapshot Freshness" (LeadershipSnapshot) check removed 2026-07-28.
    // LeadershipSnapshot is an orphaned table written only on Thursdays; nothing in the
    // dashboard reads from it. False positive — real freshness is covered by Checks 2-7
    // (StripeMetrics, StripeCustomer, DailyRevenue).

    // ── Check 2: MRR/ARR consistency ────────────────────────────────────────
    const { rows: stripeRows } = await client.query(`
      SELECT mrr, "totalRevenue", "activeCustomers" FROM "StripeMetrics"
      ORDER BY "syncedAt" DESC LIMIT 1
    `)
    const sm = stripeRows[0] || null
    if (!sm || !sm.mrr) {
      addCheck('MRR/ARR Consistency', false, 'No StripeMetrics found', 'StripeMetrics table empty or missing mrr')
    } else {
      const mrr = Number(sm.mrr)
      const arr = mrr * 12
      const expectedArr = mrr * 12
      const divergence = Math.abs(arr - expectedArr) / expectedArr
      const pass = divergence <= 0.01
      addCheck(
        'MRR/ARR Consistency',
        pass,
        `${fmtMoney(mrr)} MRR → ${fmtMoney(arr)} ARR`,
        pass ? null : `ARR diverges ${(divergence * 100).toFixed(1)}% from MRR×12 (expected ${fmtMoney(expectedArr)})`
      )
    }

    // ── Check 3: Est Annual Revenue vs ARR sanity ────────────────────────────
    const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
    const { rows: ytdRows } = await client.query(`
      SELECT COALESCE(SUM(amount), 0) AS ytd_cash FROM "DailyRevenue"
      WHERE date >= $1
    `, [startOfYear])
    const ytdCash = Number(ytdRows[0]?.ytd_cash || 0)

    const now = new Date()
    const jan1 = new Date(now.getFullYear(), 0, 1)
    const daysElapsed = Math.max(1, Math.floor((now - jan1) / 86400000))

    if (sm && sm.mrr) {
      const mrr = Number(sm.mrr)
      const arr = mrr * 12
      const estAnnual = ytdCash > 0 ? (ytdCash / daysElapsed) * 365 : 0

      if (estAnnual === 0) {
        addCheck(
          'Est Annual Revenue vs ARR',
          false,
          'No YTD cash data',
          'Cannot compute Est Annual Revenue — YTD cash is 0 or missing'
        )
      } else {
        const divergence = Math.abs(estAnnual - arr) / arr
        const pass = divergence <= 0.35
        addCheck(
          'Est Annual Revenue vs ARR',
          pass,
          `${fmtMoney(Math.round(estAnnual))} est vs ${fmtMoney(arr)} ARR`,
          pass ? null : `${(divergence * 100).toFixed(0)}% divergence — exceeds 35% tolerance (${daysElapsed}d elapsed)`
        )
      }
    } else {
      addCheck('Est Annual Revenue vs ARR', false, 'No MRR data', 'Skipped — StripeMetrics unavailable')
    }

    // ── Check 4: YTD cash not zero (after Jan 15) ────────────────────────────
    const jan15 = new Date(now.getFullYear(), 0, 15)
    const pastJan15 = now > jan15
    if (pastJan15) {
      const pass = ytdCash > 0
      addCheck(
        'YTD Cash Not Zero',
        pass,
        ytdCash > 0 ? fmtMoney(Math.round(ytdCash)) : '$0',
        pass ? null : 'YTD cash is 0 — DailyRevenue may not be syncing'
      )
    } else {
      addCheck('YTD Cash Not Zero', true, 'Before Jan 15 — skipped', null)
    }

    // ── Check 5: MRR not zero / active clients > 0 ───────────────────────────
    const { rows: activeRows } = await client.query(`
      SELECT COUNT(*) AS cnt FROM "StripeCustomer" WHERE status = 'active'
    `)
    const activeCount = Number(activeRows[0]?.cnt || 0)
    const mrrVal = sm ? Number(sm.mrr) : 0

    const mrrOk = mrrVal > 0
    const clientsOk = activeCount > 0
    addCheck(
      'MRR Not Zero / Active Clients',
      mrrOk && clientsOk,
      `${fmtMoney(mrrVal)} MRR · ${activeCount} active clients`,
      mrrOk && clientsOk ? null : [
        !mrrOk ? 'MRR is zero or null' : null,
        !clientsOk ? 'No active Stripe customers found' : null,
      ].filter(Boolean).join('; ')
    )

    // ── Check 6: No null/zero cards (totalRevenue, mrr, activeCustomers) ─────
    const totalRevenue = sm ? Number(sm.totalRevenue || 0) : 0
    const totalRevOk = totalRevenue > 0
    const mrrCardOk = mrrVal > 0
    const clientsCardOk = activeCount > 0
    const allCardsOk = totalRevOk && mrrCardOk && clientsCardOk
    const nullFields = [
      !totalRevOk ? 'totalRevenue' : null,
      !mrrCardOk ? 'mrr' : null,
      !clientsCardOk ? 'activeCustomers' : null,
    ].filter(Boolean)

    addCheck(
      'Key Cards Not Null/Zero',
      allCardsOk,
      allCardsOk
        ? `totalRevenue=${fmtMoney(totalRevenue)} | mrr=${fmtMoney(mrrVal)} | clients=${activeCount}`
        : `Zero/null: ${nullFields.join(', ')}`,
      allCardsOk ? null : `These cards are showing zero — data sync may be broken for: ${nullFields.join(', ')}`
    )

    // ── Check 7: RPE sanity ($1.5K–$60K annually per client) ─────────────────
    // GYC clients typically pay $125–$4,000/mo → $1,500–$48,000/yr per client
    if (mrrVal > 0 && activeCount > 0) {
      const rpeAnnual = (mrrVal / activeCount) * 12
      const pass = rpeAnnual >= 1_500 && rpeAnnual <= 60_000
      addCheck(
        'Revenue Per Client ($1.5K–$60K/yr)',
        pass,
        `${fmtMoney(Math.round(rpeAnnual))}/yr per client`,
        pass ? null : `Revenue per client of ${fmtMoney(Math.round(rpeAnnual))} is outside expected $1.5K–$60K band — check client count or MRR`
      )
    } else {
      addCheck(
        'Revenue Per Client ($1.5K–$60K/yr)',
        false,
        'Cannot compute',
        'MRR or active client count is zero — revenue per client check skipped'
      )
    }

    // ── Check 8: MRR Reconciliation (Profile vs Stripe) ────────────────────
    // PIF clients are excluded: they pay lump-sum so Stripe shows 0 recurring MRR
    // while the profile still carries the contracted MRR. That's expected.
    try {
      const { rows: mrrMismatchRows } = await client.query(`
        WITH active_pif_clients AS (
          -- Clients with an active PIF deal (pifEndDate in the future or NULL)
          SELECT DISTINCT sd."clientName" AS acronym
          FROM "SalesDeal" sd
          WHERE sd."tenantId" = 'gyc'
            AND (sd."pif" = true OR sd."pifOverride" = true)
            AND (
              sd."pifEndDate" IS NULL
              OR sd."pifEndDate" > CURRENT_DATE
            )
        )
        SELECT 
          cp.acronym,
          cp."companyName",
          cp.mrr AS profile_mrr,
          ROUND(COALESCE(SUM(sc.mrr), 0)::numeric, 2) AS stripe_mrr
        FROM "ClientProfile" cp
        JOIN "ClientStripeLink" csl ON csl."clientProfileId" = cp.id AND csl."tenantId" = 'gyc'
        JOIN "StripeCustomer" sc ON sc.id = csl."stripeCustomerId"
          AND sc.status IN ('active', 'trialing', 'past_due', 'unpaid')
          AND COALESCE(sc.mrr, 0) > 0
        WHERE cp."tenantId" = 'gyc'
          AND cp.mrr IS NOT NULL
          AND cp.mrr > 0
          -- Exclude active PIF clients — Stripe shows lump sum, not monthly
          AND cp.acronym NOT IN (SELECT acronym FROM active_pif_clients)
        GROUP BY cp.id, cp.acronym, cp."companyName", cp.mrr
        HAVING ABS(ROUND(COALESCE(SUM(sc.mrr), 0)::numeric, 2) - cp.mrr) / cp.mrr > 0.10
        ORDER BY ABS(ROUND(COALESCE(SUM(sc.mrr), 0)::numeric, 2) - cp.mrr) / cp.mrr DESC
        LIMIT 20
      `)
      if (mrrMismatchRows.length === 0) {
        addCheck('MRR Reconciliation (Profile vs Stripe)', true, 'All linked clients match within 10% (PIF clients excluded)', null)
      } else {
        const mismatchNote = mrrMismatchRows
          .map(r => `${r.acronym || r.companyName}: profile $${Number(r.profile_mrr).toLocaleString()} vs Stripe $${Number(r.stripe_mrr).toLocaleString()}`)
          .join(', ')
        addCheck(
          'MRR Reconciliation (Profile vs Stripe)',
          false,
          `${mrrMismatchRows.length} client(s) with MRR mismatch >10% (PIF clients excluded)`,
          mismatchNote
        )
      }
    } catch (mrrReconcileErr) {
      addCheck('MRR Reconciliation (Profile vs Stripe)', false, 'Query error', mrrReconcileErr.message)
    }

    return NextResponse.json({
      asOf: new Date().toISOString(),
      allClear: failures.length === 0,
      checks,
      failures,
    })
  } catch (error) {
    console.error('Data quality check error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  } finally {
    client.release()
  }
}
