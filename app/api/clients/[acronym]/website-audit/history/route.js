export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireApiUser, userHasRole } from '@/lib/auth'
import { pool } from '@/lib/pg'
import { listWebsiteAuditSnapshotHistory } from '@/lib/website-audit'

export async function GET(request, { params }) {
  try {
    const auth = await requireApiUser(['ga', 'cx', 'admin', 'superadmin'])
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { user } = auth
    const { acronym } = await params
    const upper = String(acronym || '').toUpperCase()

    let profileQuery = `SELECT acronym FROM "ClientProfile" WHERE "tenantId" = $1 AND acronym = $2 LIMIT 1`
    let profileParams = ['gyc', upper]

    if (userHasRole(user, ['ga']) && !userHasRole(user, ['admin', 'superadmin', 'cx'])) {
      profileQuery = `
        SELECT acronym
        FROM "ClientProfile"
        WHERE "tenantId" = $1 AND acronym = $2
          AND lower(COALESCE("assignedGAEmail", '')) = $3
        LIMIT 1
      `
      profileParams = ['gyc', upper, String(user.email || '').toLowerCase()]
    }

    const profileRes = await pool.query(profileQuery, profileParams)
    if (!profileRes.rows.length) {
      return NextResponse.json({ error: 'Client not found.' }, { status: 404 })
    }

    const url = new URL(request.url)
    const limit = Number(url.searchParams.get('limit') || '12')
    const items = await listWebsiteAuditSnapshotHistory({
      tenantId: 'gyc',
      clientAcronym: upper,
      limit,
    })

    return NextResponse.json({
      items,
      limit: Math.max(1, Math.min(Number(limit) || 12, 24)),
    })
  } catch (error) {
    console.error('[GET /api/clients/[acronym]/website-audit/history]', error)
    return NextResponse.json({ error: error.message || 'Failed to load website audit history.' }, { status: error.status || 500 })
  }
}
