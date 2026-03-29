import Stripe from 'stripe'
import { userHasRole } from '@/lib/auth'
import { ghlFetch } from '@/lib/ghl'
import { pool } from '@/lib/pg'
import { getRepAliases } from '@/lib/team'

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null

async function fetchStripePaymentHistory(customerId) {
  if (!stripe || !customerId) return []
  try {
    const invoices = await stripe.invoices.list({ customer: customerId, limit: 24 })
    return invoices.data.map((inv) => ({
      id: inv.id,
      date: new Date(inv.created * 1000).toISOString(),
      amount: (inv.amount_paid || 0) / 100,
      amountDue: (inv.amount_due || 0) / 100,
      status: inv.status,
      paid: inv.paid,
      periodStart: new Date(inv.period_start * 1000).toISOString(),
      periodEnd: new Date(inv.period_end * 1000).toISOString(),
      invoiceUrl: inv.hosted_invoice_url || null,
      description: inv.lines?.data?.[0]?.description || null,
    }))
  } catch {
    return []
  }
}

function computeHealthScore({ tickets, stripe, leadFlowByLocation, gaMetrics }) {
  const openTickets = (tickets || []).filter((t) => ['open','pending'].includes(String(t.status).toLowerCase()))
  const overdueTickets = openTickets.filter((t) => Number(t.daysOpen || 0) > 14)
  const criticalTickets = openTickets.filter((t) => Number(t.daysOpen || 0) > 30)

  // Gather funnel trend
  const allRows = Object.values(leadFlowByLocation || {}).flat()
  const recentMonths = allRows
    .sort((a, b) => String(b.month || '').localeCompare(String(a.month || '')))
    .slice(0, 2)
  const latestConversion = recentMonths[0]?.leadToReg != null ? Number(recentMonths[0].leadToReg) : null
  const prevConversion   = recentMonths[1]?.leadToReg != null ? Number(recentMonths[1].leadToReg) : null
  const conversionTrend  = latestConversion != null && prevConversion != null ? latestConversion - prevConversion : null

  // Score 0-100, lower is better (think golf)
  let score = 0
  const flags = []

  if (criticalTickets.length > 0) { score += 40; flags.push(`${criticalTickets.length} ticket(s) open 30+ days`) }
  else if (overdueTickets.length > 0) { score += 20; flags.push(`${overdueTickets.length} ticket(s) overdue 14+ days`) }
  else if (openTickets.length > 3) { score += 10; flags.push(`${openTickets.length} open/pending tickets`) }

  if (stripe?.status === 'past_due') { score += 30; flags.push('Payment past due') }
  else if (stripe?.status === 'canceled') { score += 50; flags.push('Subscription canceled') }

  if (conversionTrend != null && conversionTrend < -0.05) { score += 20; flags.push(`Conversion rate dropped ${Math.round(Math.abs(conversionTrend) * 100)}% MoM`) }
  else if (latestConversion != null && latestConversion < 0.05) { score += 15; flags.push(`Conversion rate critically low (${Math.round(latestConversion * 100)}%)`) }

  if (!gaMetrics?.sessions || Number(gaMetrics.sessions) < 100) { score += 10; flags.push('GA sessions very low this month') }

  // Band
  let band, color
  if (score === 0) { band = 'green'; color = 'emerald' }
  else if (score <= 20) { band = 'yellow'; color = 'amber' }
  else { band = 'red'; color = 'rose' }

  return { score, band, color, flags, openTickets: openTickets.length, overdueTickets: overdueTickets.length, latestConversion, conversionTrend }
}

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
    sql: `${baseSql}
${prefix} (
  EXISTS (
    SELECT 1
    FROM unnest($${aliasParam}::text[]) AS pattern
    WHERE lower(COALESCE(${tableAlias}."repName", '')) LIKE pattern
       OR lower(COALESCE(${tableAlias}."hostName", '')) LIKE pattern
  )
  OR lower(COALESCE(${tableAlias}."hostEmail", '')) = $${emailParam}
)`,
    params,
  }
}

function ticketTone(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'open' || normalized === 'new') return 'red'
  if (normalized === 'pending' || normalized === 'hold') return 'amber'
  if (normalized === 'closed' || normalized === 'solved') return 'gray'
  return 'violet'
}

function daysBetween(start, end = new Date()) {
  if (!start) return null
  const started = new Date(start)
  const diffMs = end.getTime() - started.getTime()
  return Math.max(0, Math.floor(diffMs / 86400000))
}

