import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/auth'
import { pool } from '@/lib/pg'

export const dynamic = 'force-dynamic'

export async function GET(_req, { params }) {
  const auth = await requireApiUser(_req)
  if (!auth || auth.error) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { acronym } = await params
  const acr = acronym.toUpperCase()

  const result = await pool.query(
    `SELECT * FROM "ClientMeeting" WHERE acronym = $1 ORDER BY "meetingDate" DESC`,
    [acr]
  )
  return NextResponse.json({ meetings: result.rows })
}

export async function PATCH(req, { params }) {
  const auth = await requireApiUser(req, ['admin', 'superadmin', 'ga'])
  if (!auth || auth.error) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { acronym } = await params
  const acr = acronym.toUpperCase()
  const body = await req.json()
  const { id, action, edits } = body

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  if (action === 'approve') {
    await pool.query(
      `UPDATE "ClientMeeting" SET status = 'approved', "reviewedBy" = $1, "updatedAt" = now() WHERE id = $2 AND acronym = $3`,
      [auth.user?.email || 'unknown', id, acr]
    )
    return NextResponse.json({ ok: true, status: 'approved' })
  }

  if (action === 'submit') {
    await pool.query(
      `UPDATE "ClientMeeting" SET status = 'submitted', "submittedAt" = now(), "reviewedBy" = $1, "updatedAt" = now() WHERE id = $2 AND acronym = $3`,
      [auth.user?.email || 'unknown', id, acr]
    )
    return NextResponse.json({ ok: true, status: 'submitted' })
  }

  if (action === 'edit' && edits) {
    const allowed = ['execSummary', 'topics', 'decisions', 'tasks', 'outstandingIssues']
    const sets = []
    const vals = []
    let idx = 1
    for (const [k, v] of Object.entries(edits)) {
      if (allowed.includes(k)) {
        sets.push(`"${k}" = $${idx}`)
        vals.push(typeof v === 'object' ? JSON.stringify(v) : v)
        idx++
      }
    }
    if (sets.length === 0) return NextResponse.json({ error: 'no valid fields' }, { status: 400 })
    vals.push(id, acr)
    await pool.query(
      `UPDATE "ClientMeeting" SET ${sets.join(', ')}, "updatedAt" = now() WHERE id = $${idx} AND acronym = $${idx + 1}`,
      vals
    )
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
