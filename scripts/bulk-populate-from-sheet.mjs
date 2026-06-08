#!/usr/bin/env node
/**
 * bulk-populate-from-sheet.mjs
 * Reads GBP locations from Google Sheet and populates GBPLocation table
 * via Google Places Text Search API.
 *
 * Sheet: https://docs.google.com/spreadsheets/d/1uZLqNTDWXZ3wbBU7ley-81gj8Kj4h06_Ftd2utE-pjY
 *
 * Usage:
 *   node scripts/bulk-populate-from-sheet.mjs
 *   node scripts/bulk-populate-from-sheet.mjs --dry-run   # always dry-run if no API key
 */

import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load env
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })

import { PrismaClient } from '@prisma/client'
import { lookupPlaceId, upsertGBPLocation } from './auto-populate-gbp-location.mjs'

const prisma = new PrismaClient()

const SHEET_ID = '1uZLqNTDWXZ3wbBU7ley-81gj8Kj4h06_Ftd2utE-pjY'
const SA_PATH = path.resolve(process.env.HOME || '~', '.openclaw/workspace/google-service-account.json')
const PROGRESS_FILE = path.resolve(__dirname, 'bulk-populate-progress.json')
const BATCH_SIZE = 25
const BATCH_DELAY_MS = 2000

// --- Column mapping helpers ---

/**
 * Map header row to column indexes using best-guess matching.
 */
