#!/usr/bin/env node
/**
 * Search Zoom specifically for CTI recordings
 * 
 * Queries Todd's Zoom account for all recordings and filters for [CTI] in the topic
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
  console.log('🔍 Searching Zoom for CTI recordings...\n')
  
  const token = await getZoomToken()
  console.log('✅ Zoom token obtained\n')
  
  // Get all GYC users
  const usersData = await zoomGet(token, '/users?page_size=100&status=active')
  const users = usersData.users || []
  console.log(`👥 Found ${users.length} GYC users\n`)
  
  // Search recordings from Jan 2024 to now
  const to = new Date().toISOString().slice(0, 10)
  const from = '2024-01-01'
  
  console.log(`📅 Searching range: ${from} → ${to}\n`)
  
  const ctiRecordings = []
  
  for (const user of users) {
    try {
      const data = await zoomGet(token, `/users/${user.id}/recordings?from=${from}&to=${to}&page_size=300`)
      const meetings = data.meetings || []
      
      // Filter for CTI recordings
      const ctiMeetings = meetings.filter(m => m.topic && m.topic.includes('[CTI]'))
      
      if (ctiMeetings.length > 0) {
        console.log(`📞 ${user.email}: ${ctiMeetings.length} CTI recordings`)
        ctiMeetings.forEach(m => {
          console.log(`    [${m.id}] ${m.topic}`)
          console.log(`        Date: ${m.start_time} | Duration: ${m.duration}m`)
          ctiRecordings.push({ user: user.email, meeting: m })
        })
      }
    } catch (e) {
      // skip users with no recording access
    }
  }
  
  console.log(`\n✅ Total CTI recordings found: ${ctiRecordings.length}`)
}

main().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
