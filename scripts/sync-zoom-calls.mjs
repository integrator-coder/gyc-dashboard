#!/usr/bin/env node
/**
 * sync-zoom-calls.mjs
 * Fetches Zoom recordings from last 90 days, runs AI classification,
 * cross-references GHL contacts, and upserts into ZoomCall table.
 */

import pg from 'pg'
import { randomUUID } from 'crypto'
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
  // ignore — env may be set via system
}

const {
  ZOOM_ACCOUNT_ID,
  ZOOM_CLIENT_ID,
  ZOOM_CLIENT_SECRET,
  GHL_API_KEY,
  GHL_LOCATION_ID,
  DATABASE_URL,
  NEON_DATABASE_URL,
} = process.env

// ─── DB ───────────────────────────────────────────────────────────────────────
const { Pool } = pg
const pool = new Pool({
  connectionString: NEON_DATABASE_URL || DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// ─── Zoom OAuth ───────────────────────────────────────────────────────────────
async function getZoomToken() {
  if (!ZOOM_ACCOUNT_ID || !ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET) {
    throw new Error('Missing ZOOM credentials. Set ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET in .env.local')
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

// ─── Zoom API helpers ─────────────────────────────────────────────────────────
async function zoomGet(token, path) {
  const res = await fetch(`https://api.zoom.us/v2${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 429) {
    console.warn('  Rate limited by Zoom, sleeping 2s...')
    await new Promise(r => setTimeout(r, 2000))
    return zoomGet(token, path)
  }
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Zoom API ${path} -> ${res.status}: ${txt}`)
  }
  return res.json()
}

async function getRecordings(token, from, to) {
  const data = await zoomGet(token, `/users/me/recordings?from=${from}&to=${to}&page_size=100`)
  return data.meetings || []
}

async function getMeetingParticipants(token, meetingId) {
  try {
    const data = await zoomGet(token, `/report/meetings/${meetingId}/participants?page_size=300`)
    return data.participants || []
  } catch {
    return []
  }
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

// ─── GHL helpers ─────────────────────────────────────────────────────────────
async function searchGhlContact(email) {
  if (!GHL_API_KEY || !GHL_LOCATION_ID || !email) return null
  try {
    const res = await fetch(
      `https://services.leadconnectorhq.com/contacts/?locationId=${GHL_LOCATION_ID}&email=${encodeURIComponent(email)}`,
      { headers: { Authorization: `Bearer ${GHL_API_KEY}`, Version: '2021-07-28' } }
    )
    if (!res.ok) return null
    const data = await res.json()
    const contacts = data.contacts || []
    if (!contacts.length) return null
    const c = contacts[0]
    const pipeline = c.pipeline || c.opportunitySource || null
    const stage = c.stage || null
    return {
      id: c.id,
      name: `${c.firstName || ''} ${c.lastName || ''}`.trim(),
      pipeline,
      stage,
    }
  } catch {
    return null
  }
}

// ─── OpenAI Summary ─────────────────────────────────────────────────────────
async function generateCallSummary(transcript, topic, participants) {
  if (!transcript || transcript.length < 100) return null

  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) return null

  const participantList = participants.map(p => p.name || p.user_name || p.user_email).filter(Boolean).join(', ')

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `Summarize this Zoom call in 3-4 sentences. Meeting: "${topic || 'Untitled'}". Participants: ${participantList || 'unknown'}.\n\nTranscript:\n${transcript.slice(0, 3000)}`,
        }],
      }),
    }).then(r => r.json())
    return response.choices?.[0]?.message?.content || null
  } catch (err) {
    console.warn('    ⚠️  OpenAI summary failed:', err.message)
    return null
  }
}

