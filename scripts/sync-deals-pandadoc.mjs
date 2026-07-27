/**
 * sync-deals-pandadoc.mjs
 * Real-time deal sync from PandaDoc → SalesDeal table.
 * Data enriched with Stripe (MRR) + GHL (rep attribution).
 *
 * Architecture:
 *   PandaDoc (completed agreements)
 *   + Stripe (subscription MRR by customer email)
 *   + GHL (rep attribution via assignedTo user)
 *   → SalesDeal table → /deals page
 *
 * Usage:
 *   node scripts/sync-deals-pandadoc.mjs                # last 365 days
 *   LOOKBACK_DAYS=30 node scripts/sync-deals-pandadoc.mjs   # last 30 days
 *
 * Cron: every 5 minutes (LOOKBACK_DAYS=30 for efficiency)
 */

import { readFileSync } from 'fs'
import { homedir } from 'os'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import pkg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const { Pool } = pkg

// ─── Credentials ─────────────────────────────────────────────────────────────
const secrets = JSON.parse(readFileSync(homedir() + '/.openclaw/secrets.json', 'utf8'))
const PANDADOC_API_KEY = secrets.PANDADOC_API_KEY
const STRIPE_SECRET_KEY = secrets.STRIPE_SECRET_KEY
const GHL_API_KEY = secrets.GHL_API_KEY
const GHL_LOCATION_ID = secrets.GHL_LOCATION_ID
const NEON_DATABASE_URL = secrets.NEON_DATABASE_URL || secrets.DATABASE_URL

const LOOKBACK_DAYS = parseInt(process.env.LOOKBACK_DAYS || '365', 10)

// ─── DB ───────────────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// ─── Rep Maps ────────────────────────────────────────────────────────────────
// Map GHL user IDs directly to rep names (avoids extra API calls)
const GHL_USER_REP_MAP = {
  'aLNgIwcEWCJdhNm5JnIe': 'Sebastian',  // Sebastian Estrada
  'hlGC7GYOch0y2ErjmJF1': 'JC',         // JC Flores
  'veHn1vMej8ag3oRNSMF7': 'Jesse',      // Jesse Poirier
  'Ipb94f9KRyRNdYIJg9qj': 'Briana',     // Briana Stewart
  'jhz6BcMXfwsEBVCnQ3vE': 'Pia',        // Pia Larson
  'fx0YBhilsXDaK4O3ng5R': 'Stefen',     // Stefen Anderson
  'tM3jUAURD6OiTeSpwFj8': 'Todd',       // Todd Lavictoire
  '34cqmztQM6DkmqKYXSoZ': 'Travis',     // Travis Contreras
  '1TBQm6d9JU6yZJFprhEZ': 'Lex',        // Lex Longobardi
  'UUMCvAlAtwakqEkse8Rl': 'Zu',         // Zu Vuong
  '4u2YFlaKwJzebUb8LiYX': 'Bruce',      // Bruce Spurr
  'koiYssRHAS2LXNeFDdCT': 'Kaci',       // Kaci Hawkins
  'GIP1cF4qorGG9gV7h0qm': 'Zac',        // Zac Alcampo
  'wc8aOT4EzArD5Rmd5mqW': 'Aditya',     // Aditya Mondal
  'DgoxtJsdkIEOecGcXJf5': 'Anom',       // Anom Chakravorty
  'wT0iK7BtilscXoKohOrD': 'Chris',      // Chris Dodson
  'FFs68j3QucIjazVEH4dr': 'Courtney',   // Courtney Lopez
  'EIXICsNEAZ8W7SboWvP0': 'Hakeem',     // Hakeem Warner
  'lada@growyourcenter.com': 'Lada',     // Lada Tikhomirova (fallback)
  'QSjGOA7bWOPcy8IFg3vm': 'Steve',      // Steve McKenna
  'FR2xjVSdRVD3Kr4PRr57': 'Swiss',      // Swiss Chamnian
}

