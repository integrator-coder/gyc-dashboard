import { NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { exec as execCb } from 'node:child_process'
import { promisify } from 'node:util'
import { pool, tableExists } from '@/lib/pg'
import { requireApiUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const WORKSPACE = process.env.OPENCLAW_WORKSPACE || `${process.env.HOME || require('os').homedir()}/.openclaw/workspace`
const exec = promisify(execCb)

async function getSecret(name) {
  try {
    const raw = await fs.readFile(path.join(WORKSPACE, '.secrets'), 'utf8')
    const line = raw.split('\n').find((l) => l.startsWith(`${name}=`))
    if (!line) return null
    return line.split('=', 2)[1]?.trim() || null
  } catch {
    return null
  }
}

async function fetchAnthropicMtdCost(apiKey) {
  if (!apiKey) return { enabled: false, error: 'ANTHROPIC_BILLING_API_KEY missing' }

  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0))
  const params = new URLSearchParams({
    starting_at: monthStart.toISOString().replace('.000', ''),
    ending_at: now.toISOString().replace('.000', ''),
    bucket_width: '1d',
  })

  const allBuckets = []
  let page = null
  let hasMore = true

  while (hasMore) {
    const pageParams = new URLSearchParams(params)
    if (page) pageParams.set('page', page)

    const res = await fetch(`https://api.anthropic.com/v1/organizations/cost_report?${pageParams.toString()}`, {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      const text = await res.text()
      return { enabled: true, error: `Anthropic API error ${res.status}`, details: text.slice(0, 240) }
    }

    const json = await res.json()
    allBuckets.push(...(json.data || []))
    hasMore = Boolean(json.has_more)
    page = json.next_page || null
  }

  const rawDaily = allBuckets.map((bucket) => {
    const amountRaw = (bucket.results || []).reduce((sum, r) => sum + Number(r.amount || 0), 0)
    return {
      date: bucket.starting_at,
      amountRaw,
    }
  })

  const rawTotal = rawDaily.reduce((sum, d) => sum + Number(d.amountRaw || 0), 0)
  // Anthropic cost_report can return values that behave like cents in some org views.
  const unitScale = rawTotal > 5000 ? 0.01 : 1

  const daily = rawDaily.map((d) => ({
    date: d.date,
    amount: Number((d.amountRaw * unitScale).toFixed(2)),
  }))

  const mtdUsd = Number((rawTotal * unitScale).toFixed(2))
  const elapsedDays = now.getUTCDate()
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate()
  const runRateDaily = elapsedDays > 0 ? mtdUsd / elapsedDays : 0
  const projectedMonthEndUsd = runRateDaily * daysInMonth

  return {
    enabled: true,
    mtdUsd: Number(mtdUsd.toFixed(2)),
    runRateDaily: Number(runRateDaily.toFixed(2)),
    projectedMonthEndUsd: Number(projectedMonthEndUsd.toFixed(2)),
    daily: daily.map((d) => ({ date: d.date, amount: Number(d.amount.toFixed(2)) })),
    pagesLoaded: Math.ceil(allBuckets.length / 31),
  }
}

async function readJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

async function readDiaryEntries(days = 90) {
  const dir = path.join(WORKSPACE, 'memory')
  const files = await fs.readdir(dir)
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000

  const dayFiles = files
    .filter((name) => /^\d{4}-\d{2}-\d{2}\.md$/.test(name))
    .sort()
    .reverse()

  const entries = []
  for (const name of dayFiles) {
    const dateStr = name.replace('.md', '')
    const ts = new Date(`${dateStr}T00:00:00Z`).getTime()
    if (Number.isFinite(ts) && ts < cutoff) continue

    const full = await fs.readFile(path.join(dir, name), 'utf8')
    const lines = full.split('\n')
    let currentTime = null
    for (const line of lines) {
      if (line.startsWith('### ')) {
        currentTime = line.replace('### ', '').trim()
      } else if (line.startsWith('- ') && currentTime) {
        entries.push({
          date: dateStr,
          time: currentTime,
          note: line.replace('- ', '').trim(),
        })
      }
    }
  }

  return entries.slice(0, 400)
}

async function readGitJobs(days = 90) {
  try {
    const { stdout } = await exec(`git -C "${WORKSPACE}" log --since="${days} days ago" --pretty=format:"%H|%cI|%s" --max-count=300`)
    return stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [hash, committedAt, title] = line.split('|')
        return {
          id: `git-${hash.slice(0, 10)}`,
          title,
          owner: 'Wall·E',
          status: 'success',
          startedAt: committedAt,
          endedAt: committedAt,
          summary: `Commit ${hash.slice(0, 7)}`,
          artifact: null,
          source: 'git',
        }
      })
  } catch {
    return []
  }
}

