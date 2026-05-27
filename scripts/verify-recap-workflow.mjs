#!/usr/bin/env node
/**
 * verify-recap-workflow.mjs
 * Comprehensive verification of the Zoom Call Recap workflow
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
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📋 Zoom Call Recap Workflow Verification')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  // 1. Check schema
  console.log('1️⃣  Database Schema Check')
  console.log('────────────────────────────────────────────────────────')
  
  const { rows: columns } = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'ZoomCall' 
    AND column_name IN ('meetingRecap', 'followUpEmailDraft', 'recapGeneratedAt')
    ORDER BY column_name
  `)
  
  const expectedCols = ['followUpEmailDraft', 'meetingRecap', 'recapGeneratedAt']
  const foundCols = columns.map(c => c.column_name)
  
  expectedCols.forEach(col => {
    const found = foundCols.includes(col)
    const icon = found ? '✅' : '❌'
    const colInfo = columns.find(c => c.column_name === col)
    const type = colInfo ? `(${colInfo.data_type})` : ''
    console.log(`   ${icon} ${col} ${type}`)
  })
  
  const schemaOk = expectedCols.every(col => foundCols.includes(col))
  console.log(`\n   Status: ${schemaOk ? '✅ All columns present' : '❌ Missing columns'}\n`)

  // 2. Data availability
  console.log('2️⃣  Data Availability')
  console.log('────────────────────────────────────────────────────────')
  
  const { rows: [stats] } = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE "aiClassification" IN ('client_meeting', 'onboarding', 'blueprint')) as total_client_calls,
      COUNT(*) FILTER (WHERE "aiClassification" IN ('client_meeting', 'onboarding', 'blueprint') AND acronym IS NOT NULL) as with_acronym,
      COUNT(*) FILTER (WHERE "meetingRecap" IS NOT NULL) as with_recap
    FROM "ZoomCall"
    WHERE "tenantId" = 'gyc'
  `)
  
  console.log(`   Total client calls: ${stats.total_client_calls}`)
  console.log(`   With acronym linked: ${stats.with_acronym}`)
  console.log(`   With recap generated: ${stats.with_recap}`)
  
  const { rows: [transcriptStats] } = await pool.query(`
    SELECT COUNT(*) as count
    FROM "ZoomCall" zc
    WHERE zc."aiClassification" IN ('client_meeting', 'onboarding', 'blueprint')
      AND zc.acronym IS NOT NULL
      AND zc."tenantId" = 'gyc'
      AND EXISTS (
        SELECT 1 FROM "ZoomTranscript" zt 
        WHERE zt."zoomCallId"::text = zc.id::text
      )
  `)
  
  console.log(`   With transcript available: ${transcriptStats.count}`)
  console.log()

  // 3. Script verification
  console.log('3️⃣  Scripts & API')
  console.log('────────────────────────────────────────────────────────')
  
  const scriptsToCheck = [
    'scripts/add-recap-columns.mjs',
    'scripts/generate-call-recaps.mjs',
    'scripts/check-recap-eligibility.mjs'
  ]
  
  const fs = await import('fs/promises')
  for (const script of scriptsToCheck) {
    try {
      await fs.access(resolve(__dirname, '..', script))
      console.log(`   ✅ ${script}`)
    } catch {
      console.log(`   ❌ ${script} (missing)`)
    }
  }
  
  // Check API route
  const apiPath = 'app/api/clients/[acronym]/meetings/route.js'
  try {
    await fs.access(resolve(__dirname, '..', apiPath))
    console.log(`   ✅ ${apiPath}`)
  } catch {
    console.log(`   ❌ ${apiPath} (missing)`)
  }
  console.log()

  // 4. Sample API response
  console.log('4️⃣  Sample Data')
  console.log('────────────────────────────────────────────────────────')
  
  const { rows: sampleCalls } = await pool.query(`
    SELECT 
      zc.id,
      zc.acronym,
      zc.topic,
      zc."startTime",
      zc."aiClassification",
      CASE WHEN zc."meetingRecap" IS NOT NULL THEN true ELSE false END as has_recap,
      CASE WHEN zc."followUpEmailDraft" IS NOT NULL THEN true ELSE false END as has_email
    FROM "ZoomCall" zc
    WHERE zc."aiClassification" IN ('client_meeting', 'onboarding', 'blueprint')
      AND zc.acronym IS NOT NULL
      AND zc."tenantId" = 'gyc'
    ORDER BY zc."startTime" DESC
    LIMIT 3
  `)
  
  if (sampleCalls.length > 0) {
    sampleCalls.forEach((call, i) => {
      console.log(`   ${i + 1}. ${call.acronym} - ${call.topic || 'Untitled'}`)
      console.log(`      Type: ${call.aiClassification}`)
      console.log(`      Recap: ${call.has_recap ? '✅' : '⏳ Pending'}`)
      console.log(`      Email: ${call.has_email ? '✅' : '⏳ Pending'}`)
    })
  } else {
    console.log('   No client calls found')
  }
  console.log()

  // 5. Next steps
  console.log('5️⃣  Next Steps')
  console.log('────────────────────────────────────────────────────────')
  
  if (transcriptStats.count === 0) {
    console.log('   ⚠️  No transcripts available yet')
    console.log('   → Recap generation will run once Zoom transcripts are ingested')
  } else if (stats.with_recap === 0) {
    console.log('   ✅ Ready to generate recaps')
    console.log('   → Run: node --env-file=.env.local scripts/generate-call-recaps.mjs')
  } else {
    console.log(`   ✅ ${stats.with_recap} calls already have recaps`)
    console.log('   → Run script to process any new calls')
  }
  
  console.log('\n   📌 Add to zoom-daily-ingestion cron:')
  console.log('      node --env-file=.env.local scripts/generate-call-recaps.mjs')
  console.log()

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✅ Verification Complete')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  await pool.end()
}

main().catch(async err => {
  console.error('Fatal:', err.message)
  await pool.end()
  process.exit(1)
})
