import { userHasRole } from '@/lib/auth'
import { pool } from '@/lib/pg'
import { getRepAliases } from '@/lib/team'

function normalizeAcronym(value) {
  return String(value || '').trim().toUpperCase()
}

function getRoleScope(user) {
  const isAdmin = userHasRole(user, ['admin'])
  const isCx = userHasRole(user, ['cx'])
  const unrestricted = isAdmin || isCx
  const aliases = getRepAliases(user)
  const aliasPatterns = aliases.map((alias) => `%${String(alias).toLowerCase()}%`)
  const email = String(user?.email || '').toLowerCase()

  return {
    unrestricted,
    aliases,
    aliasPatterns,
    email,
  }
}

function appendCallAccessFilter({ baseSql, params, scope, tableAlias = 'zc', needsWhere = true }) {
  if (scope.unrestricted) {
    return { sql: baseSql, params }
  }

  const aliasParam = params.push(scope.aliasPatterns)
  const emailParam = params.push(scope.email)
  const prefix = needsWhere ? 'WHERE' : 'AND'

  return {
    sql: `${baseSql}\n${prefix} (\n  EXISTS (\n    SELECT 1\n    FROM unnest($${aliasParam}::text[]) AS pattern\n    WHERE lower(COALESCE(${tableAlias}."repName", '')) LIKE pattern\n       OR lower(COALESCE(${tableAlias}."hostName", '')) LIKE pattern\n  )\n  OR lower(COALESCE(${tableAlias}."hostEmail", '')) = $${emailParam}\n)`,
    params,
  }
}

async function assertClientAccess(user, acronym) {
  const normalized = normalizeAcronym(acronym)
  const scope = getRoleScope(user)
  if (scope.unrestricted) return normalized

  const params = [normalized]
  const scoped = appendCallAccessFilter({
    baseSql: `
      SELECT 1
      FROM "ZoomCall" zc
      WHERE upper(COALESCE(zc.acronym, '')) = $1
    `,
    params,
    scope,
    tableAlias: 'zc',
    needsWhere: false,
  })

  const result = await pool.query(`${scoped.sql}\nLIMIT 1`, scoped.params)
  if (!result.rows[0]) {
    const error = new Error('Client not found.')
    error.status = 404
    throw error
  }

  return normalized
}

export async function listClientsForUser(user) {
  const scope = getRoleScope(user)
  const zoomParams = []
  const zoomScoped = appendCallAccessFilter({
    baseSql: `
      SELECT
        upper(zc.acronym) AS acronym,
        COALESCE(
          NULLIF(max(zc."clientName") FILTER (WHERE zc."clientName" IS NOT NULL), ''),
          upper(zc.acronym)
        ) AS name,
        COALESCE(
          NULLIF(max(zc."repName") FILTER (WHERE zc."repName" IS NOT NULL), ''),
          NULLIF(max(zc."hostName") FILTER (WHERE zc."hostName" IS NOT NULL), '')
        ) AS "repName",
        max(COALESCE(zc."callDate", zc."startedAt", zc."createdAt")) AS "lastCallDate",
        count(*)::int AS "callCount"
      FROM "ZoomCall" zc
      WHERE zc.acronym IS NOT NULL
        AND trim(zc.acronym) <> ''
    `,
    params: zoomParams,
    scope,
    tableAlias: 'zc',
    needsWhere: false,
  })

  const zoomResult = await pool.query(
    `${zoomScoped.sql}
      GROUP BY upper(zc.acronym)
      ORDER BY upper(zc.acronym) ASC
    `,
    zoomScoped.params
  )

  const clientMap = new Map(
    zoomResult.rows.map((row) => [normalizeAcronym(row.acronym), {
      id: normalizeAcronym(row.acronym),
      acronym: normalizeAcronym(row.acronym),
      name: row.name || normalizeAcronym(row.acronym),
      repName: row.repName || null,
      lastCallDate: row.lastCallDate || null,
      callCount: Number(row.callCount || 0),
    }])
  )

  const funnelResult = await pool.query(`
    SELECT DISTINCT upper(c.acronym) AS acronym, c.name
    FROM "ClientFunnelMonth" cfm
    JOIN "Client" c ON c.id = cfm."clientId"
    WHERE c.acronym IS NOT NULL
      AND trim(c.acronym) <> ''
    ORDER BY upper(c.acronym) ASC
  `)

  for (const row of funnelResult.rows) {
    const acronym = normalizeAcronym(row.acronym)
    if (!acronym || clientMap.has(acronym)) continue
    clientMap.set(acronym, {
      id: acronym,
      acronym,
      name: row.name || acronym,
      repName: null,
      lastCallDate: null,
      callCount: 0,
    })
  }

  return Array.from(clientMap.values()).sort((a, b) => {
    const aTs = a.lastCallDate ? new Date(a.lastCallDate).getTime() : 0
    const bTs = b.lastCallDate ? new Date(b.lastCallDate).getTime() : 0
    if (bTs !== aTs) return bTs - aTs
    return a.name.localeCompare(b.name)
  })
}