// Normalise rep name from any source (same aliases as sync-sales-deals.mjs)
const REP_ALIASES = {
  'Seb': 'Sebastian',
  'seb': 'Sebastian',
  'Sebastian': 'Sebastian',
  'Sebastian Estrada': 'Sebastian',
  'Zu/Bruce': 'Zu',
  'Zu / Bruce': 'Zu',
  'Zu/Seb': 'Zu',
  'Zu / Seb': 'Zu',
  'zu': 'Zu',
  'Zu Vuong': 'Zu',
  'jesse': 'Jesse',
  'Jesse Poirier': 'Jesse',
  'briana': 'Briana',
  'Briana Stewart': 'Briana',
  'jc': 'JC',
  'JC Flores': 'JC',
  'pia': 'Pia',
  'Pia Larson': 'Pia',
  'stefen': 'Stefen',
  'Stefen Anderson': 'Stefen',
  'todd': 'Todd',
  'Todd Lavictoire': 'Todd',
  'travis': 'Travis',
  'Travis Contreras': 'Travis',
  'lex': 'Lex',
  'Lex Longobardi': 'Lex',
  'kim': 'Kim',
  'matt': 'Matt',
  'Bruce Spurr': 'Bruce',
}

const SALES_REPS  = new Set(['Jesse', 'Pia', 'Briana', 'Matt', 'Lex'])
const UPSELL_REPS = new Set(['JC', 'Zu', 'Stefen', 'Todd', 'Travis', 'Kim'])

function normaliseRep(raw) {
  if (!raw) return 'Unknown'
  const trimmed = raw.trim()
  return REP_ALIASES[trimmed] || REP_ALIASES[trimmed.toLowerCase()] || trimmed
}

function classifyDealType(rep, yearLabel) {
  if (rep === 'Sebastian') return Number(yearLabel) >= 2026 ? 'Upsell' : 'Sales'
  if (SALES_REPS.has(rep))  return 'Sales'
  if (UPSELL_REPS.has(rep)) return 'Upsell'
  return 'Unclassified'
}

// ─── Utility ─────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

function parseMoney(str) {
  if (!str) return 0
  const cleaned = String(str).replace(/[$,\/]/g, '').replace(/[^0-9.]/g, '')
  return parseFloat(cleaned) || 0
}

function extractService(docName) {
  // Handle em dash variant: "[CBG] GYC Master Services — REPUTATION ENGINE - Client"
  // Normalise em dash to regular dash first
  let name = docName.replace(/\s*—\s*/g, ' - ')
  // Strip [CBG] prefix
  name = name.replace(/^\[CBG\]\s*/i, '')
  // Take first part before " - "
  const parts = name.split(' - ')
  return parts[0].trim()
}

function extractClientEmail(recipients) {
  if (!recipients?.length) return null
  // Prefer Role 1 (explicit client signer)
  const role1 = recipients.find(r => r.role === 'Role 1')
  if (role1?.email) return role1.email
  // Fall back: any non-GYC email
  return recipients.find(r => r.email && !r.email.toLowerCase().includes('@growyourcenter.com'))?.email || null
}

function extractClientName(recipients) {
  if (!recipients?.length) return { firstName: null, lastName: null }
  const role1 = recipients.find(r => r.role === 'Role 1')
  const nonGyc = recipients.find(r => r.email && !r.email.toLowerCase().includes('@growyourcenter.com'))
  const r = role1 || nonGyc
  return { firstName: r?.first_name || null, lastName: r?.last_name || null }
}

function getQuarter(monthIndex) {
  if (monthIndex < 3) return 'Q1'
  if (monthIndex < 6) return 'Q2'
  if (monthIndex < 9) return 'Q3'
  return 'Q4'
}

const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December']

