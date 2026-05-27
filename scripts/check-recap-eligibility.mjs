#!/usr/bin/env node
/**
 * check-recap-eligibility.mjs
 * Check what calls are eligible for recap generation
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
  console.log('📊 Checking Recap Eligibility\n')

  // Total client calls
  const { rows: [{ count: totalClientCalls }] } = await pool.query(`
    SELECT COUNT(*) as count
    FROM "ZoomCall"
    WHERE "aiClassification" IN ('client_meeting', 'onboarding', 'blueprint')
      AND "tenantId" = 'gyc'
  `)
  console.log(`Total client calls: ${totalClientCalls}`)

  // Calls with acronym
  const { rows: [{ count: withAcronym }] } = await pool.query(`
    SELECT COUNT(*) as count
    FROM "ZoomCall"
    WHERE "aiClassification" IN ('client_meeting', 'onboarding', 'blueprint')
      AND acronym IS NOT NULL
      AND "tenantId" = 'gyc'
  `)
  console.log(`With acronym: ${withAcronym}`)

  // Calls with transcript
  const { rows: [{ count: withTranscript }] } = await pool.query(`
    SELECT COUNT(*) as count
    FROM "ZoomCall" zc
    WHERE zc."aiClassification" IN ('client_meeting', 'onboarding', 'blueprint')
      AND zc.acronym IS NOT NULL
      AND zc."tenantId" = 'gyc'
      AND EXISTS (
        SELECT 1 FROM "ZoomTranscript" zt 
        WHERE zt."zoomCallId"::text = zc.id::text 
        AND zt."vttRaw" IS NOT NULL
      )
  `)
  console.log(`With transcript: ${withTranscript}`)

  // Calls already processed
  const { rows: [{ count: alreadyProcessed }] } = await pool.query(`
    SELECT COUNT(*) as count
    FROM "ZoomCall"
    WHERE "aiClassification" IN ('client_meeting', 'onboarding', 'blueprint')
      AND acronym IS NOT NULL
      AND "meetingRecap" IS NOT NULL
      AND "tenantId" = 'gyc'
  `)
  console.log(`Already processed: ${alreadyProcessed}`)

  // Sample of eligible calls (without recap yet)
  const { rows: eligible } = await pool.query(`
    SELECT 
      zc.id,
      zc.topic,
      zc."startTime",
      zc.acronym,
      zc."aiClassification",
      LENGTH(zt."vttRaw") as transcript_length
    FROM "ZoomCall" zc
    JOIN "ZoomTranscript" zt ON zt."zoomCallId"::text = zc.id::text
    WHERE zc."aiClassification" IN ('client_meeting', 'onboarding', 'blueprint')
      AND zc.acronym IS NOT NULL
      AND zc."meetingRecap" IS NULL
      AND zc."tenantId" = 'gyc'
      AND zt."vttRaw" IS NOT NULL
    ORDER BY zc."startTime" DESC
    LIMIT 5
  `)

  console.log(`\n✅ Eligible for processing: ${eligible.length}`)
  
  if (eligible.length > 0) {
    console.log('\nSample:')
    eligible.forEach((c, i) => {
      console.log(`${i + 1}. ${c.topic || 'Untitled'} (${c.acronym}) - ${c.aiClassification}`)
      console.log(`   Transcript: ${(c.transcript_length / 1024).toFixed(1)}KB`)
    })
  }

  await pool.end()
}

main().catch(async err => {
  console.error('Fatal:', err.message)
  await pool.end()
  process.exit(1)
})
