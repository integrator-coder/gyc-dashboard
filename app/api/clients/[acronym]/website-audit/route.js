export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireApiUser, userHasRole } from '@/lib/auth'
import { pool } from '@/lib/pg'
import {
  buildFailedWebsiteAuditPayload,
  buildNoWebsiteAuditPayload,
  buildUnconfiguredWebsiteAuditPayload,
  getDataForSeoConfig,
  getLiveWebsiteAudit,
  normalizeWebsiteUrl,
} from '@/lib/website-audit'

export async function GET(_request, { params }) {
  try {
    const auth = await requireApiUser(['ga', 'cx', 'admin', 'superadmin'])
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { user } = auth
    const { acronym } = await params
    const upper = String(acronym || '').toUpperCase()

    let profileQuery = `SELECT website FROM "ClientProfile" WHERE "tenantId" = $1 AND acronym = $2 LIMIT 1`
    let profileParams = ['gyc', upper]

    if (userHasRole(user, ['ga']) && !userHasRole(user, ['admin', 'superadmin', 'cx'])) {
      profileQuery = `
        SELECT website
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

    const websiteUrl = normalizeWebsiteUrl(profileRes.rows[0]?.website)
    if (!websiteUrl) {
      return NextResponse.json(buildNoWebsiteAuditPayload())
    }

    const config = getDataForSeoConfig()
    if (!config.configured) {
      return NextResponse.json(buildUnconfiguredWebsiteAuditPayload(websiteUrl))
    }

    try {
      const audit = await getLiveWebsiteAudit(websiteUrl)
      return NextResponse.json(audit)
    } catch (error) {
      console.error('[GET /api/clients/[acronym]/website-audit] live audit failed', error)
      return NextResponse.json(buildFailedWebsiteAuditPayload(websiteUrl, error.message))
    }
  } catch (error) {
    console.error('[GET /api/clients/[acronym]/website-audit]', error)
    return NextResponse.json({ error: error.message || 'Failed to load website audit.' }, { status: error.status || 500 })
  }
}
