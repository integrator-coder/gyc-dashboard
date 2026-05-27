#!/usr/bin/env node
/**
 * add-recap-columns.mjs
 * Adds meetingRecap, followUpEmailDraft, and recapGeneratedAt columns to ZoomCall
 */

import pg from 'pg'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env.local
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
} catch {
  // ignore
}

const { Pool } = pg
const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

async function main() {
  console.log('🔧 Adding recap columns to ZoomCall...\n')

  try {
    await pool.query(`
      ALTER TABLE "ZoomCall" 
      ADD COLUMN IF NOT EXISTS "meetingRecap" JSONB,
      ADD COLUMN IF NOT EXISTS "followUpEmailDraft" TEXT,
      ADD COLUMN IF NOT EXISTS "recapGeneratedAt" TIMESTAMPTZ;
    `)
    console.log('✅ Columns added successfully\n')
  } catch (err) {
    console.error('❌ Error:', err.message)
    process.exit(1)
  }

  await pool.end()
}

main()
