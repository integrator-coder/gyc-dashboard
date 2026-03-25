export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireApiUser, userHasRole } from '@/lib/auth'
import { pool } from '@/lib/pg'
import { getRepAliases } from '@/lib/team'

export async function GET() {
  try {
    const auth = await requireApiUser(['sales', 'ga', 'cx', 'admin'])
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const user = auth.user
    const hasFullQueueAccess = userHasRole(user, ['cx', 'admin'])
    const aliases = getRepAliases(user)
    const aliasPatterns = aliases.map((alias) => `%${alias.toLowerCase()}%`)

    const params = []
    let whereClause = `COALESCE(zc."classificationStatus", 'needs-confirmation') = 'needs-confirmation'`

    if (!hasFullQueueAccess) {
      params.push(aliasPatterns, user.email.toLowerCase())
      whereClause += `
        AND (
          EXISTS (
            SELECT 1
            FROM unnest($1::text[]) AS pattern
            WHERE lower(COALESCE(zc."repName", '')) LIKE pattern
               OR lower(COALESCE(zc."hostName", '')) LIKE pattern
          )
          OR lower(COALESCE(zc."hostEmail", '')) = $2
        )
      `
    }

    const callQuery = `
      SELECT
        zc.id,
        zc."meetingTopic",
        zc."startedAt",
        zc."callDate",
        zc."durationSecs",
        zc."callLink",
        zc."repName",
        zc."hostEmail",
        zc."hostName",
        zc."clientName",
        zc.acronym,
        zc."classificationStatus"
      FROM "ZoomCall" zc
      WHERE ${whereClause}
      ORDER BY COALESCE(zc."callDate", zc."startedAt", zc."createdAt") DESC NULLS LAST
      LIMIT 100
    `

    const suggestionsQuery = `
      SELECT DISTINCT c.name AS value, c.acronym
      FROM "ClientFunnelMonth" cfm
      JOIN "Client" c ON c.id = cfm."clientId"
      WHERE c.name IS NOT NULL
      ORDER BY c.name ASC
      LIMIT 250
    `

    const [callsResult, suggestionsResult] = await Promise.all([
      pool.query(callQuery, params),
      pool.query(suggestionsQuery),
    ])

    return NextResponse.json({
      calls: callsResult.rows,
      clientSuggestions: suggestionsResult.rows,
      repAliases: aliases,
    })
  } catch (error) {
    console.error('Team classify list error:', error)
    return NextResponse.json({ error: error.message || 'Failed to load classification queue.' }, { status: 500 })
  }
}
