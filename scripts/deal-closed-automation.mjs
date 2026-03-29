#!/usr/bin/env node
/**
 * deal-closed-automation.mjs
 * Polls GHL for newly closed-won deals since the last run.
 * When a new deal is found:
 *   1. Slacks Todd + Lada with a structured onboarding checklist
 *   2. Logs to DB (SyncLog) for audit trail
 *   3. Updates state file so we don't double-alert
 *
 * Run via cron: weekdays 09:00 + 13:00 + 17:00 ET
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import pkg from 'pg'

const __dir = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dir, '..')

// Load env
const envPath = join(ROOT, '.env.local')
try {
  const envRaw = readFileSync(envPath, 'utf8')
  for (const line of envRaw.split('\n')) {
    const m = line.match(/^([^=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim()
  }
} catch {}

const STATE_FILE = join(ROOT, '../../workspace/memory/deal-closed-state.json')
const GHL_BASE = 'https://services.leadconnectorhq.com'
const GHL_HEADERS = { 'Authorization': `Bearer ${process.env.GHL_API_KEY}`, 'Version': '2021-07-28' }
const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN || readLineFromSecrets('SLACK_BOT_TOKEN')
const TODD_DM = 'D0AKFMSL1EV'

// Slack user IDs for notifications
const LADA_SLACK = process.env.LADA_SLACK_ID || null // add when known

function readLineFromSecrets(key) {
  try {
    const secrets = readFileSync(join(ROOT, '../workspace/.secrets'), 'utf8')
    const line = secrets.split('\n').find(l => l.startsWith(key + '='))
    return line ? line.split('=')[1].trim() : null
  } catch { return null }
}

function loadState() {
  try { return JSON.parse(readFileSync(STATE_FILE, 'utf8')) }
  catch { return { lastCheckedAt: null, notifiedDealIds: [] } }
}

function saveState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
}

async function ghlFetch(path, params = {}) {
  const url = new URL(`${GHL_BASE}${path}`)
  url.searchParams.set('location_id', process.env.GHL_LOCATION_ID)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))
  const res = await fetch(url.toString(), { headers: GHL_HEADERS })
  if (!res.ok) throw new Error(`GHL ${path} → ${res.status}`)
  return res.json()
}

async function slackSend(channel, text) {
  if (!SLACK_TOKEN) return { ok: false, error: 'no token' }
  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SLACK_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel, text })
  })
  return res.json()
}

async function getNewlyClosedDeals(since) {
  // GHL opportunities/search returns all won opps; we filter by lastStatusChangeAt
  const sinceTs = since ? new Date(since).getTime() : Date.now() - 24 * 3600 * 1000

  let all = []
  let startAfterId = null
  let page = 0

  do {
    const params = { status: 'won', limit: 100 }
    if (startAfterId) params.startAfterId = startAfterId
    const data = await ghlFetch('/opportunities/search', params)
    const opps = data.opportunities || []
    if (!opps.length) break

    for (const opp of opps) {
      const changedAt = new Date(opp.lastStatusChangeAt || opp.createdAt).getTime()
      if (changedAt >= sinceTs) all.push(opp)
    }

    startAfterId = data.meta?.startAfterId || null
    page++
    if (page > 20) break // safety limit
  } while (startAfterId)

  return all
}

function buildOnboardingMessage(deal) {
  const repName = deal.assignedTo || 'Unknown rep'
  const value = deal.monetaryValue ? `$${Number(deal.monetaryValue).toLocaleString()}` : '—'
  const contact = deal.contact?.name || deal.name || 'Unknown client'
  const closedAt = deal.lastStatusChangeAt ? new Date(deal.lastStatusChangeAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Today'

  return `🎉 *New Deal Closed!*

*Client:* ${contact}
*Rep:* ${repName}
*Value:* ${value}
*Closed:* ${closedAt}

*Onboarding Checklist:*
☐ Assign Growth Advisor in GHL
☐ Notify Lada (Production Coordinator) to schedule kickoff
☐ Create Zendesk organization for client
☐ Set up client in GHL CRM with service tags
☐ Send welcome email / onboarding sequence
☐ Schedule kickoff call
☐ Create Asana project from onboarding template

GHL Deal ID: \`${deal.id}\``
}

async function run() {
  const { Pool } = pkg
  const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false } })

  const state = loadState()
  console.log('Last checked:', state.lastCheckedAt || 'never')
  console.log('Previously notified deals:', state.notifiedDealIds?.length || 0)

  let newDeals = []
  try {
    newDeals = await getNewlyClosedDeals(state.lastCheckedAt)
    console.log(`Found ${newDeals.length} won deals since last check`)
  } catch (e) {
    console.error('Failed to fetch GHL deals:', e.message)
    process.exit(1)
  }

  // Filter out already-notified
  const unnotified = newDeals.filter(d => !(state.notifiedDealIds || []).includes(d.id))
  console.log(`New (unnotified): ${unnotified.length}`)

  for (const deal of unnotified) {
    const msg = buildOnboardingMessage(deal)
    console.log('Notifying for deal:', deal.id, deal.name || deal.contact?.name)

    // Slack Todd
    const toddResult = await slackSend(TODD_DM, msg)
    console.log('Todd Slack:', toddResult.ok ? 'sent' : toddResult.error)

    // Slack Lada if we have her ID
    if (LADA_SLACK) {
      await slackSend(LADA_SLACK, msg)
    }

    // Log to DB
    try {
      await pool.query(
        `INSERT INTO "SyncLog" (source, status, message, "syncedAt") VALUES ($1, $2, $3, NOW())`,
        ['deal-closed-trigger', 'success', `Deal closed: ${deal.contact?.name || deal.name} (${deal.id}) — onboarding notification sent`]
      )
    } catch (e) {
      console.error('DB log failed:', e.message)
    }
  }

  // Update state
  const newNotified = [...new Set([...(state.notifiedDealIds || []), ...unnotified.map(d => d.id)])]
  // Keep last 500 to avoid unbounded growth
  saveState({ lastCheckedAt: new Date().toISOString(), notifiedDealIds: newNotified.slice(-500) })

  await pool.end()
  console.log('Done.')
  process.exit(0)
}

run().catch(e => { console.error(e); process.exit(1) })