function mapColumns(headers) {
  const map = {}
  const lower = headers.map(h => (h || '').toLowerCase().trim())

  const matchers = {
    clientAcronym: ['client abbrv', 'client abbrev', 'acronym', 'abbrv', 'abbreviation', 'client_acronym', 'clientacronym'],
    businessName:  ['business name', 'businessname', 'company name', 'client name', 'client', 'name'],
    locationName:  ['location name', 'locationname', 'location_name', 'location', 'branch'],
    address:       ['street address', 'address', 'street'],
    city:          ['city'],
    state:         ['state'],
    gbpUrl:        ['location map link', 'gbp link', 'gbp url', 'google link', 'maps link', 'map link', 'gbp', 'link'],
    notes:         ['notes', 'note', 'comments'],
  }

  const usedIndexes = new Set()

  for (const [field, candidates] of Object.entries(matchers)) {
    for (const candidate of candidates) {
      // Try exact match first
      let idx = lower.findIndex(h => h === candidate)
      // Fall back to partial match
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

// --- Progress tracking ---

function loadProgress() {
  if (fs.existsSync(PROGRESS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'))
    } catch {
      return { processed: [], failed: [], lastRowIndex: 0 }
    }
  }
  return { processed: [], failed: [], lastRowIndex: 0 }
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2))
}

// --- Google Sheets reader ---

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

// --- Main ---

async function main() {
  const isDryRun = process.argv.includes('--dry-run') || !process.env.GOOGLE_PLACES_API_KEY

  if (!process.env.GOOGLE_PLACES_API_KEY) {
    console.log('⚠️  Missing GOOGLE_PLACES_API_KEY — running in DRY RUN mode (no Places API calls)')
  }

  if (isDryRun) {
    console.log('🔍 DRY RUN mode — will read sheet and log what would be processed\n')
  }

  // Read sheet
  console.log(`📊 Reading sheet ${SHEET_ID}...`)
  let rows
  try {
    rows = await readSheet()
  } catch (err) {
    console.error(`❌ Failed to read sheet: ${err.message}`)
    process.exit(1)
  }

  if (!rows || rows.length < 2) {
    console.error('❌ Sheet appears empty or only has headers')
    process.exit(1)
  }

  const headerRow = rows[0]
  const dataRows = rows.slice(1)

  console.log(`\n📋 Headers found (first 3 rows shown):`)
  rows.slice(0, 3).forEach((row, i) => console.log(`  Row ${i + 1}: ${JSON.stringify(row)}`))

  // Map columns
  const colMap = mapColumns(headerRow)
  console.log('\n🗺️  Column mapping:')
  for (const [field, idx] of Object.entries(colMap)) {
    console.log(`  ${field.padEnd(14)} → col ${idx} ("${headerRow[idx]}")`)
  }

  const missingRequired = ['clientAcronym', 'businessName'].filter(f => colMap[f] === undefined)
  if (missingRequired.length) {
    console.warn(`\n⚠️  Could not map required columns: ${missingRequired.join(', ')}`)
    console.warn('   Available headers:', headerRow)
  }

  // Build work items
  const workItems = []
  for (const [i, row] of dataRows.entries()) {
    const get = (field) => colMap[field] !== undefined ? (row[colMap[field]] || '').trim() : ''

    const clientAcronym = get('clientAcronym')
    const businessName  = get('businessName')
    const locationName  = get('locationName') || 'Main'
    const address       = get('address')
    const city          = get('city')
    const state         = get('state')
    const gbpUrl        = get('gbpUrl')

    // Skip empty rows
    if (!clientAcronym && !businessName) continue

    workItems.push({
      rowIndex: i + 2, // 1-indexed, row 1 is header
      clientAcronym: clientAcronym || businessName?.slice(0, 10).toUpperCase().replace(/\s+/g, '') || `ROW${i + 2}`,
      businessName: businessName || clientAcronym,
      locationName,
      address,
      city,
      state,
      gbpUrl,
    })
  }

  console.log(`\n📊 ${workItems.length} rows to process (${dataRows.length} total data rows, empty rows skipped)`)

  if (isDryRun) {
    console.log('\n📝 DRY RUN — items that would be processed:')
    workItems.slice(0, 20).forEach(item => {
      const addrStr = [item.address, item.city, item.state].filter(Boolean).join(', ')
      console.log(`  [Row ${item.rowIndex}] ${item.clientAcronym} / ${item.locationName} — "${item.businessName}"${addrStr ? ` (${addrStr})` : ''}`)
    })
    if (workItems.length > 20) {
      console.log(`  ... and ${workItems.length - 20} more`)
    }
    console.log('\n✅ Dry run complete. Add GOOGLE_PLACES_API_KEY to .env.local to run for real.')
    await prisma.$disconnect()
    return
  }

  // Load progress (for resume)
  const progress = loadProgress()
  const alreadyProcessed = new Set(progress.processed.map(p => p.rowIndex))
  const pending = workItems.filter(item => !alreadyProcessed.has(item.rowIndex))

  console.log(`\n▶️  ${pending.length} pending (${alreadyProcessed.size} already done from previous run)`)

  const results = { success: [], failed: [] }

  // Process in batches
  for (let batchStart = 0; batchStart < pending.length; batchStart += BATCH_SIZE) {
    const batch = pending.slice(batchStart, batchStart + BATCH_SIZE)
    const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(pending.length / BATCH_SIZE)
    console.log(`\n📦 Batch ${batchNum}/${totalBatches} (rows ${batch[0].rowIndex}–${batch[batch.length - 1].rowIndex})`)

    for (const item of batch) {
      const label = `  [${item.rowIndex}] ${item.clientAcronym}/${item.locationName}`

      // Skip if no searchable info
      if (!item.businessName) {
        console.log(`${label}: ⏭️  skipped (no business name)`)
        continue
      }

      try {
        const placeResult = await lookupPlaceId({
          businessName: item.businessName,
          address: item.address,
          city: item.city,
          state: item.state,
        })

        if (!placeResult) {
          console.warn(`${label}: ⚠️  no Places results for "${item.businessName}"`)
          results.failed.push({ ...item, reason: 'no_results' })
          progress.failed.push({ rowIndex: item.rowIndex, reason: 'no_results' })
        } else {
          await upsertGBPLocation({
            clientAcronym: item.clientAcronym,
            locationName: item.locationName,
            businessName: item.businessName,
            address: item.address,
            city: item.city,
            state: item.state,
            placeResult,
          })
          console.log(`${label}: ✅ ${placeResult.placeId} (${placeResult.displayName})`)
          results.success.push({ ...item, placeId: placeResult.placeId })
          progress.processed.push({ rowIndex: item.rowIndex, placeId: placeResult.placeId })
        }
      } catch (err) {
        console.error(`${label}: ❌ ${err.message}`)
        results.failed.push({ ...item, reason: err.message })
        progress.failed.push({ rowIndex: item.rowIndex, reason: err.message })
      }

      // Save progress after each item
      saveProgress(progress)

      // Small delay between calls to be kind to the API
      await new Promise(r => setTimeout(r, 200))
    }

    // Delay between batches
    if (batchStart + BATCH_SIZE < pending.length) {
      console.log(`  ⏳ Waiting ${BATCH_DELAY_MS / 1000}s before next batch...`)
      await new Promise(r => setTimeout(r, BATCH_DELAY_MS))
    }
  }

  // Summary report
  console.log('\n' + '═'.repeat(50))
  console.log('📊 BULK POPULATE SUMMARY')
  console.log('═'.repeat(50))
  console.log(`  Total rows in sheet:   ${workItems.length}`)
  console.log(`  Already processed:     ${alreadyProcessed.size}`)
  console.log(`  Processed this run:    ${results.success.length + results.failed.length}`)
  console.log(`  ✅ Succeeded:          ${results.success.length}`)
  console.log(`  ❌ Failed/no results:  ${results.failed.length}`)

  if (results.failed.length > 0) {
    console.log('\n  Failed items:')
    results.failed.forEach(f => {
      console.log(`    [Row ${f.rowIndex}] ${f.clientAcronym} / ${f.businessName} — ${f.reason}`)
    })
  }

  console.log(`\n  Progress saved to: ${PROGRESS_FILE}`)
  console.log('═'.repeat(50))

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error('Fatal:', err.message)
  await prisma.$disconnect()
  process.exit(1)
})
