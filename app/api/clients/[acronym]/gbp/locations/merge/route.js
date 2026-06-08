export const dynamic = 'force-dynamic'

/**
 * POST /api/clients/[acronym]/gbp/locations/merge
 *
 * Merge two GBP locations: copy non-null fields from deleteId to keepId, then soft-delete deleteId.
 * Body: { keepId, deleteId }
 * Requires: ga, cx, admin, or superadmin role.
 */

import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/auth'
import { pool } from '@/lib/pg'

export async function POST(req, { params }) {
  const client = await pool.connect()

  try {
    const auth = await requireApiUser(['ga', 'cx', 'admin', 'superadmin'])
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const { acronym } = await params
    const body = await req.json()
    const { keepId, deleteId } = body

    if (!keepId || !deleteId) {
      return NextResponse.json({ error: 'keepId and deleteId are required' }, { status: 400 })
    }

    if (keepId === deleteId) {
      return NextResponse.json({ error: 'Cannot merge a location with itself' }, { status: 400 })
    }

    await client.query('BEGIN')

    // Fetch both records
    const { rows } = await client.query(
      `SELECT * FROM "GBPLocation"
       WHERE id = ANY($1) AND "tenantId" = 'gyc' AND "clientAcronym" = $2
       ORDER BY id`,
      [[keepId, deleteId], acronym.toUpperCase()]
    )

    if (rows.length !== 2) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'One or both locations not found' }, { status: 404 })
    }

    const keepRecord = rows.find(r => r.id === keepId)
    const deleteRecord = rows.find(r => r.id === deleteId)

    if (!keepRecord || !deleteRecord) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'Invalid location IDs' }, { status: 404 })
    }

    // Fields to merge (copy from deleteRecord to keepRecord if keepRecord has null)
    const mergeableFields = [
      'gbpUrl',
      'gbpPlaceId',
      'placeId',
      'cid',
      'address',
      'city',
      'state',
      'latitude',
      'longitude',
      'capacity',
      'currentEnrollment',
      'avgTuition',
    ]

    const updates = []
    const values = []
    let idx = 1

    for (const field of mergeableFields) {
      if (keepRecord[field] == null && deleteRecord[field] != null) {
        updates.push(`"${field}" = $${idx++}`)
        values.push(deleteRecord[field])
      }
    }

    // Always update updatedAt
    updates.push(`"updatedAt" = NOW()`)

    if (updates.length > 1) { // More than just updatedAt
      values.push(keepId, acronym.toUpperCase())
      await client.query(
        `UPDATE "GBPLocation"
         SET ${updates.join(', ')}
         WHERE id = $${idx++} AND "tenantId" = 'gyc' AND "clientAcronym" = $${idx}`,
        values
      )
    }

    // Soft-delete the deleteId record
    await client.query(
      `UPDATE "GBPLocation"
       SET "isActive" = FALSE, "updatedAt" = NOW()
       WHERE id = $1 AND "tenantId" = 'gyc' AND "clientAcronym" = $2`,
      [deleteId, acronym.toUpperCase()]
    )

    // Fetch the final merged record
    const { rows: merged } = await client.query(
      `SELECT * FROM "GBPLocation"
       WHERE id = $1 AND "tenantId" = 'gyc' AND "clientAcronym" = $2`,
      [keepId, acronym.toUpperCase()]
    )

    await client.query('COMMIT')

    return NextResponse.json({
      success: true,
      location: merged[0],
      message: `Merged "${deleteRecord.locationName}" into "${keepRecord.locationName}"`,
    })
  } catch (error) {
    await client.query('ROLLBACK').catch(() => null)
    console.error('[POST /api/clients/[acronym]/gbp/locations/merge]', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to merge locations' 
    }, { status: 500 })
  } finally {
    client.release()
  }
}
