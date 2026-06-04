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

function fmt(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function aggregateByUser(entries) {
  const map = {}
  let total = 0
  entries.forEach(e => {
    const hours = e.hours || 0
    total += hours
    const name = e.user?.name
    if (name) map[name] = (map[name] || 0) + hours
  })
  // Round
  Object.keys(map).forEach(k => { map[k] = Math.round(map[k] * 10) / 10 })
  return { total: Math.round(total * 10) / 10, byUser: map }
}

export async function GET() {
  const auth = await requireApiUser(['admin', 'superadmin'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const now = new Date()
    const dayOfMonth = now.getDate() // e.g. 4

    // Current month range (full, up to today)
    const curYear = now.getFullYear()
    const curMonth = now.getMonth() // 0-indexed
    const curFrom = fmt(new Date(curYear, curMonth, 1))
    const curTo = fmt(now)

    // Last month range (full)
    const lastMonthDate = new Date(curYear, curMonth - 1, 1)
    const lastYear = lastMonthDate.getFullYear()
    const lastMonth = lastMonthDate.getMonth() // 0-indexed
    const lastMonthDays = new Date(lastYear, lastMonth + 1, 0).getDate()
    const lastFrom = fmt(new Date(lastYear, lastMonth, 1))
    const lastTo = fmt(new Date(lastYear, lastMonth, lastMonthDays))

    // Last month same-period (first N days, matching current day count)
    const lastSamePeriodDay = Math.min(dayOfMonth, lastMonthDays)
    const lastSameTo = fmt(new Date(lastYear, lastMonth, lastSamePeriodDay))

    // Fetch all three in parallel
    const [curEntries, lastAllEntries, lastSameEntries] = await Promise.all([
      fetchAllPages(`${BASE_URL}/time_entries?from=${curFrom}&to=${curTo}`),
      fetchAllPages(`${BASE_URL}/time_entries?from=${lastFrom}&to=${lastTo}`),
      fetchAllPages(`${BASE_URL}/time_entries?from=${lastFrom}&to=${lastSameTo}`),
    ])

    const current = aggregateByUser(curEntries)
    const lastFull = aggregateByUser(lastAllEntries)
    const lastSame = aggregateByUser(lastSameEntries)

    // Build per-user comparison (union of all names)
    const allUsers = new Set([
      ...Object.keys(current.byUser),
      ...Object.keys(lastFull.byUser),
      ...Object.keys(lastSame.byUser),
    ])

    const users = []
    allUsers.forEach(name => {
      const cur = current.byUser[name] || 0
      const lf = lastFull.byUser[name] || 0
      const ls = lastSame.byUser[name] || 0
      if (cur > 0 || lf > 0) {
        users.push({ name, current: cur, lastFull: lf, lastSame: ls })
      }
    })

    // Sort by current hours desc
    users.sort((a, b) => b.current - a.current)

    const curMonthLabel = now.toLocaleString('en-US', { month: 'long' })
    const lastMonthLabel = lastMonthDate.toLocaleString('en-US', { month: 'long' })

    return NextResponse.json({
      dayOfMonth,
      curMonthLabel,
      lastMonthLabel,
      currentTotal: current.total,
      lastFullTotal: lastFull.total,
      lastSameTotal: lastSame.total,
      users,
      asOf: now.toISOString(),
    })
  } catch (error) {
    console.error('Harvest month-comparison error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export const revalidate = 300
