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

function getWeekToDateRange() {
  const now = new Date()
  const day = now.getUTCDay() // 0=Sun, 1=Mon...
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() + diff)
  const from = monday.toISOString().slice(0, 10)
  const to = now.toISOString().slice(0, 10)
  return { from, to, monday: from }
}

export async function GET() {
  const auth = await requireApiUser(['admin', 'superadmin', 'manager'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const { from, to, monday } = getWeekToDateRange()

    // Fetch users for capacity
    const usersRes = await fetch(`${BASE_URL}/users?is_active=true&per_page=100`, { headers })
    if (!usersRes.ok) throw new Error('Failed to fetch users')
    const usersData = await usersRes.json()
    const activeUsers = usersData.users || []

    // Fetch this week's time entries (usually fits in 1-2 pages)
    const entries = []
    let page = 1
    let totalPages = 1
    while (page <= totalPages) {
      const res = await fetch(
        `${BASE_URL}/time_entries?from=${from}&to=${to}&per_page=100&page=${page}`,
        { headers }
      )
      if (!res.ok) throw new Error(`Harvest API error: ${res.status}`)
      const data = await res.json()
      entries.push(...(data.time_entries || []))
      totalPages = data.total_pages || 1
      page++
    }

    // Build user map
    const userMap = {}
    activeUsers.forEach(u => {
      const name = `${u.first_name || ''} ${u.last_name || ''}`.trim()
      userMap[u.id] = {
        name,
        email: u.email || '',
        weeklyCapacity: (u.weekly_capacity || 0) / 3600,
        hoursThisWeek: 0,
      }
    })

    entries.forEach(e => {
      const uid = e.user?.id
      if (uid && userMap[uid]) {
        userMap[uid].hoursThisWeek += e.hours || 0
      }
    })

    const users = Object.values(userMap)
      .filter(u => u.hoursThisWeek > 0 || u.weeklyCapacity > 0)
      .map(u => ({
        ...u,
        hoursThisWeek: Math.round(u.hoursThisWeek * 10) / 10,
        hoursRemaining: Math.max(0, Math.round((u.weeklyCapacity - u.hoursThisWeek) * 10) / 10),
        pctUsed: u.weeklyCapacity > 0
          ? Math.round((u.hoursThisWeek / u.weeklyCapacity) * 100)
          : 0,
      }))
      .sort((a, b) => a.hoursRemaining - b.hoursRemaining) // Most used → least used

    return NextResponse.json({ users, weekStart: monday, asOf: new Date().toISOString() })
  } catch (error) {
    console.error('Harvest this-week error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export const revalidate = 0 // No cache — real-time
