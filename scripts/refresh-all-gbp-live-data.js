#!/usr/bin/env node
/**
 * refresh-all-gbp-live-data.js
 * Fetches live GBP data (rating, coords, hours, photos) for ALL GBP locations
 * (not just SEO clients) that are missing liveDataSnapshot or are stale.
 *
 * Uses DataForSEO SERP Maps Live endpoint.
 * Run: node scripts/refresh-all-gbp-live-data.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') })

const { Pool } = require('pg')
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const AUTH = Buffer.from(
  `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
).toString('base64')
const HEADERS = { 'Authorization': `Basic ${AUTH}`, 'Content-Type': 'application/json' }

function fmtHour(h, m) {
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

function parseHours(wh) {
  if (!wh?.timetable) return null
  const days   = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
  const labels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  const result = {}
  for (let i = 0; i < days.length; i++) {
    const slots = wh.timetable[days[i]]
    if (!slots?.length) { result[labels[i]] = 'Closed'; continue }
    const s = slots[0]
    result[labels[i]] = `${fmtHour(s.open.hour, s.open.minute)} \u2013 ${fmtHour(s.close.hour, s.close.minute)}`
  }
  return result
}

async function fetchLiveData(loc) {
  // Build search keyword from location name + city/state
  const keyword = [loc.locationName, loc.city, loc.state].filter(Boolean).join(' ')
    || loc.locationName || 'childcare'

  // Try Place ID first if we have it
  const searchKeyword = loc.gbpPlaceId
    ? `cid:${loc.gbpPlaceId}`
    : keyword

  const body = [{
    keyword: searchKeyword,
    location_code: 2840,
    language_code: 'en',
    depth: 5,
  }]

  const r = await fetch('https://api.dataforseo.com/v3/serp/google/maps/live/advanced', {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const data = await r.json()
  const task  = data.tasks?.[0]
  if (task?.status_code !== 20000) return null

  const items = task.result?.[0]?.items || []

  // Match by place_id if available, otherwise first result
  let match = loc.gbpPlaceId
    ? items.find(i => i.place_id === loc.gbpPlaceId)
    : items[0]
  if (!match) match = items[0]
  if (!match) return null

  return {
    placeId:       match.place_id,
    cid:           match.cid,
    rating:        match.rating?.value ?? null,
    reviewCount:   match.rating?.votes_count ?? null,
    ratingDistribution: match.rating?.rating_distribution ?? null,
    totalPhotos:   match.total_photos ?? null,
    isClaimed:     match.is_claimed ?? false,
    hours:         parseHours(match.work_time),
    phone:         match.phone ?? null,
    address:       match.address ?? null,
    website:       match.url ?? null,
    latitude:      match.latitude ?? null,
    longitude:     match.longitude ?? null,
    primaryCategory:     match.category ?? null,
    additionalCategories: match.additional_categories ?? [],
    currentStatus: match.is_temporarily_closed ? 'temporarily_closed' : 'open',
    mainImage:     match.main_image ?? null,
    keyword,
    resolvedAt:    new Date().toISOString(),
  }
}

async function main() {
  console.log(`\ud83d\udd04 Refreshing GBP live data for ALL locations...\n`)

  // Daily spend tracker — DataForSEO charges ~$0.02 per Maps Live request
  let dailySpend = 0
  const MAX_DAILY_SPEND = 14.80
  const COST_PER_CALL = 0.02

  // Fetch ALL locations without live data (no hasSEO filter)
  const locsRes = await pool.query(`
    SELECT id, "clientAcronym", "locationName", "gbpPlaceId",
           "gbpUrl", address, city, state,
           "liveDataSnapshot"->>'latitude' AS existing_lat,
           "liveDataSnapshot"->>'resolvedAt' AS last_fetched_at,
           "liveDataUpdatedAt"
    FROM "GBPLocation"
    WHERE address IS NOT NULL
      AND ("liveDataSnapshot" IS NULL OR "liveDataSnapshot" = 'null'::jsonb)
    ORDER BY "clientAcronym", "locationName"
  `)

  console.log(`\ud83d\udccd Found ${locsRes.rows.length} locations without live data\n`)

  let refreshed = 0, skipped = 0, failed = 0
  let currentAcronym = null

  for (const loc of locsRes.rows) {
    if (loc.clientAcronym !== currentAcronym) {
      currentAcronym = loc.clientAcronym
      console.log(`\u2192 ${loc.clientAcronym}`)
    }

    const label = `  \ud83d\udccd ${loc.locationName || 'Main'}`

    // Spend guard — stop if daily budget exhausted
    if (dailySpend >= MAX_DAILY_SPEND) {
      console.warn(`\u26a0\ufe0f  Daily spend limit $${MAX_DAILY_SPEND} reached ($${dailySpend.toFixed(2)} spent). Stopping.`)
      skipped++
      continue
    }

    try {
      const data = await fetchLiveData(loc)
      dailySpend += COST_PER_CALL

      if (!data) {
        console.log(`${label}: no results found`)
        failed++
        continue
      }

      const autoChecks = {
        isClaimed:              data.isClaimed,
        has50Reviews:           (data.reviewCount || 0) >= 50,
        ratingAbove4:           (data.rating || 0) >= 4.0,
        hoursComplete:          !!data.hours,
        phoneListened:          !!data.phone,
        websiteLinked:          !!data.website,
        secondaryCategoriesSet: (data.additionalCategories?.length || 0) > 0,
      }

      const snapshot = { ...data, autoChecks }

      await pool.query(`
        UPDATE "GBPLocation"
        SET "liveDataSnapshot" = $1,
            "liveDataUpdatedAt" = NOW(),
            "gbpPlaceId" = COALESCE("gbpPlaceId", $2)
        WHERE id = $3
      `, [JSON.stringify(snapshot), data.placeId, loc.id])

      const coordStr = data.latitude ? `${data.latitude?.toFixed(4)},${data.longitude?.toFixed(4)}` : 'no coords'
      console.log(`${label}: \u2713 ${data.rating}\u2b50 ${data.reviewCount} reviews | ${coordStr}`)
      refreshed++
    } catch (e) {
      console.error(`${label}: \u2717 ${e.message}`)
      failed++
    }

    // Delay between requests
    await new Promise(r => setTimeout(r, 400))
  }

  console.log(`\n\u2705 Done! Refreshed: ${refreshed} | Failed/no results: ${failed} | Skipped: ${skipped}`)
  console.log(`\ud83d\udcb0 Estimated spend: $${dailySpend.toFixed(2)}`)
  await pool.end()
}

main().catch(async e => {
  console.error('Fatal:', e.message)
  await pool.end()
  process.exit(1)
})
