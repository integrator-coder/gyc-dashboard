export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/auth'
import { pool } from '@/lib/pg'

export async function GET() {
  try {
    const auth = await requireApiUser(['sales', 'ga', 'cx', 'admin'])
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { rows } = await pool.query(`
      SELECT DISTINCT c.name AS value, c.acronym
      FROM "ClientFunnelMonth" cfm
      JOIN "Client" c ON c.id = cfm."clientId"
      WHERE c.name IS NOT NULL
      ORDER BY c.name ASC
      LIMIT 250
    `)

    return NextResponse.json({ clients: rows })
  } catch (error) {
    console.error('Team classify clients error:', error)
    return NextResponse.json({ error: error.message || 'Failed to load client suggestions.' }, { status: 500 })
  }
}
