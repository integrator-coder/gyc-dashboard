/**
 * scripts/backfill-subscription-history.mjs
 *
 * Pulls ALL subscriptions (active + canceled) from Stripe and upserts
 * into StripeSubscriptionHistory table.
 *
 * - Paginates through ALL statuses
 * - Classifies products into categories
 * - Checkpoint at /tmp/subscription-backfill-checkpoint.json
 * - Max 50 subscriptions per run (increase with --all flag)
 */

import Stripe from 'stripe'
import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(__dirname, '../.env.local')
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
  console.log('✅ Loaded .env.local')
}

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY
const DATABASE_URL = process.env.DATABASE_URL
if (!STRIPE_KEY) throw new Error('Missing STRIPE_SECRET_KEY')
if (!DATABASE_URL) throw new Error('Missing DATABASE_URL')

const stripe = new Stripe(STRIPE_KEY)
const { Pool } = pg
const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })

const CHECKPOINT_FILE = '/tmp/subscription-backfill-checkpoint.json'
const TENANT_ID = 'gyc'
const RUN_ALL = process.argv.includes('--all')
const MAX_SUBS = RUN_ALL ? Infinity : 50

// ── Product categorization ────────────────────────────────────────────────────
function categorize(name) {
  if (!name) return 'other'
  const n = name.toLowerCase()
  if (n.includes('seo')) return 'seo'
  if (n.includes('blueprint')) return 'blueprint'
  if (n.includes('crm') || n.includes('crmboost')) return 'crm'
  if (n.includes('paid media') || n.includes('google ads') || n.includes('boss mode')) return 'paid_media'
  if (n.includes('website') || n.includes('web')) return 'website'
  if (n.includes('command') || n.includes('master') || n.includes('s3') || n.includes('accelerator')) return 'legacy'
  if (n.includes('setup') || n.includes('location fee') || n.includes('onboarding')) return 'fee'
  return 'other'
}

// ── Checkpoint helpers ────────────────────────────────────────────────────────
function loadCheckpoint() {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    try { return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8')) } catch {}
  }
  return { processedIds: [], lastCursor: null, totalProcessed: 0, lastUpdated: null }
}

function saveCheckpoint(cp) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(cp, null, 2))
}

