#!/usr/bin/env node
/**
 * sync-funnel-to-profiles.mjs
 * Aggregates ClientFunnelMonth data and writes summary KPIs into ClientProfile.
 *
 * Fields updated:
 *   latestFunnelMonth, avgMonthlyLeads, avgMonthlyTours, avgMonthlyRegistered,
 *   leadToTourRate, tourToRegRate, funnelDataMonths, funnelTrend,
 *   trendWindow, trendChangePct, lastFunnelUpdated
 *
 * Trend logic is seasonality-aware (YoY window comparison).
 * Jan-Feb is intentionally excluded — genuinely slow, not a meaningful signal.
 * Windows (checked in order, first with current+prior year data wins):
 *   spring_camp        Mar-May  — Summer camp push
 *   fall_enrollment_push Jun-Aug — Fall enrollment push (biggest lead-gen window)
 *   fall_peak          Sep-Oct  — Peak enrollment
 *   winter_enrollment  Nov-Dec  — Winter enrollment push (January starters)
 */

import pg from 'pg'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─── Env loader ───────────────────────────────────────────────────────────────
try {
  const envPath = resolve(__dirname, '../.env.local')
  const envContent = readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx < 0) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
} catch { /* env set via system */ }

// ─── DB ───────────────────────────────────────────────────────────────────────
const { Pool } = pg
const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// ─── Seasonal comparison windows ─────────────────────────────────────────────
// Checked in order. First window with ≥1 month of data in BOTH current and
// prior year is used. Jan-Feb intentionally omitted (genuine slow period).
const COMPARISON_WINDOWS = [
  { label: 'spring_camp',          months: ['03', '04', '05'] }, // Summer camp push
  { label: 'fall_enrollment_push', months: ['06', '07', '08'] }, // Fall enrollment push
  { label: 'fall_peak',            months: ['09', '10']       }, // Peak enrollment
  { label: 'winter_enrollment',    months: ['11', '12']       }, // Winter / Jan starters
]

// ─── Compute seasonality-aware YoY trend ─────────────────────────────────────
// Returns { trend: 'up'|'down'|'stable'|null, window: string|null, changePct: number|null }
function computeTrend(monthlyData) {
  // monthlyData = array of { month: 'YYYY-MM', leads, ... }
  const currentYear = new Date().getFullYear()
  const priorYear   = currentYear - 1

  for (const win of COMPARISON_WINDOWS) {
    const current = monthlyData.filter(d => {
      const [y, m] = d.month.split('-')
      return parseInt(y) === currentYear && win.months.includes(m)
    })
    const prior = monthlyData.filter(d => {
      const [y, m] = d.month.split('-')
      return parseInt(y) === priorYear && win.months.includes(m)
    })

    if (current.length < 1 || prior.length < 1) continue

    const currentAvg = current.reduce((s, d) => s + Number(d.leads || 0), 0) / current.length
    const priorAvg   = prior.reduce((s, d)   => s + Number(d.leads || 0), 0) / prior.length

    if (priorAvg === 0) continue // can't compute a meaningful ratio

    const change    = (currentAvg - priorAvg) / priorAvg
    const changePct = Math.round(change * 100)

    if (change < -0.15) return { trend: 'down',   window: win.label, changePct }
    if (change >  0.10) return { trend: 'up',     window: win.label, changePct }
    return               { trend: 'stable', window: win.label, changePct }
  }

  // No meaningful seasonal window available — withhold judgment
  return { trend: null, window: null, changePct: null }
}

