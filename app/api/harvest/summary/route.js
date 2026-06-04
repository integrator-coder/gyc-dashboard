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

function getCurrentMonthRange() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { from, to, year, month }
}

function getWeeksElapsedThisMonth() {
  const now = new Date()
  const dayOfMonth = now.getDate()
  return Math.ceil(dayOfMonth / 7)
}

export async function GET() {
  const auth = await requireApiUser(['admin', 'superadmin', 'manager'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const { from, to, month, year } = getCurrentMonthRange()
    
    // Fetch all time entries for current month
    const timeEntries = await fetchAllPages(`${BASE_URL}/time_entries?from=${from}&to=${to}`)
    
    // Fetch users to calculate capacity
    const usersRes = await fetch(`${BASE_URL}/users`, { headers })
    if (!usersRes.ok) throw new Error(`Failed to fetch users: ${usersRes.status}`)
    const usersData = await usersRes.json()
    const activeUsers = usersData.users.filter(u => u.is_active)
    
    // Calculate total capacity
    const weeksElapsed = getWeeksElapsedThisMonth()
    const totalCapacityHours = activeUsers.reduce((sum, user) => {
      const weeklyHours = (user.weekly_capacity || 0) / 3600 // Convert seconds to hours
      return sum + (weeklyHours * weeksElapsed)
    }, 0)

    // Calculate aggregates
    let totalHours = 0
    let billableHours = 0
    let internalHours = 0
    const clientsSet = new Set()

    timeEntries.forEach(entry => {
      const hours = entry.hours || 0
      totalHours += hours
      if (entry.billable) billableHours += hours
      
      // Count internal hours (GYC or BATCH UPDATES clients)
      const clientName = entry.client?.name || ''
      if (clientName === 'GYC - Grow Your Center' || clientName === 'BATCH UPDATES') {
        internalHours += hours
      } else if (clientName) {
        clientsSet.add(clientName)
      }
    })

    const billablePct = totalHours > 0 ? (billableHours / totalHours * 100) : 0
    const utilizationPct = totalCapacityHours > 0 ? (totalHours / totalCapacityHours * 100) : 0

    const monthName = new Date(year, month - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })

    return NextResponse.json({
      month: monthName,
      totalHours: Math.round(totalHours * 10) / 10,
      billableHours: Math.round(billableHours * 10) / 10,
      billablePct: Math.round(billablePct * 10) / 10,
      totalCapacityHours: Math.round(totalCapacityHours * 10) / 10,
      utilizationPct: Math.round(utilizationPct * 10) / 10,
      activeClientsCount: clientsSet.size,
      internalHours: Math.round(internalHours * 10) / 10,
      asOf: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Harvest summary error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export const revalidate = 300 // 5 min cache
