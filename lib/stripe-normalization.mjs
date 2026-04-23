const CLIENT_STRIPE_LINK_DDL = `
CREATE TABLE IF NOT EXISTS "ClientStripeLink" (
  "id" BIGSERIAL PRIMARY KEY,
  "tenantId" TEXT NOT NULL DEFAULT 'gyc',
  "clientProfileId" INTEGER NOT NULL REFERENCES "ClientProfile"("id") ON DELETE CASCADE,
  "stripeCustomerId" TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "linkSource" TEXT NOT NULL DEFAULT 'system',
  "matchMethod" TEXT,
  "matchConfidence" TEXT NOT NULL DEFAULT 'medium',
  "matchScore" INTEGER,
  "matchSignals" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "notes" TEXT,
  "firstLinkedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "lastSeenAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE("tenantId", "clientProfileId", "stripeCustomerId")
)
`

const STRIPE_INVOICE_SNAPSHOT_DDL = `
CREATE TABLE IF NOT EXISTS "StripeInvoiceSnapshot" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL DEFAULT 'gyc',
  "stripeCustomerId" TEXT NOT NULL,
  "subscriptionId" TEXT,
  "chargeId" TEXT,
  "paymentIntentId" TEXT,
  "invoiceNumber" TEXT,
  "status" TEXT,
  "billingReason" TEXT,
  "currency" TEXT DEFAULT 'usd',
  "amountDue" NUMERIC(12,2),
  "amountPaid" NUMERIC(12,2),
  "amountRemaining" NUMERIC(12,2),
  "subtotal" NUMERIC(12,2),
  "total" NUMERIC(12,2),
  "attemptCount" INTEGER,
  "attempted" BOOLEAN,
  "paid" BOOLEAN,
  "forgiven" BOOLEAN,
  "collectionMethod" TEXT,
  "dueDate" TIMESTAMP,
  "periodStart" TIMESTAMP,
  "periodEnd" TIMESTAMP,
  "invoiceCreatedAt" TIMESTAMP,
  "paidAt" TIMESTAMP,
  "hostedInvoiceUrl" TEXT,
  "invoicePdf" TEXT,
  "description" TEXT,
  "rawLines" JSONB,
  "lastPaymentError" TEXT,
  "syncedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
)
`