// ─── PandaDoc ────────────────────────────────────────────────────────────────
async function fetchAllCompletedDocs() {
  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
  console.log(`📄 Fetching PandaDoc completed docs since ${cutoff.toISOString().split('T')[0]}...`)

  const docs = []
  let page = 1

  while (true) {
    const res = await fetch(
      `https://api.pandadoc.com/public/v1/documents?count=100&page=${page}`,
      { headers: { 'Authorization': 'API-Key ' + PANDADOC_API_KEY } }
    )
    if (!res.ok) {
      console.error(`PandaDoc list error page ${page}: ${res.status}`)
      break
    }
    const data = await res.json()
    const results = data.results || []

    let passedCutoff = false
    for (const doc of results) {
      if (doc.status !== 'document.completed') continue
      if (!doc.date_completed) continue
      const completedAt = new Date(doc.date_completed)
      if (completedAt < cutoff) {
        passedCutoff = true
        continue // still check rest of page (might be out of order)
      }
      docs.push(doc)
    }

    // Stop if page had fewer results than requested (last page)
    // or if every completed doc on this page was past the cutoff
    if (results.length < 100) break
    if (passedCutoff && results.every(d => {
      if (d.status !== 'document.completed' || !d.date_completed) return true
      return new Date(d.date_completed) < cutoff
    })) break

    page++
    await sleep(150) // gentle rate limiting
  }

  console.log(`📋 Found ${docs.length} completed docs within lookback window`)
  return docs
}

async function fetchDocDetails(docId, retries = 4) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(
      `https://api.pandadoc.com/public/v1/documents/${docId}/details`,
      { headers: { 'Authorization': 'API-Key ' + PANDADOC_API_KEY } }
    )
    if (res.status === 429) {
      // Exponential backoff: 20s, 30s, 45s, 60s
      const wait = Math.min(20000 * Math.pow(1.5, attempt - 1), 60000)
      console.warn(`  ⏳ PandaDoc rate-limited, waiting ${Math.round(wait/1000)}s (attempt ${attempt}/${retries})...`)
      await sleep(wait)
      // Extra cooldown after rate limit before next attempt
      if (attempt < retries) await sleep(5000)
      continue
    }
    if (!res.ok) return null
    return res.json()
  }
  return null
}

// ─── Stripe ──────────────────────────────────────────────────────────────────
const stripeCache = {}

async function getStripeMrr(email) {
  if (!email) return { mrr: 0, customerId: null }
  if (stripeCache[email] !== undefined) return stripeCache[email]

  try {
    const custRes = await fetch(
      `https://api.stripe.com/v1/customers?email=${encodeURIComponent(email)}&limit=3`,
      { headers: { 'Authorization': 'Bearer ' + STRIPE_SECRET_KEY } }
    )
    const custData = await custRes.json()
    const cust = custData.data?.[0]
    if (!cust) {
      stripeCache[email] = { mrr: 0, customerId: null }
      return stripeCache[email]
    }

    // Include past_due in case subscription was just created
    let totalMrr = 0
    for (const status of ['active', 'past_due', 'trialing']) {
      const subRes = await fetch(
        `https://api.stripe.com/v1/subscriptions?customer=${cust.id}&status=${status}&limit=10`,
        { headers: { 'Authorization': 'Bearer ' + STRIPE_SECRET_KEY } }
      )
      const subData = await subRes.json()
      for (const sub of subData.data || []) {
        for (const item of sub.items?.data || []) {
          const amount    = item.price?.unit_amount || 0
          const qty       = item.quantity || 1
          const interval  = item.price?.recurring?.interval
          const itemMrr   = interval === 'year'
            ? Math.round(amount * qty / 12 / 100)
            : Math.round(amount * qty / 100)
          totalMrr += itemMrr
        }
      }
      if (totalMrr > 0) break // found active MRR, stop checking other statuses
    }

    stripeCache[email] = { mrr: totalMrr, customerId: cust.id }
    return stripeCache[email]
  } catch (err) {
    console.warn(`  ⚠️ Stripe lookup failed for ${email}: ${err.message}`)
    stripeCache[email] = { mrr: 0, customerId: null }
    return stripeCache[email]
  }
}

// ─── GHL ─────────────────────────────────────────────────────────────────────
const ghlUserCache = {}

