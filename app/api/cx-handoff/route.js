export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/auth'
import { getCxHandoffList } from '@/lib/cx-handoff'

export async function GET() {
  try {
    const auth = await requireApiUser(['cx', 'admin'])
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const handoffs = await getCxHandoffList()
    return NextResponse.json({ handoffs })
  } catch (error) {
    console.error('CX handoff list error:', error)
    return NextResponse.json({ error: error.message || 'Failed to load handoffs.' }, { status: 500 })
  }
}
