import { NextResponse } from 'next/server'
import { getRepData, parseRepSheet } from '@/lib/sheets'

const PRIMARY_REPS = ['Jesse', 'Briana']
const OUTBOUND_REPS = ['Pia']
const GROWTH_ADVISORS = ['Sebastian', 'Stefen', 'JC', 'Zu']

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
  if (!userId) return { today: 0, week: 0, month: 0 }

  const allWon = await fetchAllGhlWon()
  // Filter to this rep — assigned_to must match
  const repWon = allWon.filter(o => o.assignedTo === userId)

  const now = new Date()
  const todayStart = new Date(now); todayStart.setHours(0,0,0,0)
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1))
  weekStart.setHours(0,0,0,0)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  // Only count deals created AND won in the same period (excludes prior-month pipeline)
  const countInPeriod = (start) => repWon.filter(o => {
    const created = new Date(o.createdAt)
    const won = new Date(o.lastStatusChangeAt)
    return created >= start && won >= start
  }).length

  return {
    today: countInPeriod(todayStart),
    week:  countInPeriod(weekStart),
    month: countInPeriod(monthStart),
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

    allReps.forEach((rep, i) => {
      const sheetMetrics = sheetResults[i]
      if (!sheetMetrics) return

      // Conversion Rate = GHL Closed Won / Shown (includes follow-up closes)
      // Close Rate = Agreements Closed / Shown (same-session closes)
      const shown = sheetMetrics['Shown'] || { today: 0, week: 0, month: 0 }
      const won = ghlWon[rep] || { today: 0, week: 0, month: 0 }

      sheetMetrics['Conversion Rate'] = {
        today: shown.today > 0 ? won.today / shown.today : 0,
        week:  shown.week  > 0 ? won.week  / shown.week  : 0,
        month: shown.month > 0 ? won.month / shown.month : 0,
      }

      // Add GHL won counts as a separate metric for transparency
      sheetMetrics['GHL Closed Won'] = won

      // Close Rate = Agreements Closed / Shown (same-session closes)
      const agrClosed = sheetMetrics['Agreements Closed'] || { today: 0, week: 0, month: 0 }
      sheetMetrics['Close Rate'] = {
        today: shown.today > 0 ? agrClosed.today / shown.today : 0,
        week:  shown.week  > 0 ? agrClosed.week  / shown.week  : 0,
        month: shown.month > 0 ? agrClosed.month / shown.month : 0,
      }

      repData[rep] = sheetMetrics
      repFlags[rep] = getDataFlags(rep, sheetMetrics)
    })

    // Team totals (Jesse + Briana)
    const teamMetrics = {}
    for (const metric of Object.keys(DAILY_TARGETS)) {
      const isRate = RATE_METRICS.has(metric)
      if (isRate) {
        const periods = ['today', 'week', 'month']
        const out = {}
        for (const period of periods) {
          const vals = PRIMARY_REPS
            .map(r => repData[r]?.[metric]?.[period] || 0)
            .filter(v => v > 0)
          out[period] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
        }
        teamMetrics[metric] = out
      } else {
        teamMetrics[metric] = {
          today: PRIMARY_REPS.reduce((sum, r) => sum + (repData[r]?.[metric]?.today || 0), 0),
          week:  PRIMARY_REPS.reduce((sum, r) => sum + (repData[r]?.[metric]?.week  || 0), 0),
          month: PRIMARY_REPS.reduce((sum, r) => sum + (repData[r]?.[metric]?.month || 0), 0),
        }
      }
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
