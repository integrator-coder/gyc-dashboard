// scripts/sync-zendesk.js — pulls Zendesk data and stores a snapshot in SQLite
require('dotenv').config({ path: '.env.local' })
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const SUBDOMAIN = process.env.ZENDESK_SUBDOMAIN || 'gycawesome'
const EMAIL = process.env.ZENDESK_EMAIL
const TOKEN = process.env.ZENDESK_API_TOKEN
const BASE = `https://${SUBDOMAIN}.zendesk.com/api/v2`
const AUTH = 'Basic ' + Buffer.from(`${EMAIL}/token:${TOKEN}`).toString('base64')

// Growth Advisor name fragments to match against Zendesk display names
const GA_NAMES = ['Sebastian', 'Stefen', 'JC', 'Zu']

async function zFetch(path) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`
  const res = await fetch(url, {
    headers: { Authorization: AUTH, 'Content-Type': 'application/json' }
  })
  if (!res.ok) throw new Error(`Zendesk ${res.status}: ${path}`)
  return res.json()
}

async function countQuery(query) {
  const d = await zFetch(`/search/count.json?query=${encodeURIComponent(query)}`)
  return d.count || 0
}

function startOfMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

function calcStats(values) {
  if (!values.length) return { mean: 0, median: 0, mode: 0 }
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
  const freq = {}
  for (const h of values) {
    const key = Math.round(h)
    freq[key] = (freq[key] || 0) + 1
  }
  let mode = 0, maxF = 0
  for (const [val, cnt] of Object.entries(freq)) {
    if (cnt > maxF) { maxF = cnt; mode = Number(val) }
  }
  return {
    mean: Math.round(mean * 10) / 10,
    median: Math.round(median * 10) / 10,
    mode
  }
}

const BUCKET_DEFS = [
  { label: '< 4h',   minHours: 0,   maxHours: 4   },
  { label: '4–12h',  minHours: 4,   maxHours: 12  },
  { label: '12–24h', minHours: 12,  maxHours: 24  },
  { label: '1–2d',   minHours: 24,  maxHours: 48  },
  { label: '2–3d',   minHours: 48,  maxHours: 72  },
  { label: '3–5d',   minHours: 72,  maxHours: 120 },
  { label: '5–7d',   minHours: 120, maxHours: 168 },
  { label: '> 7d',   minHours: 168, maxHours: Infinity },
]

// Build last 12 month boundaries as { month: "2026-01", start: "2026-01-01", end: "2026-02-01" }
function getLast12Months() {
  const months = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const next = new Date(year, d.getMonth() + 1, 1)
    const nextYear = next.getFullYear()
    const nextMonth = String(next.getMonth() + 1).padStart(2, '0')
    months.push({
      month: `${year}-${month}`,
      start: `${year}-${month}-01`,
      end: `${nextYear}-${nextMonth}-01`,
    })
  }
  return months
}

async function main() {
  console.log('🔄 Syncing Zendesk data...')
  const monthStart = startOfMonth()

  // ── 1. Queue counts ──────────────────────────────────────
  console.log('  Fetching queue counts...')
  const [qNew, qOpen, qPending, qHold] = await Promise.all([
    countQuery('type:ticket status:new'),
    countQuery('type:ticket status:open'),
    countQuery('type:ticket status:pending'),
    countQuery('type:ticket status:hold'),
  ])
  console.log(`  Queue: new=${qNew} open=${qOpen} pending=${qPending} hold=${qHold}`)

  // ── 2. This month ────────────────────────────────────────
  console.log('  Fetching monthly counts...')
  const [created, resolved] = await Promise.all([
    countQuery(`type:ticket created>${monthStart}`),
    countQuery(`type:ticket status:solved solved>${monthStart}`),
  ])
  const resolutionRate = created > 0 ? Math.round((resolved / created) * 1000) / 10 : 0
  console.log(`  This month: created=${created} resolved=${resolved} rate=${resolutionRate}%`)

  // ── 3. By type ───────────────────────────────────────────
  console.log('  Fetching by-type counts...')
  const typeKeys = ['website_build', 'website_helpdesk', 'smm', 'google_ads', 'crm']
  const typeCounts = {}
  await Promise.all(typeKeys.map(async (t) => {
    typeCounts[t] = await countQuery(`type:ticket tags:${t}`)
  }))
  console.log('  By type:', typeCounts)

  // ── 4. Resolution time distribution ─────────────────────
  console.log('  Fetching resolution time data (up to 500 tickets)...')
  const allHours = []
  let nextUrl = `${BASE}/search.json?query=${encodeURIComponent('type:ticket status:closed')}&per_page=100&sort_by=updated_at&sort_order=desc`
  let page = 0
  while (nextUrl && page < 5) {
    const data = await zFetch(nextUrl)
    for (const t of data.results || []) {
      if (t.created_at && t.updated_at) {
        const hours = (new Date(t.updated_at) - new Date(t.created_at)) / 3600000
        if (hours >= 0) allHours.push(hours)
      }
    }
    nextUrl = data.next_page || null
    page++
  }
  const { mean, median, mode } = calcStats(allHours)
  const buckets = BUCKET_DEFS.map(b => ({
    label: b.label,
    minHours: b.minHours,
    maxHours: b.maxHours === Infinity ? 99999 : b.maxHours,
    count: allHours.filter(h => h >= b.minHours && h < b.maxHours).length,
  }))
  console.log(`  Resolution: mean=${mean}h median=${median}h mode=${mode}h sample=${allHours.length}`)

  // ── 5. Monthly ticket volume (last 12 months) ─────────────
  console.log('  Fetching monthly ticket volume (last 12 months)...')
  const last12 = getLast12Months()
  const monthlyVolumes = []
  for (const { month, start, end } of last12) {
    const count = await countQuery(`type:ticket created>${start} created<${end}`)
    monthlyVolumes.push({ month, count })
    process.stdout.write(`    ${month}: ${count}\n`)
  }

  // ── 6. First reply time (via ticket_metrics endpoint, paginated) ──
  console.log('  Fetching first reply time stats...')
  const firstReplyMinutes = []
  let frFailed = false

  try {
    // Fetch ticket metrics directly.
    // This account exposes `reply_time_in_minutes` (not `first_reply_time_in_minutes`).
    let metricsUrl = `${BASE}/ticket_metrics.json?per_page=100`
    let metricsPage = 0
    while (metricsUrl && metricsPage < 30 && firstReplyMinutes.length < 300) {
      const data = await zFetch(metricsUrl)
      for (const m of data.ticket_metrics || []) {
        const mins = m?.reply_time_in_minutes?.calendar
        if (mins && mins > 0) firstReplyMinutes.push(mins)
      }
      metricsUrl = data.next_page || null
      metricsPage++
    }
  } catch (err) {
    console.warn('  ⚠️  First reply time fetch failed:', err.message)
    frFailed = true
  }

  const frStats = calcStats(firstReplyMinutes)
  console.log(`  First reply: mean=${frStats.mean}min median=${frStats.median}min sample=${firstReplyMinutes.length}${frFailed ? ' (failed)' : ''}`)

  // ── 7. Overdue tickets ────────────────────────────────────
  console.log('  Fetching overdue ticket count...')
  let overdueTickets = 0
  try {
    // status<solved means: new, open, pending, hold (all active statuses)
    // due<today means the due_at is in the past
    const today = new Date().toISOString().split('T')[0]
    overdueTickets = await countQuery(`type:ticket status<solved due<${today}`)
  } catch (err) {
    console.warn('  ⚠️  Overdue fetch failed:', err.message)
  }
  console.log(`  Overdue: ${overdueTickets}`)

  // ── 8. Tickets by Growth Advisor ──────────────────────────
  console.log('  Fetching tickets by Growth Advisor...')
  const assigneeLoads = []
  try {
    // First, find Zendesk user IDs for our GAs
    const agentsData = await zFetch('/users/search.json?role=agent')
    const allAgents = agentsData.users || []
    // Also check admins
    const adminsData = await zFetch('/users/search.json?role=admin').catch(() => ({ users: [] }))
    const allUsers = [...allAgents, ...(adminsData.users || [])]

    for (const gaName of GA_NAMES) {
      // Match by display name containing the GA name (case-insensitive)
      const matched = allUsers.find(u =>
        u.name && u.name.toLowerCase().includes(gaName.toLowerCase())
      )
      if (matched) {
        const openCount = await countQuery(
          `type:ticket status<solved assignee:${matched.id}`
        )
        assigneeLoads.push({ name: gaName, openCount })
        console.log(`    ${gaName} (ID ${matched.id}): ${openCount} open tickets`)
      } else {
        // Try searching by name string directly as fallback
        try {
          const openCount = await countQuery(
            `type:ticket status<solved assignee:"${gaName}"`
          )
          assigneeLoads.push({ name: gaName, openCount })
          console.log(`    ${gaName} (name search): ${openCount} open tickets`)
        } catch {
          assigneeLoads.push({ name: gaName, openCount: 0 })
          console.log(`    ${gaName}: not found in Zendesk`)
        }
      }
    }
  } catch (err) {
    console.warn('  ⚠️  Assignee fetch failed:', err.message)
    for (const gaName of GA_NAMES) {
      assigneeLoads.push({ name: gaName, openCount: 0 })
    }
  }

  // ── 9. Per-org ticket volume (top 20 orgs by open tickets) ──
  console.log('  Fetching per-org ticket volume...')
  const orgTickets = []
  try {
    // Paginate through active tickets and tally by org
    // status<solved = new, open, pending, hold (all active statuses)
    const orgCounts = {}    // orgId -> { name, count }
    let scannedOverdue = 0
    const now = Date.now()
    let orgNextUrl = `${BASE}/search.json?query=${encodeURIComponent('type:ticket status<solved')}&per_page=100&sort_by=created_at&sort_order=desc`
    let orgPage = 0
    while (orgNextUrl && orgPage < 10) {  // up to 1000 active tickets
      const data = await zFetch(orgNextUrl)
      for (const t of data.results || []) {
        if (t.organization_id) {
          if (!orgCounts[t.organization_id]) {
            orgCounts[t.organization_id] = { name: t.organization_id.toString(), count: 0 }
          }
          orgCounts[t.organization_id].count++
        }
        if (t.due_at) {
          const dueTs = new Date(t.due_at).getTime()
          if (!Number.isNaN(dueTs) && dueTs < now) scannedOverdue++
        }
      }
      orgNextUrl = data.next_page || null
      orgPage++
    }

    // Prefer scanned overdue if we found any explicit due_at breaches
    if (scannedOverdue > 0) overdueTickets = scannedOverdue

    // Resolve org names for top 20 (fetch org details)
    const topOrgIds = Object.entries(orgCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 20)
      .map(([id]) => id)

    if (topOrgIds.length > 0) {
      try {
        // Batch fetch org names
        const orgsData = await zFetch(`/organizations/show_many.json?ids=${topOrgIds.join(',')}`)
        const orgMap = {}
        for (const org of (orgsData.organizations || [])) {
          orgMap[org.id] = org.name
        }
        for (const [orgId, info] of Object.entries(orgCounts)) {
          if (orgMap[orgId]) info.name = orgMap[orgId]
        }
      } catch (err) {
        console.warn('  ⚠️  Org name resolution failed:', err.message)
      }
    }

    // Build top 20
    for (const [orgId, info] of Object.entries(orgCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 20)) {
      orgTickets.push({ orgId: String(orgId), orgName: info.name, openCount: info.count })
    }
    console.log(`  Top orgs found: ${orgTickets.length}`)
    console.log(`  Overdue (final): ${overdueTickets}`)
  } catch (err) {
    console.warn('  ⚠️  Per-org fetch failed:', err.message)
  }

  // ── 10. Write to DB ───────────────────────────────────────
  console.log('  Writing to database...')
  const snapshot = await prisma.zendeskSnapshot.create({
    data: {
      queueNew: qNew,
      queueOpen: qOpen,
      queuePending: qPending,
      queueHold: qHold,
      queueTotal: qNew + qOpen + qPending + qHold,
      createdThisMonth: created,
      resolvedThisMonth: resolved,
      resolutionRate,
      resTimeMean: mean,
      resTimeMedian: median,
      resTimeMode: mode,
      resTimeSample: allHours.length,
      typeWebsiteBuild: typeCounts['website_build'] || 0,
      typeWebsiteHelpdesk: typeCounts['website_helpdesk'] || 0,
      typeSMM: typeCounts['smm'] || 0,
      typeGoogleAds: typeCounts['google_ads'] || 0,
      typeCRM: typeCounts['crm'] || 0,
      // New fields
      firstReplyTimeMean:   frStats.mean,
      firstReplyTimeMedian: frStats.median,
      firstReplyTimeSample: firstReplyMinutes.length,
      overdueTickets,
      buckets: {
        create: buckets
      },
      monthlyVolumes: {
        create: monthlyVolumes
      },
      assigneeLoads: {
        create: assigneeLoads
      },
      orgTickets: {
        create: orgTickets
      },
    }
  })

  await prisma.syncLog.create({
    data: {
      source: 'zendesk',
      status: 'success',
      message: `Snapshot ID ${snapshot.id}, queue=${qNew + qOpen + qPending + qHold}, overdue=${overdueTickets}, orgs=${orgTickets.length}, monthly=${monthlyVolumes.length}`
    }
  })

  console.log(`✅ Done! Snapshot ID: ${snapshot.id}`)
}

main()
  .catch(async (e) => {
    console.error('❌ Sync failed:', e.message)
    await prisma.syncLog.create({
      data: { source: 'zendesk', status: 'error', message: e.message }
    }).catch(() => {})
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
