import { NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export const dynamic = 'force-dynamic'

// Known Salt Lake City ZIP centroids
const SLC_ZIP_CENTROIDS = {
  '84106': { lat: 40.699, lng: -111.844 },
  '84105': { lat: 40.714, lng: -111.832 },
  '84108': { lat: 40.722, lng: -111.813 },
  '84102': { lat: 40.768, lng: -111.865 },
  '84115': { lat: 40.685, lng: -111.891 },
  '84103': { lat: 40.771, lng: -111.858 },
  '84101': { lat: 40.760, lng: -111.889 },
  '84111': { lat: 40.760, lng: -111.875 },
}

// CTI Eastside location
const EASTSIDE = {
  name: 'Eastside Preschool',
  lat: 40.6996312,
  lng: -111.84449219999999,
  zip: '84106',
}

// Calculate distance between two lat/lng points (Haversine formula)
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 3959 // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export async function GET(req, { params }) {
  try {
    const { acronym } = await params
    const acr = acronym.toUpperCase()

    // 1. Fetch latest SEO heatmap data for Eastside
    const heatmapRes = await pool.query(
      `SELECT "locationName", keyword, "centerLat", "centerLng", "gridSize", "radiusMiles", points, "scanDate"
       FROM "ClientSEOHeatmap"
       WHERE "clientAcronym" = $1 AND "locationName" ILIKE '%eastside%'
       ORDER BY "scanDate" DESC
       LIMIT 1`,
      [acr]
    )

    let seoPoints = []
    if (heatmapRes.rows.length > 0) {
      const heatmap = heatmapRes.rows[0]
      const points = heatmap.points || []
      
      // Transform heatmap points to the format we need
      seoPoints = points.map(p => ({
        lat: p.lat,
        lng: p.lng,
        rank: p.rank,
        keyword: heatmap.keyword,
        col: p.col,
        row: p.row,
      }))
    }

    // 2. Fetch demographic data for CTI (income layer)
    const demoRes = await pool.query(
      `SELECT "locationName", zip, "medianHouseholdIncome", lat, lng
       FROM "ClientMarketIntelligence"
       WHERE "acronym" = $1
       ORDER BY year DESC`,
      [acr]
    )

    // 3. Build income demographic layer (ZIP polygons with income data)
    const incomeZips = []
    
    for (const demo of demoRes.rows) {
      const zipCode = demo.zip
      if (!zipCode) continue
      
      // Get ZIP centroid (use stored lat/lng or fallback to known centroids)
      let zipLat = demo.lat
      let zipLng = demo.lng
      
      if (!zipLat || !zipLng) {
        const centroid = SLC_ZIP_CENTROIDS[zipCode]
        if (centroid) {
          zipLat = centroid.lat
          zipLng = centroid.lng
        } else {
          continue // Skip if we don't have coordinates
        }
      }
      
      // Calculate distance from Eastside center
      const distance = calculateDistance(EASTSIDE.lat, EASTSIDE.lng, zipLat, zipLng)
      
      incomeZips.push({
        zip: zipCode,
        lat: zipLat,
        lng: zipLng,
        medianHouseholdIncome: demo.medianHouseholdIncome || 0,
        distance: Math.round(distance * 10) / 10,
      })
    }
    
    // 4. Build theoretical parent origin heatmap using distance-decay model
    // This is synthetic - representing likely parent distribution based on distance alone
    const parentOriginZones = []
    const weights = []
    
    for (const zip of incomeZips) {
      // Distance-decay model: closer = more parents
      // weight = 1 / (distance^2), with minimum distance of 0.5 miles to avoid infinity
      const weight = 1 / Math.pow(Math.max(zip.distance, 0.5), 2)
      
      weights.push(weight)
      parentOriginZones.push({
        zip: zip.zip,
        lat: zip.lat,
        lng: zip.lng,
        distance: zip.distance,
        weight: weight,
      })
    }
    
    // Normalize weights to sum to 100 (representing 100 theoretical parents)
    const totalWeight = weights.reduce((sum, w) => sum + w, 0)
    
    if (totalWeight > 0) {
      let assignedTotal = 0
      
      for (let i = 0; i < parentOriginZones.length; i++) {
        const normalizedWeight = (weights[i] / totalWeight) * 100
        
        // Round to nearest integer for the last zip, use Math.round for others
        if (i === parentOriginZones.length - 1) {
          parentOriginZones[i].parentCount = 100 - assignedTotal
        } else {
          parentOriginZones[i].parentCount = Math.round(normalizedWeight)
          assignedTotal += parentOriginZones[i].parentCount
        }
      }
    }

    return NextResponse.json({
      seoPoints,
      incomeZips,
      parentOriginZones,
      center: {
        lat: EASTSIDE.lat,
        lng: EASTSIDE.lng,
      },
      locationName: EASTSIDE.name,
    })
  } catch (e) {
    console.error('[Overlay Test API]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
