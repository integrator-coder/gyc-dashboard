import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const { Pool } = pg
const secretsPath = path.join(process.env.HOME, '.openclaw', 'secrets.json')
const secrets = JSON.parse(fs.readFileSync(secretsPath, 'utf8'))
const connectionString = secrets.NEON_DATABASE_URL || secrets.DATABASE_URL

if (!connectionString) throw new Error('NEON_DATABASE_URL or DATABASE_URL is required')

const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } })

try {
  const { rows: [snapshot] } = await pool.query(`
    SELECT
      ROUND(COALESCE(SUM(mrr), 0)::numeric, 2) AS mrr,
      COUNT(*)::int AS customer_count
    FROM "StripeCustomer"
    WHERE status IN ('active', 'past_due', 'unpaid')
  `)

  const { rows: history } = await pool.query(`
    SELECT
      to_char(day, 'YYYY-MM-DD') AS date,
      ROUND(COALESCE(SUM(sc.mrr), 0)::numeric, 2) AS mrr,
      COUNT(sc.id)::int AS customer_count
    FROM generate_series(
      CURRENT_DATE - INTERVAL '29 days',
      CURRENT_DATE,
      INTERVAL '1 day'
    ) AS day
    LEFT JOIN "StripeCustomer" sc
      ON sc.status IN ('active', 'past_due', 'unpaid')
      AND sc."createdAt"::date <= day::date
      AND (sc."canceledAt" IS NULL OR sc."canceledAt"::date > day::date)
    GROUP BY day
    ORDER BY day ASC
  `)

  const { rows: anomalies } = await pool.query(`
    SELECT
      id, name, email, status, mrr,
      "createdAt", "canceledAt",
      CASE
        WHEN "createdAt" IS NULL THEN 'null_created_at'
        WHEN "createdAt"::date > CURRENT_DATE THEN 'future_created_at'
        WHEN "canceledAt"::date <= CURRENT_DATE THEN 'stale_canceled_at'
      END AS anomaly
    FROM "StripeCustomer"
    WHERE status IN ('active', 'past_due', 'unpaid')
      AND (
        "createdAt" IS NULL
        OR "createdAt"::date > CURRENT_DATE
        OR "canceledAt"::date <= CURRENT_DATE
      )
    ORDER BY anomaly, mrr DESC, name
  `)

  const averageMrr = history.reduce((sum, row) => sum + Number(row.mrr), 0) / history.length
  const averageCustomers = history.reduce((sum, row) => sum + Number(row.customer_count), 0) / history.length
  const oldest = history[0]
  const today = history.at(-1)

  console.log('CURRENT SNAPSHOT')
  console.table([{ mrr: Number(snapshot.mrr), customer_count: snapshot.customer_count }])
  console.log('\n30-DAY LIFECYCLE SERIES')
  console.table(history.map((row) => ({
    date: row.date,
    mrr: Number(row.mrr),
    customer_count: row.customer_count,
  })))
  console.log('\nSUMMARY')
  console.table([{
    oldest_date: oldest.date,
    oldest_mrr: Number(oldest.mrr),
    today_date: today.date,
    today_mrr: Number(today.mrr),
    average_mrr: Math.round(averageMrr * 100) / 100,
    average_customer_count: Math.round(averageCustomers * 100) / 100,
    snapshot_mrr: Number(snapshot.mrr),
    difference: Math.round((Number(snapshot.mrr) - Number(today.mrr)) * 100) / 100,
    reconciles: Number(snapshot.mrr) === Number(today.mrr),
  }])
  console.log('\nACTIVE-STATUS LIFECYCLE ANOMALIES')
  console.table(anomalies.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    status: row.status,
    mrr: Number(row.mrr),
    created_at: row.createdAt,
    canceled_at: row.canceledAt,
    anomaly: row.anomaly,
  })))
  console.log(`Anomaly count: ${anomalies.length}`)
} finally {
  await pool.end()
}
