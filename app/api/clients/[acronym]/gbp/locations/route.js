export const dynamic = 'force-dynamic'

/**
 * POST /api/clients/[acronym]/gbp/locations
 *
 * Create or update (upsert) a GBP location for this client.
 * Body: { locationName, gbpPlaceId, gbpUrl, address, city, state }
 * Requires: admin or superadmin role.
 *
 * PATCH /api/clients/[acronym]/gbp/locations
 *
 * Update location-level CRM enrollment inputs stored on GBPLocation.
 * Body: { locationId?, locationName?, capacity?, currentEnrollment?, avgTuition? }
 * Requires: ga, cx, admin, or superadmin role.
 */

import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/auth'
import { pool } from '@/lib/pg'
import {
  syncClientProfileEnrollmentRollup,
  upsertClientEnrollmentVerification,
} from '@/lib/enrollment-verification'

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

function parseNullableNumber(value, { label, integer = false } = {}) {
  if (value === null || value === '') return null

  const parsed = typeof value === 'number' ? value : Number(String(value).trim())
  if (!Number.isFinite(parsed)) {
    const err = new Error(`${label || 'Value'} must be a valid number.`)
    err.status = 400
    throw err
  }

  if (integer && !Number.isInteger(parsed)) {
    const err = new Error(`${label || 'Value'} must be a whole number.`)
    err.status = 400
    throw err
  }

  return parsed
}

function serializeLocation(row) {
  if (!row) return row
  return {
    ...row,
    capacity: row.capacity != null ? Number(row.capacity) : null,
    currentEnrollment: row.currentEnrollment != null ? Number(row.currentEnrollment) : null,
    avgTuition: row.avgTuition != null ? Number(row.avgTuition) : null,
  }
}

