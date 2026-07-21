#!/usr/bin/env node
/**
 * sync-pandadoc.mjs
 * Pulls PandaDoc documents + details for the last 90 days and writes to AgreementsSnapshot.
 * Run by cron every 3 hours.
 *
 * Strategy:
 * - Fetch full doc list (fast, no rate limit issues)
 * - Filter to docs created in last 90 days
 * - Fetch details only for those (amounts live in tokens)
 * - Checkpoint-based: saves progress after each upsert; resumes across runs
 * - MAX_DOCS_PER_RUN (default 50) caps each invocation so runs finish cleanly
 * - Exponential backoff on 429s; skip after 4 retries per doc
 */

import pg from 'pg'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnv() {
  const envPath = resolve(__dirname, '../.env.local')
  try {
    const lines = readFileSync(envPath, 'utf8').split('\n')
    for (const line of lines) {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) process.env[m[1].trim()] = m[2].trim()
    }
  } catch {}
}
loadEnv()

const DB_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL
const PANDADOC_API_KEY = process.env.PANDADOC_API_KEY

if (!DB_URL) { console.error('No DATABASE_URL'); process.exit(1) }
if (!PANDADOC_API_KEY) { console.error('No PANDADOC_API_KEY'); process.exit(1) }

const MAX_DOCS_PER_RUN = parseInt(process.env.MAX_DOCS_PER_RUN || '100', 10)
const RUN_BUDGET_MS = parseInt(process.env.RUN_BUDGET_MS || String(8 * 60 * 1000), 10) // exit before SIGTERM
const CHECKPOINT_FILE = '/tmp/pandadoc-sync-checkpoint.json'

const pool = new pg.Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
const BASE_URL = 'https://api.pandadoc.com/public/v1'
const HEADERS = { Authorization: `API-Key ${PANDADOC_API_KEY}`, 'Content-Type': 'application/json' }

const SENT_STATUSES = new Set(['document.sent','document.viewed','document.waiting_approval','document.approved','document.waiting_pay'])
const SIGNED_STATUSES = new Set(['document.completed','document.paid'])
const EXPIRED_STATUSES = new Set(['document.expired'])
const ACTIVE_STATUSES = new Set([...SENT_STATUSES, ...SIGNED_STATUSES, ...EXPIRED_STATUSES])
const DAYS_BACK = 9999 // pull all-time history

// ── Checkpoint helpers ────────────────────────────────────────────────────────

function loadCheckpoint() {
  try {
    if (existsSync(CHECKPOINT_FILE)) {
      const raw = readFileSync(CHECKPOINT_FILE, 'utf8')
      const cp = JSON.parse(raw)
      console.log(`[sync-pandadoc] Checkpoint loaded: ${cp.processedIds?.length || 0} docs already processed, last run ${cp.lastRunAt}`)
      return cp
    }
  } catch (e) {
    console.log(`[sync-pandadoc] Checkpoint read error (starting fresh): ${e.message}`)
  }
  return { processedIds: [], lastRunAt: null }
}

function saveCheckpoint(checkpoint) {
  try {
    writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2), 'utf8')
  } catch (e) {
    console.error(`[sync-pandadoc] Checkpoint write error: ${e.message}`)
  }
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────

let currentCheckpoint = null
let shuttingDown = false

function handleShutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`\n[sync-pandadoc] ${signal} received — saving checkpoint and exiting`)
  if (currentCheckpoint) {
    currentCheckpoint.lastRunAt = new Date().toISOString()
    saveCheckpoint(currentCheckpoint)
    console.log(`[sync-pandadoc] Checkpoint saved with ${currentCheckpoint.processedIds.length} processed docs`)
  }
  pool.end().then(() => process.exit(0)).catch(() => process.exit(0))
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'))
process.on('SIGINT', () => handleShutdown('SIGINT'))

// ── Sleep / backoff ───────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

const BACKOFF_DELAYS = [3000, 8000, 20000, 45000] // 4 retry attempts — trimmed to avoid timeout

async function fetchWithBackoff(url, maxRetries = 4) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (shuttingDown) return null
    const res = await fetch(url, { headers: HEADERS })
    if (res.status === 429) {
      if (attempt >= maxRetries) {
        console.log(`  Rate limited on attempt ${attempt + 1} — giving up on this doc`)
        return null
      }
      const retryAfter = parseInt(res.headers.get('Retry-After') || '0', 10) * 1000
      const backoff = retryAfter > 0 ? retryAfter : BACKOFF_DELAYS[attempt] || 60000
      console.log(`  Rate limited (attempt ${attempt + 1}/${maxRetries}), waiting ${backoff / 1000}s...`)
      await sleep(backoff)
      continue
    }
    return res
  }
  return null
}

// ── PandaDoc API calls ────────────────────────────────────────────────────────

