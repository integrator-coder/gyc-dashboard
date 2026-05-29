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

function getMonthRange(offset) {
  const now = new Date()
  const targetDate = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const year = targetDate.getFullYear()
  const month = targetDate.getMonth() + 1
  
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  
  const label = targetDate.toLocaleString('en-US', { month: 'short', year: 'numeric' })
  
  return { from, to, label }
}

export async function GET() {
  const auth = await requireApiUser(['admin', 'superadmin'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    // Get last 6 months
    const monthRanges = []
    for (let i = -5; i <= 0; i++) {
      monthRanges.push(getMonthRange(i))
    }

    // Fetch users for mapping
    const usersRes = await fetch(`${BASE_URL}/users`, { headers })
    if (!usersRes.ok) throw new Error(`Failed to fetch users: ${usersRes.status}`)
    const usersData = await usersRes.json()
    const activeUsers = usersData.users.filter(u => u.is_active)
    
    // Fetch time entries for all 6 months in parallel
    const allEntriesPromises = monthRanges.map(range =>
      fetchAllPages(`${BASE_URL}/time_entries?from=${range.from}&to=${range.to}`)
    )
    const allEntriesArrays = await Promise.all(allEntriesPromises)

    const months = []
    const totalHours = []
    const byUser = {}

    // Initialize user tracking
    activeUsers.forEach(user => {
      byUser[user.name] = []
    })

    // Process each month
    monthRanges.forEach((range, idx) => {
      months.push(range.label)
      
      const entries = allEntriesArrays[idx]
      const userHoursMap = new Map()
      let monthTotal = 0

      entries.forEach(entry => {
        const hours = entry.hours || 0
        monthTotal += hours
        
        const userName = entry.user?.name
        if (userName) {
          userHoursMap.set(userName, (userHoursMap.get(userName) || 0) + hours)
        }
      })

      totalHours.push(Math.round(monthTotal * 10) / 10)

      // Add user hours for this month
      activeUsers.forEach(user => {
        const hours = userHoursMap.get(user.name) || 0
        byUser[user.name].push(Math.round(hours * 10) / 10)
      })
    })

    // Filter out users with no hours across all months
    Object.keys(byUser).forEach(userName => {
      const allZero = byUser[userName].every(h => h === 0)
      if (allZero) delete byUser[userName]
    })

    return NextResponse.json({
      months,
      totalHours,
      byUser,
    })
  } catch (error) {
    console.error('Harvest trends error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export const revalidate = 300 // 5 min cache