export async function POST(req, { params }) {
  const auth = await requireApiUser(['admin', 'superadmin'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { acronym } = await params
  const body = await req.json()
  const { locationName, gbpPlaceId, gbpUrl, address, city, state } = body

  if (!locationName?.trim()) {
    return NextResponse.json({ error: 'locationName is required' }, { status: 400 })
  }

  const { rows } = await pool.query(
    `INSERT INTO "GBPLocation"
       ("tenantId", "clientAcronym", "locationName", "gbpPlaceId", "gbpUrl", "address", "city", "state", "updatedAt")
     VALUES ('gyc', $1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT ("tenantId", "clientAcronym", "locationName")
     DO UPDATE SET
       "gbpPlaceId" = EXCLUDED."gbpPlaceId",
       "gbpUrl"     = EXCLUDED."gbpUrl",
       "address"    = EXCLUDED."address",
       "city"       = EXCLUDED."city",
       "state"      = EXCLUDED."state",
       "updatedAt"  = NOW()
     RETURNING *`,
    [
      acronym.toUpperCase(),
      locationName.trim(),
      gbpPlaceId ?? null,
      gbpUrl ?? null,
      address ?? null,
      city ?? null,
      state ?? null,
    ]
  )

  return NextResponse.json({ location: serializeLocation(rows[0]) }, { status: 201 })
}

export async function PATCH(req, { params }) {
  const client = await pool.connect()

  try {
    const auth = await requireApiUser(['ga', 'cx', 'admin', 'superadmin', 'manager'])
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const { user } = auth
    const { acronym } = await params
    const upper = String(acronym || '').toUpperCase()
    const body = await req.json()
    const trimmedLocationName = typeof body.locationName === 'string' ? body.locationName.trim() : ''

    await client.query('BEGIN')

    const updates = []
    const values = []
    let idx = 1

    if (hasOwn(body, 'capacity')) {
      updates.push(`"capacity" = $${idx++}`)
      values.push(parseNullableNumber(body.capacity, { label: 'Capacity', integer: true }))
    }
    if (hasOwn(body, 'currentEnrollment')) {
      updates.push(`"currentEnrollment" = $${idx++}`)
      values.push(parseNullableNumber(body.currentEnrollment, { label: 'Registrations', integer: true }))
    }
    if (hasOwn(body, 'avgTuition')) {
      updates.push(`"avgTuition" = $${idx++}`)
      values.push(parseNullableNumber(body.avgTuition, { label: 'Ave Tuition' }))
    }

    // Info fields — require locationId (cannot upsert by name)
    const INFO_FIELDS = ['nickname', 'address', 'city', 'state', 'gbpUrl']
    const hasInfoField = INFO_FIELDS.some(f => hasOwn(body, f))
    if (hasInfoField && !body.locationId) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'locationId is required when updating location info fields.' }, { status: 400 })
    }
    if (hasOwn(body, 'nickname')) {
      updates.push(`"locationName" = $${idx++}`)
      values.push(typeof body.nickname === 'string' ? body.nickname.trim() : null)
    }
    if (hasOwn(body, 'address')) {
      updates.push(`"address" = $${idx++}`)
      values.push(body.address ?? null)
    }
    if (hasOwn(body, 'city')) {
      updates.push(`"city" = $${idx++}`)
      values.push(body.city ?? null)
    }
    if (hasOwn(body, 'state')) {
      updates.push(`"state" = $${idx++}`)
      values.push(body.state ?? null)
    }
    if (hasOwn(body, 'gbpUrl')) {
      updates.push(`"gbpUrl" = $${idx++}`)
      values.push(body.gbpUrl ?? null)
    }

    if (updates.length === 0) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'No fields provided to update.' }, { status: 400 })
    }

    let rows = []

    if (body.locationId) {
      values.push(body.locationId, upper)
      const result = await client.query(
        `UPDATE "GBPLocation"
         SET ${updates.join(', ')}, "updatedAt" = NOW()
         WHERE id = $${idx++} AND "tenantId" = 'gyc' AND "clientAcronym" = $${idx}
         RETURNING *`,
        values
      )
      rows = result.rows
    } else {
      if (!trimmedLocationName) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'locationId or locationName is required.' }, { status: 400 })
      }

      const existing = await client.query(
        `SELECT id
         FROM "GBPLocation"
         WHERE "tenantId" = 'gyc' AND "clientAcronym" = $1 AND "locationName" = $2
         LIMIT 1`,
        [upper, trimmedLocationName]
      )

      if (existing.rows[0]?.id) {
        const updateValues = [...values, existing.rows[0].id, upper]
        const result = await client.query(
          `UPDATE "GBPLocation"
           SET ${updates.join(', ')}, "updatedAt" = NOW()
           WHERE id = $${idx++} AND "tenantId" = 'gyc' AND "clientAcronym" = $${idx}
           RETURNING *`,
          updateValues
        )
        rows = result.rows
      } else {
        const insertColumns = ['"tenantId"', '"clientAcronym"', '"locationName"', '"isActive"']
        const insertValues = ["'gyc'", `$1`, `$2`, 'TRUE']
        const insertParams = [upper, trimmedLocationName]
        let insertIdx = 3

        if (hasOwn(body, 'capacity')) {
          insertColumns.push('"capacity"')
          insertValues.push(`$${insertIdx++}`)
          insertParams.push(parseNullableNumber(body.capacity, { label: 'Capacity', integer: true }))
        }
        if (hasOwn(body, 'currentEnrollment')) {
          insertColumns.push('"currentEnrollment"')
          insertValues.push(`$${insertIdx++}`)
          insertParams.push(parseNullableNumber(body.currentEnrollment, { label: 'Registrations', integer: true }))
        }
        if (hasOwn(body, 'avgTuition')) {
          insertColumns.push('"avgTuition"')
          insertValues.push(`$${insertIdx++}`)
          insertParams.push(parseNullableNumber(body.avgTuition, { label: 'Ave Tuition' }))
        }

        insertColumns.push('"updatedAt"')
        insertValues.push('NOW()')

        const result = await client.query(
          `INSERT INTO "GBPLocation" (${insertColumns.join(', ')})
           VALUES (${insertValues.join(', ')})
           RETURNING *`,
          insertParams
        )
        rows = result.rows
      }
    }

    if (!rows.length) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'Location not found.' }, { status: 404 })
    }

    const rollup = await syncClientProfileEnrollmentRollup(client, {
      tenantId: 'gyc',
      clientAcronym: upper,
    })

    const verification = await upsertClientEnrollmentVerification(client, {
      tenantId: 'gyc',
      clientAcronym: upper,
      status: 'updated',
      checkedBy: user.email || user.name || null,
    })

    await client.query('COMMIT')

    return NextResponse.json({
      location: serializeLocation(rows[0]),
      rollup,
      verification,
    })
  } catch (error) {
    await client.query('ROLLBACK').catch(() => null)
    console.error('[PATCH /api/clients/[acronym]/gbp/locations]', error)
    return NextResponse.json({ error: error.message || 'Failed to save location metrics.' }, { status: error.status || 500 })
  } finally {
    client.release()
  }
}
