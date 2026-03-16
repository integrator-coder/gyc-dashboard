import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    // Get the latest and previous metrics snapshots
    const latest = await prisma.stripeMetrics.findFirst({
      orderBy: { syncedAt: 'desc' }
    })

    const previous = await prisma.stripeMetrics.findFirst({
      orderBy: { syncedAt: 'desc' },
      skip: 1
    })

    // Get all active customers sorted by MRR
    const customers = await prisma.stripeCustomer.findMany({
      where: { status: 'active' },
      orderBy: { mrr: 'desc' }
    })

    // Get last sync log for stripe
    const lastSync = await prisma.syncLog.findFirst({
      where: { source: 'stripe' },
      orderBy: { syncedAt: 'desc' }
    })

    // Get last 10 snapshots for chart (oldest first)
    const history = await prisma.stripeMetrics.findMany({
      orderBy: { syncedAt: 'desc' },
      take: 10
    })

    // Get last 35 days of daily revenue (oldest first), use date filter to ensure today is included
    const thirtyFiveDaysAgo = new Date()
    thirtyFiveDaysAgo.setDate(thirtyFiveDaysAgo.getDate() - 35)
    const cutoffDate = thirtyFiveDaysAgo.toISOString().split('T')[0]
    const dailyRevenue = await prisma.dailyRevenue.findMany({
      where: { date: { gte: cutoffDate } },
      orderBy: { date: 'asc' }
    })

    return NextResponse.json({
      metrics: latest,
      previous,
      customers,
      lastSync,
      history: history.reverse(), // oldest first for chart
      dailyRevenue
    })
  } catch (error) {
    console.error('Finance metrics error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
