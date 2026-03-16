import { NextResponse } from 'next/server'
import { getClosedWonDeals, getGHLUsers } from '@/lib/ghl'

// Map GHL full names → dashboard short names
const REP_NAME_MAP = {
  'Sebastian Estrada': 'Sebastian',
  'Stefen Anderson': 'Stefen',
  'JC Flores': 'JC',
  'Zu Vuong': 'Zu',
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'month'

    const now = new Date()
    let startDate

    if (period === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    } else if (period === 'week') {
      const day = now.getDay()
      const diff = day === 0 ? -6 : 1 - day // Monday
      startDate = new Date(now)
      startDate.setDate(now.getDate() + diff)
      startDate.setHours(0, 0, 0, 0)
    } else if (period === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1)
    } else {
      // month (default)
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    }

    const periodLabel = {
      today: 'Today',
      week: 'This Week',
      month: startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      year: String(now.getFullYear())
    }[period] || 'This Month'

    const [deals, users] = await Promise.all([
      getClosedWonDeals(startDate, now),
      getGHLUsers()
    ])

    // Build userId → display name map
    const userMap = {}
    for (const user of users) {
      const fullName = user.name || `${user.firstName} ${user.lastName}`.trim()
      const displayName = REP_NAME_MAP[fullName] || fullName
      userMap[user.id] = displayName
    }

    // Group by assignedTo
    const byRep = {}
    for (const deal of deals) {
      const repName = userMap[deal.assignedTo] || deal.assignedTo || 'Unassigned'
      if (!byRep[repName]) byRep[repName] = { deals: 0, value: 0, opportunities: [] }
      byRep[repName].deals++
      byRep[repName].value += deal.monetaryValue || 0
      // Only store deal details for shorter periods (not year) to keep payload small
      if (period !== 'year') {
        byRep[repName].opportunities.push({
          name: deal.name,
          value: deal.monetaryValue || 0,
          wonAt: deal.lastStatusChangeAt,
          contact: deal.contact?.name,
          company: deal.contact?.companyName
        })
      }
    }

    const totalDeals = deals.length
    const totalValue = deals.reduce((sum, d) => sum + (d.monetaryValue || 0), 0)

    return NextResponse.json({
      period: periodLabel,
      totalDeals,
      totalValue,
      byRep,
      users: users.map(u => ({
        id: u.id,
        name: u.name || `${u.firstName} ${u.lastName}`.trim()
      }))
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
