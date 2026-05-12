import { NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const CENSUS_KEY = process.env.CENSUS_API_KEY || 'b35158bfd9e38593a6d0a5d2456fb2c25b3986ad'

export const dynamic = 'force-dynamic'

const GRID_SIZE = 7
const RADIUS_MILES = 3
const KM_PER_DEGREE_LAT = 111.0

// ── DB migration ───────────────────────────────────────────────────────────

async function ensureTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "ClientIncomeHeatmap" (
      id BIGSERIAL PRIMARY KEY,
      "tenantId" TEXT NOT NULL DEFAULT 'gyc',
      "clientAcronym" TEXT NOT NULL,
      "gbpLocationId" INTEGER,
      "locationName" TEXT,
      "centerLat" NUMERIC(10,7),
      "centerLng" NUMERIC(10,7),
      "gridSize" INTEGER DEFAULT 7,
      "radiusMiles" INTEGER DEFAULT 3,
      points JSONB NOT NULL,
      "computedAt" TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "CIH_loc_idx"
      ON "ClientIncomeHeatmap" ("tenantId", "gbpLocationId")
  `)
}

// ── Helpers ────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function generateGridPoints(centerLat, centerLng) {
  const half = Math.floor(GRID_SIZE / 2)
  const spacingKm = (RADIUS_MILES * 1.609) / half
  const points = []
  for (let r = -half; r <= half; r++) {
    for (let c = -half; c <= half; c++) {
      const ptLat = centerLat + (r * spacingKm) / KM_PER_DEGREE_LAT
      const ptLng = centerLng + (c * spacingKm) / (KM_PER_DEGREE_LAT * Math.cos(centerLat * Math.PI / 180))
      points.push({ row: r, col: c, lat: ptLat, lng: ptLng })
    }
  }
  return points
}

async function getTractForPoint(lat, lng) {
  try {
    const url =
      `https://geocoding.geo.census.gov/geocoder/geographies/coordinates` +
      `?x=${lng}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current` +
      `&layers=Census%20Tracts&format=json`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    const tract = data?.result?.geographies?.['Census Tracts']?.[0]
    if (!tract) return null
    const state  = String(tract.STATE).padStart(2, '0')
    const county = String(tract.COUNTY).padStart(3, '0')
    const tr     = String(tract.TRACT).padStart(6, '0')
    return { state, county, tract: tr, tractId: state + county + tr }
  } catch {
    return null
  }
}

async function getIncomeForTract(state, county, tract) {
  try {
    const url =
      `https://api.census.gov/data/2024/acs/acs5` +
      `?get=B19013_001E&for=tract:${tract}&in=state:${state}%20county:${county}&key=${CENSUS_KEY}`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    if (!data || data.length < 2) return null
    const idx    = data[0].indexOf('B19013_001E')
    const income = parseInt(data[1][idx])
    return income > 0 ? income : null
  } catch {
    return null
  }
}

async function computeIncomeGrid(centerLat, centerLng) {
  const rawPoints = generateGridPoints(centerLat, centerLng)

  // Geocode each point with 200ms rate limiting
  const geocodedPoints = []
  for (const pt of rawPoints) {
    const tractInfo = await getTractForPoint(pt.lat, pt.lng)
    geocodedPoints.push({ ...pt, tractInfo })
    await sleep(200)
  }

  // Deduplicate tracts
  const tractMap = new Map()
  for (const pt of geocodedPoints) {
    if (pt.tractInfo?.tractId && !tractMap.has(pt.tractInfo.tractId)) {
      tractMap.set(pt.tractInfo.tractId, pt.tractInfo)
    }
  }

  console.log(`[IncomeHeatmap] ${tractMap.size} unique tracts found for (${centerLat}, ${centerLng})`)

  // Fetch income for all unique tracts in parallel
  const incomeMap = new Map()
  await Promise.all(
    Array.from(tractMap.entries()).map(async ([tractId, info]) => {
      const income = await getIncomeForTract(info.state, info.county, info.tract)
      incomeMap.set(tractId, income)
    })
  )

  // Build final points array
  const finalPoints = geocodedPoints.map(pt => ({
    row: pt.row,
    col: pt.col,
    lat: Math.round(pt.lat * 100000) / 100000,
    lng: Math.round(pt.lng * 100000) / 100000,
    medianIncome: pt.tractInfo ? (incomeMap.get(pt.tractInfo.tractId) ?? null) : null,
    tractId: pt.tractInfo?.tractId ?? null,
  }))

  const validIncomes = finalPoints.map(p => p.medianIncome).filter(v => v != null)
  const minIncome = validIncomes.length ? Math.min(...validIncomes) : null
  const maxIncome = validIncomes.length ? Math.max(...validIncomes) : null
  const avgIncome = validIncomes.length
    ? Math.round(validIncomes.reduce((a, b) => a + b, 0) / validIncomes.length)
    : null

  return { finalPoints, minIncome, maxIncome, avgIncome }
}