async function fetchAllDocuments() {
  const all = []
  let page = 1
  while (page <= 20) {
    const res = await fetchWithBackoff(`${BASE_URL}/documents?count=100&page=${page}&order_by=-date_created`)
    if (!res || !res.ok) throw new Error(`List error ${res?.status}: ${await res?.text()}`)
    const json = await res.json()
    const results = json.results || []
    all.push(...results)
    if (results.length < 100) break
    page++
  }
  return all
}

async function fetchDetail(docId) {
  try {
    const res = await fetchWithBackoff(`${BASE_URL}/documents/${docId}/details`)
    if (!res || !res.ok) return null
    return res.json()
  } catch { return null }
}

// ── Token / field parsers ─────────────────────────────────────────────────────

function parseTokenValue(raw, mode = 'pif') {
  if (!raw) return null
  const str = String(raw)
  if (mode === 'pif') {
    const totalMatch = str.match(/total[:\s]+\$([\d,]+)/i)
    if (totalMatch) {
      const val = parseFloat(totalMatch[1].replace(/,/g, ''))
      if (!isNaN(val) && val > 0) return val
    }
  }
  const allAmounts = [...str.matchAll(/\$([\d,]+(?:\.\d{1,2})?)/g)]
    .map(m => parseFloat(m[1].replace(/,/g, '')))
    .filter(v => !isNaN(v) && v > 0)
  if (allAmounts.length === 0) return null
  if (mode === 'mrr' || allAmounts.length > 1) return allAmounts.reduce((a, b) => a + b, 0)
  return allAmounts[0]
}

function extractAmount(detail) {
  if (!detail) return null
  const PIF_KEYS = /pay.?in.?full|\bpif\b|contract.?value|total.?value|deal.?value/i
  if (Array.isArray(detail.tokens)) {
    for (const t of detail.tokens) {
      if (PIF_KEYS.test(t.name || '')) {
        const val = parseTokenValue(t.value, 'pif')
        if (val !== null) return val
      }
    }
  }
  if (detail.grand_total?.amount) {
    const val = parseFloat(detail.grand_total.amount)
    if (!isNaN(val) && val > 0) return val
  }
  return null
}

function extractMrr(detail) {
  if (!detail) return null
  const MRR_KEYS = /monthly.?financ|monthly.?rate|monthly.?amount|monthly.?fee|\bmrr\b|recurring/i
  if (Array.isArray(detail.tokens)) {
    for (const t of detail.tokens) {
      if (MRR_KEYS.test(t.name || '')) {
        const val = parseTokenValue(t.value, 'mrr')
        if (val !== null) return val
      }
    }
  }
  return null
}

function extractRecipients(detail, doc) {
  const src = detail?.recipients || doc?.recipients || []
  return src.map(r => r.email || r.shared_link).filter(Boolean)
}

