export const dynamic = 'force-dynamic'

/**
 * POST /api/clients/[acronym]/gbp/locations/merge
 *
 * Merge two GBP locations with field-by-field conflict resolution.
 * Body: { keepId, deleteId, fieldChoices }
 * fieldChoices: { fieldName: 'keep' | 'delete' } - for conflicting fields
 * Non-conflicting fields are auto-resolved (null → non-null value)
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
    const { keepId, deleteId, fieldChoices = {} } = body

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

    // Map field choices to database fields
    const fieldMapping = {
      locationName: 'locationName',
      address: 'address',
      city: 'city',
      state: 'state',
      gbpUrl: 'gbpUrl',
      placeId: 'placeId', // Also considers gbpPlaceId
      coordinates: ['latitude', 'longitude'], // Special case: two fields
    }

    // All mergeable fields
    const mergeableFields = [
      'locationName',
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

    // Process field choices first (explicit conflicts resolved by user)
    for (const [choiceKey, choice] of Object.entries(fieldChoices)) {
      if (choice === 'delete') {
        // User chose to use the value from deleteRecord
        if (choiceKey === 'coordinates') {
          // Special case: latitude and longitude together
          if (deleteRecord.latitude != null) {
            updates.push(`"latitude" = $${idx++}`)
            values.push(deleteRecord.latitude)
          }
          if (deleteRecord.longitude != null) {
            updates.push(`"longitude" = $${idx++}`)
            values.push(deleteRecord.longitude)
          }
        } else if (choiceKey === 'placeId') {
          // placeId field choice can apply to either placeId or gbpPlaceId
          const placeIdValue = deleteRecord.placeId || deleteRecord.gbpPlaceId
          if (placeIdValue != null) {
            // Prefer placeId field, but update gbpPlaceId if that's what deleteRecord has
            if (deleteRecord.placeId != null) {
              updates.push(`"placeId" = $${idx++}`)
              values.push(deleteRecord.placeId)
            } else if (deleteRecord.gbpPlaceId != null) {
              updates.push(`"gbpPlaceId" = $${idx++}`)
              values.push(deleteRecord.gbpPlaceId)
            }
          }
        } else {
          const dbField = fieldMapping[choiceKey] || choiceKey
          if (deleteRecord[dbField] != null) {
            updates.push(`"${dbField}" = $${idx++}`)
            values.push(deleteRecord[dbField])
          }
        }
      }
      // If choice === 'keep', do nothing (keep keepRecord's value)
    }

    // Auto-resolve remaining fields (where keepRecord has null and deleteRecord has value)
    for (const field of mergeableFields) {
      // Skip if this field was explicitly handled by fieldChoices
      const isHandledByChoice = Object.keys(fieldChoices).some(key => {
        if (key === 'coordinates' && (field === 'latitude' || field === 'longitude')) return true
        if (key === 'placeId' && (field === 'placeId' || field === 'gbpPlaceId')) return true
        return fieldMapping[key] === field || key === field
      })

      if (!isHandledByChoice && keepRecord[field] == null && deleteRecord[field] != null) {
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
