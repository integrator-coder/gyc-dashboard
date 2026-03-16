// scripts/flag-sales-data.js
// Checks sales sheet data against GHL actuals and sends Slack flags to Todd
const { PrismaClient } = require('@prisma/client')

const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN
const TODD_USER_ID = 'U02TPD9D4DN'

const GHL_BASE = 'https://services.leadconnectorhq.com'
const GHL_KEY = process.env.GHL_API_KEY
const GHL_LOC = process.env.GHL_LOCATION_ID

const GHL_USER_IDS = {
  'Jesse':  'veHn1vMej8ag3oRNSMF7',
  'Briana': 'Ipb94f9KRyRNdYIJg9qj',
  'Pia':    'jhz6BcMXfwsEBVCnQ3vE',
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function sendSlack(text) {
  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SLACK_TOKEN}`, 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ channel: TODD_USER_ID, text })
  })
  return res.json()
}

async function getGhlWonThisMonth() {
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  let allWon = [], cursor = null, seen = new Set()
  do {
    const params = new URLSearchParams({ location_id: GHL_LOC, status: 'won', limit: '100', ...(cursor ? { startAfter: cursor } : {}) })
    const res = await fetch(`${GHL_BASE}/opportunities/search?${params}`, {
      headers: { 'Authorization': `Bearer ${GHL_KEY}`, 'Version': '2021-07-28' }
    })
    const data = await res.json()
    const opps = data.opportunities || []
    if (!opps.length) break
    let newCount = 0
    for (const o of opps) { if (!seen.has(o.id)) { seen.add(o.id); allWon.push(o); newCount++ } }
    if (newCount === 0) break
    cursor = data.meta?.nextPageUrl ? opps[opps.length - 1]?.id : null
  } while (cursor)

  // Filter: created AND won this month
  const byRep = {}
  for (const o of allWon) {
    const created = new Date(o.createdAt)
    const won = new Date(o.lastStatusChangeAt)
    if (created >= monthStart && won >= monthStart) {
      const rep = o.assignedTo
      byRep[rep] = (byRep[rep] || 0) + 1
    }
  }
  return byRep
}

async function getSheetMetrics() {
  // Hit the dashboard API to get sheet metrics
  try {
    const res = await fetch('http://localhost:3000/api/metrics/sales')
    const data = await res.json()
    return data.reps || {}
  } catch {
    return {}
  }
}

async function main() {
  console.log('🔍 Checking sales data quality...')

  const [ghlWon, sheetReps] = await Promise.all([
    getGhlWonThisMonth(),
    getSheetMetrics()
  ])

  const flags = []
  const now = new Date()
  const monthName = now.toLocaleString('default', { month: 'long' })
  const daysIn = now.getDate()

  for (const [rep, userId] of Object.entries(GHL_USER_IDS)) {
    const metrics = sheetReps[rep]
    if (!metrics) continue

    const scheduled = metrics['Scheduled Calls']?.month || 0
    const shown = metrics['Shown']?.month || 0
    const noShow = metrics['No Show']?.month || 0
    const ghlClosed = ghlWon[userId] || 0
    const sheetClosed = metrics['Agreements Closed']?.month || 0

    const repFlags = []

    // Sheet shows > scheduled (impossible)
    if (shown > scheduled && scheduled > 0)
      repFlags.push(`Shown (${shown}) > Scheduled Calls (${scheduled}) — impossible`)

    // Sheet closed ≠ GHL closed (mismatch)
    if (sheetClosed !== ghlClosed && (sheetClosed > 0 || ghlClosed > 0))
      repFlags.push(`Sheet shows ${sheetClosed} closed but GHL has ${ghlClosed} Closed Won`)

    // Show rate > 90% seems very high
    const showRate = scheduled > 0 ? shown / scheduled : 0
    if (showRate > 0.90 && scheduled >= 5)
      repFlags.push(`Show Rate ${(showRate*100).toFixed(0)}% — unusually high, verify data`)

    // Scheduled calls per day avg very high (> 10/day)
    const avgPerDay = daysIn > 0 ? scheduled / daysIn : 0
    if (avgPerDay > 10)
      repFlags.push(`Avg ${avgPerDay.toFixed(1)} scheduled calls/day — may be inflated`)

    // No entries at all for an active rep mid-month
    if (scheduled === 0 && daysIn > 5)
      repFlags.push(`No data entered yet this month`)

    if (repFlags.length) flags.push({ rep, repFlags, scheduled, shown, ghlClosed, sheetClosed })
  }

  if (flags.length === 0) {
    console.log('✅ No data quality issues found')
    return
  }

  // Build Slack message
  let msg = `📊 *Sales Data Quality Check — ${monthName}*\n\n`
  for (const { rep, repFlags, scheduled, shown, ghlClosed, sheetClosed } of flags) {
    msg += `*${rep}* (${daysIn} days in)\n`
    msg += `  Sheet: ${scheduled} scheduled · ${shown} shown · ${sheetClosed} closed\n`
    msg += `  GHL: ${ghlClosed} Closed Won\n`
    for (const f of repFlags) msg += `  ⚠️ ${f}\n`
    msg += '\n'
  }
  msg += '_Review with reps to ensure accurate data entry._'

  console.log('Sending Slack alert...')
  const result = await sendSlack(msg)
  console.log(result.ok ? '✅ Slack sent' : `❌ Slack error: ${result.error}`)
}

main().catch(e => { console.error('Error:', e.message); process.exit(1) })
