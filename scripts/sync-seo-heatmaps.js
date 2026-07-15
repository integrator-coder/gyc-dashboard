#!/usr/bin/env node
/**
 * sync-seo-heatmaps.js  — Weekly SEO heatmap runner + monthly prospect heatmap runner
 *
 * Scans a 5×5 grid of lat/lng points for:
 *   1. Active SEO clients (hasSEO=true) — weekly cadence (skip if scanned <6 days ago)
 *   2. Non-SEO clients with heatmapEnabled=true on a GBPLocation — monthly cadence (skip if <28 days ago)
 *
 * Cost: $0.002/point × 25 pts × 2 keywords × 2 radii = $0.20/location
 *   Full run (avg 1.2 locs per client): ~$5.80 for SEO clients
 *
 * Usage:
 *   node scripts/sync-seo-heatmaps.js          # all clients
 *   node scripts/sync-seo-heatmaps.js CTI       # one client
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') })

const { Pool } = require('pg')
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const AUTH = Buffer.from(`${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`).toString('base64')
const H    = { 'Authorization': `Basic ${AUTH}`, 'Content-Type': 'application/json' }

const GRID_SIZE    = 5
const KM_PER_MILE  = 1.60934
const KEYWORDS     = ['daycare', 'preschool']
const RADII        = [3, 5]    // miles
const MAX_RANK     = 20
const TODAY        = new Date().toISOString().slice(0, 10)
const TARGET = (process.argv[2] && !process.argv[2].startsWith('--')) ? process.argv[2].toUpperCase() : null
const FORCE        = process.argv.includes('--force') // bypass skip thresholds

// Skip thresholds
const SEO_SKIP_DAYS      = 13  // skip SEO locations scanned within 13 days (bi-weekly cadence)
const PROSPECT_SKIP_DAYS = 28  // skip prospect locations scanned within 28 days

function makeGrid(centerLat, centerLng, radiusMiles) {
  const spacingKm = (radiusMiles / 2) * KM_PER_MILE
  const ld  = spacingKm / 111.32
  const ldd = spacingKm / (111.32 * Math.cos(centerLat * Math.PI / 180))
  const half = Math.floor(GRID_SIZE / 2)
  const pts = []
  for (let r = -half; r <= half; r++)
    for (let c = -half; c <= half; c++)
      pts.push({ row: r, col: c, lat: centerLat + r * ld, lng: centerLng + c * ldd })
  return pts
}

async function queryRank(lat, lng, kw) {
  try {
    console.log(`    [API] Querying ${kw} at ${lat.toFixed(4)},${lng.toFixed(4)}...`);
    const fetchPromise = fetch('https://api.dataforseo.com/v3/serp/google/maps/live/advanced', {
      method: 'POST', headers: H,
      body: JSON.stringify([{
        keyword: kw,
        location_coordinate: `${lat.toFixed(6)},${lng.toFixed(6)},9km`,
        language_code: 'en',
        depth: MAX_RANK,
      }]),
    });
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('API timeout after 30s')), 30000)
    );
    const r = await Promise.race([fetchPromise, timeoutPromise]);
    const d = await r.json();
    const t = d.tasks?.[0];
    console.log(`    [API] Response: ${t?.status_code}, items: ${t?.result?.[0]?.items?.length || 0}`);
    return t?.status_code === 20000 ? (t.result?.[0]?.items || []) : [];
  } catch (e) {
    console.error(`    [API] Error: ${e.message}`);
    return [];
  }
}

function findRank(items, placeId, namePattern) {
  for (const i of items) {
    if ((placeId && i.place_id === placeId) || (namePattern && i.title?.toLowerCase().includes(namePattern.toLowerCase())))
      return i.rank_group
  }
  return null
}

async function scanGrid(acronym, seoLocName, centerLat, centerLng, placeId, namePattern, radiusMiles, keyword, dbLocName) {
  const grid      = makeGrid(centerLat, centerLng, radiusMiles)
  const spacingKm = (radiusMiles / 2) * KM_PER_MILE
  const pts       = []

  for (const p of grid) {
    const items = await queryRank(p.lat, p.lng, keyword)
    const rank  = findRank(items, placeId, namePattern)
    pts.push({ row: p.row, col: p.col, lat: p.lat, lng: p.lng, rank })
    await new Promise(r => setTimeout(r, 250))
  }

  await pool.query(
    `INSERT INTO "ClientSEOHeatmap"
      ("clientAcronym","locationName","keyword","centerLat","centerLng","gridSize","spacingKm","scanDate","points","radiusMiles")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT ("clientAcronym","locationName","keyword","scanDate","radiusMiles")
     DO UPDATE SET points=$9`,
    [acronym, dbLocName || seoLocName, keyword, centerLat, centerLng, GRID_SIZE, spacingKm, TODAY, JSON.stringify(pts), radiusMiles]
  )

  const ranked = pts.filter(p => p.rank != null)
  const avg    = ranked.length ? (ranked.reduce((s, p) => s + p.rank, 0) / ranked.length).toFixed(1) : '-'
  return { ranked: ranked.length, total: pts.length, avg }
}

async function main() {
  console.log(`🗺  SEO Heatmap Run — ${TODAY}${TARGET ? ` (${TARGET} only)` : ''}\n`)

  // Load locations: UNION of SEO clients + non-SEO heatmapEnabled locations
  const targetFilter = TARGET ? `AND gl."clientAcronym" = '${TARGET}'` : ''
  const locsRes = await pool.query(`
    -- Branch 1: Active SEO clients (weekly cadence)
    SELECT
      gl."clientAcronym"   AS acronym,
      gl."locationName"    AS gbp_loc_name,
      gl."seoLocationName" AS seo_loc_name,
      gl."gbpPlaceId"      AS place_id,
      (gl."liveDataSnapshot"->>'latitude')::float  AS lat,
      (gl."liveDataSnapshot"->>'longitude')::float AS lng,
      gl."locationVerified" AS verified,
      cp."companyName",
      true  AS is_seo,
      false AS is_prospect
    FROM "GBPLocation" gl
    JOIN "ClientProfile" cp ON cp.acronym = gl."clientAcronym"
    WHERE cp."hasSEO" = true
      AND cp.status   = 'active'
      AND (gl."liveDataSnapshot"->>'latitude') IS NOT NULL
      AND (gl."liveDataSnapshot"->>'latitude')::float NOT BETWEEN 36.8 AND 36.9
      ${targetFilter}

    UNION ALL

    -- Branch 2: Non-SEO clients with heatmapEnabled=true (monthly cadence)
    SELECT
      gl."clientAcronym"   AS acronym,
      gl."locationName"    AS gbp_loc_name,
      gl."seoLocationName" AS seo_loc_name,
      gl."gbpPlaceId"      AS place_id,
      (gl."liveDataSnapshot"->>'latitude')::float  AS lat,
      (gl."liveDataSnapshot"->>'longitude')::float AS lng,
      gl."locationVerified" AS verified,
      cp."companyName",
      false AS is_seo,
      true  AS is_prospect
    FROM "GBPLocation" gl
    JOIN "ClientProfile" cp ON cp.acronym = gl."clientAcronym"
    WHERE gl."heatmapEnabled" = true
      AND cp."hasSEO" = false
      AND cp.status   = 'active'
      AND (gl."liveDataSnapshot"->>'latitude') IS NOT NULL
      AND (gl."liveDataSnapshot"->>'latitude')::float NOT BETWEEN 36.8 AND 36.9
      ${targetFilter}

    ORDER BY acronym, gbp_loc_name
  `)

  if (locsRes.rows.length === 0) {
    console.log('No locations with valid coordinates found.')
    await pool.end(); return
  }

  // Load last scan dates per (clientAcronym, locationName) for skip checks
  const lastScanRes = await pool.query(`
    SELECT "clientAcronym", "locationName", MAX("scanDate") AS last_scan
    FROM "ClientSEOHeatmap"
    GROUP BY "clientAcronym", "locationName"
  `)
  const lastScanMap = {}
  for (const row of lastScanRes.rows) {
    lastScanMap[`${row.clientAcronym}::${row.locationName}`] = row.last_scan
  }

  // Build SEO snapshot location map for name matching fallback
  const seoSnaps = await pool.query(`
    SELECT DISTINCT "clientAcronym", "locationName"
    FROM "ClientSEOSnapshot"
    ${TARGET ? `WHERE "clientAcronym" = '${TARGET}'` : ''}
  `)
  const seoLocMap = {}
  for (const row of seoSnaps.rows) {
    if (!seoLocMap[row.clientAcronym]) seoLocMap[row.clientAcronym] = []
    seoLocMap[row.clientAcronym].push(row.locationName)
  }

  function matchSEOName(loc) {
    // If seo_loc_name is explicitly set (including empty string), use it directly
    if (loc.seo_loc_name !== null && loc.seo_loc_name !== undefined) {
      return loc.seo_loc_name
    }
    // seo_loc_name = null means this GBP location is NOT mapped to any SEO snapshot name.
    // Use the GBP location name itself as the heatmap location name (no fuzzy matching).
    return loc.gbp_loc_name || ''
  }

  function daysSince(dateStr) {
    if (!dateStr) return Infinity
    const d = new Date(dateStr)
    const now = new Date()
    return Math.floor((now - d) / (1000 * 60 * 60 * 24))
  }

  let totalCost = 0
  let skipped   = 0
  let currentAcronym = null

  console.log(`Found ${locsRes.rows.length} candidate location(s)\n`)

  for (const loc of locsRes.rows) {
    if (loc.acronym !== currentAcronym) {
      currentAcronym = loc.acronym
      const label = loc.is_seo ? 'SEO' : 'Prospect'
      console.log(`→ ${loc.acronym} (${loc.companyName}) [${label}]`)
    }

    const seoLocName    = matchSEOName(loc)
    const skipThreshold = loc.is_seo ? SEO_SKIP_DAYS : PROSPECT_SKIP_DAYS
    // Use gbp_loc_name as the stable skip key (seoLocName can change as seoLocationName is populated,
    // causing false cache misses. gbp_loc_name is stable and what older records were stored under.)
    const scanKey       = `${loc.acronym}::${loc.gbp_loc_name}`
    const seoScanKey    = `${loc.acronym}::${seoLocName}`
    const lastScan      = lastScanMap[scanKey] || lastScanMap[seoScanKey]
    const age           = daysSince(lastScan)
    const typeLabel     = loc.is_seo ? 'SEO' : 'Prospect'

    // Skip unverified locations
    if (!loc.verified) {
      console.log(`  ⚠️  [${typeLabel}] ${loc.gbp_loc_name} → "${seoLocName}" — SKIPPED (location not verified)\n      ❌ GBP map link must be confirmed before running heatmaps.\n      Set locationVerified=TRUE in GBPLocation table to enable.`)
      skipped++
      continue
    }

    if (!FORCE && age < skipThreshold) {
      console.log(`  ⏭  [${typeLabel}] ${loc.gbp_loc_name} → "${seoLocName}" — skipped (last scan ${age}d ago, threshold ${skipThreshold}d)`)
      skipped++
      continue
    }

    const locCost = RADII.length * KEYWORDS.length * GRID_SIZE * GRID_SIZE * 0.002
    totalCost += locCost
    const namePattern = loc.companyName?.split(' ').slice(0, 2).join(' ')

    console.log(`  📍 [${typeLabel}] ${loc.gbp_loc_name} → SEO: "${seoLocName}" (est. $${locCost.toFixed(2)}, last scan: ${lastScan || 'never'})`)

    for (const radius of RADII) {
      for (const kw of KEYWORDS) {
        process.stdout.write(`    ${radius}mi ${kw}: `)
        const { ranked, total, avg } = await scanGrid(
          loc.acronym, seoLocName,
          loc.lat, loc.lng,
          loc.place_id, namePattern,
          radius, kw,
          loc.gbp_loc_name  // use actual location name as DB key to avoid conflicts
        )
        console.log(`${ranked}/${total} ranked | avg: ${avg}`)
      }
    }
  }

  console.log(`\n✅ Done! Est. total cost: $${totalCost.toFixed(2)} | Skipped: ${skipped} location(s)`)
  await pool.end()
}

main().catch(async e => {
  console.error('Fatal:', e.message)
  await pool.end()
  process.exit(1)
})