// ── DB upsert ─────────────────────────────────────────────────────────────────
async function upsertSubscriptionItems(items) {
  if (!items.length) return 0
  const client = await pool.connect()
  try {
    let count = 0
    for (const item of items) {
      await client.query(`
        INSERT INTO "StripeSubscriptionHistory" (
          "id", "tenantId", "customerId", "subscriptionId",
          "productId", "productName", "productCategory",
          "priceId", "amount", "currency", "interval",
          "status", "startDate", "canceledAt", "syncedAt"
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
        ON CONFLICT ("id") DO UPDATE SET
          "status" = EXCLUDED."status",
          "canceledAt" = EXCLUDED."canceledAt",
          "syncedAt" = NOW()
      `, [
        item.id, TENANT_ID, item.customerId, item.subscriptionId,
        item.productId, item.productName, item.productCategory,
        item.priceId, item.amount, item.currency, item.interval,
        item.status, item.startDate, item.canceledAt
      ])
      count++
    }
    return count
  } finally {
    client.release()
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 Starting subscription history backfill')
  console.log(`   Max per run: ${RUN_ALL ? 'unlimited (--all)' : MAX_SUBS}`)
  console.log(`   Checkpoint: ${CHECKPOINT_FILE}\n`)

  const cp = loadCheckpoint()
  const processedIds = new Set(cp.processedIds || [])
  let cursor = cp.lastCursor || null
  let totalThisRun = 0
  let totalUpserted = 0

  console.log(`📂 Already processed: ${processedIds.size} subscriptions`)
  if (cursor) console.log(`📍 Resuming from cursor: ${cursor}`)

  // Product cache to avoid repeated lookups
  const productCache = new Map()

  async function getProduct(productId) {
    if (!productId) return null
    if (productCache.has(productId)) return productCache.get(productId)
    try {
      const p = await stripe.products.retrieve(productId)
      productCache.set(productId, p)
      return p
    } catch { return null }
  }

  // Paginate through ALL subscriptions
  outerLoop: while (true) {
    const params = { limit: 100, expand: ['data.items'] }
    if (cursor) params.starting_after = cursor

    let page
    try {
      page = await stripe.subscriptions.list(params)
    } catch (err) {
      console.error('❌ Stripe API error:', err.message)
      break
    }

    if (!page.data.length) break

    for (const sub of page.data) {
      if (processedIds.has(sub.id)) {
        process.stdout.write(`  ⏭  ${sub.id} (skip)\r`)
        continue
      }

      const items = []
      for (const lineItem of sub.items.data) {
        const price = lineItem.price
        let productName = 'Unknown'
        let productId = null

        if (price?.product) {
          if (typeof price.product === 'string') {
            const p = await getProduct(price.product)
            productName = p?.name || 'Unknown'
            productId = price.product
          } else {
            productName = price.product.name || 'Unknown'
            productId = price.product.id
          }
        }

        const category = categorize(productName)
        const amountCents = price?.unit_amount || 0
        const amount = amountCents / 100

        items.push({
          id: `${sub.id}_${lineItem.id}`,
          customerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
          subscriptionId: sub.id,
          productId,
          productName,
          productCategory: category,
          priceId: price?.id,
          amount,
          currency: price?.currency || 'usd',
          interval: price?.recurring?.interval || null,
          status: sub.status,
          startDate: sub.start_date ? new Date(sub.start_date * 1000).toISOString() : null,
          canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
        })
      }

      const upserted = await upsertSubscriptionItems(items)
      totalUpserted += upserted
      processedIds.add(sub.id)
      totalThisRun++

      process.stdout.write(`  ✅ [${totalThisRun}] ${sub.id} → ${items.length} items (${items.map(i => i.productCategory).join(',')})          \n`)

      // Save checkpoint periodically
      if (totalThisRun % 10 === 0) {
        cp.processedIds = [...processedIds]
        cp.lastCursor = sub.id
        cp.totalProcessed = (cp.totalProcessed || 0) + totalThisRun
        cp.lastUpdated = new Date().toISOString()
        saveCheckpoint(cp)
      }

      if (totalThisRun >= MAX_SUBS) {
        cursor = sub.id
        console.log(`\n⏸  Reached ${MAX_SUBS} subscription limit. Run again to continue (cursor saved).`)
        break outerLoop
      }
    }

    if (!page.has_more) break
    cursor = page.data[page.data.length - 1].id
  }

  // Final checkpoint save
  cp.processedIds = [...processedIds]
  cp.lastCursor = cursor
  cp.totalProcessed = processedIds.size
  cp.lastUpdated = new Date().toISOString()
  saveCheckpoint(cp)

  console.log('\n─────────────────────────────────────────')
  console.log(`✅ Run complete`)
  console.log(`   Processed this run:  ${totalThisRun}`)
  console.log(`   Total rows upserted: ${totalUpserted}`)
  console.log(`   Total processed all: ${processedIds.size}`)

  // DB summary
  const dbClient = await pool.connect()
  try {
    const { rows } = await dbClient.query(`
      SELECT 
        "productCategory",
        COUNT(*) AS cnt,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_cnt,
        SUM(CASE WHEN "canceledAt" IS NOT NULL THEN 1 ELSE 0 END) AS canceled_cnt
      FROM "StripeSubscriptionHistory"
      WHERE "tenantId" = $1
      GROUP BY 1 ORDER BY cnt DESC
    `, [TENANT_ID])

    console.log('\n📊 DB Summary by category:')
    console.log('  Category      | Total | Active | Canceled')
    console.log('  --------------|-------|--------|----------')
    for (const r of rows) {
      console.log(`  ${r.productcategory?.padEnd(14)} | ${String(r.cnt).padStart(5)} | ${String(r.active_cnt).padStart(6)} | ${String(r.canceled_cnt).padStart(8)}`)
    }

    const { rows: total } = await dbClient.query(`SELECT COUNT(*) FROM "StripeSubscriptionHistory" WHERE "tenantId" = $1`, [TENANT_ID])
    console.log(`\n  Total rows in DB: ${total[0].count}`)
  } finally {
    dbClient.release()
  }

  await pool.end()
  console.log('\n🏁 Done.')
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