// ─── AI Classification ────────────────────────────────────────────────────────
function classifyCall(meeting, participants, ghlMatch) {
  const topic = (meeting.topic || '').toLowerCase()
  const emails = participants.map(p => (p.user_email || '').toLowerCase())

  // Rule 1: GHL pipeline match
  if (ghlMatch) {
    if (ghlMatch.pipeline === 'GYC Sales') return { type: 'sales', confidence: 0.9 }
    if (ghlMatch.pipeline === 'Client Stage' && ghlMatch.stage === 'Onboarding') return { type: 'onboarding', confidence: 0.9 }
    if (ghlMatch.pipeline === 'Client Stage') return { type: 'client_meeting', confidence: 0.85 }
  }

  // Rule 2: Topic keywords
  if (topic.includes('discovery') || topic.includes('demo') || topic.includes('intro call'))
    return { type: 'sales', confidence: 0.7 }
  if (topic.includes('onboard') || topic.includes('kickoff') || topic.includes('vision'))
    return { type: 'onboarding', confidence: 0.7 }
  if (topic.includes('blueprint'))
    return { type: 'blueprint', confidence: 0.8 }
  if (topic.includes('l10') || topic.includes('team meeting') || topic.includes('standup') || topic.includes('stand up'))
    return { type: 'internal', confidence: 0.8 }
  if (topic.includes('1:1') || topic.includes('one on one') || topic.includes('one-on-one') || topic.includes('check in') || topic.includes('check-in'))
    return { type: 'one_on_one', confidence: 0.75 }

  // Rule 3: All-internal participants
  const gycDomains = ['@growyourcenter.com', '@gyc', 'brucewspurr']
  const allInternal = emails.length >= 2 && emails.every(e => gycDomains.some(d => e.includes(d)))
  if (allInternal) return { type: 'internal', confidence: 0.7 }

  return { type: 'unknown', confidence: 0.0 }
}

function buildAiSummary(meeting, participants, classification) {
  const parts = []
  if (meeting.topic) parts.push(`Meeting: "${meeting.topic}".`)
  if (participants.length) {
    const names = participants.slice(0, 5).map(p => p.name || p.user_name).filter(Boolean)
    parts.push(`Participants: ${names.join(', ')}${participants.length > 5 ? ` +${participants.length - 5} more` : ''}.`)
  }
  if (meeting.duration) parts.push(`Duration: ${meeting.duration} minutes.`)
  if (classification.type !== 'unknown') parts.push(`AI classified as ${classification.type.replace(/_/g, ' ')} (${Math.round(classification.confidence * 100)}% confidence).`)
  return parts.join(' ') || null
}

