#!/usr/bin/env node
/**
 * resolve-missing-zips.mjs
 * Resolves missing zip/address data for GBPLocation records via DataForSEO.
 * INCREMENTAL: writes each record immediately after a successful API call.
 * Resume-safe: skips records already resolved.
 *
 * Usage: node scripts/resolve-missing-zips.mjs [--dry-run] [--limit N] [--start-id N]
 */

import pg from 'pg'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'
import { homedir } from 'os'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '..', '.env.local') })

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

// Load DataForSEO credentials from secrets
const secrets = JSON.parse(readFileSync(join(homedir(), '.openclaw/secrets.json'), 'utf8'))
const DFS_LOGIN    = secrets.DATAFORSEO_LOGIN
const DFS_PASSWORD = secrets.DATAFORSEO_PASSWORD
const DFS_AUTH     = Buffer.from(`${DFS_LOGIN}:${DFS_PASSWORD}`).toString('base64')

const CHILDCARE_CATEGORIES = [
  'child','daycare','day care','preschool','nursery','kindergarten',
  'learning','academy','school','montessori','kids','infant','toddler','childcare'
]

const DELAY_MS  = 400  // between API calls
const BATCH_LOG = 10   // log progress every N records

const args      = process.argv.slice(2)
const DRY_RUN   = args.includes('--dry-run')
const LIMIT     = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '500')
const START_ID  = parseInt(args.find(a => a.startsWith('--start-id='))?.split('=')[1] || '0')

// ── Helpers ────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function isChildcareCategory(cat) {
  if (!cat) return false
  const lower = cat.toLowerCase()
  return CHILDCARE_CATEGORIES.some(kw => lower.includes(kw))
}

function isUSCoords(lat, lng) {
  return lat >= 24 && lat <= 50 && lng >= -130 && lng <= -60
}

