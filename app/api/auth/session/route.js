export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getSessionUser, serializeUser } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getSessionUser()
    return NextResponse.json({ user: serializeUser(user) })
  } catch (error) {
    console.error('Session error:', error)
    return NextResponse.json({ error: error.message || 'Failed to load session.' }, { status: 500 })
  }
}
