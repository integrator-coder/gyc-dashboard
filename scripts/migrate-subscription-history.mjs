/**
 * scripts/migrate-subscription-history.mjs
 *
 * Creates StripeSubscriptionHistory and MRRHistory tables.
 */
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
}

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

async function main() {
  const client = await pool.connect()
  try {
    console.log('🔧 Creating StripeSubscriptionHistory table...')
    await client.query(`
      CREATE TABLE IF NOT EXISTS "StripeSubscriptionHistory" (
        "id" TEXT PRIMARY KEY,
        "tenantId" TEXT NOT NULL DEFAULT 'gyc',
        "customerId" TEXT NOT NULL,
        "subscriptionId" TEXT NOT NULL,
        "productId" TEXT,
        "productName" TEXT,
        "productCategory" TEXT,
        "priceId" TEXT,
        "amount" DECIMAL(10,2),
        "currency" TEXT DEFAULT 'usd',
        "interval" TEXT,
        "status" TEXT,
        "startDate" TIMESTAMP,
        "canceledAt" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "syncedAt" TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('✅ StripeSubscriptionHistory created')

    await client.query(`CREATE INDEX IF NOT EXISTS "SSH_tenantId_idx" ON "StripeSubscriptionHistory" ("tenantId")`)
    await client.query(`CREATE INDEX IF NOT EXISTS "SSH_customerId_idx" ON "StripeSubscriptionHistory" ("customerId")`)
    await client.query(`CREATE INDEX IF NOT EXISTS "SSH_productCategory_idx" ON "StripeSubscriptionHistory" ("productCategory")`)
    await client.query(`CREATE INDEX IF NOT EXISTS "SSH_startDate_idx" ON "StripeSubscriptionHistory" ("startDate")`)
    await client.query(`CREATE INDEX IF NOT EXISTS "SSH_status_idx" ON "StripeSubscriptionHistory" ("status")`)
    console.log('✅ Indexes created')

    console.log('🔧 Creating MRRHistory table...')
    await client.query(`
      CREATE TABLE IF NOT EXISTS "MRRHistory" (
        "id" SERIAL PRIMARY KEY,
        "tenantId" TEXT NOT NULL DEFAULT 'gyc',
        "month" TEXT NOT NULL,
        "mrr" DECIMAL(12,2),
        "newMrr" DECIMAL(12,2),
        "churnedMrr" DECIMAL(12,2),
        "expansionMrr" DECIMAL(12,2),
        "activeSubscriptions" INT,
        "syncedAt" TIMESTAMP DEFAULT NOW(),
        UNIQUE("tenantId", "month")
      )
    `)
    console.log('✅ MRRHistory created')

    // Verify
    const res = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('StripeSubscriptionHistory', 'MRRHistory')
    `)
    console.log('📋 Tables confirmed:', res.rows.map(r => r.table_name).join(', '))
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
