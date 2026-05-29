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

function classifyServiceLine(projectName, clientName) {
  if (!projectName) return 'Other'
  
  const lower = projectName.toLowerCase()
  
  // Check if internal
  if (clientName === 'GYC - Grow Your Center' || clientName === 'BATCH UPDATES') {
    return 'Internal'
  }
  
  // Web
  if (lower.includes('website build') || lower.includes('website maintenance') || 
      lower.includes('virtual tour') || lower.includes('troubleshooting')) {
    return 'Web'
  }
  
  // SEO
  if (lower.includes('seo')) {
    return 'SEO'
  }
  
  // Paid Media
  if (lower.includes('google ads') || lower.includes('meta ads') || lower.includes('ads')) {
    return 'Paid Media'
  }
  
  // CRM/Blueprint
  if (lower.includes('crm boost') || lower.includes('crm newsletters') || lower.includes('blueprint')) {
    return 'CRM/Blueprint'
  }
  
  return 'Other'
}

function getCurrentMonthRange() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { from, to }
}

export async function GET() {
  const auth = await requireApiUser(['admin', 'superadmin'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const { from, to } = getCurrentMonthRange()
    const timeEntries = await fetchAllPages(`${BASE_URL}/time_entries?from=${from}&to=${to}`)

    const serviceMap = new Map()
    let totalHours = 0

    timeEntries.forEach(entry => {
      const hours = entry.hours || 0
      totalHours += hours
      
      const projectName = entry.project?.name || ''
      const clientName = entry.client?.name || ''
      const service = classifyServiceLine(projectName, clientName)
      
      serviceMap.set(service, (serviceMap.get(service) || 0) + hours)
    })

    const services = Array.from(serviceMap.entries())
      .map(([name, hours]) => ({
        name,
        hours: Math.round(hours * 10) / 10,
        pct: totalHours > 0 ? Math.round((hours / totalHours * 100) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.hours - a.hours)

    return NextResponse.json({ services })
  } catch (error) {
    console.error('Harvest by-service error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export const revalidate = 300 // 5 min cache