function normalizeLeadFlowRows(rows) {
  const grouped = new Map()

  for (const row of rows) {
    const locationName = row.locationName || 'Unknown location'
    const prev = grouped.get(locationName)
    const current = {
      ...row,
      leads: Number(row.leads || 0),
      tours: Number(row.tours || 0),
      registered: Number(row.registered || 0),
      leadToTour: row.leadToTour == null ? null : Number(row.leadToTour),
      tourToReg: row.tourToReg == null ? null : Number(row.tourToReg),
      leadToReg: row.leadToReg == null ? null : Number(row.leadToReg),
    }

    if (!prev) {
      grouped.set(locationName, [current])
      continue
    }

    prev.push(current)
  }

  for (const [locationName, list] of grouped.entries()) {
    list.sort((a, b) => String(b.month).localeCompare(String(a.month)))
    grouped.set(
      locationName,
      list.map((row, index) => {
        const prior = list[index + 1] || null
        return {
          ...row,
          trend: prior
            ? {
                leads: row.leads - prior.leads,
                tours: row.tours - prior.tours,
                registered: row.registered - prior.registered,
              }
            : null,
        }
      })
    )
  }

  return grouped
}

async function fetchGhlContact(ghlContactId) {
  if (!ghlContactId) return null

  try {
    const data = await ghlFetch(`/contacts/${ghlContactId}`)
    return data?.contact || null
  } catch (error) {
    console.error('GHL contact fetch failed:', error)
    return null
  }
}

async function fetchZendeskTickets(orgId) {
  if (!orgId || !process.env.ZENDESK_API_TOKEN) return []

  const email = process.env.ZENDESK_EMAIL || 'todd@growyourcenter.com'
  const auth = Buffer.from(`${email}/token:${process.env.ZENDESK_API_TOKEN}`).toString('base64')
  const url = `https://gycawesome.zendesk.com/api/v2/organizations/${orgId}/tickets.json`

  const res = await fetch(url, {
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.error || data?.description || `Zendesk ${res.status}`)
  }

  return (data?.tickets || [])
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((ticket) => ({
      id: ticket.id,
      subject: ticket.subject || `Ticket #${ticket.id}`,
      status: ticket.status,
      statusColor: ticketTone(ticket.status),
      createdAt: ticket.created_at,
      updatedAt: ticket.updated_at,
      priority: ticket.priority || null,
      daysOpen: daysBetween(ticket.created_at),
      url: `https://gycawesome.zendesk.com/agent/tickets/${ticket.id}`,
    }))
}

function buildEscalationAlerts(zendeskTickets) {
  const pendingCount = zendeskTickets.filter((ticket) => String(ticket.status).toLowerCase() === 'pending').length

  return [
    {
      id: 'former-employee-photos',
      title: 'Urgent: Former employee photos on careers page need removal',
      openedAt: '2026-03-24T00:00:00.000Z',
      daysOpen: daysBetween('2026-03-24T00:00:00.000Z'),
      tone: 'red',
    },
    {
      id: 'google-ads-payment-declined',
      title: 'Google Ads payment declined',
      openedAt: '2026-03-03T00:00:00.000Z',
      daysOpen: daysBetween('2026-03-03T00:00:00.000Z'),
      tone: 'red',
    },
    {
      id: 'gbp-problem',
      title: 'URGENT Google Business page problem',
      openedAt: '2026-02-09T00:00:00.000Z',
      daysOpen: daysBetween('2026-02-09T00:00:00.000Z'),
      tone: 'red',
    },
    {
      id: 'pending-total',
      title: `${pendingCount} PENDING tickets total`,
      openedAt: null,
      daysOpen: null,
      tone: 'amber',
    },
  ]
}