export async function getClientIntelForUser(user, acronym) {
  const normalized = await assertClientAccess(user, acronym)

  const clientInfoResult = await pool.query(
    `
      SELECT
        upper(zc.acronym) AS acronym,
        COALESCE(NULLIF(zc."clientName", ''), upper(zc.acronym)) AS name,
        COALESCE(NULLIF(zc."repName", ''), NULLIF(zc."hostName", '')) AS "repName",
        zc."ghlContactId",
        zc."ghlContactName"
      FROM "ZoomCall" zc
      WHERE upper(COALESCE(zc.acronym, '')) = $1
      ORDER BY COALESCE(zc."callDate", zc."startedAt", zc."createdAt") DESC NULLS LAST
      LIMIT 1
    `,
    [normalized]
  )

  const clientInfo = clientInfoResult.rows[0] || { acronym: normalized, name: normalized, repName: null, ghlContactId: null, ghlContactName: null }
  const ghlContactId = clientInfo.ghlContactId || null

  const salesParams = [normalized]
  let salesWhere = `upper(COALESCE(zc.acronym, '')) = $1`
  if (ghlContactId) {
    const ghlParam = salesParams.push(ghlContactId)
    salesWhere = `(${salesWhere} OR zc."ghlContactId" = $${ghlParam})`
  }

  const [salesCallsResult, promiseLedgerResult, onboardingCallsResult, gaCallsResult, leadFlowResult, transcriptCountResult, assignedGaResult] = await Promise.all([
    pool.query(
      `
        SELECT
          zc.id,
          zc."meetingTopic",
          zc."callDate",
          zc."startedAt",
          zc."durationSecs",
          zc."callLink",
          zc."repName",
          zc."hostName",
          zc."hostEmail",
          zc."clientName",
          zc.acronym,
          zc."ghlContactId",
          zc."ghlContactName",
          zc.purposes
        FROM "ZoomCall" zc
        WHERE zc.purposes @> ARRAY['sales-review']::text[]
          AND ${salesWhere}
        ORDER BY COALESCE(zc."callDate", zc."startedAt", zc."createdAt") DESC NULLS LAST
      `,
      salesParams
    ),
    pool.query(
      `
        SELECT
          pli.id,
          pli."promiseText",
          pli.category,
          pli.owner,
          pli.confidence,
          pli."riskFlag",
          pli."reviewStatus",
          pli."reviewComment",
          pli."evidenceSource",
          pli."evidenceLink",
          pli."createdAt",
          h.id AS "handoffId",
          h."clientName",
          h."repName",
          h."closedAt"
        FROM "PromiseLedgerItem" pli
        JOIN "CXHandoff" h ON h.id = pli."handoffId"
        WHERE upper(COALESCE(h."clientId", '')) = $1
           OR upper(COALESCE(h."clientName", '')) = $1
        ORDER BY h."closedAt" DESC NULLS LAST, pli.id ASC
      `,
      [normalized]
    ),
    pool.query(
      `
        SELECT
          zc.id,
          zc."meetingTopic",
          zc."callDate",
          zc."startedAt",
          zc."durationSecs",
          zc."callLink",
          zc."repName",
          zc."hostName",
          zc."hostEmail",
          zc.purposes
        FROM "ZoomCall" zc
        WHERE 'vision-call' = ANY(zc.purposes)
          AND upper(COALESCE(zc.acronym, '')) = $1
        ORDER BY COALESCE(zc."callDate", zc."startedAt", zc."createdAt") DESC NULLS LAST
      `,
      [normalized]
    ),
    pool.query(
      `
        SELECT
          zc.id,
          zc."meetingTopic",
          zc."callDate",
          zc."startedAt",
          zc."durationSecs",
          zc."callLink",
          zc."repName",
          zc."hostName",
          zc."hostEmail",
          zc.purposes
        FROM "ZoomCall" zc
        WHERE 'ga-review' = ANY(zc.purposes)
          AND upper(COALESCE(zc.acronym, '')) = $1
        ORDER BY COALESCE(zc."callDate", zc."startedAt", zc."createdAt") DESC NULLS LAST
      `,
      [normalized]
    ),
    pool.query(
      `
        SELECT
          cfm.id,
          cfm.month,
          cfm.leads,
          cfm.tours,
          cfm.registered,
          cfm.revenue,
          cfm."leadToTour",
          cfm."tourToReg",
          cfm."leadToReg",
          cfm."locationName",
          c."name" AS "clientName",
          c.acronym
        FROM "ClientFunnelMonth" cfm
        JOIN "Client" c ON c.id = cfm."clientId"
        WHERE upper(COALESCE(c.acronym, '')) = $1
        ORDER BY cfm.month DESC
        LIMIT 12
      `,
      [normalized]
    ),
    pool.query(
      `
        SELECT count(*)::int AS count
        FROM "ZoomTranscriptSegment" seg
        JOIN "ZoomTranscript" zt ON zt.id = seg."transcriptId"
        JOIN "ZoomCall" zc ON zc.id = zt."zoomCallId"
        WHERE upper(COALESCE(zc.acronym, '')) = $1
      `,
      [normalized]
    ),
    pool.query(
      `
        SELECT
          COALESCE(NULLIF(zc."repName", ''), NULLIF(zc."hostName", '')) AS value,
          count(*)::int AS count
        FROM "ZoomCall" zc
        WHERE upper(COALESCE(zc.acronym, '')) = $1
          AND ('ga-review' = ANY(zc.purposes) OR 'vision-call' = ANY(zc.purposes))
          AND COALESCE(NULLIF(zc."repName", ''), NULLIF(zc."hostName", '')) IS NOT NULL
        GROUP BY 1
        ORDER BY count(*) DESC, value ASC
        LIMIT 1
      `,
      [normalized]
    ),
  ])

  return {
    clientInfo: {
      name: clientInfo.name || normalized,
      acronym: clientInfo.acronym || normalized,
      repName: clientInfo.repName || null,
      ghlContactId: clientInfo.ghlContactId || null,
      ghlContactName: clientInfo.ghlContactName || null,
    },
    assignedGA: assignedGaResult.rows[0]?.value || null,
    salesCalls: salesCallsResult.rows,
    promiseLedger: promiseLedgerResult.rows,
    onboardingCalls: onboardingCallsResult.rows,
    gaCalls: gaCallsResult.rows,
    leadFlow: leadFlowResult.rows,
    transcriptCount: transcriptCountResult.rows[0]?.count || 0,
  }
}

export async function searchClientTranscriptForUser(user, acronym, query) {
  const normalized = await assertClientAccess(user, acronym)
  const q = String(query || '').trim()
  if (!q) return []

  const result = await pool.query(
    `
      SELECT
        seg.id,
        seg.speaker,
        seg."startMs",
        seg.text,
        zc."callDate",
        zc."repName",
        zc."callLink",
        zc."meetingTopic"
      FROM "ZoomTranscriptSegment" seg
      JOIN "ZoomTranscript" zt ON zt.id = seg."transcriptId"
      JOIN "ZoomCall" zc ON zc.id = zt."zoomCallId"
      WHERE upper(COALESCE(zc.acronym, '')) = $1
        AND seg.text ILIKE $2
      ORDER BY COALESCE(zc."callDate", zc."startedAt", zc."createdAt") DESC NULLS LAST, seg."startMs" ASC
      LIMIT 10
    `,
    [normalized, `%${q}%`]
  )

  return result.rows.map((row) => ({
    ...row,
    callLink: row.callLink || null,
  }))
}
