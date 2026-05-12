import { NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export const dynamic = 'force-dynamic'

// Haversine formula — returns distance in miles
function haversine(lat1, lon1, lat2, lon2) {
  const R = 3958.8 // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Parse Google regularOpeningHours into a simple { Mon, Tue, ... } map
function parseHours(regularOpeningHours) {
  if (!regularOpeningHours?.weekdayDescriptions) return null
  const days = {}
  for (const desc of regularOpeningHours.weekdayDescriptions) {
    const colon = desc.indexOf(':')
    if (colon === -1) continue
    const day = desc.slice(0, colon).trim().slice(0, 3) // "Mon", "Tue", etc.
    const hours = desc.slice(colon + 1).trim()
    days[day] = hours
  }
  return days
}

async function fetchNearbyCompetitors(lat, lng, ownPlaceIds, apiKey) {
  const fieldMask = [
    'places.id',
    'places.displayName',
    'places.formattedAddress',
    'places.rating',
    'places.userRatingCount',
    'places.regularOpeningHours',
    'places.internationalPhoneNumber',
    'places.websiteUri',
    'places.photos',
    'places.primaryTypeDisplayName',
    'places.location',
    'places.businessStatus',
    'places.priceLevel',
    'places.editorialSummary',
  ].join(',')

  const body = {
    includedTypes: ['child_care_agency', 'preschool'],
    maxResultCount: 20,
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: 8047, // ~5 miles
      },
    },
  }

  const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': fieldMask,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Places API error ${res.status}: ${text}`)
  }

  const data = await res.json()
  const places = data.places || []

  // Keywords that indicate a non-childcare result (Google miscategorization)
  const EXCLUDE_KEYWORDS = [
    'target', 'walmart', 'costco', 'kroger', 'safeway', 'gym', 'fitness',
    'ymca', 'crossfit', 'planet fitness', 'anytime fitness', 'snap fitness',
    'hospital', 'clinic', 'urgent care', 'dentist', 'pharmacy', 'cvs', 'walgreens',
    'church', 'library', 'community center', 'recreation center',
  ]

  const CHILDCARE_TYPES = [
    'child care', 'childcare', 'day care', 'daycare', 'preschool', 'nursery',
    'kindergarten', 'early childhood', 'early learning', 'montessori',
    'child development', 'kids', 'toddler',
  ]

  function isLikelyChildcare(place) {
    const name = (place.displayName?.text || '').toLowerCase()
    const type = (place.primaryTypeDisplayName?.text || '').toLowerCase()
    // Exclude obvious non-childcare names
    if (EXCLUDE_KEYWORDS.some(kw => name.includes(kw))) return false
    // If type is present, it should contain a childcare keyword
    if (type && !CHILDCARE_TYPES.some(kw => type.includes(kw))) return false
    return true
  }

  return places
    .filter(p => !ownPlaceIds.has(p.id))
    .filter(p => isLikelyChildcare(p))
    .map(p => {
      const pLat = p.location?.latitude
      const pLng = p.location?.longitude
      const distance = pLat != null && pLng != null ? haversine(lat, lng, pLat, pLng) : null

      return {
        placeId: p.id,
        name: p.displayName?.text || p.displayName || 'Unknown',
        address: p.formattedAddress || null,
        rating: p.rating || null,
        reviewCount: p.userRatingCount || 0,
        phone: p.internationalPhoneNumber || null,
        website: p.websiteUri || null,
        primaryType: p.primaryTypeDisplayName?.text || p.primaryTypeDisplayName || null,
        businessStatus: p.businessStatus || 'OPERATIONAL',
        distanceMiles: distance != null ? Math.round(distance * 10) / 10 : null,
        hours: parseHours(p.regularOpeningHours),
        photoCount: p.photos ? p.photos.length : 0,
        isOpen: p.regularOpeningHours?.openNow ?? (p.businessStatus === 'OPERATIONAL'),
        location: pLat != null ? { lat: pLat, lng: pLng } : null,
        editorialSummary: p.editorialSummary?.text || null,
      }
    })
    .map(comp => {
      // Threat score: rating quality × review volume × proximity
      // Higher = more competitive threat to the client
      const r = comp.rating || 3.0
      const reviews = comp.reviewCount || 0
      const dist = comp.distanceMiles || 5
      comp.threatScore = Math.round((r * Math.log10(reviews + 1)) / Math.max(dist, 0.1) * 10) / 10
      return comp
    })
    .sort((a, b) => b.threatScore - a.threatScore)
    .map((comp, i) => ({ ...comp, rank: i + 1 }))
}

