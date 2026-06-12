#!/usr/bin/env node
/**
 * fetch-gklc-recordings.mjs
 * Fetch specific GKLC recordings by meeting ID
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

const {
  ZOOM_ACCOUNT_ID,
  ZOOM_CLIENT_ID,
  ZOOM_CLIENT_SECRET,
  DATABASE_URL,
  NEON_DATABASE_URL,
  OPENAI_API_KEY,
} = process.env

const { Pool } = pg
const pool = new Pool({
  connectionString: NEON_DATABASE_URL || DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// ─── Zoom OAuth ───────────────────────────────────────────────────────────────
async function getZoomToken() {
  if (!ZOOM_ACCOUNT_ID || !ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET) {
    throw new Error('Missing ZOOM credentials')
  }
  const creds = Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString('base64')
  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${ZOOM_ACCOUNT_ID}`,
    { method: 'POST', headers: { Authorization: `Basic ${creds}` } }
  )
  const data = await res.json()
  if (!data.access_token) throw new Error(`Zoom OAuth failed: ${JSON.stringify(data)}`)
  return data.access_token
}

async function zoomGet(token, path) {
  const res = await fetch(`https://api.zoom.us/v2${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 429) {
    console.warn('  Rate limited, sleeping 2s...')
    await new Promise(r => setTimeout(r, 2000))
    return zoomGet(token, path)
  }
  if (!res.ok) {
    const txt = await res.text()
    console.warn(`  API ${path} -> ${res.status}: ${txt}`)
    return null
  }
  return res.json()
}

async function getTranscriptText(token, transcriptDownloadUrl) {
  if (!transcriptDownloadUrl) return null
  try {
    const res = await fetch(`${transcriptDownloadUrl}?access_token=${token}`)
    if (!res.ok) return null
    return res.text()
  } catch {
    return null
  }
}

async function generateCallSummary(transcript, topic) {
  if (!transcript || transcript.length < 100 || !OPENAI_API_KEY) return null
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `Summarize this Zoom call in 3-4 sentences. Meeting: "${topic || 'GKLC Marketing Review'}".\n\nTranscript:\n${transcript.slice(0, 3000)}`,
        }],
      }),
    }).then(r => r.json())
    return response.choices?.[0]?.message?.content || null
  } catch (err) {
    console.warn('    ⚠️  OpenAI summary failed:', err.message)
    return null
  }
}

async function upsertZoomCall(record) {
  const {
    id, tenantId, meetingId, topic, hostEmail, startTime, duration,
    recordingUrl, transcriptUrl, transcriptText,
    aiSummary, acronym, clientProfileId,
    status
  } = record

  await pool.query(
    `INSERT INTO \"ZoomCall\" (
      id, \"tenantId\", \"meetingId\", topic, \"hostEmail\", \"startTime\", duration,
      \"recordingUrl\", \"transcriptUrl\", \"transcriptText\",
      \"aiSummary\", \"aiClassification\", \"aiConfidence\",
      \"acronym\", \"clientProfileId\",
      status, \"syncedAt\", \"createdAt\"
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW(),NOW())
    ON CONFLICT (id) DO UPDATE SET
      topic = EXCLUDED.topic,
      \"hostEmail\" = EXCLUDED.\"hostEmail\",
      \"startTime\" = EXCLUDED.\"startTime\",
      duration = EXCLUDED.duration,
      \"recordingUrl\" = EXCLUDED.\"recordingUrl\",
      \"transcriptUrl\" = EXCLUDED.\"transcriptUrl\",
      \"transcriptText\" = COALESCE(EXCLUDED.\"transcriptText\", \"ZoomCall\".\"transcriptText\"),
      \"aiSummary\" = COALESCE(EXCLUDED.\"aiSummary\", \"ZoomCall\".\"aiSummary\"),
      \"acronym\" = COALESCE(EXCLUDED.\"acronym\", \"ZoomCall\".\"acronym\"),
      \"clientProfileId\" = COALESCE(EXCLUDED.\"clientProfileId\", \"ZoomCall\".\"clientProfileId\"),
      \"syncedAt\" = NOW()
    `,
    [
      id, tenantId, meetingId, topic, hostEmail || 'stefen@growyourcenter.com',
      startTime, duration,
      recordingUrl, transcriptUrl, transcriptText,
      aiSummary,
      'client_meeting', // aiClassification
      0.80, // aiConfidence
      acronym || 'GKLC',
      clientProfileId || 112, // GKLC client profile ID
      status
    ]
  )
}

async function main() {
  console.log('🎯 Fetching GKLC recordings by meeting ID...\n')

  const token = await getZoomToken()
  console.log('✅ Zoom token obtained\n')

  // Known GKLC meeting IDs from Todd's search
  const gklcMeetings = [
    { id: '89262279944', date: '2026-03-31', duration: '45:19', desc: 'Enrollment improving to 68%' },
    { id: '86276639657', date: '2026-01-23', duration: '58:22', desc: 'Lead flow and enrollment' },
    { id: '84059198134', date: '2025-12-19', duration: '1:08:13', desc: 'Digital marketing strategy' },
    { id: '82312725004', date: '2025-11-21', duration: '1:15:34', desc: 'Google Analytics, Ads' },
    { id: '86297092458', date: '2025-10-22', duration: '52:49', desc: 'Website improvements' },
    { id: '82406235500', date: '2025-09-17', duration: '(unknown)', desc: 'Positive performance trends' },
  ]

  const stats = { found: 0, notFound: 0, synced: 0 }

  for (const meeting of gklcMeetings) {
    console.log(`\n📹 Meeting ${meeting.id} (${meeting.date})`)
    console.log(`   Description: ${meeting.desc}`)

    // Try to get recording data for this specific meeting
    const data = await zoomGet(token, `/meetings/${meeting.id}/recordings`)
    
    if (!data || !data.recording_files) {
      console.log('   ❌ No recording data found')
      stats.notFound++
      continue
    }

    stats.found++

    const recordingFiles = data.recording_files || []
    const mp4 = recordingFiles.find(f => f.file_type === 'MP4' && f.status === 'completed')
    const transcript = recordingFiles.find(f => f.file_type === 'TRANSCRIPT')
    
    const recordingUrl = mp4?.play_url || mp4?.download_url || null
    const transcriptDownloadUrl = transcript?.download_url || null
    const transcriptUrl = transcript?.play_url || transcriptDownloadUrl || null

    let transcriptText = null
    if (transcriptDownloadUrl) {
      console.log('   📝 Downloading transcript...')
      transcriptText = await getTranscriptText(token, transcriptDownloadUrl)
      if (transcriptText) {
        console.log(`   ✅ Transcript: ${transcriptText.length} chars`)
      }
    }

    let aiSummary = null
    if (transcriptText) {
      console.log('   🤖 Generating AI summary...')
      aiSummary = await generateCallSummary(transcriptText, data.topic)
    }

    const recordId = `zoom_${meeting.id}`
    await upsertZoomCall({
      id: recordId,
      tenantId: 'gyc',
      meetingId: meeting.id,
      topic: data.topic || `GKLC Marketing Review — ${meeting.date}`,
      hostEmail: data.host_email || 'stefen@growyourcenter.com',
      startTime: data.start_time ? new Date(data.start_time) : new Date(meeting.date),
      duration: data.duration || parseInt(meeting.duration) || null,
      recordingUrl,
      transcriptUrl,
      transcriptText,
      aiSummary,
      acronym: 'GKLC',
      clientProfileId: 112,
      status: 'pending',
    })

    stats.synced++
    console.log('   ✅ Synced to DB')
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`✅ Synced: ${stats.synced}`)
  console.log(`❌ Not found: ${stats.notFound}`)

  await pool.end()
}

main().catch(async err => {
  console.error('Fatal:', err.message)
  await pool.end()
  process.exit(1)
})
