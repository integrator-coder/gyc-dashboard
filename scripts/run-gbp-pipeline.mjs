#!/usr/bin/env node
/**
 * run-gbp-pipeline.mjs
 *
 * Combined GBP location pipeline:
 *   1. Read sheet  → get GBP links + client info
 *   2. Follow share.google redirects  → extract kgmid + business name (free)
 *   3. Google Places Text Search  → get place_id, lat, lng, formattedAddress
 *   4. Upsert into GBPLocation table via Prisma
 *
 * Usage:
 *   node scripts/run-gbp-pipeline.mjs
 *   node scripts/run-gbp-pipeline.mjs --dry-run   # no DB writes, no Places API
 */

import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load env from .env.local
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })

import { PrismaClient } from '@prisma/client'
import { extractPlaceInfo } from './extract-place-id-from-url.mjs'

const prisma = new PrismaClient()

// ── Config ───────────────────────────────────────────────────────────────────

const SHEET_ID   = '1uZLqNTDWXZ3wbBU7ley-81gj8Kj4h06_Ftd2utE-pjY'
const SA_PATH    = path.resolve(process.env.HOME || '~', '.openclaw/workspace/google-service-account.json')
const PROGRESS_FILE = path.resolve(__dirname, 'gbp-pipeline-progress.json')

const REDIRECT_CONCURRENCY = 5
const PLACES_CONCURRENCY   = 3
const PLACES_DELAY_MS      = 300   // between each Places API call
const TENANT_ID            = 'gyc'

const isDryRun = process.argv.includes('--dry-run')

// ── Logging helpers ───────────────────────────────────────────────────────────

const log     = (...a) => console.log(...a)
const warn    = (...a) => console.warn(...a)
const err     = (...a) => console.error(...a)
const divider = (c = '─', n = 60) => console.log(c.repeat(n))

// ── Progress ─────────────────────────────────────────────────────────────────

function loadProgress() {
  if (fs.existsSync(PROGRESS_FILE)) {
    try { return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')) }
    catch { /* ignore */ }
  }
  return { processed: {}, failed: {}, startedAt: new Date().toISOString() }
}

function saveProgress(p) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2))
}

// ── Google Sheets reader ──────────────────────────────────────────────────────

async function readSheet() {
  const { google } = require('googleapis')
  const sa = JSON.parse(fs.readFileSync(SA_PATH, 'utf8'))
  const auth = new google.auth.GoogleAuth({
    credentials: sa,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
  const sheets = google.sheets({ version: 'v4', auth })
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'A1:Z1000',
  })
  return res.data.values || []
}

// ── Column mapper ─────────────────────────────────────────────────────────────

function mapColumns(headers) {
  const map = {}
  const lower = headers.map(h => (h || '').toLowerCase().trim())
  const usedIndexes = new Set()

  const matchers = {
    clientAcronym: ['client abbrv', 'client abbrev', 'acronym', 'abbrv'],
    businessName:  ['business name', 'client name', 'client'],
    locationName:  ['location name', 'location', 'branch'],
    address:       ['street address', 'address', 'street'],
    city:          ['city'],
    state:         ['state'],
    gbpUrl:        ['gbp link', 'gbp url', 'google link', 'maps link', 'gbp'],
  }

  for (const [field, candidates] of Object.entries(matchers)) {
    for (const candidate of candidates) {
      let idx = lower.findIndex(h => h === candidate)
      if (idx === -1) idx = lower.findIndex(h => h.includes(candidate))
      if (idx !== -1 && !usedIndexes.has(idx)) {
        map[field] = idx
        usedIndexes.add(idx)
        break
      }
    }
  }
  return map
}

// ── Parse multi-URL cells ─────────────────────────────────────────────────────

function parseGbpUrls(cellValue) {
  if (!cellValue) return []
  // Split on commas, newlines, or semicolons; filter valid URLs
  return cellValue
    .split(/[\n,;]+/)
    .map(s => s.trim())
    .filter(s => s.startsWith('http'))
}

// ── Concurrency helper ────────────────────────────────────────────────────────

async function runConcurrent(items, fn, concurrency) {
  const results = []
  const queue = [...items.entries()]
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (queue.length) {
      const [idx, item] = queue.shift()
      results[idx] = await fn(item)
    }
  })
  await Promise.all(workers)
  return results
}

