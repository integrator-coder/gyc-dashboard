export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { pool, tableExists } from '@/lib/pg'

function emptyResponse(reason) {
  return {
    monthly: [],
    warning: reason,
    source: null,
    syncedAt: null,
  }
}

function normalizeHistoricalRow(row) {
  return {
    month: row.month,
    organicSearch: Number(row.organicSearch || 0),
    paidSearch: Number(row.paidSearch || 0),
    directSessions: Number(row.directSessions || 0),
    organicSocial: Number(row.organicSocial || 0),
    paidSocial: Number(row.paidSocial || 0),
    referral: Number(row.referral || 0),
    other: Number(row.other || 0),
    total: Number(row.total || 0),
    clientCount: Number(row.clientCount || 0),
    aiTotal: Number(row.aiTotal || 0),
    aiChatgpt: Number(row.aiChatgpt || 0),
    aiGemini: Number(row.aiGemini || 0),
    aiPerplexity: Number(row.aiPerplexity || 0),
    aiCopilot: Number(row.aiCopilot || 0),
    aiOther: Number(row.aiOther || 0),
    aiPct: Number(row.aiPct || 0),
  }
}

function buildSnapshotFromCurrentMetrics(rows) {
  const latestSync = rows.reduce((latest, row) => {
    const syncedAt = row.syncedAt ? new Date(row.syncedAt) : null
    return syncedAt && (!latest || syncedAt > latest) ? syncedAt : latest
  }, null)

  const month = latestSync
    ? `${latestSync.getUTCFullYear()}-${String(latestSync.getUTCMonth() + 1).padStart(2, '0')}`
    : new Date().toISOString().slice(0, 7)

  const totals = rows.reduce((acc, row) => {
    const organicSearch = Number(row.organicSearch || 0)
    const paidSearch = Number(row.paidSearch || 0)
    const directSessions = Number(row.directSessions || 0)
    const organicSocial = Number(row.organicSocial || 0)
    const paidSocial = Number(row.paidSocial || 0)
    const referral = Number(row.referral || 0)
    const total = Number(row.sessions || (organicSearch + paidSearch + directSessions + organicSocial + paidSocial + referral))

    return {
      organicSearch: acc.organicSearch + organicSearch,
      paidSearch: acc.paidSearch + paidSearch,
      directSessions: acc.directSessions + directSessions,
      organicSocial: acc.organicSocial + organicSocial,
      paidSocial: acc.paidSocial + paidSocial,
      referral: acc.referral + referral,
      other: acc.other + Math.max(total - organicSearch - paidSearch - directSessions - organicSocial - paidSocial - referral, 0),
      total: acc.total + total,
      clientCount: acc.clientCount + 1,
    }
  }, {
    organicSearch: 0,
    paidSearch: 0,
    directSessions: 0,
    organicSocial: 0,
    paidSocial: 0,
    referral: 0,
    other: 0,
    total: 0,
    clientCount: 0,
  })

  return {
    monthly: [{
      month,
      ...totals,
      aiTotal: 0,
      aiChatgpt: 0,
      aiGemini: 0,
      aiPerplexity: 0,
      aiCopilot: 0,
      aiOther: 0,
      aiPct: 0,
    }],
    warning: 'Historical monthly GA table is missing; returning a single portfolio snapshot aggregated from current ClientGAMetrics 30d data.',
    source: 'ClientGAMetrics',
    syncedAt: latestSync?.toISOString() || null,
  }
}

