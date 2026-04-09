export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/auth'
import { pool } from '@/lib/pg'

export async function GET(request, { params }) {
  const { user, error, status } = await requireApiUser(['superadmin', 'admin'])
  if (error) return NextResponse.json({ error }, { status })

  const { id } = await params
  const { rows } = await pool.query(
    `SELECT * FROM "ZoomCall" WHERE id = $1 LIMIT 1`,
    [id]
  )

  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ call: rows[0] })
}

export async function PATCH(request, { params }) {
  const { user, error, status } = await requireApiUser(['superadmin', 'admin'])
  if (error) return NextResponse.json({ error }, { status })

  const { id } = await params
  const body = await request.json()

  const allowedFields = [
    'classifiedAs', 'notes', 'assignedRepEmail', 'assignedRepName',
    'ghlContactId', 'ghlContactName', 'status', 'workflowTriggered',
  ]

  const updates = []
  const values = []
  let idx = 1

  for (const field of allowedFields) {
    if (field in body) {
      updates.push(`"${field}" = $${idx}`)
      values.push(body[field])
      idx++
    }
  }

  if (!updates.length) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  // Auto-set classifiedBy/classifiedAt when confirming classification
  if (body.classifiedAs) {
    updates.push(`"classifiedBy" = $${idx}`)
    values.push(user.email || user.name || 'unknown')
    idx++
    updates.push(`"classifiedAt" = NOW()`)
    updates.push(`status = 'classified'`)
  }

  values.push(id)
  const { rows } = await pool.query(
    `UPDATE "ZoomCall" SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  )

  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ call: rows[0] })
}
