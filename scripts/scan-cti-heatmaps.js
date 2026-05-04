#!/usr/bin/env node
// One-shot targeted CTI heatmap scan — robust, no deletes, picks up missing combos
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') })

const { Pool } = require('pg')
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const AUTH = Buffer.from(`${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`).toString('base64')
const H = { 'Authorization': `Basic ${AUTH}`, 'Content-Type': 'application/json' }
const KM = 1.60934

const LOCATIONS = [
  { name: 'Second Avenues', lat: 40.7715, lng: -111.8585, pid: 'ChIJdyA4dH31UocRviCt_RVugKs', match: 'second avenues' },
  { name: 'Eastside',       lat: 40.6996, lng: -111.8445, pid: 'ChIJrX0B_c1hUocRGQHnC8FvRRs', match: 'eastside preschool' },
]
const RADII   = [3, 5]
const KEYWORDS = ['daycare', 'preschool']
const TODAY   = new Date().toISOString().slice(0, 10)

function makeGrid(lat, lng, radiusMiles) {
  const s = (radiusMiles / 2) * KM
  const ld = s / 111.32
  const ldd = s / (111.32 * Math.cos(lat * Math.PI / 180))
  const pts = []
  for (let r = -2; r <= 2; r++)
    for (let c = -2; c <= 2; c++)
      pts.push({ row: r, col: c, lat: lat + r * ld, lng: lng + c * ldd })
  return pts
}

async function queryRank(lat, lng, kw) {
  try {
    const r = await fetch('https://api.dataforseo.com/v3/serp/google/maps/live/advanced', {
      method: 'POST', headers: H,
      body: JSON.stringify([{ keyword: kw, location_coordinate: `${lat.toFixed(6)},${lng.toFixed(6)},9km`, language_code: 'en', depth: 20 }])
    })
    const d = await r.json()
    const t = d.tasks?.[0]
    return t?.status_code === 20000 ? (t.result?.[0]?.items || []) : []
  } catch { return [] }
}

function findRank(items, pid, match) {
  for (const i of items) {
    if ((pid && i.place_id === pid) || (match && i.title?.toLowerCase().includes(match))) return i.rank_group
  }
  return null
}

async function upsert(loc, kw, radiusMiles, points) {
  const spacingKm = (radiusMiles / 2) * KM
  await pool.query(
    `INSERT INTO "ClientSEOHeatmap"
      ("clientAcronym","locationName",keyword,"centerLat","centerLng","gridSize","spacingKm","scanDate",points,"radiusMiles")
     VALUES ($1,$2,$3,$4,$5,5,$6,$7,$8,$9)
     ON CONFLICT ("clientAcronym","locationName",keyword,"scanDate","radiusMiles")
     DO UPDATE SET points=$8`,
    ['CTI', loc.name, kw, loc.lat, loc.lng, spacingKm, TODAY, JSON.stringify(points), radiusMiles]
  )
}

async function main() {
  // Find what's already done
  const existing = await pool.query(
    `SELECT "locationName", keyword, "radiusMiles" FROM "ClientSEOHeatmap"
     WHERE "clientAcronym"='CTI' AND "scanDate"=$1`, [TODAY]
  )
  const done = new Set(existing.rows.map(r => `${r.locationName}|${r.keyword}|${r.radiusMiles}`))
  console.log(`Already done: ${done.size}/8\n`)

  for (const loc of LOCATIONS) {
    for (const rm of RADII) {
      for (const kw of KEYWORDS) {
        const key = `${loc.name}|${kw}|${rm}`
        if (done.has(key)) { console.log(`  ✓ SKIP ${loc.name} ${rm}mi ${kw} (already done)`); continue }

        const grid = makeGrid(loc.lat, loc.lng, rm)
        const pts = []
        process.stdout.write(`  ${loc.name} ${rm}mi ${kw}: `)

        for (const p of grid) {
          const items = await queryRank(p.lat, p.lng, kw)
          const rank  = findRank(items, loc.pid, loc.match)
          pts.push({ row: p.row, col: p.col, lat: p.lat, lng: p.lng, rank })
          process.stdout.write(rank ? String(rank) : '.')
          await new Promise(r => setTimeout(r, 250))
        }

        const ranked = pts.filter(p => p.rank != null)
        const avg = ranked.length ? (ranked.reduce((s, p) => s + p.rank, 0) / ranked.length).toFixed(1) : '-'
        console.log(` | ${ranked.length}/25 ranked | avg: ${avg}`)

        await upsert(loc, kw, rm, pts)
      }
    }
  }

  const final = await pool.query(
    `SELECT COUNT(*) FROM "ClientSEOHeatmap" WHERE "clientAcronym"='CTI' AND "scanDate"=$1`, [TODAY]
  )
  console.log(`\n✅ Done — ${final.rows[0].count}/8 CTI heatmaps in DB`)
  await pool.end()
}

main().catch(async e => { console.error('Error:', e.message); await pool.end(); process.exit(1) })
