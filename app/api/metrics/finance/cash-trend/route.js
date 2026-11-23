export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { CASH_TREND_HISTORY } from '@/lib/cash-trend-history'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const CACHE_TTL_MS = 60 * 60 * 1000
let cachedResult = null
let cachedAt = 0

async function getMonthlyCash() {
  if (cachedResult && Date.now() - cachedAt < CACHE_TTL_MS) return cachedResult

  const lastHistoricalMonth = CASH_TREND_HISTORY.at(-1).month
  const [lastYear, lastMonth] = lastHistoricalMonth.split('-').map(Number)
  const liveStartDate = new Date(Date.UTC(lastYear, lastMonth, 1))
  const start = Math.floor(liveStartDate.getTime() / 1000)
  const monthly = new Map()

  for await (const charge of stripe.charges.list({ created: { gte: start }, limit: 100 })) {
    if (charge.status !== 'succeeded' || !charge.paid) continue
    const month = new Date(charge.created * 1000).toISOString().slice(0, 7)
    const point = monthly.get(month) || { cents: 0, chargeCount: 0 }
    point.cents += charge.amount - (charge.amount_refunded || 0)
    point.chargeCount++
    monthly.set(month, point)
  }

  const result = [...CASH_TREND_HISTORY]
  const cursor = new Date(liveStartDate)
  const currentMonth = new Date().toISOString().slice(0, 7)
  while (cursor.toISOString().slice(0, 7) <= currentMonth) {
    const month = cursor.toISOString().slice(0, 7)
    const point = monthly.get(month) || { cents: 0, chargeCount: 0 }
    result.push({
      month,
      cash: Math.round(point.cents) / 100,
      chargeCount: point.chargeCount,
      isCurrentMonth: month === currentMonth,
    })
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }

  cachedResult = result
  cachedAt = Date.now()
  return result
}

export async function GET() {
  try {
    await requireUser(['superadmin', 'admin', 'ga', 'cx'])
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    return NextResponse.json(await getMonthlyCash())
  } catch (error) {
    console.error('Cash trend error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
