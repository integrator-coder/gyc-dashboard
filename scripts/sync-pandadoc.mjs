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
 * - Batch detail calls with small delays to avoid 429s
 * - Upsert into AgreementsSnapshot by docId (one row per doc, updated each sync)
 */

import pg from 'pg'
import { readFileSync } from 'fs'
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

const pool = new pg.Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
const BASE_URL = 'https://api.pandadoc.com/public/v1'
const HEADERS = { Authorization: `API-Key ${PANDADOC_API_KEY}`, 'Content-Type': 'application/json' }

const SENT_STATUSES = new Set(['document.sent','document.viewed','document.waiting_approval','document.approved','document.waiting_pay'])
const SIGNED_STATUSES = new Set(['document.completed','document.paid'])
const ACTIVE_STATUSES = new Set([...SENT_STATUSES, ...SIGNED_STATUSES])
const DAYS_BACK = 90

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function fetchWithRetry(url, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, { headers: HEADERS })
    if (res.status === 429) {
      const wait = Math.min(parseInt(res.headers.get('Retry-After') || '10', 10) * 1000, 30000)
      console.log(`  Rate limited, waiting ${wait / 1000}s...`)
      await sleep(wait)
      continue
    }
    return res
  }
  throw new Error(`Failed after ${maxRetries} retries: ${url}`)
}

async function fetchAllDocuments() {
  const all = []
  let page = 1
  while (page <= 20) {
    const res = await fetchWithRetry(`${BASE_URL}/documents?count=100&page=${page}&order_by=-date_created`)
    if (!res.ok) throw new Error(`List error ${res.status}: ${await res.text()}`)
    const json = await res.json()
    const results = json.results || []
    all.push(...results)
    // Stop paging once we hit docs older than DAYS_BACK
    const oldest = results[results.length - 1]
    if (oldest && new Date(oldest.date_created) < new Date(Date.now() - DAYS_BACK * 86400000)) break
    if (results.length < 100) break
    page++
  }
  return all
}

async function fetchDetail(docId) {
  try {
    const res = await fetchWithRetry(`${BASE_URL}/documents/${docId}/details`)
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

/**
 * Parse a token value that may be:
 *   - Simple:       "$3,999"
 *   - With note:    "$4,985 (one month free)"
 *   - Multi-loc:    "1st Location: $14,990  2nd Location:$12,990  Total: $27,980"
 *   - Multi-loc MRR: "1st Location: $1,499   2nd Location: $1,299"
 *
 * For PIF: prefer the "Total:" figure if present, otherwise sum all $ values.
 * For MRR: sum all $ values (each location's monthly rate).
 */
function parseTokenValue(raw, mode = 'pif') {
  if (!raw) return null
  const str = String(raw)

  // If there's a "Total:" label, use that value
  if (mode === 'pif') {
    const totalMatch = str.match(/total[:\s]+\$([\d,]+)/i)
    if (totalMatch) {
      const val = parseFloat(totalMatch[1].replace(/,/g, ''))
      if (!isNaN(val) && val > 0) return val
    }
  }

  // Extract ALL dollar amounts from the string
  const allAmounts = [...str.matchAll(/\$([\d,]+(?:\.\d{1,2})?)/g)]
    .map(m => parseFloat(m[1].replace(/,/g, '')))
    .filter(v => !isNaN(v) && v > 0)

  if (allAmounts.length === 0) return null

  // For MRR: sum all location rates
  // For PIF: if multiple amounts and no Total label, sum them
  if (mode === 'mrr' || allAmounts.length > 1) {
    return allAmounts.reduce((a, b) => a + b, 0)
  }

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

async function run() {
  const startTime = Date.now()
  const cutoff = new Date(Date.now() - DAYS_BACK * 86400000)
  console.log(`[sync-pandadoc] Starting — pulling docs since ${cutoff.toISOString().slice(0,10)}`)

  const allDocs = await fetchAllDocuments()
  const recentActive = allDocs.filter(d =>
    ACTIVE_STATUSES.has(d.status) && new Date(d.date_created) >= cutoff
  )
  console.log(`[sync-pandadoc] ${allDocs.length} total docs, ${recentActive.length} active in last ${DAYS_BACK} days`)

  // Fetch details one at a time with 2s delay — PandaDoc WAF blocks bursts
  const details = {}
  for (let i = 0; i < recentActive.length; i++) {
    const doc = recentActive[i]
    const detail = await fetchDetail(doc.id)
    if (detail) details[doc.id] = detail
    process.stdout.write(`\r  Details: ${i + 1}/${recentActive.length}`)
    if (i + 1 < recentActive.length) await sleep(2000)
  }
  console.log()

  const client = await pool.connect()
  try {
    await ensureTable(client)
    await client.query('BEGIN')

    let upserted = 0
    const syncedAt = new Date().toISOString()

    for (const doc of recentActive) {
      const detail = details[doc.id] || null
      const sentStatus = SIGNED_STATUSES.has(doc.status) ? 'signed' : 'sent'

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
      upserted++
    }

    await client.query('COMMIT')
    console.log(`[sync-pandadoc] Upserted ${upserted} docs in ${((Date.now() - startTime) / 1000).toFixed(1)}s`)
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(e => {
  console.error('[sync-pandadoc] ERROR:', e.message)
  process.exit(1)
})
