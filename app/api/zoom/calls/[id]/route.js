export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/auth'
import { pool } from '@/lib/pg'
import { randomUUID } from 'crypto'

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

  // Auto-set classifiedBy/classifiedAt/status when confirming classification
  const isClassifying = Boolean(body.classifiedAs)
  if (isClassifying) {
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
  const call = rows[0]

  // ── Write ActivityLog entries on classification ────────────────────────────
  if (isClassifying) {
    const actorLabel = user.name || user.email || 'Admin'
    const callLabel = call.topic || call.meetingId || id
    const classType = body.classifiedAs
    const repName = body.assignedRepName || call.assignedRepName || null
    const repEmail = body.assignedRepEmail || call.assignedRepEmail || null
    const ghlContactId = body.ghlContactId || call.ghlContactId || null
    const ghlContactName = body.ghlContactName || call.ghlContactName || null

    const logEntries = []

    // 1. Primary entry: the classification event itself
    logEntries.push({
      id: randomUUID(),
      tenantId: 'gyc',
      type: 'zoom_classified',
      referenceId: id,
      referenceType: 'ZoomCall',
      entityId: id,
      entityType: 'zoom_call',
      summary: `Zoom call classified as "${classType}" by ${actorLabel}: "${callLabel}"`,
      detail: {
        callId: id,
        topic: call.topic,
        startTime: call.startTime,
        duration: call.duration,
        classifiedAs: classType,
        assignedRepName: repName,
        assignedRepEmail: repEmail,
        ghlContactName,
        ghlContactId,
        notes: body.notes || null,
      },
      actorEmail: user.email || null,
      actorName: actorLabel,
    })

    // 2. Client card entry — for client-facing call types
    const clientTypes = ['client_meeting', 'onboarding', 'sales', 'blueprint']
    if (clientTypes.includes(classType) && ghlContactId) {
      logEntries.push({
        id: randomUUID(),
        tenantId: 'gyc',
        type: 'client_call_logged',
        referenceId: id,
        referenceType: 'ZoomCall',
        entityId: ghlContactId,
        entityType: 'client',
        summary: `${classType.replace(/_/g, ' ')} call logged for ${ghlContactName || ghlContactId} — "${callLabel}"`,
        detail: {
          callId: id,
          callType: classType,
          topic: call.topic,
          startTime: call.startTime,
          duration: call.duration,
          repName,
          repEmail,
          notes: body.notes || null,
          recordingUrl: call.recordingUrl || null,
        },
        actorEmail: user.email || null,
        actorName: actorLabel,
      })
    }

    // 3. Staff entry — log to the assigned rep's activity history
    if (repEmail) {
      logEntries.push({
        id: randomUUID(),
        tenantId: 'gyc',
        type: 'staff_call_assigned',
        referenceId: id,
        referenceType: 'ZoomCall',
        entityId: repEmail,
        entityType: 'staff',
        summary: `${classType.replace(/_/g, ' ')} call assigned to ${repName || repEmail}: "${callLabel}"`,
        detail: {
          callId: id,
          callType: classType,
          topic: call.topic,
          startTime: call.startTime,
          duration: call.duration,
          clientName: ghlContactName || null,
          clientId: ghlContactId || null,
          notes: body.notes || null,
        },
        actorEmail: user.email || null,
        actorName: actorLabel,
      })
    }

    // Insert all log entries
    if (logEntries.length) {
      const placeholders = logEntries.map((_, i) => {
        const base = i * 11
        return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8},$${base+9},$${base+10},$${base+11})`
      }).join(',')
      const logValues = logEntries.flatMap(e => [
        e.id, e.tenantId, e.type, e.referenceId, e.referenceType,
        e.entityId, e.entityType, e.summary,
        JSON.stringify(e.detail), e.actorEmail, e.actorName,
      ])
      await pool.query(
        `INSERT INTO "ActivityLog" (id,"tenantId",type,"referenceId","referenceType","entityId","entityType",summary,detail,"actorEmail","actorName")
         VALUES ${placeholders}
         ON CONFLICT (id) DO NOTHING`,
        logValues
      )
    }
  }

  return NextResponse.json({ call })
}
