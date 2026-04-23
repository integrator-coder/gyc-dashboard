#!/usr/bin/env node
/**
 * sync-client-profiles.mjs
 * Builds / refreshes the ClientProfile table — single source of truth for GYC clients.
 *
 * Sources (in merge priority order):
 *   1. Google Sheet 2 "[UPDATED 2026] Active Client List"  → acronym, company, services
 *   2. Google Sheet 2 "GYC Active Client List - LIVE CLIENTS..." → locations, assignedGA
 *   3. StripeCustomer table                                → mrr, stripeStatus, email, phone
 *   4. ClientIdentityMap + StripeCustomer.ghlContactId    → ghlContactId
 *   5. DunningHistory (if it exists)                      → overdue history
 *
 * Post-sync:
 *   - Backfills StripeCustomer.acronym from matched ClientProfile rows
 *   - Backfills ZoomCall.clientProfileId for calls with a matching ghlContactId
 */

import pg from 'pg'
import { google } from 'googleapis'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import os from 'os'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─── Env loader ───────────────────────────────────────────────────────────────
try {
  const envPath = resolve(__dirname, '../.env.local')
  const envContent = readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx < 0) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
} catch { /* env set via system */ }

// ─── DB ───────────────────────────────────────────────────────────────────────
const { Pool } = pg
const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// ─── Google Sheets auth ───────────────────────────────────────────────────────
function createSheetsAuth() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
    return new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })
  }
  const keyFile = process.env.GOOGLE_CREDENTIALS_PATH
    || `${os.homedir()}/.openclaw/credentials/google-console.json`
  return new google.auth.GoogleAuth({
    keyFile,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
}

async function sheetValues(auth, spreadsheetId, range) {
  const client = await auth.getClient()
  const sheets = google.sheets({ version: 'v4', auth: client })
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range })
  return res.data.values || []
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
/** Normalise a company name for fuzzy matching */
function normalizeCompany(name) {
  if (!name) return ''
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

/** Extract acronym from "Company Name (ACR)" style strings */
function extractAcronymFromName(str) {
  if (!str) return null
  const m = str.trim().match(/\(([A-Z0-9]{2,8})\)\s*$/)
  return m ? m[1] : null
}

/** Strip the (ACR) suffix to get a clean company name */
function stripAcronymSuffix(str) {
  if (!str) return str
  return str.replace(/\s*\([A-Z0-9]{2,8}\)\s*$/, '').trim()
}

function normalizeAcronym(value) {
  const normalized = String(value || '').trim().toUpperCase()
  return normalized || null
}

function getStripeComparableCompany(stripeRow) {
  return stripAcronymSuffix(stripeRow?.companyName || stripeRow?.name || stripeRow?.email || '')
}

function getStripeComparableAcronym(stripeRow) {
  return normalizeAcronym(
    stripeRow?.acronym
    || extractAcronymFromName(stripeRow?.companyName)
    || extractAcronymFromName(stripeRow?.name)
  )
}

function dedupeStripeRows(rows) {
  const seen = new Set()
  const unique = []
  for (const row of rows || []) {
    if (!row?.id || seen.has(row.id)) continue
    seen.add(row.id)
    unique.push(row)
  }
  return unique
}

function scoreStripeRowForProfile(stripeRow, { companyName, acronym, ghlContactId }) {
  let score = 0

  const targetCompany = normalizeCompany(stripAcronymSuffix(companyName))
  const targetAcronym = normalizeAcronym(acronym)
  const stripeCompany = normalizeCompany(getStripeComparableCompany(stripeRow))
  const stripeAcronym = getStripeComparableAcronym(stripeRow)

  if (ghlContactId && stripeRow.ghlContactId && ghlContactId === stripeRow.ghlContactId) score += 100
  if (targetCompany && stripeCompany && targetCompany === stripeCompany) score += 80
  if (targetAcronym && stripeAcronym && targetAcronym === stripeAcronym) score += 70
  if (targetCompany && stripeCompany && targetCompany.length >= 6 && (stripeCompany.includes(targetCompany) || targetCompany.includes(stripeCompany))) score += 25
  if (targetAcronym && stripeRow.companyName && stripeRow.companyName.includes(`(${targetAcronym})`)) score += 20
  if (Number(stripeRow.mrr || 0) > 0) score += 5

  return score
}

function pickPrimaryStripeRow(rows, identity) {
  const ranked = dedupeStripeRows(rows)
    .map((row) => ({ row, score: scoreStripeRowForProfile(row, identity) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      const mrrDiff = Number(b.row.mrr || 0) - Number(a.row.mrr || 0)
      if (mrrDiff !== 0) return mrrDiff
      return String(a.row.id).localeCompare(String(b.row.id))
    })

  return ranked[0]?.row || null
}

function collectStripeBundle(stripeRows, { companyName, acronym }) {
  const targetCompany = normalizeCompany(stripAcronymSuffix(companyName))
  const targetAcronym = normalizeAcronym(acronym)

  return dedupeStripeRows(stripeRows).filter((row) => {
    const stripeCompany = normalizeCompany(getStripeComparableCompany(row))
    const stripeAcronym = getStripeComparableAcronym(row)

    return Boolean(
      (targetCompany && stripeCompany && targetCompany === stripeCompany)
      || (targetAcronym && stripeAcronym && targetAcronym === stripeAcronym)
    )
  })
}

function resolveStripeForProfile(stripeRows, { companyName, acronym, ghlContactId = null }) {
  const bundle = collectStripeBundle(stripeRows, { companyName, acronym })
  const primary = pickPrimaryStripeRow(bundle, { companyName, acronym, ghlContactId })

  if (!primary) return null

  const aggregateMrr = bundle.reduce((sum, row) => sum + Number(row.mrr || 0), 0)
  const status = bundle.some((row) => row.status === 'past_due')
    ? 'past_due'
    : (primary.status || null)

  return {
    primary,
    bundle,
    aggregateMrr,
    status,
  }
}

// ─── Source 1: Google Sheet "Updated 2026" tab ────────────────────────────────
// Cols: RecordID(A), Acronym(B), CompanyName(C), Website(D), SEO(E), CRM(F),
//       GoogleAds(G), Blueprint(H), Command(I), VirtualTour(J), S3(K), Recruitment(L)
async function readUpdated2026(auth) {
  console.log('  📋 Reading [UPDATED 2026] Active Client List...')
  const rows = await sheetValues(
    auth,
    '1HTJJVAmQiXJwc1XvsOenP6Sg1DwZYc5aKrRVM1ujdNI',
    '[UPDATED 2026] Active Client List!A1:M500',
  )
  if (!rows.length) return []
  // Skip header row (index 0)
  const results = []
  for (const row of rows.slice(1)) {
    const acronym   = (row[1] || '').trim() || null
    let   company   = (row[2] || '').trim()
    if (!company) continue

    // Strip acronym suffix from company name if present, e.g. "Acme Co (AC)"
    company = stripAcronymSuffix(company)

    const websiteVal  = (row[3] || '').trim()
    const seoVal      = (row[4] || '').trim()
    const crmVal      = (row[5] || '').trim()
    const gadsVal     = (row[6] || '').trim()
    const blueprintVal = (row[7] || '').trim()
    const commandVal  = (row[8] || '').trim()

    const serviceList = []
    if (websiteVal)   serviceList.push(websiteVal === 'GYC website' ? 'GYC Website' : 'Website')
    if (seoVal)       serviceList.push('SEO')
    if (crmVal)       serviceList.push('CRM')
    if (gadsVal)      serviceList.push('Google Ads')
    if (blueprintVal) serviceList.push('Blueprint')
    if (commandVal)   serviceList.push('Command')

    results.push({
      acronym,
      companyName: company,
      hasWebsite:    Boolean(websiteVal),
      hasSEO:        Boolean(seoVal),
      hasCRM:        Boolean(crmVal),
      crmType:       crmVal || null,
      hasGoogleAds:  Boolean(gadsVal),
      hasBlueprint:  Boolean(blueprintVal),
      hasCommand:    Boolean(commandVal),
      serviceList,
    })
  }
  console.log(`    → ${results.length} companies found`)
  return results
}

// ─── Source 2: Google Sheet "Live Clients" tab ────────────────────────────────
// Cols: CompanyName with (ACRONYM) in parens(A), Locations(B), MC/GA(C)
async function readLiveClients(auth) {
  console.log('  📋 Reading GYC Active Client List - LIVE CLIENTS tab...')
  const rows = await sheetValues(
    auth,
    '1HTJJVAmQiXJwc1XvsOenP6Sg1DwZYc5aKrRVM1ujdNI',
    'GYC Active Client List - LIVE CLIENTS 780557c864f442d2bb0ac9a9d2e47121_all!A1:D500',
  )
  if (!rows.length) return {}

  // Build map: acronym → { locationCount, assignedGA, companyName }
  const byAcronym = {}
  const byNorm    = {}

  for (const row of rows.slice(1)) {
    const rawName  = (row[0] || '').trim()
    if (!rawName) continue
    const acronym  = extractAcronymFromName(rawName)
    const company  = stripAcronymSuffix(rawName)
    const locs     = parseInt(row[1] || '1', 10) || 1
    const ga       = (row[2] || '').trim() || null

    const entry = { locationCount: locs, assignedGA: ga, companyName: company }

    if (acronym) byAcronym[acronym] = entry
    byNorm[normalizeCompany(company)] = entry
  }

  console.log(`    → ${Object.keys(byAcronym).length} entries with acronyms`)
  return { byAcronym, byNorm }
}

// ─── Source 3: StripeCustomer table ──────────────────────────────────────────
async function readStripeCustomers() {
  console.log('  💳 Reading StripeCustomer table...')
  const { rows } = await pool.query(`
    SELECT id, name, email, status, mrr, "canceledAt", "companyName", "ownerName", phone, "ghlContactId", acronym
    FROM "StripeCustomer"
    WHERE "tenantId" = 'gyc'
  `)
  console.log(`    → ${rows.length} Stripe customers`)
  return rows
}

// ─── Source 4: ClientIdentityMap ─────────────────────────────────────────────
async function readIdentityMap() {
  console.log('  🗺️  Reading ClientIdentityMap...')
  const { rows } = await pool.query(`
    SELECT "stripeCustomerId", "ghlContactId", acronym, "displayName"
    FROM "ClientIdentityMap"
    WHERE "tenantId" = 'gyc'
  `)
  // Build stripeId → ghlContactId map
  const stripeToGhl = {}
  for (const r of rows) {
    if (r.stripeCustomerId && r.ghlContactId) {
      stripeToGhl[r.stripeCustomerId] = r.ghlContactId
    }
  }
  console.log(`    → ${Object.keys(stripeToGhl).length} stripe↔GHL mappings`)
  return { stripeToGhl }
}

// ─── Source 5: DunningHistory (optional) ─────────────────────────────────────
async function readDunningHistory() {
  try {
    const { rows: exists } = await pool.query(`SELECT to_regclass('"DunningHistory"') AS r`)
    if (!exists[0]?.r) {
      console.log('  ⏭️  DunningHistory table not found — skipping')
      return {}
    }
    const { rows } = await pool.query(`
      SELECT
        "clientName",
        COUNT(*)                                                       AS "overdueCount",
        MAX("dueDate")                                                 AS "lastOverdueDate",
        AVG("daysToCatchUp")                                           AS "avgDaysToCatchUp",
        AVG(CASE WHEN "everPaidBack" THEN 1.0 ELSE 0 END)             AS "catchUpRate",
        (array_agg("reason" ORDER BY "dueDate" DESC))[1]              AS "lastOverdueReason"
      FROM "DunningHistory"
      WHERE "tenantId" = 'gyc'
      GROUP BY "clientName"
    `)
    const map = {}
    for (const r of rows) {
      map[normalizeCompany(r.clientName)] = r
    }
    console.log(`  📋 DunningHistory: ${rows.length} clients with history`)
    return map
  } catch (e) {
    console.warn('  ⚠️  DunningHistory read error:', e.message)
    return {}
  }
}

// ─── Build Stripe index ───────────────────────────────────────────────────────
/**
 * Returns a lookup function: given a normalized company name (or null),
 * try to find the best Stripe customer match.
 */
function buildStripeIndex(stripeRows) {
  const byCompany = {}
  const byAcronym = {}

  for (const sc of stripeRows) {
    const comparableCompany = getStripeComparableCompany(sc)
    const comparableAcronym = getStripeComparableAcronym(sc)

    if (comparableCompany) {
      const key = normalizeCompany(comparableCompany)
      if (key) byCompany[key] = sc
    }

    if (comparableAcronym) {
      byAcronym[comparableAcronym] ||= []
      byAcronym[comparableAcronym].push(sc)
    }
  }

  return function findStripeCustomer(companyName, acronym) {
    const normComp = normalizeCompany(companyName)
    const normAcr = normalizeAcronym(acronym)
    const candidates = []

    // 1. Exact normalized company name
    if (byCompany[normComp]) candidates.push(byCompany[normComp])

    // 2. Exact acronym match from StripeCustomer / suffix
    if (normAcr && byAcronym[normAcr]?.length) {
      candidates.push(...byAcronym[normAcr])
    }

    // 3. Check if any stripe company name contains the acronym at the end in parens
    if (normAcr) {
      const suffix = normalizeCompany(`(${normAcr})`)
      for (const [k, sc] of Object.entries(byCompany)) {
        if (k.endsWith(suffix)) candidates.push(sc)
      }
    }

    // 4. Partial match: sheet company name is contained within stripe company name or vice versa
    if (normComp.length >= 6) {
      const partials = []
      for (const [k, sc] of Object.entries(byCompany)) {
        if (k.includes(normComp) || normComp.includes(k)) partials.push(sc)
      }

      if (partials.length === 1) candidates.push(partials[0])
    }

    return pickPrimaryStripeRow(candidates, { companyName, acronym, ghlContactId: null })
  }
}

// ─── Upsert one ClientProfile row ────────────────────────────────────────────
async function upsertClientProfile(profile) {
  const {
    tenantId, acronym, companyName, ownerName, email, phone,
    locationCount, status, assignedGA,
    crmType, cancelledDate,
    hasWebsite, hasSEO, hasCRM, hasGoogleAds, hasBlueprint, hasPaidMedia, hasCommand,
    serviceList,
    mrr, stripeCustomerId, stripeStatus, isOverdue,
    overdueCount, lastOverdueDate, avgDaysToCatchUp, catchUpRate, lastOverdueReason,
    ghlContactId, ghlPipelineStage,
  } = profile

  const { rows } = await pool.query(`
    INSERT INTO "ClientProfile" (
      "tenantId", "acronym", "companyName", "ownerName", "email", "phone",
      "locationCount", "status", "assignedGA",
      "crmType", "cancelledDate",
      "hasWebsite", "hasSEO", "hasCRM", "hasGoogleAds", "hasBlueprint", "hasPaidMedia", "hasCommand",
      "serviceList",
      "mrr", "stripeCustomerId", "stripeStatus", "isOverdue",
      "overdueCount", "lastOverdueDate", "avgDaysToCatchUp", "catchUpRate", "lastOverdueReason",
      "ghlContactId", "ghlPipelineStage",
      "lastEnrichedAt", "createdAt", "updatedAt"
    ) VALUES (
      $1,$2,$3,$4,$5,$6,
      $7,$8,$9,
      $10,$11,
      $12,$13,$14,$15,$16,$17,$18,
      $19,
      $20,$21,$22,$23,
      $24,$25,$26,$27,$28,
      $29,$30,
      NOW(), NOW(), NOW()
    )
    ON CONFLICT ("tenantId", "companyName") DO UPDATE SET
      "acronym"            = COALESCE(EXCLUDED."acronym", "ClientProfile"."acronym"),
      "ownerName"          = COALESCE(EXCLUDED."ownerName", "ClientProfile"."ownerName"),
      "email"              = COALESCE(EXCLUDED."email", "ClientProfile"."email"),
      "phone"              = COALESCE(EXCLUDED."phone", "ClientProfile"."phone"),
      "locationCount"      = COALESCE(EXCLUDED."locationCount", "ClientProfile"."locationCount"),
      "status"             = COALESCE(EXCLUDED."status", "ClientProfile"."status"),
      "assignedGA"         = COALESCE(EXCLUDED."assignedGA", "ClientProfile"."assignedGA"),
      "crmType"            = COALESCE(EXCLUDED."crmType", "ClientProfile"."crmType"),
      "cancelledDate"      = COALESCE(EXCLUDED."cancelledDate", "ClientProfile"."cancelledDate"),
      "hasWebsite"         = EXCLUDED."hasWebsite",
      "hasSEO"             = EXCLUDED."hasSEO",
      "hasCRM"             = EXCLUDED."hasCRM",
      "hasGoogleAds"       = EXCLUDED."hasGoogleAds",
      "hasBlueprint"       = EXCLUDED."hasBlueprint",
      "hasPaidMedia"       = EXCLUDED."hasPaidMedia",
      "hasCommand"         = EXCLUDED."hasCommand",
      "serviceList"        = EXCLUDED."serviceList",
      "mrr"                = COALESCE(EXCLUDED."mrr", "ClientProfile"."mrr"),
      "stripeCustomerId"   = COALESCE(EXCLUDED."stripeCustomerId", "ClientProfile"."stripeCustomerId"),
      "stripeStatus"       = COALESCE(EXCLUDED."stripeStatus", "ClientProfile"."stripeStatus"),
      "isOverdue"          = EXCLUDED."isOverdue",
      "overdueCount"       = COALESCE(EXCLUDED."overdueCount", "ClientProfile"."overdueCount"),
      "lastOverdueDate"    = COALESCE(EXCLUDED."lastOverdueDate", "ClientProfile"."lastOverdueDate"),
      "avgDaysToCatchUp"   = COALESCE(EXCLUDED."avgDaysToCatchUp", "ClientProfile"."avgDaysToCatchUp"),
      "catchUpRate"        = COALESCE(EXCLUDED."catchUpRate", "ClientProfile"."catchUpRate"),
      "lastOverdueReason"  = COALESCE(EXCLUDED."lastOverdueReason", "ClientProfile"."lastOverdueReason"),
      "ghlContactId"       = COALESCE(EXCLUDED."ghlContactId", "ClientProfile"."ghlContactId"),
      "ghlPipelineStage"   = COALESCE(EXCLUDED."ghlPipelineStage", "ClientProfile"."ghlPipelineStage"),
      "lastEnrichedAt"     = NOW(),
      "updatedAt"          = NOW()
    RETURNING id
  `, [
    tenantId, acronym, companyName, ownerName || null, email || null, phone || null,
    locationCount || 1, status || 'active', assignedGA || null,
    crmType || null, cancelledDate || null,
    Boolean(hasWebsite), Boolean(hasSEO), Boolean(hasCRM),
    Boolean(hasGoogleAds), Boolean(hasBlueprint), Boolean(hasPaidMedia), Boolean(hasCommand),
    serviceList?.length ? serviceList : null,
    mrr || 0, stripeCustomerId || null, stripeStatus || null, Boolean(isOverdue),
    overdueCount || 0, lastOverdueDate || null, avgDaysToCatchUp || null,
    catchUpRate !== undefined ? catchUpRate : null, lastOverdueReason || null,
    ghlContactId || null, ghlPipelineStage || null,
  ])
  return rows[0]?.id
}

// ─── Source 6: Notion Database ──────────────────────────────────────────────
const NOTION_KEY = process.env.NOTION_API_KEY || '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'
const NOTION_DB_ID = process.env.NOTION_DATABASE_ID || '780557c864f442d2bb0ac9a9d2e47121'

async function fetchNotionDatabase(databaseId, notionKey) {
  const pages = []
  let cursor = undefined
  while (true) {
    const body = { page_size: 100 }
    if (cursor) body.start_cursor = cursor
    const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionKey}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })
    const data = await res.json()
    if (!res.ok) throw new Error(`Notion API error: ${data.message || JSON.stringify(data)}`)
    pages.push(...(data.results || []))
    if (!data.has_more) break
    cursor = data.next_cursor
  }
  return pages
}

