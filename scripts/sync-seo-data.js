#!/usr/bin/env node
/**
 * sync-seo-data.js
 * Reads all 24 GYC SEO report Google Sheets and syncs data into:
 *   - ClientSEOSnapshot  (Local Falcon ranking data)
 *   - ClientSEOGBPMonthly (GBP monthly performance)
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') })

const { google } = require('googleapis')
const { Pool } = require('pg')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const GOOGLE_KEY = require('os').homedir() + '/.openclaw/credentials/google-console.json'

const SEO_SHEETS = {
  SELC:  '1xc9c40e7115X8OVwdvt8rPQn27qdumavUjOdHNlTuDk',
  RMP:   '1Bi1DB44J4H_RI0A8kNG8We2K4Cg4mA91HPBkaMyJpPQ',
  KKPS:  '1Ibl9Y82GLc0amGYKDAMFwGwKEciAx8cZl02MZulWfoY',
  EBLC:  '1HjDJqh5IdsqZka14UDSW6YiVYJnGSFi3gz2z-m0xUgY',
  CTI:   '1nI7yt8AyQ7wGpyreWjpisyAhsEQU91faJH4u1wXrca4',
  CPC:   '1wlILpzHuau9Ya5ku6cKstT3AlJdgCzVwzXGqYp58pHk',
  ACP:   '1iJfiRpwhR7wzqaQ3zm-zO1_G0tbKHSn5Drk21Q2rays',
  AALLC: '1XP_K5CKM7WjQfPhwV3F90XUujBdqvdyZDk0OCQEvYas',
  TRYCC: '1UR26OX3NhILTgJwwmGQxvAweAXbUcht6yGK8bVqwboA',
  TCLA:  '1s7GJ1wYdlAEctqkjn-2DHngctDPKTLcRFxyWdEyEyrY',
  TCALC: '1cMxhNnhmAXF5Yb3aUbfBPGVe3oeGFGdStC5TAcZcBaY',
  PSB:   '1IScv4TrPNMahHWJkMPMqqjwkBKrPZ9CNbtNP2xs_phw',
  PM:    '1OElJFPDrxVtAyv3GC-d6ocGZ38B5GxEqHuZzEg5Kd8Y',
  MHCC:  '1ZavlDBj72rSeJvhl_PbcFEQJBEZxKzRldLSVWy2tUok',
  LATX:  '1LsS2Ii8stm5icF8A7vlzio52WZcPr-XNFhxRn7_47Zs',
  KZCP:  '1dYPV94GX34GgaakWRBGUYl43RehLDR8ASKMoFS7P5Ps',
  FLP:   '17B513hhGwRHdY2e4p6JvLZZVMJ97ILbfFIdkTGCqvH8',
  KM:    '1DKSkA7dJ2Ij7Vh_ECMRRDPpFWKibVNK4_G4SwsJ-oLM',
  CTAB:  '1GZcT8SGieCF0h-Ft1z6_8d172xhJJdwiHyaKAO2F72g',
  HAA:   '18D6ZOx4wgqi8M8SVcnKIwUH9wJseom2HOERlC79pksQ',
  BCPA:  '1zHI1QctNmXfsOWIY7BS4XhAVUSL3XW_tgr_v93Wxiyo',
  AN:    '1cAkorfwzI3LQmoKNmy68R1TZYEezJuPAHjeJciTyJrc',
  BBLA:  '1hIOZdQtZbzDVtqdeQp1hFV0Os-Z_BTFHr4O1pYEmwiM',
  ABBR:  '1jGNPBO0Y4pWOag4trgigBlUOsy2bpdT3t_EoEqqAl4Y',
}

// Parse MM/DD/YYYY or similar date string safely
function parseDate(str) {
  if (!str || typeof str !== 'string') return null
  const s = str.trim()
  if (!s || s === '[URLs]') return null
  const d = new Date(s)
  if (isNaN(d.getTime())) return null
  return d
}

// Safe float parse — returns null for empty/non-numeric
function parseFloat2(str) {
  if (!str || typeof str !== 'string') return null
  const s = str.trim()
  if (!s) return null
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

// Safe string — null if empty or placeholder
function parseStr(str) {
  if (!str || typeof str !== 'string') return null
  const s = str.trim()
  if (!s || s === '[URLs]') return null
  return s
}

// Detect if a row is a section 2 header
// col[0] === 'Location' && col[2] contains 'Best'
function isSection2Header(row) {
  return (
    row[0]?.trim() === 'Location' &&
    (row[2] || '').toLowerCase().includes('best')
  )
}

// Detect if a row is a section 1 header
function isSection1Header(row) {
  return (
    row[0]?.trim() === 'Location' &&
    (row[2] || '').toLowerCase().includes('daycare') &&
    !(row[2] || '').toLowerCase().includes('best')
  )
}

function parseSEOData(rows) {
  const section1Rows = []
  const section2Rows = []
  let inSection1 = false
  let inSection2 = false

  let section1Started = false
  for (const row of rows) {
    if (!row.some(c => c?.trim())) continue // skip empty rows

    if (isSection2Header(row)) {
      inSection1 = false
      inSection2 = true
      continue
    }
    if (isSection1Header(row)) {
      // Only enter section 1 once — stop reading if we see a duplicate header
      if (section1Started) {
        inSection1 = false // stop processing section 1 entirely
        continue
      }
      section1Started = true
      inSection1 = true
      inSection2 = false
      continue
    }

    if (inSection1) section1Rows.push(row)
    else if (inSection2) section2Rows.push(row)
  }

  const toRecord = (row, group) => {
    const dateRaw = row[1]?.trim()
    const date = parseDate(dateRaw)
    if (!date) return null

    return {
      locationName: parseStr(row[0]) || '',
      scanDate: date,
      keywordGroup: group,
      solvDaycare: parseFloat2(row[2]),
      solvPreschool: parseFloat2(row[3]),
      arpDaycare: parseStr(row[4]),
      arpPreschool: parseStr(row[5]),
      reportUrlDaycare: parseStr(row[6]),
      reportUrlPreschool: parseStr(row[7]),
    }
  }

  const primary = section1Rows.map(r => toRecord(r, 'primary')).filter(Boolean)
  const best = section2Rows.map(r => toRecord(r, 'best')).filter(Boolean)
  return [...primary, ...best]
}

function parseGBPData(rows) {
  const records = []
  for (const row of rows) {
    // Skip header rows and empty rows
    if (!row[0]?.trim() || row[0].trim() === 'Date') continue
    const month = parseDate(row[0])
    if (!month) continue

    records.push({
      locationName: parseStr(row[1]) || '',
      month,
      profileInteractions: parseInt(row[2]) || null,
      profileViews: parseInt(row[3]) || null,
      searches: parseInt(row[4]) || null,
      topSearch1: parseStr(row[5]),
      topSearch2: parseStr(row[6]),
      topSearch3: parseStr(row[7]),
      topSearch4: parseStr(row[8]),
      calls: parseInt(row[9]) || null,
      directionRequests: parseInt(row[10]) || null,
      websiteClicks: parseInt(row[11]) || null,
    })
  }
  return records
}

async function upsertSEOSnapshot(acronym, records) {
  let count = 0
  for (const r of records) {
    try {
      await pool.query(
        `INSERT INTO "ClientSEOSnapshot"
          ("clientAcronym","locationName","scanDate","keywordGroup","solvDaycare","solvPreschool","arpDaycare","arpPreschool","reportUrlDaycare","reportUrlPreschool")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT ("clientAcronym","locationName","scanDate","keywordGroup")
         DO UPDATE SET
           "solvDaycare"=$5,"solvPreschool"=$6,"arpDaycare"=$7,"arpPreschool"=$8,
           "reportUrlDaycare"=$9,"reportUrlPreschool"=$10`,
        [acronym, r.locationName, r.scanDate, r.keywordGroup,
         r.solvDaycare, r.solvPreschool, r.arpDaycare, r.arpPreschool,
         r.reportUrlDaycare, r.reportUrlPreschool]
      )
      count++
    } catch (e) {
      console.error(`  ⚠ SEO upsert error (${acronym}/${r.locationName}/${r.scanDate}):`, e.message)
    }
  }
  return count
}

async function upsertGBPMonthly(acronym, records) {
  let count = 0
  for (const r of records) {
    try {
      await pool.query(
        `INSERT INTO "ClientSEOGBPMonthly"
          ("clientAcronym","locationName","month","profileInteractions","profileViews","searches","topSearch1","topSearch2","topSearch3","topSearch4","calls","directionRequests","websiteClicks")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT ("clientAcronym","locationName","month")
         DO UPDATE SET
           "profileInteractions"=$4,"profileViews"=$5,"searches"=$6,
           "topSearch1"=$7,"topSearch2"=$8,"topSearch3"=$9,"topSearch4"=$10,
           "calls"=$11,"directionRequests"=$12,"websiteClicks"=$13`,
        [acronym, r.locationName, r.month,
         r.profileInteractions, r.profileViews, r.searches,
         r.topSearch1, r.topSearch2, r.topSearch3, r.topSearch4,
         r.calls, r.directionRequests, r.websiteClicks]
      )
      count++
    } catch (e) {
      console.error(`  ⚠ GBP upsert error (${acronym}/${r.locationName}/${r.month}):`, e.message)
    }
  }
  return count
}

async function syncClient(sheetsApi, acronym, sheetId) {
  try {
    // Read SEO Data tab
    const [seoRes, gbpRes] = await Promise.all([
      sheetsApi.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'SEO Data!A1:H120' }),
      sheetsApi.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'GBP Data!A1:L120' }),
    ])

    const seoRows = seoRes.data.values || []
    const gbpRows = gbpRes.data.values || []

    const seoRecords = parseSEOData(seoRows)
    const gbpRecords = parseGBPData(gbpRows)

    const seoCount = await upsertSEOSnapshot(acronym, seoRecords)
    const gbpCount = await upsertGBPMonthly(acronym, gbpRecords)

    console.log(`  ✓ ${acronym}: ${seoCount} SEO rows, ${gbpCount} GBP rows`)
    return { seoCount, gbpCount }
  } catch (e) {
    console.error(`  ✗ ${acronym} failed:`, e.message)
    return { seoCount: 0, gbpCount: 0 }
  }
}

async function main() {
  console.log('🔄 Syncing SEO data from Google Sheets...\n')

  const auth = new google.auth.GoogleAuth({
    keyFile: GOOGLE_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
  const sheetsApi = google.sheets({ version: 'v4', auth })

  let totalSEO = 0
  let totalGBP = 0

  for (const [acronym, sheetId] of Object.entries(SEO_SHEETS)) {
    const { seoCount, gbpCount } = await syncClient(sheetsApi, acronym, sheetId)
    totalSEO += seoCount
    totalGBP += gbpCount
    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 200))
  }

  console.log(`\n✅ Done! Total: ${totalSEO} SEO snapshots, ${totalGBP} GBP monthly rows`)
  await pool.end()
}

main().catch(async (e) => {
  console.error('Fatal:', e.message)
  await pool.end()
  process.exit(1)
})
