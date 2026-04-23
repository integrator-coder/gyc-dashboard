import { pool } from './pg.js'
import {
  ensureStripeNormalizationTables,
  scoreStripeLinkCandidate,
  normalizeCompany,
  stripAcronymSuffix,
  getStripeComparableAcronym,
  normalizeAcronym,
  getStripeComparableCompany,
} from './stripe-normalization.mjs'

const TENANT_ID = 'gyc'
const LIVE_STATUSES = new Set(['active', 'past_due', 'trialing'])
const LIVE_REVIEW_STATUSES = new Set(['active', 'past_due'])

const REVIEW_TABLE_DDL = `
CREATE TABLE IF NOT EXISTS "ClientStripeLinkReview" (
  "id" BIGSERIAL PRIMARY KEY,
  "tenantId" TEXT NOT NULL DEFAULT 'gyc',
  "caseKey" TEXT NOT NULL,
  "clientProfileId" INTEGER REFERENCES "ClientProfile"("id") ON DELETE CASCADE,
  "stripeCustomerId" TEXT,
  "reason" TEXT NOT NULL,
  "reviewStatus" TEXT NOT NULL DEFAULT 'pending',
  "resolution" TEXT,
  "notes" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "reviewedAt" TIMESTAMP,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE("tenantId", "caseKey")
)
`

function isLiveStatus(status) {
  return LIVE_STATUSES.has(String(status || '').toLowerCase())
}

function isLiveReviewStatus(status) {
  return LIVE_REVIEW_STATUSES.has(String(status || '').toLowerCase())
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toIso(value) {
  if (!value) return null
  try {
    return new Date(value).toISOString()
  } catch {
    return null
  }
}

function cleanProfile(row) {
  if (!row) return null
  return {
    id: row.id,
    acronym: row.acronym || null,
    companyName: row.companyName || null,
    ownerName: row.ownerName || null,
    email: row.email || null,
    phone: row.phone || null,
    status: row.status || null,
    mrr: toNumber(row.mrr) || 0,
    stripeCustomerId: row.stripeCustomerId || null,
    stripeStatus: row.stripeStatus || null,
    ghlContactId: row.ghlContactId || null,
  }
}

function cleanStripe(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name || null,
    email: row.email || null,
    status: row.status || null,
    mrr: toNumber(row.mrr) || 0,
    companyName: row.companyName || null,
    acronym: row.acronym || null,
    ghlContactId: row.ghlContactId || null,
    phone: row.phone || null,
    ownerName: row.ownerName || null,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  }
}

function cleanLink(row, invoiceMap = new Map()) {
  const stripe = cleanStripe(row)
  return {
    stripeCustomerId: row.stripeCustomerId || row.id,
    isPrimary: Boolean(row.isPrimary),
    linkSource: row.linkSource || null,
    matchMethod: row.matchMethod || null,
    matchConfidence: row.matchConfidence || null,
    matchScore: row.matchScore == null ? null : Number(row.matchScore),
    matchSignals: Array.isArray(row.matchSignals) ? row.matchSignals : (row.matchSignals || []),
    notes: row.notes || null,
    firstLinkedAt: toIso(row.firstLinkedAt),
    lastSeenAt: toIso(row.lastSeenAt),
    stripe,
    recentInvoices: invoiceMap.get(row.stripeCustomerId || row.id) || [],
  }
}

function compactStripeLabel(stripe) {
  return stripe?.companyName || stripe?.name || stripe?.email || stripe?.id || 'Unknown Stripe customer'
}

function signalList(profile, stripeRow) {
  const signals = []

  if (profile?.stripeCustomerId && profile.stripeCustomerId === stripeRow?.id) signals.push('legacy')
  if (profile?.ghlContactId && stripeRow?.ghlContactId && profile.ghlContactId === stripeRow.ghlContactId) signals.push('ghl')

  const profileAcronym = normalizeAcronym(profile?.acronym)
  const stripeAcronym = getStripeComparableAcronym(stripeRow)
  if (profileAcronym && stripeAcronym && profileAcronym === stripeAcronym) signals.push('acronym')

  const profileCompany = normalizeCompany(stripAcronymSuffix(profile?.companyName || ''))
  const stripeCompany = normalizeCompany(getStripeComparableCompany(stripeRow))
  if (profileCompany && stripeCompany && profileCompany === stripeCompany) signals.push('company')

  const profileEmail = String(profile?.email || '').trim().toLowerCase()
  const stripeEmail = String(stripeRow?.email || '').trim().toLowerCase()
  if (profileEmail && stripeEmail && profileEmail === stripeEmail) signals.push('email')

  return signals
}

