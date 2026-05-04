#!/usr/bin/env node
/**
 * sync-seo-heatmaps.js
 * Generates local rank heatmaps for SEO clients using DataForSEO Maps SERP API.
 *
 * For each location: queries a 5×5 grid of lat/lng points, finds the client's
 * business rank at each point, stores as a color-coded heatmap in ClientSEOHeatmap.
 *
 * Cost: $0.002/point × 25 points × 2 keywords × N locations
 *   CTI (2 locs): ~$0.20   |   All 24 clients (avg 1 loc): ~$2.40/month
 *
 * Run: node scripts/sync-seo-heatmaps.js
 * Run for one client: node scripts/sync-seo-heatmaps.js CTI
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') })

const { Pool } = require('pg')
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const AUTH = Buffer.from(`${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`).toString('base64')
const HEADERS = { 'Authorization': `Basic ${AUTH}`, 'Content-Type': 'application/json' }

const GRID_SIZE    = 5         // 5×5 grid
const KM_PER_MILE  = 1.60934
const KEYWORDS     = ['daycare', 'preschool']
const MAX_RANK     = 20        // rank 21+ = "not found"
// Radius options: each step = radiusMiles / 2 (half-grid)
const RADIUS_OPTIONS = [3, 5]  // miles
const DEFAULT_RADIUS = 3       // miles — used when running without --radius flag

// Generate grid points around a center lat/lng
function generateGrid(centerLat, centerLng, gridSize, spacingKm) {
  const points = []
  const latDeg  = spacingKm / 111.32               // 1km in degrees latitude
  const lngDeg  = spacingKm / (111.32 * Math.cos(centerLat * Math.PI / 180))
  const half = Math.floor(gridSize / 2)

  for (let row = -half; row <= half; row++) {
    for (let col = -half; col <= half; col++) {
      points.push({
        row, col,
        lat: centerLat + row * latDeg,
        lng: centerLng + col * lngDeg,
      })
    }
  }
  return points
}

// Query a single grid point (sequential — Maps live endpoint doesn't support reliable batching)
async function queryMapsRank(lat, lng, keyword) {
  const r = await fetch('https://api.dataforseo.com/v3/serp/google/maps/live/advanced', {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify([{
      keyword,
      location_coordinate: `${lat.toFixed(6)},${lng.toFixed(6)},9km`,
      language_code: 'en',
      depth: MAX_RANK,
    }]),
  })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const data = await r.json()
  const task = data.tasks?.[0]
  if (task?.status_code !== 20000) return []
  return task.result?.[0]?.items || []
}

// Find the client's rank in a Maps result list by placeId or name pattern
function findRank(items, placeId, namePattern) {
  for (const item of items) {
    const matchesId   = placeId && item.place_id === placeId
    const matchesName = namePattern && item.title?.toLowerCase().includes(namePattern.toLowerCase())
    if (matchesId || matchesName) return item.rank_group
  }
  return null // not in top MAX_RANK results
}

async function scanLocation(acronym, locationName, centerLat, centerLng, placeId, namePattern, radiusMiles = DEFAULT_RADIUS) {
  const spacingKm  = (radiusMiles / 2) * KM_PER_MILE   // step size so edge = radiusMiles from center
  const gridPoints = generateGrid(centerLat, centerLng, GRID_SIZE, spacingKm)
  const today = new Date().toISOString().slice(0, 10)

  for (const keyword of KEYWORDS) {
    console.log(`    [${keyword}] Scanning ${gridPoints.length}-point grid...`)

    try {
      const points = []
      let ranked = 0

      for (const p of gridPoints) {
        const items = await queryMapsRank(p.lat, p.lng, keyword)
        const rank  = findRank(items, placeId, namePattern)
        if (rank != null) ranked++
        points.push({ row: p.row, col: p.col, lat: p.lat, lng: p.lng, rank })
        // Small delay between requests to avoid rate limits
        await new Promise(r => setTimeout(r, 150))
      }

      const ranked  = points.filter(p => p.rank != null).length
      const avgRank = points.filter(p => p.rank != null)
        .reduce((sum, p) => sum + p.rank, 0) / (ranked || 1)

      console.log(`      ✓ ${ranked}/${points.length} points ranked | avg rank: ${avgRank.toFixed(1)}`)

      // Upsert into DB
      await pool.query(
        `INSERT INTO "ClientSEOHeatmap"
          ("clientAcronym","locationName","keyword","centerLat","centerLng","gridSize","spacingKm","scanDate","points","radiusMiles")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT ("clientAcronym","locationName","keyword","scanDate","radiusMiles")
         DO UPDATE SET points=$9, "centerLat"=$4, "centerLng"=$5`,
        [acronym, locationName, keyword, centerLat, centerLng, GRID_SIZE, spacingKm, today, JSON.stringify(points), radiusMiles]
      )

      // Small pause between keywords
      await new Promise(r => setTimeout(r, 500))
    } catch (e) {
      console.error(`      ✗ Failed:`, e.message)
    }
  }
}

async function main() {
  const targetAcronym = process.argv[2]?.toUpperCase() || null
  console.log(`🗺  Generating SEO heatmaps${targetAcronym ? ` for ${targetAcronym}` : ' for all SEO clients'}...\n`)

  // Get locations from GBPLocation table
  const locsRes = await pool.query(
    `SELECT gl."clientAcronym", gl."locationName", 
            (gl."liveDataSnapshot"->>'latitude')::float  AS lat,
            (gl."liveDataSnapshot"->>'longitude')::float AS lng,
            gl."gbpPlaceId",
            cp."companyName"
     FROM "GBPLocation" gl
     JOIN "ClientProfile" cp ON cp.acronym = gl."clientAcronym"
     WHERE cp."hasSEO" = true
       AND cp.status = 'active'
       AND gl."liveDataSnapshot" IS NOT NULL
       AND (gl."liveDataSnapshot"->>'latitude') IS NOT NULL
       ${targetAcronym ? `AND gl."clientAcronym" = '${targetAcronym}'` : ''}
     ORDER BY gl."clientAcronym", gl."locationName"`
  )

  if (locsRes.rows.length === 0) {
    console.log('No locations found with lat/lng data.')
    await pool.end(); return
  }

  console.log(`Found ${locsRes.rows.length} locations to scan\n`)

  let totalCost = 0
  let currentAcronym = null

  for (const loc of locsRes.rows) {
    if (loc.clientAcronym !== currentAcronym) {
      currentAcronym = loc.clientAcronym
      console.log(`→ ${loc.clientAcronym} (${loc.companyName})`)
    }

    if (!loc.lat || !loc.lng) {
      console.log(`  📍 ${loc.locationName || 'Main'} — ⚠ No coordinates, skipping`)
      skipped++
      continue
    }

    const namePattern = loc.companyName?.split(' ').slice(0, 2).join(' ')
    const estimatedCost = GRID_SIZE * GRID_SIZE * KEYWORDS.length * RADIUS_OPTIONS.length * 0.002
    totalCost += estimatedCost
    console.log(`  📍 ${loc.locationName || 'Main'} @ ${loc.lat?.toFixed(4)},${loc.lng?.toFixed(4)} (est. $${estimatedCost.toFixed(3)})`)

    for (const radiusMiles of RADIUS_OPTIONS) {
      console.log(`    [${radiusMiles}mi radius]`)
      await scanLocation(
        loc.clientAcronym,
        loc.locationName || '',
        loc.lat,
        loc.lng,
        loc.gbpPlaceId,
        namePattern,
        radiusMiles
      )
    }

    // Pause between locations to stay within rate limits
    await new Promise(r => setTimeout(r, 1000))
  }

  console.log(`\n✅ Done! Estimated total cost: $${totalCost.toFixed(3)}`)
  await pool.end()
}

main().catch(async (e) => {
  console.error('Fatal:', e.message)
  await pool.end()
  process.exit(1)
})