async function getGhlRep(email, firstName, lastName) {
  let assignedToId = null

  // 1. Try duplicate-search by email (most reliable)
  if (email) {
    try {
      const res = await fetch(
        `https://services.leadconnectorhq.com/contacts/search/duplicate?locationId=${GHL_LOCATION_ID}&email=${encodeURIComponent(email)}`,
        { headers: { 'Authorization': 'Bearer ' + GHL_API_KEY, 'Version': '2021-07-28' } }
      )
      if (res.ok) {
        const data = await res.json()
        assignedToId = data.contact?.assignedTo || null
      }
    } catch (err) {
      console.warn(`  ⚠️ GHL email lookup failed for ${email}: ${err.message}`)
    }
  }

  // 2. Fall back to name search
  if (!assignedToId && firstName && lastName) {
    try {
      const q = encodeURIComponent(`${firstName} ${lastName}`)
      const res = await fetch(
        `https://services.leadconnectorhq.com/contacts/?locationId=${GHL_LOCATION_ID}&query=${q}`,
        { headers: { 'Authorization': 'Bearer ' + GHL_API_KEY, 'Version': '2021-07-28' } }
      )
      if (res.ok) {
        const data = await res.json()
        assignedToId = data.contacts?.[0]?.assignedTo || null
      }
    } catch (err) {
      console.warn(`  ⚠️ GHL name search failed for ${firstName} ${lastName}: ${err.message}`)
    }
  }

  if (!assignedToId) return 'Unknown'

  // 3. Check hardcoded map first (avoids API call)
  if (GHL_USER_REP_MAP[assignedToId]) {
    return normaliseRep(GHL_USER_REP_MAP[assignedToId])
  }

  // 4. Fetch user from GHL API
  if (ghlUserCache[assignedToId]) return ghlUserCache[assignedToId]
  try {
    const res = await fetch(
      `https://services.leadconnectorhq.com/users/${assignedToId}`,
      { headers: { 'Authorization': 'Bearer ' + GHL_API_KEY, 'Version': '2021-07-28' } }
    )
    if (res.ok) {
      const user = await res.json()
      const name = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown'
      const rep = normaliseRep(name)
      ghlUserCache[assignedToId] = rep
      return rep
    }
  } catch (err) {
    console.warn(`  ⚠️ GHL user lookup failed for ${assignedToId}: ${err.message}`)
  }

  ghlUserCache[assignedToId] = 'Unknown'
  return 'Unknown'
}

