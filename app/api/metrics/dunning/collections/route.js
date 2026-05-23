export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import pg from 'pg'
import { requireUser } from '@/lib/auth'

let _pool = null
function getPool() {
  if (!_pool) {
    _pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3 })
  }
  return _pool
}

// ── GET /api/metrics/dunning/collections ──────────────────────────────────────
// Returns all DunningHistory records with calculated balance remaining
// RBAC: admin + superadmin only

export async function GET(request) {
  try {
    await requireUser(['admin', 'superadmin'])
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const pool = getPool()
    const { rows } = await pool.query(`
      SELECT
        "id",
        "clientName",
        "companyAcronym",
        "inCollections",
        "totalAmountDue",
        "totalCatchUpAmount",
        "catchUpRate",
        "firstDueDate",
        "services",
        "reasons",
        "notes",
        "lastPaymentDate",
        "lastPaymentAmount",
        "updatedAt"
      FROM "DunningHistory"
      WHERE "tenantId" = 'gyc'
      ORDER BY ("totalAmountDue" - "totalCatchUpAmount") DESC
    `)

    const allRecords = rows.map(r => {
      const amountDue  = parseFloat(r.totalAmountDue)   || 0
      const recovered  = parseFloat(r.totalCatchUpAmount) || 0
      const balance    = Math.max(0, amountDue - recovered)
      const reasons    = (() => { try { return JSON.parse(r.reasons)  } catch { return [] } })()
      const services   = (() => { try { return JSON.parse(r.services) } catch { return [] } })()

      return {
        id:               r.id,
        clientName:       r.clientName,
        companyAcronym:   r.companyAcronym,
        inCollections:    r.inCollections,
        totalAmountDue:   amountDue,
        totalCatchUpAmount: recovered,
        balanceRemaining: balance,
        catchUpRate:      parseFloat(r.catchUpRate) || 0,
        firstDueDate:     r.firstDueDate,
        reasons,
        services,
        notes:            r.notes,
        lastPaymentDate:  r.lastPaymentDate,
        lastPaymentAmount: r.lastPaymentAmount ? parseFloat(r.lastPaymentAmount) : null,
        updatedAt:        r.updatedAt,
      }
    })

    // Split into Historical Overdue (not in collections) vs Active Collections
    const overdue           = allRecords.filter(r => !r.inCollections)
    const activeCollections = allRecords.filter(r => r.inCollections)

    // Summary aggregates
    const totalDue       = allRecords.reduce((s, r) => s + r.totalAmountDue, 0)
    const totalRecovered = allRecords.reduce((s, r) => s + r.totalCatchUpAmount, 0)
    const balanceRemaining = allRecords.reduce((s, r) => s + r.balanceRemaining, 0)
    const recoveryRate   = totalDue > 0 ? totalRecovered / totalDue : 0

    const overdueBalance       = overdue.reduce((s, r) => s + r.balanceRemaining, 0)
    const collectionsBalance   = activeCollections.reduce((s, r) => s + r.balanceRemaining, 0)
    const collectionsCount     = activeCollections.length

    return NextResponse.json({
      overdue,
      activeCollections,
      summary: {
        totalDue:            Math.round(totalDue * 100) / 100,
        totalRecovered:      Math.round(totalRecovered * 100) / 100,
        balanceRemaining:    Math.round(balanceRemaining * 100) / 100,
        recoveryRate:        Math.round(recoveryRate * 10000) / 10000,
        overdueBalance:      Math.round(overdueBalance * 100) / 100,
        overdueCount:        overdue.length,
        collectionsBalance:  Math.round(collectionsBalance * 100) / 100,
        collectionsCount,
      },
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[dunning/collections] GET error:', err)
    return NextResponse.json({ error: err.message || 'Failed to load collections data' }, { status: 500 })
  }
}

// ── PATCH /api/metrics/dunning/collections ────────────────────────────────────
// Record a recovery payment against a DunningHistory record
// Body: { id, paymentAmount, paymentDate, note }

export async function PATCH(request) {
  try {
    await requireUser(['admin', 'superadmin'])
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { id, paymentAmount, paymentDate, note } = body

    if (!id || !paymentAmount || isNaN(parseFloat(paymentAmount))) {
      return NextResponse.json({ error: 'id and paymentAmount are required' }, { status: 400 })
    }

    const amount = parseFloat(paymentAmount)
    const pool   = getPool()

    // Fetch current record
    const { rows } = await pool.query(
      `SELECT "id","clientName","totalAmountDue","totalCatchUpAmount","notes" FROM "DunningHistory" WHERE "id" = $1 AND "tenantId" = 'gyc'`,
      [id]
    )
    if (!rows.length) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    }

    const record = rows[0]
    const newCatchUp = (parseFloat(record.totalCatchUpAmount) || 0) + amount
    const newCatchUpRate = parseFloat(record.totalAmountDue) > 0
      ? newCatchUp / parseFloat(record.totalAmountDue)
      : 0

    // Append note with timestamp
    const ts         = new Date().toISOString().slice(0, 10)
    const appendNote = `[${ts}] Payment $${amount.toLocaleString()} received${note ? ': ' + note : ''}`
    const existingNotes = record.notes || ''
    const newNotes    = existingNotes
      ? `${existingNotes}\n${appendNote}`
      : appendNote

    await pool.query(
      `UPDATE "DunningHistory"
       SET "totalCatchUpAmount" = $1,
           "catchUpRate"        = $2,
           "lastPaymentDate"    = $3,
           "lastPaymentAmount"  = $4,
           "notes"              = $5,
           "updatedAt"          = NOW()
       WHERE "id" = $6 AND "tenantId" = 'gyc'`,
      [
        newCatchUp,
        newCatchUpRate,
        paymentDate || new Date().toISOString().slice(0, 10),
        amount,
        newNotes,
        id,
      ]
    )

    return NextResponse.json({
      success: true,
      id,
      clientName:        record.clientName,
      totalAmountDue:    parseFloat(record.totalAmountDue),
      totalCatchUpAmount: newCatchUp,
      balanceRemaining:  Math.max(0, parseFloat(record.totalAmountDue) - newCatchUp),
      catchUpRate:       newCatchUpRate,
      lastPaymentDate:   paymentDate || new Date().toISOString().slice(0, 10),
      lastPaymentAmount: amount,
      notes:             newNotes,
    })
  } catch (err) {
    console.error('[dunning/collections] PATCH error:', err)
    return NextResponse.json({ error: err.message || 'Failed to update record' }, { status: 500 })
  }
}
