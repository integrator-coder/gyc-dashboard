import { NextResponse } from 'next/server'
import pkg from 'pg'
import { requireApiUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'
const { Pool } = pkg
const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

export async function GET(req) {
  const auth = await requireApiUser(['admin', 'superadmin'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const url = new URL(req.url)
  const limit = Math.min(Number(url.searchParams.get('limit') || 100), 500)
  const agentId = url.searchParams.get('agentId') || null

  try {
    let query = `SELECT * FROM "AgentAuditLog"`
    const params = []
    if (agentId) {
      params.push(agentId)
      query += ` WHERE "agentId" = $1`
    }
    query += ` ORDER BY "createdAt" DESC LIMIT $${params.length + 1}`
    params.push(limit)

    const { rows } = await pool.query(query, params)
    return NextResponse.json({ logs: rows })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
