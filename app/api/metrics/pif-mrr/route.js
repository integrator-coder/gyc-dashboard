export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import pkg from 'pg'
import nullableMoneyPkg from '@/lib/nullable-money'
import pifReturnFactsPkg from '@/lib/pif-return-facts'
import pifReturnQueryPkg from '@/lib/pif-return-query'

const { Pool } = pkg
const { nullableNumber } = nullableMoneyPkg
const { summarizePifReturns } = pifReturnFactsPkg
const { fetchConfirmedPifReturns } = pifReturnQueryPkg
const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

function monthsRemaining(endDate) {
  if (!endDate) return null
  const now = new Date()
  const end = new Date(endDate)
  const diffMs = end - now
  const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30.44)
  return Math.max(0, Math.round(diffMonths))
}

function monthsUntil(targetDate) {
  if (!targetDate) return null
  const now = new Date()
  const target = new Date(targetDate)
  const diffMs = target - now
  const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30.44)
  return Math.round(diffMonths)
}

export async function GET() {
  const client = await pool.connect()
  try {
    const now = new Date().toISOString()

    // ── Lateral PIFs: existing MRR that went offline ──────────────────────────
    // dealOutcome = 'Lateral' AND (pif = true OR pifOverride = true)
    const { rows: lateralRows } = await client.query(`
      SELECT
        sd."clientName",
        COALESCE(cp."companyName", sd."clientName") AS "companyName",
        sd.rep,
        sd."dealDate",
        sd."mrrOffline",
        sd."pifStartDate",
        sd."pifEndDate",
        sd."mrrReturnAmount",
        sd."firstPayment",
        sd."mrr",
        sd.term,
        sd."termOverride"
      FROM "SalesDeal" sd
      LEFT JOIN "ClientProfile" cp
        ON cp."tenantId" = 'gyc'
        AND (
          cp.acronym = sd."clientName"
          OR cp."companyName" ILIKE sd."clientName"
        )
      WHERE sd."tenantId" = 'gyc'
        AND sd."dealOutcome" = 'Lateral'
        AND (sd."pif" = true OR sd."pifOverride" = true)
      ORDER BY sd."pifEndDate" ASC NULLS LAST
    `)

    // Human-confirmed Monthly → PIF movements are the authoritative churn
    // exclusion ledger. Include them even when SalesDeal.dealOutcome has not
    // yet been backfilled, otherwise Leadership contradicts the Churn page.
    const confirmedMovementRows = await fetchConfirmedPifReturns(client)

    // ── New PIFs: new MRR coming online in the future ──────────────────────────
    // dealOutcome = 'New Deal' AND (pif = true OR pifOverride = true)
    const { rows: newPifRows } = await client.query(`
      SELECT
        sd."clientName",
        COALESCE(cp."companyName", sd."clientName") AS "companyName",
        sd.rep,
        sd."dealDate",
        sd."firstPayment",
        sd."mrr",
        sd."pifStartDate",
        sd."pifEndDate",
        sd."mrrReturnAmount",
        sd.term,
        sd."termOverride"
      FROM "SalesDeal" sd
      LEFT JOIN "ClientProfile" cp
        ON cp."tenantId" = 'gyc'
        AND (
          cp.acronym = sd."clientName"
          OR cp."companyName" ILIKE sd."clientName"
        )
      WHERE sd."tenantId" = 'gyc'
        AND sd."dealOutcome" = 'New Deal'
        AND (sd."pif" = true OR sd."pifOverride" = true)
      ORDER BY sd."pifEndDate" ASC NULLS LAST
    `)

    // ── Also fetch all PIFs (regardless of dealOutcome) for summary ────────────
    // This is useful while dealOutcome is being filled in
    const { rows: allPifRows } = await client.query(`
      SELECT
        sd."clientName",
        COALESCE(cp."companyName", sd."clientName") AS "companyName",
        sd.rep,
        sd."dealDate",
        sd."dealOutcome",
        sd."firstPayment",
        sd."mrr",
        sd."pifStartDate",
        sd."pifEndDate",
        sd."mrrReturnAmount",
        sd."mrrOffline",
        sd.term,
        sd."termOverride"
      FROM "SalesDeal" sd
      LEFT JOIN "ClientProfile" cp
        ON cp."tenantId" = 'gyc'
        AND (
          cp.acronym = sd."clientName"
          OR cp."companyName" ILIKE sd."clientName"
        )
      WHERE sd."tenantId" = 'gyc'
        AND (sd."pif" = true OR sd."pifOverride" = true)
      ORDER BY sd."pifEndDate" ASC NULLS LAST
    `)

    const today = new Date()

    // Shape Lateral PIFs
    const classifiedLateralPifs = lateralRows.map(r => {
      const endDate = r.pifEndDate ? new Date(r.pifEndDate) : null
      const isActive = endDate ? endDate > today : true
      return {
        clientName: r.companyName || r.clientName,
        rep: r.rep || '—',
        dealDate: r.dealDate ? r.dealDate.toISOString().split('T')[0] : null,
        mrrOffline: r.mrrOffline != null ? Number(r.mrrOffline) : Number(r.mrr || 0),
        pifStartDate: r.pifStartDate ? r.pifStartDate.toISOString().split('T')[0] : null,
        pifEndDate: endDate ? endDate.toISOString().split('T')[0] : null,
        mrrReturnAmount: r.mrrReturnAmount != null ? Number(r.mrrReturnAmount) : Number(r.mrr || 0),
        monthsRemaining: monthsRemaining(endDate),
        status: isActive ? 'active' : 'expired',
      }
    })

    const confirmedLateralPifs = confirmedMovementRows.map(r => {
      const endDate = r.scheduledReturnDate ? new Date(r.scheduledReturnDate) : null
      const startDate = r.movementDate ? new Date(r.movementDate) : null
      const isActive = endDate ? endDate > today : true
      return {
        clientName: r.clientName,
        rep: 'Confirmed ledger',
        dealDate: startDate ? startDate.toISOString().split('T')[0] : null,
        mrrOffline: Number(r.mrrMoved || 0),
        pifCashReceived: nullableNumber(r.pifCashReceived),
        pifStartDate: startDate ? startDate.toISOString().split('T')[0] : null,
        pifEndDate: endDate ? endDate.toISOString().split('T')[0] : null,
        // Returning MRR is a new-deal fact. It is deliberately not inferred
        // from the amount that went offline; migrations can change pricing.
        mrrReturnAmount: nullableNumber(r.returningMrr),
        returningProgram: r.returningProgram,
        monthsRemaining: monthsRemaining(endDate),
        status: isActive ? 'active' : 'expired',
        source: 'confirmed-ledger',
      }
    })

    const confirmedNames = new Set(confirmedLateralPifs.map(p => p.clientName.trim().toLowerCase()))
    const lateralPifs = [
      ...confirmedLateralPifs,
      ...classifiedLateralPifs.filter(p => !confirmedNames.has(p.clientName.trim().toLowerCase())),
    ]

    // Shape New PIFs
    const newPifs = newPifRows.map(r => {
      const endDate = r.pifEndDate ? new Date(r.pifEndDate) : null
      // For new PIFs, pifEndDate is when MRR comes online
      const mrrOnlineDate = endDate
      const isActive = mrrOnlineDate ? mrrOnlineDate <= today : false
      const pifAmount = Number(r.firstPayment || 0)
      const mrrOnlineAmount = r.mrrReturnAmount != null ? Number(r.mrrReturnAmount) : Number(r.mrr || 0)
      return {
        clientName: r.companyName || r.clientName,
        rep: r.rep || '—',
        dealDate: r.dealDate ? r.dealDate.toISOString().split('T')[0] : null,
        pifAmount,
        mrrOnlineDate: mrrOnlineDate ? mrrOnlineDate.toISOString().split('T')[0] : null,
        mrrOnlineAmount,
        monthsUntilOnline: monthsUntil(mrrOnlineDate),
        status: isActive ? 'active' : 'pending',
      }
    })

    // ── Summary ────────────────────────────────────────────────────────────────
    // Active lateral PIFs = MRR currently offline
    const activeLaterals = lateralPifs.filter(p => p.status === 'active')
    const totalMrrOffline = activeLaterals.reduce((s, p) => s + (p.mrrOffline || 0), 0)

    // MRR returning (lateral PIFs expiring — active ones)
    const activeLateralReturns = lateralPifs.filter(p => p.status === 'active')
    const returnSummary = summarizePifReturns(activeLateralReturns)
    const totalMrrComingOnline = returnSummary.returningMrr

    // Next return date = earliest active lateral PIF end date
    const futureLaterals = activeLaterals
      .filter(p => p.pifEndDate)
      .sort((a, b) => a.pifEndDate.localeCompare(b.pifEndDate))
    const nextReturnDate = futureLaterals[0]?.pifEndDate || null
    const nextReturnAmount = futureLaterals[0]?.mrrReturnAmount ?? null

    // All PIFs summary (regardless of dealOutcome) for unclassified PIF tracking
    const unclassifiedPifs = allPifRows.filter(r => !r.dealOutcome)
    const activePifDeals = allPifRows.filter(r => {
      const end = r.pifEndDate ? new Date(r.pifEndDate) : null
      return end ? end > today : true
    })

    return NextResponse.json({
      asOf: now,
      lateralPifs,
      newPifs,
      summary: {
        totalMrrOffline: Math.round(totalMrrOffline * 100) / 100,
        totalMrrComingOnline: Math.round(totalMrrComingOnline * 100) / 100,
        returnMrrPendingCount: returnSummary.pendingReturnMrr,
        nextReturnDate,
        nextReturnAmount: nextReturnAmount == null ? null : Math.round(nextReturnAmount * 100) / 100,
        totalActivePifDeals: activePifDeals.length,
        unclassifiedPifCount: unclassifiedPifs.length,
      },
    })
  } catch (err) {
    console.error('[pif-mrr]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  } finally {
    client.release()
  }
}
