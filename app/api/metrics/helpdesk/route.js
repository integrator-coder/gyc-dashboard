import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const ZENDESK_BASE = 'https://gycawesome.zendesk.com/api/v2'

function zendeskHeaders() {
  const email = process.env.ZENDESK_EMAIL
  const token = process.env.ZENDESK_API_TOKEN
  const encoded = Buffer.from(`${email}/token:${token}`).toString('base64')
  return {
    'Authorization': `Basic ${encoded}`,
    'Content-Type': 'application/json',
  }
}

async function zendeskSearch(query, perPage = 100, sortBy = 'created_at', sortOrder = 'desc') {
  const params = new URLSearchParams({
    query,
    per_page: String(perPage),
    sort_by: sortBy,
    sort_order: sortOrder,
  })
  const res = await fetch(`${ZENDESK_BASE}/search.json?${params}`, {
    headers: zendeskHeaders(),
  })
  if (!res.ok) throw new Error(`Zendesk search error ${res.status}: ${await res.text()}`)
  return res.json()
}

async function zendeskCount(query) {
  const params = new URLSearchParams({ query })
  const res = await fetch(`${ZENDESK_BASE}/search/count.json?${params}`, {
    headers: zendeskHeaders(),
  })
  if (!res.ok) throw new Error(`Zendesk count error ${res.status}`)
  const json = await res.json()
  return json.count ?? 0
}

async function getTicketMetrics(ticketId) {
  const res = await fetch(`${ZENDESK_BASE}/tickets/${ticketId}/metrics.json`, {
    headers: zendeskHeaders(),
  })
  if (!res.ok) return null
  const json = await res.json()
  return json.ticket_metric || null
}

async function searchUsers(name) {
  const params = new URLSearchParams({ query: `type:user name:"${name}"` })
  const res = await fetch(`${ZENDESK_BASE}/search.json?${params}`, {
    headers: zendeskHeaders(),
  })
  if (!res.ok) return []
  const json = await res.json()
  return json.results || []
}

function calcStats(values) {
  if (!values.length) return { mean: 0, median: 0, mode: 0, sampleSize: 0 }

  const sorted = [...values].sort((a, b) => a - b)
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  const mid = Math.floor(sorted.length / 2)
  const median =
    sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid]

  // Mode: round each value to nearest hour, find most common
  const freq = {}
  for (const v of values) {
    const rounded = Math.round(v)
    freq[rounded] = (freq[rounded] || 0) + 1
  }
  const mode = Number(
    Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0]
  )

  return {
    mean: parseFloat(mean.toFixed(1)),
    median: parseFloat(median.toFixed(1)),
    mode,
    sampleSize: values.length,
  }
}

