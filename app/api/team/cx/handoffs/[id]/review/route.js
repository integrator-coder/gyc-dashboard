export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/auth'
import { pool } from '@/lib/pg'

export async function PATCH(request, { params }) {
  try {
    const auth = await requireApiUser(['cx', 'admin'])
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const handoffId = Number(params.id)
    const body = await request.json()
    const items = Array.isArray(body?.items) ? body.items : []

    if (!Number.isFinite(handoffId)) {
      return NextResponse.json({ error: 'Invalid handoff id.' }, { status: 400 })
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      for (const item of items) {
        await client.query(
          `
            UPDATE "PromiseLedgerItem"
            SET
              "reviewStatus" = $3,
              "reviewComment" = NULLIF($4, '')
            WHERE id = $1 AND "handoffId" = $2
          `,
          [Number(item.promiseId), handoffId, String(item.reviewStatus || 'Pending Review'), String(item.reviewComment || '')]
        )
      }
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Team CX review patch error:', error)
    return NextResponse.json({ error: error.message || 'Failed to save review.' }, { status: 500 })
  }
}
