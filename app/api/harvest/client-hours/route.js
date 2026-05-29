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

function getMonthRange() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  return { from, to, monthLabel }
}

export async function GET(request) {
  const auth = await requireApiUser(['admin', 'superadmin'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const acronym = searchParams.get('acronym')
  const name = searchParams.get('name')

  if (!acronym && !name) {
    return NextResponse.json({ error: 'acronym or name required' }, { status: 400 })
  }

  try {
    // Find matching Harvest client by scanning client list
    let harvestClientId = null
    let harvestClientName = null
    let page = 1
    let totalPages = 1

    while (page <= totalPages) {
      const res = await fetch(`${BASE_URL}/clients?per_page=100&page=${page}`, { headers })
      if (!res.ok) throw new Error(`Harvest clients error: ${res.status}`)
      const data = await res.json()
      totalPages = data.total_pages || 1

      const clients = data.clients || []
      for (const c of clients) {
        const clientName = c.name || ''
        // Match by acronym prefix (e.g. "KZCP - ..." matches acronym "KZCP")
        if (acronym && clientName.toUpperCase().startsWith(acronym.toUpperCase())) {
          harvestClientId = c.id
          harvestClientName = c.name
          break
        }
        // Match by name substring
        if (name && clientName.toLowerCase().includes(name.toLowerCase())) {
          harvestClientId = c.id
          harvestClientName = c.name
          break
        }
      }
      if (harvestClientId) break
      page++
    }

    if (!harvestClientId) {
      return NextResponse.json({ hoursThisMonth: null, monthLabel: getMonthRange().monthLabel, notFound: true })
    }

    // Fetch time entries for this client this month
    const { from, to, monthLabel } = getMonthRange()
    let totalHours = 0
    page = 1
    totalPages = 1

    while (page <= totalPages) {
      const res = await fetch(
        `${BASE_URL}/time_entries?client_id=${harvestClientId}&from=${from}&to=${to}&per_page=100&page=${page}`,
        { headers }
      )
      if (!res.ok) throw new Error(`Harvest time entries error: ${res.status}`)
      const data = await res.json()
      totalPages = data.total_pages || 1
      ;(data.time_entries || []).forEach(e => { totalHours += e.hours || 0 })
      page++
    }

    return NextResponse.json({
      hoursThisMonth: Math.round(totalHours * 10) / 10,
      monthLabel,
      harvestClientId,
      harvestClientName,
    })
  } catch (error) {
    console.error('Harvest client-hours error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export const revalidate = 300
