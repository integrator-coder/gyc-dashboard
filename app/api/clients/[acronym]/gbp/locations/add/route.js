export const dynamic = 'force-dynamic'

/**
 * POST /api/clients/[acronym]/gbp/locations/add
 *
 * Add a new GBP location for this client using CID or place search.
 * Body: { locationName, gbpUrl }
 * Requires: ga, cx, admin, or superadmin role.
 */

import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/auth'
import { pool } from '@/lib/pg'

// Extract CID from Google Maps URL
function extractCID(url) {
  if (!url) return null
  const match = url.match(/[?&]cid=(\d+)/)
  return match ? match[1] : null
}

// Call Google Places API to resolve place_id
async function resolvePlaceId(cid, locationName, clientAcronym) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY not configured')

  let placeId = null
  let name = null
  let address = null
  let lat = null
  let lng = null

  // Try CID first
  if (cid) {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?cid=${cid}&key=${apiKey}&fields=place_id,name,formatted_address,geometry`
    const res = await fetch(url)
    const json = await res.json()
    
    if (json.status === 'OK' && json.result) {
      placeId = json.result.place_id
      name = json.result.name
      address = json.result.formatted_address
      lat = json.result.geometry?.location?.lat
      lng = json.result.geometry?.location?.lng
    }
  }

  // Fallback: findplacefromtext
  if (!placeId && locationName) {
    const query = `${locationName} ${clientAcronym}`
    const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&key=${apiKey}&fields=place_id,name,formatted_address,geometry`
    const res = await fetch(url)
    const json = await res.json()
    
    if (json.status === 'OK' && json.candidates?.[0]) {
      placeId = json.candidates[0].place_id
      name = json.candidates[0].name
      address = json.candidates[0].formatted_address
      lat = json.candidates[0].geometry?.location?.lat
      lng = json.candidates[0].geometry?.location?.lng
    }
  }

  return { placeId, name, address, lat, lng }
}

export async function POST(req, { params }) {
  const auth = await requireApiUser(['ga', 'cx', 'admin', 'superadmin'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { acronym } = await params
  const body = await req.json()
  const { locationName, gbpUrl } = body

  if (!locationName?.trim()) {
    return NextResponse.json({ error: 'locationName is required' }, { status: 400 })
  }

  try {
    // Extract CID from URL
    const cid = extractCID(gbpUrl)

    // Resolve place_id via Google Places API
    const { placeId, name, address, lat, lng } = await resolvePlaceId(
      cid,
      locationName.trim(),
      acronym.toUpperCase()
    )

    // Parse address if available
    let city = null
    let state = null
    if (address) {
      // Simple parsing: "123 Main St, City, ST 12345, USA"
      const parts = address.split(',').map(s => s.trim())
      if (parts.length >= 3) {
        city = parts[parts.length - 3]
        const stateZip = parts[parts.length - 2]
        state = stateZip.split(' ')[0]
      }
    }

    // Upsert location
    const { rows } = await pool.query(
      `INSERT INTO "GBPLocation"
         ("tenantId", "clientAcronym", "locationName", "gbpUrl", "placeId", "cid", 
          "address", "city", "state", "latitude", "longitude", "isActive", "updatedAt")
       VALUES ('gyc', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, NOW())
       ON CONFLICT ("tenantId", "clientAcronym", "locationName")
       DO UPDATE SET
         "gbpUrl"     = EXCLUDED."gbpUrl",
         "placeId"    = EXCLUDED."placeId",
         "cid"        = EXCLUDED."cid",
         "address"    = EXCLUDED."address",
         "city"       = EXCLUDED."city",
         "state"      = EXCLUDED."state",
         "latitude"   = EXCLUDED."latitude",
         "longitude"  = EXCLUDED."longitude",
         "isActive"   = TRUE,
         "updatedAt"  = NOW()
       RETURNING *`,
      [
        acronym.toUpperCase(),
        locationName.trim(),
        gbpUrl || null,
        placeId || null,
        cid || null,
        address || null,
        city || null,
        state || null,
        lat || null,
        lng || null,
      ]
    )

    return NextResponse.json({ 
      location: rows[0],
      resolved: !!placeId,
      message: placeId 
        ? `Location added and linked to Google Business Profile (place_id: ${placeId})`
        : 'Location added but could not auto-link to Google Business Profile. Please verify manually.'
    }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/clients/[acronym]/gbp/locations/add]', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to add location' 
    }, { status: 500 })
  }
}
