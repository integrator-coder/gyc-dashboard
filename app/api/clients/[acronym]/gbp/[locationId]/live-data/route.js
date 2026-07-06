export const dynamic = 'force-dynamic'

/**
 * GET /api/clients/[acronym]/gbp/[locationId]/live-data
 *
 * Fetches live GBP data for a location via DataForSEO Google Maps.
 * Stores the full snapshot + resolves Place ID on first call.
 *
 * Returns enriched GBP data including:
 *   rating, reviewCount, ratingDistribution, totalPhotos,
 *   isClaimed, hours, categories, phone, address, website,
 *   reviewSnippet, placeId, cid, mainImage
 */

import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/auth'
import { pool } from '@/lib/pg'

const DATAFORSEO_AUTH = Buffer.from(
  `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
).toString('base64')

function fmtHour(h, m) {
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

function parseHours(workHours) {
  if (!workHours?.timetable) return null
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const result = {}
  for (let i = 0; i < days.length; i++) {
    const slots = workHours.timetable[days[i]]
    if (!slots || slots.length === 0) {
      result[labels[i]] = 'Closed'
    } else {
      const s = slots[0]
      result[labels[i]] = `${fmtHour(s.open.hour, s.open.minute)} – ${fmtHour(s.close.hour, s.close.minute)}`
    }
  }
  return result
}

export async function GET(_req, { params }) {
  const auth = await requireApiUser(['ga', 'cx', 'admin', 'superadmin', 'manager'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { acronym, locationId } = await params
  const locId = parseInt(locationId, 10)
  if (!locId) return NextResponse.json({ error: 'Invalid locationId' }, { status: 400 })

  // Fetch location + client profile
  const { rows } = await pool.query(
    `SELECT gl.*, cp."companyName"
     FROM "GBPLocation" gl
     LEFT JOIN "ClientProfile" cp ON cp."tenantId" = 'gyc' AND cp.acronym = gl."clientAcronym"
     WHERE gl.id = $1 AND gl."tenantId" = 'gyc' AND gl."clientAcronym" = $2`,
    [locId, acronym.toUpperCase()]
  )
  if (!rows.length) return NextResponse.json({ error: 'Location not found' }, { status: 404 })
  const loc = rows[0]

  // Try to extract Place ID from stored gbpUrl if it's a real Maps URL
  function extractPlaceIdFromUrl(url) {
    if (!url) return null
    // Standard ChIJ place ID in path
    const placeMatch = url.match(/!1s(ChIJ[A-Za-z0-9_-]+)/)
    if (placeMatch) return placeMatch[1]
    // place_id= query param
    const qMatch = url.match(/place_id=(ChIJ[A-Za-z0-9_-]+)/)
    if (qMatch) return qMatch[1]
    // /g/ short-form place ID (e.g. !16s%2Fg%2F1th28x6x)
    const gMatch = url.match(/[!/]g[!/]([A-Za-z0-9_-]{6,})/)
    if (gMatch) return gMatch[1]  // DataForSEO accepts this
    return null
  }

  // Extract CID from ?cid=... URLs or hex CID embedded in path
  function extractCidFromUrl(url) {
    if (!url) return null
    // Numeric CID: ?cid=17676501490044768506
    const cidMatch = url.match(/[?&]cid=(\d+)/)
    if (cidMatch) return cidMatch[1]
    // Hex CID: 0x876c84382c3edfc1:0x66018279f58420f7 — convert second part to decimal
    const hexMatch = url.match(/0x[0-9a-f]+:(0x[0-9a-f]+)/i)
    if (hexMatch) {
      try { return BigInt(hexMatch[1]).toString(10) } catch { return null }
    }
    return null
  }

  const urlPlaceId = extractPlaceIdFromUrl(loc.gbpUrl)
  const urlCid = extractCidFromUrl(loc.gbpUrl)
  let resolvedPlaceId = loc.gbpPlaceId || urlPlaceId
  const resolvedCid = urlCid || null

  // Helper: follow a share.google short link and return the final URL
  async function resolveShareLink(url) {
    try {
      const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(5000) })
      return res.url
    } catch { return null }
  }

  // Build search keyword — prefer seoLocationName (business name) over locationName (which can be a street address)
  const searchKeyword = [
    loc.seoLocationName || loc.locationName || loc.companyName,
    loc.city,
    loc.state,
  ].filter(Boolean).join(' ')

  // Don't fetch unless we have a verified Place ID or a real Maps URL
  // Fuzzy name search returns wrong businesses — require explicit verification
  if (!resolvedPlaceId && !urlPlaceId) {
    const hasRealMapsUrl = loc.gbpUrl && (
      loc.gbpUrl.includes('maps.google.com') ||
      loc.gbpUrl.includes('google.com/maps')
    )
    if (!hasRealMapsUrl) {
      // Attempt to resolve share.google short links before giving up
      if (loc.gbpUrl && loc.gbpUrl.includes('share.google')) {
        const finalUrl = await resolveShareLink(loc.gbpUrl)
        if (finalUrl) {
          const sharePlaceId = extractPlaceIdFromUrl(finalUrl)
          if (sharePlaceId) {
            resolvedPlaceId = sharePlaceId
          }
        }
      }
      if (!resolvedPlaceId) {
        const isShareLink = loc.gbpUrl && loc.gbpUrl.includes('share.google')
        return NextResponse.json({
          status: 'unverified',
          message: isShareLink
            ? 'This location uses a Google share link. To enable live data, paste the full Google Maps URL (maps.google.com/...) or add the Place ID directly.'
            : 'Paste a Google Maps URL to enable accurate live data for this location.',
        }, { status: 200 })
      }
    }
  }

  try {
    const res = await fetch('https://api.dataforseo.com/v3/serp/google/maps/live/advanced', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${DATAFORSEO_AUTH}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{
        keyword: searchKeyword,
        location_name: 'United States',
        language_name: 'English',
        depth: 5,
      }]),
    })

    if (!res.ok) throw new Error(`DataForSEO error: ${res.status}`)
    const data = await res.json()
    let items = data?.tasks?.[0]?.result?.[0]?.items || []

    if (!items.length) {
      return NextResponse.json({ error: 'No results found', keyword: searchKeyword }, { status: 404 })
    }

    // Best match — prefer Place ID exact match when available, then name match
    const companyBase = (loc.locationName || loc.companyName || '').toLowerCase().split(/\s+/)[0]

    // If we have a resolvedPlaceId but it doesn't appear in depth-5 results, retry at depth 10
    const placeIdHit = resolvedPlaceId ? items.find(item => item.place_id === resolvedPlaceId) : null
    if (resolvedPlaceId && !placeIdHit) {
      const retryRes = await fetch('https://api.dataforseo.com/v3/serp/google/maps/live/advanced', {
        method: 'POST',
        headers: { Authorization: `Basic ${DATAFORSEO_AUTH}`, 'Content-Type': 'application/json' },
        body: JSON.stringify([{ keyword: searchKeyword, location_name: 'United States', language_name: 'English', depth: 10 }]),
      })
      if (retryRes.ok) {
        const retryData = await retryRes.json()
        const retryItems = retryData?.tasks?.[0]?.result?.[0]?.items || []
        if (retryItems.length) items = retryItems
      }
    }

    const match = resolvedPlaceId
      ? (items.find(item => item.place_id === resolvedPlaceId)
         || items.find(item => resolvedCid && String(item.cid) === String(resolvedCid))
         || items.find(item => item.title?.toLowerCase().includes(companyBase))
         || items[0])
      : resolvedCid
      ? (items.find(item => String(item.cid) === String(resolvedCid))
         || items.find(item => item.title?.toLowerCase().includes(companyBase))
         || items[0])
      : (items.find(item => item.title?.toLowerCase().includes(companyBase))
         || items[0])

    // Parse all available data
    const rating         = match.rating?.value ?? null
    const reviewCount    = match.rating?.votes_count ?? null
    const ratingDist     = match.rating_distribution ?? null
    const totalPhotos    = match.total_photos ?? null
    const isClaimed      = match.is_claimed ?? null
    const placeId        = match.place_id || null
    const cid            = match.cid || null
    const phone          = match.phone || null
    const address        = match.address || null
    const addressInfo    = match.address_info || null
    const website        = match.domain || match.url || null
    const primaryCategory = match.category || null
    const additionalCategories = match.additional_categories || []
    const hours          = parseHours(match.work_hours)
    const currentStatus  = match.work_hours?.current_status || null
    const mainImage      = match.main_image || null
    const reviewSnippet  = match.local_justifications?.[0]?.text || null
    const latitude       = match.latitude ?? null
    const longitude      = match.longitude ?? null
    const contactUrl     = match.contact_url || null
    const bookOnlineUrl  = match.book_online_url || null

    // Compute auto-checkable audit items
    const autoChecks = {
      isClaimed: isClaimed === true ? true : isClaimed === false ? false : null,
      websiteLinked: website ? true : null,
      phoneListened: phone ? true : null,
      hoursComplete: hours
        ? ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].every(d => hours[d] != null)
        : null,
      secondaryCategoriesSet: additionalCategories.length > 0 ? true : null,
      has50Reviews: reviewCount != null ? reviewCount >= 50 : null,
      ratingAbove4: rating != null ? rating >= 4.0 : null,
    }

    const snapshot = {
      rating, reviewCount, ratingDistribution: ratingDist, totalPhotos,
      isClaimed, placeId, cid, phone, address, addressInfo,
      website, contactUrl, bookOnlineUrl,
      primaryCategory, additionalCategories,
      hours, currentStatus, mainImage, reviewSnippet,
      latitude, longitude, autoChecks,
      resolvedAt: new Date().toISOString(),
      keyword: searchKeyword,
    }

    // Backfill address/city/state columns from live data if not already set
    const backfillAddress = address
      ? (addressInfo?.address || address.split(',')[0]?.trim() || null)
      : null
    const backfillCity  = addressInfo?.city    || null
    const backfillState = addressInfo?.region  || null

    // Store snapshot + Place ID + address backfill
    await pool.query(
      `UPDATE "GBPLocation"
       SET "liveDataSnapshot" = $1, "liveDataUpdatedAt" = NOW(),
           "gbpPlaceId" = COALESCE($2, $4, "gbpPlaceId"),
           "address" = COALESCE("address", $5),
           "city"    = COALESCE("city",    $6),
           "state"   = COALESCE("state",   $7),
           "updatedAt" = NOW()
       WHERE id = $3`,
      [JSON.stringify(snapshot), placeId, locId, resolvedPlaceId || null,
       backfillAddress, backfillCity, backfillState]
    )

    return NextResponse.json(snapshot)
  } catch (err) {
    console.error('[GBP live-data]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
