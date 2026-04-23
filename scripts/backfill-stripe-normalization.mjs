#!/usr/bin/env node

import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  ensureStripeNormalizationTables,
  scoreStripeLinkCandidate,
  syncClientStripeLinks,
  stripAcronymSuffix,
  normalizeAcronym,
} from '../lib/stripe-normalization.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(__dirname, '../.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx < 0) continue
    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

const { Pool } = pg
const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const TENANT_ID = 'gyc'
const REPORT_DIR = path.resolve(__dirname, '../reports')
const REPORT_MD_PATH = path.join(REPORT_DIR, 'stripe-normalization-review.md')
const REPORT_JSON_PATH = path.join(REPORT_DIR, 'stripe-normalization-review.json')

function compactStripeLabel(row) {
  return row.companyName || row.name || row.email || row.id
}

function isLiveStripeStatus(status) {
  return ['active', 'past_due', 'trialing'].includes(String(status || '').toLowerCase())
}

function compareCandidates(a, b) {
  if (b.match.score !== a.match.score) return b.match.score - a.match.score
  if (a.profile.id !== b.profile.id) return a.profile.id - b.profile.id
  return String(a.profile.companyName || '').localeCompare(String(b.profile.companyName || ''))
}

function toCandidateSummary(candidate) {
  return {
    clientProfileId: candidate.profile.id,
    acronym: candidate.profile.acronym,
    companyName: candidate.profile.companyName,
    legacyStripeCustomerId: candidate.profile.stripeCustomerId,
    matchScore: candidate.match.score,
    matchMethod: candidate.match.method,
    matchSignals: candidate.match.reasons,
  }
}

async function writeReport(report) {
  fs.mkdirSync(REPORT_DIR, { recursive: true })
  fs.writeFileSync(REPORT_JSON_PATH, JSON.stringify(report, null, 2))

  const lines = []
  lines.push('# Stripe normalization review')
  lines.push('')
  lines.push(`Generated: ${new Date().toISOString()}`)
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  lines.push(`- Stripe customers scanned: ${report.summary.stripeCustomers}`)
  lines.push(`- Client profiles scanned: ${report.summary.clientProfiles}`)
  lines.push(`- Accepted links upserted: ${report.summary.linksUpserted}`)
  lines.push(`- Primary links set: ${report.summary.primaryLinks}`)
  lines.push(`- Secondary links set: ${report.summary.secondaryLinks}`)
  lines.push(`- Ambiguous Stripe customers skipped: ${report.summary.ambiguousStripeCustomers}`)
  lines.push(`- Live Stripe orphans still unmapped: ${report.summary.liveOrphans}`)
  lines.push(`- Profiles with 2+ live Stripe customers linked: ${report.summary.multiLiveProfiles}`)
  lines.push('')

  const sections = [
    ['Shared legacy primary Stripe IDs needing billing review', report.sharedLegacyConflicts],
    ['Ambiguous Stripe customers skipped from auto-linking', report.ambiguousStripeCustomers],
    ['Live Stripe customers still unmatched', report.liveOrphans],
    ['Profiles with multiple live Stripe customers linked', report.multiLiveProfiles],
  ]

  for (const [title, items] of sections) {
    lines.push(`## ${title}`)
    lines.push('')
    if (!items.length) {
      lines.push('_None_')
      lines.push('')
      continue
    }

    items.forEach((item, index) => {
      lines.push(`### ${index + 1}. ${item.title}`)
      lines.push('')
      for (const detail of item.details || []) lines.push(`- ${detail}`)
      lines.push('')
    })
  }

  fs.writeFileSync(REPORT_MD_PATH, `${lines.join('\n')}\n`)
}

