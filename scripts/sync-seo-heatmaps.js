#!/usr/bin/env node
/**
 * sync-seo-heatmaps.js  — Weekly SEO heatmap runner
 *
 * Scans a 5×5 grid of lat/lng points for every active SEO client location
 * that has valid coordinates in GBPLocation, at 3mi and 5mi radius.
 * Each run creates NEW date-stamped rows — historical data is preserved.
 *
 * Cost: $0.002/point × 25 pts × 2 keywords × 2 radii = $0.20/location
 *   Full 24-client run (avg 1.2 locs): ~$5.80
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
const TARGET       = process.argv[2]?.toUpperCase() || null

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
    const r = await fetch('https://api.dataforseo.com/v3/serp/google/maps/live/advanced', {
      method: 'POST', headers: H,
      body: JSON.stringify([{
        keyword: kw,
        location_coordinate: `${lat.toFixed(6)},${lng.toFixed(6)},9km`,
        language_code: 'en',
        depth: MAX_RANK,
      }]),
    })
    const d = await r.json()
    const t = d.tasks?.[0]
    return t?.status_code === 20000 ? (t.result?.[0]?.items || []) : []
  } catch { return [] }
}

function findRank(items, placeId, namePattern) {
  for (const i of items) {
    if ((placeId && i.place_id === placeId) || (namePattern && i.title?.toLowerCase().includes(namePattern.toLowerCase())))
      return i.rank_group
  }
  return null
}

async function scanGrid(acronym, seoLocName, centerLat, centerLng, placeId, namePattern, radiusMiles, keyword) {
  const grid     = makeGrid(centerLat, centerLng, radiusMiles)
  const spacingKm = (radiusMiles / 2) * KM_PER_MILE
  const pts      = []

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
    [acronym, seoLocName, keyword, centerLat, centerLng, GRID_SIZE, spacingKm, TODAY, JSON.stringify(pts), radiusMiles]
  )

  const ranked = pts.filter(p => p.rank != null)
  const avg    = ranked.length ? (ranked.reduce((s, p) => s + p.rank, 0) / ranked.length).toFixed(1) : '-'
  return { ranked: ranked.length, total: pts.length, avg }
}

async function main() {
  console.log(`🗺  SEO Heatmap Weekly Run — ${TODAY}${TARGET ? ` (${TARGET} only)` : ''}\n`)

  // Load all GBP locations with valid coordinates for SEO-active clients
  const locsRes = await pool.query(`
    SELECT
      gl."clientAcronym" AS acronym,
      gl."locationName"  AS gbp_loc_name,
      gl."gbpPlaceId"    AS place_id,
      (gl."liveDataSnapshot"->>'latitude')::float  AS lat,
      (gl."liveDataSnapshot"->>'longitude')::float AS lng,
      cp."companyName"
    FROM "GBPLocation" gl
    JOIN "ClientProfile" cp ON cp.acronym = gl."clientAcronym"
    WHERE cp."hasSEO" = true
      AND cp.status   = 'active'
      AND (gl."liveDataSnapshot"->>'latitude') IS NOT NULL
      AND (gl."liveDataSnapshot"->>'latitude')::float NOT BETWEEN 36.8 AND 36.9  -- filter out known bad seed value
      ${TARGET ? `AND gl."clientAcronym" = '${TARGET}'` : ''}
    ORDER BY gl."clientAcronym", gl."locationName"
  `)

  if (locsRes.rows.length === 0) {
    console.log('No locations with valid coordinates found.')
    await pool.end(); return
  }

  // For each GBP location, find the best matching SEO location name
  // (SEO snapshots use short names like "Eastside" vs GBP "The Eastside Preschool by Child Time")
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

  function matchSEOName(acronym, gbpLocName) {
    const seoLocs = seoLocMap[acronym] || []
    // Try: SEO name is substring of GBP name (e.g. "Eastside" in "The Eastside Preschool by Child Time")
    for (const seo of seoLocs) {
      if (seo && gbpLocName?.toLowerCase().includes(seo.toLowerCase())) return seo
    }
    // Try reverse: any word in GBP name matches SEO name
    for (const seo of seoLocs) {
      const words = (seo || '').toLowerCase().split(/\s+/).filter(w => w.length > 3)
      if (words.some(w => gbpLocName?.toLowerCase().includes(w))) return seo
    }
    // Fallback: use first SEO location name (single-location clients)
    return seoLocs[0] || gbpLocName || ''
  }

  let totalCost = 0
  let currentAcronym = null

  console.log(`Found ${locsRes.rows.length} location(s) to scan\n`)

  for (const loc of locsRes.rows) {
    if (loc.acronym !== currentAcronym) {
      currentAcronym = loc.acronym
      console.log(`→ ${loc.acronym} (${loc.companyName})`)
    }

    const seoLocName  = matchSEOName(loc.acronym, loc.gbp_loc_name)
    const namePattern = loc.companyName?.split(' ').slice(0, 2).join(' ')
    const locCost     = RADII.length * KEYWORDS.length * GRID_SIZE * GRID_SIZE * 0.002
    totalCost += locCost

    console.log(`  📍 ${loc.gbp_loc_name} → SEO: "${seoLocName}" (est. $${locCost.toFixed(2)})`)

    for (const radius of RADII) {
      for (const kw of KEYWORDS) {
        process.stdout.write(`    ${radius}mi ${kw}: `)
        const { ranked, total, avg } = await scanGrid(
          loc.acronym, seoLocName,
          loc.lat, loc.lng,
          loc.place_id, namePattern,
          radius, kw
        )
        console.log(`${ranked}/${total} ranked | avg: ${avg}`)
      }
    }
  }

  console.log(`\n✅ Done! Est. total cost: $${totalCost.toFixed(2)}`)
  await pool.end()
}

main().catch(async e => {
  console.error('Fatal:', e.message)
  await pool.end()
  process.exit(1)
})
