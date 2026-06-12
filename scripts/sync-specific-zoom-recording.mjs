#!/usr/bin/env node
/**
 * Sync a specific Zoom recording by meeting ID
 */

import 'dotenv/config'
import pg from 'pg'
const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false
})

async function getZoomToken() {
  const { ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET } = process.env
  if (!ZOOM_ACCOUNT_ID || !ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET) {
    throw new Error('Zoom credentials missing')
  }
  
  const auth = Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString('base64')
  const res = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${ZOOM_ACCOUNT_ID}`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}` }
  })
  
  if (!res.ok) {
    throw new Error(`Zoom OAuth failed: ${res.status}`)
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

async function syncMeeting(token, meetingId) {
  console.log(`\n🔄 Syncing meeting ${meetingId}...`)
  
  // Get meeting details from all users' recordings
  const usersData = await zoomGet(token, '/users?page_size=100&status=active')
  const users = usersData.users || []
  
  let meeting = null
  for (const user of users) {
    try {
      const data = await zoomGet(token, `/users/${user.id}/recordings?from=2024-01-01&to=${new Date().toISOString().slice(0,10)}&page_size=300`)
      const meetings = data.meetings || []
      meeting = meetings.find(m => m.uuid === meetingId || String(m.id) === String(meetingId))
      if (meeting) {
        console.log(`✅ Found meeting in ${user.email}'s recordings`)
        break
      }
    } catch (e) {
      // continue
    }
  }
  
  if (!meeting) {
    throw new Error(`Meeting ${meetingId} not found`)
  }
  
  // Get participants
  let participants = []
  try {
    const data = await zoomGet(token, `/report/meetings/${meeting.id}/participants?page_size=300`)
    participants = data.participants || []
  } catch (e) {
    console.log(`⚠️  Could not fetch participants: ${e.message}`)
  }
  
  // Get transcript
  let transcriptText = null
  const recording = meeting.recording_files?.find(f => f.recording_type === 'shared_screen_with_speaker_view')
  if (recording) {
    const transcriptFile = meeting.recording_files?.find(f => f.file_type === 'TRANSCRIPT' && f.recording_id === recording.id)
    if (transcriptFile?.download_url) {
      try {
        const res = await fetch(`${transcriptFile.download_url}?access_token=${token}`)
        if (res.ok) {
          transcriptText = await res.text()
          console.log(`✅ Downloaded transcript (${transcriptText.length} chars)`)
        }
      } catch (e) {
        console.log(`⚠️  Could not download transcript: ${e.message}`)
      }
    }
  }
  
  // Insert/update in database
  const id = `zoom_${meeting.id}`
  const topic = meeting.topic || 'Untitled Meeting'
  const startTime = new Date(meeting.start_time)
  const durationSecs = (meeting.duration || 0) * 60
  const hostEmail = meeting.host_email || null
  const participantsJson = participants.map(p => ({
    name: p.name || p.user_email,
    email: p.user_email,
    joinTime: p.join_time,
    leaveTime: p.leave_time
  }))
  
  await pool.query(`
    INSERT INTO "ZoomCall" (
      id, "meetingId", topic, "startTime", "durationSecs", 
      "hostEmail", participants, "transcriptText",
      status, "syncedAt"
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (id) DO UPDATE SET
      topic = EXCLUDED.topic,
      "startTime" = EXCLUDED."startTime",
      "durationSecs" = EXCLUDED."durationSecs",
      "hostEmail" = EXCLUDED."hostEmail",
      participants = EXCLUDED.participants,
      "transcriptText" = EXCLUDED."transcriptText",
      "syncedAt" = EXCLUDED."syncedAt"
  `, [
    id, String(meeting.id), topic, startTime, durationSecs,
    hostEmail, JSON.stringify(participantsJson), transcriptText,
    'synced', new Date()
  ])
  
  console.log(`✅ Saved to database as ${id}`)
  console.log(`   Topic: ${topic}`)
  console.log(`   Start: ${startTime.toISOString()}`)
  console.log(`   Duration: ${Math.round(durationSecs/60)}m`)
  console.log(`   Participants: ${participantsJson.length}`)
}

async function main() {
  const meetingIds = process.argv.slice(2)
  if (meetingIds.length === 0) {
    console.log('Usage: node sync-specific-zoom-recording.mjs <meetingId1> [meetingId2] ...')
    process.exit(1)
  }
  
  console.log('🔍 Syncing specific Zoom recordings...')
  const token = await getZoomToken()
  console.log('✅ Zoom token obtained')
  
  for (const meetingId of meetingIds) {
    try {
      await syncMeeting(token, meetingId)
    } catch (err) {
      console.error(`❌ Error syncing ${meetingId}:`, err.message)
      console.error(err.stack)
    }
  }
  
  await pool.end()
  console.log('\n✅ Done!')
}

main().catch(err => {
  console.error('❌ Fatal error:', err.message)
  process.exit(1)
})
