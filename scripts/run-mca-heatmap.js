#!/usr/bin/env node
/**
 * run-mca-heatmap.js — One-off heatmap scan for MCA with proper timeouts
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') })

const { Pool } = require('pg')
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const AUTH = Buffer.from(`${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`).toString('base64')
const H    = { 'Authorization': `Basic ${AUTH}`, 'Content-Type': 'application/json' }

const ACRONYM     = 'MCA'
const CENTER_LAT  = 25.7542589
const CENTER_LNG  = -80.34827159999999
const PLACE_ID    = 'ChIJa0LgacO42YgRBu_AnCOHMxc'
const SEO_LOC     = "Montessori Children's Academy"
const GRID_SIZE   = 5
const KM_PER_MILE = 1.60934
const KEYWORDS    = ['daycare', 'preschool']
const RADII       = [3, 5]
const MAX_RANK    = 20
const TODAY       = new Date().toISOString().slice(0, 10)
const FETCH_TIMEOUT_MS = 10000

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
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const r = await fetch('https://api.dataforseo.com/v3/serp/google/maps/live/advanced', {
      method: 'POST',
      headers: H,
      signal: controller.signal,
      body: JSON.stringify([{
        keyword: kw,
        location_coordinate: `${lat.toFixed(6)},${lng.toFixed(6)},9km`,
        language_code: 'en',
        depth: MAX_RANK,
      }]),
    })
    clearTimeout(timer)
    const d = await r.json()
    const t = d.tasks?.[0]
    return t?.status_code === 20000 ? (t.result?.[0]?.items || []) : []
  } catch (e) {
    clearTimeout(timer)
    if (e.name === 'AbortError') process.stdout.write('T')
    return []
  }
}

function findRank(items, placeId, namePattern) {
  for (const i of items) {
    if ((placeId && i.place_id === placeId) ||
        (namePattern && i.title?.toLowerCase().includes(namePattern.toLowerCase())))
      return i.rank_group
  }
  return null
}

async function scanGrid(radiusMiles, keyword) {
  const grid      = makeGrid(CENTER_LAT, CENTER_LNG, radiusMiles)
  const spacingKm = (radiusMiles / 2) * KM_PER_MILE
  const pts       = []

  process.stdout.write(`    ${radiusMiles}mi ${keyword}: `)
  let done = 0
  for (const p of grid) {
    const items = await queryRank(p.lat, p.lng, keyword)
    const rank  = findRank(items, PLACE_ID, SEO_LOC)
    pts.push({ row: p.row, col: p.col, lat: p.lat, lng: p.lng, rank })
    process.stdout.write('.')
    done++
    await new Promise(r => setTimeout(r, 200))
  }

  await pool.query(
    `INSERT INTO "ClientSEOHeatmap"
      ("clientAcronym","locationName","keyword","centerLat","centerLng","gridSize","spacingKm","scanDate","points","radiusMiles")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT ("clientAcronym","locationName","keyword","scanDate","radiusMiles")
     DO UPDATE SET points=$9`,
    [ACRONYM, SEO_LOC, keyword, CENTER_LAT, CENTER_LNG, GRID_SIZE, spacingKm, TODAY, JSON.stringify(pts), radiusMiles]
  )

  const ranked = pts.filter(p => p.rank != null)
  const avg    = ranked.length ? (ranked.reduce((s, p) => s + p.rank, 0) / ranked.length).toFixed(1) : '-'
  console.log(` ${ranked.length}/${pts.length} ranked, avg pos: ${avg}`)
  return pts
}

async function main() {
  console.log(`\n🗺  MCA Heatmap Scan — ${TODAY}`)
  console.log(`   Center: ${CENTER_LAT}, ${CENTER_LNG}`)
  console.log(`   Place ID: ${PLACE_ID}\n`)

  for (const radius of RADII) {
    for (const kw of KEYWORDS) {
      await scanGrid(radius, kw)
    }
  }

  console.log('\n✅ Done! MCA heatmap saved to DB.')
  await pool.end()
}

main().catch(e => { console.error(e.message); process.exit(1) })
