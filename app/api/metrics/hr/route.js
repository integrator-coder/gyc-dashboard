export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import pkg from 'pg'
const { Pool } = pkg

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

async function ensureHRConfigTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "HRConfig" (
      "id" SERIAL PRIMARY KEY,
      "tenantId" TEXT NOT NULL DEFAULT 'gyc',
      "monthlyPayroll" DECIMAL(12,2),
      "updatedAt" TIMESTAMP DEFAULT NOW(),
      "updatedBy" TEXT
    );
  `)
  // Insert default row if none exists
  await pool.query(`
    INSERT INTO "HRConfig" ("tenantId", "monthlyPayroll")
    VALUES ('gyc', 132500)
    ON CONFLICT DO NOTHING;
  `)
}

export async function GET() {
  try {
    await requireUser(['superadmin', 'admin'])
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const client = await pool.connect()
  try {
    await ensureHRConfigTable()

    // Get HR config
    const { rows: configRows } = await client.query(`
      SELECT * FROM "HRConfig" WHERE "tenantId" = 'gyc' ORDER BY "updatedAt" DESC LIMIT 1
    `)
    const config = configRows[0] || null

    // Get latest MRR from StripeMetrics for RPE calc
    const { rows: metricsRows } = await client.query(`
      SELECT mrr FROM "StripeMetrics" ORDER BY "syncedAt" DESC LIMIT 1
    `)
    const mrr = Number(metricsRows[0]?.mrr || 0)

    const monthlyPayroll = Number(config?.monthlyPayroll || 132500)
    const impliedHeadcount = monthlyPayroll / (85000 / 12) // monthly equivalent of $85k/yr
    const rpe = mrr > 0 && impliedHeadcount > 0 ? (mrr * 12) / impliedHeadcount : null

    return NextResponse.json({
      config: {
        monthlyPayroll,
        updatedAt: config?.updatedAt || null,
        updatedBy: config?.updatedBy || null,
      },
      computed: {
        impliedHeadcount: Math.round(impliedHeadcount * 10) / 10,
        rpe,
        mrr,
      },
    })
  } catch (error) {
    console.error('HR metrics error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  } finally {
    client.release()
  }
}

export async function POST(req) {
  let user
  try {
    user = await requireUser(['superadmin', 'admin'])
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const client = await pool.connect()
  try {
    await ensureHRConfigTable()

    const body = await req.json()
    const { monthlyPayroll } = body

    if (typeof monthlyPayroll !== 'number' || monthlyPayroll <= 0) {
      return NextResponse.json({ error: 'Invalid monthlyPayroll value' }, { status: 400 })
    }

    // Upsert — delete old and insert new for this tenantId
    await client.query(`DELETE FROM "HRConfig" WHERE "tenantId" = 'gyc'`)
    await client.query(`
      INSERT INTO "HRConfig" ("tenantId", "monthlyPayroll", "updatedAt", "updatedBy")
      VALUES ('gyc', $1, NOW(), $2)
    `, [monthlyPayroll, user?.email || 'admin'])

    return NextResponse.json({ success: true, monthlyPayroll })
  } catch (error) {
    console.error('HR config update error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  } finally {
    client.release()
  }
}
