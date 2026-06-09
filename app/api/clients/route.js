export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/auth'
import { listClientsForUser } from '@/lib/client-intel'

export async function GET() {
  try {
    const auth = await requireApiUser(['ga', 'cx', 'admin', 'superadmin', 'manager'])
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const clients = await listClientsForUser(auth.user)
    return NextResponse.json({ clients })
  } catch (error) {
    console.error('Client intel list error:', error)
    return NextResponse.json({ error: error.message || 'Failed to load clients.' }, { status: error.status || 500 })
  }
}
