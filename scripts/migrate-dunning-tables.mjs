/**
 * migrate-dunning-tables.mjs
 * Creates DunningHistory and ClientServiceMap tables in Neon.
 * Safe to run multiple times (IF NOT EXISTS).
 */
import pg from 'pg'
import { readFileSync } from 'fs'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { Client } = pg

// Load .env.local
function loadEnv() {
  try {
    const raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {}
}
loadEnv()

const DB_URL = process.env.DATABASE_URL
if (!DB_URL) throw new Error('DATABASE_URL not set')

const client = new Client({ connectionString: DB_URL })

async function run() {
  await client.connect()
  console.log('✅ Connected to Neon')

  // DunningHistory — one record per client "episode" from the tracker sheet
  await client.query(`
    CREATE TABLE IF NOT EXISTS "DunningHistory" (
      "id"                 SERIAL PRIMARY KEY,
      "tenantId"           TEXT NOT NULL DEFAULT 'gyc',
      "clientName"         TEXT,
      "companyAcronym"     TEXT,
      "inCollections"      BOOLEAN DEFAULT FALSE,
      "totalAmountDue"     DECIMAL(10,2),
      "totalCatchUpAmount" DECIMAL(10,2),
      "catchUpRate"        DECIMAL(6,4),
      "firstDueDate"       TEXT,
      "services"           TEXT,
      "reasons"            TEXT,
      "notes"              TEXT,
      "syncedAt"           TIMESTAMP DEFAULT NOW()
    )
  `)
  console.log('✅ DunningHistory table ready')

  await client.query(`CREATE INDEX IF NOT EXISTS "DH_tenantId_idx" ON "DunningHistory" ("tenantId")`)
  await client.query(`CREATE INDEX IF NOT EXISTS "DH_acronym_idx" ON "DunningHistory" ("companyAcronym")`)
  await client.query(`CREATE INDEX IF NOT EXISTS "DH_clientName_idx" ON "DunningHistory" ("clientName")`)

  // ClientServiceMap — per-client services + GA assignment
  await client.query(`
    CREATE TABLE IF NOT EXISTS "ClientServiceMap" (
      "id"             SERIAL PRIMARY KEY,
      "tenantId"       TEXT NOT NULL DEFAULT 'gyc',
      "acronym"        TEXT UNIQUE,
      "companyName"    TEXT,
      "crmType"        TEXT,
      "assignedGA"     TEXT,
      "locations"      INT,
      "hasWebsite"     BOOLEAN DEFAULT FALSE,
      "hasSEO"         BOOLEAN DEFAULT FALSE,
      "hasGoogleAds"   BOOLEAN DEFAULT FALSE,
      "hasBlueprint"   BOOLEAN DEFAULT FALSE,
      "hasCommand"     BOOLEAN DEFAULT FALSE,
      "hasS3"          BOOLEAN DEFAULT FALSE,
      "hasRecruitment" BOOLEAN DEFAULT FALSE,
      "syncedAt"       TIMESTAMP DEFAULT NOW()
    )
  `)
  console.log('✅ ClientServiceMap table ready')

  await client.query(`CREATE INDEX IF NOT EXISTS "CSM_tenantId_idx" ON "ClientServiceMap" ("tenantId")`)
  await client.query(`CREATE INDEX IF NOT EXISTS "CSM_acronym_idx"  ON "ClientServiceMap" ("acronym")`)

  await client.end()
  console.log('✅ Migration complete')
}

run().catch(e => { console.error('❌', e.message); process.exit(1) })
