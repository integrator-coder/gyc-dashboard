import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const snapshot = await prisma.asanaSnapshot.findFirst({
    orderBy: { syncedAt: 'desc' },
    include: { AsanaAssigneeLoad: { orderBy: { totalOpen: 'desc' } } },
  })

  if (!snapshot) {
    return NextResponse.json(
      { error: 'No Asana data yet. Run: node scripts/sync-asana.js' },
      { status: 503 }
    )
  }

  return NextResponse.json({
    totalOpen:          snapshot.totalOpen,
    totalOverdue:       snapshot.totalOverdue,
    dueSoon:            snapshot.dueSoon,
    completedThisWeek:  snapshot.completedThisWeek,
    completedThisMonth: snapshot.completedThisMonth,
    assignees: snapshot.AsanaAssigneeLoad.map(a => ({
      name:              a.name,
      email:             a.email,
      totalOpen:         a.totalOpen,
      overdue:           a.overdue,
      dueSoon:           a.dueSoon,
      completedThisWeek: a.completedThisWeek,
    })),
    syncedAt: snapshot.syncedAt.toISOString(),
  })
}