function reasonMeta(reason) {
  switch (reason) {
    case 'shared_legacy':
      return { label: 'Shared legacy Stripe customer', severity: 'high', sortOrder: 10 }
    case 'ambiguous_candidate':
      return { label: 'Ambiguous candidate match', severity: 'high', sortOrder: 20 }
    case 'email_only_candidate':
      return { label: 'Email-only candidate', severity: 'medium', sortOrder: 30 }
    case 'multi_live_profile':
      return { label: 'Multiple live normalized links', severity: 'medium', sortOrder: 40 }
    default:
      return { label: reason, severity: 'low', sortOrder: 90 }
  }
}

async function ensureLinkageReviewTable(queryable = pool) {
  await queryable.query(REVIEW_TABLE_DDL)
  await queryable.query(`CREATE INDEX IF NOT EXISTS "ClientStripeLinkReview_tenant_status_idx" ON "ClientStripeLinkReview" ("tenantId", "reviewStatus", "reason")`)
  await queryable.query(`CREATE INDEX IF NOT EXISTS "ClientStripeLinkReview_client_idx" ON "ClientStripeLinkReview" ("tenantId", "clientProfileId")`)
  await queryable.query(`CREATE INDEX IF NOT EXISTS "ClientStripeLinkReview_stripe_idx" ON "ClientStripeLinkReview" ("tenantId", "stripeCustomerId")`)
}

async function fetchInvoicesByStripeIds(stripeCustomerIds = [], tenantId = TENANT_ID) {
  if (!stripeCustomerIds.length) return new Map()

  const { rows } = await pool.query(
    `SELECT *
     FROM (
       SELECT
         sis."stripeCustomerId",
         sis.id,
         sis.status,
         sis.paid,
         sis.description,
         sis."invoiceCreatedAt",
         sis."amountPaid",
         sis."amountDue",
         sis."hostedInvoiceUrl",
         ROW_NUMBER() OVER (
           PARTITION BY sis."stripeCustomerId"
           ORDER BY COALESCE(sis."invoiceCreatedAt", sis."createdAt") DESC NULLS LAST
         ) AS rn
       FROM "StripeInvoiceSnapshot" sis
       WHERE sis."tenantId" = $1
         AND sis."stripeCustomerId" = ANY($2::text[])
     ) ranked
     WHERE ranked.rn <= 3
     ORDER BY ranked."stripeCustomerId" ASC, ranked."invoiceCreatedAt" DESC NULLS LAST`,
    [tenantId, stripeCustomerIds]
  ).catch(() => ({ rows: [] }))

  const map = new Map()
  for (const row of rows) {
    const list = map.get(row.stripeCustomerId) || []
    list.push({
      id: row.id,
      status: row.status || null,
      paid: row.paid === true,
      description: row.description || null,
      invoiceCreatedAt: toIso(row.invoiceCreatedAt),
      amountPaid: toNumber(row.amountPaid) || 0,
      amountDue: toNumber(row.amountDue) || 0,
      hostedInvoiceUrl: row.hostedInvoiceUrl || null,
    })
    map.set(row.stripeCustomerId, list)
  }

  return map
}

