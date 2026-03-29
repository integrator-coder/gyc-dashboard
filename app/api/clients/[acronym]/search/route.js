export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/auth'
import { searchClientTranscriptForUser } from '@/lib/client-intel'

export async function GET(request, { params }) {
  try {
    const auth = await requireApiUser(['ga', 'cx', 'admin', 'superadmin'])
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')
    const { acronym } = await params

    if (!String(q || '').trim()) {
      return NextResponse.json({ error: 'Search query is required.' }, { status: 400 })
    }

    const results = await searchClientTranscriptForUser(auth.user, acronym, q)
    return NextResponse.json({ results })
  } catch (error) {
    console.error('Client intel transcript search error:', error)
    return NextResponse.json({ error: error.message || 'Failed to search transcripts.' }, { status: error.status || 500 })
  }
}
