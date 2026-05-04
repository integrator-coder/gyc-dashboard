import { NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export const dynamic = 'force-dynamic'

export async function GET(req, { params }) {
  try {
    const { acronym } = await params
    const acr = acronym.toUpperCase()

    const [snapshotsRes, gbpRes, dfseoHistRes, dfseoKwRes, heatmapRes, gbpLocRes] = await Promise.all([
      pool.query(
        `SELECT * FROM "ClientSEOSnapshot"
         WHERE "clientAcronym" = $1
         ORDER BY "scanDate" DESC, "locationName" ASC, "keywordGroup" ASC`,
        [acr]
      ),
      pool.query(
        `SELECT * FROM "ClientSEOGBPMonthly"
         WHERE "clientAcronym" = $1
         ORDER BY month DESC, "locationName" ASC`,
        [acr]
      ),
      pool.query(
        `SELECT * FROM "ClientDFSEOSnapshot"
         WHERE "clientAcronym" = $1
         ORDER BY "snapshotDate" ASC`,
        [acr]
      ),
      pool.query(
        `SELECT * FROM "ClientDFSEOKeyword"
         WHERE "clientAcronym" = $1
         ORDER BY position ASC, "searchVolume" DESC
         LIMIT 50`,
        [acr]
      ),
      pool.query(
        `SELECT "locationName", keyword, "centerLat", "centerLng", "gridSize", "spacingKm", "scanDate", points
         FROM "ClientSEOHeatmap"
         WHERE "clientAcronym" = $1
         ORDER BY "scanDate" DESC, "locationName" ASC, keyword ASC`,
        [acr]
      ),
      pool.query(
        `SELECT "locationName", "gbpPlaceId",
                ("liveDataSnapshot"->>'rating')::float   AS rating,
                ("liveDataSnapshot"->>'reviewCount')::int AS "reviewCount",
                "liveDataSnapshot"->>'address'            AS address
         FROM "GBPLocation"
         WHERE "clientAcronym" = $1 AND "liveDataSnapshot" IS NOT NULL
         ORDER BY "locationName" ASC`,
        [acr]
      ),
    ])

    const snapshots = snapshotsRes.rows
    const gbpMonthly = gbpRes.rows
    const dfseoHistory = dfseoHistRes.rows
    const dfseoKeywords = dfseoKwRes.rows
    const heatmaps   = heatmapRes.rows
    const gbpLocations = gbpLocRes.rows

    // Distinct locations (ordered: non-empty first, then "")
    const locationSet = new Set(snapshots.map((s) => s.locationName))
    const locations = [...locationSet].sort((a, b) => {
      if (!a && b) return 1
      if (a && !b) return -1
      return a.localeCompare(b)
    })

    // Latest snapshot per location per group
    const latestByLocation = {}
    for (const loc of locations) {
      const primary = snapshots.find(
        (s) => s.locationName === loc && s.keywordGroup === 'primary'
      )
      const best = snapshots.find(
        (s) => s.locationName === loc && s.keywordGroup === 'best'
      )
      latestByLocation[loc] = { primary: primary || null, best: best || null }
    }

    // Latest GBP per location (last 2 months)
    const gbpByLocation = {}
    const allGBPLocations = [...new Set(gbpMonthly.map((r) => r.locationName))]
    for (const loc of allGBPLocations) {
      gbpByLocation[loc] = gbpMonthly.filter((r) => r.locationName === loc).slice(0, 2)
    }

    // DataForSEO current (latest snapshot)
    const dfseoLatest = dfseoHistory.length > 0 ? dfseoHistory[dfseoHistory.length - 1] : null
    const dfseoPrev   = dfseoHistory.length > 1 ? dfseoHistory[dfseoHistory.length - 2] : null

    return NextResponse.json({
      snapshots,
      gbpMonthly,
      locations,
      latestByLocation,
      gbpByLocation,
      dfseoHistory,
      dfseoKeywords,
      dfseoLatest,
      dfseoPrev,
      heatmaps,
      gbpLocations,
    })
  } catch (e) {
    console.error('[SEO API]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
