#!/usr/bin/env node
/**
 * Get ALL instances of CTI meetings from Zoom
 */

import 'dotenv/config'

async function getZoomToken() {
  const { ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET } = process.env
  if (!ZOOM_ACCOUNT_ID || !ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET) {
    throw new Error('Zoom credentials missing from .env.local')
  }
  
  const auth = Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString('base64')
  const res = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${ZOOM_ACCOUNT_ID}`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}` }
  })
  
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Zoom OAuth failed: ${res.status} ${txt}`)
  }
  
  const data = await res.json()
  return data.access_token
}

async function zoomGet(token, path) {
  const res = await fetch(`https://api.zoom.us/v2${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Zoom API ${path} -> ${res.status}: ${txt}`)
  }
  return res.json()
}

async function main() {
  console.log('🔍 Getting ALL CTI meeting instances from Zoom...\n')
  
  const token = await getZoomToken()
  console.log('✅ Zoom token obtained\n')
  
  // Get Todd's recordings
  const data = await zoomGet(token, `/users/todd@growyourcenter.com/recordings?from=2024-01-01&to=${new Date().toISOString().slice(0,10)}&page_size=300`)
  const meetings = data.meetings || []
  
  // Filter for CTI
  const ctiMeetings = meetings.filter(m => m.topic && m.topic.includes('[CTI]'))
  
  console.log(`📞 Found ${ctiMeetings.length} CTI meeting instances:\n`)
  
  ctiMeetings.forEach((m, i) => {
    console.log(`${i+1}. [ID: ${m.id}] [UUID: ${m.uuid}]`)
    console.log(`   Topic: ${m.topic}`)
    console.log(`   Start: ${m.start_time}`)
    console.log(`   Duration: ${m.duration}m`)
    console.log(`   Recording files: ${m.recording_files?.length || 0}`)
    console.log(`   Recording play URL: ${m.recording_play_url || 'none'}`)
    console.log('')
  })
  
  console.log('\\n📋 Full meeting data (JSON):')
  console.log(JSON.stringify(ctiMeetings, null, 2))
}

main().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
