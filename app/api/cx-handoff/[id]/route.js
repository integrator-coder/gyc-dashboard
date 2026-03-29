export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/auth'
import { getCxHandoffDetail, updateCxHandoffAssignment } from '@/lib/cx-handoff'

export async function GET(_request, { params }) {
  try {
    const auth = await requireApiUser(['cx', 'admin', 'superadmin'])
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { id } = await params
    const handoffId = Number(id)
    if (!Number.isFinite(handoffId)) {
      return NextResponse.json({ error: 'Invalid handoff id.' }, { status: 400 })
    }

    const handoff = await getCxHandoffDetail(handoffId)
    if (!handoff) {
      return NextResponse.json({ error: 'Handoff not found.' }, { status: 404 })
    }

    return NextResponse.json({ handoff })
  } catch (error) {
    console.error('CX handoff detail error:', error)
    return NextResponse.json({ error: error.message || 'Failed to load handoff detail.' }, { status: 500 })
  }
}

export async function PATCH(request, { params }) {
  try {
    const auth = await requireApiUser(['cx', 'admin', 'superadmin'])
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { id } = await params
    const handoffId = Number(id)
    if (!Number.isFinite(handoffId)) {
      return NextResponse.json({ error: 'Invalid handoff id.' }, { status: 400 })
    }

    const body = await request.json()
    const assignedGA = body?.assignedGA ?? null
    const assignedGAEmail = body?.assignedGAEmail ?? null

    const updated = await updateCxHandoffAssignment(handoffId, assignedGA, assignedGAEmail)
    if (!updated) {
      return NextResponse.json({ error: 'Handoff not found.' }, { status: 404 })
    }

    return NextResponse.json({ handoff: updated })
  } catch (error) {
    console.error('CX handoff assignment update error:', error)
    return NextResponse.json({ error: error.message || 'Failed to update handoff.' }, { status: 500 })
  }
}