export async function GET() {
  const auth = await requireApiUser(['sales', 'ga', 'cx', 'recon', 'admin', 'superadmin'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const heartbeatState = await readJson(path.join(WORKSPACE, 'memory/heartbeat-state.json'), { lastChecks: {} })
  const project15State = await readJson(path.join(WORKSPACE, 'memory/project15-notified.json'), { notified: {} })
  const taskBoard = await readJson(path.join(WORKSPACE, 'memory/mission-control-taskboard.json'), { columns: {}, updatedAt: null })
  const jobs = await readJson(path.join(WORKSPACE, 'memory/mission-control-jobs.json'), { jobs: [] })
  const gitJobs = await readGitJobs(90)
  const projectLinks = await readJson(path.join(WORKSPACE, 'projects/mission-control-project-links.json'), { links: [] })
  const diary = await readDiaryEntries(90)

  const mergedJobs = [...(jobs.jobs || []), ...gitJobs]
    .sort((a, b) => new Date(b.endedAt || b.startedAt || 0).getTime() - new Date(a.endedAt || a.startedAt || 0).getTime())
    .slice(0, 300)

  const sources = ['stripe', 'client-funnels', 'dunning', 'slack-digest']
  const eveSync = []
  for (const source of sources) {
    const { rows } = await pool.query(
      `SELECT source, status, message, "syncedAt" FROM "SyncLog" WHERE source = $1 ORDER BY "syncedAt" DESC LIMIT 1`,
      [source]
    )
    eveSync.push(rows[0] || { source, status: 'unknown', message: 'No run logged yet', syncedAt: null })
  }

  let escalationRadar = []
  const hasOrgTable = await tableExists('"ZendeskOrgTicket"')
  if (hasOrgTable) {
    const { rows } = await pool.query(`
      WITH latest AS (
        SELECT max(id) AS snapshot_id FROM "ZendeskSnapshot"
      )
      SELECT zt."orgName", zt."orgId", zt."openCount"
      FROM "ZendeskOrgTicket" zt
      JOIN latest l ON l.snapshot_id = zt."snapshotId"
      ORDER BY zt."openCount" DESC
      LIMIT 20
    `)

    const scored = []
    for (const row of rows) {
      const orgName = String(row.orgName || '')
      const acronymMatch = orgName.match(/^([A-Z]{2,8})\s*-/)
      const acronym = acronymMatch ? acronymMatch[1] : null

      let riskScore = 0
      const flags = []
      const factors = {
        ticketPressure: 0,
        leadMomentum: 0,
        conversionMomentum: 0,
        gaQuality: 0,
        adsEfficiency: 0,
      }

      // 1) Ticket pressure (always available)
      const openCount = Number(row.openCount || 0)
      factors.ticketPressure = Math.min(40, openCount * 2)
      if (openCount >= 15) flags.push('High ticket pressure')

      // 2) Funnel momentum (if mapped acronym exists)
      if (acronym) {
        const funnelRows = await pool.query(
          `
            SELECT month,
                   SUM(leads)::int AS leads,
                   SUM(tours)::int AS tours,
                   SUM(registered)::int AS registered
            FROM "ClientFunnelMonth"
            WHERE "clientId" = $1
              AND lower(COALESCE("locationName", '')) <> 'default'
            GROUP BY month
            ORDER BY month DESC
            LIMIT 2
          `,
          [acronym]
        )

        if (funnelRows.rows.length >= 2) {
          const latest = funnelRows.rows[0]
          const prev = funnelRows.rows[1]
          const latestLeads = Number(latest.leads || 0)
          const prevLeads = Number(prev.leads || 0)
          const latestConv = latestLeads > 0 ? Number(latest.registered || 0) / latestLeads : 0
          const prevConv = Number(prev.leads || 0) > 0 ? Number(prev.registered || 0) / Number(prev.leads || 0) : 0

          if (prevLeads > 0 && latestLeads < prevLeads) {
            const leadDropPct = (prevLeads - latestLeads) / prevLeads
            factors.leadMomentum = Math.min(20, Math.round(leadDropPct * 20))
            if (leadDropPct >= 0.25) flags.push('Leads dropped >25% MoM')
          }

          if (latestConv < prevConv) {
            const convDrop = prevConv - latestConv
            factors.conversionMomentum = Math.min(20, Math.round(convDrop * 100))
            if (convDrop >= 0.03) flags.push('Conversion rate declining')
          }
        }

        // 3) GA quality (30d snapshot)
        const gaRows = await pool.query(
          `
            SELECT sessions, "bounceRate", "paidSocial", "organicSearch", "paidSearch"
            FROM "ClientGAMetrics"
            WHERE acronym = $1
            ORDER BY "syncedAt" DESC
            LIMIT 1
          `,
          [acronym]
        )
        if (gaRows.rows[0]) {
          const ga = gaRows.rows[0]
          const sessions = Number(ga.sessions || 0)
          const bounce = Number(ga.bounceRate || 0)
          const paidSocialShare = sessions > 0 ? Number(ga.paidSocial || 0) / sessions : 0

          if (bounce >= 0.6) {
            factors.gaQuality += 8
            flags.push('High bounce rate')
          }
          if (paidSocialShare >= 0.6) {
            factors.gaQuality += 7
            flags.push('Heavy paid-social dependency')
          }
          const searchTotal = Number(ga.organicSearch || 0) + Number(ga.paidSearch || 0)
          if (sessions > 0 && searchTotal / sessions < 0.15) {
            factors.gaQuality += 5
            flags.push('Low search channel contribution')
          }
          factors.gaQuality = Math.min(20, factors.gaQuality)
        }

        // 4) Ads efficiency trend (monthly avg CPC + clicks)
        const adsRows = await pool.query(
          `
            SELECT date_trunc('month', date)::date AS month,
                   SUM(clicks)::int AS clicks,
                   SUM(cost)::numeric AS cost
            FROM "ClientGoogleAds"
            WHERE upper(COALESCE(acronym, '')) = $1
            GROUP BY 1
            ORDER BY 1 DESC
            LIMIT 2
          `,
          [acronym]
        )
        if (adsRows.rows.length >= 2) {
          const cur = adsRows.rows[0]
          const prev = adsRows.rows[1]
          const curClicks = Number(cur.clicks || 0)
          const prevClicks = Number(prev.clicks || 0)
          const curCpc = curClicks > 0 ? Number(cur.cost || 0) / curClicks : 0
          const prevCpc = prevClicks > 0 ? Number(prev.cost || 0) / prevClicks : 0

          if (prevCpc > 0 && curCpc > prevCpc * 1.25) {
            factors.adsEfficiency += 8
            flags.push('Avg CPC spiking')
          }
          if (prevClicks > 0 && curClicks < prevClicks * 0.8) {
            factors.adsEfficiency += 7
            flags.push('Ad clicks falling')
          }
          factors.adsEfficiency = Math.min(20, factors.adsEfficiency)
        }
      }

      riskScore = factors.ticketPressure + factors.leadMomentum + factors.conversionMomentum + factors.gaQuality + factors.adsEfficiency
      const riskBand = riskScore >= 60 ? 'high' : riskScore >= 35 ? 'medium' : 'low'

      scored.push({
        ...row,
        acronym,
        riskScore,
        riskBand,
        flags,
        factors,
      })
    }

    escalationRadar = scored.sort((a, b) => b.riskScore - a.riskScore).slice(0, 10)
  }

  const syncBySource = Object.fromEntries(eveSync.map((row) => [row.source, row]))
  const staleOrError = eveSync.filter((row) => row.status === 'error' || row.status === 'NO_DATA')

  const notifiedEpisodes = Object.keys(project15State?.notified || {})
  const latestNudge = notifiedEpisodes
    .map((ep) => project15State.notified?.[ep]?.lastNudge)
    .filter(Boolean)
    .sort()
    .at(-1) || null

  const scheduler = [
    {
      id: 'eve-status-check',
      cadence: 'Heartbeat + daily',
      lastCheckEpoch: heartbeatState?.lastChecks?.eveStatus || null,
      status: staleOrError.length ? 'attention' : 'ok',
      finding: staleOrError.length
        ? `${staleOrError.length} source(s) need attention: ${staleOrError.map((s) => s.source).join(', ')}`
        : 'All tracked Eve sources are healthy on latest run.',
      followUp: staleOrError.length
        ? 'Open Eve panel, assign owner, and confirm fix ETA for each failing source.'
        : 'No immediate follow-up required.',
    },
    {
      id: 'zoom-daily-ingestion',
      cadence: 'Weekdays 07:00 ET',
      lastCheckEpoch: heartbeatState?.lastChecks?.eveStatus || null,
      status: syncBySource['stripe']?.status === 'NO_DATA' ? 'attention' : 'ok',
      finding: syncBySource['stripe']?.status === 'NO_DATA'
        ? 'Stripe-linked ingestion signal still shows NO_DATA in SyncLog chain.'
        : 'No ingestion warning visible from latest sync telemetry.',
      followUp: syncBySource['stripe']?.status === 'NO_DATA'
        ? 'Run Stripe sync diagnostics and verify writes into SyncLog.'
        : 'Continue scheduled monitoring.',
    },
    {
      id: 'project15-reminder',
      cadence: 'Heartbeat (6h max)',
      lastCheckEpoch: heartbeatState?.lastChecks?.project15 || null,
      status: notifiedEpisodes.length ? 'attention' : 'ok',
      finding: notifiedEpisodes.length
        ? `Episode reminders pending for: ${notifiedEpisodes.join(', ')}`
        : 'No active Project 15 reminders currently pending.',
      followUp: notifiedEpisodes.length
        ? `Latest nudge: ${latestNudge || 'unknown'}. Confirm NotebookLM load + mark tracker column F = Y.`
        : 'No follow-up required.',
    },
  ]

  const anthropicKey = await getSecret('ANTHROPIC_BILLING_API_KEY')
  const anthropicCost = await fetchAnthropicMtdCost(anthropicKey)
  const routingPolicy = await readJson(path.join(WORKSPACE, 'memory/model-routing-policy.json'), null)

  const budgetMonthly = 200
  const thresholds = [50, 100, 150, 175]
  const usageMonthly = Number(anthropicCost?.mtdUsd || 0)
  const thresholdsCrossed = thresholds.filter((t) => usageMonthly >= t)

  const costMonitor = {
    budgetMonthly,
    thresholds,
    thresholdsCrossed,
    usageMonthly,
    anthropic: anthropicCost,
    policy: routingPolicy,
    note: anthropicCost?.enabled
      ? 'Anthropic cost feed live. OpenAI feed pending key setup.'
      : 'Provider cost feed pending key setup.',
  }

  const inProgress = taskBoard?.columns?.inProgress || []
  const nowIso = new Date().toISOString()
  const agents = [
    {
      name: 'Wall·E',
      role: 'Primary Orchestrator',
      category: 'main',
      node: 'Mac Mini',
      status: inProgress.some((t) => t.owner === 'Wall·E') ? 'working' : 'idle',
      currentTask: inProgress.find((t) => t.owner === 'Wall·E')?.title || null,
      lastActivity: nowIso,
      reportsTo: null,
      children: ['R2', 'Eve', 'Echo', 'C3PO', 'Ratchet', 'Friday'],
    },
    {
      name: 'Eve',
      role: 'Sync + Data Node',
      category: 'main',
      node: 'Mac Studio',
      status: staleOrError.length ? 'attention' : 'working',
      currentTask: staleOrError.length ? 'Resolve sync alerts' : 'Background sync operations',
      lastActivity: eveSync[0]?.syncedAt || nowIso,
      reportsTo: 'Wall·E',
      children: ['BB-8', 'Fulcrum', 'Vision'],
    },
    {
      name: 'R2',
      role: 'Builder Agent',
      category: 'worker',
      node: 'Mac Mini',
      status: inProgress.some((t) => t.owner === 'R2') ? 'working' : 'idle',
      currentTask: inProgress.find((t) => t.owner === 'R2')?.title || null,
      lastActivity: nowIso,
      reportsTo: 'Wall·E',
      children: [],
    },
    {
      name: 'BB-8',
      role: 'Eve Builder',
      category: 'worker',
      node: 'Mac Studio',
      status: inProgress.some((t) => t.owner === 'BB-8') ? 'working' : 'idle',
      currentTask: inProgress.find((t) => t.owner === 'BB-8')?.title || null,
      lastActivity: nowIso,
      reportsTo: 'Eve',
      children: [],
    },
    {
      name: 'Fulcrum',
      role: 'Intel Agent',
      category: 'worker',
      node: 'Mac Studio',
      status: inProgress.some((t) => t.owner === 'Fulcrum') ? 'working' : 'idle',
      currentTask: inProgress.find((t) => t.owner === 'Fulcrum')?.title || 'Monitoring queues and intelligence checks',
      lastActivity: nowIso,
      reportsTo: 'Eve',
      children: [],
    },
    {
      name: 'Friday',
      role: 'Travel Orchestrator',
      category: 'main',
      node: 'Laptop',
      status: 'planned',
      currentTask: 'Setup pending',
      lastActivity: null,
      reportsTo: 'Wall·E',
      children: ['Chopper'],
    },
    {
      name: 'Chopper',
      role: 'Friday Worker',
      category: 'worker',
      node: 'Laptop',
      status: 'planned',
      currentTask: 'Waiting for Friday setup',
      lastActivity: null,
      reportsTo: 'Friday',
      children: [],
    },
    {
      name: 'Echo',
      role: 'PM / Comms',
      category: 'worker',
      node: 'Mac Mini',
      status: inProgress.some((t) => t.owner === 'Echo') ? 'working' : 'idle',
      currentTask: inProgress.find((t) => t.owner === 'Echo')?.title || 'Task routing + status summaries',
      lastActivity: nowIso,
      reportsTo: 'Wall·E',
      children: [],
    },
    {
      name: 'C3PO',
      role: 'QA Gate',
      category: 'worker',
      node: 'Mac Mini',
      status: inProgress.some((t) => t.owner === 'C3PO') ? 'working' : 'idle',
      currentTask: inProgress.find((t) => t.owner === 'C3PO')?.title || 'Build validation + smoke tests',
      lastActivity: nowIso,
      reportsTo: 'Wall·E',
      children: [],
    },
    {
      name: 'Ratchet',
      role: 'Fleet Watchdog',
      category: 'worker',
      node: 'Mac Mini',
      status: inProgress.some((t) => t.owner === 'Ratchet') ? 'working' : 'idle',
      currentTask: inProgress.find((t) => t.owner === 'Ratchet')?.title || 'Monitoring agent health + cron status',
      lastActivity: nowIso,
      reportsTo: 'Wall·E',
      children: [],
    },
    {
      name: 'Vision',
      role: 'Sec / Data Guard',
      category: 'worker',
      node: 'Mac Studio',
      status: inProgress.some((t) => t.owner === 'Vision') ? 'working' : 'idle',
      currentTask: inProgress.find((t) => t.owner === 'Vision')?.title || 'Security posture + snapshot freshness checks',
      lastActivity: nowIso,
      reportsTo: 'Eve',
      children: [],
    },
  ]

  return NextResponse.json({
    taskBoard,
    jobs: mergedJobs,
    projectLinks: projectLinks.links || [],
    diary,
    agents,
    scheduler,
    eveSync,
    escalationRadar,
    costMonitor,
    generatedAt: nowIso,
  })
}
