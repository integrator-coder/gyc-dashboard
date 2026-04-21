export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/auth'
import { pool } from '@/lib/pg'
import {
  syncClientProfileEnrollmentRollup,
  upsertClientEnrollmentVerification,
} from '@/lib/enrollment-verification'

export async function POST(request, { params }) {
  const auth = await requireApiUser(['ga', 'cx', 'admin', 'superadmin'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { user } = auth
  const { acronym } = await params
  const upper = String(acronym || '').toUpperCase()
  const body = await request.json().catch(() => ({}))
  const notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null

  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await syncClientProfileEnrollmentRollup(client, { tenantId: 'gyc', clientAcronym: upper })

    const verification = await upsertClientEnrollmentVerification(client, {
      tenantId: 'gyc',
      clientAcronym: upper,
      status: 'checked_no_change',
      checkedBy: user.email || user.name || null,
      notes,
    })

    await client.query('COMMIT')
    return NextResponse.json({ ok: true, verification })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('[POST /api/clients/[acronym]/enrollment-verification]', error)
    return NextResponse.json({ error: error.message || 'Failed to record enrollment verification.' }, { status: error.status || 500 })
  } finally {
    client.release()
  }
}
