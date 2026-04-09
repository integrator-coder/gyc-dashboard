export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/auth'
import { pool } from '@/lib/pg'

export async function GET(request) {
  const { user, error, status } = await requireApiUser(['superadmin', 'admin'])
  if (error) return NextResponse.json({ error }, { status })

  const { searchParams } = new URL(request.url)
  const statusFilter = searchParams.get('status') || 'pending'
  const typeFilter = searchParams.get('type')
  const search = searchParams.get('search') || ''
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = parseInt(searchParams.get('limit') || '50', 10)
  const offset = (page - 1) * limit

  const conditions = []
  const values = []
  let idx = 1

  if (statusFilter === 'classified') {
    conditions.push(`status = 'classified'`)
  } else if (statusFilter === 'all') {
    // no filter
  } else {
    // default: pending / unclassified
    conditions.push(`(status = 'pending' OR status IS NULL)`)
  }

  if (typeFilter) {
    conditions.push(`("aiClassification" = $${idx} OR "classifiedAs" = $${idx})`)
    values.push(typeFilter)
    idx++
  }

  if (search) {
    conditions.push(`(topic ILIKE $${idx} OR "hostName" ILIKE $${idx} OR "ghlContactName" ILIKE $${idx})`)
    values.push(`%${search}%`)
    idx++
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const [rows, countRes] = await Promise.all([
    pool.query(
      `SELECT id, "meetingId", topic, "hostEmail", "hostName", "startTime", duration,
              participants, "recordingUrl", "transcriptUrl",
              "aiSummary", "aiClassification", "aiConfidence",
              "classifiedAs", "classifiedBy", "classifiedAt",
              "ghlContactId", "ghlContactName", "ghlPipelineStage",
              "assignedRepEmail", "assignedRepName",
              status, notes, "syncedAt", "createdAt"
       FROM "ZoomCall"
       ${where}
       ORDER BY "startTime" DESC NULLS LAST
       LIMIT ${limit} OFFSET ${offset}`,
      values
    ),
    pool.query(
      `SELECT COUNT(*) FROM "ZoomCall" ${where}`,
      values
    ),
  ])

  // Also get pending count for badge
  const pendingRes = await pool.query(
    `SELECT COUNT(*) FROM "ZoomCall" WHERE (status = 'pending' OR status IS NULL)`
  )

  return NextResponse.json({
    calls: rows.rows,
    total: parseInt(countRes.rows[0].count, 10),
    page,
    limit,
    pendingCount: parseInt(pendingRes.rows[0].count, 10),
  })
}