export async function GET() {
  try {
    // PRIMARY: ClientWebsiteTrafficMonthly — populated by backfill-ga-monthly.mjs
    if (await tableExists('"ClientWebsiteTrafficMonthly"')) {
      const { rows: checkRows } = await pool.query(`SELECT COUNT(*) FROM "ClientWebsiteTrafficMonthly" WHERE "organicSearch" IS NOT NULL AND "organicSearch" > 0`)
      if (Number(checkRows[0].count) > 0) {
        const { rows } = await pool.query(`
          SELECT
            "periodMonth" AS month,
            SUM(COALESCE("organicSearch",0))::int AS "organicSearch",
            SUM(COALESCE("paidSearch",0))::int AS "paidSearch",
            SUM(COALESCE("directSessions",0))::int AS "directSessions",
            SUM(COALESCE("organicSocial",0))::int AS "organicSocial",
            SUM(COALESCE("paidSocial",0))::int AS "paidSocial",
            SUM(COALESCE(referral,0))::int AS referral,
            0::int AS other,
            SUM(COALESCE(sessions,0))::int AS total,
            COUNT(DISTINCT "clientAcronym")::int AS "clientCount",
            SUM(COALESCE("aiTotal",0))::int AS "aiTotal",
            SUM(COALESCE("aiChatgpt",0))::int AS "aiChatgpt",
            SUM(COALESCE("aiGemini",0))::int AS "aiGemini",
            SUM(COALESCE("aiPerplexity",0))::int AS "aiPerplexity",
            0::int AS "aiCopilot",
            SUM(COALESCE("aiOther",0))::int AS "aiOther",
            MAX("checkedAt") AS "syncedAt"
          FROM "ClientWebsiteTrafficMonthly"
          WHERE "tenantId" = 'gyc'
          GROUP BY "periodMonth"
          ORDER BY "periodMonth" ASC
        `)
        if (rows.length >= 2) {
          return NextResponse.json({
            monthly: rows.map(r => ({
              ...normalizeHistoricalRow(r),
              aiPct: r.total > 0 ? Math.round((Number(r.aiTotal) / Number(r.total)) * 10000) / 100 : 0,
            })),
            source: 'ClientWebsiteTrafficMonthly',
            syncedAt: rows[rows.length - 1].syncedAt?.toISOString?.() || null,
          })
        }
      }
    }

    if (await tableExists('"GAPortfolioMonthly"')) {
      const { rows } = await pool.query(`
        SELECT month, "organicSearch", "paidSearch", "directSessions", "organicSocial",
               "paidSocial", referral, other, total, "clientCount", "syncedAt",
               COALESCE("aiTotal", 0) AS "aiTotal",
               COALESCE("aiChatgpt", 0) AS "aiChatgpt",
               COALESCE("aiGemini", 0) AS "aiGemini",
               COALESCE("aiPerplexity", 0) AS "aiPerplexity",
               COALESCE("aiCopilot", 0) AS "aiCopilot",
               COALESCE("aiOther", 0) AS "aiOther",
               CASE
                 WHEN COALESCE(total, 0) > 0 THEN ROUND((COALESCE("aiTotal", 0)::numeric / total::numeric) * 100, 4)
                 ELSE 0
               END AS "aiPct"
        FROM "GAPortfolioMonthly"
        ORDER BY month ASC
      `)

      if (rows.length > 0) {
        return NextResponse.json({
          monthly: rows.map(normalizeHistoricalRow),
          source: 'GAPortfolioMonthly',
          syncedAt: rows[rows.length - 1].syncedAt?.toISOString?.() || rows[rows.length - 1].syncedAt || null,
        })
      }
    }

    if (await tableExists('"ClientGAMetrics"')) {
      const { rows } = await pool.query(`
        SELECT acronym, sessions, "organicSearch", "paidSearch", "directSessions",
               "organicSocial", "paidSocial", referral, "syncedAt"
        FROM "ClientGAMetrics"
        WHERE period = '30d'
      `)

      if (rows.length > 0) {
        return NextResponse.json(buildSnapshotFromCurrentMetrics(rows))
      }

      return NextResponse.json({
        monthly: [],
        warning: 'No GA data found in ClientGAMetrics yet.',
        source: 'ClientGAMetrics',
        syncedAt: null,
      })
    }

    return NextResponse.json(emptyResponse('Neither GAPortfolioMonthly nor ClientGAMetrics exists in Neon yet.'))
  } catch (error) {
    const message = error?.message || 'Unknown GA historical route error'
    console.error('[ga-historical] ERROR:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