async function main() {
  const TENANT = 'gyc'

  // ── Step 0: Ensure new columns exist (idempotent) ──────────────────────────
  await pool.query(`
    ALTER TABLE "ClientProfile"
      ADD COLUMN IF NOT EXISTS "trendWindow"    TEXT,
      ADD COLUMN IF NOT EXISTS "trendChangePct" INTEGER
  `)
  console.log('Schema: trendWindow + trendChangePct columns ensured.')

  // ── Step 1: Pull summary stats per client ──────────────────────────────────
  const summaryRes = await pool.query(`
    WITH monthly AS (
      SELECT
        "clientId",
        month,
        SUM(leads) AS leads,
        SUM(tours) AS tours,
        SUM(registered) AS registered
      FROM "ClientFunnelMonth"
      WHERE "tenantId" = $1 AND leads > 0
      GROUP BY "clientId", month
    )
    SELECT
      "clientId" AS acronym,
      COUNT(*) AS months_of_data,
      MAX(month) AS latest_month,
      AVG(leads) AS avg_leads,
      AVG(tours) AS avg_tours,
      AVG(registered) AS avg_registered,
      AVG(CASE WHEN leads > 0 THEN tours::float / leads * 100 ELSE NULL END) AS lead_to_tour,
      AVG(CASE WHEN tours > 0 THEN registered::float / tours * 100 ELSE NULL END) AS tour_to_reg
    FROM monthly
    GROUP BY "clientId"
  `, [TENANT])

  const summaries = summaryRes.rows
  console.log(`Found ${summaries.length} clients with funnel data.`)

  // ── Step 2: Pull monthly rows per client for trend computation ─────────────
  const monthlyRes = await pool.query(`
    SELECT "clientId", month, SUM(leads) AS leads
    FROM "ClientFunnelMonth"
    WHERE "tenantId" = $1 AND leads > 0
    GROUP BY "clientId", month
    ORDER BY "clientId", month ASC
  `, [TENANT])

  // Group monthly rows by clientId
  const monthlyByClient = {}
  for (const row of monthlyRes.rows) {
    if (!monthlyByClient[row.clientId]) monthlyByClient[row.clientId] = []
    monthlyByClient[row.clientId].push(row)
  }

  // ── Step 3: Update ClientProfile for each client ───────────────────────────
  let updated = 0
  let notFound = 0
  let totalLeadToTour = 0
  let totalTourToReg = 0
  let rateCount = 0

  for (const s of summaries) {
    const { trend, window: trendWin, changePct } = computeTrend(monthlyByClient[s.acronym] || [])

    const result = await pool.query(`
      UPDATE "ClientProfile" SET
        "latestFunnelMonth"   = $1,
        "avgMonthlyLeads"     = $2,
        "avgMonthlyTours"     = $3,
        "avgMonthlyRegistered"= $4,
        "leadToTourRate"      = $5,
        "tourToRegRate"       = $6,
        "funnelDataMonths"    = $7,
        "funnelTrend"         = $8,
        "trendWindow"         = $9,
        "trendChangePct"      = $10,
        "lastFunnelUpdated"   = NOW()
      WHERE "tenantId" = $11 AND acronym = $12
    `, [
      s.latest_month,
      s.avg_leads      != null ? Number(s.avg_leads).toFixed(2)      : null,
      s.avg_tours      != null ? Number(s.avg_tours).toFixed(2)      : null,
      s.avg_registered != null ? Number(s.avg_registered).toFixed(2) : null,
      s.lead_to_tour   != null ? Number(s.lead_to_tour).toFixed(2)   : null,
      s.tour_to_reg    != null ? Number(s.tour_to_reg).toFixed(2)    : null,
      Number(s.months_of_data),
      trend,
      trendWin,
      changePct,
      TENANT,
      s.acronym,
    ])

    if (result.rowCount > 0) {
      updated++
      if (s.lead_to_tour != null) { totalLeadToTour += Number(s.lead_to_tour); rateCount++ }
      if (s.tour_to_reg != null) totalTourToReg += Number(s.tour_to_reg)
    } else {
      notFound++
      // ClientFunnelMonth exists but no matching ClientProfile — expected for some clients
    }
  }

  const avgLeadToTour = rateCount > 0 ? (totalLeadToTour / rateCount).toFixed(1) : 'N/A'
  const avgTourToReg  = rateCount > 0 ? (totalTourToReg  / rateCount).toFixed(1) : 'N/A'

  console.log(`\n── Sync Complete ───────────────────────────────────`)
  console.log(`  ClientProfiles updated:  ${updated}`)
  console.log(`  Funnel data, no profile: ${notFound}`)
  console.log(`  Fleet avg lead→tour:     ${avgLeadToTour}%`)
  console.log(`  Fleet avg tour→reg:      ${avgTourToReg}%`)
  console.log(`────────────────────────────────────────────────────`)

  // ── Trend breakdown & at-risk report ────────────────────────────────────────
  const trends  = { up: 0, stable: 0, down: 0, null: 0 }
  const windowHits = {}
  const atRisk = []

  for (const [clientId, rows] of Object.entries(monthlyByClient)) {
    const { trend, window: win, changePct } = computeTrend(rows)
    const key = trend ?? 'null'
    trends[key] = (trends[key] || 0) + 1
    if (win) windowHits[win] = (windowHits[win] || 0) + 1
    if (trend === 'down' && changePct !== null && changePct <= -15) {
      atRisk.push({ clientId, window: win, changePct })
    }
  }

  console.log(`  Trend breakdown → up: ${trends.up} | stable: ${trends.stable} | down: ${trends.down} | no-window: ${trends.null}`)
  console.log(`  Window coverage:`)
  for (const win of COMPARISON_WINDOWS) {
    console.log(`    ${win.label.padEnd(22)} ${windowHits[win.label] || 0} clients`)
  }

  if (atRisk.length > 0) {
    console.log(`\n  ⚠️  At-risk clients (>15% YoY decline in meaningful window):`)
    for (const r of atRisk.sort((a, b) => a.changePct - b.changePct)) {
      console.log(`    ${r.clientId.padEnd(12)} ${r.changePct}%  [${r.window}]`)
    }
  } else {
    console.log(`  ✅ No clients showing >15% YoY decline in a meaningful window.`)
  }

  await pool.end()

  return { updated, avgLeadToTour, avgTourToReg }
}

main().catch(e => {
  console.error('Fatal error:', e.message)
  process.exit(1)
})