function extractNotionText(prop) {
  return prop?.rich_text?.[0]?.plain_text || prop?.title?.[0]?.plain_text || null
}
function extractNotionEmail(prop) { return prop?.email || prop?.rich_text?.[0]?.plain_text || null }
function extractNotionPhone(prop) { return prop?.phone_number || prop?.rich_text?.[0]?.plain_text || null }
function extractNotionSelect(prop) { return prop?.select?.name || null }
function extractNotionMultiSelect(prop) { return prop?.multi_select?.map(s => s.name).join(', ') || null }
function extractNotionUrl(prop) { return prop?.url || null }
function extractNotionNumber(prop) { return prop?.number ?? null }

function mapNotionBillingStatus(val) {
  if (!val) return null
  const v = val.toLowerCase()
  if (v === 'active' || v === 'current') return 'active'
  if (v === 'paused')                    return 'paused'
  if (v === 'cancelled' || v === 'canceled') return 'cancelled'
  return null
}

async function syncFromNotion(pgPool) {
  console.log('  🔔 Fetching Notion database...')
  const pages = await fetchNotionDatabase(NOTION_DB_ID, NOTION_KEY)
  console.log(`    → ${pages.length} Notion pages fetched`)

  let matched = 0, skipped = 0
  const fieldCounters = {
    directorName: 0, directorEmail: 0, directorPhone: 0,
    avgTuition: 0, currentEnrollment: 0, centerCapacity: 0,
    schoolYearBegins: 0, timeZone: 0, clientFolderUrl: 0, leadDataUrl: 0,
    ownerName: 0, email: 0, phone: 0,
    crmType: 0, assignedGA: 0, locationCount: 0,
    hasWebsite: 0, hasSEO: 0, hasBlueprint: 0, hasGoogleAds: 0, hasPaidMedia: 0,
    status: 0,
  }

  for (const page of pages) {
    const props = page.properties || {}

    // Match key: Acronym — Notion title contains "Company Name (ACR)", extract just the ACR
    const rawTitle = extractNotionText(props['Acronym'] || props['Name'])
    const acronym = extractAcronymFromName(rawTitle)
    if (!acronym) { skipped++; continue }

    // Check if ClientProfile exists by acronym (case-insensitive)
    const existing = await pgPool.query(
      `SELECT id, "ownerName", email, phone, "crmType", "assignedGA", status
       FROM "ClientProfile"
       WHERE "tenantId" = 'gyc' AND LOWER(acronym) = LOWER($1)
       LIMIT 1`,
      [acronym]
    )
    if (!existing.rows.length) { skipped++; continue }
    matched++

    const cp = existing.rows[0]
    const cpId = cp.id

    // Extract all Notion fields
    const ownerName       = extractNotionText(props["Owner's Name"])
    const ownerEmail      = extractNotionEmail(props["Owner's Email"])
    const ownerPhone      = extractNotionPhone(props["Owner's Phone"])
    // Note: some Notion field names have trailing spaces
    const directorName    = extractNotionText(props["Director's Name "] || props["Director's Name"])
    const directorEmail   = extractNotionEmail(props["Director's Email (1)"] || props["Director's Email"])
    const directorPhone   = extractNotionPhone(props["Director's Phone (1)"] || props["Director's Phone"])
    const avgTuition      = extractNotionNumber(props['Average Tuition'])
    const currentEnroll   = extractNotionText(props['Current enrollment'])
    const capacity        = extractNotionText(props['Capacity'])
    const schoolYearBegins = extractNotionText(props['School Year Begins'])
    const timeZone        = extractNotionText(props['Time Zone'])
    const crmType         = extractNotionSelect(props['CRM'])
    const assignedGA      = extractNotionSelect(props['MC'])
    const locationCount   = extractNotionMultiSelect(props['# of Locations'])
    const websiteVal      = extractNotionSelect(props['Website'])
    const websiteUrl      = extractNotionUrl(props['Website URL'] || props['Website URL ']) || extractNotionUrl(props['Landing Page URL '] || props['Landing Page URL'])
    const seoVal          = extractNotionMultiSelect(props['SEO'])
    const blueprintVal    = extractNotionSelect(props['Blueprint'])
    const googleAdsVal    = extractNotionSelect(props['Google Ads'])
    const paidAdsVal      = extractNotionSelect(props['Paid Ads '] || props['Paid Ads'])
    const clientFolderUrl = extractNotionUrl(props['Client Folder'])
    const leadDataUrl     = extractNotionUrl(props['Lead Data'])
    const billingStatus   = mapNotionBillingStatus(extractNotionSelect(props['Billing Status']))

    // Build SET clauses — Notion enrichment layer:
    // Director fields: always update (Notion-only source)
    // Other fields: only fill if currently null in DB
    const sets = []
    const vals = []
    let idx = 1

    const addSet = (col, val, forceOverwrite = false) => {
      if (val === null || val === undefined) return
      if (forceOverwrite) {
        sets.push(`"${col}" = $${idx++}`)
      } else {
        sets.push(`"${col}" = COALESCE("${col}", $${idx++})`)
      }
      vals.push(val)
      fieldCounters[col] = (fieldCounters[col] || 0) + 1
    }

    // Director info — Notion-only, always write
    addSet('directorName',  directorName,  true)
    addSet('directorEmail', directorEmail, true)
    addSet('directorPhone', directorPhone, true)

    // Enrichment — only fill nulls
    addSet('avgTuition',       avgTuition)
    addSet('currentEnrollment', currentEnroll)
    addSet('centerCapacity',   capacity)
    addSet('schoolYearBegins', schoolYearBegins)
    addSet('timeZone',         timeZone)
    addSet('website',          websiteUrl)
    addSet('clientFolderUrl',  clientFolderUrl)
    addSet('leadDataUrl',      leadDataUrl)
    addSet('ownerName',        ownerName)
    addSet('email',            ownerEmail)
    addSet('phone',            ownerPhone)
    addSet('crmType',          crmType)
    addSet('assignedGA',       assignedGA)

    // locationCount — parse number from multi_select string
    if (locationCount) {
      const n = parseInt(locationCount, 10)
      if (!isNaN(n)) {
        sets.push(`"locationCount" = COALESCE("locationCount", $${idx++})`)
        vals.push(n)
        fieldCounters['locationCount'] = (fieldCounters['locationCount'] || 0) + 1
      }
    }

    // Service flags — set true if Notion has a value (never downgrade to false)
    if (websiteVal)   { sets.push(`"hasWebsite" = CASE WHEN $${idx++} THEN true ELSE "hasWebsite" END`);   vals.push(true);  fieldCounters['hasWebsite']++  }
    if (seoVal)       { sets.push(`"hasSEO" = CASE WHEN $${idx++} THEN true ELSE "hasSEO" END`);           vals.push(true);  fieldCounters['hasSEO']++      }
    if (blueprintVal) { sets.push(`"hasBlueprint" = CASE WHEN $${idx++} THEN true ELSE "hasBlueprint" END`); vals.push(true); fieldCounters['hasBlueprint']++ }
    if (googleAdsVal) { sets.push(`"hasGoogleAds" = CASE WHEN $${idx++} THEN true ELSE "hasGoogleAds" END`); vals.push(true); fieldCounters['hasGoogleAds']++ }
    if (paidAdsVal)   { sets.push(`"hasPaidMedia" = CASE WHEN $${idx++} THEN true ELSE "hasPaidMedia" END`); vals.push(true); fieldCounters['hasPaidMedia']++ }

    // Billing status — overwrite only if null
    if (billingStatus) {
      sets.push(`"status" = COALESCE("status", $${idx++})`)
      vals.push(billingStatus)
      fieldCounters['status'] = (fieldCounters['status'] || 0) + 1
    }

    // Always store Notion page ID
    sets.push(`"notionPageId" = $${idx++}`)
    vals.push(page.id)
    sets.push(`"updatedAt" = NOW()`)

    if (sets.length > 2) { // more than just notionPageId + updatedAt
      vals.push(cpId)
      await pgPool.query(
        `UPDATE "ClientProfile" SET ${sets.join(', ')} WHERE id = $${idx}`,
        vals
      )
    }
  }

  console.log(`    → Matched: ${matched}  Skipped (no acronym match): ${skipped}`)
  console.log('    → Fields populated from Notion:')
  const populated = Object.entries(fieldCounters).filter(([, v]) => v > 0)
  for (const [col, count] of populated) {
    console.log(`       ${col}: ${count}`)
  }

  return { fetched: pages.length, matched, skipped, fieldCounters }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 ClientProfile Sync — starting\n')

  // ── Load all sources ──────────────────────────────────────────────────────
  const auth = createSheetsAuth()
  const [sheetCompanies, liveClientsData, stripeRows, { stripeToGhl }, dunningMap] = await Promise.all([
    readUpdated2026(auth),
    readLiveClients(auth),
    readStripeCustomers(),
    readIdentityMap(),
    readDunningHistory(),
  ])
  console.log()

  const { byAcronym: gaByAcronym = {}, byNorm: gaByNorm = {} } = liveClientsData
  const findStripe = buildStripeIndex(stripeRows)

  // ── Build index of stripe rows by stripeId for GHL lookup ────────────────
  const stripeById = {}
  for (const sc of stripeRows) stripeById[sc.id] = sc

  // ── Upsert all companies from Google Sheet ────────────────────────────────
  console.log(`\n📦 Upserting ${sheetCompanies.length} companies from Google Sheet...\n`)

  let created = 0, updated = 0, stripeMatched = 0, ghlMatched = 0, multiStripeBundles = 0

  for (const co of sheetCompanies) {
    const { acronym, companyName, hasWebsite, hasSEO, hasCRM, crmType,
            hasGoogleAds, hasBlueprint, hasCommand, serviceList } = co

    // Enrich from Live Clients tab
    const liveEntry = (acronym && gaByAcronym[acronym]) || gaByNorm[normalizeCompany(companyName)] || null
    const locationCount = liveEntry?.locationCount || 1
    const assignedGA    = liveEntry?.assignedGA    || null

    // Enrich from Stripe
    const sc = findStripe(companyName, acronym)
    let stripeCustomerId = null, stripeStatus = null, mrr = 0
    let email = null, phone = null, ownerName = null, isOverdue = false, ghlContactId = null

    if (sc) {
      const stripeBundle = resolveStripeForProfile(stripeRows, {
        companyName,
        acronym,
        ghlContactId: sc.ghlContactId || stripeToGhl[sc.id] || null,
      })

      const primaryStripe = stripeBundle?.primary || sc
      const relatedStripe = stripeBundle?.bundle?.length ? stripeBundle.bundle : [sc]

      stripeMatched++
      if (relatedStripe.length > 1) multiStripeBundles++

      stripeCustomerId = primaryStripe.id
      stripeStatus     = stripeBundle?.status || primaryStripe.status
      mrr              = stripeBundle?.aggregateMrr ?? primaryStripe.mrr ?? 0
      email            = primaryStripe.email
      phone            = primaryStripe.phone
      ownerName        = primaryStripe.ownerName
      isOverdue        = stripeStatus === 'past_due'
      // GHL from StripeCustomer direct field or via ClientIdentityMap
      ghlContactId     = primaryStripe.ghlContactId || stripeToGhl[primaryStripe.id] || null
      if (ghlContactId) ghlMatched++
    }

    // Enrich from DunningHistory
    const dunning = dunningMap[normalizeCompany(companyName)] || null
    const overdueCount      = dunning ? parseInt(dunning.overdueCount, 10) : 0
    const lastOverdueDate   = dunning?.lastOverdueDate || null
    const avgDaysToCatchUp  = dunning?.avgDaysToCatchUp ? Math.round(dunning.avgDaysToCatchUp) : null
    const catchUpRate       = dunning?.catchUpRate != null ? parseFloat(dunning.catchUpRate).toFixed(2) : null
    const lastOverdueReason = dunning?.lastOverdueReason || null

    const prevCount = await pool.query(
      `SELECT COUNT(*) as c FROM "ClientProfile" WHERE "tenantId"='gyc' AND "companyName"=$1`,
      [companyName]
    )
    const isNew = parseInt(prevCount.rows[0].c, 10) === 0

    await upsertClientProfile({
      tenantId: 'gyc',
      acronym,
      companyName,
      ownerName,
      email,
      phone,
      locationCount,
      status: isOverdue ? 'active' : 'active', // default active; could refine
      assignedGA,
      crmType,
      cancelledDate: null,
      hasWebsite,
      hasSEO,
      hasCRM,
      hasGoogleAds,
      hasBlueprint,
      hasPaidMedia: false,
      hasCommand,
      serviceList,
      mrr,
      stripeCustomerId,
      stripeStatus,
      isOverdue,
      overdueCount,
      lastOverdueDate,
      avgDaysToCatchUp,
      catchUpRate,
      lastOverdueReason,
      ghlContactId,
      ghlPipelineStage: null,
    })

    if (isNew) created++
    else updated++
  }

  console.log(`  ✅ Created: ${created}  Updated: ${updated}`)
  console.log(`  💳 Stripe matches: ${stripeMatched}`)
  console.log(`  🔗 GHL matches: ${ghlMatched}`)
  console.log(`  🧩 Multi-Stripe client bundles: ${multiStripeBundles}`)

  // ── Also upsert any Stripe customers not in the sheet (safety net) ────────
  console.log('\n🔄 Safety-net: ensuring all Stripe active/past_due customers exist in ClientProfile...')
  let stripeOnly = 0
  for (const sc of stripeRows) {
    if (sc.status !== 'active' && sc.status !== 'past_due') continue
    // Use companyName or fall back to name
    const raw = sc.companyName || sc.name || sc.email || 'Unknown'
    const cleanName = stripAcronymSuffix(raw) || raw
    if (!cleanName || cleanName === 'Unknown') continue

    const existing = await pool.query(
      `SELECT id FROM "ClientProfile" WHERE "tenantId"='gyc' AND "stripeCustomerId"=$1 LIMIT 1`,
      [sc.id]
    )
    if (existing.rows.length > 0) continue // already matched

    const existingAlias = await pool.query(
      `SELECT id
       FROM "ClientProfile"
       WHERE "tenantId"='gyc'
         AND (
           ($1::text IS NOT NULL AND "ghlContactId" = $1)
           OR ($2::text IS NOT NULL AND upper(COALESCE(acronym,'')) = $2)
           OR lower(COALESCE("companyName",'')) = lower($3)
         )
       LIMIT 1`,
      [sc.ghlContactId || null, normalizeAcronym(sc.acronym), cleanName]
    )
    if (existingAlias.rows.length > 0) continue

    // Not matched yet — upsert as an unmatched stripe customer
    const ghlContactId = sc.ghlContactId || stripeToGhl[sc.id] || null
    await upsertClientProfile({
      tenantId: 'gyc',
      acronym: null,
      companyName: cleanName,
      ownerName: sc.ownerName || null,
      email: sc.email,
      phone: sc.phone,
      locationCount: 1,
      status: sc.status === 'past_due' ? 'active' : 'active',
      assignedGA: null,
      crmType: null,
      cancelledDate: null,
      hasWebsite: false, hasSEO: false, hasCRM: false,
      hasGoogleAds: false, hasBlueprint: false, hasPaidMedia: false, hasCommand: false,
      serviceList: null,
      mrr: sc.mrr || 0,
      stripeCustomerId: sc.id,
      stripeStatus: sc.status,
      isOverdue: sc.status === 'past_due',
      overdueCount: 0, lastOverdueDate: null, avgDaysToCatchUp: null,
      catchUpRate: null, lastOverdueReason: null,
      ghlContactId,
      ghlPipelineStage: null,
    })
    stripeOnly++
  }
  if (stripeOnly > 0) console.log(`  + ${stripeOnly} Stripe-only profiles added`)

  // ── Source 6: Notion enrichment layer ───────────────────────────────────────
  console.log('\n🔔 Syncing from Notion enrichment layer...')
  let notionResults = { fetched: 0, matched: 0, skipped: 0, fieldCounters: {} }
  try {
    notionResults = await syncFromNotion(pool)
  } catch (e) {
    console.warn('  ⚠️  Notion sync error (non-fatal):', e.message)
  }

  // ── Post-sync: backfill StripeCustomer.acronym ────────────────────────────
  console.log('\n🏷️  Backfilling StripeCustomer.acronym...')
  const { rowCount: acBackfilled } = await pool.query(`
    UPDATE "StripeCustomer" sc
    SET "acronym" = cp.acronym
    FROM "ClientProfile" cp
    WHERE sc."tenantId" = 'gyc'
      AND cp."tenantId" = 'gyc'
      AND cp."stripeCustomerId" = sc.id
      AND cp.acronym IS NOT NULL
      AND sc."acronym" IS DISTINCT FROM cp.acronym
  `)
  console.log(`  → ${acBackfilled} StripeCustomer rows updated with acronym`)

  // ── Post-sync: backfill ZoomCall.clientProfileId ──────────────────────────
  console.log('\n📞 Backfilling ZoomCall.clientProfileId...')
  const { rowCount: zcBackfilled } = await pool.query(`
    UPDATE "ZoomCall" zc
    SET
      "clientProfileId" = cp.id,
      "acronym" = COALESCE(zc."acronym", cp.acronym)
    FROM "ClientProfile" cp
    WHERE zc."tenantId" = 'gyc'
      AND cp."tenantId" = 'gyc'
      AND (
        (zc."ghlContactId" IS NOT NULL AND cp."ghlContactId" = zc."ghlContactId")
        OR
        (zc."ghlContactId" IS NOT NULL AND cp."stripeCustomerId" = (
          SELECT id FROM "StripeCustomer" WHERE "ghlContactId" = zc."ghlContactId" LIMIT 1
        ))
      )
      AND zc."clientProfileId" IS DISTINCT FROM cp.id
  `)
  console.log(`  → ${zcBackfilled} ZoomCall rows linked to ClientProfile`)

  // ── Summary stats ─────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(50))
  console.log('📊 SUMMARY\n')

  const { rows: total } = await pool.query(
    `SELECT COUNT(*) as total FROM "ClientProfile" WHERE "tenantId"='gyc'`
  )
  console.log(`  Total ClientProfile rows: ${total[0].total}`)

  const { rows: byGA } = await pool.query(`
    SELECT
      COALESCE("assignedGA", '(unassigned)') AS ga,
      COUNT(*) AS clients,
      SUM(mrr) AS total_mrr
    FROM "ClientProfile"
    WHERE "tenantId" = 'gyc'
    GROUP BY "assignedGA"
    ORDER BY COUNT(*) DESC
  `)
  console.log('\n  👥 Breakdown by Growth Advisor:')
  for (const r of byGA) {
    const mrrStr = r.total_mrr > 0 ? ` — $${Number(r.total_mrr).toLocaleString()}/mo MRR` : ''
    console.log(`     ${String(r.ga).padEnd(16)} ${r.clients} clients${mrrStr}`)
  }

  const { rows: bySvc } = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE "hasWebsite")   AS website,
      COUNT(*) FILTER (WHERE "hasSEO")       AS seo,
      COUNT(*) FILTER (WHERE "hasCRM")       AS crm,
      COUNT(*) FILTER (WHERE "hasGoogleAds") AS google_ads,
      COUNT(*) FILTER (WHERE "hasBlueprint") AS blueprint,
      COUNT(*) FILTER (WHERE "hasCommand")   AS command
    FROM "ClientProfile"
    WHERE "tenantId" = 'gyc'
  `)
  const svc = bySvc[0]
  console.log('\n  🛠️  Services breakdown:')
  console.log(`     Website:    ${svc.website}`)
  console.log(`     SEO:        ${svc.seo}`)
  console.log(`     CRM:        ${svc.crm}`)
  console.log(`     Google Ads: ${svc.google_ads}`)
  console.log(`     Blueprint:  ${svc.blueprint}`)
  console.log(`     Command:    ${svc.command}`)

  const { rows: overdueRows } = await pool.query(`
    SELECT COUNT(*) as n FROM "ClientProfile" WHERE "tenantId"='gyc' AND "isOverdue"=true
  `)
  console.log(`\n  ⚠️  Overdue clients:   ${overdueRows[0].n}`)

  const { rows: stripeMatchedRows } = await pool.query(`
    SELECT COUNT(*) as n FROM "ClientProfile" WHERE "tenantId"='gyc' AND "stripeCustomerId" IS NOT NULL
  `)
  console.log(`  💳 With Stripe link: ${stripeMatchedRows[0].n}`)

  const { rows: stripeAliasRows } = await pool.query(`
    WITH unmatched AS (
      SELECT sc.id, sc.acronym, sc."ghlContactId", strip_both
      FROM (
        SELECT id, acronym, "ghlContactId",
               regexp_replace(COALESCE("companyName", name, email, ''), '\\s*\\([A-Z0-9]{2,8}\\)\\s*$', '') AS strip_both
        FROM "StripeCustomer"
        WHERE "tenantId" = 'gyc' AND status IN ('active','past_due')
      ) sc
      LEFT JOIN "ClientProfile" cp ON cp."tenantId"='gyc' AND cp."stripeCustomerId" = sc.id
      WHERE cp.id IS NULL
    )
    SELECT COUNT(*)::int AS n
    FROM unmatched u
    WHERE EXISTS (
      SELECT 1
      FROM "ClientProfile" cp
      WHERE cp."tenantId"='gyc'
        AND (
          (u."ghlContactId" IS NOT NULL AND cp."ghlContactId" = u."ghlContactId")
          OR (u.acronym IS NOT NULL AND upper(COALESCE(cp.acronym,'')) = upper(u.acronym))
          OR lower(COALESCE(cp."companyName",'')) = lower(u.strip_both)
        )
    )
  `)
  console.log(`  🔁 Additional Stripe aliases already covered by an existing client: ${stripeAliasRows[0].n}`)

  const { rows: ghlMatchedRows } = await pool.query(`
    SELECT COUNT(*) as n FROM "ClientProfile" WHERE "tenantId"='gyc' AND "ghlContactId" IS NOT NULL
  `)
  console.log(`  🔗 With GHL link:    ${ghlMatchedRows[0].n}`)

  const { rows: notionLinkedRows } = await pool.query(`
    SELECT COUNT(*) as n FROM "ClientProfile" WHERE "tenantId"='gyc' AND "notionPageId" IS NOT NULL
  `)
  console.log(`  🔔 With Notion link: ${notionLinkedRows[0].n}`)
  console.log(`     Fetched: ${notionResults.fetched}  Matched: ${notionResults.matched}  Skipped: ${notionResults.skipped}`)

  const { rows: directorRows } = await pool.query(`
    SELECT COUNT(*) as n FROM "ClientProfile" WHERE "tenantId"='gyc' AND "directorName" IS NOT NULL
  `)
  console.log(`  👤 With director info: ${directorRows[0].n}`)

  console.log('\n' + '─'.repeat(50))
  console.log('✅ ClientProfile sync complete!\n')

  await pool.end()
}

main().catch(async err => {
  console.error('Fatal:', err)
  await pool.end()
  process.exit(1)
})
