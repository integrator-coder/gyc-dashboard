/**
 * match-stripe-ghl.mjs
 * Cross-references active StripeCustomer records with GHL contacts by email.
 * Enriches StripeCustomer rows with: ghlContactId, companyName, phone, tags, ownerName.
 */

import { createRequire } from 'module'
const require = createRequire(import.meta.url)

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// Load .env.local manually
const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '..', '.env.local')
const envContent = readFileSync(envPath, 'utf8')
for (const line of envContent.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const idx = trimmed.indexOf('=')
  if (idx < 0) continue
  const key = trimmed.slice(0, idx).trim()
  const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
  if (!process.env[key]) process.env[key] = val
}

import pg from 'pg'
const { Pool } = pg

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const GHL_API_KEY = process.env.GHL_API_KEY
const LOCATION_ID = 'hmTIYUexYXIXgmJzbx3s'

if (!GHL_API_KEY) {
  console.error('GHL_API_KEY not set')
  process.exit(1)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function searchGhlByEmail(email) {
  // GHL v2 contact search: GET /contacts/ with query param filters by name/email/phone
  const url = new URL('https://services.leadconnectorhq.com/contacts/')
  url.searchParams.set('locationId', LOCATION_ID)
  url.searchParams.set('query', email)
  url.searchParams.set('limit', '5')

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${GHL_API_KEY}`,
      Version: '2021-07-28',
    },
  })

  if (res.status === 429) {
    console.warn('Rate limited by GHL, waiting 2s...')
    await sleep(2000)
    return searchGhlByEmail(email)
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GHL search failed ${res.status}: ${body.slice(0, 200)}`)
  }

  const data = await res.json()
  const contacts = data?.contacts || []

  // Filter to exact email match (query may return partial matches)
  const emailLower = email.toLowerCase()
  const exactMatch = contacts.find((c) => (c.email || '').toLowerCase() === emailLower)
  return exactMatch || contacts[0] || null
}

async function main() {
  console.log('🔍 Fetching active StripeCustomer records...')

  const { rows: customers } = await pool.query(`
    SELECT id, name, email
    FROM "StripeCustomer"
    WHERE status IN ('active', 'past_due')
      AND email IS NOT NULL
      AND trim(email) <> ''
    ORDER BY "createdAt" DESC
  `)

  console.log(`Found ${customers.length} active Stripe customers to process\n`)

  let matched = 0
  let unmatched = 0
  let errors = 0

  for (let i = 0; i < customers.length; i++) {
    const customer = customers[i]
    const progress = `[${i + 1}/${customers.length}]`

    try {
      const contact = await searchGhlByEmail(customer.email)

      if (contact) {
        const ownerName = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || customer.name || null
        const companyName = contact.companyName || contact.company || null
        const phone = contact.phone || null
        const tags = contact.tags || []
        const ghlContactId = contact.id

        await pool.query(`
          UPDATE "StripeCustomer"
          SET
            "ghlContactId" = $1,
            "companyName" = $2,
            phone = $3,
            tags = $4,
            "ownerName" = $5
          WHERE id = $6
        `, [ghlContactId, companyName, phone, tags, ownerName, customer.id])

        matched++
        if (i % 20 === 0 || i < 5) {
          console.log(`${progress} ✅ ${customer.email} → GHL: ${contact.firstName} ${contact.lastName} (${ghlContactId})`)
        }
      } else {
        unmatched++
        if (i % 50 === 0) {
          console.log(`${progress} ❌ No GHL match for ${customer.email}`)
        }
      }
    } catch (err) {
      errors++
      console.error(`${progress} ⚠️  Error processing ${customer.email}: ${err.message}`)
    }

    // Rate limit: 200ms between calls
    await sleep(200)
  }

  console.log(`\n📊 Results:`)
  console.log(`  Matched:   ${matched}`)
  console.log(`  Unmatched: ${unmatched}`)
  console.log(`  Errors:    ${errors}`)
  console.log(`  Total:     ${customers.length}`)

  // Write SyncLog entry
  try {
    const status = errors === 0 ? 'success' : errors < 10 ? 'partial' : 'error'
    await pool.query(`
      INSERT INTO "SyncLog" (source, status, "recordCount", "syncedAt", metadata)
      VALUES ($1, $2, $3, NOW(), $4)
      ON CONFLICT DO NOTHING
    `, [
      'stripe-ghl-match',
      status,
      matched,
      JSON.stringify({ matched, unmatched, errors, total: customers.length }),
    ])
    console.log('\n✅ SyncLog entry written')
  } catch (err) {
    // SyncLog might have different schema — try simpler insert
    try {
      await pool.query(`
        INSERT INTO "SyncLog" (source, status, "recordCount", "syncedAt")
        VALUES ($1, $2, $3, NOW())
      `, ['stripe-ghl-match', errors === 0 ? 'success' : 'partial', matched])
      console.log('✅ SyncLog entry written (simple)')
    } catch (e2) {
      console.warn('⚠️  SyncLog write skipped:', e2.message)
    }
  }

  await pool.end()
  console.log('\nDone.')
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
