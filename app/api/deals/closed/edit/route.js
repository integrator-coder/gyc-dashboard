export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/auth'
import pkg from 'pg'

const { Pool } = pkg
const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

/**
 * PATCH /api/deals/closed/edit
 *
 * Apply manual overrides to a deal (by clientName + dealDate + tenantId).
 * Overrides are never touched by the PandaDoc sync — only by this endpoint.
 *
 * Body: { clientName, dealDate, dealOutcome, pifOverride, termOverride }
 *   - dealOutcome : 'New Deal' | 'Lateral' | 'Down Sell' | null  (null clears it)
 *   - pifOverride : true | false | null  (null = use synced value)
 *   - termOverride: number | null        (null = use synced value)
 */
export async function PATCH(request) {
  try {
    const auth = await requireApiUser(['admin', 'superadmin', 'manager', 'staff'])
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json()
    const { clientName, dealDate, dealOutcome, pifOverride, termOverride } = body

    if (!clientName || !dealDate) {
      return NextResponse.json(
        { error: 'clientName and dealDate are required' },
        { status: 400 }
      )
    }

    // Validate dealOutcome if provided
    const validOutcomes = ['New Deal', 'Lateral', 'Down Sell', null]
    if (dealOutcome !== undefined && !validOutcomes.includes(dealOutcome)) {
      return NextResponse.json(
        { error: `Invalid dealOutcome: must be one of ${validOutcomes.filter(Boolean).join(', ')} or null` },
        { status: 400 }
      )
    }

    const editedBy = auth.user?.email || auth.user?.username || 'unknown'

    const result = await pool.query(
      `UPDATE "SalesDeal"
       SET
         "dealOutcome"  = $1,
         "pifOverride"  = $2,
         "termOverride" = $3,
         "lastEditedAt" = NOW(),
         "editedBy"     = $4
       WHERE "clientName" = $5
         AND "dealDate"   = $6
         AND "tenantId"   = 'gyc'`,
      [
        dealOutcome   ?? null,
        pifOverride   ?? null,
        termOverride  ?? null,
        editedBy,
        clientName,
        dealDate,
      ]
    )

    return NextResponse.json({ ok: true, updated: result.rowCount })
  } catch (err) {
    console.error('[deals/closed/edit]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