function summarize(points) {
  const validIncomes = (points || []).map(p => p.medianIncome).filter(v => v != null)
  return {
    minIncome: validIncomes.length ? Math.min(...validIncomes) : null,
    maxIncome: validIncomes.length ? Math.max(...validIncomes) : null,
    avgIncome: validIncomes.length
      ? Math.round(validIncomes.reduce((a, b) => a + b, 0) / validIncomes.length)
      : null,
  }
}

// ── GET handler ────────────────────────────────────────────────────────────

export async function GET(req, { params }) {
  const client = await pool.connect()
  try {
    const { acronym } = await params
    const acr = acronym.toUpperCase()

    await ensureTable(client)

    // Get GBP locations with coordinates
    const locRes = await client.query(
      `SELECT id, "locationName", "tenantId",
              "liveDataSnapshot"
       FROM "GBPLocation"
       WHERE "clientAcronym" = $1 AND "isActive" = true
       ORDER BY "locationName" ASC`,
      [acr]
    )

    if (locRes.rows.length === 0) {
      return NextResponse.json({ locations: [] })
    }

    const tenantId = locRes.rows[0].tenantId || acr
    const results  = []

    for (const loc of locRes.rows) {
      const snap      = loc.liveDataSnapshot || {}
      const centerLat = parseFloat(snap.latitude)
      const centerLng = parseFloat(snap.longitude)

      if (!centerLat || !centerLng || isNaN(centerLat) || isNaN(centerLng)) {
        results.push({ locationName: loc.locationName, error: 'No coordinates available' })
        continue
      }

      // Check cache (30 days)
      const cached = await client.query(
        `SELECT * FROM "ClientIncomeHeatmap"
         WHERE "tenantId" = $1 AND "gbpLocationId" = $2
           AND "computedAt" > NOW() - INTERVAL '30 days'
         LIMIT 1`,
        [tenantId, loc.id]
      )

      if (cached.rows.length > 0) {
        const row    = cached.rows[0]
        const points = Array.isArray(row.points) ? row.points : JSON.parse(row.points)
        const { minIncome, maxIncome, avgIncome } = summarize(points)
        results.push({
          locationName: row.locationName,
          centerLat:    parseFloat(row.centerLat),
          centerLng:    parseFloat(row.centerLng),
          gridSize:     row.gridSize,
          radiusMiles:  row.radiusMiles,
          points,
          minIncome,
          maxIncome,
          avgIncome,
          cached: true,
        })
        continue
      }

      // Compute fresh
      try {
        console.log(`[IncomeHeatmap] Computing grid for ${loc.locationName} (${centerLat}, ${centerLng})`)
        const { finalPoints, minIncome, maxIncome, avgIncome } =
          await computeIncomeGrid(centerLat, centerLng)

        await client.query(
          `INSERT INTO "ClientIncomeHeatmap"
             ("tenantId", "clientAcronym", "gbpLocationId", "locationName",
              "centerLat", "centerLng", "gridSize", "radiusMiles", points, "computedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
           ON CONFLICT ("tenantId", "gbpLocationId") DO UPDATE
             SET points = EXCLUDED.points,
                 "computedAt" = NOW(),
                 "locationName" = EXCLUDED."locationName",
                 "centerLat" = EXCLUDED."centerLat",
                 "centerLng" = EXCLUDED."centerLng"`,
          [tenantId, acr, loc.id, loc.locationName,
           centerLat, centerLng, GRID_SIZE, RADIUS_MILES,
           JSON.stringify(finalPoints)]
        )

        results.push({
          locationName: loc.locationName,
          centerLat,
          centerLng,
          gridSize:    GRID_SIZE,
          radiusMiles: RADIUS_MILES,
          points:      finalPoints,
          minIncome,
          maxIncome,
          avgIncome,
          cached: false,
        })
      } catch (err) {
        console.error(`[IncomeHeatmap] Error for ${loc.locationName}:`, err.message)
        results.push({ locationName: loc.locationName, error: `Compute failed: ${err.message}` })
      }
    }

    return NextResponse.json({ locations: results })
  } catch (e) {
    console.error('[IncomeHeatmap API]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  } finally {
    client.release()
  }
}
