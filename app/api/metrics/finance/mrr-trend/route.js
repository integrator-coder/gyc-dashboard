export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { createGoogleAuth, SHEETS_READONLY } from '@/lib/google-auth'
import { google } from 'googleapis'
import pkg from 'pg'
const { Pool } = pkg

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// Parse "Jan-23" → "2023-01", "Feb-26" → "2026-02"
function parseMonthLabel(label) {
  if (!label || typeof label !== 'string') return null
  const match = label.trim().match(/^([A-Za-z]{3})-(\d{2})$/)
  if (!match) return null
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const mo = monthNames.findIndex((m) => m.toLowerCase() === match[1].toLowerCase())
  if (mo === -1) return null
  const yr = parseInt(match[2], 10)
  const year = yr >= 23 ? 2000 + yr : 2100 + yr // handle 2023–2099 safely
  return `${year}-${String(mo + 1).padStart(2, '0')}`
}

function parseMoney(val) {
  if (val === null || val === undefined) return null
  const str = String(val).replace(/[$,\s]/g, '')
  const num = parseFloat(str)
  return isNaN(num) ? null : num
}

// The sheet is the legacy basis through Apr 2026. From May 2026 onward,
// MRRHistory is the locked collectible-MRR series (active + past_due).

export async function GET() {
  try {
    await requireUser(['superadmin', 'admin', 'ga', 'cx'])
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 1. Google Sheets — churn sheet (Jan 2023 → Feb 2026) ──────────────────
  let sheetPoints = []
  try {
    const auth = createGoogleAuth(SHEETS_READONLY)
    const sheets = google.sheets({ version: 'v4', auth })
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: '1kLm6VWX_nlpUsFioKq6JEWLGka5Z3WCTgPUKY2C0Z6A',
      range: 'Marketing!A1:BZ50',
    })

    const rows = res.data.values || []

    // Find header row: row where many cells match MMM-YY pattern
    let headerRowIdx = -1
    let headerRow = []
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] || []
      const monthCells = row.filter((cell) => parseMonthLabel(cell) !== null)
      if (monthCells.length >= 3) {
        headerRowIdx = i
        headerRow = row
        break
      }
    }

    if (headerRowIdx !== -1) {
      // Find the rows for Client Count and Avg MRR Per Client
      let clientCountRow = null
      let avgMrrRow = null

      for (let i = headerRowIdx + 1; i < rows.length; i++) {
        const row = rows[i] || []
        const label = (row[0] || '').toLowerCase()
        if (!clientCountRow && (label.includes('client count') || label.includes('clients'))) {
          clientCountRow = row
        }
        if (!avgMrrRow && (label.includes('average mrr') || label.includes('avg mrr'))) {
          avgMrrRow = row
        }
        if (clientCountRow && avgMrrRow) break
      }

      // Extract per-column data
      for (let col = 0; col < headerRow.length; col++) {
        const monthKey = parseMonthLabel(headerRow[col])
        if (!monthKey) continue
        const clientCount = clientCountRow ? parseMoney(clientCountRow[col]) : null
        const avgMrr = avgMrrRow ? parseMoney(avgMrrRow[col]) : null

        if (clientCount !== null && avgMrr !== null && clientCount > 0 && avgMrr > 0) {
          sheetPoints.push({
            month: monthKey,
            mrr: Math.round(clientCount * avgMrr),
            newMrr: null,
            churnedMrr: null,
            source: 'sheet',
          })
        }
      }

      // Sort by month
      sheetPoints.sort((a, b) => a.month.localeCompare(b.month))
    }
  } catch (err) {
    console.error('MRR trend — Google Sheets error:', err.message)
    // Continue with Stripe data only
  }

  // ── 2. Canonical collectible MRR history (Stripe era begins May 2026) ─────
  let stripePoints = []
  const sheetMonths = new Set(sheetPoints.map((p) => p.month))
  const client = await pool.connect()
  try {
    const { rows } = await client.query(`
      SELECT
        month,
        "mrr"::float,
        "newMrr"::float,
        "churnedMrr"::float,
        "expansionMrr"::float,
        "activeSubscriptions"
      FROM "MRRHistory"
      WHERE "tenantId" = 'gyc' AND "month" >= '2026-05'
      ORDER BY "month" ASC
    `)

    stripePoints = rows
      .filter((r) => !sheetMonths.has(r.month)) // don't overwrite sheet data
      .map((r) => ({
      month: r.month,
      mrr: r.mrr || 0,
      newMrr: r.newmrr ?? null,
      churnedMrr: r.churnedmrr ?? null,
      source: 'stripe-collectible',
    }))

    // Sep/Oct have immutable month-end snapshots on the collectible basis.
    // Prefer those over legacy rows produced by live-object reconstruction.
    const snapshotResult = await client.query(`
      SELECT DISTINCT ON (to_char("syncedAt" AT TIME ZONE 'America/Toronto', 'YYYY-MM'))
        to_char("syncedAt" AT TIME ZONE 'America/Toronto', 'YYYY-MM') AS month,
        ROUND(mrr::numeric, 2)::float AS mrr
      FROM "StripeMetrics"
      WHERE "tenantId" = 'gyc'
        AND "syncedAt" >= TIMESTAMPTZ '2026-09-01 America/Toronto'
        AND "syncedAt" < TIMESTAMPTZ '2026-11-01 America/Toronto'
        AND "activeCustomers" < 320
      ORDER BY to_char("syncedAt" AT TIME ZONE 'America/Toronto', 'YYYY-MM'), "syncedAt" DESC
    `)
    for (const snapshot of snapshotResult.rows) {
      stripePoints = stripePoints.filter((point) => point.month !== snapshot.month)
      stripePoints.push({
        month: snapshot.month,
        mrr: snapshot.mrr,
        newMrr: null,
        churnedMrr: null,
        source: 'stripe-collectible-snapshot',
      })
    }

    // The current month is a live point, not a fabricated month-end snapshot.
    // Replace/append it from the same collectible basis used by Finance cards.
    const currentMonth = new Date().toISOString().slice(0, 7)
    const currentResult = await client.query(`
      SELECT ROUND(COALESCE(SUM(mrr), 0)::numeric, 2)::float AS mrr
      FROM "StripeCustomer"
      WHERE "tenantId" = 'gyc' AND status IN ('active', 'past_due')
    `)
    const currentMrr = currentResult.rows[0]?.mrr || 0
    if (currentMonth >= '2026-05' && currentMrr > 0) {
      stripePoints = stripePoints.filter((point) => point.month !== currentMonth)
      stripePoints.push({
        month: currentMonth,
        mrr: currentMrr,
        newMrr: null,
        churnedMrr: null,
        source: 'stripe-collectible-live',
      })
    }
  } catch (err) {
    console.error('MRR trend — MRRHistory error:', err.message)
  } finally {
    client.release()
  }

  // ── 3. Stitch and return ──────────────────────────────────────────────────
  const combined = [...sheetPoints, ...stripePoints]
  combined.sort((a, b) => a.month.localeCompare(b.month))

  return NextResponse.json(combined)
}
