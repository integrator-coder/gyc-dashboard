export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import pkg from 'pg'
const { Pool } = pkg

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "HRScorecard" (
      "id" SERIAL PRIMARY KEY,
      "period" TEXT NOT NULL,
      "periodType" TEXT NOT NULL,
      "year" INT NOT NULL,
      "quarter" INT,
      "quarterKey" INT NOT NULL,
      "revenue" DECIMAL(14,2),
      "headcount" DECIMAL(6,2),
      "baseSalaryTotal" DECIMAL(14,2),
      "totalComp" DECIMAL(14,2),
      "syncedAt" TIMESTAMP DEFAULT NOW(),
      "updatedAt" TIMESTAMP DEFAULT NOW(),
      UNIQUE ("year", "quarterKey")
    );
  `)
}

function enrichRow(row) {
  const isQuarterly = row.periodType === 'quarterly'
  const multiplier = isQuarterly ? 4 : 1

  const revenue = row.revenue !== null ? Number(row.revenue) : null
  const headcount = row.headcount !== null ? Number(row.headcount) : null
  const baseSalaryTotal = row.baseSalaryTotal !== null ? Number(row.baseSalaryTotal) : null
  const totalComp = row.totalComp !== null ? Number(row.totalComp) : null

  const annualRevenue = revenue !== null ? revenue * multiplier : null
  const annualTotalComp = totalComp !== null ? totalComp * multiplier : null
  const annualBaseSalary = baseSalaryTotal !== null ? baseSalaryTotal * multiplier : null

  const rpe = annualRevenue !== null && headcount !== null && headcount > 0
    ? annualRevenue / headcount
    : null

  const impliedHcBase = annualBaseSalary !== null ? annualBaseSalary / 85000 : null
  const impliedHcTotal = annualTotalComp !== null ? annualTotalComp / 85000 : null

  const standardizedRpe = annualRevenue !== null && impliedHcTotal !== null && impliedHcTotal > 0
    ? annualRevenue / impliedHcTotal
    : null

  const compRatioPct = annualTotalComp !== null && annualRevenue !== null && annualRevenue > 0
    ? (annualTotalComp / annualRevenue) * 100
    : null

  const roi = annualRevenue !== null && annualTotalComp !== null && annualTotalComp > 0
    ? annualRevenue / annualTotalComp
    : null

  return {
    id: row.id,
    period: row.period,
    periodType: row.periodType,
    year: row.year,
    quarter: row.quarter,
    quarterKey: row.quarterKey,
    revenue,
    headcount,
    baseSalaryTotal,
    totalComp,
    syncedAt: row.syncedAt,
    updatedAt: row.updatedAt,
    // derived
    annualRevenue,
    annualTotalComp,
    annualBaseSalary,
    rpe,
    impliedHcBase,
    impliedHcTotal,
    standardizedRpe,
    compRatioPct,
    roi,
  }
}

export async function GET() {
  try {
    await requireUser(['superadmin', 'admin'])
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await ensureTable()

    const { rows } = await pool.query(`
      SELECT * FROM "HRScorecard"
      ORDER BY "year" ASC, "quarterKey" ASC
    `)

    const enriched = rows.map(enrichRow)
    return NextResponse.json(enriched)
  } catch (error) {
    console.error('HR scorecard error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