export async function GET() {
  try {
    const headers = zendeskHeaders()

    // ── 1. Queue stats ───────────────────────────────────────
    const [totalCount, newCount, openCount, pendingCount] = await Promise.all([
      zendeskCount('type:ticket tags:website_helpdesk status<solved'),
      zendeskCount('type:ticket tags:website_helpdesk status:new'),
      zendeskCount('type:ticket tags:website_helpdesk status:open'),
      zendeskCount('type:ticket tags:website_helpdesk status:pending'),
    ])

    const queue = {
      total: totalCount,
      new: newCount,
      open: openCount,
      pending: pendingCount,
    }

    // ── 2. Resolution time stats ─────────────────────────────
    // Fetch up to 100 recently closed tickets
    let resolutionTime = { mean: 0, median: 0, mode: 0, sampleSize: 0, unit: 'hours' }
    try {
      const closedResult = await zendeskSearch(
        'type:ticket tags:website_helpdesk status:closed',
        100,
        'created_at',
        'desc'
      )
      const closedTickets = (closedResult.results || []).slice(0, 50)

      if (closedTickets.length > 0) {
        // Fetch metrics in parallel (batches of 10 to be nice to rate limits)
        const metricsResults = []
        for (let i = 0; i < closedTickets.length; i += 10) {
          const batch = closedTickets.slice(i, i + 10)
          const batchMetrics = await Promise.all(
            batch.map(t => getTicketMetrics(t.id))
          )
          metricsResults.push(...batchMetrics)
          // Small delay between batches
          if (i + 10 < closedTickets.length) {
            await new Promise(r => setTimeout(r, 300))
          }
        }

        const resolutionHours = metricsResults
          .filter(m => m !== null)
          .map(m => {
            const mins =
              m.full_resolution_time_in_minutes?.business ||
              m.full_resolution_time_in_minutes?.calendar ||
              0
            return mins / 60
          })
          .filter(h => h > 0)

        const stats = calcStats(resolutionHours)
        resolutionTime = { ...stats, unit: 'hours' }
      }
    } catch (err) {
      console.error('Resolution time fetch error:', err.message)
    }

    // ── 3. Monthly volume (last 12 months) ───────────────────
    const monthlyVolume = []
    const now = new Date()
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const monthKey = `${year}-${month}`

      const nextD = new Date(year, d.getMonth() + 1, 1)
      const nextYear = nextD.getFullYear()
      const nextMonth = String(nextD.getMonth() + 1).padStart(2, '0')

      const query = `type:ticket tags:website_helpdesk created>${year}-${month}-01 created<${nextYear}-${nextMonth}-01`
      try {
        const count = await zendeskCount(query)
        monthlyVolume.push({ month: monthKey, count })
      } catch {
        monthlyVolume.push({ month: monthKey, count: 0 })
      }
      // Throttle
      await new Promise(r => setTimeout(r, 100))
    }

    // ── 4. By assignee ───────────────────────────────────────
    const GA_NAMES = ['Sebastian', 'Stefen', 'JC', 'Zu']
    const byAssignee = []

    try {
      // Look up each GA by name
      const gaUsers = await Promise.all(
        GA_NAMES.map(name => searchUsers(name))
      )

      for (let i = 0; i < GA_NAMES.length; i++) {
        const name = GA_NAMES[i]
        const users = gaUsers[i]
        // Find best match (exact name match preferred)
        const user = users.find(u =>
          u.name?.toLowerCase().includes(name.toLowerCase())
        ) || users[0]

        if (user) {
          try {
            const count = await zendeskCount(
              `type:ticket tags:website_helpdesk status<solved assignee:${user.id}`
            )
            byAssignee.push({ name, openCount: count })
          } catch {
            byAssignee.push({ name, openCount: 0 })
          }
        } else {
          byAssignee.push({ name, openCount: 0 })
        }
        await new Promise(r => setTimeout(r, 150))
      }
    } catch (err) {
      console.error('Assignee lookup error:', err.message)
      for (const name of GA_NAMES) {
        byAssignee.push({ name, openCount: 0 })
      }
    }

    // ── 5. Recent open tickets (last 20) ─────────────────────
    const recentTickets = []
    try {
      const recentResult = await zendeskSearch(
        'type:ticket tags:website_helpdesk status<solved',
        20,
        'created_at',
        'desc'
      )
      const tickets = recentResult.results || []

      // Collect unique user IDs for requester/assignee lookups
      const userIds = new Set()
      for (const t of tickets) {
        if (t.requester_id) userIds.add(t.requester_id)
        if (t.assignee_id) userIds.add(t.assignee_id)
      }

      // Fetch user names in bulk via show_many
      const userMap = {}
      if (userIds.size > 0) {
        try {
          const idsParam = [...userIds].join(',')
          const usersRes = await fetch(
            `${ZENDESK_BASE}/users/show_many.json?ids=${idsParam}`,
            { headers }
          )
          if (usersRes.ok) {
            const usersJson = await usersRes.json()
            for (const u of usersJson.users || []) {
              userMap[u.id] = u.name
            }
          }
        } catch {
          // fallback: leave names blank
        }
      }

      for (const t of tickets) {
        recentTickets.push({
          id: t.id,
          subject: (t.subject || '(no subject)').slice(0, 120),
          status: t.status,
          createdAt: t.created_at ? t.created_at.split('T')[0] : '',
          requester: userMap[t.requester_id] || `#${t.requester_id}`,
          assignee: t.assignee_id
            ? (userMap[t.assignee_id] || `#${t.assignee_id}`)
            : 'Unassigned',
        })
      }
    } catch (err) {
      console.error('Recent tickets fetch error:', err.message)
    }

    return NextResponse.json({
      queue,
      resolutionTime,
      monthlyVolume,
      byAssignee,
      recentTickets,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Helpdesk API error:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to fetch helpdesk data' },
      { status: 500 }
    )
  }
}
