import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/auth'
import { pool } from '@/lib/pg'

export const dynamic = 'force-dynamic'

export async function PATCH(request, { params }) {
  const auth = await requireApiUser(['admin', 'superadmin'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = params
  const body = await request.json()
  const { role, disabled } = body

  // Validate role if provided
  if (role !== undefined) {
    const validRoles = ['superadmin', 'admin', 'staff']
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: `role must be one of: ${validRoles.join(', ')}` }, { status: 400 })
    }
    // Only superadmin can assign superadmin role
    if (role === 'superadmin' && auth.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Only superadmin can assign superadmin role' }, { status: 403 })
    }
  }

  // Prevent self-demotion/disable for superadmin
  if (id === auth.user.id && (role !== undefined || disabled === true)) {
    return NextResponse.json({ error: 'Cannot modify your own role or disable yourself' }, { status: 400 })
  }

  // Build update query dynamically
  const updates = []
  const values = []
  let idx = 1

  if (role !== undefined) {
    updates.push(`role = $${idx++}`)
    values.push(role)
  }
  if (disabled !== undefined) {
    updates.push(`disabled = $${idx++}`)
    values.push(disabled)
  }
  updates.push(`"updatedAt" = $${idx++}`)
  values.push(new Date())
  values.push(id)

  if (updates.length === 1) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { rows } = await pool.query(
    `UPDATE "User" SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, name, email, role, disabled, "createdAt"`,
    values
  )

  if (rows.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json({ user: rows[0] })
}
