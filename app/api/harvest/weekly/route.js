import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/auth'

const HARVEST_API_TOKEN = process.env.HARVEST_API_TOKEN
const HARVEST_ACCOUNT_ID = process.env.HARVEST_ACCOUNT_ID || '1961445'
const BASE_URL = 'https://api.harvestapp.com/api/v2'

const headers = {
  'Harvest-Account-ID': HARVEST_ACCOUNT_ID,
  'Authorization': `Bearer ${HARVEST_API_TOKEN}`,
  'User-Agent': 'GYC-Dashboard',
}

async function fetchAllPages(url) {
  const results = []
  let page = 1
  let totalPages = 1
  while (page <= totalPages) {
    const pageUrl = `${url}${url.includes('?') ? '&' : '?'}page=${page}`
    const res = await fetch(pageUrl, { headers })
    if (!res.ok) throw new Error(`Harvest API error: ${res.status}`)
    const data = await res.json()
    if (data.time_entries) results.push(...data.time_entries)
    totalPages = data.total_pages || 1
    page++
  }
  return results
}

// Get Monday of a given date's week
function getWeekStart(dateStr) {
  const d = new Date(dateStr)
  const day = d.getUTCDay() // 0=Sun, 1=Mon...
  const diff = (day === 0) ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}

function formatWeekLabel(weekStart) {
  const d = new Date(weekStart + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export async function GET() {
  const auth = await requireApiUser(['admin', 'superadmin'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    // Fetch active users
    const usersRes = await fetch(`${BASE_URL}/users?is_active=true&per_page=100`, { headers })
    if (!usersRes.ok) throw new Error(`Failed to fetch users: ${usersRes.status}`)
    const usersData = await usersRes.json()
    const activeUsers = usersData.users || []

    // Build user id→name map
    const userNames = {}
    activeUsers.forEach(u => {
      userNames[u.id] = `${u.first_name || ''} ${u.last_name || ''}`.trim()
    })

    // Fetch last 16 weeks of time entries
    const now = new Date()
    const from = new Date(now)
    from.setDate(from.getDate() - 16 * 7)
    const fromStr = from.toISOString().slice(0, 10)
    const toStr = now.toISOString().slice(0, 10)

    const entries = await fetchAllPages(
      `${BASE_URL}/time_entries?from=${fromStr}&to=${toStr}`
    )

    // Aggregate hours by week × user
    // weekData: { weekStart: { userName: hours } }
    const weekData = {}

    entries.forEach(entry => {
      const userId = entry.user?.id
      const userName = userNames[userId]
      if (!userName) return
      const weekStart = getWeekStart(entry.spent_date)
      if (!weekData[weekStart]) weekData[weekStart] = {}
      weekData[weekStart][userName] = (weekData[weekStart][userName] || 0) + (entry.hours || 0)
    })

    // Sort weeks chronologically
    const weeks = Object.keys(weekData).sort()

    // Get all users who have logged at least 1 hour
    const activeUserNames = new Set()
    weeks.forEach(w => Object.keys(weekData[w]).forEach(u => activeUserNames.add(u)))
    const userList = Array.from(activeUserNames).sort()

    // Build chart-ready data: array of { week, User1: hrs, User2: hrs, ... }
    const chartData = weeks.map(w => {
      const row = { week: formatWeekLabel(w), weekStart: w }
      userList.forEach(u => {
        row[u] = weekData[w][u] ? Math.round(weekData[w][u] * 10) / 10 : 0
      })
      return row
    })

    return NextResponse.json({ weeks: chartData, users: userList })
  } catch (error) {
    console.error('Harvest weekly error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export const revalidate = 300
