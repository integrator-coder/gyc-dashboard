import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const snapshot = await prisma.zendeskSnapshot.findFirst({
    orderBy: { syncedAt: 'desc' },
    include: {
      buckets: true,
      orgTickets: true,
      monthlyVolumes: true,
      assigneeLoads: true,
    },
  })

  if (!snapshot) {
    return NextResponse.json(
      { error: 'No Zendesk data yet. Run: node scripts/sync-zendesk.js' },
      { status: 503 }
    )
  }

  // Sort buckets by minHours so charts render in order
  const sortedBuckets = [...snapshot.buckets].sort((a, b) => a.minHours - b.minHours)

  // Sort monthly volumes chronologically
  const sortedMonthly = [...snapshot.monthlyVolumes].sort((a, b) =>
    a.month.localeCompare(b.month)
  )

  // Sort orgs by openCount desc
  const sortedOrgs = [...snapshot.orgTickets].sort((a, b) => b.openCount - a.openCount)

  return NextResponse.json({
    queue: {
      new:     snapshot.queueNew,
      open:    snapshot.queueOpen,
      pending: snapshot.queuePending,
      hold:    snapshot.queueHold,
      total:   snapshot.queueTotal,
    },
    thisMonth: {
      created:        snapshot.createdThisMonth,
      resolved:       snapshot.resolvedThisMonth,
      resolutionRate: snapshot.resolutionRate,
    },
    byType: {
      website_build:    snapshot.typeWebsiteBuild,
      website_helpdesk: snapshot.typeWebsiteHelpdesk,
      smm:              snapshot.typeSMM,
      google_ads:       snapshot.typeGoogleAds,
      crm:              snapshot.typeCRM,
    },
    resolutionTime: {
      mean:       snapshot.resTimeMean,
      median:     snapshot.resTimeMedian,
      mode:       snapshot.resTimeMode,
      sampleSize: snapshot.resTimeSample,
      buckets:    sortedBuckets.map(b => ({
        label:    b.label,
        minHours: b.minHours,
        maxHours: b.maxHours,
        count:    b.count,
      })),
    },
    firstReplyTime: {
      mean:       snapshot.firstReplyTimeMean,
      median:     snapshot.firstReplyTimeMedian,
      sampleSize: snapshot.firstReplyTimeSample,
    },
    overdueTickets: snapshot.overdueTickets,
    monthlyVolume: sortedMonthly.map(m => ({
      month: m.month,
      count: m.count,
      // Human-friendly label e.g. "Jan '26"
      label: (() => {
        const [year, mon] = m.month.split('-')
        const d = new Date(parseInt(year), parseInt(mon) - 1, 1)
        return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      })(),
    })),
    orgTickets: sortedOrgs.slice(0, 20).map(o => ({
      orgName:   o.orgName,
      orgId:     o.orgId,
      openCount: o.openCount,
    })),
    assigneeLoads: snapshot.assigneeLoads.map(a => ({
      name:      a.name,
      openCount: a.openCount,
    })),
    syncedAt: snapshot.syncedAt.toISOString(),
  })
}
