export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/auth'
import { getCxHandoffDetail, searchCxHandoffTranscriptSegments } from '@/lib/cx-handoff'

export async function GET(request, { params }) {
  try {
    const auth = await requireApiUser(['cx', 'admin'])
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

    const q = request.nextUrl.searchParams.get('q') || ''
    const results = await searchCxHandoffTranscriptSegments(handoffId, q)

    return NextResponse.json({
      handoffId,
      query: q,
      results,
    })
  } catch (error) {
    console.error('CX handoff transcript search error:', error)
    return NextResponse.json({ error: error.message || 'Failed to search transcripts.' }, { status: 500 })
  }
}
