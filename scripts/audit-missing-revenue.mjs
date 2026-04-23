#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import pg from 'pg'
import { fileURLToPath } from 'url'
import {
  normalizeCompany,
  stripAcronymSuffix,
  getStripeComparableAcronym,
  normalizeAcronym,
  getStripeComparableCompany,
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

const REPORT_DIR = path.resolve(__dirname, '../reports')
const REPORT_JSON_PATH = path.join(REPORT_DIR, 'missing-revenue-investigation.json')
const REPORT_MD_PATH = path.join(REPORT_DIR, 'missing-revenue-investigation.md')
const TENANT_ID = 'gyc'
const LIVE_STATUSES = new Set(['active', 'past_due', 'trialing'])

function isLiveStatus(status) {
  return LIVE_STATUSES.has(String(status || '').toLowerCase())
}

function money(value) {
  return `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function compactLabel(row) {
  return row.companyName || row.name || row.email || row.id
}

function signalList(profile, stripeRow) {
  const signals = []

  if (profile.stripeCustomerId && profile.stripeCustomerId === stripeRow.id) signals.push('legacy')
  if (profile.ghlContactId && stripeRow.ghlContactId && profile.ghlContactId === stripeRow.ghlContactId) signals.push('ghl')

  const profileAcronym = normalizeAcronym(profile.acronym)
  const stripeAcronym = getStripeComparableAcronym(stripeRow)
  if (profileAcronym && stripeAcronym && profileAcronym === stripeAcronym) signals.push('acronym')

  const profileCompany = normalizeCompany(stripAcronymSuffix(profile.companyName || ''))
  const stripeCompany = normalizeCompany(getStripeComparableCompany(stripeRow))
  if (profileCompany && stripeCompany && profileCompany === stripeCompany) signals.push('company')

  const profileEmail = String(profile.email || '').trim().toLowerCase()
  const stripeEmail = String(stripeRow.email || '').trim().toLowerCase()
  if (profileEmail && stripeEmail && profileEmail === stripeEmail) signals.push('email')

  return signals
}

function toCandidate(profile, stripeRow, signals) {
  return {
    stripeCustomerId: stripeRow.id,
    stripeStatus: stripeRow.status,
    stripeMrr: Number(stripeRow.mrr || 0),
    stripeLabel: compactLabel(stripeRow),
    stripeEmail: stripeRow.email || null,
    stripeCompanyName: stripeRow.companyName || null,
    stripeAcronym: stripeRow.acronym || null,
    stripeGhlContactId: stripeRow.ghlContactId || null,
    signals,
    profileEmail: profile.email || null,
  }
}

function byMrrDesc(a, b) {
  if (Number(b.stripeMrr || 0) !== Number(a.stripeMrr || 0)) return Number(b.stripeMrr || 0) - Number(a.stripeMrr || 0)
  return String(a.stripeCustomerId || '').localeCompare(String(b.stripeCustomerId || ''))
}

function summarizeList(items) {
  return {
    count: items.length,
    totalCandidateMrr: items.reduce((sum, item) => sum + Number(item.stripeMrr || item.candidateMrr || 0), 0),
  }
}

async function main() {
  const [profilesRes, stripeRes] = await Promise.all([
    pool.query(`
      SELECT id, acronym, "companyName", status, email, mrr, "stripeCustomerId", "stripeStatus", "ghlContactId"
      FROM "ClientProfile"
      WHERE "tenantId" = $1
      ORDER BY id ASC
    `, [TENANT_ID]),
    pool.query(`
      SELECT id, name, email, status, mrr, "companyName", acronym, "ghlContactId"
      FROM "StripeCustomer"
      WHERE "tenantId" = $1
      ORDER BY id ASC
    `, [TENANT_ID]),
  ])

  const profiles = profilesRes.rows
  const zeroProfiles = profiles.filter((row) => Number(row.mrr || 0) === 0)
  const allStripe = stripeRes.rows
  const livePositiveStripe = allStripe.filter((row) => isLiveStatus(row.status) && Number(row.mrr || 0) > 0)
  const stripeById = new Map(allStripe.map((row) => [row.id, row]))

  const profilesByLegacyStripeId = new Map()
  for (const profile of profiles) {
    if (!profile.stripeCustomerId) continue
    const list = profilesByLegacyStripeId.get(profile.stripeCustomerId) || []
    list.push({ id: profile.id, acronym: profile.acronym, companyName: profile.companyName })
    profilesByLegacyStripeId.set(profile.stripeCustomerId, list)
  }

  const categories = {
    legacyLivePositiveShared: [],
    emailOnlyCandidates: [],
    ambiguousCandidates: [],
    legacyLiveZero: [],
    noLiveStripeEvidence: [],
    safeAutofixCandidates: [],
  }

  for (const profile of zeroProfiles) {
    const legacyStripe = profile.stripeCustomerId ? stripeById.get(profile.stripeCustomerId) : null

    if (legacyStripe && isLiveStatus(legacyStripe.status) && Number(legacyStripe.mrr || 0) > 0) {
      const sharedProfiles = (profilesByLegacyStripeId.get(legacyStripe.id) || [])
        .filter((row) => row.id !== profile.id)
        .map((row) => ({ acronym: row.acronym, companyName: row.companyName }))

      categories.legacyLivePositiveShared.push({
        id: profile.id,
        acronym: profile.acronym,
        companyName: profile.companyName,
        profileEmail: profile.email || null,
        stripeCustomerId: legacyStripe.id,
        stripeStatus: legacyStripe.status,
        stripeMrr: Number(legacyStripe.mrr || 0),
        stripeLabel: compactLabel(legacyStripe),
        signals: signalList(profile, legacyStripe),
        sharedProfiles,
        recommendedAction: 'Lex review — shared/parent Stripe customer; do not auto-assign full MRR.',
      })
      continue
    }

    if (legacyStripe && isLiveStatus(legacyStripe.status) && Number(legacyStripe.mrr || 0) === 0) {
      categories.legacyLiveZero.push({
        id: profile.id,
        acronym: profile.acronym,
        companyName: profile.companyName,
        profileEmail: profile.email || null,
        stripeCustomerId: legacyStripe.id,
        stripeStatus: legacyStripe.status,
        stripeMrr: 0,
        stripeLabel: compactLabel(legacyStripe),
        recommendedAction: 'Likely true zero / no active billed subscription on current Stripe customer.',
      })
      continue
    }

    const candidates = livePositiveStripe
      .map((stripeRow) => ({ stripeRow, signals: signalList(profile, stripeRow) }))
      .filter(({ signals }) => signals.length > 0)
      .map(({ stripeRow, signals }) => toCandidate(profile, stripeRow, signals))
      .sort(byMrrDesc)

    const nonLegacyCandidates = candidates.filter((row) => row.stripeCustomerId !== profile.stripeCustomerId)
    const exactNonEmail = nonLegacyCandidates.filter((row) => row.signals.some((signal) => ['ghl', 'acronym', 'company'].includes(signal)))
    const emailOnly = nonLegacyCandidates.filter((row) => row.signals.length === 1 && row.signals[0] === 'email')

    if (exactNonEmail.length === 1 && emailOnly.length === 0) {
      categories.safeAutofixCandidates.push({
        id: profile.id,
        acronym: profile.acronym,
        companyName: profile.companyName,
        profileEmail: profile.email || null,
        ...exactNonEmail[0],
        recommendedAction: 'Safe auto-fix candidate.',
      })
      continue
    }

    if (emailOnly.length === 1 && exactNonEmail.length === 0 && nonLegacyCandidates.length === 1) {
      categories.emailOnlyCandidates.push({
        id: profile.id,
        acronym: profile.acronym,
        companyName: profile.companyName,
        profileEmail: profile.email || null,
        ...emailOnly[0],
        recommendedAction: 'Needs manual review — email-only owner match is not safe to auto-link.',
      })
      continue
    }

    if (nonLegacyCandidates.length > 0) {
      categories.ambiguousCandidates.push({
        id: profile.id,
        acronym: profile.acronym,
        companyName: profile.companyName,
        profileEmail: profile.email || null,
        candidates: nonLegacyCandidates.slice(0, 5),
        recommendedAction: 'Manual review — multiple or mixed signals.',
      })
      continue
    }

    categories.noLiveStripeEvidence.push({
      id: profile.id,
      acronym: profile.acronym,
      companyName: profile.companyName,
      profileEmail: profile.email || null,
      legacyStripeCustomerId: profile.stripeCustomerId || null,
      recommendedAction: profile.stripeCustomerId
        ? 'No live positive Stripe revenue found despite legacy mapping.'
        : 'No live Stripe mapping evidence found.'
    })
  }

  const rollups = {
    zeroRevenueProfiles: zeroProfiles.length,
    missingLegacyStripeCustomerId: zeroProfiles.filter((row) => !row.stripeCustomerId).length,
    withLegacyStripeCustomerId: zeroProfiles.filter((row) => !!row.stripeCustomerId).length,
    legacyLivePositiveShared: summarizeList(categories.legacyLivePositiveShared),
    safeAutofixCandidates: summarizeList(categories.safeAutofixCandidates),
    emailOnlyCandidates: summarizeList(categories.emailOnlyCandidates),
    ambiguousCandidates: {
      count: categories.ambiguousCandidates.length,
      totalCandidateMrr: categories.ambiguousCandidates.reduce((sum, item) => sum + item.candidates.reduce((inner, candidate) => inner + Number(candidate.stripeMrr || 0), 0), 0),
    },
    legacyLiveZero: summarizeList(categories.legacyLiveZero),
    noLiveStripeEvidence: summarizeList(categories.noLiveStripeEvidence),
  }

  const report = {
    generatedAt: new Date().toISOString(),
    tenantId: TENANT_ID,
    summary: {
      clientProfilesScanned: profiles.length,
      zeroRevenueProfiles: rollups.zeroRevenueProfiles,
      missingLegacyStripeCustomerId: rollups.missingLegacyStripeCustomerId,
      withLegacyStripeCustomerId: rollups.withLegacyStripeCustomerId,
      safeAutofixCandidates: rollups.safeAutofixCandidates.count,
      manualReviewCandidates: rollups.legacyLivePositiveShared.count + rollups.emailOnlyCandidates.count + rollups.ambiguousCandidates.count,
      likelyTrueZeroOrNoBilling: rollups.legacyLiveZero.count + rollups.noLiveStripeEvidence.count,
    },
    rollups,
    notableClients: {
      afya: categories.emailOnlyCandidates.find((row) => row.acronym === 'AFYA') || null,
    },
    categories,
  }

  fs.mkdirSync(REPORT_DIR, { recursive: true })
  fs.writeFileSync(REPORT_JSON_PATH, JSON.stringify(report, null, 2))

  const lines = []
  lines.push('# Missing revenue investigation')
  lines.push('')
  lines.push(`Generated: ${report.generatedAt}`)
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  lines.push(`- Zero/null-MRR client profiles: ${report.summary.zeroRevenueProfiles}`)
  lines.push(`- Missing legacy stripeCustomerId: ${report.summary.missingLegacyStripeCustomerId}`)
  lines.push(`- Has legacy stripeCustomerId: ${report.summary.withLegacyStripeCustomerId}`)
  lines.push(`- Safe auto-fix candidates found: ${report.summary.safeAutofixCandidates}`)
  lines.push(`- Manual-review candidates: ${report.summary.manualReviewCandidates}`)
  lines.push(`- Likely true zero / no-billing cases: ${report.summary.likelyTrueZeroOrNoBilling}`)
  lines.push('')
  lines.push('## Breakdown')
  lines.push('')
  lines.push(`1. Shared live Stripe IDs already attached to zero-MRR profiles: ${rollups.legacyLivePositiveShared.count} (${money(rollups.legacyLivePositiveShared.totalCandidateMrr)} live MRR, but shared/ambiguous)`)
  lines.push(`2. Safe non-email auto-fix candidates: ${rollups.safeAutofixCandidates.count}`)
  lines.push(`3. Email-only suspected matches: ${rollups.emailOnlyCandidates.count} (${money(rollups.emailOnlyCandidates.totalCandidateMrr)} potential MRR, manual review only)`)
  lines.push(`4. Mixed / multi-candidate matches: ${rollups.ambiguousCandidates.count} (${money(rollups.ambiguousCandidates.totalCandidateMrr)} candidate MRR across options)`)
  lines.push(`5. Legacy live Stripe rows with zero Stripe MRR: ${rollups.legacyLiveZero.count}`)
  lines.push(`6. No live Stripe evidence at all: ${rollups.noLiveStripeEvidence.count}`)
  lines.push('')
  lines.push('## AFYA')
  lines.push('')
  if (report.notableClients.afya) {
    const afya = report.notableClients.afya
    lines.push(`- AFYA (${afya.companyName}) has no stripeCustomerId on ClientProfile and MRR = 0.`)
    lines.push(`- Closest live Stripe candidate: ${afya.stripeCustomerId} · ${afya.stripeLabel} · ${money(afya.stripeMrr)} · signals: ${afya.signals.join(', ') || '(none)'}`)
    lines.push(`- Why not auto-fixed: email-only match (${afya.profileEmail}); no company/acronym/GHL confirmation on the ClientProfile row.`)
  } else {
    lines.push('- AFYA not found in the email-only candidate bucket.')
  }
  lines.push('')

  const sectionDefs = [
    ['Shared live Stripe IDs requiring Lex review', categories.legacyLivePositiveShared, (item) => [
      `${item.acronym || '(no acronym)'} · ${item.companyName}`,
      `Legacy Stripe: ${item.stripeCustomerId} · ${money(item.stripeMrr)} · ${item.stripeStatus}`,
      `Signals: ${item.signals.join(', ') || '(none)'}`,
      `Shared with: ${item.sharedProfiles.map((row) => `${row.acronym || '(no acronym)'} / ${row.companyName}`).join(' | ') || '(none)'}`,
    ]],
    ['Email-only suspected matches (manual review only)', categories.emailOnlyCandidates, (item) => [
      `${item.acronym || '(no acronym)'} · ${item.companyName}`,
      `Candidate: ${item.stripeCustomerId} · ${item.stripeLabel} · ${money(item.stripeMrr)} · ${item.stripeStatus}`,
      `Signals: ${item.signals.join(', ')}`,
      `Profile email: ${item.profileEmail || '(none)'}`,
      `Stripe email: ${item.stripeEmail || '(none)'}`,
    ]],
    ['Mixed / multi-candidate review queue', categories.ambiguousCandidates, (item) => [
      `${item.acronym || '(no acronym)'} · ${item.companyName}`,
      ...item.candidates.map((candidate) => `Candidate: ${candidate.stripeCustomerId} · ${candidate.stripeLabel} · ${money(candidate.stripeMrr)} · signals: ${candidate.signals.join(', ')}`),
    ]],
    ['Legacy live Stripe rows with zero Stripe MRR', categories.legacyLiveZero, (item) => [
      `${item.acronym || '(no acronym)'} · ${item.companyName}`,
      `Legacy Stripe: ${item.stripeCustomerId} · ${item.stripeStatus}`,
    ]],
    ['No live Stripe evidence', categories.noLiveStripeEvidence, (item) => [
      `${item.acronym || '(no acronym)'} · ${item.companyName}`,
      `Legacy Stripe: ${item.legacyStripeCustomerId || '(none)'}`,
    ]],
  ]

  for (const [title, items, formatter] of sectionDefs) {
    lines.push(`## ${title}`)
    lines.push('')
    if (!items.length) {
      lines.push('_None_')
      lines.push('')
      continue
    }
    items.forEach((item, index) => {
      lines.push(`### ${index + 1}. ${formatter(item)[0]}`)
      lines.push('')
      formatter(item).slice(1).forEach((line) => lines.push(`- ${line}`))
      lines.push('')
    })
  }

  fs.writeFileSync(REPORT_MD_PATH, `${lines.join('\n')}\n`)

  console.log(`✅ Missing-revenue audit complete`)
  console.log(`   Zero/null-MRR profiles: ${report.summary.zeroRevenueProfiles}`)
  console.log(`   Manual-review candidates: ${report.summary.manualReviewCandidates}`)
  console.log(`   Likely true zero / no-billing: ${report.summary.likelyTrueZeroOrNoBilling}`)
  console.log(`   Safe auto-fix candidates: ${report.summary.safeAutofixCandidates}`)
  console.log(`   Report: reports/${path.basename(REPORT_MD_PATH)}`)
}

main()
  .catch((error) => {
    console.error('Fatal:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end().catch(() => null)
  })
