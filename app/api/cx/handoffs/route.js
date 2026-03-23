export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { pool } from '@/lib/pg'

export async function GET() {
  try {
    const { rows } = await pool.query(`
      SELECT
        h.id,
        h."clientName",
        h."repName",
        h."closedAt",
        COUNT(DISTINCT p.id)::int AS "promiseCount",
        COUNT(DISTINCT e.id)::int AS "evidenceCount",
        COALESCE(jsonb_array_length(COALESCE(h."rawOutputJson"->'dataGaps', '[]'::jsonb)), 0)::int AS "dataGapCount"
      FROM "CXHandoff" h
      LEFT JOIN "PromiseLedgerItem" p ON p."handoffId" = h.id
      LEFT JOIN "HandoffEvidence" e ON e."handoffId" = h.id
      GROUP BY h.id
      ORDER BY h."closedAt" DESC
    `)

    return NextResponse.json({ handoffs: rows })
  } catch (error) {
    console.error('CX handoff list error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