export async function GET(req, { params }) {
  try {
    const { acronym } = await params
    const acr = acronym.toUpperCase()
    const apiKey = process.env.GOOGLE_PLACES_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: 'GOOGLE_PLACES_API_KEY not set' }, { status: 500 })
    }

    // Get all active GBP locations for this client
    const locRes = await pool.query(
      `SELECT id, "locationName", address, latitude, longitude, "gbpPlaceId", "placeId", "liveDataSnapshot"
       FROM "GBPLocation"
       WHERE "clientAcronym" = $1 AND "isActive" = true
       ORDER BY id ASC`,
      [acr]
    )

    const locations = locRes.rows
    if (locations.length === 0) {
      return NextResponse.json({ locations: [] })
    }

    // Build set of own place IDs to filter out
    const ownPlaceIds = new Set(
      locations.flatMap(l => [l.gbpPlaceId, l.placeId].filter(Boolean))
    )

    const CACHE_TTL_HOURS = 24

    const results = []

    for (const loc of locations) {
      // Resolve coordinates: prefer liveDataSnapshot lat/lng, fall back to column
      let lat = loc.latitude
      let lng = loc.longitude
      if (loc.liveDataSnapshot) {
        try {
          const snap = typeof loc.liveDataSnapshot === 'string'
            ? JSON.parse(loc.liveDataSnapshot)
            : loc.liveDataSnapshot
          if (snap.latitude) lat = parseFloat(snap.latitude)
          if (snap.longitude) lng = parseFloat(snap.longitude)
        } catch {}
      }

      if (!lat || !lng) {
        results.push({
          locationId: loc.id,
          locationName: loc.locationName,
          address: loc.address,
          lat: null,
          lng: null,
          competitors: [],
          scannedAt: null,
          error: 'No coordinates available',
        })
        continue
      }

      // Check cache
      const cacheRes = await pool.query(
        `SELECT id, competitors, "scannedAt"
         FROM "CompetitorScan"
         WHERE "clientAcronym" = $1 AND "locationId" = $2
         ORDER BY "scannedAt" DESC
         LIMIT 1`,
        [acr, loc.id]
      )

      let competitors
      let scannedAt

      const cacheRow = cacheRes.rows[0]
      const cacheAge = cacheRow
        ? (Date.now() - new Date(cacheRow.scannedAt).getTime()) / 3600000
        : Infinity

      if (cacheRow && cacheAge < CACHE_TTL_HOURS) {
        // Use cache
        competitors = Array.isArray(cacheRow.competitors)
          ? cacheRow.competitors
          : JSON.parse(cacheRow.competitors)
        scannedAt = cacheRow.scannedAt
      } else {
        // Fetch fresh data
        competitors = await fetchNearbyCompetitors(lat, lng, ownPlaceIds, apiKey)

        // Save to cache
        await pool.query(
          `INSERT INTO "CompetitorScan" ("clientAcronym", "locationId", "radiusMiles", competitors)
           VALUES ($1, $2, $3, $4)`,
          [acr, loc.id, 5, JSON.stringify(competitors)]
        )

        scannedAt = new Date().toISOString()
      }

      results.push({
        locationId: loc.id,
        locationName: loc.locationName,
        address: loc.address,
        lat,
        lng,
        competitors,
        scannedAt,
      })
    }

    return NextResponse.json({ locations: results })
  } catch (err) {
    console.error('[competitive-intel] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST with ?refresh=true forces a fresh scan
export async function POST(req, { params }) {
  try {
    const { acronym } = await params
    const acr = acronym.toUpperCase()
    const apiKey = process.env.GOOGLE_PLACES_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: 'GOOGLE_PLACES_API_KEY not set' }, { status: 500 })
    }

    const locRes = await pool.query(
      `SELECT id, "locationName", address, latitude, longitude, "gbpPlaceId", "placeId", "liveDataSnapshot"
       FROM "GBPLocation"
       WHERE "clientAcronym" = $1 AND "isActive" = true
       ORDER BY id ASC`,
      [acr]
    )

    const locations = locRes.rows
    if (locations.length === 0) {
      return NextResponse.json({ locations: [] })
    }

    const ownPlaceIds = new Set(
      locations.flatMap(l => [l.gbpPlaceId, l.placeId].filter(Boolean))
    )

    const results = []

    for (const loc of locations) {
      let lat = loc.latitude
      let lng = loc.longitude
      if (loc.liveDataSnapshot) {
        try {
          const snap = typeof loc.liveDataSnapshot === 'string'
            ? JSON.parse(loc.liveDataSnapshot)
            : loc.liveDataSnapshot
          if (snap.latitude) lat = parseFloat(snap.latitude)
          if (snap.longitude) lng = parseFloat(snap.longitude)
        } catch {}
      }

      if (!lat || !lng) {
        results.push({
          locationId: loc.id,
          locationName: loc.locationName,
          address: loc.address,
          lat: null, lng: null,
          competitors: [],
          scannedAt: null,
          error: 'No coordinates',
        })
        continue
      }

      const competitors = await fetchNearbyCompetitors(lat, lng, ownPlaceIds, apiKey)

      await pool.query(
        `INSERT INTO "CompetitorScan" ("clientAcronym", "locationId", "radiusMiles", competitors)
         VALUES ($1, $2, $3, $4)`,
        [acr, loc.id, 5, JSON.stringify(competitors)]
      )

      results.push({
        locationId: loc.id,
        locationName: loc.locationName,
        address: loc.address,
        lat,
        lng,
        competitors,
        scannedAt: new Date().toISOString(),
      })
    }

    return NextResponse.json({ locations: results })
  } catch (err) {
    console.error('[competitive-intel] POST Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
