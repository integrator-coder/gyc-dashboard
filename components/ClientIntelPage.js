'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ResponsiveContainer, BarChart, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { formatDuration, formatTimestamp } from '@/lib/team'

function formatDate(value, includeTime = false) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(includeTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  }).format(new Date(value))
}

function formatMonth(value) {
  if (!value) return '-'
  const [year, month] = String(value).split('-')
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(new Date(Number(year), Number(month) - 1, 1))
}

function formatCurrency(value) {
  const amount = Number(value || 0)
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function formatPercent(value) {
  if (value == null || Number.isNaN(Number(value))) return '-'
  return `${(Number(value) * 100).toFixed(0)}%`
}

function formatNumber(value) {
  if (value == null || Number.isNaN(Number(value))) return '-'
  return new Intl.NumberFormat('en-US').format(Number(value))
}

function classForTicketStatus(statusColor) {
  if (statusColor === 'red') return 'border-rose-500/30 bg-rose-500/10 text-rose-200'
  if (statusColor === 'amber') return 'border-amber-500/30 bg-amber-500/10 text-amber-200'
  if (statusColor === 'gray') return 'border-gray-500/30 bg-gray-500/10 text-gray-300'
  return 'border-violet-500/30 bg-violet-500/10 text-violet-200'
}

function trendChip(value) {
  if (value == null) return { label: '-', className: 'border-gray-500/30 bg-gray-500/10 text-gray-300' }
  if (value > 0) return { label: `↑ ${value}`, className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' }
  if (value < 0) return { label: `↓ ${Math.abs(value)}`, className: 'border-rose-500/30 bg-rose-500/10 text-rose-200' }
  return { label: '→ 0', className: 'border-gray-500/30 bg-gray-500/10 text-gray-300' }
}

function EmptyState({ children }) {
  return <div className="rounded-2xl border border-dashed border-[var(--brand-border)] bg-black/10 px-4 py-5 text-sm text-gray-500">{children}</div>
}

function SectionCard({ eyebrow, title, children, action }) {
  return (
    <section className="overflow-hidden rounded-3xl border border-[var(--brand-border)] bg-[radial-gradient(circle_at_top,#1a1024,transparent_45%),var(--brand-bg-card)]">
      <div className="border-b border-[var(--brand-border)] px-6 py-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-gray-400">{eyebrow}</div>
            <h2 className="mt-1 text-2xl font-bold text-white">{title}</h2>
          </div>
          {action}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </section>
  )
}

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-2xl border border-[var(--brand-border)] bg-black/25 px-4 py-4">
      <div className="text-xs uppercase tracking-wider text-gray-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-white">{value}</div>
      {sub ? <div className="mt-1 text-xs text-gray-500">{sub}</div> : null}
    </div>
  )
}