// ─── Upsert ───────────────────────────────────────────────────────────────────
async function upsertZoomCall(record) {
  const {
    id, tenantId, meetingId, topic, hostEmail, hostName, startTime, duration,
    participants, recordingUrl, transcriptUrl, transcriptText,
    aiSummary, aiClassification, aiConfidence,
    ghlContactId, ghlContactName, ghlPipelineStage,
    status, syncedAt
  } = record

  await pool.query(
    `INSERT INTO "ZoomCall" (
      id, "tenantId", "meetingId", topic, "hostEmail", "hostName", "startTime", duration,
      participants, "recordingUrl", "transcriptUrl", "transcriptText",
      "aiSummary", "aiClassification", "aiConfidence",
      "ghlContactId", "ghlContactName", "ghlPipelineStage",
      status, "syncedAt", "createdAt"
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,NOW())
    ON CONFLICT (id) DO UPDATE SET
      topic = EXCLUDED.topic,
      "hostEmail" = EXCLUDED."hostEmail",
      "hostName" = EXCLUDED."hostName",
      "startTime" = EXCLUDED."startTime",
      duration = EXCLUDED.duration,
      participants = EXCLUDED.participants,
      "recordingUrl" = EXCLUDED."recordingUrl",
      "transcriptUrl" = EXCLUDED."transcriptUrl",
      "transcriptText" = COALESCE(EXCLUDED."transcriptText", "ZoomCall"."transcriptText"),
      "aiSummary" = EXCLUDED."aiSummary",
      "aiClassification" = EXCLUDED."aiClassification",
      "aiConfidence" = EXCLUDED."aiConfidence",
      "ghlContactId" = COALESCE(EXCLUDED."ghlContactId", "ZoomCall"."ghlContactId"),
      "ghlContactName" = COALESCE(EXCLUDED."ghlContactName", "ZoomCall"."ghlContactName"),
      "ghlPipelineStage" = COALESCE(EXCLUDED."ghlPipelineStage", "ZoomCall"."ghlPipelineStage"),
      "syncedAt" = EXCLUDED."syncedAt"
    `,
    [id, tenantId, meetingId, topic, hostEmail, hostName, startTime, duration,
     participants ? JSON.stringify(participants) : null,
     recordingUrl, transcriptUrl, transcriptText,
     aiSummary, aiClassification, aiConfidence,
     ghlContactId, ghlContactName, ghlPipelineStage,
     status, syncedAt || new Date()]
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔄 Zoom Call Sync starting...\n')

  // Date range: last 90 days
  const to = new Date()
  const from = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const fromStr = from.toISOString().slice(0, 10)
  const toStr = to.toISOString().slice(0, 10)
  console.log(`📅 Range: ${fromStr} → ${toStr}`)

  let token
  try {
    token = await getZoomToken()
    console.log('✅ Zoom token obtained\n')
  } catch (err) {
    console.error(`❌ ${err.message}`)
    console.log('\n⚠️  Zoom credentials not configured. Add to .env.local:')
    console.log('   ZOOM_ACCOUNT_ID=<your-account-id>')
    console.log('   ZOOM_CLIENT_ID=<your-client-id>')
    console.log('   ZOOM_CLIENT_SECRET=<your-client-secret>')
    await pool.end()
    process.exit(0)
  }

  const meetings = await getRecordings(token, fromStr, toStr)
  console.log(`📹 Found ${meetings.length} meetings with recordings\n`)

  const stats = { synced: 0, skipped: 0, ghlMatches: 0, byType: {} }

  for (const meeting of meetings) {
    const meetingId = String(meeting.id || meeting.uuid)
    const recordId = `zoom_${meetingId}`
    console.log(`  Processing: "${meeting.topic || '(no topic)'}" [${meetingId}]`)

    // Find recording URL and transcript
    const recordingFiles = meeting.recording_files || []
    const mp4 = recordingFiles.find(f => f.file_type === 'MP4' && f.status === 'completed')
    const transcript = recordingFiles.find(f => f.file_type === 'TRANSCRIPT')
    const recordingUrl = mp4?.play_url || mp4?.download_url || null
    const transcriptDownloadUrl = transcript?.download_url || null
    const transcriptUrl = transcript?.play_url || transcriptDownloadUrl || null

    // Fetch participants
    const participants = await getMeetingParticipants(token, meetingId)

    // Fetch transcript text
    let transcriptText = null
    if (transcriptDownloadUrl) {
      transcriptText = await getTranscriptText(token, transcriptDownloadUrl)
    }

    // GHL cross-reference — search by unique participant emails
    let ghlMatch = null
    const externalEmails = participants
      .map(p => p.user_email)
      .filter(e => e && !['@growyourcenter.com', '@gyc', 'brucewspurr'].some(d => e.toLowerCase().includes(d)))

    for (const email of externalEmails.slice(0, 3)) {
      const match = await searchGhlContact(email)
      if (match) {
        ghlMatch = match
        stats.ghlMatches++
        console.log(`    🔗 GHL match: ${match.name} (${match.pipeline || 'no pipeline'})`)
        break
      }
    }

    // AI classification
    const classification = classifyCall(meeting, participants, ghlMatch)
    // Try OpenAI summary first, fall back to rule-based
    let aiSummary = null
    if (transcriptText) {
      console.log('    🤖 Generating AI summary...')
      aiSummary = await generateCallSummary(transcriptText, meeting.topic, participants)
    }
    if (!aiSummary) {
      aiSummary = buildAiSummary(meeting, participants, classification)
    }

    const typeStat = classification.type
    stats.byType[typeStat] = (stats.byType[typeStat] || 0) + 1

    // Upsert
    await upsertZoomCall({
      id: recordId,
      tenantId: 'gyc',
      meetingId: meetingId,
      topic: meeting.topic || null,
      hostEmail: meeting.host_email || null,
      hostName: meeting.host_id || null, // Zoom returns host_id not name in recording list
      startTime: meeting.start_time ? new Date(meeting.start_time) : null,
      duration: meeting.duration || null,
      participants: participants.map(p => ({
        name: p.name,
        email: p.user_email,
        duration: p.duration,
      })),
      recordingUrl,
      transcriptUrl,
      transcriptText,
      aiSummary,
      aiClassification: classification.type,
      aiConfidence: classification.confidence,
      ghlContactId: ghlMatch?.id || null,
      ghlContactName: ghlMatch?.name || null,
      ghlPipelineStage: ghlMatch?.stage || null,
      status: 'pending',
      syncedAt: new Date(),
    })

    stats.synced++
    console.log(`    ✅ ${classification.type} (${Math.round(classification.confidence * 100)}%)`)
  }

  // Print summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`✅ Synced: ${stats.synced} calls`)
  console.log(`🔗 GHL matches: ${stats.ghlMatches}`)
  console.log('\n📊 Classification breakdown:')
  for (const [type, count] of Object.entries(stats.byType)) {
    console.log(`   ${type.padEnd(16)} ${count}`)
  }

  await pool.end()
}

main().catch(async err => {
  console.error('Fatal:', err.message)
  await pool.end()
  process.exit(1)
})
