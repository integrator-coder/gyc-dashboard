import { NextResponse } from 'next/server'
import pkg from 'pg'

export const dynamic = 'force-dynamic'

const { Pool } = pkg
const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false } })

export async function GET() {
  const client = await pool.connect()

  try {
    // ── Billing risk: past_due or high-MRR clients ─────────────────────────
    const { rows: billingRisk } = await client.query(`
      SELECT name, email, mrr, status, "createdAt"
      FROM "StripeCustomer"
      WHERE status = 'past_due'
        AND mrr > 0
      ORDER BY mrr DESC
      LIMIT 20
    `)

    // ── Zendesk escalations: orgs with 10+ open tickets ────────────────────
    const { rows: ticketEscalations } = await client.query(`
      SELECT zt."orgName", zt."orgId", zt."openCount",
             regexp_replace(zt."orgName", '^([A-Z0-9/-]+) - .*', '\\1') AS acronym
      FROM "ZendeskOrgTicket" zt
      JOIN (SELECT max(id) AS snapshot_id FROM "ZendeskSnapshot") l ON l.snapshot_id = zt."snapshotId"
      WHERE zt."openCount" >= 10
      ORDER BY zt."openCount" DESC
      LIMIT 20
    `)

    // ── Dead funnels: clients with lead flow data but 0 leads recent months ─
    const { rows: deadFunnels } = await client.query(`
      WITH recent AS (
        SELECT c.acronym, c.name,
               SUM(cfm.leads) AS leads_last_60d,
               MAX(cfm.month) AS latest_month
        FROM "ClientFunnelMonth" cfm
        JOIN "Client" c ON c.id = cfm."clientId"
        WHERE cfm.month >= TO_CHAR(CURRENT_DATE - INTERVAL '60 days', 'YYYY-MM')
        GROUP BY c.acronym, c.name
      ),
      has_history AS (
        SELECT c.acronym
        FROM "ClientFunnelMonth" cfm
        JOIN "Client" c ON c.id = cfm."clientId"
        WHERE cfm.leads > 0
        GROUP BY c.acronym
        HAVING MAX(cfm.month) <= TO_CHAR(CURRENT_DATE - INTERVAL '90 days', 'YYYY-MM')
      )
      SELECT r.acronym, r.name, r.leads_last_60d, r.latest_month
      FROM recent r
      WHERE r.leads_last_60d = 0
        AND EXISTS (SELECT 1 FROM has_history h WHERE h.acronym = r.acronym)
      ORDER BY r.latest_month ASC
      LIMIT 20
    `)

    // ── MRR concentration: top 10 clients by MRR and their % of total ──────
    const { rows: mrrConcentration } = await client.query(`
      WITH total AS (SELECT SUM(mrr) AS t FROM "StripeCustomer" WHERE status = 'active' AND mrr > 0)
      SELECT name, email, mrr,
             ROUND((mrr / total.t * 100)::numeric, 1) AS pct_of_mrr,
             "createdAt"
      FROM "StripeCustomer", total
      WHERE status = 'active' AND mrr > 0
      ORDER BY mrr DESC
      LIMIT 10
    `)

    // ── Total portfolio health overview ─────────────────────────────────────
    const { rows: overview } = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'active') AS active,
        COUNT(*) FILTER (WHERE status = 'past_due') AS past_due,
        COUNT(*) FILTER (WHERE status = 'canceled') AS canceled,
        ROUND(SUM(mrr) FILTER (WHERE status = 'active')::numeric, 0) AS total_mrr,
        ROUND(AVG(mrr) FILTER (WHERE status = 'active' AND mrr > 0)::numeric, 0) AS avg_mrr,
        COUNT(*) FILTER (WHERE status = 'active' AND mrr > 2000) AS high_value_count,
        COUNT(*) FILTER (WHERE status = 'active' AND mrr < 200 AND mrr > 0) AS low_value_count
      FROM "StripeCustomer"
    `)

    // ── Funnel performance: worst conversion clients ─────────────────────────
    const { rows: poorConversion } = await client.query(`
      SELECT
        c.acronym,
        c.name,
        SUM(cfm.leads)::int AS total_leads,
        SUM(cfm.registered)::int AS total_registrations,
        ROUND(
          CASE WHEN SUM(cfm.leads) > 0 THEN SUM(cfm.registered)::numeric / SUM(cfm.leads) * 100 ELSE 0 END,
          1
        ) AS conversion_pct,
        MAX(cfm.month) AS latest_month
      FROM "ClientFunnelMonth" cfm
      JOIN "Client" c ON c.id = cfm."clientId"
      WHERE cfm.month >= TO_CHAR(CURRENT_DATE - INTERVAL '90 days', 'YYYY-MM')
        AND cfm.leads > 0
      GROUP BY c.acronym, c.name
      HAVING SUM(cfm.leads) >= 5
      ORDER BY conversion_pct ASC
      LIMIT 10
    `)

    // ── Zendesk volume trends: orgs with rising ticket counts ───────────────
    const { rows: zdTopOrgs } = await client.query(`
      SELECT "orgName", "orgId", "openCount",
             regexp_replace("orgName", '^([A-Z0-9/-]+) - .*', '\\1') AS acronym
      FROM "ZendeskOrgTicket" zt
      JOIN (SELECT max(id) AS snapshot_id FROM "ZendeskSnapshot") l ON l.snapshot_id = zt."snapshotId"
      WHERE "openCount" > 0
      ORDER BY "openCount" DESC
      LIMIT 15
    `)

    return NextResponse.json({
      overview: overview[0] || {},
      billingRisk,
      ticketEscalations,
      deadFunnels,
      mrrConcentration,
      poorConversion,
      zdTopOrgs,
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  } finally {
    client.release()
  }
}
