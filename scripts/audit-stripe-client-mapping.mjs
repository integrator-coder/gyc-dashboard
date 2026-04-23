#!/usr/bin/env node

import pg from 'pg'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

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
} catch {}

const { Pool } = pg
const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

async function query(sql, params = []) {
  const { rows } = await pool.query(sql, params)
  return rows
}

async function main() {
  console.log('🔎 Stripe ↔ ClientProfile mapping audit\n')

  const [coverage] = await query(`
    SELECT
      (SELECT COUNT(*)::int FROM "StripeCustomer" WHERE "tenantId"='gyc' AND status IN ('active','past_due')) AS stripe_live,
      (SELECT COUNT(*)::int FROM "ClientProfile" WHERE "tenantId"='gyc') AS client_profiles,
      (SELECT COUNT(*)::int FROM "ClientProfile" WHERE "tenantId"='gyc' AND "stripeCustomerId" IS NOT NULL) AS linked_profiles,
      (SELECT COUNT(DISTINCT "stripeCustomerId")::int FROM "ClientProfile" WHERE "tenantId"='gyc' AND "stripeCustomerId" IS NOT NULL) AS distinct_linked_stripe,
      (SELECT COUNT(*)::int FROM "ClientProfile" WHERE "tenantId"='gyc' AND "ghlContactId" IS NOT NULL) AS ghl_linked_profiles,
      (SELECT COUNT(*)::int FROM "StripeCustomer" WHERE "tenantId"='gyc' AND status IN ('active','past_due') AND acronym IS NULL) AS stripe_missing_acronym,
      (SELECT COUNT(*)::int FROM "StripeCustomer" WHERE "tenantId"='gyc' AND status IN ('active','past_due') AND "companyName" IS NULL) AS stripe_missing_company
  `)

  console.table([coverage])

  const duplicateLinks = await query(`
    SELECT
      cp."stripeCustomerId",
      COUNT(*)::int AS profiles,
      array_agg(cp.acronym ORDER BY cp.acronym) AS acronyms,
      array_agg(cp."companyName" ORDER BY cp."companyName") AS companies
    FROM "ClientProfile" cp
    WHERE cp."tenantId"='gyc' AND cp."stripeCustomerId" IS NOT NULL
    GROUP BY cp."stripeCustomerId"
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC, cp."stripeCustomerId"
  `)

  const uncoveredStripe = await query(`
    SELECT
      sc.id,
      COALESCE(sc."companyName", sc.name, sc.email) AS label,
      sc.status,
      sc.mrr,
      sc.acronym,
      sc."ghlContactId"
    FROM "StripeCustomer" sc
    LEFT JOIN "ClientProfile" cp ON cp."tenantId"='gyc' AND cp."stripeCustomerId" = sc.id
    WHERE sc."tenantId"='gyc'
      AND sc.status IN ('active','past_due')
      AND cp.id IS NULL
    ORDER BY sc.mrr DESC NULLS LAST, label ASC
  `)

  const aliasCovered = await query(`
    WITH uncovered AS (
      SELECT
        sc.id,
        COALESCE(sc."companyName", sc.name, sc.email) AS label,
        regexp_replace(COALESCE(sc."companyName", sc.name, sc.email, ''), '\\s*\\([A-Z0-9]{2,8}\\)\\s*$', '') AS normalized_label,
        sc.status,
        sc.mrr,
        sc.acronym,
        sc."ghlContactId"
      FROM "StripeCustomer" sc
      LEFT JOIN "ClientProfile" cp ON cp."tenantId"='gyc' AND cp."stripeCustomerId" = sc.id
      WHERE sc."tenantId"='gyc'
        AND sc.status IN ('active','past_due')
        AND cp.id IS NULL
    )
    SELECT
      u.id,
      u.label,
      u.status,
      u.mrr,
      cp.acronym AS profile_acronym,
      cp."companyName" AS profile_name,
      cp."stripeCustomerId" AS primary_stripe_id,
      CASE
        WHEN u."ghlContactId" IS NOT NULL AND cp."ghlContactId" = u."ghlContactId" THEN 'ghl'
        WHEN u.acronym IS NOT NULL AND upper(COALESCE(cp.acronym,'')) = upper(u.acronym) THEN 'acronym'
        WHEN lower(COALESCE(cp."companyName",'')) = lower(u.normalized_label) THEN 'company'
        ELSE 'other'
      END AS match_type
    FROM uncovered u
    JOIN "ClientProfile" cp ON cp."tenantId"='gyc'
     AND (
       (u."ghlContactId" IS NOT NULL AND cp."ghlContactId" = u."ghlContactId")
       OR (u.acronym IS NOT NULL AND upper(COALESCE(cp.acronym,'')) = upper(u.acronym))
       OR lower(COALESCE(cp."companyName",'')) = lower(u.normalized_label)
     )
    ORDER BY u.mrr DESC NULLS LAST, u.label ASC
  `)

  console.log(`\nShared Stripe IDs across multiple profiles: ${duplicateLinks.length}`)
  if (duplicateLinks.length) console.table(duplicateLinks)

  console.log(`\nUncovered live Stripe customers: ${uncoveredStripe.length}`)
  if (uncoveredStripe.length) console.table(uncoveredStripe)

  console.log(`\nUncovered Stripe rows that still map to an existing client by alias: ${aliasCovered.length}`)
  if (aliasCovered.length) console.table(aliasCovered)

  const trueOrphans = uncoveredStripe.filter((row) => !aliasCovered.some((alias) => alias.id === row.id))
  console.log(`\nTrue uncovered Stripe orphans: ${trueOrphans.length}`)
  if (trueOrphans.length) console.table(trueOrphans)
}

main()
  .catch((error) => {
    console.error('Audit failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end().catch(() => null)
  })
