export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireApiUser, userHasRole } from '@/lib/auth'
import { pool } from '@/lib/pg'
import {
  buildFailedWebsiteAuditPayload,
  buildNoWebsiteAuditPayload,
  buildPendingWebsiteAuditPayload,
  buildUnconfiguredWebsiteAuditPayload,
  getLatestWebsiteAuditSnapshot,
  getDataForSeoConfig,
  getLiveWebsiteAudit,
  normalizeWebsiteUrl,
  upsertWebsiteAuditSnapshot,
} from '@/lib/website-audit'

async function getAuthorizedClientWebsite({ params, user }) {
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
    return { error: NextResponse.json({ error: 'Client not found.' }, { status: 404 }) }
  }

  return {
    acronym: upper,
    websiteUrl: normalizeWebsiteUrl(profileRes.rows[0]?.website),
  }
}

export async function GET(_request, { params }) {
  try {
    const auth = await requireApiUser(['ga', 'cx', 'admin', 'superadmin', 'manager'])
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { user } = auth
    const scopedClient = await getAuthorizedClientWebsite({ params, user })
    if (scopedClient.error) return scopedClient.error

    const { acronym: upper, websiteUrl } = scopedClient
    if (!websiteUrl) {
      return NextResponse.json(buildNoWebsiteAuditPayload())
    }

    const cachedAudit = await getLatestWebsiteAuditSnapshot({
      tenantId: 'gyc',
      clientAcronym: upper,
      websiteUrl,
    })

    if (cachedAudit) {
      return NextResponse.json(cachedAudit)
    }

    const config = getDataForSeoConfig()
    if (!config.configured) {
      return NextResponse.json(buildUnconfiguredWebsiteAuditPayload(websiteUrl))
    }

    return NextResponse.json(buildPendingWebsiteAuditPayload(websiteUrl))
  } catch (error) {
    console.error('[GET /api/clients/[acronym]/website-audit]', error)
    return NextResponse.json({ error: error.message || 'Failed to load website audit.' }, { status: error.status || 500 })
  }
}

export async function POST(_request, { params }) {
  try {
    const auth = await requireApiUser(['ga', 'cx', 'admin', 'superadmin', 'manager'])
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { user } = auth
    const scopedClient = await getAuthorizedClientWebsite({ params, user })
    if (scopedClient.error) return scopedClient.error

    const { acronym: upper, websiteUrl } = scopedClient
    if (!websiteUrl) {
      return NextResponse.json(buildNoWebsiteAuditPayload())
    }

    const config = getDataForSeoConfig()
    if (!config.configured) {
      return NextResponse.json(buildUnconfiguredWebsiteAuditPayload(websiteUrl))
    }

    try {
      const audit = await getLiveWebsiteAudit(websiteUrl)

      try {
        await upsertWebsiteAuditSnapshot({
          tenantId: 'gyc',
          clientAcronym: upper,
          audit,
        })
      } catch (snapshotError) {
        console.error('[GET /api/clients/[acronym]/website-audit] snapshot upsert failed', snapshotError)
      }

      return NextResponse.json(audit)
    } catch (error) {
      console.error('[POST /api/clients/[acronym]/website-audit] live audit failed', error)
      return NextResponse.json(buildFailedWebsiteAuditPayload(websiteUrl, error.message))
    }
  } catch (error) {
    console.error('[POST /api/clients/[acronym]/website-audit]', error)
    return NextResponse.json({ error: error.message || 'Failed to refresh website audit.' }, { status: error.status || 500 })
  }
}
