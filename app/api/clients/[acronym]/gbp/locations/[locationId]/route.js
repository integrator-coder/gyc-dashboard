export const dynamic = 'force-dynamic'

/**
 * DELETE /api/clients/[acronym]/gbp/locations/[locationId]
 *
 * Soft-delete a GBP location (sets isActive = false).
 * Requires: ga, cx, admin, or superadmin role.
 */

import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/auth'
import { pool } from '@/lib/pg'

export async function DELETE(req, { params }) {
  const auth = await requireApiUser(['ga', 'cx', 'admin', 'superadmin', 'manager'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { acronym, locationId } = await params

  try {
    const { rows } = await pool.query(
      `UPDATE "GBPLocation"
       SET "isActive" = FALSE, "updatedAt" = NOW()
       WHERE id = $1 AND "tenantId" = 'gyc' AND "clientAcronym" = $2
       RETURNING id, "locationName"`,
      [Number(locationId), acronym.toUpperCase()]
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }

    return NextResponse.json({ 
      success: true,
      message: `Location "${rows[0].locationName}" has been removed`
    })
  } catch (error) {
    console.error('[DELETE /api/clients/[acronym]/gbp/locations/[locationId]]', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to delete location' 
    }, { status: 500 })
  }
}
