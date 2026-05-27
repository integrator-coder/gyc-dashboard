#!/usr/bin/env node
/**
 * generate-call-recaps.mjs
 * Generates meeting recaps and follow-up email drafts for client Zoom calls
 * using OpenAI to analyze call transcripts.
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

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY not found in environment')
  process.exit(1)
}

// ─── Generate Recap via OpenAI ──────────────────────────────────────────────
async function generateRecap(call, transcript, clientProfile) {
  const prompt = `You are a professional meeting analyst for a childcare marketing company (GYC).

Analyze the following Zoom call transcript and generate a structured recap and follow-up email.

**Call Details:**
- Topic: ${call.topic || 'N/A'}
- Date: ${call.startTime ? new Date(call.startTime).toLocaleDateString() : 'N/A'}
- Duration: ${call.duration || 'N/A'} minutes
- Client: ${clientProfile.companyName}
- Owner: ${clientProfile.ownerName || 'N/A'}
- Growth Advisor: ${clientProfile.assignedGA || 'N/A'}
- GA Email: ${clientProfile.assignedGAEmail || 'N/A'}

**Transcript:**
${transcript}

---

Generate two outputs:

1. **Meeting Recap JSON** (must be valid JSON):
{
  "summary": "2-3 sentence overview of the call",
  "keyPoints": ["key point 1", "key point 2", "..."],
  "actionItems": [
    {"item": "...", "owner": "client|ga|both", "deadline": "YYYY-MM-DD or 'TBD'"}
  ],
  "clientSentiment": "positive|neutral|concerned",
  "callType": "marketing_review|onboarding|strategy|other"
}

2. **Follow-up Email Draft** (complete professional email):
Subject: [Appropriate subject line]

Hi [Client Owner First Name],

[Brief warm opening paragraph]

[Recap paragraph highlighting key discussion points]

**Action Items:**
- [List action items with owners and deadlines]

[Warm closing]

Best,
[GA Name]

---

Return your response in this exact format:

RECAP_JSON:
{...json here...}

EMAIL_DRAFT:
Subject: ...
[email content]
`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error('No content in OpenAI response')
    }

    // Parse the response
    const recapMatch = content.match(/RECAP_JSON:\s*(\{[\s\S]*?\})\s*EMAIL_DRAFT:/i)
    const emailMatch = content.match(/EMAIL_DRAFT:\s*([\s\S]+)$/i)

    if (!recapMatch || !emailMatch) {
      throw new Error('Failed to parse OpenAI response format')
    }

    const recapJson = JSON.parse(recapMatch[1].trim())
    const emailDraft = emailMatch[1].trim()

    return { recapJson, emailDraft }
  } catch (err) {
    console.error(`   ⚠️  OpenAI error for call ${call.id}: ${err.message}`)
    return null
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔄 Generating Meeting Recaps\n')

  // Fetch calls that need recaps
  const { rows: calls } = await pool.query(`
    SELECT 
      zc.id,
      zc.topic,
      zc."startTime",
      zc.duration,
      zc.acronym,
      zc."aiClassification",
      zt."vttRaw" as transcript
    FROM "ZoomCall" zc
    JOIN "ZoomTranscript" zt ON zt."zoomCallId"::text = zc.id::text
    WHERE zc."aiClassification" IN ('client_meeting', 'onboarding', 'blueprint')
      AND zc.acronym IS NOT NULL
      AND zc."meetingRecap" IS NULL
      AND zc."tenantId" = 'gyc'
      AND zt."vttRaw" IS NOT NULL
    ORDER BY zc."startTime" DESC
    LIMIT 50
  `)

  console.log(`Found ${calls.length} calls to process\n`)

  if (calls.length === 0) {
    console.log('✅ No calls need processing\n')
    await pool.end()
    return
  }

  const stats = { success: 0, failed: 0, skipped: 0 }

  for (let i = 0; i < calls.length; i++) {
    const call = calls[i]
    const progress = `[${i + 1}/${calls.length}]`

    // Get client profile
    const { rows: profiles } = await pool.query(`
      SELECT "companyName", "ownerName", "assignedGA", "assignedGAEmail"
      FROM "ClientProfile"
      WHERE acronym = $1 AND "tenantId" = 'gyc'
      LIMIT 1
    `, [call.acronym])

    if (profiles.length === 0) {
      console.log(`${progress} ⏭  Skipped (no client profile): ${call.acronym}`)
      stats.skipped++
      continue
    }

    const clientProfile = profiles[0]
    console.log(`${progress} Processing: ${call.topic || 'Untitled'} (${call.acronym})`)

    // Generate recap
    const result = await generateRecap(call, call.transcript, clientProfile)

    if (!result) {
      stats.failed++
      continue
    }

    // Store in database
    await pool.query(`
      UPDATE "ZoomCall"
      SET 
        "meetingRecap" = $1,
        "followUpEmailDraft" = $2,
        "recapGeneratedAt" = NOW()
      WHERE id = $3
    `, [JSON.stringify(result.recapJson), result.emailDraft, call.id])

    console.log(`   ✅ Generated recap and email draft`)
    stats.success++

    // Rate limit: 1 second between calls
    if (i < calls.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`✅ Success:  ${stats.success}`)
  console.log(`❌ Failed:   ${stats.failed}`)
  console.log(`⏭  Skipped:  ${stats.skipped}`)
  console.log()

  await pool.end()
}

main().catch(async err => {
  console.error('Fatal:', err.message)
  await pool.end()
  process.exit(1)
})
