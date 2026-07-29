#!/usr/bin/env node

/**
 * Installs the confirmed Monthly → PIF ledger and corrects July 2026.
 *
 * Classification policy:
 * - Match by Stripe customer ID and canceled subscription ID.
 * - Only status=confirmed entries are excluded from churn.
 * - Same-day/name/amount proximity alone is never enough to auto-classify.
 * - Clients lost is unique confirmed-lost Stripe customers, not cancellations.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local'), override: true })
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const confirmed = [
  {
    stripeCustomerId: 'cus_UB3ROh2YunLXPH',
    canceledSubscriptionId: 'sub_1TCl5gEbMXEo3zxqEp6oAnbQ',
    clientName: 'Primrose School of Burlington',
    movementDate: '2026-07-02',
    mrrMoved: 899,
    sourceProgram: 'SEO',
    sourceProductId: 'prod_TsRVRZv1LSLAQM',
    sourcePriceId: 'price_1TCl5gEbMXEo3zxqb8Y8e1jb',
    pifCashReceived: 10491,
    termMonths: 6,
    scheduledReturnDate: '2027-01-02',
    evidence: 'Verified Stripe transition: SEO $899/month canceled and Reputation Engine Core invoice in_1TomkdEbMXEo3zxq92KrNsmC paid $10,491 every 6 months on 2026-07-02. The PIF price is the six-month destination contract price, not $899 × 6.',
  },
  {
    stripeCustomerId: 'cus_JXbLLnL0MR22mz',
    canceledSubscriptionId: 'sub_1T5fdoEbMXEo3zxqDhpTV3at',
    clientName: 'Palm Beach Preschool',
    movementDate: '2026-07-16',
    // This subscription contained multiple programs. Its current $317 item is
    // Website Maintenance and remains active; it is not the PIF source.
    mrrMoved: 395,
    sourceProgram: 'Paid Media I Autorenewal (Google Ads)',
    sourceProductId: 'prod_TxyohTOEM5esIS',
    sourcePriceId: 'price_1T0RgwEbMXEo3zxqBuchIfpg',
    // No Stripe payment or PandaDoc PIF field substantiates the old $19,999.
    // Keep cash out of leadership reporting until the payment is verified.
    pifCashReceived: null,
    termMonths: 6,
    scheduledReturnDate: '2027-01-16',
    evidence: 'Confirmed Google Ads → six-month PIF conversion. Stripe invoice in_1TnAq2EbMXEo3zxqilvElRGw identifies Paid Media at $395/month; the retained subscription item is Website Maintenance at $317/month. PIF cash remains unverified.',
  },
]

async function main() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`
      CREATE TABLE IF NOT EXISTS "ChurnLateralMovement" (
        "id" BIGSERIAL PRIMARY KEY,
        "tenantId" TEXT NOT NULL DEFAULT 'gyc',
        "stripeCustomerId" TEXT NOT NULL,
        "canceledSubscriptionId" TEXT NOT NULL,
        "clientName" TEXT NOT NULL,
        "movementDate" DATE NOT NULL,
        "mrrMoved" NUMERIC(12,2) NOT NULL,
        "pifCashReceived" NUMERIC(12,2),
        "sourceProgram" TEXT,
        "sourceProductId" TEXT,
        "sourcePriceId" TEXT,
        "termMonths" INT NOT NULL,
        "scheduledReturnDate" DATE NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'confirmed',
        "evidence" TEXT,
        "confirmedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE ("tenantId", "canceledSubscriptionId")
      )
    `)

    for (const row of confirmed) {
      await client.query(`
        INSERT INTO "ChurnLateralMovement"
          ("tenantId", "stripeCustomerId", "canceledSubscriptionId", "clientName",
           "movementDate", "mrrMoved", "sourceProgram", "sourceProductId", "sourcePriceId", "pifCashReceived", "termMonths",
           "scheduledReturnDate", status, evidence)
        VALUES ('gyc', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'confirmed', $12)
        ON CONFLICT ("tenantId", "canceledSubscriptionId") DO UPDATE SET
          "stripeCustomerId" = EXCLUDED."stripeCustomerId",
          "clientName" = EXCLUDED."clientName",
          "movementDate" = EXCLUDED."movementDate",
          "mrrMoved" = EXCLUDED."mrrMoved",
          "sourceProgram" = EXCLUDED."sourceProgram",
          "sourceProductId" = EXCLUDED."sourceProductId",
          "sourcePriceId" = EXCLUDED."sourcePriceId",
          "pifCashReceived" = EXCLUDED."pifCashReceived",
          "termMonths" = EXCLUDED."termMonths",
          "scheduledReturnDate" = EXCLUDED."scheduledReturnDate",
          status = 'confirmed', evidence = EXCLUDED.evidence, "updatedAt" = NOW()
      `, [
        row.stripeCustomerId, row.canceledSubscriptionId, row.clientName,
        row.movementDate, row.mrrMoved, row.sourceProgram, row.sourceProductId,
        row.sourcePriceId, row.pifCashReceived, row.termMonths,
        row.scheduledReturnDate, row.evidence,
      ])
    }

    // July source facts: 13 canceled subscriptions, 12 unique customers.
    // Legacy aggregate repair: the old cancellation snapshot itself contained
    // $899 + $317. Leadership PIF reporting uses the item-level ledger ($1,294),
    // but this subtraction must remove only what the legacy aggregate included.
    const previous = await client.query(`
      SELECT "totalMRR", "clientCount", "newMRR", "churnedMRR", "monthlyMRR", nrr, "monthlyNRR"
      FROM "MonthlyChurnMetrics" WHERE "tenantId"='gyc' AND month='2026-07'
      FOR UPDATE
    `)
    if (previous.rowCount !== 1) throw new Error('July 2026 MonthlyChurnMetrics row not found')

    const r = previous.rows[0]
    const trueLostCustomers = 10
    const trueChurnedMrr = Number(r.churnedMRR) - 1216
    const prevClients = 246
    const prevMrr = 187980.93
    const prevMonthlyMrr = 185718.27
    const churnPct = Math.round((trueLostCustomers / prevClients) * 1000) / 10
    const revenueChurnPct = Math.round((trueChurnedMrr / prevMrr) * 1000) / 10
    const grr = Math.round(((prevMrr - trueChurnedMrr) / prevMrr) * 1000) / 10
    // Preserve the existing cohort calculation and add only the confirmed
    // deferred lateral value to its numerator.
    const nrr = Math.round((Number(r.nrr) + (1216 / prevMrr * 100)) * 10) / 10
    const monthlyNrr = Math.round((Number(r.monthlyNRR) + (1216 / prevMonthlyMrr * 100)) * 10) / 10

    await client.query(`
      UPDATE "MonthlyChurnMetrics" SET
        "clientsLost"=$1, "churnedMRR"=$2, "netMRR"="newMRR"-$2,
        "churnPct"=$3, "revenueChurnPct"=$4, nrr=$5, grr=$6,
        "monthlyChurnedMRR"=$2, "monthlyNRR"=$7, "syncedAt"=NOW()
      WHERE "tenantId"='gyc' AND month='2026-07'
    `, [trueLostCustomers, trueChurnedMrr, churnPct, revenueChurnPct, nrr, grr, monthlyNrr])

    await client.query(`
      UPDATE "MRRHistory" SET "churnedMrr"=$1, "syncedAt"=NOW()
      WHERE "tenantId"='gyc' AND month='2026-07'
    `, [trueChurnedMrr])
    await client.query('COMMIT')
    console.log(JSON.stringify({ trueLostCustomers, trueChurnedMrr, churnPct, revenueChurnPct, nrr, grr, monthlyNrr }))
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(error => {
  console.error(error.message)
  process.exit(1)
})
