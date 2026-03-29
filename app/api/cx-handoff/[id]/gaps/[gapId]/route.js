export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/auth'
import { updateCxHandoffGap } from '@/lib/cx-handoff'

export async function PATCH(request, { params }) {
  try {
    const auth = await requireApiUser(['cx', 'admin', 'superadmin'])
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { id, gapId } = await params
    const handoffId = Number(id)
    const numericGapId = Number(gapId)

    if (!Number.isFinite(handoffId) || !Number.isFinite(numericGapId)) {
      return NextResponse.json({ error: 'Invalid handoff or gap id.' }, { status: 400 })
    }

    const body = await request.json()
    const updated = await updateCxHandoffGap(handoffId, numericGapId, {
      resolvedValue: body?.resolvedValue,
      filledBy: body?.filledBy,
      status: body?.status,
    })

    if (!updated) {
      return NextResponse.json({ error: 'Data gap not found.' }, { status: 404 })
    }

    return NextResponse.json({ gap: updated })
  } catch (error) {
    console.error('CX handoff data gap update error:', error)
    return NextResponse.json({ error: error.message || 'Failed to update data gap.' }, { status: 500 })
  }
}
