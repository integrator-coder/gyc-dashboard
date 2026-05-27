#!/usr/bin/env node
import pg from 'pg'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

try {
  const envPath = resolve(__dirname, '../.env.local')
  const envContent = readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx < 0) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
} catch {}

const { Pool } = pg
const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const { rows } = await pool.query(`
  SELECT acronym, COUNT(*) as count
  FROM "ZoomCall"
  WHERE "aiClassification" IN ('client_meeting', 'onboarding', 'blueprint')
    AND acronym IS NOT NULL
    AND "tenantId" = 'gyc'
  GROUP BY acronym
  ORDER BY count DESC
  LIMIT 5
`)

console.log('Sample client acronyms with meetings:')
rows.forEach(r => console.log(`  ${r.acronym}: ${r.count} meetings`))

await pool.end()
