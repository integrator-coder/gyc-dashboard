/**
 * seed-gbp-from-sheet.js
 * Seeds GBPLocation table from the GBP access spreadsheet.
 * Run: node scripts/seed-gbp-from-sheet.js
 */

import dotenv from 'dotenv'
import pkg from 'pg'
import { google } from 'googleapis'
import { createRequire } from 'module'

dotenv.config({ path: '.env.local' })

const { Pool } = pkg
const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const SPREADSHEET_ID = '1tjFrAJwR-SkWWYCX0nsfzT-7QUwGUKY5NxTiTil-oZ8'

// Parse location names from notes field
// e.g. "Wadsworth, Creston" → ['Wadsworth', 'Creston']
// e.g. "Only Covington" → ['Covington']
// e.g. "Second Avenues, The Eastside Preschool by Child Time, Inc." → multi
function parseLocationNames(notes) {
  if (!notes) return []
  // Remove "Only " prefix
  const cleaned = notes.replace(/^Only\s+/i, '')
  // Split on comma+space or " and "
  return cleaned.split(/,\s+| and /i).map(s => s.trim()).filter(Boolean)
}

// Parse GBP URLs from cell (handles " - " separator, trims junk)
function parseGbpUrls(raw) {
  if (!raw) return []
  return raw
    .split(/\s+-\s+|\s+–\s+/)
    .map(u => u.trim())
    .filter(u => u.startsWith('http'))
}

async function main() {
  // Auth with Google Sheets (use same method as the rest of the app)
  const keyFile = process.env.GOOGLE_CREDENTIALS_PATH
    || `${process.env.HOME}/.openclaw/credentials/google-console.json`
  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })

  const sheets = google.sheets({ version: 'v4', auth })
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Client List!A1:E250',
  })

  const rows = (res.data.values || []).slice(1) // skip header

  // Load all valid acronyms from DB
  const client = await pool.connect()
  try {
    const { rows: profileRows } = await client.query(
      `SELECT acronym FROM "ClientProfile" WHERE "tenantId" = 'gyc'`
    )
    const validAcronyms = new Set(profileRows.map(r => r.acronym.toUpperCase()))

    let inserted = 0
    let skipped = 0
    let notFound = []

    for (const row of rows) {
      const acronym = row[0] ? row[0].trim().toUpperCase() : ''
      const notes   = (row[4] || '').trim()
      const linkRaw = (row[3] || '').trim()

      if (!acronym || !linkRaw) continue

      const urls = parseGbpUrls(linkRaw)
      if (urls.length === 0) continue

      if (!validAcronyms.has(acronym)) {
        notFound.push(acronym)
        continue
      }

      // Parse location names from notes if available
      const locationNames = parseLocationNames(notes)

      for (let i = 0; i < urls.length; i++) {
        const url = urls[i]
        const locationName = locationNames[i]
          || (urls.length === 1 ? 'Main' : `Location ${i + 1}`)

        // Check if already exists
        const { rows: existing } = await client.query(
          `SELECT id FROM "GBPLocation" WHERE "tenantId" = 'gyc' AND "clientAcronym" = $1 AND "gbpUrl" = $2`,
          [acronym, url]
        )
        if (existing.length > 0) {
          skipped++
          continue
        }

        await client.query(
          `INSERT INTO "GBPLocation" ("tenantId", "clientAcronym", "locationName", "gbpUrl", "isActive", "createdAt", "updatedAt")
           VALUES ('gyc', $1, $2, $3, true, NOW(), NOW())`,
          [acronym, locationName, url]
        )
        inserted++
      }
    }

    console.log(`✅ Done. Inserted: ${inserted}, Skipped (duplicate): ${skipped}`)
    if (notFound.length > 0) {
      console.log(`⚠️  Acronyms not found in ClientProfile (${notFound.length}):`, notFound.join(', '))
    }
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(e => { console.error('Error:', e.message); process.exit(1) })