// ─── Process single doc ───────────────────────────────────────────────────────
async function processDoc(doc) {
  const detail = await fetchDocDetails(doc.id)
  if (!detail) {
    console.warn(`  ⚠️ Could not fetch details for doc ${doc.id} (${doc.name?.slice(0, 50)})`)
    return null
  }

  // Parse tokens
  const tokenMap = {}
  for (const t of detail.tokens || []) {
    tokenMap[t.name] = t.value
  }

  // Client info — Center Name token, or fall back to extracting from doc name
  // Doc name patterns:
  //   "SERVICE - Center Name" (2 parts)
  //   "SERVICE - Contact Name - Center Name" (3 parts, center = last)
  //   "SERVICE - Mutual Agreement Center Name - Contact Name" (3 parts, center = middle)
  function extractClientNameFromDoc(name) {
    const parts = name.replace(/\s*—\s*/g, ' - ').replace(/^\[CBG\]\s*/i, '').split(' - ')
    if (parts.length >= 3) {
      // Last part tends to be center name for most templates
      const lastPart = parts[parts.length - 1].trim()
      const midPart  = parts[1].trim()
      // If last part looks like a person name (First Last, 2 words, both capitalised) use middle
      const looksLikePerson = /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(lastPart)
      return looksLikePerson ? midPart : lastPart
    }
    if (parts.length === 2) return parts[1].trim()
    return ''
  }
  const clientName  = tokenMap['Center Name'] || extractClientNameFromDoc(doc.name || '') || ''
  const firstName   = tokenMap['Client First Name'] || extractClientName(detail.recipients).firstName || ''
  const lastName    = tokenMap['Client Last Name']  || extractClientName(detail.recipients).lastName  || ''
  const clientEmail = extractClientEmail(detail.recipients)

  // Service (from doc name — everything before first " - ")
  const service = extractService(doc.name || '')

  // Dates
  const dateCompleted = doc.date_completed ? new Date(doc.date_completed) : null
  if (!dateCompleted) return null

  const dealDate  = dateCompleted.toISOString().split('T')[0]
  const year      = dateCompleted.getFullYear()
  const yearLabel = String(year)
  const month     = MONTH_NAMES[dateCompleted.getMonth()]
  const quarter   = getQuarter(dateCompleted.getMonth())

  // Pricing — from PandaDoc tokens
  const coreMonthlyRaw  = tokenMap['Core - Standard Monthly Rate']   || ''
  const growthMonthlyRaw = tokenMap['Growth - Standard Monthly Rate'] || ''
  const pifRaw          = tokenMap['Core - PIF']                     || ''

  const pif       = !!pifRaw && pifRaw.toString().trim() !== ''
  const pifAmount = pif ? parseMoney(pifRaw) : 0

  // MRR: prefer PandaDoc token, fall back to Stripe
  let mrr = parseMoney(coreMonthlyRaw) || parseMoney(growthMonthlyRaw)
  let stripeCustomerId = null

  const { mrr: stripeMrr, customerId } = await getStripeMrr(clientEmail)
  stripeCustomerId = customerId

  // Use Stripe MRR only as fallback when PandaDoc token MRR is 0
  if (mrr === 0 && stripeMrr > 0) {
    mrr = stripeMrr
  }

  // Rep attribution from GHL
  const rawRep = await getGhlRep(clientEmail, firstName, lastName)
  const rep    = normaliseRep(rawRep)

  // Computed fields
  const term = pif && mrr > 0
    ? Math.round(pifAmount / mrr)
    : 0

  const fullTerm      = pif ? mrr * term : 0
  const firstPayment  = pif ? pifAmount  : mrr
  const renewalAmount = mrr
  const dealType      = classifyDealType(rep, yearLabel)

  // firstYear (same formula as Google Sheets: fullTerm + remaining months' MRR if monthly, or fullTerm if PIF)
  const firstYear = pif ? fullTerm : mrr * 12

  return {
    tenantId: 'gyc',
    sourceSystem: 'pandadoc',
    yearLabel,
    dealDate,
    clientName,
    service,
    quarter,
    month,
    firstPayment,
    mrr,
    term,
    fullTerm,
    firstYear,
    pif,
    renewalAmount,
    rep,
    dealType,
    // metadata
    pandaDocId: doc.id,
    clientEmail,
    stripeCustomerId,
  }
}

