#!/usr/bin/env node
/**
 * reclassify-zoom-calls.mjs
 * Re-runs improved classification logic against all ZoomCall records
 * that have participant data stored, and updates aiClassification + aiConfidence.
 * 
 * Does NOT overwrite manually confirmed classifications (status = 'classified').
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

// ─── Classification constants ────────────────────────────────────────────────
const GYC_EMAILS = ['@growyourcenter.com', 'unstoppable@brucewspurr.com']
const SALES_REPS = ['jesse@', 'briana@', 'pia@']
const GAS        = ['sebastian@', 'stefen@', 'jc@', 'zu@']

function classifyCall(record) {
  const topic        = (record.topic || '').toLowerCase()
  const hostEmail    = (record.hostEmail || '').toLowerCase()
  // Participants stored as [{name, email, duration}] in DB
  const storedParts  = (() => {
    try {
      return typeof record.participants === 'string'
        ? JSON.parse(record.participants)
        : (record.participants || [])
    } catch { return [] }
  })()

  const participantEmails = storedParts.map(p => (p.email || p.user_email || '').toLowerCase())
  const allEmails = [hostEmail, ...participantEmails].filter(Boolean)

  const gycCount      = allEmails.filter(e => GYC_EMAILS.some(d => e.includes(d))).length
  const externalCount = allEmails.filter(e => e && !GYC_EMAILS.some(d => e.includes(d))).length

  // GHL pipeline — stored in ghlPipelineStage column
  const pipeline = (record.ghlPipelineStage || '').toLowerCase()
  if (pipeline.includes('sales'))              return { type: 'sales',          confidence: 0.90 }
  if (pipeline.includes('onboarding'))         return { type: 'onboarding',     confidence: 0.90 }
  if (pipeline.includes('client'))             return { type: 'client_meeting', confidence: 0.85 }

  // Topic keywords
  if (/blueprint/i.test(topic))                                                        return { type: 'blueprint',       confidence: 0.85 }
  if (/onboard|kickoff|kick.off|vision call/i.test(topic))                             return { type: 'onboarding',      confidence: 0.80 }
  if (/marketing review|growth advisor|monthly meeting|client meeting/i.test(topic))  return { type: 'client_meeting',  confidence: 0.80 }
  if (/sales|discovery|demo|intro call/i.test(topic))                                 return { type: 'sales',           confidence: 0.75 }
  if (/marketing consultation|strategy consult|strategy call|follow.?up.*grow your center/i.test(topic)) return { type: 'sales', confidence: 0.75 }
  if (/grow your center|gyc/i.test(topic) && /\|/.test(topic))                        return { type: 'sales',           confidence: 0.65 }
  if (/review.*meta|review.*disney|review.*ads|paid media|office hours/i.test(topic)) return { type: 'client_meeting',  confidence: 0.70 }
  if (/l10|team meeting|standup|all.team|all staff|stand up/i.test(topic))            return { type: 'internal',        confidence: 0.80 }
  if (/1.1|one.on.one|check.in|check in/i.test(topic))                               return { type: 'one_on_one',      confidence: 0.75 }

  // Host-based rules (with participant data)
  if (hostEmail) {
    if (SALES_REPS.some(r => hostEmail.includes(r)) && externalCount >= 1) return { type: 'sales',          confidence: 0.70 }
    if (GAS.some(r => hostEmail.includes(r))        && externalCount >= 1) return { type: 'client_meeting', confidence: 0.65 }
  }

  // All internal
  if (externalCount === 0 && gycCount >= 2) return { type: 'internal', confidence: 0.70 }

  // No participant data but host email known — infer from host role
  const noParticipantData = participantEmails.filter(Boolean).length === 0
  if (noParticipantData && hostEmail) {
    if (SALES_REPS.some(r => hostEmail.includes(r))) return { type: 'sales',          confidence: 0.60 }
    if (GAS.some(r => hostEmail.includes(r)))        return { type: 'client_meeting', confidence: 0.55 }
  }

  // No hostEmail — infer from participants
  if (!hostEmail && participantEmails.length > 0) {
    const inferredHost = participantEmails.find(e => GYC_EMAILS.some(d => e.includes(d))) || ''
    if (SALES_REPS.some(r => inferredHost.includes(r)) && externalCount >= 1) return { type: 'sales',          confidence: 0.65 }
    if (GAS.some(r => inferredHost.includes(r))        && externalCount >= 1) return { type: 'client_meeting', confidence: 0.60 }
    if (externalCount === 0 && gycCount >= 2)                                   return { type: 'internal',        confidence: 0.65 }
    // GYC + external → likely a client call
    if (externalCount >= 1 && gycCount >= 1)                                    return { type: 'client_meeting', confidence: 0.55 }
  }

  // External present, GYC host identified
  if (externalCount >= 1 && GAS.some(r => hostEmail.includes(r)))        return { type: 'client_meeting', confidence: 0.60 }
  if (externalCount >= 1 && SALES_REPS.some(r => hostEmail.includes(r))) return { type: 'sales',          confidence: 0.60 }

  return { type: 'unknown', confidence: 0.0 }
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔄 Reclassify Zoom Calls\n')

  // Fetch all calls that haven't been manually confirmed
  const { rows: calls } = await pool.query(`
    SELECT id, topic, "hostEmail", participants, "ghlPipelineStage",
           "aiClassification", "aiConfidence", duration, "recordingUrl"
    FROM "ZoomCall"
    WHERE status != 'classified'
      AND "tenantId" = 'gyc'
    ORDER BY "startTime" DESC
  `)

  console.log(`Found ${calls.length} unconfirmed calls to re-classify\n`)

  const stats = { updated: 0, unchanged: 0, byType: {} }
  const batchSize = 50

  for (let i = 0; i < calls.length; i += batchSize) {
    const batch = calls.slice(i, i + batchSize)
    for (const call of batch) {
      const result = classifyCall(call)

      // Track stats
      stats.byType[result.type] = (stats.byType[result.type] || 0) + 1

      // Only update if classification changed or confidence improved
      const changed = call.aiClassification !== result.type ||
                      Math.abs((call.aiConfidence || 0) - result.confidence) > 0.01

      if (changed) {
        await pool.query(
          `UPDATE "ZoomCall" SET "aiClassification" = $1, "aiConfidence" = $2 WHERE id = $3`,
          [result.type, result.confidence, call.id]
        )
        stats.updated++
      } else {
        stats.unchanged++
      }
    }
    process.stdout.write(`  Progress: ${Math.min(i + batchSize, calls.length)}/${calls.length}\r`)
  }

  console.log(`\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`✅ Updated:   ${stats.updated}`)
  console.log(`⏭  Unchanged: ${stats.unchanged}`)
  console.log(`\n📊 Classification breakdown (all unconfirmed calls):`)
  const sorted = Object.entries(stats.byType).sort((a, b) => b[1] - a[1])
  for (const [type, count] of sorted) {
    const bar = '█'.repeat(Math.round(count / calls.length * 30))
    console.log(`   ${type.padEnd(18)} ${String(count).padStart(4)}  ${bar}`)
  }
  console.log()

  await pool.end()
}

main().catch(async err => {
  console.error('Fatal:', err.message)
  await pool.end()
  process.exit(1)
})