export function normalizeCompany(name) {
  if (!name) return ''
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

export function extractAcronymFromName(str) {
  if (!str) return null
  const match = String(str).trim().match(/\(([A-Z0-9]{2,8})\)\s*$/)
  return match ? match[1] : null
}

export function stripAcronymSuffix(str) {
  if (!str) return ''
  return String(str).replace(/\s*\([A-Z0-9]{2,8}\)\s*$/, '').trim()
}

export function normalizeAcronym(value) {
  const normalized = String(value || '').trim().toUpperCase()
  return normalized || null
}

export function getStripeComparableCompany(stripeRow) {
  return stripAcronymSuffix(stripeRow?.companyName || stripeRow?.name || stripeRow?.email || '')
}

export function getStripeComparableAcronym(stripeRow) {
  return normalizeAcronym(
    stripeRow?.acronym
      || extractAcronymFromName(stripeRow?.companyName)
      || extractAcronymFromName(stripeRow?.name)
  )
}

export function scoreStripeLinkCandidate(stripeRow, profile) {
  const reasons = []
  let score = 0

  const profileCompany = normalizeCompany(stripAcronymSuffix(profile?.companyName || ''))
  const stripeCompany = normalizeCompany(getStripeComparableCompany(stripeRow))
  const profileAcronym = normalizeAcronym(profile?.acronym)
  const stripeAcronym = getStripeComparableAcronym(stripeRow)

  if (profile?.stripeCustomerId && profile.stripeCustomerId === stripeRow?.id) {
    score += 140
    reasons.push('legacy_profile_pointer')
  }

  if (profile?.ghlContactId && stripeRow?.ghlContactId && profile.ghlContactId === stripeRow.ghlContactId) {
    score += 100
    reasons.push('ghl_exact')
  }

  if (profileCompany && stripeCompany && profileCompany === stripeCompany) {
    score += 90
    reasons.push('company_exact')
  }

  if (profileAcronym && stripeAcronym && profileAcronym === stripeAcronym) {
    score += 80
    reasons.push('acronym_exact')
  }

  if (
    profileCompany
    && stripeCompany
    && profileCompany.length >= 6
    && (profileCompany.includes(stripeCompany) || stripeCompany.includes(profileCompany))
  ) {
    score += 20
    reasons.push('company_partial')
  }

  if (!reasons.length) {
    return { score: 0, reasons: [], method: null, confidence: 'low' }
  }

  const method = reasons[0]
  const confidence = score >= 140 || reasons.includes('ghl_exact')
    ? 'high'
    : score >= 90
      ? 'medium'
      : 'low'

  return { score, reasons, method, confidence }
}

export async function ensureStripeNormalizationTables(queryable) {
  await queryable.query(CLIENT_STRIPE_LINK_DDL)
  await queryable.query(STRIPE_INVOICE_SNAPSHOT_DDL)

  await queryable.query(`CREATE INDEX IF NOT EXISTS "ClientStripeLink_tenant_client_idx" ON "ClientStripeLink" ("tenantId", "clientProfileId")`)
  await queryable.query(`CREATE INDEX IF NOT EXISTS "ClientStripeLink_tenant_stripe_idx" ON "ClientStripeLink" ("tenantId", "stripeCustomerId")`)
  await queryable.query(`CREATE INDEX IF NOT EXISTS "ClientStripeLink_primary_idx" ON "ClientStripeLink" ("tenantId", "clientProfileId", "isPrimary")`)
  await queryable.query(`CREATE UNIQUE INDEX IF NOT EXISTS "ClientStripeLink_one_primary_per_client" ON "ClientStripeLink" ("tenantId", "clientProfileId") WHERE "isPrimary" = true`)
  await queryable.query(`CREATE UNIQUE INDEX IF NOT EXISTS "ClientStripeLink_one_primary_per_stripe" ON "ClientStripeLink" ("tenantId", "stripeCustomerId") WHERE "isPrimary" = true`)

  await queryable.query(`CREATE INDEX IF NOT EXISTS "StripeInvoiceSnapshot_tenant_customer_idx" ON "StripeInvoiceSnapshot" ("tenantId", "stripeCustomerId")`)
  await queryable.query(`CREATE INDEX IF NOT EXISTS "StripeInvoiceSnapshot_tenant_created_idx" ON "StripeInvoiceSnapshot" ("tenantId", "invoiceCreatedAt" DESC)`)
  await queryable.query(`CREATE INDEX IF NOT EXISTS "StripeInvoiceSnapshot_tenant_status_idx" ON "StripeInvoiceSnapshot" ("tenantId", status)`)
}

export async function syncClientStripeLinks(queryable, {
  tenantId = 'gyc',
  clientProfileId,
  profile,
  stripeRows = [],
  primaryStripeCustomerId = null,
  linkSource = 'sync-client-profiles',
}) {
  if (!clientProfileId || !stripeRows.length) {
    return { linkedCount: 0, primaryStripeCustomerId: null, accepted: [] }
  }

  const uniqueRows = []
  const seen = new Set()
  for (const row of stripeRows) {
    if (!row?.id || seen.has(row.id)) continue
    seen.add(row.id)
    uniqueRows.push(row)
  }

  const accepted = uniqueRows
    .map((row) => ({ row, match: scoreStripeLinkCandidate(row, profile) }))
    .filter(({ match }) => match.score >= 80)
    .sort((a, b) => {
      if (b.match.score !== a.match.score) return b.match.score - a.match.score
      return String(a.row.id).localeCompare(String(b.row.id))
    })

  if (!accepted.length) {
    return { linkedCount: 0, primaryStripeCustomerId: null, accepted: [] }
  }

  const acceptedIds = new Set(accepted.map(({ row }) => row.id))
  const resolvedPrimaryId = primaryStripeCustomerId && acceptedIds.has(primaryStripeCustomerId)
    ? primaryStripeCustomerId
    : (accepted.length === 1 && accepted[0].match.score >= 100 ? accepted[0].row.id : null)

  if (resolvedPrimaryId) {
    await queryable.query(
      `UPDATE "ClientStripeLink"
       SET "isPrimary" = false,
           "updatedAt" = NOW()
       WHERE "tenantId" = $1
         AND "clientProfileId" = $2
         AND "stripeCustomerId" <> $3
         AND "isPrimary" = true`,
      [tenantId, clientProfileId, resolvedPrimaryId]
    )
  }

  for (const { row, match } of accepted) {
    const isPrimary = resolvedPrimaryId === row.id
    await queryable.query(
      `INSERT INTO "ClientStripeLink" (
          "tenantId", "clientProfileId", "stripeCustomerId", "isPrimary",
          "linkSource", "matchMethod", "matchConfidence", "matchScore",
          "matchSignals", "lastSeenAt", "updatedAt"
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())
        ON CONFLICT ("tenantId", "clientProfileId", "stripeCustomerId") DO UPDATE SET
          "isPrimary" = EXCLUDED."isPrimary",
          "linkSource" = EXCLUDED."linkSource",
          "matchMethod" = EXCLUDED."matchMethod",
          "matchConfidence" = EXCLUDED."matchConfidence",
          "matchScore" = EXCLUDED."matchScore",
          "matchSignals" = EXCLUDED."matchSignals",
          "lastSeenAt" = NOW(),
          "updatedAt" = NOW()`,
      [
        tenantId,
        clientProfileId,
        row.id,
        isPrimary,
        linkSource,
        match.method,
        match.confidence,
        match.score,
        match.reasons,
      ]
    )
  }

  return {
    linkedCount: accepted.length,
    primaryStripeCustomerId: resolvedPrimaryId,
    accepted: accepted.map(({ row, match }) => ({ id: row.id, score: match.score, reasons: match.reasons, isPrimary: resolvedPrimaryId === row.id })),
  }
}

export async function syncStripeInvoiceSnapshots({
  stripe,
  queryable,
  tenantId = 'gyc',
  lookbackDays = 365,
  logger = console,
}) {
  if (!stripe) return { synced: 0, lookbackDays }

  await ensureStripeNormalizationTables(queryable)

  const createdGte = Math.floor((Date.now() - lookbackDays * 24 * 60 * 60 * 1000) / 1000)
  let synced = 0

  for await (const invoice of stripe.invoices.list({
    limit: 100,
    created: { gte: createdGte },
    expand: ['data.charge', 'data.payment_intent', 'data.lines.data.price'],
  })) {
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
    if (!customerId) continue

    const firstLine = invoice.lines?.data?.[0] || null
    const paymentIntent = invoice.payment_intent && typeof invoice.payment_intent === 'object' ? invoice.payment_intent : null
    const charge = invoice.charge && typeof invoice.charge === 'object' ? invoice.charge : null
    const lastPaymentError = paymentIntent?.last_payment_error?.message || invoice.last_finalization_error?.message || null

    await queryable.query(
      `INSERT INTO "StripeInvoiceSnapshot" (
          "id", "tenantId", "stripeCustomerId", "subscriptionId", "chargeId", "paymentIntentId",
          "invoiceNumber", status, "billingReason", currency,
          "amountDue", "amountPaid", "amountRemaining", subtotal, total,
          "attemptCount", attempted, paid, forgiven, "collectionMethod",
          "dueDate", "periodStart", "periodEnd", "invoiceCreatedAt", "paidAt",
          "hostedInvoiceUrl", "invoicePdf", description, "rawLines", "lastPaymentError",
          "syncedAt", "updatedAt"
        ) VALUES (
          $1,$2,$3,$4,$5,$6,
          $7,$8,$9,$10,
          $11,$12,$13,$14,$15,
          $16,$17,$18,$19,$20,
          $21,$22,$23,$24,$25,
          $26,$27,$28,$29,$30,
          NOW(),NOW()
        )
        ON CONFLICT ("id") DO UPDATE SET
          "tenantId" = EXCLUDED."tenantId",
          "stripeCustomerId" = EXCLUDED."stripeCustomerId",
          "subscriptionId" = EXCLUDED."subscriptionId",
          "chargeId" = EXCLUDED."chargeId",
          "paymentIntentId" = EXCLUDED."paymentIntentId",
          "invoiceNumber" = EXCLUDED."invoiceNumber",
          status = EXCLUDED.status,
          "billingReason" = EXCLUDED."billingReason",
          currency = EXCLUDED.currency,
          "amountDue" = EXCLUDED."amountDue",
          "amountPaid" = EXCLUDED."amountPaid",
          "amountRemaining" = EXCLUDED."amountRemaining",
          subtotal = EXCLUDED.subtotal,
          total = EXCLUDED.total,
          "attemptCount" = EXCLUDED."attemptCount",
          attempted = EXCLUDED.attempted,
          paid = EXCLUDED.paid,
          forgiven = EXCLUDED.forgiven,
          "collectionMethod" = EXCLUDED."collectionMethod",
          "dueDate" = EXCLUDED."dueDate",
          "periodStart" = EXCLUDED."periodStart",
          "periodEnd" = EXCLUDED."periodEnd",
          "invoiceCreatedAt" = EXCLUDED."invoiceCreatedAt",
          "paidAt" = EXCLUDED."paidAt",
          "hostedInvoiceUrl" = EXCLUDED."hostedInvoiceUrl",
          "invoicePdf" = EXCLUDED."invoicePdf",
          description = EXCLUDED.description,
          "rawLines" = EXCLUDED."rawLines",
          "lastPaymentError" = EXCLUDED."lastPaymentError",
          "syncedAt" = NOW(),
          "updatedAt" = NOW()`,
      [
        invoice.id,
        tenantId,
        customerId,
        typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id || null,
        charge?.id || (typeof invoice.charge === 'string' ? invoice.charge : null),
        paymentIntent?.id || (typeof invoice.payment_intent === 'string' ? invoice.payment_intent : null),
        invoice.number || null,
        invoice.status || null,
        invoice.billing_reason || null,
        invoice.currency || 'usd',
        Number(invoice.amount_due || 0) / 100,
        Number(invoice.amount_paid || 0) / 100,
        Number(invoice.amount_remaining || 0) / 100,
        Number(invoice.subtotal || 0) / 100,
        Number(invoice.total || 0) / 100,
        invoice.attempt_count || 0,
        Boolean(invoice.attempted),
        Boolean(invoice.paid),
        Boolean(invoice.forgiven),
        invoice.collection_method || null,
        invoice.due_date ? new Date(invoice.due_date * 1000) : null,
        invoice.period_start ? new Date(invoice.period_start * 1000) : null,
        invoice.period_end ? new Date(invoice.period_end * 1000) : null,
        invoice.created ? new Date(invoice.created * 1000) : null,
        invoice.status_transitions?.paid_at ? new Date(invoice.status_transitions.paid_at * 1000) : null,
        invoice.hosted_invoice_url || null,
        invoice.invoice_pdf || null,
        firstLine?.description || invoice.description || null,
        JSON.stringify(invoice.lines?.data || []),
        lastPaymentError,
      ]
    )
    synced++
  }

  logger.log?.(`Stripe invoice snapshots synced: ${synced} (${lookbackDays}d window)`)
  return { synced, lookbackDays }
}
