/**
 * scripts/compute-mrr-history.mjs
 *
 * Computes MRR per month from StripeSubscriptionHistory and populates MRRHistory.
 * For each calendar month:
 *   - Active MRR = sum of amounts where startDate <= month end AND (canceledAt IS NULL OR canceledAt > month end)
 *   - Only counts monthly-interval subscriptions (yearly amounts are normalized to monthly)
 */
import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(__dirname, '../.env.local')
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
}

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

async function main() {
  const client = await pool.connect()
  try {
    console.log('🔧 Computing MRR history from StripeSubscriptionHistory...')

    // Check how many rows we have
    const { rows: countRows } = await client.query(`SELECT COUNT(*) FROM "StripeSubscriptionHistory" WHERE "tenantId" = 'gyc'`)
    console.log(`📊 Total subscription rows: ${countRows[0].count}`)

    // Compute MRR for each month using a CTE approach
    const { rows: mrrRows } = await client.query(`
      WITH months AS (
        SELECT to_char(generate_series, 'YYYY-MM') AS month,
               date_trunc('month', generate_series) AS month_start,
               (date_trunc('month', generate_series) + INTERVAL '1 month - 1 second') AS month_end
        FROM generate_series(
          (SELECT MIN("startDate") FROM "StripeSubscriptionHistory" WHERE "tenantId" = 'gyc'),
          NOW(),
          INTERVAL '1 month'
        )
      ),
      monthly_mrr AS (
        SELECT
          m.month,
          m.month_start,
          m.month_end,
          COUNT(s."id") AS active_subscriptions,
          ROUND(SUM(
            CASE 
              WHEN s."interval" = 'year' THEN s."amount" / 12.0
              ELSE s."amount"
            END
          )::numeric, 2) AS mrr
        FROM months m
        LEFT JOIN "StripeSubscriptionHistory" s ON
          s."tenantId" = 'gyc'
          AND s."startDate" <= m.month_end
          AND (s."canceledAt" IS NULL OR s."canceledAt" > m.month_end)
          AND s."status" != 'incomplete'
          AND s."amount" > 0
          AND s."interval" IN ('month', 'year')
        GROUP BY m.month, m.month_start, m.month_end
      )
      SELECT month, active_subscriptions::int, mrr
      FROM monthly_mrr
      ORDER BY month
    `)

    console.log(`📅 Computed MRR for ${mrrRows.length} months`)

    // Compute new MRR and churned MRR by comparing adjacent months
    let upserted = 0
    for (let i = 0; i < mrrRows.length; i++) {
      const curr = mrrRows[i]
      const prev = i > 0 ? mrrRows[i - 1] : null

      const currMrr = parseFloat(curr.mrr) || 0
      const prevMrr = prev ? (parseFloat(prev.mrr) || 0) : 0
      
      // Compute new vs churned from subscription starts/cancels in this month
      const { rows: newCanceled } = await client.query(`
        SELECT
          ROUND(SUM(CASE WHEN to_char("startDate", 'YYYY-MM') = $1 THEN
            CASE WHEN "interval" = 'year' THEN "amount" / 12.0 ELSE "amount" END
          ELSE 0 END)::numeric, 2) AS new_mrr,
          ROUND(SUM(CASE WHEN "canceledAt" IS NOT NULL AND to_char("canceledAt", 'YYYY-MM') = $1 THEN
            CASE WHEN "interval" = 'year' THEN "amount" / 12.0 ELSE "amount" END
          ELSE 0 END)::numeric, 2) AS churned_mrr
        FROM "StripeSubscriptionHistory"
        WHERE "tenantId" = 'gyc'
        AND "amount" > 0
        AND "interval" IN ('month', 'year')
      `, [curr.month])

      const newMrr = parseFloat(newCanceled[0].new_mrr) || 0
      const churnedMrr = parseFloat(newCanceled[0].churned_mrr) || 0

      await client.query(`
        INSERT INTO "MRRHistory" ("tenantId", "month", "mrr", "newMrr", "churnedMrr", "expansionMrr", "activeSubscriptions", "syncedAt")
        VALUES ('gyc', $1, $2, $3, $4, 0, $5, NOW())
        ON CONFLICT ("tenantId", "month") DO UPDATE SET
          "mrr" = EXCLUDED."mrr",
          "newMrr" = EXCLUDED."newMrr",
          "churnedMrr" = EXCLUDED."churnedMrr",
          "activeSubscriptions" = EXCLUDED."activeSubscriptions",
          "syncedAt" = NOW()
      `, [curr.month, currMrr, newMrr, churnedMrr, curr.active_subscriptions])
      upserted++
    }

    console.log(`✅ Upserted ${upserted} MRR history rows`)

    // Show summary
    const { rows: summary } = await client.query(`
      SELECT month, mrr, "newMrr", "churnedMrr", "activeSubscriptions"
      FROM "MRRHistory"
      WHERE "tenantId" = 'gyc'
      ORDER BY month DESC
      LIMIT 12
    `)

    console.log('\n📊 Recent MRR History (last 12 months):')
    console.log('  Month    | MRR        | New MRR    | Churned MRR | Active Subs')
    console.log('  ---------|------------|------------|-------------|------------')
    for (const r of summary) {
      const mrr = `$${Number(r.mrr).toLocaleString('en-US', { maximumFractionDigits: 0 })}`.padEnd(10)
      const newM = `$${Number(r.newMrr).toLocaleString('en-US', { maximumFractionDigits: 0 })}`.padEnd(10)
      const churn = `$${Number(r.churnedMrr).toLocaleString('en-US', { maximumFractionDigits: 0 })}`.padEnd(11)
      console.log(`  ${r.month}  | ${mrr} | ${newM} | ${churn} | ${r.activeSubscriptions}`)
    }
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
