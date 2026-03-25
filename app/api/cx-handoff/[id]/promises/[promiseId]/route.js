export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/auth'
import { updatePromiseReview } from '@/lib/cx-handoff'

export async function PATCH(request, { params }) {
  try {
    const auth = await requireApiUser(['cx', 'admin'])
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { id, promiseId } = await params
    const handoffId = Number(id)
    const numericPromiseId = Number(promiseId)

    if (!Number.isFinite(handoffId) || !Number.isFinite(numericPromiseId)) {
      return NextResponse.json({ error: 'Invalid handoff or promise id.' }, { status: 400 })
    }

    const body = await request.json()
    const updated = await updatePromiseReview(handoffId, numericPromiseId, {
      reviewStatus: body?.reviewStatus,
      reviewComment: body?.reviewComment,
    })

    if (!updated) {
      return NextResponse.json({ error: 'Promise item not found.' }, { status: 404 })
    }

    return NextResponse.json({ promise: updated })
  } catch (error) {
    console.error('CX handoff promise update error:', error)
    return NextResponse.json({ error: error.message || 'Failed to update promise review.' }, { status: 500 })
  }
}
