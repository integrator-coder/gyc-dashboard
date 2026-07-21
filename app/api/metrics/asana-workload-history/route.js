import { NextResponse } from 'next/server'
import { pool } from '@/lib/pg'
import { requireApiUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req) {
  const auth = await requireApiUser(['sales', 'ga', 'cx', 'recon', 'admin', 'superadmin', 'manager'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(req.url)
  const days = parseInt(searchParams.get('days') || '90', 10)

  const { rows } = await pool.query(
    `SELECT
       id,
       "syncedAt",
       "totalOpen",
       "totalOverdue",
       "dueSoon",
       "completedThisWeek",
       "completedThisMonth"
     FROM "AsanaSnapshot"
     WHERE "syncedAt" >= NOW() - ($1 || ' days')::interval
     ORDER BY "syncedAt" ASC`,
    [days]
  )

  const data = rows.map(r => ({
    date: new Date(r.syncedAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: 'America/Toronto' }),
    dateRaw: r.syncedAt,
    totalOpen: r.totalOpen,
    totalOverdue: r.totalOverdue,
    dueSoon: r.dueSoon,
    completedThisWeek: r.completedThisWeek,
    completedThisMonth: r.completedThisMonth,
  }))

  return NextResponse.json({ data, updatedAt: new Date().toISOString() })
}