function extractTokenMap(detail) {
  if (!detail?.tokens) return {}
  const map = {}
  for (const t of detail.tokens) { if (t.name) map[t.name] = t.value }
  return map
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async function ensureTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "AgreementsSnapshot" (
      id            BIGSERIAL PRIMARY KEY,
      "syncedAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
      "docId"       TEXT NOT NULL UNIQUE,
      name          TEXT NOT NULL,
      status        TEXT NOT NULL,
      "sentStatus"  TEXT NOT NULL,
      amount        NUMERIC(12,2),
      mrr           NUMERIC(12,2),
      "createdAt"   TIMESTAMPTZ,
      "modifiedAt"  TIMESTAMPTZ,
      "completedAt" TIMESTAMPTZ,
      recipients    TEXT[],
      tokens        JSONB
    );
  `)
  await client.query(`CREATE INDEX IF NOT EXISTS "AS_syncedAt_idx"  ON "AgreementsSnapshot" ("syncedAt" DESC);`)
  await client.query(`CREATE INDEX IF NOT EXISTS "AS_createdAt_idx" ON "AgreementsSnapshot" ("createdAt" DESC);`)
  await client.query(`CREATE INDEX IF NOT EXISTS "AS_status_idx"    ON "AgreementsSnapshot" (status);`)
  await client.query(`CREATE INDEX IF NOT EXISTS "AS_sentStatus_idx" ON "AgreementsSnapshot" ("sentStatus");`)
}

async function upsertDoc(client, doc, detail) {
  const sentStatus = SIGNED_STATUSES.has(doc.status) ? 'signed'
    : EXPIRED_STATUSES.has(doc.status) ? 'expired' : 'sent'
  const syncedAt = new Date().toISOString()

  await client.query(`
    INSERT INTO "AgreementsSnapshot"
      ("syncedAt", "docId", name, status, "sentStatus", amount, mrr,
       "createdAt", "modifiedAt", "completedAt", recipients, tokens)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    ON CONFLICT ("docId") DO UPDATE SET
      "syncedAt"    = EXCLUDED."syncedAt",
      name          = EXCLUDED.name,
      status        = EXCLUDED.status,
      "sentStatus"  = EXCLUDED."sentStatus",
      amount        = EXCLUDED.amount,
      mrr           = EXCLUDED.mrr,
      "modifiedAt"  = EXCLUDED."modifiedAt",
      "completedAt" = EXCLUDED."completedAt",
      recipients    = EXCLUDED.recipients,
      tokens        = EXCLUDED.tokens
  `, [
    syncedAt,
    doc.id,
    doc.name,
    doc.status,
    sentStatus,
    extractAmount(detail),
    extractMrr(detail),
    doc.date_created || null,
    doc.date_modified || null,
    SIGNED_STATUSES.has(doc.status) ? (doc.date_completed || doc.date_modified || null) : null,
    extractRecipients(detail, doc),
    JSON.stringify(extractTokenMap(detail)),
  ])
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  const startTime = Date.now()
  const cutoff = new Date(Date.now() - DAYS_BACK * 86400000)
  console.log(`[sync-pandadoc] Starting — MAX_DOCS_PER_RUN=${MAX_DOCS_PER_RUN}`)

  // Load checkpoint
  const checkpoint = loadCheckpoint()
  currentCheckpoint = checkpoint
  const processedSet = new Set(checkpoint.processedIds || [])

  // Fetch doc list
  const allDocs = await fetchAllDocuments()

  // Also fetch expired docs (PandaDoc excludes them from default list)
  const expiredDocs = []
  try {
    let page = 1
    while (page <= 5) {
      const res = await fetchWithBackoff(`${BASE_URL}/documents?count=100&page=${page}&status=document.expired&order_by=-date_created`)
      const data = await res.json()
      const docs = data.results || data.data || []
      if (!docs.length) break
      expiredDocs.push(...docs)
      if (docs.length < 100) break
      page++
    }
    console.log(`[sync-pandadoc] ${expiredDocs.length} expired docs fetched`)
  } catch(e) { console.log('[sync-pandadoc] expired fetch error:', e.message) }

  const allDocsWithExpired = [...allDocs, ...expiredDocs.filter(d => !allDocs.find(a => a.id === d.id))]
  const recentActive = allDocsWithExpired.filter(d =>
    (ACTIVE_STATUSES.has(d.status) || EXPIRED_STATUSES.has(d.status)) && new Date(d.date_created) >= cutoff
  )

  // Docs not yet processed
  const remaining = recentActive.filter(d => !processedSet.has(d.id))
  const thisBatch = remaining.slice(0, MAX_DOCS_PER_RUN)

  console.log(`[sync-pandadoc] ${recentActive.length} total active docs | ${processedSet.size} already processed | ${remaining.length} remaining | processing ${thisBatch.length} this run`)

  if (thisBatch.length === 0) {
    console.log('[sync-pandadoc] All docs processed! Clearing checkpoint.')
    // Reset checkpoint so next run starts fresh (picks up any new/changed docs)
    saveCheckpoint({ processedIds: [], lastRunAt: new Date().toISOString(), resetAt: new Date().toISOString() })
    await pool.end()
    return
  }

  const client = await pool.connect()
  try {
    await ensureTable(client)

    let upserted = 0
    let skipped = 0

    for (let i = 0; i < thisBatch.length; i++) {
      if (shuttingDown) break

      const doc = thisBatch[i]
      process.stdout.write(`\r  [${i + 1}/${thisBatch.length}] Fetching ${doc.id.slice(0, 8)}...`)

      const detail = await fetchDetail(doc.id)

      if (shuttingDown) break

      if (detail === null) {
        // Rate limited after all retries, or error — skip this doc for now
        skipped++
        process.stdout.write(` skipped\n`)
        continue
      }

      try {
        await upsertDoc(client, doc, detail)
        upserted++

        // Mark as processed and save checkpoint immediately
        processedSet.add(doc.id)
        checkpoint.processedIds = [...processedSet]
        checkpoint.lastDocIndex = (processedSet.size)
        checkpoint.lastRunAt = new Date().toISOString()
        saveCheckpoint(checkpoint)
      } catch (e) {
        console.error(`\n  Upsert error for ${doc.id}: ${e.message}`)
        skipped++
      }

      // Small delay between docs to avoid WAF blocks
      if (i + 1 < thisBatch.length && !shuttingDown) await sleep(500)

      // Time budget guard — exit cleanly before SIGTERM
      if (Date.now() - startTime > RUN_BUDGET_MS) {
        console.log(`\n[sync-pandadoc] Time budget reached (${(RUN_BUDGET_MS/60000).toFixed(1)}min) — saving checkpoint and exiting cleanly`)
        break
      }
    }

    console.log(`\n[sync-pandadoc] Done: ${upserted} upserted, ${skipped} skipped in ${((Date.now() - startTime) / 1000).toFixed(1)}s`)
    console.log(`[sync-pandadoc] Progress: ${processedSet.size}/${recentActive.length} total docs processed`)

    if (remaining.length > thisBatch.length) {
      console.log(`[sync-pandadoc] ${remaining.length - thisBatch.length} docs remain — checkpoint saved, next run will continue`)
    }
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(e => {
  console.error('[sync-pandadoc] ERROR:', e.message)
  process.exit(1)
})
