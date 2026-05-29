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

function getMonthRange(offset = 0) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1 + offset
  
  const targetDate = new Date(year, month - 1, 1)
  const targetYear = targetDate.getFullYear()
  const targetMonth = targetDate.getMonth() + 1
  
  const from = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`
  const lastDay = new Date(targetYear, targetMonth, 0).getDate()
  const to = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  
  return { from, to }
}

export async function GET() {
  const auth = await requireApiUser(['admin', 'superadmin'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    // Fetch users
    const usersRes = await fetch(`${BASE_URL}/users`, { headers })
    if (!usersRes.ok) throw new Error(`Failed to fetch users: ${usersRes.status}`)
    const usersData = await usersRes.json()
    const activeUsers = usersData.users.filter(u => u.is_active)

    // Fetch current month and last month time entries
    const currentMonth = getMonthRange(0)
    const lastMonth = getMonthRange(-1)

    const [currentEntries, lastEntries] = await Promise.all([
      fetchAllPages(`${BASE_URL}/time_entries?from=${currentMonth.from}&to=${currentMonth.to}`),
      fetchAllPages(`${BASE_URL}/time_entries?from=${lastMonth.from}&to=${lastMonth.to}`),
    ])

    // Aggregate by user
    const userMap = new Map()

    activeUsers.forEach(user => {
      userMap.set(user.id, {
        name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
        email: user.email || '',
        capacityHoursPerWeek: (user.weekly_capacity || 0) / 3600,
        currentMonthHours: 0,
        lastMonthHours: 0,
        billableHours: 0,
      })
    })

    currentEntries.forEach(entry => {
      const userId = entry.user?.id
      if (!userId || !userMap.has(userId)) return
      const user = userMap.get(userId)
      user.currentMonthHours += entry.hours || 0
      if (entry.billable) user.billableHours += entry.hours || 0
    })

    lastEntries.forEach(entry => {
      const userId = entry.user?.id
      if (!userId || !userMap.has(userId)) return
      const user = userMap.get(userId)
      user.lastMonthHours += entry.hours || 0
    })

    // Calculate weeks elapsed in current month so far
    const now = new Date()
    const dayOfMonth = now.getDate()
    const weeksElapsed = Math.max(dayOfMonth / 7, 1)

    // Calculate utilization and trend
    const users = Array.from(userMap.values()).map(user => {
      const weeksInMonth = 4 // Approximate for capacity
      const totalCapacity = user.capacityHoursPerWeek * weeksInMonth
      const utilizationPct = totalCapacity > 0 ? (user.currentMonthHours / totalCapacity * 100) : 0
      const weeklyAvg = Math.round((user.currentMonthHours / weeksElapsed) * 10) / 10
      
      let trend = 'flat'
      if (user.lastMonthHours > 0) {
        const change = ((user.currentMonthHours - user.lastMonthHours) / user.lastMonthHours) * 100
        if (change > 5) trend = 'up'
        else if (change < -5) trend = 'down'
      } else if (user.currentMonthHours > 0) {
        trend = 'up'
      }

      return {
        ...user,
        currentMonthHours: Math.round(user.currentMonthHours * 10) / 10,
        lastMonthHours: Math.round(user.lastMonthHours * 10) / 10,
        billableHours: Math.round(user.billableHours * 10) / 10,
        utilizationPct: Math.round(utilizationPct * 10) / 10,
        weeklyAvg,
        trend,
      }
    })

    // Sort by current month hours descending
    users.sort((a, b) => b.currentMonthHours - a.currentMonthHours)

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Harvest by-user error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export const revalidate = 300 // 5 min cache
