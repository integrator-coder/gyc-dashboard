export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { authenticateUser, createSession, serializeUser } from '@/lib/auth'

export async function POST(request) {
  try {
    const body = await request.json()
    const email = String(body?.email || '').trim()
    const password = String(body?.password || '')

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
    }

    const user = await authenticateUser(email, password)
    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
    }

    await createSession(user.id)
    return NextResponse.json({ ok: true, user: serializeUser(user) })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: error.message || 'Login failed.' }, { status: 500 })
  }
}