// ── Places API lookup (New API v1) ────────────────────────────────────────────

async function lookupPlace(textQuery) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) throw new Error('Missing GOOGLE_PLACES_API_KEY')

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
    },
    body: JSON.stringify({ textQuery }),
  })

  if (res.status === 403) {
    const body = await res.text()
    throw new Error(`Places API 403 Forbidden: ${body}`)
  }
  if (res.status === 429) {
    const body = await res.text()
    throw new Error(`Places API 429 Quota exceeded: ${body}`)
  }
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Places API ${res.status}: ${body}`)
  }

  const data = await res.json()
  const places = data.places || []
  if (places.length === 0) return null

  const place = places[0]
  return {
    placeId:          place.id,
    displayName:      place.displayName?.text || textQuery,
    formattedAddress: place.formattedAddress || null,
    latitude:         place.location?.latitude ?? null,
    longitude:        place.location?.longitude ?? null,
  }
}

// ── Extract city from formattedAddress ────────────────────────────────────────

function extractCity(formattedAddress) {
  if (!formattedAddress) return null
  // US address format: "123 Main St, Cityname, ST 12345, USA"
  const parts = formattedAddress.split(',').map(s => s.trim())
  // City is typically the second-to-last meaningful part before "USA"
  // Filter out USA, zip codes, etc.
  const filtered = parts.filter(p => p !== 'USA' && !/^\d{5}(-\d{4})?$/.test(p))
  if (filtered.length >= 2) return filtered[filtered.length - 2]
  return null
}

// ── Upsert helper ─────────────────────────────────────────────────────────────

async function upsertLocation({ clientAcronym, locationName, gbpUrl, kgmid, placeResult }) {
  // Build update/create data
  const data = {
    placeId:      placeResult.placeId,
    gbpUrl:       gbpUrl || null,
    latitude:     placeResult.latitude,
    longitude:    placeResult.longitude,
    address:      placeResult.formattedAddress || null,
    lastSyncedAt: new Date(),
  }

  return prisma.gBPLocation.upsert({
    where: {
      tenantId_clientAcronym_locationName: {
        tenantId: TENANT_ID,
        clientAcronym,
        locationName,
      },
    },
    update: data,
    create: {
      tenantId: TENANT_ID,
      clientAcronym,
      locationName,
      ...data,
    },
  })
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  log('\n🚀 GBP Pipeline starting...')
  if (isDryRun) log('🔍 DRY RUN mode — no DB writes, no Places API calls\n')

  // Ensure API key present (unless dry run)
  if (!isDryRun && !process.env.GOOGLE_PLACES_API_KEY) {
    err('❌ Missing GOOGLE_PLACES_API_KEY in .env.local — aborting')
    process.exit(1)
  }

  // ── Step 1: Read sheet ──────────────────────────────────────────────────────
  log('📊 Reading sheet...')
  let rows
  try {
    rows = await readSheet()
  } catch (e) {
    err(`❌ Failed to read sheet: ${e.message}`)
    process.exit(1)
  }

  if (!rows || rows.length < 2) {
    err('❌ Sheet appears empty')
    process.exit(1)
  }

  const headerRow = rows[0]
  const dataRows  = rows.slice(1)
  const colMap    = mapColumns(headerRow)

  log(`   ${dataRows.length} data rows found`)
  log('   Column mapping:')
  for (const [field, idx] of Object.entries(colMap)) {
    log(`     ${field.padEnd(14)} → col ${idx} ("${headerRow[idx]}")`)
  }

  if (colMap.gbpUrl === undefined) {
    err('❌ Could not find GBP Link column. Aborting.')
    process.exit(1)
  }

  // ── Step 2: Build work items ────────────────────────────────────────────────
  const get = (row, field) =>
    colMap[field] !== undefined ? (row[colMap[field]] || '').trim() : ''

  const workItems = []

  for (const [i, row] of dataRows.entries()) {
    const clientAcronym = get(row, 'clientAcronym')
    const businessName  = get(row, 'businessName')
    const gbpUrlRaw     = get(row, 'gbpUrl')

    if (!clientAcronym && !businessName) continue
    if (!gbpUrlRaw) continue   // skip rows with no GBP link

    const gbpUrls = parseGbpUrls(gbpUrlRaw)
    if (gbpUrls.length === 0) continue

    const acronym = clientAcronym ||
      (businessName ? businessName.slice(0, 10).toUpperCase().replace(/\s+/g, '') : `ROW${i + 2}`)

    // One work item per URL (multi-URL cells → multiple items)
    gbpUrls.forEach((url, urlIdx) => {
      workItems.push({
        rowIndex:     i + 2,
        urlIndex:     urlIdx,
        clientAcronym: acronym,
        businessName: businessName || clientAcronym,
        gbpUrl:       url,
        // locationName resolved later after redirect
        locationName: null,
      })
    })
  }

  log(`\n📋 ${workItems.length} GBP URLs to process (from rows with non-empty GBP Link)`)

  if (isDryRun) {
    log('\n📝 Dry run sample (first 15):')
    workItems.slice(0, 15).forEach(item => {
      log(`  [Row ${item.rowIndex}] ${item.clientAcronym} — ${item.gbpUrl}`)
    })
    if (workItems.length > 15) log(`  ... and ${workItems.length - 15} more`)
    log('\n✅ Dry run complete.')
    await prisma.$disconnect()
    return
  }

  // ── Step 3: Follow redirects ────────────────────────────────────────────────
  divider()
  log(`\n🔗 Step 3: Following ${workItems.length} redirects (concurrency=${REDIRECT_CONCURRENCY})...`)

  const redirectResults = await runConcurrent(workItems, async (item) => {
    try {
      const info = await extractPlaceInfo(item.gbpUrl)
      return { ...item, kgmid: info.kgmid, resolvedName: info.name, resolvedUrl: info.resolvedUrl, redirectError: null }
    } catch (e) {
      return { ...item, kgmid: null, resolvedName: null, resolvedUrl: item.gbpUrl, redirectError: e.message }
    }
  }, REDIRECT_CONCURRENCY)

  const redirectOk  = redirectResults.filter(r => !r.redirectError)
  const redirectErr = redirectResults.filter(r =>  r.redirectError)

  log(`   ✅ ${redirectOk.length} redirects resolved`)
  if (redirectErr.length > 0) {
    warn(`   ⚠️  ${redirectErr.length} redirect failures:`)
    redirectErr.forEach(r => warn(`     ${r.clientAcronym} — ${r.gbpUrl}: ${r.redirectError}`))
  }

  // ── Step 4: Google Places API lookup ────────────────────────────────────────
  divider()
  log(`\n📍 Step 4: Places API lookup (concurrency=${PLACES_CONCURRENCY})...`)

  const progress = loadProgress()

  const placesResults = []
  const queue = [...redirectOk]
  let placesCallCount = 0

  async function placesWorker() {
    while (queue.length) {
      const item = queue.shift()
      const key = `${item.clientAcronym}::${item.gbpUrl}`

      // Skip already-processed
      if (progress.processed[key]) {
        placesResults.push({ ...item, ...(progress.processed[key]), skipped: true })
        continue
      }

      // Build search query — prefer resolved name from redirect, fall back to sheet name
      const queryName = item.resolvedName || item.businessName
      const textQuery = queryName

      try {
        const placeResult = await lookupPlace(textQuery)
        await new Promise(r => setTimeout(r, PLACES_DELAY_MS))
        placesCallCount++

        if (!placeResult) {
          warn(`  ⚠️  [${item.clientAcronym}] No Places results for "${textQuery}"`)
          progress.failed[key] = { reason: 'no_results', query: textQuery }
          saveProgress(progress)
          placesResults.push({ ...item, placeResult: null, error: 'no_results' })
          return
        }

        log(`  ✅ [${item.clientAcronym}] ${placeResult.displayName} → ${placeResult.placeId}`)
        if (item.kgmid) log(`     kgmid: ${item.kgmid}`)

        progress.processed[key] = { placeResult, kgmid: item.kgmid }
        saveProgress(progress)

        placesResults.push({ ...item, placeResult, error: null })

      } catch (e) {
        err(`  ❌ [${item.clientAcronym}] Places API error: ${e.message}`)
        // Stop on quota/auth errors
        if (e.message.includes('403') || e.message.includes('429')) {
          err('\n🛑 Fatal API error — stopping pipeline. Fix quota/auth then re-run.')
          await prisma.$disconnect()
          process.exit(1)
        }
        progress.failed[key] = { reason: e.message }
        saveProgress(progress)
        placesResults.push({ ...item, placeResult: null, error: e.message })
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(PLACES_CONCURRENCY, redirectOk.length) }, placesWorker))
  log(`   Places API calls made: ${placesCallCount} (${placesResults.filter(r => r.skipped).length} skipped from prior run)`)

  // ── Step 5: Upsert into DB ──────────────────────────────────────────────────
  divider()
  log(`\n💾 Step 5: Upserting into GBPLocation...`)

  const dbSuccess = []
  const dbFailed  = []

  for (const item of placesResults) {
    if (!item.placeResult) {
      dbFailed.push({ ...item, dbError: item.error || 'no_place_result' })
      continue
    }

    // Derive locationName: try to get city from Places formattedAddress
    // Multi-URL clients get suffixed (urlIndex > 0)
    const city = extractCity(item.placeResult.formattedAddress)
    const baseLocationName = city || 'Main'
    const locationName = item.urlIndex > 0 ? `${baseLocationName} ${item.urlIndex + 1}` : baseLocationName

    try {
      await upsertLocation({
        clientAcronym: item.clientAcronym,
        locationName,
        gbpUrl:   item.gbpUrl,
        kgmid:    item.kgmid || null,
        placeResult: item.placeResult,
      })
      log(`  ✅ [${item.clientAcronym}/${locationName}] upserted — ${item.placeResult.placeId}`)
      dbSuccess.push({ ...item, locationName })
    } catch (e) {
      // placeId unique constraint violation (same place for different client)
      if (e.code === 'P2002') {
        // Try with a different locationName to avoid conflict
        try {
          const fallbackName = `${baseLocationName}-${item.clientAcronym}`
          await upsertLocation({
            clientAcronym: item.clientAcronym,
            locationName: fallbackName,
            gbpUrl: item.gbpUrl,
            kgmid: item.kgmid || null,
            placeResult: { ...item.placeResult, placeId: null }, // clear placeId to avoid unique conflict
          })
          warn(`  ⚠️  [${item.clientAcronym}/${fallbackName}] upserted without placeId (duplicate placeId conflict)`)
          dbSuccess.push({ ...item, locationName: fallbackName })
        } catch (e2) {
          err(`  ❌ [${item.clientAcronym}] DB upsert failed: ${e2.message}`)
          dbFailed.push({ ...item, locationName, dbError: e2.message })
        }
      } else {
        err(`  ❌ [${item.clientAcronym}/${locationName}] DB upsert failed: ${e.message}`)
        dbFailed.push({ ...item, locationName, dbError: e.message })
      }
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  divider('═')
  log('\n📊 GBP PIPELINE SUMMARY')
  divider('═')
  log(`  Sheet rows with GBP links:    ${workItems.length}`)
  log(`  Redirects resolved:           ${redirectOk.length} / ${workItems.length}`)
  log(`  Redirect failures:            ${redirectErr.length}`)
  log(`  Places API calls:             ${placesCallCount}`)
  log(`  DB upserts succeeded:         ${dbSuccess.length}`)
  log(`  DB upserts failed:            ${dbFailed.length}`)
  log(`  Progress file:                ${PROGRESS_FILE}`)

  if (dbFailed.length > 0) {
    log('\n  ❌ Failures:')
    dbFailed.forEach(f => {
      log(`    [Row ${f.rowIndex}] ${f.clientAcronym} — ${f.dbError || f.error}`)
    })
  }

  if (redirectErr.length > 0) {
    log('\n  ⚠️  Redirect failures:')
    redirectErr.forEach(r => {
      log(`    [Row ${r.rowIndex}] ${r.clientAcronym} — ${r.redirectError}`)
    })
  }

  divider('═')

  await prisma.$disconnect()
}

main().catch(async e => {
  err('Fatal:', e.message)
  await prisma.$disconnect()
  process.exit(1)
})
