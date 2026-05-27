#!/usr/bin/env node
/**
 * auto-populate-gbp-location.mjs
 * Looks up a single location via Google Places Text Search and upserts into GBPLocation.
 *
 * Usage:
 *   node scripts/auto-populate-gbp-location.mjs "RMP" "Centennial" "Rocky Mountain Pediatrics" "123 Main St" "Centennial" "CO"
 *
 * Args: clientAcronym locationName businessName address city state
 */

import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load env
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Look up a location via Google Places Text Search API.
 * @returns {Promise<{placeId, displayName, formattedAddress, latitude, longitude}|null>}
 */
export async function lookupPlaceId({ businessName, address, city, state }) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY

  if (!apiKey) {
    throw new Error('Missing GOOGLE_PLACES_API_KEY — set it in .env.local')
  }

  const textQuery = `${businessName} ${address} ${city} ${state}`.trim()

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
    },
    body: JSON.stringify({ textQuery }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Google Places API error ${res.status}: ${errText}`)
  }

  const data = await res.json()
  const places = data.places || []

  if (places.length === 0) {
    return null
  }

  if (places.length > 1) {
    console.warn(`⚠️  Found ${places.length} results — using first match (${places[0].displayName?.text})`)
  }

  const place = places[0]
  return {
    placeId: place.id,
    displayName: place.displayName?.text || businessName,
    formattedAddress: place.formattedAddress || null,
    latitude: place.location?.latitude ?? null,
    longitude: place.location?.longitude ?? null,
  }
}

/**
 * Upsert a GBPLocation row with Place ID data.
 */
export async function upsertGBPLocation({ clientAcronym, locationName, businessName, address, city, state, placeResult }) {
  // Check if another record already has this placeId — if so, skip to avoid unique constraint crash
  const existing = await prisma.gBPLocation.findFirst({
    where: {
      tenantId: 'gyc',
      placeId: placeResult.placeId,
      NOT: { clientAcronym, locationName },
    },
  })
  if (existing) {
    console.log(`   ⚠️  placeId ${placeResult.placeId} already used by ${existing.clientAcronym}/${existing.locationName} — skipping duplicate`)
    return null
  }

  const record = await prisma.gBPLocation.upsert({
    where: {
      tenantId_clientAcronym_locationName: {
        tenantId: 'gyc',
        clientAcronym,
        locationName,
      },
    },
    update: {
      placeId: placeResult.placeId,
      gbpPlaceId: placeResult.placeId,
      latitude: placeResult.latitude,
      longitude: placeResult.longitude,
      address: address || null,
      city: city || null,
      state: state || null,
      lastSyncedAt: new Date(),
    },
    create: {
      tenantId: 'gyc',
      clientAcronym,
      locationName,
      placeId: placeResult.placeId,
      gbpPlaceId: placeResult.placeId,
      latitude: placeResult.latitude,
      longitude: placeResult.longitude,
      address: address || null,
      city: city || null,
      state: state || null,
      lastSyncedAt: new Date(),
    },
  })

  return record
}

export async function main() {
  const args = process.argv.slice(2)
  if (args.length < 6) {
    console.error('Usage: node scripts/auto-populate-gbp-location.mjs <clientAcronym> <locationName> <businessName> <address> <city> <state>')
    console.error('Example: node scripts/auto-populate-gbp-location.mjs "RMP" "Centennial" "Rocky Mountain Pediatrics" "123 Main St" "Centennial" "CO"')
    process.exit(1)
  }

  const [clientAcronym, locationName, businessName, address, city, state] = args

  console.log(`\n🔍 Looking up: ${businessName} — ${locationName} (${city}, ${state})`)

  // Check for API key early
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    console.error('❌ Missing GOOGLE_PLACES_API_KEY — add it to .env.local and retry')
    process.exit(1)
  }

  try {
    const placeResult = await lookupPlaceId({ businessName, address, city, state })

    if (!placeResult) {
      console.warn(`⚠️  No results found for "${businessName} ${address} ${city} ${state}"`)
      console.warn('    Try a different search string or check the business name/address.')
      process.exit(0)
    }

    console.log(`✅ Found: ${placeResult.displayName}`)
    console.log(`   Place ID:  ${placeResult.placeId}`)
    console.log(`   Address:   ${placeResult.formattedAddress}`)
    console.log(`   Coords:    ${placeResult.latitude}, ${placeResult.longitude}`)

    const record = await upsertGBPLocation({
      clientAcronym,
      locationName,
      businessName,
      address,
      city,
      state,
      placeResult,
    })

    console.log(`✅ Upserted GBPLocation id=${record.id} (${clientAcronym} / ${locationName})`)
  } catch (err) {
    console.error(`❌ Error: ${err.message}`)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Only run when invoked directly (not when imported as a module)
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
