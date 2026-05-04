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

export async function GET(_req, { params }) {
  const auth = await requireApiUser(['ga', 'cx', 'admin', 'superadmin'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

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
         LIMIT 12`,
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
        capacity: loc.capacity != null ? Number(loc.capacity) : null,
        currentEnrollment: loc.currentEnrollment != null ? Number(loc.currentEnrollment) : null,
        avgTuition: loc.avgTuition != null ? Number(loc.avgTuition) : null,
        latestAudit: audits[0] ?? null,
        lastAudit: audits[0] ?? null,
        auditHistory: audits,
        latestSnapshot: snapshots[0] ?? null,
      }
    })
  )

  return NextResponse.json({ locations: enriched })
}
