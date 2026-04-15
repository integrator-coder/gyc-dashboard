export const dynamic = 'force-dynamic'

/**
 * GET /api/clients/[acronym]/gbp
 *
 * Returns all active GBPLocations for this client, each with:
 *   - latestAudit  (most recent GBPAudit row, or null)
 *   - latestSnapshot (most recent GBPSnapshot row, or null)
 */

import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/auth'
import { pool } from '@/lib/pg'

export async function GET(req, { params }) {
  const user = await requireApiUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { acronym } = await params

  const { rows: locations } = await pool.query(
    `SELECT * FROM "GBPLocation"
     WHERE "tenantId" = 'gyc' AND "clientAcronym" = $1 AND "isActive" = TRUE
     ORDER BY "locationName" ASC`,
    [acronym.toUpperCase()]
  )

  // For each location, fetch latest audit + latest snapshot
  const enriched = await Promise.all(
    locations.map(async (loc) => {
      const { rows: audits } = await pool.query(
        `SELECT * FROM "GBPAudit"
         WHERE "locationId" = $1
         ORDER BY "auditDate" DESC
         LIMIT 1`,
        [loc.id]
      )
      const { rows: snapshots } = await pool.query(
        `SELECT * FROM "GBPSnapshot"
         WHERE "locationId" = $1
         ORDER BY "snapshotDate" DESC
         LIMIT 1`,
        [loc.id]
      )
      return {
        ...loc,
        latestAudit: audits[0] ?? null,
        latestSnapshot: snapshots[0] ?? null,
      }
    })
  )

  return NextResponse.json({ locations: enriched })
}
