export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/auth'
import { getClientIntelForUser } from '@/lib/client-intel'

export async function GET(_request, { params }) {
  try {
    const auth = await requireApiUser(['ga', 'cx', 'admin'])
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { acronym } = await params
    const data = await getClientIntelForUser(auth.user, acronym)
    return NextResponse.json(data)
  } catch (error) {
    console.error('Client intel detail error:', error)
    return NextResponse.json({ error: error.message || 'Failed to load client intel.' }, { status: error.status || 500 })
  }
}
