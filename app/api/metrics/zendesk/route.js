import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

function emptyZendeskPayload(reason) {
  return {
    queue: { new: 0, open: 0, pending: 0, hold: 0, total: 0 },
    thisMonth: { created: 0, resolved: 0, resolutionRate: 0 },
    byType: {
      website_build: 0,
      website_helpdesk: 0,
      smm: 0,
      google_ads: 0,
      crm: 0,
    },
    resolutionTime: {
      mean: 0,
      median: 0,
      mode: 0,
      sampleSize: 0,
      buckets: [],
    },
    firstReplyTime: {
      mean: 0,
      median: 0,
      sampleSize: 0,
    },
    overdueTickets: 0,
    monthlyVolume: [],
    orgTickets: [],
    assigneeLoads: [],
    syncedAt: null,
    warning: reason,
  }
}

export async function GET() {
  try {
    const snapshot = await prisma.zendeskSnapshot.findFirst({
      orderBy: { syncedAt: 'desc' },
      include: {
        ZendeskResolutionBucket: true,
        ZendeskOrgTicket: true,
        ZendeskMonthlyVolume: true,
        ZendeskAssigneeLoad: true,
      },
    })

    if (!snapshot) {
      return NextResponse.json(
        emptyZendeskPayload('No Zendesk snapshot found yet. Run: node scripts/sync-zendesk.js')
      )
    }

    const sortedBuckets = [...snapshot.ZendeskResolutionBucket].sort((a, b) => a.minHours - b.minHours)
    const sortedMonthly = [...snapshot.ZendeskMonthlyVolume].sort((a, b) => a.month.localeCompare(b.month))
    const sortedOrgs = [...snapshot.ZendeskOrgTicket].sort((a, b) => b.openCount - a.openCount)
    const assigneeLoads = [...snapshot.ZendeskAssigneeLoad].sort((a, b) => b.openCount - a.openCount)

    return NextResponse.json({
      queue: {
        new: snapshot.queueNew,
        open: snapshot.queueOpen,
        pending: snapshot.queuePending,
        hold: snapshot.queueHold,
        total: snapshot.queueTotal,
      },
      thisMonth: {
        created: snapshot.createdThisMonth,
        resolved: snapshot.resolvedThisMonth,
        resolutionRate: snapshot.resolutionRate,
      },
      byType: {
        website_build: snapshot.typeWebsiteBuild,
        website_helpdesk: snapshot.typeWebsiteHelpdesk,
        smm: snapshot.typeSMM,
        google_ads: snapshot.typeGoogleAds,
        crm: snapshot.typeCRM,
      },
      resolutionTime: {
        mean: snapshot.resTimeMean,
        median: snapshot.resTimeMedian,
        mode: snapshot.resTimeMode,
        sampleSize: snapshot.resTimeSample,
        buckets: sortedBuckets.map((b) => ({
          label: b.label,
          minHours: b.minHours,
          maxHours: b.maxHours,
          count: b.count,
        })),
      },
      firstReplyTime: {
        mean: snapshot.firstReplyTimeMean,
        median: snapshot.firstReplyTimeMedian,
        sampleSize: snapshot.firstReplyTimeSample,
      },
      overdueTickets: snapshot.overdueTickets,
      monthlyVolume: sortedMonthly.map((m) => ({
        month: m.month,
        count: m.count,
        label: (() => {
          const [year, mon] = m.month.split('-')
          const d = new Date(parseInt(year), parseInt(mon) - 1, 1)
          return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
        })(),
      })),
      orgTickets: sortedOrgs.slice(0, 20).map((o) => ({
        orgName: o.orgName,
        orgId: o.orgId,
        openCount: o.openCount,
      })),
      assigneeLoads: assigneeLoads.map((a) => ({
        name: a.name,
        openCount: a.openCount,
      })),
      syncedAt: snapshot.syncedAt.toISOString(),
    })
  } catch (error) {
    const message = error?.message || 'Unknown Zendesk route error'
    const missingTable = error?.code === 'P2021' || /does not exist|relation .* does not exist/i.test(message)

    console.error('[zendesk] ERROR:', message)

    if (missingTable) {
      return NextResponse.json(
        emptyZendeskPayload('Zendesk tables are not available in Neon yet. Run: node scripts/sync-zendesk.js')
      )
    }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
