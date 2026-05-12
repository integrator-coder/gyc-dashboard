#!/usr/bin/env node
/**
 * audit-seo-locations.js
 * Generates reports/seo-location-audit.md — a comprehensive audit of SEO and heatmap location status.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') })
const { Pool } = require('pg')
const fs   = require('fs')
const path = require('path')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  const [seoProfilesRes, snapshotsRes, heatmapNonSEORes, noGBPRes, lastHeatmapRes] = await Promise.all([
    pool.query(`
      SELECT
        cp.acronym,
        cp."companyName",
        cp.status,
        gl.id AS gbp_id,
        gl."locationName",
        gl."seoLocationName",
        gl."heatmapEnabled",
        gl."gbpPlaceId",
        gl."liveDataSnapshot"->>'latitude'  AS lat,
        gl."liveDataSnapshot"->>'longitude' AS lng
      FROM "ClientProfile" cp
      LEFT JOIN "GBPLocation" gl ON gl."clientAcronym" = cp.acronym
      WHERE cp."hasSEO" = true
      ORDER BY cp.acronym, gl."locationName"
    `),
    pool.query(`
      SELECT DISTINCT "clientAcronym", "locationName"
      FROM "ClientSEOSnapshot"
      ORDER BY "clientAcronym", "locationName"
    `),
    pool.query(`
      SELECT gl."clientAcronym", gl."locationName", gl."seoLocationName", gl."heatmapEnabled",
             gl."gbpPlaceId", gl."liveDataSnapshot"->>'latitude' AS lat,
             cp."companyName", cp.status
      FROM "GBPLocation" gl
      JOIN "ClientProfile" cp ON cp.acronym = gl."clientAcronym"
      WHERE gl."heatmapEnabled" = true AND cp."hasSEO" = false
      ORDER BY gl."clientAcronym", gl."locationName"
    `),
    pool.query(`
      SELECT cp.acronym, cp."companyName", cp.status
      FROM "ClientProfile" cp
      WHERE cp."hasSEO" = false AND cp.status = 'active'
        AND NOT EXISTS (SELECT 1 FROM "GBPLocation" gl WHERE gl."clientAcronym" = cp.acronym)
      ORDER BY cp.acronym
    `),
    pool.query(`
      SELECT "clientAcronym", "locationName", MAX("scanDate") AS last_scan
      FROM "ClientSEOHeatmap"
      GROUP BY "clientAcronym", "locationName"
    `),
  ])

  const seoRows      = seoProfilesRes.rows
  const snapshots    = snapshotsRes.rows
  const heatmapNonSEO = heatmapNonSEORes.rows
  const noGBP        = noGBPRes.rows
  const lastHeatmap  = lastHeatmapRes.rows

  // Build lookup maps
  const snapshotSet = new Set(snapshots.map(s => `${s.clientAcronym}::${s.locationName}`))
  const lastHeatmapMap = {}
  for (const r of lastHeatmap) lastHeatmapMap[`${r.clientAcronym}::${r.locationName}`] = r.last_scan

  // Group seoRows by acronym
  const seoByAcronym = {}
  for (const row of seoRows) {
    if (!seoByAcronym[row.acronym]) seoByAcronym[row.acronym] = { companyName: row.companyName, status: row.status, locs: [] }
    if (row.gbp_id) seoByAcronym[row.acronym].locs.push(row)
  }

  // Section 1: SEO Clients — Location Status
  const lines = []
  lines.push(`# SEO Location Audit`)
  lines.push(`_Generated: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC_`)
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## 1. SEO Clients — Location Status')
  lines.push('')
  lines.push('| Acronym | Company | Status | GBP Locs | seoLocName Set? | Has Coords? | Has Snapshot? | Last Heatmap |')
  lines.push('|---------|---------|--------|----------|-----------------|-------------|---------------|--------------|')

  const needsWork = []

  for (const [acronym, data] of Object.entries(seoByAcronym)) {
    if (data.locs.length === 0) {
      lines.push(`| **${acronym}** | ${data.companyName} | ${data.status} | ❌ None | — | — | — | — |`)
      needsWork.push({ acronym, issue: 'No GBPLocation records at all' })
      continue
    }
    for (const loc of data.locs) {
      const seoLocSet  = loc.seoLocationName !== null && loc.seoLocationName !== undefined
      const hasCoords  = !!(loc.lat && loc.lng)
      const seoLocName = seoLocSet ? (loc.seoLocationName || '""') : '—'
      // Check snapshot: for single-loc clients with seoLocName='', snapshot key is clientAcronym::''
      const snapKey    = `${acronym}::${seoLocName === '""' ? '' : seoLocName}`
      const hasSnap    = snapshotSet.has(snapKey)
      const heatmapKey = `${acronym}::${seoLocName === '""' ? '' : seoLocName}`
      const lastScan   = lastHeatmapMap[heatmapKey] || '—'

      const seoLocIcon  = seoLocSet ? '✅' : '❌'
      const coordIcon   = hasCoords ? '✅' : '❌'
      const snapIcon    = hasSnap   ? '✅' : '⚠️'

      lines.push(`| ${acronym} | ${data.companyName} | ${data.status} | ${loc.locationName || '(empty)'} | ${seoLocIcon} ${seoLocName} | ${coordIcon} | ${snapIcon} | ${lastScan} |`)

      if (!seoLocSet) needsWork.push({ acronym, loc: loc.locationName, issue: 'seoLocationName not set' })
      if (!hasCoords) needsWork.push({ acronym, loc: loc.locationName, issue: 'Missing lat/lng coordinates' })
      if (!hasSnap)   needsWork.push({ acronym, loc: loc.locationName, issue: 'No ClientSEOSnapshot data' })
    }
  }

  // Section 2: What We Need Per Client
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## 2. What We Need Per Client')
  lines.push('')

  if (needsWork.length === 0) {
    lines.push('✅ All SEO client locations are fully configured!')
  } else {
    // Group by acronym
    const byAcronym = {}
    for (const item of needsWork) {
      if (!byAcronym[item.acronym]) byAcronym[item.acronym] = []
      byAcronym[item.acronym].push(item)
    }
    for (const [acronym, issues] of Object.entries(byAcronym)) {
      const company = seoByAcronym[acronym]?.companyName || acronym
      lines.push(`### ${acronym} — ${company}`)
      const issueSet = new Set()
      for (const i of issues) {
        const key = i.loc ? `${i.loc}: ${i.issue}` : i.issue
        issueSet.add(key)
      }
      for (const issue of issueSet) {
        lines.push(`- ⚠️ ${issue}`)
      }
      lines.push('')
    }
  }

  // Special note for MHCC
  lines.push('### MHCC — Manual Mapping Required 🔴')
  lines.push('GBP locations are named "Location 1-4" but SEO program uses "MHCC - Daybreak" and "MHCC - South Jordan".')
  lines.push('**Action:** Identify which location number corresponds to Daybreak vs South Jordan, then update `seoLocationName` on those GBPLocation records.')
  lines.push('')

  // Section 3: Non-SEO heatmapEnabled locations
  lines.push('---')
  lines.push('')
  lines.push('## 3. Non-SEO heatmapEnabled Locations (Prospect Intel)')
  lines.push('')

  if (heatmapNonSEO.length === 0) {
    lines.push('_No non-SEO heatmap locations configured yet._')
  } else {
    lines.push('| Acronym | Company | Status | Location | Has Coords? | Last Heatmap |')
    lines.push('|---------|---------|--------|----------|-------------|--------------|')
    for (const loc of heatmapNonSEO) {
      const hasCoords  = !!(loc.lat && loc.lng)
      const coordIcon  = hasCoords ? '✅' : '❌'
      const seoLocName = loc.seoLocationName !== null ? (loc.seoLocationName || '""') : '—'
      const heatKey    = `${loc.clientAcronym}::${loc.locationName || ''}`
      const lastScan   = lastHeatmapMap[heatKey] || '—'
      lines.push(`| ${loc.clientAcronym} | ${loc.companyName} | ${loc.status} | ${loc.locationName || '(empty)'} | ${coordIcon} | ${lastScan} |`)
    }
  }

  lines.push('')

  // Section 4: Active non-SEO clients with zero GBP locations
  lines.push('---')
  lines.push('')
  lines.push('## 4. Active Non-SEO Clients With Zero GBP Locations')
  lines.push('')

  if (noGBP.length === 0) {
    lines.push('✅ All active non-SEO clients have at least one GBP location record.')
  } else {
    lines.push(`_${noGBP.length} active non-SEO client(s) have no GBP location records:_`)
    lines.push('')
    lines.push('| Acronym | Company | Status |')
    lines.push('|---------|---------|--------|')
    for (const c of noGBP) {
      lines.push(`| ${c.acronym} | ${c.companyName} | ${c.status} |`)
    }
  }

  lines.push('')
  lines.push('---')
  lines.push('_End of report_')

  const report = lines.join('\n')

  // Write report
  const outDir = path.resolve(__dirname, '../reports')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, 'seo-location-audit.md')
  fs.writeFileSync(outPath, report, 'utf8')

  console.log(`\n✅ Report written to: ${outPath}\n`)
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(report)
  console.log('═══════════════════════════════════════════════════════════════')

  await pool.end()
}

main().catch(async e => {
  console.error('Fatal:', e.message)
  await pool.end()
  process.exit(1)
})
