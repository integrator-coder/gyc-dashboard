import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/auth'
import { pool } from '@/lib/pg'

export async function GET() {
  const auth = await requireApiUser(['admin', 'superadmin', 'manager'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const { rows } = await pool.query(
      `SELECT acronym, "companyName", mrr 
       FROM "ClientProfile" 
       WHERE "tenantId" = 'gyc' AND mrr > 0
       ORDER BY "companyName"`
    )

    // Build a map for quick lookup
    const mrrMap = {}
    rows.forEach(row => {
      const key = row.companyName?.toLowerCase() || ''
      mrrMap[key] = {
        acronym: row.acronym,
        companyName: row.companyName,
        mrr: parseFloat(row.mrr) || 0,
      }
    })

    return NextResponse.json({ mrrMap })
  } catch (error) {
    console.error('Harvest client-mrr error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export const revalidate = 300 // 5 min cache