async function dfseoResolve(keyword, locationCode = 2840) {
  const res = await fetch('https://api.dataforseo.com/v3/serp/google/maps/live/regular', {
    method: 'POST',
    headers: { 'Authorization': `Basic ${DFS_AUTH}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([{ keyword, location_code: locationCode, language_code: 'en', depth: 3 }])
  })
  const data = await res.json()

  if (data.status_code === 40100) throw new Error('AUTH_FAILED: DataForSEO auth failed — account may be out of credits')
  if (!res.ok || data.status_code >= 40000) throw new Error(`DataForSEO error ${data.status_code}: ${data.status_message}`)

  const items = data?.tasks?.[0]?.result?.[0]?.items || []
  return items
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔍 GBP Missing Zip Resolver — ' + new Date().toISOString().split('T')[0])
  if (DRY_RUN) console.log('⚠️  DRY RUN — no DB writes')
  console.log('═'.repeat(60))

  const { rows } = await pool.query(`
    SELECT gl.id, gl."clientAcronym", gl."locationName",
           gl.address, gl.city, gl.state, gl.latitude, gl.longitude,
           gl."gbpUrl", gl."gbpPlaceId", gl."placeId", gl."seoLocationName",
           gl."liveDataSnapshot"->'addressInfo'->>'zip' AS snap_zip,
           gl."liveDataSnapshot"->>'address'             AS snap_address,
           cp."companyName"
    FROM "GBPLocation" gl
    JOIN "ClientProfile" cp ON cp.acronym = gl."clientAcronym"
    WHERE cp.status = 'active'
      AND gl."isActive" = TRUE
      AND (gl."liveDataSnapshot"->'addressInfo'->>'zip' IS NULL
           OR gl."liveDataSnapshot"->'addressInfo'->>'zip' = '')
      AND gl."liveDataSnapshot" IS NOT NULL
      AND gl.id >= $1
    ORDER BY gl.id
    LIMIT $2
  `, [START_ID, LIMIT])

  console.log(`📋 Found ${rows.length} locations needing resolution\n`)

  let resolved = 0, skipped = 0, failed = 0, authFailed = false

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (i > 0 && i % BATCH_LOG === 0) {
      console.log(`\n📊 Progress: ${i}/${rows.length} | resolved: ${resolved} | skipped: ${skipped} | failed: ${failed}`)
    }

    // Skip international (UK, Canada, etc.)
    const lat = row.latitude, lng = row.longitude
    if (lat != null && lng != null && !isUSCoords(lat, lng)) {
      console.log(`  ⏭️  SKIP (international): ${row.clientAcronym}/${row.locationName} [${lat?.toFixed(2)},${lng?.toFixed(2)}]`)
      skipped++
      continue
    }

    const name    = row.seoLocationName || row.companyName || row.locationName
    const city    = row.city  || ''
    const state   = row.state || ''
    const keyword = [name, city, state].filter(Boolean).join(' ')

    try {
      if (i > 0) await sleep(DELAY_MS)

      const items = await dfseoResolve(keyword)
      const match = items.find(item => {
        const cat = item.category || ''
        return isChildcareCategory(cat) || isChildcareCategory(item.title)
      }) || items[0]

      if (!match) {
        console.log(`  ❌ No result: ${row.clientAcronym}/${row.locationName}`)
        failed++
        continue
      }

      const cat = match.category || ''
      if (!isChildcareCategory(cat) && !isChildcareCategory(match.title)) {
        console.log(`  ⚠️  Bad category "${cat}": ${row.clientAcronym}/${row.locationName}`)
        failed++
        continue
      }

      // Extract address info
      const addr    = match.address || match.address_info?.address || null
      const matchCity  = match.address_info?.city || null
      const matchState = match.address_info?.region || null
      const matchZip   = match.address_info?.zip   || null
      const matchLat   = match.latitude  || null
      const matchLng   = match.longitude || null
      const matchPid   = match.place_id  || null

      if (!matchZip && !matchLat) {
        console.log(`  ⚠️  No zip/coords: ${row.clientAcronym}/${row.locationName}`)
        failed++
        continue
      }

      console.log(`  ✅ ${row.clientAcronym}/${row.locationName} → zip: ${matchZip}, cat: ${cat}`)

      if (!DRY_RUN) {
        // Build updated liveDataSnapshot (merge into existing)
        const existingSnap = await pool.query(
          `SELECT "liveDataSnapshot" FROM "GBPLocation" WHERE id = $1`, [row.id]
        )
        const snap = existingSnap.rows[0]?.liveDataSnapshot || {}
        const updatedSnap = {
          ...snap,
          address:     addr || snap.address,
          latitude:    matchLat || snap.latitude,
          longitude:   matchLng || snap.longitude,
          isClaimed:   match.is_claimed ?? snap.isClaimed,
          rating:      match.rating ?? snap.rating,
          reviewCount: match.rating_count ?? snap.reviewCount,
          placeId:     matchPid || snap.placeId,
          primaryCategory: cat || snap.primaryCategory,
          addressInfo: {
            ...(snap.addressInfo || {}),
            address: addr,
            city:    matchCity,
            region:  matchState,
            zip:     matchZip,
          },
          resolvedAt: new Date().toISOString(),
        }

        await pool.query(`
          UPDATE "GBPLocation" SET
            "liveDataSnapshot"    = $1,
            "liveDataUpdatedAt"   = NOW(),
            latitude              = COALESCE(latitude, $2),
            longitude             = COALESCE(longitude, $3),
            city                  = COALESCE(city, $4),
            state                 = COALESCE(state, $5),
            "placeId"             = COALESCE("placeId", $6),
            "updatedAt"           = NOW()
          WHERE id = $7
        `, [
          JSON.stringify(updatedSnap),
          matchLat, matchLng,
          matchCity, matchState,
          matchPid,
          row.id
        ])
      }

      resolved++

    } catch (err) {
      if (err.message.startsWith('AUTH_FAILED')) {
        console.error(`\n🔴 AUTH FAILURE at record ${i + 1} (id ${row.id}) — DataForSEO account likely out of credits.`)
        console.error(`   Resume with: node scripts/resolve-missing-zips.mjs --start-id=${row.id}`)
        authFailed = true
        break
      }
      console.log(`  ❌ Error on ${row.clientAcronym}/${row.locationName}: ${err.message}`)
      failed++
    }
  }

  console.log('\n' + '═'.repeat(60))
  console.log('📊 FINAL SUMMARY')
  console.log(`  Resolved:  ${resolved}`)
  console.log(`  Skipped:   ${skipped} (international)`)
  console.log(`  Failed:    ${failed} (no match / bad category)`)
  if (authFailed) {
    console.log(`\n⚠️  Run stopped due to auth failure.`)
    console.log(`   Top up DataForSEO account at: https://app.dataforseo.com`)
    console.log(`   Then resume with: node scripts/resolve-missing-zips.mjs --start-id=<id>`)
  }

  await pool.end()
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
