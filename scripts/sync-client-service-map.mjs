/**
 * sync-client-service-map.mjs
 * Reads two tabs from the Client Services sheet and upserts ClientServiceMap rows.
 *
 * Sheet 1: "[UPDATED 2026] Active Client List"
 *   Cols: Record ID | Acronym | Company name | Website | SEO | CRM | Google ads |
 *         Blueprint | Command | Virtual Tour | S3 | Recruitment
 *
 * Sheet 2: "GYC Active Client List - LIVE CLIENTS …_all"
 *   Cols: Acronym (full name with acronym in parens) | # of Locations | MC
 *
 * Strategy:
 *   1. Build a map from acronym → GA (MC) + locations from Sheet 2
 *   2. For each row in Sheet 1, merge in GA/locations and upsert
 */
import pg from 'pg'
import { google } from 'googleapis'
import { readFileSync } from 'fs'
import { homedir } from 'os'

const { Client } = pg

function loadEnv() {
  try {
    const raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {}
}
loadEnv()

const SHEET_ID = '1HTJJVAmQiXJwc1XvsOenP6Sg1DwZYc5aKrRVM1ujdNI'

function isActive(v) {
  const s = (v || '').trim().toLowerCase()
  return s === 'active' || s === 'gyc website' || s === 'the big site' ||
    s === 'gyc crm' || s === 'crm boost' || s === 'crm full srevice' ||
    s === 'crm full service'
}

function normalizeAcronym(raw) {
  return (raw || '').trim().toUpperCase()
}

function normalizeCRM(raw) {
  const s = (raw || '').trim().toLowerCase()
  if (s === 'gyc crm') return 'GYC CRM'
  if (s.startsWith('crm boost')) return 'CRM Boost'
  if (s.startsWith('crm full')) return 'CRM Full Service'
  if (s === 'non-active') return null
  return raw ? raw.trim() : null
}

/** Extract acronym from "Full Company Name (ACRONYM)" */
function extractAcronymFromFullName(fullName) {
  const m = (fullName || '').match(/\(([^)]+)\)\s*$/)
  return m ? m[1].trim().toUpperCase() : null
}

async function main() {
  const keyFile = process.env.GOOGLE_CREDENTIALS_PATH ||
    `${homedir()}/.openclaw/credentials/google-console.json`
  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
  const sheets = google.sheets({ version: 'v4', auth })

  // ── Read Sheet 2: GA/MC assignments ───────────────────────────────────────
  console.log('📄 Reading GA assignments tab…')
  const r2 = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "'GYC Active Client List - LIVE CLIENTS 780557c864f442d2bb0ac9a9d2e47121_all'!A1:C500",
  })
  const gaRows = r2.data.values || []
  console.log(`   ${gaRows.length - 1} rows`)

  // acronym → { ga, locations }
  const gaMap = new Map()
  for (const row of gaRows.slice(1)) {
    const fullName = (row[0] || '').trim()
    const locs = parseInt(row[1]) || null
    const mc   = (row[2] || '').trim() || null
    const acronym = extractAcronymFromFullName(fullName)
    if (acronym) {
      gaMap.set(acronym, { ga: mc, locations: locs })
    }
  }
  console.log(`   ${gaMap.size} acronyms mapped`)

  // ── Read Sheet 1: Active Client List ──────────────────────────────────────
  console.log('📄 Reading Active Client List tab…')
  const r1 = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "'[UPDATED 2026] Active Client List'!A1:L330",
  })
  const clientRows = r1.data.values || []
  console.log(`   ${clientRows.length - 1} rows`)

  // ── Build records ─────────────────────────────────────────────────────────
  const records = []
  for (const row of clientRows.slice(1)) {
    const acronym     = normalizeAcronym(row[1])
    const companyName = (row[2] || '').trim() || null
    if (!acronym) continue

    const website    = (row[3] || '').trim()
    const seo        = (row[4] || '').trim()
    const crmRaw     = (row[5] || '').trim()
    const gads       = (row[6] || '').trim()
    const blueprint  = (row[7] || '').trim()
    const command    = (row[8] || '').trim()
    const s3         = (row[10] || '').trim()
    const recruitment = (row[11] || '').trim()

    const gaInfo = gaMap.get(acronym) || {}

    records.push({
      acronym,
      companyName,
      crmType:     normalizeCRM(crmRaw),
      assignedGA:  gaInfo.ga || null,
      locations:   gaInfo.locations || null,
      hasWebsite:  isActive(website),
      hasSEO:      isActive(seo),
      hasGoogleAds: isActive(gads),
      hasBlueprint: isActive(blueprint),
      hasCommand:   isActive(command),
      hasS3:        isActive(s3),
      hasRecruitment: isActive(recruitment),
    })
  }

  console.log(`   ${records.length} records built`)

  // ── Upsert to Neon ─────────────────────────────────────────────────────────
  const db = new Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()
  console.log('\n💾 Upserting to Neon…')

  let upserted = 0
  for (const r of records) {
    await db.query(`
      INSERT INTO "ClientServiceMap"
        ("tenantId","acronym","companyName","crmType","assignedGA","locations",
         "hasWebsite","hasSEO","hasGoogleAds","hasBlueprint","hasCommand","hasS3","hasRecruitment","syncedAt")
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())
      ON CONFLICT ("acronym") DO UPDATE SET
        "companyName"    = EXCLUDED."companyName",
        "crmType"        = EXCLUDED."crmType",
        "assignedGA"     = EXCLUDED."assignedGA",
        "locations"      = EXCLUDED."locations",
        "hasWebsite"     = EXCLUDED."hasWebsite",
        "hasSEO"         = EXCLUDED."hasSEO",
        "hasGoogleAds"   = EXCLUDED."hasGoogleAds",
        "hasBlueprint"   = EXCLUDED."hasBlueprint",
        "hasCommand"     = EXCLUDED."hasCommand",
        "hasS3"          = EXCLUDED."hasS3",
        "hasRecruitment" = EXCLUDED."hasRecruitment",
        "syncedAt"       = NOW()
    `, [
      'gyc', r.acronym, r.companyName, r.crmType, r.assignedGA, r.locations,
      r.hasWebsite, r.hasSEO, r.hasGoogleAds, r.hasBlueprint,
      r.hasCommand, r.hasS3, r.hasRecruitment,
    ])
    upserted++
  }

  console.log(`✅ Upserted ${upserted} ClientServiceMap records`)

  // Quick stats
  const { rows: stats } = await db.query(`
    SELECT
      COUNT(*) as total,
      COUNT("assignedGA") as with_ga,
      COUNT("crmType") as with_crm,
      SUM(CASE WHEN "hasGoogleAds" THEN 1 ELSE 0 END) as has_gads
    FROM "ClientServiceMap" WHERE "tenantId" = 'gyc'
  `)
  console.log('\n📊 Stats:')
  console.log(`   Total clients: ${stats[0].total}`)
  console.log(`   With GA assigned: ${stats[0].with_ga}`)
  console.log(`   With CRM type: ${stats[0].with_crm}`)
  console.log(`   Has Google Ads: ${stats[0].has_gads}`)

  // Sample GA distribution
  const { rows: gaDist } = await db.query(`
    SELECT "assignedGA", COUNT(*) as cnt
    FROM "ClientServiceMap"
    WHERE "tenantId" = 'gyc' AND "assignedGA" IS NOT NULL
    GROUP BY "assignedGA" ORDER BY cnt DESC
  `)
  console.log('\n👤 GA distribution:')
  gaDist.forEach(r => console.log(`   ${r.assignedGA || r.assignedga}: ${r.cnt} clients`))

  await db.end()
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