export async function getStripeLinkageReviewQueue({ tenantId = TENANT_ID, acronym = null, includeResolved = false } = {}) {
  await ensureStripeNormalizationTables(pool)
  await ensureLinkageReviewTable(pool)

  const filters = []
  const profileParams = [tenantId]
  if (acronym) {
    profileParams.push(String(acronym).trim().toUpperCase())
    filters.push(`cp.acronym = $${profileParams.length}`)
  }

  const profileWhere = filters.length ? ` AND ${filters.join(' AND ')}` : ''

  const [profilesRes, stripeRes, linksRes, reviewsRes] = await Promise.all([
    pool.query(
      `SELECT
         cp.id,
         cp.acronym,
         cp."companyName",
         cp."ownerName",
         cp.email,
         cp.phone,
         cp.status,
         cp.mrr,
         cp."stripeCustomerId",
         cp."stripeStatus",
         cp."ghlContactId"
       FROM "ClientProfile" cp
       WHERE cp."tenantId" = $1${profileWhere}
       ORDER BY cp."companyName" ASC NULLS LAST, cp.acronym ASC NULLS LAST`,
      profileParams
    ),
    pool.query(
      `SELECT
         sc.id,
         sc.name,
         sc.email,
         sc.status,
         sc.mrr,
         sc."companyName",
         sc.acronym,
         sc."ghlContactId",
         sc.phone,
         sc."ownerName",
         sc."createdAt",
         sc."updatedAt"
       FROM "StripeCustomer" sc
       WHERE COALESCE(sc."tenantId", sc."organizationId", $1) = $1`,
      [tenantId]
    ),
    pool.query(
      `SELECT
         csl."clientProfileId",
         csl."stripeCustomerId",
         csl."isPrimary",
         csl."linkSource",
         csl."matchMethod",
         csl."matchConfidence",
         csl."matchScore",
         csl."matchSignals",
         csl.notes,
         csl."firstLinkedAt",
         csl."lastSeenAt",
         sc.id,
         sc.name,
         sc.email,
         sc.status,
         sc.mrr,
         sc."companyName",
         sc.acronym,
         sc."ghlContactId",
         sc.phone,
         sc."ownerName",
         sc."createdAt",
         sc."updatedAt"
       FROM "ClientStripeLink" csl
       LEFT JOIN "StripeCustomer" sc
         ON sc.id = csl."stripeCustomerId"
        AND COALESCE(sc."tenantId", sc."organizationId", $1) = $1
       WHERE csl."tenantId" = $1`,
      [tenantId]
    ),
    pool.query(
      `SELECT
         clr."caseKey",
         clr."clientProfileId",
         clr."stripeCustomerId",
         clr.reason,
         clr."reviewStatus",
         clr.resolution,
         clr.notes,
         clr.payload,
         clr."reviewedAt",
         clr."createdBy",
         clr."updatedBy",
         clr."createdAt",
         clr."updatedAt"
       FROM "ClientStripeLinkReview" clr
       WHERE clr."tenantId" = $1`,
      [tenantId]
    ),
  ])

  const profiles = profilesRes.rows.map(cleanProfile)
  const profileById = new Map(profiles.map((row) => [row.id, row]))

  const stripes = stripeRes.rows.map(cleanStripe)
  const stripeById = new Map(stripes.map((row) => [row.id, row]))
  const livePositiveStripe = stripes.filter((row) => isLiveStatus(row.status) && Number(row.mrr || 0) > 0)

  const linksByClientId = new Map()
  for (const row of linksRes.rows) {
    const list = linksByClientId.get(row.clientProfileId) || []
    list.push(row)
    linksByClientId.set(row.clientProfileId, list)
  }

  const reviewByCaseKey = new Map(
    reviewsRes.rows.map((row) => [row.caseKey, {
      caseKey: row.caseKey,
      clientProfileId: row.clientProfileId,
      stripeCustomerId: row.stripeCustomerId,
      reason: row.reason,
      reviewStatus: row.reviewStatus,
      resolution: row.resolution,
      notes: row.notes || '',
      payload: row.payload || {},
      reviewedAt: toIso(row.reviewedAt),
      createdBy: row.createdBy || null,
      updatedBy: row.updatedBy || null,
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    }])
  )

  const sharedLegacyProfilesByStripe = new Map()
  for (const profile of profiles) {
    if (!profile.stripeCustomerId) continue
    const list = sharedLegacyProfilesByStripe.get(profile.stripeCustomerId) || []
    list.push(profile)
    sharedLegacyProfilesByStripe.set(profile.stripeCustomerId, list)
  }

  const candidateStripeIds = new Set()
  const caseDrafts = []

  for (const [stripeCustomerId, impactedProfiles] of sharedLegacyProfilesByStripe.entries()) {
    if (impactedProfiles.length <= 1) continue

    const stripe = stripeById.get(stripeCustomerId) || { id: stripeCustomerId }
    const caseKey = `shared_legacy:${stripeCustomerId}`
    const review = reviewByCaseKey.get(caseKey) || null
    if (!includeResolved && review?.reviewStatus === 'resolved') continue

    const clients = impactedProfiles.map((profile) => {
      const rawLinks = linksByClientId.get(profile.id) || []
      const clientLinkRows = rawLinks.filter((row) => row.stripeCustomerId === stripeCustomerId)
      const primaryLink = rawLinks.find((row) => row.isPrimary) || null
      if (stripeCustomerId) candidateStripeIds.add(stripeCustomerId)
      return {
        ...profile,
        currentPrimaryStripeCustomerId: primaryLink?.stripeCustomerId || null,
        currentPrimaryStripeLabel: primaryLink ? compactStripeLabel(primaryLink) : null,
        linksToSharedStripe: clientLinkRows.map((row) => ({
          isPrimary: Boolean(row.isPrimary),
          matchConfidence: row.matchConfidence || null,
          matchScore: row.matchScore == null ? null : Number(row.matchScore),
          matchSignals: Array.isArray(row.matchSignals) ? row.matchSignals : [],
          linkSource: row.linkSource || null,
        })),
      }
    })

    caseDrafts.push({
      caseKey,
      reason: 'shared_legacy',
      title: `${compactStripeLabel(stripe)} shared across ${impactedProfiles.length} client profiles`,
      subtitle: stripe.id,
      review,
      stripe,
      clients,
      candidateMrr: Number(stripe.mrr || 0),
      recommendedAction: 'Choose the true primary client for this Stripe customer, then mark any additional relationships as shared or leave a billing-review note.',
    })
  }

  for (const profile of profiles) {
    const rawLinks = linksByClientId.get(profile.id) || []
    const currentPrimary = rawLinks.find((row) => row.isPrimary) || null
    const liveLinkedRows = rawLinks.filter((row) => isLiveReviewStatus(row.status))

    if (liveLinkedRows.length > 1) {
      const caseKey = `multi_live_profile:${profile.id}`
      const review = reviewByCaseKey.get(caseKey) || null
      if (includeResolved || review?.reviewStatus !== 'resolved') {
        for (const link of liveLinkedRows) {
          if (link.stripeCustomerId) candidateStripeIds.add(link.stripeCustomerId)
        }

        caseDrafts.push({
          caseKey,
          reason: 'multi_live_profile',
          title: `${profile.companyName || profile.acronym || `Client ${profile.id}`} has ${liveLinkedRows.length} live normalized Stripe links`,
          subtitle: profile.acronym || `Client ${profile.id}`,
          review,
          subjectClient: profile,
          currentPrimaryStripeCustomerId: currentPrimary?.stripeCustomerId || null,
          candidateMrr: liveLinkedRows.reduce((sum, row) => sum + Number(row.mrr || 0), 0),
          candidateStripeIds: liveLinkedRows.map((row) => row.stripeCustomerId),
          recommendedAction: 'Confirm which Stripe customer should be primary for attribution. Keep extra rows as shared/secondary only when the billing relationship is real.',
        })
      }
    }

    if (currentPrimary || Number(profile.mrr || 0) !== 0) continue

    const candidates = livePositiveStripe
      .map((stripe) => {
        const match = scoreStripeLinkCandidate(stripe, profile)
        const signals = signalList(profile, stripe)
        return {
          stripe,
          score: Number(match.score || 0),
          reasons: match.reasons || [],
          signals,
          confidence: match.confidence || 'low',
        }
      })
      .filter((row) => row.signals.length > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        if (Number(b.stripe.mrr || 0) !== Number(a.stripe.mrr || 0)) return Number(b.stripe.mrr || 0) - Number(a.stripe.mrr || 0)
        return String(a.stripe.id).localeCompare(String(b.stripe.id))
      })

    const nonLegacyCandidates = candidates.filter((row) => row.stripe.id !== profile.stripeCustomerId)
    const exactNonEmail = nonLegacyCandidates.filter((row) => row.signals.some((signal) => ['ghl', 'acronym', 'company'].includes(signal)))
    const emailOnly = nonLegacyCandidates.filter((row) => row.signals.length === 1 && row.signals[0] === 'email')

    let reason = null
    let chosenCandidates = []
    let recommendedAction = null

    if (emailOnly.length === 1 && exactNonEmail.length === 0 && nonLegacyCandidates.length === 1) {
      reason = 'email_only_candidate'
      chosenCandidates = emailOnly.slice(0, 1)
      recommendedAction = 'Manual review only. This is an email-only match, so Todd/Lex should confirm before setting a primary link.'
    } else if (nonLegacyCandidates.length > 0) {
      reason = 'ambiguous_candidate'
      chosenCandidates = nonLegacyCandidates.slice(0, 5)
      recommendedAction = 'Review the evidence and pick the correct primary Stripe customer, or leave a legacy-needs-review note if attribution is still unclear.'
    }

    if (!reason) continue

    const caseKey = `${reason}:${profile.id}`
    const review = reviewByCaseKey.get(caseKey) || null
    if (!includeResolved && review?.reviewStatus === 'resolved') continue

    for (const candidate of chosenCandidates) candidateStripeIds.add(candidate.stripe.id)

    caseDrafts.push({
      caseKey,
      reason,
      title: `${profile.companyName || profile.acronym || `Client ${profile.id}`} needs linkage review`,
      subtitle: profile.acronym || `Client ${profile.id}`,
      review,
      subjectClient: profile,
      candidateMrr: chosenCandidates.reduce((sum, item) => sum + Number(item.stripe.mrr || 0), 0),
      candidates: chosenCandidates,
      recommendedAction,
    })
  }

  const invoiceMap = await fetchInvoicesByStripeIds([...candidateStripeIds], tenantId)

  const cases = caseDrafts
    .map((item) => {
      const meta = reasonMeta(item.reason)

      if (item.reason === 'shared_legacy') {
        return {
          ...item,
          reasonLabel: meta.label,
          severity: meta.severity,
          sortOrder: meta.sortOrder,
          stripe: {
            ...item.stripe,
            recentInvoices: invoiceMap.get(item.stripe.id) || [],
          },
          clients: item.clients.map((profile) => ({
            ...profile,
            clientHref: profile.acronym ? `/clients/${profile.acronym}` : null,
          })),
        }
      }

      if (item.reason === 'multi_live_profile') {
        const links = (linksByClientId.get(item.subjectClient.id) || [])
          .filter((row) => item.candidateStripeIds.includes(row.stripeCustomerId))
          .map((row) => cleanLink(row, invoiceMap))
          .sort((a, b) => {
            if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1
            return Number(b.stripe?.mrr || 0) - Number(a.stripe?.mrr || 0)
          })

        return {
          ...item,
          reasonLabel: meta.label,
          severity: meta.severity,
          sortOrder: meta.sortOrder,
          subjectClient: {
            ...item.subjectClient,
            clientHref: item.subjectClient.acronym ? `/clients/${item.subjectClient.acronym}` : null,
          },
          links,
        }
      }

      return {
        ...item,
        reasonLabel: meta.label,
        severity: meta.severity,
        sortOrder: meta.sortOrder,
        subjectClient: {
          ...item.subjectClient,
          clientHref: item.subjectClient.acronym ? `/clients/${item.subjectClient.acronym}` : null,
        },
        candidates: (item.candidates || []).map((candidate) => ({
          ...candidate,
          stripe: {
            ...candidate.stripe,
            recentInvoices: invoiceMap.get(candidate.stripe.id) || [],
          },
        })),
      }
    })
    .sort((a, b) => {
      const aResolved = a.review?.reviewStatus === 'resolved'
      const bResolved = b.review?.reviewStatus === 'resolved'
      if (aResolved !== bResolved) return aResolved ? 1 : -1
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
      if (Number(b.candidateMrr || 0) !== Number(a.candidateMrr || 0)) return Number(b.candidateMrr || 0) - Number(a.candidateMrr || 0)
      return String(a.title || '').localeCompare(String(b.title || ''))
    })

  const summary = cases.reduce((acc, item) => {
    acc.total += 1
    const key = item.reason
    acc.byReason[key] = (acc.byReason[key] || 0) + 1
    if (item.review?.reviewStatus === 'resolved') {
      acc.resolved += 1
    } else {
      acc.open += 1
      acc.openByReason[key] = (acc.openByReason[key] || 0) + 1
    }
    return acc
  }, { total: 0, open: 0, resolved: 0, byReason: {}, openByReason: {} })

  return {
    generatedAt: new Date().toISOString(),
    tenantId,
    summary,
    cases,
  }
}

