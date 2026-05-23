export const dynamic = 'force-dynamic'


import { NextResponse } from 'next/server'
import { getRepData, parseRepSheet } from '@/lib/sheets'

const PRIMARY_REPS = ['Jesse']              // Active sales reps with targets
const OUTBOUND_REPS = []                       // Pia: on team but no targets set yet — re-add when active
const GROWTH_ADVISORS = ['Briana', 'Sebastian', 'Stefen', 'JC', 'Zu']  // Briana moved to GA (Website-only clients)

// GHL user IDs per rep — Conversion Rate numerator comes from GHL Closed Won
const GHL_USER_IDS = {
  'Jesse':     'veHn1vMej8ag3oRNSMF7',
  'Briana':    'Ipb94f9KRyRNdYIJg9qj',
  'Pia':       'jhz6BcMXfwsEBVCnQ3vE',
  'Sebastian': 'aLNgIwcEWCJdhNm5JnIe',
  'Stefen':    'fx0YBhilsXDaK4O3ng5R',
  'JC':        'hlGC7GYOch0y2ErjmJF1',
  'Zu':        'UUMCvAlAtwakqEkse8Rl',
}

const DAILY_TARGETS = {
  'Scheduled Calls': 12,
  'New Inbound': 8,
  'Follow ups': 4,
  'Outbound Activity': 12,
  'Shown': 7,
  'No Show': 5,
  'Show Rate': 0.58,
  'Cancelled': 1,
  'Rebooked': 4,
  'Agreements Sent': 6,
  'Close Rate': 0.3333,
  'Conversion Rate': 0.3333,
}

const WEEKLY_TARGETS = {
  'Scheduled Calls': 60,
  'New Inbound': 40,
  'Follow ups': 20,
  'Outbound Activity': 60,
  'Shown': 35,
  'No Show': 25,
  'Show Rate': 0.58,
  'Cancelled': 5,
  'Rebooked': 20,
  'Agreements Sent': 30,
  'Close Rate': 0.3333,
  'Conversion Rate': 0.3333,
}

const MONTHLY_TARGETS = {
  'Scheduled Calls': 240,
  'Shown': 140,
  'Agreements Sent': 120,
  'Show Rate': 0.58,
  'Close Rate': 0.3333,
  'Conversion Rate': 0.3333,
}

const RATE_METRICS = new Set(['Show Rate', 'Conversion Rate', 'Close Rate'])

// Cache all GHL won deals at request time (assigned_to filter is ignored by GHL API)
let _ghlWonCache = null
async function fetchAllGhlWon() {
  if (_ghlWonCache) return _ghlWonCache

  const GHL_BASE = 'https://services.leadconnectorhq.com'
  const headers = {
    'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
    'Version': '2021-07-28',
  }

  let allWon = []
  let cursor = null
  let seen = new Set()

  do {
    const params = new URLSearchParams({
      location_id: process.env.GHL_LOCATION_ID,
      status: 'won',
      limit: '100',
      ...(cursor ? { startAfter: cursor } : {})
    })
    const res = await fetch(`${GHL_BASE}/opportunities/search?${params}`, { headers })
    const data = await res.json()
    const opps = data.opportunities || []
    if (!opps.length) break

    // Deduplicate to prevent infinite loops
    let newCount = 0
    for (const o of opps) {
      if (!seen.has(o.id)) { seen.add(o.id); allWon.push(o); newCount++ }
    }
    if (newCount === 0) break

    cursor = data.meta?.nextPageUrl ? opps[opps.length - 1]?.id : null
  } while (cursor)

  _ghlWonCache = allWon
  return allWon
}

// Get Closed Won counts for a specific rep, filtered by period
async function getGhlClosedWon(repName) {
  const userId = GHL_USER_IDS[repName]
  if (!userId) return { today: 0, week: 0, month: 0, lastMonth: 0, q1: 0, q2: 0, q3: 0, q4: 0, ytd: 0 }

  const allWon = await fetchAllGhlWon()
  // Filter to this rep — assigned_to must match
  const repWon = allWon.filter(o => o.assignedTo === userId)

  const now = new Date()
  const yr = now.getFullYear()
  const todayStart = new Date(now); todayStart.setHours(0,0,0,0)
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1))
  weekStart.setHours(0,0,0,0)
  const monthStart    = new Date(yr, now.getMonth(), 1)
  const lastMonthStart = new Date(yr, now.getMonth() - 1, 1)
  const lastMonthEnd   = new Date(yr, now.getMonth(), 0, 23, 59, 59)
  const Q1_START = new Date(yr, 0, 1),  Q1_END = new Date(yr, 2, 31, 23, 59, 59)
  const Q2_START = new Date(yr, 3, 1),  Q2_END = new Date(yr, 5, 30, 23, 59, 59)
  const Q3_START = new Date(yr, 6, 1),  Q3_END = new Date(yr, 8, 30, 23, 59, 59)
  const Q4_START = new Date(yr, 9, 1),  Q4_END = new Date(yr, 11, 31, 23, 59, 59)
  const YTD_START = new Date(yr, 0, 1)

  // Only count deals created AND won in the same period (excludes prior-month pipeline)
  const countInPeriod = (start, end = now) => repWon.filter(o => {
    const created = new Date(o.createdAt)
    const won = new Date(o.lastStatusChangeAt)
    return created >= start && created <= end && won >= start && won <= end
  }).length

  return {
    today:     countInPeriod(todayStart),
    week:      countInPeriod(weekStart),
    month:     countInPeriod(monthStart),
    lastMonth: countInPeriod(lastMonthStart, lastMonthEnd),
    q1:        countInPeriod(Q1_START, Q1_END),
    q2:        countInPeriod(Q2_START, Q2_END),
    q3:        countInPeriod(Q3_START, Q3_END),
    q4:        countInPeriod(Q4_START, Q4_END),
    ytd:       countInPeriod(YTD_START),
  }
}