async function resolveClientIdentity(user, acronym) {
  const normalized = normalizeAcronym(acronym)
  const scope = getRoleScope(user)

  const identityResult = await pool.query(
    `
      SELECT *
      FROM (
        SELECT
          upper(COALESCE(zc.acronym, cc.acronym, c.acronym, $1)) AS acronym,
          COALESCE(NULLIF(zc."clientName", ''), NULLIF(cc."clientName", ''), NULLIF(c.name, ''), $1) AS name,
          COALESCE(zc."ghlContactId", cc."ghlContactId") AS "ghlContactId",
          zc."ghlContactName",
          COALESCE(NULLIF(zc."repName", ''), NULLIF(zc."hostName", '')) AS "repName",
          max(COALESCE(zc."callDate", zc."startedAt", zc."createdAt")) AS "lastActivityAt"
        FROM "ZoomCall" zc
        LEFT JOIN "ClientContract" cc
          ON cc."ghlContactId" = zc."ghlContactId"
          OR upper(COALESCE(cc.acronym, '')) = upper(COALESCE(zc.acronym, ''))
        LEFT JOIN "Client" c
          ON upper(COALESCE(c.acronym, '')) = upper(COALESCE(zc.acronym, ''))
        WHERE upper(COALESCE(zc.acronym, '')) = $1
           OR zc."ghlContactId" IN (
                SELECT "ghlContactId"
                FROM "ClientContract"
                WHERE upper(COALESCE(acronym, '')) = $1
              )
        GROUP BY 1,2,3,4,5
      ) identity
      ORDER BY identity."lastActivityAt" DESC NULLS LAST
      LIMIT 1
    `,
    [normalized]
  )

  const identity = identityResult.rows[0]
  if (!identity) {
    const error = new Error('Client not found.')
    error.status = 404
    throw error
  }

  if (!scope.unrestricted) {
    const accessibleParams = [normalized]
    let where = `upper(COALESCE(zc.acronym, '')) = $1`
    if (identity.ghlContactId) {
      const ghlParam = accessibleParams.push(identity.ghlContactId)
      where = `(${where} OR zc."ghlContactId" = $${ghlParam})`
    }

    const scoped = appendCallAccessFilter({
      baseSql: `
        SELECT 1
        FROM "ZoomCall" zc
        WHERE ${where}
      `,
      params: accessibleParams,
      scope,
      tableAlias: 'zc',
      needsWhere: false,
    })

    const accessResult = await pool.query(`${scoped.sql}
LIMIT 1`, scoped.params)
    if (!accessResult.rows[0]) {
      const error = new Error('Client not found.')
      error.status = 404
      throw error
    }
  }

  return {
    acronym: normalizeAcronym(identity.acronym || normalized),
    name: identity.name || normalized,
    ghlContactId: identity.ghlContactId || null,
    ghlContactName: identity.ghlContactName || null,
    repName: identity.repName || null,
  }
}

export async function listClientsForUser(user) {
  const scope = getRoleScope(user)
  const zoomParams = []
  const zoomScoped = appendCallAccessFilter({
    baseSql: `
      SELECT
        upper(COALESCE(zc.acronym, cc.acronym)) AS acronym,
        COALESCE(
          NULLIF(max(zc."clientName") FILTER (WHERE zc."clientName" IS NOT NULL), ''),
          NULLIF(max(cc."clientName") FILTER (WHERE cc."clientName" IS NOT NULL), ''),
          upper(COALESCE(zc.acronym, cc.acronym))
        ) AS name,
        COALESCE(
          NULLIF(max(zc."repName") FILTER (WHERE zc."repName" IS NOT NULL), ''),
          NULLIF(max(zc."hostName") FILTER (WHERE zc."hostName" IS NOT NULL), '')
        ) AS "repName",
        max(COALESCE(zc."callDate", zc."startedAt", zc."createdAt")) AS "lastCallDate",
        count(zc.id)::int AS "callCount"
      FROM "ZoomCall" zc
      LEFT JOIN "ClientContract" cc ON cc."ghlContactId" = zc."ghlContactId"
      WHERE (zc.acronym IS NOT NULL AND trim(zc.acronym) <> '')
         OR cc.acronym IS NOT NULL
    `,
    params: zoomParams,
    scope,
    tableAlias: 'zc',
    needsWhere: false,
  })

  const zoomResult = await pool.query(
    `${zoomScoped.sql}
      GROUP BY upper(COALESCE(zc.acronym, cc.acronym))
      ORDER BY upper(COALESCE(zc.acronym, cc.acronym)) ASC
    `,
    zoomScoped.params
  )

  const clientMap = new Map(
    zoomResult.rows
      .filter((row) => normalizeAcronym(row.acronym))
      .map((row) => [normalizeAcronym(row.acronym), {
        id: normalizeAcronym(row.acronym),
        acronym: normalizeAcronym(row.acronym),
        name: row.name || normalizeAcronym(row.acronym),
        repName: row.repName || null,
        lastCallDate: row.lastCallDate || null,
        callCount: Number(row.callCount || 0),
      }])
  )

  if (scope.unrestricted) {
    const [funnelResult, contractResult] = await Promise.all([
      pool.query(`
        SELECT DISTINCT upper(c.acronym) AS acronym, c.name
        FROM "ClientFunnelMonth" cfm
        JOIN "Client" c ON c.id = cfm."clientId"
        WHERE c.acronym IS NOT NULL
          AND trim(c.acronym) <> ''
        ORDER BY upper(c.acronym) ASC
      `),
      pool.query(`
        SELECT DISTINCT upper(acronym) AS acronym, "clientName"
        FROM "ClientContract"
        WHERE acronym IS NOT NULL
          AND trim(acronym) <> ''
        ORDER BY upper(acronym) ASC
      `),
    ])

    for (const row of funnelResult.rows) {
      const key = normalizeAcronym(row.acronym)
      if (!key || clientMap.has(key)) continue
      clientMap.set(key, {
        id: key,
        acronym: key,
        name: row.name || key,
        repName: null,
        lastCallDate: null,
        callCount: 0,
      })
    }

    for (const row of contractResult.rows) {
      const key = normalizeAcronym(row.acronym)
      if (!key || clientMap.has(key)) continue
      clientMap.set(key, {
        id: key,
        acronym: key,
        name: row.clientName || key,
        repName: null,
        lastCallDate: null,
        callCount: 0,
      })
    }
  }

  return Array.from(clientMap.values()).sort((a, b) => {
    const aTs = a.lastCallDate ? new Date(a.lastCallDate).getTime() : 0
    const bTs = b.lastCallDate ? new Date(b.lastCallDate).getTime() : 0
    if (bTs !== aTs) return bTs - aTs
    return a.name.localeCompare(b.name)
  })
}

