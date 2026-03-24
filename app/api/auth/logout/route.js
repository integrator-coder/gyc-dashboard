export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { clearSession } from '@/lib/auth'

export async function POST() {
  try {
    await clearSession()
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json({ error: error.message || 'Logout failed.' }, { status: 500 })
  }
}
