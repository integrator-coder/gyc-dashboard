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
  return { from, to }
}

export async function GET(request) {
  const auth = await requireApiUser(['admin', 'superadmin'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

  try {
    const { from, to } = getMonthRange()
    const entries = []
    let page = 1
    let totalPages = 1

    while (page <= totalPages) {
      const res = await fetch(
        `${BASE_URL}/time_entries?client_id=${clientId}&from=${from}&to=${to}&per_page=100&page=${page}`,
        { headers }
      )
      if (!res.ok) throw new Error(`Harvest API error: ${res.status}`)
      const data = await res.json()
      entries.push(...(data.time_entries || []))
      totalPages = data.total_pages || 1
      page++
    }

    // Aggregate by project
    const byProject = {}
    const byTask = {}
    const byPerson = {}

    entries.forEach(e => {
      const project = e.project?.name || 'Unknown'
      const task = e.task?.name || 'Unknown'
      const person = e.user?.name || 'Unknown'
      const hrs = e.hours || 0

      byProject[project] = (byProject[project] || 0) + hrs
      byTask[task] = (byTask[task] || 0) + hrs
      byPerson[person] = (byPerson[person] || 0) + hrs
    })

    const totalHours = entries.reduce((sum, e) => sum + (e.hours || 0), 0)

    return NextResponse.json({
      clientId,
      totalHours: Math.round(totalHours * 10) / 10,
      byProject: Object.entries(byProject)
        .map(([name, hours]) => ({ name, hours: Math.round(hours * 10) / 10 }))
        .sort((a, b) => b.hours - a.hours),
      byTask: Object.entries(byTask)
        .map(([name, hours]) => ({ name, hours: Math.round(hours * 10) / 10 }))
        .sort((a, b) => b.hours - a.hours),
      byPerson: Object.entries(byPerson)
        .map(([name, hours]) => ({ name, hours: Math.round(hours * 10) / 10 }))
        .sort((a, b) => b.hours - a.hours),
    })
  } catch (error) {
    console.error('Harvest client-projects error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export const revalidate = 300
