export const dynamic = 'force-dynamic'

/**
 * GET /api/clients/search?q={query}
 *
 * Lightweight search across ClientProfile by acronym or companyName.
 * Powers the acronym lookup in the Zoom classifier UI.
 *
 * Returns: id, acronym, companyName, assignedGA, status, mrr
 *
 * Query params:
 *   ?q=abc         required — search string (min 1 char)
 *   ?limit=20      max results (default 20, hard cap 100)
 */

import { NextResponse } from 'next/server'
import { pool } from '@/lib/pg'

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const q     = (searchParams.get('q') || '').trim()
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))

    if (!q) {
      return NextResponse.json({ results: [] })
    }

    const { rows } = await pool.query(
      `SELECT
         id,
         "acronym",
         "companyName",
         "assignedGA",
         "status",
         "mrr",
         "stripeCustomerId",
         "ghlContactId",
         "isOverdue"
       FROM "ClientProfile"
       WHERE "tenantId" = 'gyc'
         AND (
           LOWER("acronym")     LIKE LOWER($1)
           OR LOWER("companyName") LIKE LOWER($2)
         )
       ORDER BY
         -- Exact acronym match first
         (LOWER("acronym") = LOWER($3))  DESC,
         -- Then acronym prefix
         ("acronym" ILIKE $4)            DESC,
         -- Then by name
         "companyName" ASC
       LIMIT $5`,
      [
        `%${q}%`,           // $1 acronym LIKE
        `%${q}%`,           // $2 companyName LIKE
        q,                  // $3 exact acronym
        `${q}%`,            // $4 acronym prefix
        limit,              // $5
      ]
    )

    return NextResponse.json({ results: rows })
  } catch (err) {
    console.error('[GET /api/clients/search] error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
