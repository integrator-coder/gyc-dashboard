#!/usr/bin/env node
/**
 * Update CTI Recordings
 * 
 * Finds all Zoom recordings with "[CTI]" in the topic and updates them to:
 * - acronym: 'CTI'
 * - tenantId: 'gyc'
 * - aiClassification: 'client_meeting'
 * - clientProfileId: 80 (CTI's profile)
 */

import pg from 'pg'
const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false
})

async function main() {
  console.log('🔍 Searching for CTI recordings...\n')
  
  // First, find all CTI recordings
  const searchResult = await pool.query(`
    SELECT id, topic, "startTime", "meetingId", "durationSecs", "aiClassification", acronym, "clientProfileId"
    FROM "ZoomCall"
    WHERE topic ILIKE '%[CTI]%'
    ORDER BY "startTime" DESC
  `)
  
  console.log(`📞 Found ${searchResult.rows.length} CTI recordings\n`)
  
  if (searchResult.rows.length === 0) {
    console.log('✅ No CTI recordings found to update')
    await pool.end()
    return
  }
  
  // Display current state
  console.log('Current state:')
  searchResult.rows.forEach(r => {
    console.log(`  [${r.id}] ${r.topic}`)
    console.log(`      Date: ${r.startTime?.toISOString().slice(0,10)} | Duration: ${Math.round(r.durationSecs/60)}m`)
    console.log(`      Classification: ${r.aiClassification || 'unknown'} | Acronym: ${r.acronym || 'none'} | ClientProfile: ${r.clientProfileId || 'none'}`)
  })
  
  console.log('\n🔧 Updating all CTI recordings...\n')
  
  // Update all CTI recordings
  const updateResult = await pool.query(`
    UPDATE "ZoomCall"
    SET 
      acronym = 'CTI',
      "tenantId" = 'gyc',
      "aiClassification" = 'client_meeting',
      "clientProfileId" = 80,
      "syncedAt" = NOW()
    WHERE topic ILIKE '%[CTI]%'
    RETURNING id, topic, "startTime"
  `)
  
  console.log(`✅ Updated ${updateResult.rows.length} recordings:\n`)
  updateResult.rows.forEach(r => {
    console.log(`  [${r.id}] ${r.topic}`)
    console.log(`      Date: ${r.startTime?.toISOString().slice(0,10)}`)
  })
  
  await pool.end()
  console.log('\n✅ Done!')
}

main().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
