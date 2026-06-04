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
  const auth = await requireApiUser(['admin', 'superadmin', 'manager'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const currentMonth = getMonthRange(0)
    const lastMonth = getMonthRange(-1)

    const [currentEntries, lastEntries] = await Promise.all([
      fetchAllPages(`${BASE_URL}/time_entries?from=${currentMonth.from}&to=${currentMonth.to}`),
      fetchAllPages(`${BASE_URL}/time_entries?from=${lastMonth.from}&to=${lastMonth.to}`),
    ])

    const clientMap = new Map()

    // Filter out internal clients
    const isInternalClient = (name) => {
      if (!name) return true
      return name === 'GYC - Grow Your Center' || name === 'BATCH UPDATES'
    }

    currentEntries.forEach(entry => {
      const clientName = entry.client?.name
      const clientId = entry.client?.id
      if (!clientName || isInternalClient(clientName)) return
      
      if (!clientMap.has(clientName)) {
        clientMap.set(clientName, { name: clientName, harvestId: clientId, currentMonthHours: 0, lastMonthHours: 0 })
      }
      clientMap.get(clientName).currentMonthHours += entry.hours || 0
    })

    lastEntries.forEach(entry => {
      const clientName = entry.client?.name
      if (!clientName || isInternalClient(clientName)) return
      
      if (!clientMap.has(clientName)) {
        clientMap.set(clientName, { name: clientName, currentMonthHours: 0, lastMonthHours: 0 })
      }
      clientMap.get(clientName).lastMonthHours += entry.hours || 0
    })

    const clients = Array.from(clientMap.values())
      .filter(client => client.currentMonthHours > 0)
      .map(client => {
        let trend = 'flat'
        if (client.lastMonthHours > 0) {
          const change = ((client.currentMonthHours - client.lastMonthHours) / client.lastMonthHours) * 100
          if (change > 10) trend = 'up'
          else if (change < -10) trend = 'down'
        } else if (client.currentMonthHours > 0) {
          trend = 'up'
        }

        return {
          name: client.name,
          currentMonthHours: Math.round(client.currentMonthHours * 10) / 10,
          lastMonthHours: Math.round(client.lastMonthHours * 10) / 10,
          trend,
        }
      })
      .sort((a, b) => b.currentMonthHours - a.currentMonthHours)
      .slice(0, 50)

    return NextResponse.json({ clients })
  } catch (error) {
    console.error('Harvest by-client error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export const revalidate = 300 // 5 min cache