function CallList({ calls, emptyText }) {
  if (!calls.length) return <EmptyState>{emptyText}</EmptyState>

  return (
    <div className="space-y-3">
      {calls.map((call) => (
        <div key={call.id} className="rounded-2xl border border-[var(--brand-border)] bg-black/20 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-violet-200">{formatDate(call.callDate || call.startedAt)}</span>
                <span className="rounded-full border border-[var(--brand-border)] bg-black/30 px-2.5 py-1 text-gray-300">{formatDuration(call.durationSecs)}</span>
                <span className="rounded-full border border-[var(--brand-border)] bg-black/30 px-2.5 py-1 text-gray-300">{call.repName || call.hostName || 'Unknown rep'}</span>
                {(call.purposes || []).map((purpose) => (
                  <span key={purpose} className="rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-2.5 py-1 uppercase text-fuchsia-200">{purpose}</span>
                ))}
              </div>
              <h3 className="mt-3 text-lg font-semibold text-white">{call.meetingTopic || 'Untitled Zoom call'}</h3>
            </div>
            {call.callLink ? <a href={call.callLink} target="_blank" rel="noreferrer" className="inline-flex rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-sm font-medium text-violet-200 transition hover:border-violet-400/50 hover:text-white">Open recording ↗</a> : null}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function ClientIntelPage({ acronym, user }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [ticketFilter, setTicketFilter] = useState('all')
  const [activeTab, setActiveTab] = useState('overview')

  const loadClient = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(acronym)}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load client intel.')
      setData(json)
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [acronym])

  useEffect(() => {
    loadClient()
  }, [loadClient])

  const runSearch = useCallback(async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const params = new URLSearchParams({ q: searchQuery.trim() })
      const res = await fetch(`/api/clients/${encodeURIComponent(acronym)}/search?${params.toString()}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to search transcripts.')
      setSearchResults(json.results || [])
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSearching(false)
    }
  }, [acronym, searchQuery])

  const clientInfo = data?.clientInfo || {}
  const contract = data?.contract || null
  const stripe = data?.stripe || null
  const tickets = data?.zendeskTickets || []
  const filteredTickets = useMemo(() => {
    if (ticketFilter === 'all') return tickets
    return tickets.filter((ticket) => String(ticket.status).toLowerCase() === ticketFilter)
  }, [ticketFilter, tickets])
  const leadFlowByLocation = data?.leadFlowByLocation || {}
  const leadLocations = Object.entries(leadFlowByLocation)
  const googleAds = data?.googleAds || []
  const gaMetrics = data?.gaMetrics || null
  const monthlySummary = data?.monthlySummary || null

  const enrollmentChartData = useMemo(() => {
    const byMonth = new Map()

    for (const [, rows] of leadLocations) {
      for (const row of rows || []) {
        if (!row?.month) continue
        const key = String(row.month)
        const existing = byMonth.get(key) || { month: key, leads: 0, tours: 0, registered: 0 }
        existing.leads += Number(row.leads || 0)
        existing.tours += Number(row.tours || 0)
        existing.registered += Number(row.registered || 0)
        byMonth.set(key, existing)
      }
    }

    return Array.from(byMonth.values())
      .sort((a, b) => String(a.month).localeCompare(String(b.month)))
      .map((row) => {
        const touringRate = row.leads > 0 ? row.tours / row.leads : 0
        const closeRate = row.tours > 0 ? row.registered / row.tours : 0
        const conversionRate = row.leads > 0 ? row.registered / row.leads : 0
        return {
          ...row,
          monthLabel: formatMonth(row.month),
          touringRate,
          closeRate,
          conversionRate,
        }
      })
  }, [leadLocations])

  const adsMonthlyChartData = useMemo(() => {
    const byMonth = new Map()
    for (const row of googleAds) {
      const d = new Date(row.date)
      if (Number.isNaN(d.getTime())) continue
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const existing = byMonth.get(key) || { month: key, cost: 0, clicks: 0, impressions: 0 }
      existing.cost += Number(row.cost || 0)
      existing.clicks += Number(row.clicks || 0)
      existing.impressions += Number(row.impressions || 0)
      byMonth.set(key, existing)
    }
    return Array.from(byMonth.values())
      .sort((a, b) => String(a.month).localeCompare(String(b.month)))
      .map((row) => ({
        ...row,
        avgCpc: row.clicks > 0 ? row.cost / row.clicks : 0,
        monthLabel: formatMonth(row.month),
      }))
  }, [googleAds])

  const pendingTicketCount = tickets.filter((ticket) => String(ticket.status).toLowerCase() === 'pending').length
  const latestFunnel = enrollmentChartData[enrollmentChartData.length - 1] || null
  const priorFunnel = enrollmentChartData[enrollmentChartData.length - 2] || null
  const thisMonthAds = monthlySummary?.ads?.thisMonth || null
  const thisMonthAvgCpc = thisMonthAds && Number(thisMonthAds.clicks || 0) > 0
    ? Number(thisMonthAds.cost || 0) / Number(thisMonthAds.clicks || 0)
    : null

  const openOrPendingTickets = useMemo(
    () => tickets.filter((t) => ['open', 'pending'].includes(String(t.status || '').toLowerCase())),
    [tickets]
  )
  const overdueTickets = useMemo(
    () => openOrPendingTickets.filter((t) => Number(t.daysOpen || 0) > 14),
    [openOrPendingTickets]
  )
  const oldestTicket = useMemo(
    () => [...openOrPendingTickets].sort((a, b) => Number(b.daysOpen || 0) - Number(a.daysOpen || 0))[0] || null,
    [openOrPendingTickets]
  )

  const analyticsStory = useMemo(() => {
    if (!gaMetrics) return []
    const sessions = Number(gaMetrics.sessions || 0)
    const paidSocial = Number(gaMetrics.paidSocial || 0)
    const organicSearch = Number(gaMetrics.organicSearch || 0)
    const paidSearch = Number(gaMetrics.paidSearch || 0)
    const direct = Number(gaMetrics.directSessions || 0)

    const channelShare = sessions > 0
      ? [
          `Paid social drives ${Math.round((paidSocial / sessions) * 100)}% of tracked sessions (${formatNumber(paidSocial)} of ${formatNumber(sessions)}).`,
          `Search (organic + paid) contributes ${Math.round(((organicSearch + paidSearch) / sessions) * 100)}% (${formatNumber(organicSearch + paidSearch)} sessions).`,
        ]
      : ['Session data is unavailable for channel mix right now.']

    const engagement = `Engagement baseline: ${Math.round(Number(gaMetrics.bounceRate || 0) * 100)}% bounce rate and ${Math.round(Number(gaMetrics.avgSessionDuration || 0))}s average session duration.`
    const directTraffic = `Direct sessions are ${formatNumber(direct)} - useful signal for brand recall and returning traffic.`

    const funnelStory = latestFunnel
      ? `Latest funnel month: Touring Rate ${Math.round((latestFunnel.touringRate || 0) * 100)}%, Close Rate ${Math.round((latestFunnel.closeRate || 0) * 100)}%, Conversion Rate ${Math.round((latestFunnel.conversionRate || 0) * 100)}%.`
      : 'Funnel conversion story will populate when lead flow trend data is available.'

    const improvementHint = priorFunnel && latestFunnel
      ? `MoM focus: conversion moved from ${Math.round((priorFunnel.conversionRate || 0) * 100)}% to ${Math.round((latestFunnel.conversionRate || 0) * 100)}%; frame meeting on what changed in process quality and follow-up speed.`
      : 'Once two months are available, add month-over-month conversion narrative to meeting prep.'

    return [...channelShare, engagement, directTraffic, funnelStory, improvementHint]
  }, [gaMetrics, latestFunnel, priorFunnel])

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-violet-300">Team Portal</div>
          <h1 className="mt-2 text-3xl font-bold text-white">Client Intel Card</h1>
          <p className="mt-1 text-sm text-gray-400">Escalation-ready view for GA, CX, and leadership. {user?.role === 'ga' ? 'Scoped to your client book.' : 'Shared internal view.'}</p>
        </div>
        <button onClick={loadClient} className="rounded-xl border border-[var(--brand-border)] px-4 py-2 text-sm font-medium text-gray-300 transition hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-white">Refresh</button>
      </div>

      {error ? <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}

      <div className="flex flex-wrap gap-2">
        {[
          ['overview', 'Overview Summary'],
          ['portfolio', 'Portfolio Performance'],
          ['finance', 'Agreements & Finance'],
          ['comms', 'Communications'],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${activeTab === key ? 'border-violet-500/40 bg-violet-500/15 text-violet-100' : 'border-[var(--brand-border)] bg-black/20 text-gray-300 hover:text-white'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="rounded-[32px] border border-[var(--brand-border)] bg-[radial-gradient(circle_at_top,#35104d,transparent_38%),linear-gradient(180deg,rgba(20,12,26,0.98),rgba(10,10,10,1))] p-8 shadow-[0_0_60px_rgba(52,11,103,0.25)]">
        {loading && !data ? (
          <div className="text-sm text-gray-400">Loading client intel…</div>
        ) : (
          <>
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-300">Client Intel</div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <h2 className="text-4xl font-bold text-white">{clientInfo.name || acronym}</h2>
                  <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-sm font-semibold uppercase tracking-wider text-violet-100">{clientInfo.acronym || acronym}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-3 text-sm text-gray-300">
                  <span>GA assigned: {clientInfo.assignedGA || 'JC Flores'} - Briana covering</span>
                  <span>Contract: {contract ? `${contract.contractType} - ${contract.programLevel}` : 'Blueprint - Own Your Zip Code'}</span>
                  <span>MRR: {formatCurrency(stripe?.mrr || 3723.7)}</span>
                  <span>Client since: {formatDate(clientInfo.clientSince || contract?.signedAt)}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-sm">
                  {(clientInfo.services || []).map((service) => (
                    <span key={service} className="rounded-full border border-[var(--brand-border)] bg-black/30 px-3 py-1.5 text-gray-200">{service}</span>
                  ))}
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-amber-200">Health: TBD</span>
                </div>
              </div>
              <div className="grid w-full max-w-md grid-cols-2 gap-3">
                <StatCard label="Open Tickets" value={tickets.filter((ticket) => ticket.status === 'open').length} />
                <StatCard label="Pending Tickets" value={pendingTicketCount} />
                <StatCard label="Zoom Calls" value={data?.salesCalls?.length || 0} />
                <StatCard label="Transcript Segments" value={data?.transcriptCount || 0} />
              </div>
            </div>
          </>
        )}
      </div>

      {activeTab === 'overview' && (
        <>
          <SectionCard eyebrow="Overview" title="Meeting-ready summary">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Open + Pending Tickets" value={tickets.filter((t) => t.status === 'open' || t.status === 'pending').length} />
              <StatCard label="MRR" value={formatCurrency(stripe?.mrr || 0)} />
              <StatCard label="Latest GA Sessions (30d)" value={formatNumber(gaMetrics?.sessions)} />
              <StatCard label="Latest Conversion Rate" value={latestFunnel ? `${Math.round((latestFunnel.conversionRate || 0) * 100)}%` : '-'} />
            </div>
            <div className="mt-5 grid gap-4 xl:grid-cols-3">
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <div className="text-sm font-semibold text-emerald-100">Highlights</div>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-emerald-100/90">
                  <li>GA traffic is strong at {formatNumber(gaMetrics?.sessions)} sessions over 30 days — the visibility is there.</li>
                  <li>Feb funnel: Touring Rate {latestFunnel ? `${Math.round((latestFunnel.touringRate || 0) * 100)}%` : '—'}, Conversion Rate {latestFunnel ? `${Math.round((latestFunnel.conversionRate || 0) * 100)}%` : '—'}.</li>
                  <li>Former employee photos removed ✅. Redesign submitted to design ✅.</li>
                  <li>UGC brief and content calendar delivered by JC on Mar 13.</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
                <div className="text-sm font-semibold text-rose-100">Red Flags (front and center)</div>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-rose-100/90">
                  <li>Website redesign still not live — promised since August 2025 (7+ months).</li>
                  <li>Meta payment still down — ads ready but not fully live.</li>
                  <li>South location GBP: still unresolved visibility issue (since Feb).</li>
                  <li>SMTP/Brevo domain access ticket open since April 2025 (11 months, unactioned).</li>
                  <li>{openOrPendingTickets.length} open/pending tickets, {overdueTickets.length} overdue 14+ days.</li>
                  {(data?.escalationAlerts || []).slice(0, 2).map((a) => <li key={a.id}>{a.title}</li>)}
                </ul>
              </div>

              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                <div className="text-sm font-semibold text-amber-100">Meeting Sequence Suggestion</div>
                <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-amber-100/90">
                  <li><strong className="text-white">Let her vent first (5–10 min).</strong> Open with: "Before we go through anything, I want to hear from you — how are you feeling about where things are?" Don't interrupt. Listen and take notes.</li>
                  <li><strong className="text-white">Validate, not defend.</strong> Say: "You're right — several things took longer than they should have and you deserved better communication. We own that."</li>
                  <li><strong className="text-white">Confirm what is done</strong> (fast, no over-explaining): photo removal ✅, redesign submitted ✅, briefs delivered ✅.</li>
                  <li><strong className="text-white">Name each open blocker clearly</strong> with owner + date: website live date, Meta payment fix, South GBP status, SMTP task, remaining photo assets needed.</li>
                  <li><strong className="text-white">Ask about South location.</strong> "What does the South enrollment picture look like right now? Are we on track for your September target?" Listen.</li>
                  <li><strong className="text-white">Close with a joint plan.</strong> Agree on one KPI to move per location, weekly check-in cadence, and a shared decision log.</li>
                </ol>
              </div>
            </div>
          </SectionCard>

          <SectionCard eyebrow="Escalation" title="⚠️ Escalation alerts">
            <div className="grid gap-4 lg:grid-cols-2">
              {(data?.escalationAlerts || []).map((alert) => (
                <div key={alert.id} className={`rounded-2xl border p-5 ${alert.tone === 'red' ? 'border-rose-500/40 bg-rose-500/10' : 'border-amber-500/40 bg-amber-500/10'}`}>
                  <div className={`text-lg font-semibold ${alert.tone === 'red' ? 'text-rose-100' : 'text-amber-100'}`}>{alert.title}</div>
                  {alert.openedAt ? <div className="mt-2 text-sm text-gray-300">{formatDate(alert.openedAt)} - {alert.daysOpen} days open</div> : <div className="mt-2 text-sm text-gray-300">Live Zendesk count</div>}
                </div>
              ))}
            </div>
          </SectionCard>
        </>
      )}

      {activeTab === 'portfolio' && (
        <div className="space-y-6">
          <SectionCard eyebrow="Portfolio performance" title="Lead flow by location">
            {!leadLocations.length ? (
              <EmptyState>No lead flow data yet.</EmptyState>
            ) : (
              <div className="space-y-6">
                <div className="rounded-2xl border border-[var(--brand-border)] bg-black/20 p-4">
                  <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Enrollment trend (all locations)</div>
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={enrollmentChartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.16)" />
                        <XAxis dataKey="monthLabel" tick={{ fill: '#c4b5fd', fontSize: 12 }} />
                        <YAxis yAxisId="count" tick={{ fill: '#cbd5e1', fontSize: 12 }} />
                        <YAxis yAxisId="rate" orientation="right" tickFormatter={(v) => `${Math.round((v || 0) * 100)}%`} tick={{ fill: '#fcd34d', fontSize: 12 }} />
                        <Tooltip
                          contentStyle={{ background: '#111827', border: '1px solid rgba(139, 92, 246, 0.35)', borderRadius: 12, color: '#f8fafc' }}
                          labelStyle={{ color: '#c4b5fd' }}
                          formatter={(value, name) => {
                            if (['Touring Rate', 'Close Rate', 'Conversion Rate'].includes(String(name))) {
                              return [`${Math.round(Number(value || 0) * 100)}%`, name]
                            }
                            return [value, name]
                          }}
                        />
                        <Legend wrapperStyle={{ color: '#cbd5e1' }} />
                        <Bar yAxisId="count" dataKey="leads" name="Leads" fill="#a78bfa" radius={[6, 6, 0, 0]} />
                        <Bar yAxisId="count" dataKey="tours" name="Tours" fill="#818cf8" radius={[6, 6, 0, 0]} />
                        <Bar yAxisId="count" dataKey="registered" name="Registrations" fill="#d946ef" radius={[6, 6, 0, 0]} />
                        <Line yAxisId="rate" type="monotone" dataKey="touringRate" name="Touring Rate" stroke="#f59e0b" strokeWidth={2} dot={false} />
                        <Line yAxisId="rate" type="monotone" dataKey="closeRate" name="Close Rate" stroke="#22d3ee" strokeWidth={2} dot={false} />
                        <Line yAxisId="rate" type="monotone" dataKey="conversionRate" name="Conversion Rate" stroke="#34d399" strokeWidth={2} dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {leadLocations.map(([locationName, rows]) => (
                  <div key={locationName}>
                    <div className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-violet-300">{locationName}</div>
                    <div className="overflow-x-auto rounded-2xl border border-[var(--brand-border)]">
                      <table className="min-w-full divide-y divide-[var(--brand-border)] text-left text-sm">
                        <thead className="bg-black/30 text-gray-400">
                          <tr>
                            <th className="px-4 py-3 font-medium">Month</th>
                            <th className="px-4 py-3 font-medium">Leads</th>
                            <th className="px-4 py-3 font-medium">Tours</th>
                            <th className="px-4 py-3 font-medium">Registrations</th>
                            <th className="px-4 py-3 font-medium">Touring Rate</th>
                            <th className="px-4 py-3 font-medium">Close Rate</th>
                            <th className="px-4 py-3 font-medium">Conversion Rate</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--brand-border)] bg-black/10">
                          {rows.map((row) => (
                            <tr key={row.id}>
                              <td className="px-4 py-4 text-white">{formatMonth(row.month)}</td>
                              <td className="px-4 py-4 text-violet-200">{row.leads}</td>
                              <td className="px-4 py-4 text-indigo-200">{row.tours}</td>
                              <td className="px-4 py-4 text-fuchsia-200">{row.registered}</td>
                              <td className="px-4 py-4 text-gray-200">{formatPercent(row.leadToTour)}</td>
                              <td className="px-4 py-4 text-gray-200">{formatPercent(row.tourToReg)}</td>
                              <td className="px-4 py-4 text-gray-200">{formatPercent(row.leadToReg)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard eyebrow="Portfolio performance" title="Google Analytics + Google Ads">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard label="GA Sessions (30d)" value={formatNumber(gaMetrics?.sessions)} />
              <StatCard label="Active Users (30d)" value={formatNumber(gaMetrics?.activeUsers)} />
              <StatCard label="Avg CPC (this month)" value={thisMonthAvgCpc == null ? '-' : `$${thisMonthAvgCpc.toFixed(2)}`} />
              <StatCard label="Impressions (this month)" value={formatNumber(monthlySummary?.ads?.thisMonth?.impressions)} />
            </div>
            <div className="mt-4 rounded-2xl border border-[var(--brand-border)] bg-black/20 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Performance story</div>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-200">
                {analyticsStory.map((line, idx) => <li key={`${idx}-${line.slice(0, 16)}`}>{line}</li>)}
              </ul>
            </div>
            <div className="mt-5 rounded-2xl border border-[var(--brand-border)] bg-black/20 p-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Google Ads trend (Avg CPC, Clicks, Impressions)</div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={adsMonthlyChartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.16)" />
                    <XAxis dataKey="monthLabel" tick={{ fill: '#c4b5fd', fontSize: 12 }} />
                    <YAxis yAxisId="volume" tick={{ fill: '#cbd5e1', fontSize: 12 }} />
                    <YAxis yAxisId="cpc" orientation="right" tickFormatter={(v) => `$${Number(v || 0).toFixed(2)}`} tick={{ fill: '#fcd34d', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ background: '#111827', border: '1px solid rgba(139, 92, 246, 0.35)', borderRadius: 12, color: '#f8fafc' }}
                      labelStyle={{ color: '#c4b5fd' }}
                      formatter={(value, name) => String(name).includes('Avg CPC') ? [`$${Number(value || 0).toFixed(2)}`, name] : [value, name]}
                    />
                    <Legend wrapperStyle={{ color: '#cbd5e1' }} />
                    <Bar yAxisId="volume" dataKey="clicks" name="Clicks" fill="#22d3ee" radius={[6, 6, 0, 0]} />
                    <Bar yAxisId="volume" dataKey="impressions" name="Impressions" fill="#818cf8" radius={[6, 6, 0, 0]} />
                    <Line yAxisId="cpc" type="monotone" dataKey="avgCpc" name="Avg CPC" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {activeTab === 'finance' && (
        <div className="space-y-6">
          <SectionCard eyebrow="Agreements & Finance" title="Agreements">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <StatCard label="Contract type" value={contract ? `${contract.contractType} - ${contract.programLevel}` : 'Blueprint'} />
                <StatCard label="Signed date" value={formatDate(contract?.signedAt)} />
                <StatCard label="Term" value={contract?.termMonths ? `${contract.termMonths} months` : '-'} />
                <StatCard label="Cancellation" value={contract?.cancellationNoticeDays ? `${contract.cancellationNoticeDays}-day notice` : '-'} />
              </div>
              <a href={contract?.pdfPath || '/contracts/IGK-BONMM-6XGJS-FYREN-CBCT5.pdf'} target="_blank" rel="noreferrer" className="inline-flex rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-200 transition hover:border-violet-400/50 hover:text-white">Download contract PDF ↗</a>
            </div>
          </SectionCard>

          <SectionCard eyebrow="Agreements & Finance" title="Payments & billing history">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Current MRR" value={formatCurrency(stripe?.mrr || 0)} />
              <StatCard label="Status" value={String(stripe?.status || 'active').replace(/^./, (m) => m.toUpperCase())} />
              <StatCard label="Customer Since" value={formatDate(stripe?.createdAt)} />
              <StatCard label="Stripe Customer" value={clientInfo.stripeCustomerId || '-'} />
            </div>
            <div className="mt-4 rounded-2xl border border-[var(--brand-border)] bg-black/20 p-4 text-sm text-gray-300">
              Payment event-by-event history is the next wire-up (invoice/charge timeline). For now this tab shows current billing state and contract linkage.
            </div>
          </SectionCard>
        </div>
      )}

      {activeTab === 'comms' && (
        <div className="space-y-6">
          <SectionCard eyebrow="Communications" title="Meetings & recording links">
            <CallList calls={data?.salesCalls || []} emptyText="No Zoom calls found for this client yet." />
          </SectionCard>

          <SectionCard
            eyebrow="Communications"
            title="Zendesk tickets"
            action={
              <div className="flex flex-wrap gap-2">
                {['all', 'open', 'pending', 'closed'].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setTicketFilter(filter)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${ticketFilter === filter ? 'border-violet-500/40 bg-violet-500/15 text-violet-100' : 'border-[var(--brand-border)] bg-black/20 text-gray-300 hover:text-white'}`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            }
          >
            {!filteredTickets.length ? (
              <EmptyState>No Zendesk tickets matched this filter.</EmptyState>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-[var(--brand-border)]">
                <table className="min-w-full divide-y divide-[var(--brand-border)] text-left text-sm">
                  <thead className="bg-black/30 text-gray-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Subject</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Days open</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--brand-border)] bg-black/10">
                    {filteredTickets.map((ticket) => {
                      const overdue = ticket.status !== 'closed' && ticket.daysOpen > 14
                      return (
                        <tr key={ticket.id} className={overdue ? 'bg-rose-500/5' : ''}>
                          <td className="px-4 py-4 text-gray-300">{formatDate(ticket.createdAt)}</td>
                          <td className="px-4 py-4 text-white">
                            <a href={ticket.url} target="_blank" rel="noreferrer" className="hover:text-violet-200">{ticket.subject}</a>
                          </td>
                          <td className="px-4 py-4"><span className={`rounded-full border px-2.5 py-1 text-xs font-medium uppercase ${classForTicketStatus(ticket.statusColor)}`}>{ticket.status}</span></td>
                          <td className={`px-4 py-4 ${overdue ? 'font-semibold text-rose-200' : 'text-gray-300'}`}>{ticket.daysOpen}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <SectionCard
            eyebrow="Communications"
            title="Transcript Q&A"
            action={
              <div className="flex w-full max-w-2xl gap-3">
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') runSearch() }}
                  placeholder="Ask anything about this client..."
                  className="w-full rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-violet-500/50"
                />
                <button onClick={runSearch} disabled={searching || !searchQuery.trim()} className="rounded-2xl bg-[var(--brand-primary-2)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-primary-3)] disabled:cursor-not-allowed disabled:opacity-50">{searching ? 'Searching…' : 'Search'}</button>
              </div>
            }
          >
            {!searchResults.length ? (
              <EmptyState>Search /api/clients/{acronym}/search?q=... for exact quotes, timestamps, and call links.</EmptyState>
            ) : (
              <div className="space-y-4">
                {searchResults.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-[var(--brand-border)] bg-black/20 p-5">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-violet-200">{item.speaker || 'Unknown speaker'}</span>
                      <span className="rounded-full border border-[var(--brand-border)] bg-black/30 px-2.5 py-1 text-gray-300">{formatDate(item.callDate)}</span>
                      <span className="rounded-full border border-[var(--brand-border)] bg-black/30 px-2.5 py-1 text-gray-300">{item.repName || 'Unknown rep'}</span>
                      <span className="rounded-full border border-[var(--brand-border)] bg-black/30 px-2.5 py-1 text-gray-300">{formatTimestamp(item.startMs)}</span>
                    </div>
                    <div className="mt-3 text-sm leading-7 text-gray-200">"{item.text}"</div>
                    <div className="mt-4 flex flex-wrap gap-4 text-sm">
                      {item.callLink ? <a href={item.callLink} target="_blank" rel="noreferrer" className="font-medium text-violet-300 hover:text-violet-200">Open recording ↗</a> : null}
                      {item.meetingTopic ? <span className="text-gray-500">{item.meetingTopic}</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      )}
    </div>
  )
}