async function main() {
  console.log('🔧 Ensuring Stripe normalization tables exist...')
  await ensureStripeNormalizationTables(pool)

  const [profileRes, stripeRes] = await Promise.all([
    pool.query(`
      SELECT id, "tenantId", acronym, "companyName", "ghlContactId", "stripeCustomerId"
      FROM "ClientProfile"
      WHERE "tenantId" = $1
      ORDER BY id ASC
    `, [TENANT_ID]),
    pool.query(`
      SELECT id, name, email, status, mrr, "companyName", "ghlContactId", acronym
      FROM "StripeCustomer"
      WHERE "tenantId" = $1
      ORDER BY id ASC
    `, [TENANT_ID]),
  ])

  const profiles = profileRes.rows
  const stripeRows = stripeRes.rows
  const acceptedByProfile = new Map()
  const ambiguousStripeCustomers = []
  const liveOrphans = []

  for (const stripeRow of stripeRows) {
    const candidates = profiles
      .map((profile) => ({ profile, match: scoreStripeLinkCandidate(stripeRow, profile) }))
      .filter(({ match }) => match.score >= 80)
      .sort(compareCandidates)

    if (!candidates.length) {
      if (isLiveStripeStatus(stripeRow.status)) {
        liveOrphans.push({
          title: `${stripeRow.id} · ${compactStripeLabel(stripeRow)}`,
          details: [
            `Status: ${stripeRow.status}`,
            `MRR: $${Number(stripeRow.mrr || 0).toFixed(2)}`,
            `Acronym: ${stripeRow.acronym || '(none)'}`,
            `GHL contact: ${stripeRow.ghlContactId || '(none)'}`,
          ],
        })
      }
      continue
    }

    const [top, second] = candidates
    const isAmbiguous = Boolean(
      second
      && (
        second.match.score === top.match.score
        || (second.match.score >= 100 && top.match.score - second.match.score <= 20)
      )
    )

    if (isAmbiguous) {
      ambiguousStripeCustomers.push({
        title: `${stripeRow.id} · ${compactStripeLabel(stripeRow)}`,
        details: [
          `Status: ${stripeRow.status}`,
          `MRR: $${Number(stripeRow.mrr || 0).toFixed(2)}`,
          `Candidates: ${candidates.slice(0, 4).map((candidate) => `${candidate.profile.companyName} [${candidate.match.reasons.join(', ')} / ${candidate.match.score}]`).join(' | ')}`,
        ],
      })
      continue
    }

    const entry = acceptedByProfile.get(top.profile.id) || { profile: top.profile, rows: [] }
    entry.rows.push({ stripeRow, match: top.match })
    acceptedByProfile.set(top.profile.id, entry)
  }

  let linksUpserted = 0
  let primaryLinks = 0
  let secondaryLinks = 0

  for (const { profile, rows } of acceptedByProfile.values()) {
    const legacyPrimary = rows.find(({ stripeRow, match }) => stripeRow.id === profile.stripeCustomerId && match.reasons.includes('legacy_profile_pointer'))
    const strongPrimary = !legacyPrimary && rows.length === 1 && rows[0].match.score >= 100 ? rows[0] : null
    const primaryStripeCustomerId = legacyPrimary?.stripeRow.id || strongPrimary?.stripeRow.id || null

    const result = await syncClientStripeLinks(pool, {
      tenantId: TENANT_ID,
      clientProfileId: profile.id,
      profile,
      stripeRows: rows.map(({ stripeRow }) => stripeRow),
      primaryStripeCustomerId,
      linkSource: 'stripe-normalization-backfill',
    })

    linksUpserted += result.linkedCount
    primaryLinks += result.accepted.filter((row) => row.isPrimary).length
    secondaryLinks += result.accepted.filter((row) => !row.isPrimary).length
  }

  const [sharedLegacyRes, multiLiveRes] = await Promise.all([
    pool.query(`
      SELECT
        cp."stripeCustomerId",
        COUNT(*)::int AS profiles,
        array_agg(cp.acronym ORDER BY cp.acronym) AS acronyms,
        array_agg(cp."companyName" ORDER BY cp."companyName") AS companies
      FROM "ClientProfile" cp
      WHERE cp."tenantId" = $1
        AND cp."stripeCustomerId" IS NOT NULL
      GROUP BY cp."stripeCustomerId"
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC, cp."stripeCustomerId"
    `, [TENANT_ID]),
    pool.query(`
      SELECT
        cp.id,
        cp.acronym,
        cp."companyName",
        COUNT(*)::int AS live_links,
        array_agg(csl."stripeCustomerId" ORDER BY csl."isPrimary" DESC, csl."stripeCustomerId") AS stripe_ids
      FROM "ClientStripeLink" csl
      JOIN "ClientProfile" cp ON cp.id = csl."clientProfileId"
      JOIN "StripeCustomer" sc ON sc.id = csl."stripeCustomerId"
      WHERE csl."tenantId" = $1
        AND cp."tenantId" = $1
        AND sc."tenantId" = $1
        AND sc.status IN ('active', 'past_due', 'trialing')
      GROUP BY cp.id, cp.acronym, cp."companyName"
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC, cp."companyName" ASC
    `, [TENANT_ID]),
  ])

  const report = {
    summary: {
      stripeCustomers: stripeRows.length,
      clientProfiles: profiles.length,
      linksUpserted,
      primaryLinks,
      secondaryLinks,
      ambiguousStripeCustomers: ambiguousStripeCustomers.length,
      liveOrphans: liveOrphans.length,
      multiLiveProfiles: multiLiveRes.rows.length,
    },
    sharedLegacyConflicts: sharedLegacyRes.rows.map((row) => ({
      title: `${row.stripeCustomerId} shared by ${row.profiles} profiles`,
      details: [
        `Acronyms: ${(row.acronyms || []).map((value) => value || '(none)').join(', ')}`,
        `Companies: ${(row.companies || []).join(' | ')}`,
      ],
    })),
    ambiguousStripeCustomers,
    liveOrphans,
    multiLiveProfiles: multiLiveRes.rows.map((row) => ({
      title: `${row.companyName} (${row.acronym || 'no acronym'})`,
      details: [
        `Live Stripe customers linked: ${row.live_links}`,
        `Stripe IDs: ${(row.stripe_ids || []).join(', ')}`,
      ],
    })),
  }

  await writeReport(report)

  console.log('✅ Stripe normalization backfill complete')
  console.log(`   Links upserted: ${linksUpserted}`)
  console.log(`   Primary links: ${primaryLinks}`)
  console.log(`   Secondary links: ${secondaryLinks}`)
  console.log(`   Ambiguous skipped: ${ambiguousStripeCustomers.length}`)
  console.log(`   Live orphans: ${liveOrphans.length}`)
  console.log(`   Report: ${path.relative(path.resolve(__dirname, '..'), REPORT_MD_PATH)}`)
}

main()
  .catch((error) => {
    console.error('Fatal:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end().catch(() => null)
  })
