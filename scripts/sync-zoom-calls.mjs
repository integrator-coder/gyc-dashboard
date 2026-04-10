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
  // Fetch all users first, then get recordings for each
  const usersData = await zoomGet(token, '/users?page_size=100&status=active')
  const users = usersData.users || []
  console.log(`  👥 Fetching recordings for ${users.length} users...`)
  
  const allMeetings = []
  for (const user of users) {
    try {
      const data = await zoomGet(token, `/users/${user.id}/recordings?from=${from}&to=${to}&page_size=100`)
      const meetings = data.meetings || []
      if (meetings.length > 0) {
        console.log(`    ${user.email}: ${meetings.length} recordings`)
        allMeetings.push(...meetings)
      }
    } catch (e) {
      // skip users with no recording access
    }
  }
  const data = { meetings: allMeetings }
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
/**
 * Find a GHL contact by trying multiple participant emails.
 * Skips internal GYC/Bruce emails. Returns first match.
 */
async function findGHLContact(emails) {
  for (const email of emails) {
    if (!email) continue
    if (GYC_EMAILS.some(d => email.toLowerCase().includes(d.replace('@', '')))) continue
    const match = await searchGhlContact(email)
    if (match) return match
  }
  return null
}

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
const GYC_EMAILS = ['@growyourcenter.com', 'unstoppable@brucewspurr.com']
const SALES_REPS = ['jesse@', 'briana@', 'pia@']
const GAS = ['sebastian@', 'stefen@', 'jc@', 'zu@']
const ONBOARDING_HOSTS = ['lada@', 'sebastian@', 'zu@']