// Data quality flags — check for implausible entries
function getDataFlags(repName, metrics) {
  const flags = []
  const shown = metrics['Shown']
  const scheduled = metrics['Scheduled Calls']
  const noShow = metrics['No Show']

  // Shown > Scheduled (impossible)
  if (shown?.month > scheduled?.month && scheduled?.month > 0) {
    flags.push(`Shown (${shown.month}) > Scheduled Calls (${scheduled.month}) — impossible`)
  }
  // Shown + No Show > Scheduled (over-counting)
  if ((shown?.month + noShow?.month) > (scheduled?.month * 1.1) && scheduled?.month > 0) {
    flags.push(`Shown + No Shows (${shown.month + noShow.month}) exceeds Scheduled Calls (${scheduled.month})`)
  }
  // Scheduled calls way higher than expected (> 25/day average this month)
  const now = new Date()
  const daysIntoMonth = now.getDate()
  if (scheduled?.month > daysIntoMonth * 25) {
    flags.push(`Scheduled Calls (${scheduled.month}) looks inflated for ${daysIntoMonth} days`)
  }

  return flags
}

async function fetchRep(rep) {
  try {
    const rows = await getRepData(rep)
    return parseRepSheet(rows)
  } catch {
    return null
  }
}

export async function GET() {
  try {
    const allReps = [...PRIMARY_REPS, ...OUTBOUND_REPS, ...GROWTH_ADVISORS]

    // Fetch sheet data + GHL closed won in parallel
    const [sheetResults, ghlWonResults] = await Promise.all([
      Promise.all(allReps.map(rep => fetchRep(rep))),
      Promise.all(allReps.map(rep => getGhlClosedWon(rep)))
    ])

    const ghlWon = {}
    allReps.forEach((rep, i) => { ghlWon[rep] = ghlWonResults[i] })

    const repData = {}
    const repFlags = {}

    const ALL_PERIODS = ['today', 'week', 'month', 'lastMonth', 'q1', 'q2', 'q3', 'q4', 'ytd']

    allReps.forEach((rep, i) => {
      const sheetMetrics = sheetResults[i]
      if (!sheetMetrics) return

      // Conversion Rate = GHL Closed Won / Shown (includes follow-up closes)
      const shown = sheetMetrics['Shown'] || {}
      const won   = ghlWon[rep]           || {}

      const convRate = {}
      const closeRate = {}
      const agrClosed = sheetMetrics['Agreements Closed'] || {}
      for (const p of ALL_PERIODS) {
        convRate[p]  = (shown[p] || 0) > 0 ? (won[p]       || 0) / shown[p] : 0
        closeRate[p] = (shown[p] || 0) > 0 ? (agrClosed[p] || 0) / shown[p] : 0
      }

      sheetMetrics['Conversion Rate'] = convRate
      sheetMetrics['GHL Closed Won']  = won
      sheetMetrics['Close Rate']      = closeRate

      repData[rep]  = sheetMetrics
      repFlags[rep] = getDataFlags(rep, sheetMetrics)
    })

    // Team totals — Jesse only (active sales rep as of May 2026)
    const teamMetrics = {}
    for (const metric of Object.keys(DAILY_TARGETS)) {
      const isRate = RATE_METRICS.has(metric)
      const out = {}
      for (const period of ALL_PERIODS) {
        if (isRate) {
          const vals = PRIMARY_REPS
            .map(r => repData[r]?.[metric]?.[period] || 0)
            .filter(v => v > 0)
          out[period] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
        } else {
          out[period] = PRIMARY_REPS.reduce((sum, r) => sum + (repData[r]?.[metric]?.[period] || 0), 0)
        }
      }
      teamMetrics[metric] = out
    }

    return NextResponse.json({
      team: {
        metrics: teamMetrics,
        targets: { daily: DAILY_TARGETS, weekly: WEEKLY_TARGETS, monthly: MONTHLY_TARGETS }
      },
      reps: repData,
      repFlags,
      primaryReps: PRIMARY_REPS,
      outboundReps: OUTBOUND_REPS,
      growthAdvisors: GROWTH_ADVISORS,
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
