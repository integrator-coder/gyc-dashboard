export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { pool } from '@/lib/pg'

const VALID_STATUSES = new Set(['Pending Review', 'Confirmed', 'Clarify', 'Incorrect'])

export async function PATCH(request, { params }) {
  const client = await pool.connect()

  try {
    const handoffId = Number((await params).id)

    if (!Number.isInteger(handoffId)) {
      return NextResponse.json({ error: 'Invalid handoff id' }, { status: 400 })
    }

    const body = await request.json()
    const items = Array.isArray(body?.items) ? body.items : null

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'items array is required' }, { status: 400 })
    }

    for (const item of items) {
      if (!Number.isInteger(Number(item?.promiseId))) {
        return NextResponse.json({ error: 'Each item must include a numeric promiseId' }, { status: 400 })
      }
      if (!VALID_STATUSES.has(item?.reviewStatus)) {
        return NextResponse.json({ error: `Invalid reviewStatus for promise ${item?.promiseId}` }, { status: 400 })
      }
    }

    await client.query('BEGIN')

    const updatedItems = []
    for (const item of items) {
      const result = await client.query(
        `UPDATE "PromiseLedgerItem"
         SET "reviewStatus" = $1,
             "reviewComment" = $2
         WHERE id = $3
           AND "handoffId" = $4
         RETURNING id, "handoffId", "reviewStatus", "reviewComment"`,
        [item.reviewStatus, item.reviewComment ?? null, Number(item.promiseId), handoffId]
      )

      if (!result.rows[0]) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: `Promise ${item.promiseId} not found for handoff ${handoffId}` }, { status: 404 })
      }

      updatedItems.push(result.rows[0])
    }

    await client.query('COMMIT')
    return NextResponse.json({ ok: true, updatedItems })
  } catch (error) {
    try { await client.query('ROLLBACK') } catch {}
    console.error('CX handoff review patch error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  } finally {
    client.release()
  }
}
