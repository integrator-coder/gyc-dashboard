export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireApiUser, userHasRole } from '@/lib/auth'
import { pool } from '@/lib/pg'
import { getRepAliases } from '@/lib/team'

export async function PATCH(request, { params }) {
  try {
    const auth = await requireApiUser(['sales', 'ga', 'admin'])
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const user = auth.user
    const body = await request.json()
    const callId = params.callId
    const clientName = String(body?.clientName || '').trim()
    const acronym = String(body?.acronym || '').trim().toUpperCase()

    if (!clientName || !acronym) {
      return NextResponse.json({ error: 'Client name and acronym are required.' }, { status: 400 })
    }

    const isAdmin = userHasRole(user, ['admin'])
    if (!isAdmin) {
      const aliases = getRepAliases(user)
      const aliasPatterns = aliases.map((alias) => `%${alias.toLowerCase()}%`)
      const ownership = await pool.query(
        `
          SELECT id
          FROM "ZoomCall"
          WHERE id = $1
            AND (
              EXISTS (
                SELECT 1
                FROM unnest($2::text[]) AS pattern
                WHERE lower(COALESCE("repName", '')) LIKE pattern
                   OR lower(COALESCE("hostName", '')) LIKE pattern
              )
              OR lower(COALESCE("hostEmail", '')) = $3
            )
          LIMIT 1
        `,
        [callId, aliasPatterns, user.email.toLowerCase()]
      )

      if (!ownership.rows[0]) {
        return NextResponse.json({ error: 'You do not have access to classify this call.' }, { status: 403 })
      }
    }

    const { rows } = await pool.query(
      `
        UPDATE "ZoomCall"
        SET
          "clientName" = $2,
          acronym = $3,
          "classificationStatus" = 'confirmed'
        WHERE id = $1
        RETURNING id, "clientName", acronym, "classificationStatus"
      `,
      [callId, clientName, acronym]
    )

    if (!rows[0]) {
      return NextResponse.json({ error: 'Call not found.' }, { status: 404 })
    }

    return NextResponse.json({ ok: true, call: rows[0] })
  } catch (error) {
    console.error('Team classify patch error:', error)
    return NextResponse.json({ error: error.message || 'Failed to save classification.' }, { status: 500 })
  }
}