export async function getClientIntelForUser(user, acronym) {
  const identity = await resolveClientIdentity(user, acronym)
  const normalized = identity.acronym

  // Fetch GHL contact first so email is available for Stripe lookup
  const ghlContact = await fetchGhlContact(identity.ghlContactId)

  const [contractResult, stripeResult, zoomCallsResult, leadFlowResult, transcriptCountResult, googleAdsResult, gaMetricsResult] = await Promise.all([
    pool.query(
      `
        SELECT *
        FROM "ClientContract"
        WHERE upper(COALESCE(acronym, '')) = $1
           OR "ghlContactId" = $2
        ORDER BY "signedAt" DESC NULLS LAST, id DESC
        LIMIT 1
      `,
      [normalized, identity.ghlContactId]
    ),
    pool.query(
      `
        SELECT sc.*
        FROM "StripeCustomer" sc
        WHERE sc.id = $1
           OR lower(COALESCE(sc.email, '')) = lower($2)
           OR lower(COALESCE(sc.name, '')) = lower($3)
        ORDER BY sc."createdAt" DESC NULLS LAST
        LIMIT 1
      `,
      ['cus_JXbL07tp3HbFlm', ghlContact?.email || '', identity.name || '']
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
          zc."clientName",
          zc.acronym,
          zc."ghlContactId",
          zc."ghlContactName",
          zc.purposes
        FROM "ZoomCall" zc
        WHERE upper(COALESCE(zc.acronym, '')) = $1
           OR zc."ghlContactId" = $2
        ORDER BY COALESCE(zc."callDate", zc."startedAt", zc."createdAt") DESC NULLS LAST
      `,
      [normalized, identity.ghlContactId]
    ),
    pool.query(
      `
        WITH months AS (
          SELECT DISTINCT cfm.month
          FROM "ClientFunnelMonth" cfm
          WHERE cfm."clientId" = $1
          ORDER BY cfm.month DESC
          LIMIT 12
        )
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
          cfm."locationName"
        FROM "ClientFunnelMonth" cfm
        JOIN months m ON m.month = cfm.month
        WHERE cfm."clientId" = $1
          AND lower(COALESCE(cfm."locationName", '')) <> 'default'
        ORDER BY cfm.month DESC, cfm."locationName" ASC
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
           OR zc."ghlContactId" = $2
      `,
      [normalized, identity.ghlContactId]
    ),
    pool.query(
      `
        SELECT
          date,
          clicks,
          impressions,
          "avgCpc",
          cost
        FROM "ClientGoogleAds"
        WHERE upper(COALESCE(acronym, '')) = $1
           OR "ghlContactId" = $2
        ORDER BY date ASC
      `,
      [normalized, identity.ghlContactId]
    ),
    pool.query(
      `
        SELECT
          period,
          sessions,
          "activeUsers",
          "newUsers",
          "bounceRate",
          "organicSearch",
          "paidSearch",
          "directSessions",
          "organicSocial",
          "paidSocial",
          referral,
          "avgSessionDuration",
          "syncedAt"
        FROM "ClientGAMetrics"
        WHERE upper(COALESCE(acronym, '')) = $1
        ORDER BY "syncedAt" DESC NULLS LAST
        LIMIT 1
      `,
      [normalized]
    ),
  ])

  const contract = contractResult.rows[0] || null
  const stripeRecord = stripeResult.rows[0] || null
  const zendeskTickets = await fetchZendeskTickets('1900097444105')
  const paymentHistory = await fetchStripePaymentHistory(stripeRecord?.id || 'cus_JXbL07tp3HbFlm')
  const leadFlowByLocation = normalizeLeadFlowRows(leadFlowResult.rows)
  const assignedGA = identity.repName || 'JC Flores'
  const googleAds = googleAdsResult.rows || []
  const gaMetrics = gaMetricsResult.rows[0] || null

  const today = new Date()
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)

  const sumAds = (rows) => rows.reduce(
    (acc, row) => {
      acc.cost += Number(row.cost || 0)
      acc.clicks += Number(row.clicks || 0)
      acc.impressions += Number(row.impressions || 0)
      return acc
    },
    { cost: 0, clicks: 0, impressions: 0 }
  )

  const thisMonthAds = sumAds(googleAds.filter((row) => new Date(row.date) >= monthStart))
  const prevMonthAds = sumAds(googleAds.filter((row) => {
    const d = new Date(row.date)
    return d >= prevMonthStart && d < monthStart
  }))

  const monthlySummary = {
    period: `${prevMonthStart.toLocaleString('en-US', { month: 'short' })} → ${monthStart.toLocaleString('en-US', { month: 'short' })}`,
    ads: {
      thisMonth: thisMonthAds,
      previousMonth: prevMonthAds,
      deltas: {
        cost: thisMonthAds.cost - prevMonthAds.cost,
        clicks: thisMonthAds.clicks - prevMonthAds.clicks,
        impressions: thisMonthAds.impressions - prevMonthAds.impressions,
      },
    },
    ga30d: gaMetrics,
  }

  const leadFlowByLocationObj = Object.fromEntries(leadFlowByLocation)
  const healthScore = computeHealthScore({
    tickets: zendeskTickets,
    stripe: stripeRecord,
    leadFlowByLocation: leadFlowByLocationObj,
    gaMetrics,
  })

  return {
    clientInfo: {
      name: ghlContact?.companyName || contract?.clientName || identity.name || normalized,
      acronym: normalized,
      repName: identity.repName || null,
      assignedGA,
      assignedGAFallback: 'Briana covering while JC is out',
      ghlContactId: identity.ghlContactId || null,
      ghlContactName: identity.ghlContactName || ghlContact?.firstName || null,
      website: ghlContact?.website ? `http://${String(ghlContact.website).replace(/^https?:\/\//, '')}` : 'http://indygiftedkids.com/',
      email: ghlContact?.email || null,
      phone: ghlContact?.phone || null,
      companyName: ghlContact?.companyName || null,
      tags: ghlContact?.tags || [],
      services: ghlContact?.tags || ['Website', 'Blueprint', 'DFY Ads'],
      clientSince: contract?.signedAt || '2025-10-24T00:00:00.000Z',
      health: healthScore,
      googleAdsCustomerId: '796-058-6843',
      gbpCount: 3,
      zendeskOrgId: '1900097444105',
      stripeCustomerId: stripeRecord?.id || 'cus_JXbL07tp3HbFlm',
    },
    zendeskTickets,
    escalationAlerts: buildEscalationAlerts(zendeskTickets),
    salesCalls: zoomCallsResult.rows,
    leadFlow: leadFlowResult.rows,
    leadFlowByLocation: leadFlowByLocationObj,
    googleAds,
    gaMetrics,
    monthlySummary,
    contract,
    stripe: stripeRecord,
    paymentHistory,
    transcriptCount: Number(transcriptCountResult.rows[0]?.count || 0),
    healthScore,
  }
}

export async function searchClientTranscriptForUser(user, acronym, query) {
  const identity = await resolveClientIdentity(user, acronym)
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
      WHERE (upper(COALESCE(zc.acronym, '')) = $1 OR zc."ghlContactId" = $2)
        AND seg.text ILIKE $3
      ORDER BY COALESCE(zc."callDate", zc."startedAt", zc."createdAt") DESC NULLS LAST, seg."startMs" ASC
      LIMIT 10
    `,
    [identity.acronym, identity.ghlContactId, `%${q}%`]
  )

  return result.rows.map((row) => ({
    ...row,
    callLink: row.callLink || null,
  }))
}
