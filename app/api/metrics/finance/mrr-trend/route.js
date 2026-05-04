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

// Sheet covers whatever months it has data for.
// MRRHistory fills in any months the sheet doesn't cover.

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

  // ── 2. MRRHistory table — fill in any months the sheet doesn't cover ──────
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
      WHERE "tenantId" = 'gyc'
      ORDER BY "month" ASC
    `)

    stripePoints = rows
      .filter((r) => !sheetMonths.has(r.month)) // don't overwrite sheet data
      .map((r) => ({
      month: r.month,
      mrr: r.mrr || 0,
      newMrr: r.newmrr ?? null,
      churnedMrr: r.churnedmrr ?? null,
      source: 'stripe',
    }))
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
