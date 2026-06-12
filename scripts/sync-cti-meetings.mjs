#!/usr/bin/env node
/**
 * Sync all CTI meetings from Zoom to database
 * Uses UUID as unique identifier to handle recurring meeting instances
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

async function syncMeeting(token, meeting) {
  const uuid = meeting.uuid
  const meetingId = String(meeting.id)
  const topic = meeting.topic || 'Untitled Meeting'
  const startTime = new Date(meeting.start_time)
  const durationSecs = (meeting.duration || 0) * 60
  const hostEmail = meeting.host_email || null
  
  console.log(`\\n🔄 Syncing: ${topic}`)
  console.log(`   UUID: ${uuid}`)
  console.log(`   Start: ${meeting.start_time}`)
  console.log(`   Duration: ${meeting.duration}m`)
  
  // Get participants
  let participants = []
  try {
    const data = await zoomGet(token, `/report/meetings/${meetingId}/participants?page_size=300`)
    participants = data.participants || []
    console.log(`   Participants: ${participants.length}`)
  } catch (e) {
    console.log(`   ⚠️  Could not fetch participants: ${e.message}`)
  }
  
  const participantsJson = participants.map(p => ({
    name: p.name || p.user_email,
    email: p.user_email,
    joinTime: p.join_time,
    leaveTime: p.leave_time
  }))
  
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
          console.log(`   ✅ Transcript: ${transcriptText.length} chars`)
        }
      } catch (e) {
        console.log(`   ⚠️  Could not download transcript`)
      }
    }
  }
  
  // Use UUID for unique ID
  const id = `zoom_${uuid.replace(/[^a-zA-Z0-9]/g, '_')}`
  
  // Insert/update in database
  await pool.query(`
    INSERT INTO "ZoomCall" (
      id, "meetingId", "meetingUuid", topic, "startTime", "durationSecs", 
      "hostEmail", participants, "transcriptText",
      status, "syncedAt",
      acronym, "tenantId", "aiClassification", "clientProfileId"
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    ON CONFLICT (id) DO UPDATE SET
      "meetingId" = EXCLUDED."meetingId",
      "meetingUuid" = EXCLUDED."meetingUuid",
      topic = EXCLUDED.topic,
      "startTime" = EXCLUDED."startTime",
      "durationSecs" = EXCLUDED."durationSecs",
      "hostEmail" = EXCLUDED."hostEmail",
      participants = EXCLUDED.participants,
      "transcriptText" = COALESCE(EXCLUDED."transcriptText", "ZoomCall"."transcriptText"),
      "syncedAt" = EXCLUDED."syncedAt"
  `, [
    id, meetingId, uuid, topic, startTime, durationSecs,
    hostEmail, JSON.stringify(participantsJson), transcriptText,
    'synced', new Date(),
    'CTI', 'gyc', 'client_meeting', 80
  ])
  
  console.log(`   ✅ Saved as ${id}`)
}

async function main() {
  console.log('🔍 Syncing all CTI meetings from Zoom...\n')
  
  const token = await getZoomToken()
  console.log('✅ Zoom token obtained')
  
  // Get Todd's recordings
  const data = await zoomGet(token, `/users/todd@growyourcenter.com/recordings?from=2024-01-01&to=${new Date().toISOString().slice(0,10)}&page_size=300`)
  const meetings = data.meetings || []
  
  // Filter for CTI
  const ctiMeetings = meetings.filter(m => m.topic && m.topic.includes('[CTI]'))
  
  console.log(`📞 Found ${ctiMeetings.length} CTI meetings`)
  
  for (const meeting of ctiMeetings) {
    try {
      await syncMeeting(token, meeting)
    } catch (err) {
      console.error(`\\n❌ Error syncing meeting ${meeting.uuid}:`, err.message)
    }
  }
  
  await pool.end()
  console.log('\\n✅ All CTI meetings synced!')
}

main().catch(err => {
  console.error('❌ Fatal error:', err.message)
  process.exit(1)
})
