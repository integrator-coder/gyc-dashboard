export const dynamic = 'force-dynamic'

/**
 * POST /api/clients/[acronym]/gbp/locations
 *
 * Create or update (upsert) a GBP location for this client.
 * Body: { locationName, gbpPlaceId, gbpUrl, address, city, state }
 * Requires: admin or superadmin role.
 */

import { NextResponse } from 'next/server'
import { requireApiUser, userHasRole } from '@/lib/auth'
import { pool } from '@/lib/pg'

export async function POST(req, { params }) {
  const user = await requireApiUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!userHasRole(user, ['admin', 'superadmin']))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { acronym } = await params
  const body = await req.json()
  const { locationName, gbpPlaceId, gbpUrl, address, city, state } = body

  if (!locationName?.trim())
    return NextResponse.json({ error: 'locationName is required' }, { status: 400 })

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

  return NextResponse.json({ location: rows[0] }, { status: 201 })
}