export async function applyStripeLinkageDecision({
  tenantId = TENANT_ID,
  caseKey,
  reason,
  clientProfileId = null,
  stripeCustomerId = null,
  resolution,
  notes = '',
  userEmail = null,
}) {
  if (!caseKey) {
    const error = new Error('caseKey is required.')
    error.status = 400
    throw error
  }

  if (!reason) {
    const error = new Error('reason is required.')
    error.status = 400
    throw error
  }

  if (!resolution) {
    const error = new Error('resolution is required.')
    error.status = 400
    throw error
  }

  const validResolutions = new Set(['primary', 'shared', 'legacy-needs-review', 'not-a-match', 'resolved', 'reopen'])
  if (!validResolutions.has(resolution)) {
    const error = new Error('Unsupported resolution.')
    error.status = 400
    throw error
  }

  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    await ensureStripeNormalizationTables(db)
    await ensureLinkageReviewTable(db)

    let profile = null
    let stripe = null
    let match = { method: null, confidence: 'medium', score: null, reasons: [] }

    if (clientProfileId) {
      const profileRes = await db.query(
        `SELECT id, acronym, "companyName", email, "ghlContactId", "stripeCustomerId"
         FROM "ClientProfile"
         WHERE "tenantId" = $1 AND id = $2
         LIMIT 1`,
        [tenantId, clientProfileId]
      )
      profile = cleanProfile(profileRes.rows[0])
      if (!profile) {
        const error = new Error('Client profile not found.')
        error.status = 404
        throw error
      }
    }

    if (stripeCustomerId) {
      const stripeRes = await db.query(
        `SELECT id, name, email, status, mrr, "companyName", acronym, "ghlContactId", phone, "ownerName", "createdAt", "updatedAt"
         FROM "StripeCustomer"
         WHERE COALESCE("tenantId", "organizationId", $1) = $1 AND id = $2
         LIMIT 1`,
        [tenantId, stripeCustomerId]
      )
      stripe = cleanStripe(stripeRes.rows[0])
      if (!stripe) {
        const error = new Error('Stripe customer not found.')
        error.status = 404
        throw error
      }
    }

    if ((resolution === 'primary' || resolution === 'shared') && (!clientProfileId || !stripeCustomerId)) {
      const error = new Error('clientProfileId and stripeCustomerId are required for this decision.')
      error.status = 400
      throw error
    }

    if (profile && stripe) {
      match = scoreStripeLinkCandidate(stripe, profile)
    }

    if (resolution === 'primary') {
      await db.query(
        `UPDATE "ClientStripeLink"
         SET "isPrimary" = false,
             "updatedAt" = NOW()
         WHERE "tenantId" = $1
           AND ("clientProfileId" = $2 OR "stripeCustomerId" = $3)
           AND "isPrimary" = true`,
        [tenantId, clientProfileId, stripeCustomerId]
      )

      await db.query(
        `INSERT INTO "ClientStripeLink" (
            "tenantId", "clientProfileId", "stripeCustomerId", "isPrimary",
            "linkSource", "matchMethod", "matchConfidence", "matchScore",
            "matchSignals", notes, "firstLinkedAt", "lastSeenAt", "createdAt", "updatedAt"
          ) VALUES (
            $1,$2,$3,true,
            'review',$4,$5,$6,
            $7,$8,NOW(),NOW(),NOW(),NOW()
          )
          ON CONFLICT ("tenantId", "clientProfileId", "stripeCustomerId") DO UPDATE SET
            "isPrimary" = true,
            "linkSource" = 'review',
            "matchMethod" = EXCLUDED."matchMethod",
            "matchConfidence" = EXCLUDED."matchConfidence",
            "matchScore" = EXCLUDED."matchScore",
            "matchSignals" = EXCLUDED."matchSignals",
            notes = EXCLUDED.notes,
            "lastSeenAt" = NOW(),
            "updatedAt" = NOW()`,
        [
          tenantId,
          clientProfileId,
          stripeCustomerId,
          match.method,
          match.confidence,
          match.score == null ? null : Number(match.score),
          match.reasons || [],
          notes || null,
        ]
      )
    }

    if (resolution === 'shared') {
      await db.query(
        `INSERT INTO "ClientStripeLink" (
            "tenantId", "clientProfileId", "stripeCustomerId", "isPrimary",
            "linkSource", "matchMethod", "matchConfidence", "matchScore",
            "matchSignals", notes, "firstLinkedAt", "lastSeenAt", "createdAt", "updatedAt"
          ) VALUES (
            $1,$2,$3,false,
            'review',$4,$5,$6,
            $7,$8,NOW(),NOW(),NOW(),NOW()
          )
          ON CONFLICT ("tenantId", "clientProfileId", "stripeCustomerId") DO UPDATE SET
            "isPrimary" = false,
            "linkSource" = 'review',
            "matchMethod" = EXCLUDED."matchMethod",
            "matchConfidence" = EXCLUDED."matchConfidence",
            "matchScore" = EXCLUDED."matchScore",
            "matchSignals" = EXCLUDED."matchSignals",
            notes = EXCLUDED.notes,
            "lastSeenAt" = NOW(),
            "updatedAt" = NOW()`,
        [
          tenantId,
          clientProfileId,
          stripeCustomerId,
          match.method,
          match.confidence,
          match.score == null ? null : Number(match.score),
          match.reasons || [],
          notes || 'Shared / secondary billing relationship confirmed in review.',
        ]
      )
    }

    const reviewStatus = resolution === 'reopen' ? 'pending' : 'resolved'
    const storedResolution = resolution === 'reopen' ? null : resolution

    await db.query(
      `INSERT INTO "ClientStripeLinkReview" (
          "tenantId", "caseKey", "clientProfileId", "stripeCustomerId", reason,
          "reviewStatus", resolution, notes, payload, "reviewedAt", "createdBy", "updatedBy", "createdAt", "updatedAt"
        ) VALUES (
          $1,$2,$3,$4,$5,
          $6,$7,$8,$9,NOW(),$10,$10,NOW(),NOW()
        )
        ON CONFLICT ("tenantId", "caseKey") DO UPDATE SET
          "clientProfileId" = EXCLUDED."clientProfileId",
          "stripeCustomerId" = EXCLUDED."stripeCustomerId",
          reason = EXCLUDED.reason,
          "reviewStatus" = EXCLUDED."reviewStatus",
          resolution = EXCLUDED.resolution,
          notes = EXCLUDED.notes,
          payload = EXCLUDED.payload,
          "reviewedAt" = NOW(),
          "updatedBy" = EXCLUDED."updatedBy",
          "updatedAt" = NOW()`,
      [
        tenantId,
        caseKey,
        clientProfileId,
        stripeCustomerId,
        reason,
        reviewStatus,
        storedResolution,
        notes || null,
        JSON.stringify({ resolution, userEmail, appliedAt: new Date().toISOString() }),
        userEmail,
      ]
    )

    await db.query('COMMIT')
    return { success: true }
  } catch (error) {
    await db.query('ROLLBACK').catch(() => null)
    throw error
  } finally {
    db.release()
  }
}
