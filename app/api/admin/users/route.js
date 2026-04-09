import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/auth'
import { pool } from '@/lib/pg'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const auth = await requireApiUser(['admin', 'superadmin'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { rows } = await pool.query(
    `SELECT id, name, email, role, disabled, "createdAt" FROM "User" ORDER BY "createdAt" DESC`
  )
  return NextResponse.json({ users: rows })
}

export async function POST(request) {
  const auth = await requireApiUser(['admin', 'superadmin'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json()
  const { email, name, password, role } = body

  if (!email || !password || !role) {
    return NextResponse.json({ error: 'email, password, and role are required' }, { status: 400 })
  }

  const validRoles = ['superadmin', 'admin', 'sales', 'ga', 'staff', 'cx']
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: `role must be one of: ${validRoles.join(', ')}` }, { status: 400 })
  }

  // Only superadmin can create superadmin
  if (role === 'superadmin' && auth.user.role !== 'superadmin') {
    return NextResponse.json({ error: 'Only superadmin can create superadmin users' }, { status: 403 })
  }

  // Check for existing user
  const existing = await pool.query(`SELECT id FROM "User" WHERE lower(email) = lower($1)`, [email])
  if (existing.rows.length > 0) {
    return NextResponse.json({ error: 'A user with that email already exists' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const id = randomUUID()
  const now = new Date()

  const { rows } = await pool.query(
    `INSERT INTO "User" (id, name, email, "passwordHash", role, "organizationId", disabled, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, 1, FALSE, $6, $6)
     RETURNING id, name, email, role, disabled, "createdAt"`,
    [id, name || email.split('@')[0], email.toLowerCase(), passwordHash, role, now]
  )

  return NextResponse.json({ user: rows[0] }, { status: 201 })
}
