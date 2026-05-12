/**
 * seed-market-intelligence.mjs
 * Pulls Census demographic + competitive data for all GYC clients with known ZIP codes.
 * Stores results in Neon's ClientMarketIntelligence table.
 *
 * Usage:
 *   node scripts/seed-market-intelligence.mjs          # full run (inserts/updates DB)
 *   node scripts/seed-market-intelligence.mjs --dry-run # prints data, no DB writes
 */

import Stripe from 'stripe'
import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getACSDataForZip, getCountyFipsForZip, getCBPDataForCounty, computeOpportunityScore } from '../lib/census.js'

// ── Load .env.local ───────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(__dirname, '../.env.local')
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const idx = t.indexOf('=')
    if (idx < 0) continue
    const key = t.slice(0, idx).trim()
    const val = t.slice(idx + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
}

// ── Args ──────────────────────────────────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry-run')
if (DRY_RUN) console.log('🔍 DRY RUN MODE — no database writes\n')

// ── Clients ───────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

// ── Run DB migration ──────────────────────────────────────────────────────────
const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS "ClientMarketIntelligence" (
  id BIGSERIAL PRIMARY KEY,
  "tenantId" TEXT NOT NULL DEFAULT 'gyc',
  acronym TEXT,
  "stripeCustomerId" TEXT,
  "companyName" TEXT,
  zip TEXT NOT NULL,
  "stateFips" TEXT,
  "countyFips" TEXT,
  "countyName" TEXT,
  year INTEGER NOT NULL DEFAULT 2023,
  -- ACS demand data
  "totalPopulation" INTEGER,
  "childrenUnder5" INTEGER,
  "children5to9" INTEGER,
  "children10to14" INTEGER,
  "medianHouseholdIncome" INTEGER,
  "workingParentsUnder6" INTEGER,
  "belowPovertyLine" INTEGER,
  "spanishSpeakingHouseholds" INTEGER,
  "birthsLastYear" INTEGER,
  -- CBP supply data
  "childcareCenterCount" INTEGER,
  "childcareEmployment" INTEGER,
  "childcarePayrollK" INTEGER,
  -- Computed scores
  "opportunityScore" INTEGER,
  "birthsPerCenter" NUMERIC(8,2),
  -- Meta
  "syncedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("tenantId", "stripeCustomerId", year)
);
CREATE INDEX IF NOT EXISTS "CMI_tenantId_idx" ON "ClientMarketIntelligence" ("tenantId");
CREATE INDEX IF NOT EXISTS "CMI_zip_idx" ON "ClientMarketIntelligence" (zip);
CREATE INDEX IF NOT EXISTS "CMI_acronym_idx" ON "ClientMarketIntelligence" (acronym);
`

if (!DRY_RUN) {
  console.log('📦 Running DB migration...')
  await pool.query(CREATE_TABLE_SQL)
  console.log('✅ Table ready\n')
}

// ── Pull active customers from Stripe ────────────────────────────────────────
console.log('🔄 Fetching active Stripe subscriptions...')
const seen = new Set()
const customers = []

for await (const sub of stripe.subscriptions.list({ status: 'active', limit: 100, expand: ['data.customer'] })) {
  const customer = sub.customer
  if (typeof customer !== 'object' || !customer?.id) continue
  if (seen.has(customer.id)) continue
  seen.add(customer.id)

  const zip = customer.address?.postal_code || customer.shipping?.address?.postal_code
  if (!zip || !/^[0-9]{5}/.test(zip)) continue

  customers.push({ id: customer.id, name: customer.name, zip: zip.slice(0, 5) })
}

console.log(`📋 Found ${customers.length} unique active customers with US ZIPs\n`)

// ── Process each customer ─────────────────────────────────────────────────────
let processed = 0, skipped = 0, errors = 0

for (const customer of customers) {
  const { id: stripeCustomerId, name: companyName, zip } = customer

  try {
    // Fetch ACS demographic data
    const acsData = await getACSDataForZip(zip)
    if (!acsData) {
      console.warn(`⚠️  No ACS data for ZIP ${zip} (${companyName})`)
      skipped++
      await sleep(500)
      continue
    }

    await sleep(500)  // rate limit between ACS and TIGERweb calls

    // Fetch county FIPS
    const fips = await getCountyFipsForZip(zip)

    let cbpData = null
    if (fips) {
      await sleep(500)
      cbpData = await getCBPDataForCounty(fips.stateFips, fips.countyFips)
    }

    // Compute opportunity score
    const score = computeOpportunityScore({
      ...acsData,
      childcareCenterCount: cbpData?.childcareCenterCount || 0,
    })

    const birthsPerCenter = cbpData?.childcareCenterCount
      ? parseFloat((acsData.birthsLastYear / cbpData.childcareCenterCount).toFixed(2))
      : null

    const row = {
      tenantId: 'gyc',
      stripeCustomerId,
      companyName,
      zip,
      stateFips: fips?.stateFips || null,
      countyFips: fips?.countyFips || null,
      countyName: cbpData?.countyName || null,
      year: 2023,
      totalPopulation: acsData.totalPopulation,
      childrenUnder5: acsData.childrenUnder5,
      children5to9: acsData.children5to9,
      children10to14: acsData.children10to14,
      medianHouseholdIncome: acsData.medianHouseholdIncome,
      workingParentsUnder6: acsData.workingParentsUnder6,
      belowPovertyLine: acsData.belowPovertyLine,
      spanishSpeakingHouseholds: acsData.spanishSpeakingHouseholds,
      birthsLastYear: acsData.birthsLastYear,
      childcareCenterCount: cbpData?.childcareCenterCount || null,
      childcareEmployment: cbpData?.childcareEmployment || null,
      childcarePayrollK: cbpData ? Math.round(cbpData.childcarePayroll) : null,
      opportunityScore: score,
      birthsPerCenter,
    }

    if (DRY_RUN) {
      console.log(`[DRY RUN] ${companyName} (${zip}) → score=${score}, children<5=${acsData.childrenUnder5}, income=$${acsData.medianHouseholdIncome?.toLocaleString()}, centers=${cbpData?.childcareCenterCount ?? 'n/a'}, county=${cbpData?.countyName ?? fips ? `${fips?.stateFips}-${fips?.countyFips}` : 'unknown'}`)
    } else {
      await pool.query(`
        INSERT INTO "ClientMarketIntelligence"
          ("tenantId", "stripeCustomerId", "companyName", zip, "stateFips", "countyFips", "countyName", year,
           "totalPopulation", "childrenUnder5", "children5to9", "children10to14",
           "medianHouseholdIncome", "workingParentsUnder6", "belowPovertyLine",
           "spanishSpeakingHouseholds", "birthsLastYear",
           "childcareCenterCount", "childcareEmployment", "childcarePayrollK",
           "opportunityScore", "birthsPerCenter", "syncedAt")
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,NOW())
        ON CONFLICT ("tenantId", "stripeCustomerId", year) DO UPDATE SET
          "totalPopulation" = EXCLUDED."totalPopulation",
          "childrenUnder5" = EXCLUDED."childrenUnder5",
          "children5to9" = EXCLUDED."children5to9",
          "children10to14" = EXCLUDED."children10to14",
          "medianHouseholdIncome" = EXCLUDED."medianHouseholdIncome",
          "workingParentsUnder6" = EXCLUDED."workingParentsUnder6",
          "belowPovertyLine" = EXCLUDED."belowPovertyLine",
          "spanishSpeakingHouseholds" = EXCLUDED."spanishSpeakingHouseholds",
          "birthsLastYear" = EXCLUDED."birthsLastYear",
          "stateFips" = EXCLUDED."stateFips",
          "countyFips" = EXCLUDED."countyFips",
          "countyName" = EXCLUDED."countyName",
          "childcareCenterCount" = EXCLUDED."childcareCenterCount",
          "childcareEmployment" = EXCLUDED."childcareEmployment",
          "childcarePayrollK" = EXCLUDED."childcarePayrollK",
          "opportunityScore" = EXCLUDED."opportunityScore",
          "birthsPerCenter" = EXCLUDED."birthsPerCenter",
          "syncedAt" = NOW()
      `, [
        row.tenantId, row.stripeCustomerId, row.companyName, row.zip,
        row.stateFips, row.countyFips, row.countyName, row.year,
        row.totalPopulation, row.childrenUnder5, row.children5to9, row.children10to14,
        row.medianHouseholdIncome, row.workingParentsUnder6, row.belowPovertyLine,
        row.spanishSpeakingHouseholds, row.birthsLastYear,
        row.childcareCenterCount, row.childcareEmployment, row.childcarePayrollK,
        row.opportunityScore, row.birthsPerCenter,
      ])
    }

    processed++
    if (processed % 10 === 0) console.log(`⏳ Processed ${processed}/${customers.length} clients...`)

    // Rate limit: ~1 req/sec total (3 API calls above + sleep)
    await sleep(500)

  } catch (e) {
    errors++
    console.error(`❌ Error for ${companyName} (${zip}): ${e.message}`)
    await sleep(1000)  // back off on error
  }
}

console.log(`\n✅ Done: ${processed} processed, ${skipped} skipped (no ACS data), ${errors} errors`)

if (!DRY_RUN) {
  const check = await pool.query(`
    SELECT COUNT(*) AS clients, ROUND(AVG("opportunityScore")) AS avg_score,
           ROUND(AVG("childrenUnder5")) AS avg_children_under5,
           ROUND(AVG("medianHouseholdIncome")) AS avg_income
    FROM "ClientMarketIntelligence"
    WHERE "tenantId" = 'gyc' AND year = 2023
  `)
  const r = check.rows[0]
  console.log(`\n📊 DB summary: ${r.clients} clients | avg score: ${r.avg_score} | avg children<5: ${r.avg_children_under5} | avg income: $${Number(r.avg_income).toLocaleString()}`)
}

await pool.end()
