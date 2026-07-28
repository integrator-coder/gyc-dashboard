import { NextResponse } from 'next/server'
import { getClosedWonDeals } from '@/lib/ghl'

export const dynamic = 'force-dynamic'

export async function getDealSizeMetrics() {
    const endDate = new Date()
    const startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - 30)

    const opportunities = await getClosedWonDeals(startDate, endDate)
    const deals = opportunities.filter(opp => Number(opp.monetaryValue || 0) > 0)

    const totalDeals = deals.length
    const totalValue = deals.reduce((sum, opp) => sum + Number(opp.monetaryValue || 0), 0)
    const avgDealSize = totalDeals > 0 ? totalValue / totalDeals : 0

    return {
      avgDealSize,
      totalDeals,
      totalValue,
      period: '30d',
    }
}

export async function GET() {
  try {
    return NextResponse.json(await getDealSizeMetrics())
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