function classifyCall(meeting, participants, ghlMatch) {
  const topic = (meeting.topic || '').toLowerCase()
  // Support both API format (user_email) and stored DB format (email)
  const hostEmail = (meeting.host_email || '').toLowerCase()
  const participantEmails = (participants || []).map(p => (p.user_email || p.email || '').toLowerCase())
  const allEmails = [hostEmail, ...participantEmails].filter(Boolean)

  // Count GYC staff vs external
  const gycCount = allEmails.filter(e => GYC_EMAILS.some(d => e.includes(d))).length
  const externalCount = allEmails.filter(e => e && !GYC_EMAILS.some(d => e.includes(d))).length

  // Rule 1: GHL pipeline match → most reliable
  if (ghlMatch?.pipeline === 'GYC Sales') return { type: 'sales', confidence: 0.90 }
  if (ghlMatch?.pipeline === 'Client Stage' && ghlMatch?.stage === 'Onboarding') return { type: 'onboarding', confidence: 0.90 }
  if (ghlMatch?.pipeline === 'Client Stage') return { type: 'client_meeting', confidence: 0.85 }

  // Rule 2: Topic keywords
  if (/blueprint/i.test(topic)) return { type: 'blueprint', confidence: 0.85 }
  if (/onboard|kickoff|kick.off|vision call/i.test(topic)) return { type: 'onboarding', confidence: 0.80 }
  if (/marketing review|growth advisor|monthly meeting|client meeting/i.test(topic)) return { type: 'client_meeting', confidence: 0.80 }
  if (/sales|discovery|demo|intro call/i.test(topic)) return { type: 'sales', confidence: 0.75 }
  if (/marketing consultation|strategy consult|strategy call|follow.?up.*grow your center/i.test(topic)) return { type: 'sales', confidence: 0.75 }
  if (/grow your center|gyc/i.test(topic) && /\|/.test(topic)) return { type: 'sales', confidence: 0.65 }
  if (/review.*meta|review.*disney|review.*ads|paid media|office hours/i.test(topic)) return { type: 'client_meeting', confidence: 0.70 }
  if (/l10|team meeting|standup|all.team|all staff|stand up/i.test(topic)) return { type: 'internal', confidence: 0.80 }
  if (/1.1|one.on.one|check.in|check in/i.test(topic)) return { type: 'one_on_one', confidence: 0.75 }

  // Rule 3: Host-based rules (with participant data)
  if (SALES_REPS.some(r => hostEmail.includes(r)) && externalCount >= 1) return { type: 'sales', confidence: 0.70 }
  if (GAS.some(r => hostEmail.includes(r)) && externalCount >= 1) return { type: 'client_meeting', confidence: 0.65 }

  // Rule 4: All internal (everyone on call is GYC)
  if (externalCount === 0 && gycCount >= 2) return { type: 'internal', confidence: 0.70 }

  // Rule 5: No participant data but host email known — infer from host role
  const noParticipantData = participantEmails.filter(Boolean).length === 0
  if (noParticipantData && hostEmail) {
    if (SALES_REPS.some(r => hostEmail.includes(r))) return { type: 'sales', confidence: 0.60 }
    if (GAS.some(r => hostEmail.includes(r))) return { type: 'client_meeting', confidence: 0.55 }
  }

  // Rule 6: If host email is null but we have participants, infer from participant emails
  if (!hostEmail && participantEmails.length > 0) {
    const inferredHost = participantEmails.find(e => GYC_EMAILS.some(d => e.includes(d))) || ''
    if (SALES_REPS.some(r => inferredHost.includes(r)) && externalCount >= 1) return { type: 'sales', confidence: 0.65 }
    if (GAS.some(r => inferredHost.includes(r)) && externalCount >= 1) return { type: 'client_meeting', confidence: 0.60 }
    if (externalCount === 0 && gycCount >= 2) return { type: 'internal', confidence: 0.65 }
    if (externalCount >= 1 && gycCount >= 1) return { type: 'client_meeting', confidence: 0.55 }
  }

  // Rule 7: External present + GYC host identified
  if (externalCount >= 1 && GAS.some(r => hostEmail.includes(r))) return { type: 'client_meeting', confidence: 0.60 }
  if (externalCount >= 1 && SALES_REPS.some(r => hostEmail.includes(r))) return { type: 'sales', confidence: 0.60 }

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
// ─── ClientProfile lookup ────────────────────────────────────────────────────
/**
 * Given a GHL contact ID, find the matching ClientProfile and return
 * its acronym, id, and assignedGA.
 */
async function lookupClientProfile(ghlContactId) {
  if (!ghlContactId) return null
  try {
    const { rows } = await pool.query(
      `SELECT cp.acronym, cp.id AS "clientProfileId", cp."assignedGA"
       FROM "ClientProfile" cp
       WHERE cp."tenantId" = 'gyc' AND (
         cp."ghlContactId" = $1
         OR cp."stripeCustomerId" = (
           SELECT id FROM "StripeCustomer" WHERE "ghlContactId" = $1 LIMIT 1
         )
       )
       LIMIT 1`,
      [ghlContactId]
    )
    return rows[0] || null
  } catch {
    return null
  }
}

async function upsertZoomCall(record) {
  const {
    id, tenantId, meetingId, topic, hostEmail, hostName, startTime, duration,
    participants, recordingUrl, transcriptUrl, transcriptText,
    aiSummary, aiClassification, aiConfidence,
    ghlContactId, ghlContactName, ghlPipelineStage,
    acronym, clientProfileId,
    status, syncedAt
  } = record

  await pool.query(
    `INSERT INTO "ZoomCall" (
      id, "tenantId", "meetingId", topic, "hostEmail", "hostName", "startTime", duration,
      participants, "recordingUrl", "transcriptUrl", "transcriptText",
      "aiSummary", "aiClassification", "aiConfidence",
      "ghlContactId", "ghlContactName", "ghlPipelineStage",
      "acronym", "clientProfileId",
      status, "syncedAt", "createdAt"
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,NOW())
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
      "acronym" = COALESCE(EXCLUDED."acronym", "ZoomCall"."acronym"),
      "clientProfileId" = COALESCE(EXCLUDED."clientProfileId", "ZoomCall"."clientProfileId"),
      "syncedAt" = EXCLUDED."syncedAt"
    `,
    [id, tenantId, meetingId, topic, hostEmail, hostName, startTime, duration,
     participants ? JSON.stringify(participants) : null,
     recordingUrl, transcriptUrl, transcriptText,
     aiSummary, aiClassification, aiConfidence,
     ghlContactId, ghlContactName, ghlPipelineStage,
     acronym || null, clientProfileId || null,
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

    // GHL cross-reference — search by unique participant emails (skip GYC staff)
    let ghlMatch = null
    const allParticipantEmails = participants
      .map(p => p.user_email || p.email)
      .filter(Boolean)

    ghlMatch = await findGHLContact(allParticipantEmails)
    if (ghlMatch) {
      stats.ghlMatches++
      console.log(`    🔗 GHL match: ${ghlMatch.name} (${ghlMatch.pipeline || 'no pipeline'})`)
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
      // ClientProfile linkage — look up acronym + id via GHL contact
      ...await lookupClientProfile(ghlMatch?.id || null).then(cp => ({
        acronym:         cp?.acronym         || null,
        clientProfileId: cp?.clientProfileId || null,
      })),
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
