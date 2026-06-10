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
  const auth = await requireApiUser(['ga', 'cx', 'admin', 'superadmin', 'manager'])
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

    const loc = rows[0]

    // ── Cascade: auto-populate SEO, Demographics, Market Intel ──────────
    // Run async so the UI gets an immediate response
    const locationId = loc.id
    const acr = acronym.toUpperCase()

    setImmediate(async () => {
      try {
        // 1. Get company name for seoLocationName (keyword search accuracy)
        const cpRes = await pool.query(
          `SELECT "companyName", "hasSEO" FROM "ClientProfile" WHERE acronym = $1`, [acr]
        )
        const cp = cpRes.rows[0]
        const seoLocName = cp?.companyName || locationName.trim()

        // 2. Set locationVerified, heatmapEnabled, seoLocationName
        await pool.query(
          `UPDATE "GBPLocation"
           SET "locationVerified" = $1,
               "heatmapEnabled"   = $2,
               "seoLocationName"  = $3,
               "updatedAt"        = NOW()
           WHERE id = $4`,
          [
            !!placeId,              // verified only if we resolved a placeId
            true,                   // always enable for prospect intel / SEO
            seoLocName,             // business name for accurate keyword searches
            locationId
          ]
        )

        // 3. Trigger DataForSEO live data refresh (populates liveDataSnapshot with
        //    address, addressInfo.zip for Demographics, rating/reviews for GBP/SEO)
        if (placeId || cid) {
          const AUTH = Buffer.from(
            `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
          ).toString('base64')
          const keyword = `${seoLocName} ${city || ''} ${state || ''}`.trim()
          const r = await fetch('https://api.dataforseo.com/v3/serp/google/maps/live/advanced', {
            method: 'POST',
            headers: { 'Authorization': `Basic ${AUTH}`, 'Content-Type': 'application/json' },
            body: JSON.stringify([{ keyword, location_code: 2840, language_code: 'en', depth: 10 }])
          })
          const d = await r.json()
          const items = (d.tasks?.[0]?.result?.[0]?.items || []).filter(i => i.type === 'maps_search')
          const childcareKw = ['child','daycare','day care','preschool','nursery','learning','academy','school','montessori','kids']
          const match = items.find(i => childcareKw.some(k => 
            i.title?.toLowerCase().includes(k) || i.category?.toLowerCase().includes(k)
          ))
          if (match) {
            const snap = {
              placeId: match.place_id, cid: match.cid?.toString(),
              rating: match.rating?.value, reviewCount: match.rating?.votes_count,
              ratingDistribution: match.rating?.rating_distribution,
              totalPhotos: match.total_photos, isClaimed: match.is_claimed,
              phone: match.phone, address: match.address,
              addressInfo: match.address_info || null,
              website: match.url, latitude: match.latitude, longitude: match.longitude,
              primaryCategory: match.category, additionalCategories: match.additional_categories || [],
              mainImage: match.main_image, keyword, resolvedAt: new Date().toISOString(),
              autoChecks: {
                isClaimed: match.is_claimed, ratingAbove4: (match.rating?.value || 0) >= 4,
                has50Reviews: (match.rating?.votes_count || 0) >= 50,
                phoneListened: !!match.phone, websiteLinked: !!match.url,
                hoursComplete: !!(match.work_time?.timetable),
                secondaryCategoriesSet: !!(match.additional_categories?.length)
              }
            }
            await pool.query(
              `UPDATE "GBPLocation"
               SET "liveDataSnapshot" = $1, "liveDataUpdatedAt" = NOW(),
                   "placeId"   = COALESCE($2, "placeId"),
                   "gbpPlaceId"= COALESCE($2, "gbpPlaceId"),
                   cid         = COALESCE($3, cid),
                   latitude    = COALESCE($4, latitude),
                   longitude   = COALESCE($5, longitude),
                   address     = COALESCE($6, address),
                   city        = COALESCE($7, city),
                   state       = COALESCE($8, state),
                   "locationVerified" = true
               WHERE id = $9`,
              [
                JSON.stringify(snap),
                match.place_id, match.cid?.toString(),
                match.latitude, match.longitude,
                match.address,
                match.address_info?.city || null,
                match.address_info?.region || null,
                locationId
              ]
            )
          }
        }
      } catch (e) {
        console.error('[add location cascade]', e.message)
      }
    })
    // ────────────────────────────────────────────────────────────────────

    return NextResponse.json({ 
      location: loc,
      resolved: !!placeId,
      message: placeId 
        ? `Location added and linked to Google Business Profile (place_id: ${placeId}). GBP data, heatmap, and demographics populating in background.`
        : 'Location added. GBP data will populate automatically once verified.'
    }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/clients/[acronym]/gbp/locations/add]', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to add location' 
    }, { status: 500 })
  }
}
