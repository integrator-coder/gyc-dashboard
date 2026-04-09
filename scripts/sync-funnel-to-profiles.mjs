#!/usr/bin/env node
/**
 * sync-funnel-to-profiles.mjs
 * Aggregates ClientFunnelMonth data and writes summary KPIs into ClientProfile.
 *
 * Fields updated:
 *   latestFunnelMonth, avgMonthlyLeads, avgMonthlyTours, avgMonthlyRegistered,
 *   leadToTourRate, tourToRegRate, funnelDataMonths, funnelTrend, lastFunnelUpdated
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

// ─── Compute trend from monthly rows ─────────────────────────────────────────
function computeTrend(monthlyRows) {
  // monthlyRows sorted by month asc, each has leads
  const sorted = [...monthlyRows].sort((a, b) => a.month.localeCompare(b.month))
  if (sorted.length < 6) return 'stable'

  const last3 = sorted.slice(-3)
  const prior3 = sorted.slice(-6, -3)

  const avgLast = last3.reduce((s, r) => s + Number(r.leads), 0) / 3
  const avgPrior = prior3.reduce((s, r) => s + Number(r.leads), 0) / 3

  if (avgPrior === 0) return avgLast > 0 ? 'up' : 'stable'

  const pct = (avgLast - avgPrior) / avgPrior * 100
  if (pct > 10) return 'up'
  if (pct < -10) return 'down'
  return 'stable'
}

async function main() {
  const TENANT = 'gyc'

  // ── Step 1: Pull summary stats per client ──────────────────────────────────
  const summaryRes = await pool.query(`
    SELECT
      "clientId" AS acronym,
      COUNT(*) AS months_of_data,
      MAX(month) AS latest_month,
      AVG(leads) AS avg_leads,
      AVG(tours) AS avg_tours,
      AVG(registered) AS avg_registered,
      AVG(CASE WHEN leads > 0 THEN tours::float/leads*100 ELSE NULL END) AS lead_to_tour,
      AVG(CASE WHEN tours > 0 THEN registered::float/tours*100 ELSE NULL END) AS tour_to_reg
    FROM "ClientFunnelMonth"
    WHERE "tenantId" = $1 AND leads > 0
    GROUP BY "clientId"
  `, [TENANT])

  const summaries = summaryRes.rows
  console.log(`Found ${summaries.length} clients with funnel data.`)

  // ── Step 2: Pull monthly rows per client for trend computation ─────────────
  const monthlyRes = await pool.query(`
    SELECT "clientId", month, leads
    FROM "ClientFunnelMonth"
    WHERE "tenantId" = $1 AND leads > 0
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
    const trend = computeTrend(monthlyByClient[s.acronym] || [])

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
        "lastFunnelUpdated"   = NOW()
      WHERE "tenantId" = $9 AND acronym = $10
    `, [
      s.latest_month,
      s.avg_leads    != null ? Number(s.avg_leads).toFixed(2)    : null,
      s.avg_tours    != null ? Number(s.avg_tours).toFixed(2)    : null,
      s.avg_registered != null ? Number(s.avg_registered).toFixed(2) : null,
      s.lead_to_tour != null ? Number(s.lead_to_tour).toFixed(2) : null,
      s.tour_to_reg  != null ? Number(s.tour_to_reg).toFixed(2)  : null,
      Number(s.months_of_data),
      trend,
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

  // Trend breakdown
  const trends = { up: 0, down: 0, stable: 0 }
  for (const rows of Object.values(monthlyByClient)) {
    const t = computeTrend(rows)
    trends[t]++
  }
  console.log(`  Trend breakdown → up: ${trends.up} | stable: ${trends.stable} | down: ${trends.down}`)

  await pool.end()

  return { updated, avgLeadToTour, avgTourToReg }
}

main().catch(e => {
  console.error('Fatal error:', e.message)
  process.exit(1)
})