// ─── Upsert ───────────────────────────────────────────────────────────────────
async function upsertDeal(client, d) {
  const res = await client.query(
    `INSERT INTO "SalesDeal"
       ("tenantId","sourceSystem","yearLabel","dealDate","clientName",service,quarter,month,
        "firstPayment",mrr,term,"fullTerm","firstYear",pif,"renewalAmount",rep,"dealType","syncedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,now())
     ON CONFLICT ("yearLabel","dealDate","clientName",service,rep)
     DO UPDATE SET
       "sourceSystem"   = EXCLUDED."sourceSystem",
       "firstPayment"   = EXCLUDED."firstPayment",
       mrr              = EXCLUDED.mrr,
       term             = EXCLUDED.term,
       "fullTerm"       = EXCLUDED."fullTerm",
       "firstYear"      = EXCLUDED."firstYear",
       pif              = EXCLUDED.pif,
       "renewalAmount"  = EXCLUDED."renewalAmount",
       "dealType"       = EXCLUDED."dealType",
       "syncedAt"       = now()
       -- NOTE: dealOutcome, pifOverride, termOverride, lastEditedAt, editedBy are intentionally
       -- EXCLUDED from this update list. They are manual overrides set via /api/deals/closed/edit
       -- and must NEVER be overwritten by PandaDoc sync.
     RETURNING xmax`,
    [
      d.tenantId,
      d.sourceSystem,
      d.yearLabel,
      d.dealDate,
      d.clientName,
      d.service,
      d.quarter,
      d.month,
      d.firstPayment,
      d.mrr,
      d.term,
      d.fullTerm,
      d.firstYear,
      d.pif,
      d.renewalAmount,
      d.rep,
      d.dealType,
    ]
  )
  // xmax = 0 → insert; xmax != 0 → update
  const wasInsert = res.rows[0]?.xmax === '0'
  return wasInsert ? 'inserted' : 'updated'
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  const startTime = Date.now()
  console.log(`\n🔄 sync-deals-pandadoc: starting (LOOKBACK_DAYS=${LOOKBACK_DAYS})...`)

  // 1. Fetch all completed docs
  const docs = await fetchAllCompletedDocs()

  if (docs.length === 0) {
    console.log('ℹ️  No completed docs found in lookback window. Nothing to sync.')
    await pool.end()
    return { inserted: 0, updated: 0, skipped: 0 }
  }

  // 2. Process each doc (fetch details + enrich)
  const deals = []
  let detailErrors = 0

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i]
    process.stdout.write(`  [${i + 1}/${docs.length}] ${doc.name?.slice(0, 60)}...`)
    try {
      const deal = await processDoc(doc)
      if (deal) {
        deals.push(deal)
        process.stdout.write(` ✓ ${deal.clientName} | $${deal.mrr}/mo | rep: ${deal.rep}\n`)
      } else {
        process.stdout.write(` ⚠️ skipped (missing data)\n`)
        detailErrors++
      }
    } catch (err) {
      process.stdout.write(` ❌ error: ${err.message}\n`)
      detailErrors++
    }
    // Rate limiting between detail calls — 500ms = 2 req/s keeps us under PandaDoc limits
    if (i < docs.length - 1) await sleep(500)
  }

  console.log(`\n📊 Processed ${deals.length} deals (${detailErrors} errors)`)

  // 3. Upsert all deals into DB
  const dbClient = await pool.connect()
  let inserted = 0, updated = 0, skipped = 0

  try {
    await dbClient.query('BEGIN')

    for (const deal of deals) {
      try {
        const action = await upsertDeal(dbClient, deal)
        if (action === 'inserted') inserted++
        else updated++
      } catch (err) {
        console.error(`  ❌ DB error for ${deal.clientName}: ${err.message}`)
        skipped++
      }
    }

    await dbClient.query('COMMIT')
    console.log(`✅ DB upsert complete: ${inserted} inserted, ${updated} updated, ${skipped} skipped`)

    // 4. Write SyncLog
    await dbClient.query(
      `INSERT INTO "SyncLog" (source, status, message, "syncedAt", "organizationId")
       VALUES ($1, $2, $3, now(), $4)`,
      [
        'sales-deals-pandadoc',
        'success',
        `inserted=${inserted} updated=${updated} skipped=${skipped} detailErrors=${detailErrors}`,
        'default',
      ]
    )
    console.log('📝 SyncLog entry written')

    // 5. Write AgentAuditLog
    const durationMs = Date.now() - startTime
    try {
      await dbClient.query(
        `INSERT INTO "AgentAuditLog"
           ("tenantId","agentId","agentName","action","target","summary","status","durationMs","recordsAffected")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          'gyc',
          'main',
          'Wall·E',
          'sync',
          'SalesDeal',
          `pandadoc: inserted=${inserted} updated=${updated} skipped=${skipped}`,
          'ok',
          durationMs,
          inserted + updated,
        ]
      )
      console.log('🔒 AgentAuditLog entry written')
    } catch (auditErr) {
      console.error(`[agent-audit] Failed to log: ${auditErr.message}`)
    }
  } catch (err) {
    await dbClient.query('ROLLBACK')
    console.error('❌ Sync failed:', err.message)

    try {
      await dbClient.query(
        `INSERT INTO "SyncLog" (source, status, message, "syncedAt", "organizationId")
         VALUES ($1, $2, $3, now(), $4)`,
        ['sales-deals-pandadoc', 'error', err.message, 'default']
      )
    } catch (_) {}

    throw err
  } finally {
    dbClient.release()
    await pool.end()
  }

  return { inserted, updated, skipped }
}

// ─── Entry Point ──────────────────────────────────────────────────────────────
run()
  .then(({ inserted, updated, skipped }) => {
    console.log(`\n🏁 Done. Inserted: ${inserted} | Updated: ${updated} | Skipped: ${skipped}`)
    process.exit(0)
  })
  .catch(err => {
    console.error('Fatal:', err)
    process.exit(1)
  })
