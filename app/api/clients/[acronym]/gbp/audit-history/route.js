export const dynamic = 'force-dynamic'

/**
 * GET /api/clients/[acronym]/gbp/audit-history
 *
 * Returns all audits for all locations of this client,
 * ordered by auditDate DESC.
 */

import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/auth'
import { pool } from '@/lib/pg'

export async function GET(req, { params }) {
  const user = await requireApiUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { acronym } = await params

  const { rows } = await pool.query(
    `SELECT
       a.*,
       l."locationName",
       l."gbpUrl",
       l."city",
       l."state"
     FROM "GBPAudit" a
     JOIN "GBPLocation" l ON l.id = a."locationId"
     WHERE l."clientAcronym" = $1 AND l."tenantId" = 'gyc'
     ORDER BY a."auditDate" DESC`,
    [acronym.toUpperCase()]
  )

  return NextResponse.json({ audits: rows })
}
