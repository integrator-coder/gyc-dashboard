'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'

// ── Helpers ─────────────────────────────────────────────────

function formatUpdated(isoStr) {
  if (!isoStr) return ''
  const diff = Math.floor((Date.now() - new Date(isoStr)) / 60000)
  if (diff < 1) return 'just now'
  if (diff === 1) return '1 min ago'
  return `${diff} min ago`
}

function formatHours(hours) {
  if (hours == null || hours === 0) return '—'
  if (hours >= 48) return `${(hours / 24).toFixed(1)}d`
  if (hours >= 1) return `${hours.toFixed(1)}h`
  return `${Math.round(hours * 60)}m`
}

function monthLabel(ym) {
  const [year, mon] = ym.split('-')
  const d = new Date(parseInt(year), parseInt(mon) - 1, 1)
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

function statusColor(status) {
  switch (status) {
    case 'new':     return 'bg-blue-900 text-blue-300'
    case 'open':    return 'bg-teal-900 text-teal-300'
    case 'pending': return 'bg-amber-900 text-amber-300'
    case 'hold':    return 'bg-gray-700 text-gray-300'
    default:        return 'bg-gray-800 text-gray-400'
  }
}

// ── KPI Card ─────────────────────────────────────────────────

function KpiCard({ label, value, sub, color = 'text-white' }) {
  return (
    <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
      <p className="text-gray-300 text-xs font-medium uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-gray-300 text-xs mt-1">{sub}</p>}
    </div>
  )
}

// ── Custom Tooltip ────────────────────────────────────────────

function ChartTooltip({ active, payload, label, suffix = '' }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm">
      <p className="text-gray-300 font-medium">{label}</p>
      <p className="text-teal-400 font-bold">{payload[0].value}{suffix}</p>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────

export default function HelpdeskPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true)
    try {
      const res = await fetch('/api/metrics/helpdesk')
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchData])

  // ── Loading state ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading helpdesk data…</p>
          <p className="text-gray-300 text-xs mt-1">Querying Zendesk — this may take ~30s</p>
        </div>
      </div>
    )
  }

  // ── Error state ────────────────────────────────────────────
  if (error) {
    return (
      <div className="max-w-2xl mx-auto mt-10">
        <div className="bg-red-950 border border-red-800 rounded-lg px-4 py-3 text-red-300 text-sm">
          ⚠️ Error loading helpdesk data: {error}
        </div>
        <button
          onClick={() => fetchData(true)}
          className="mt-3 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg border border-gray-700"
        >
          ↻ Retry
        </button>
      </div>
    )
  }

  const {
    queue = {},
    resolutionTime = {},
    monthlyVolume = [],
    byAssignee = [],
    recentTickets = [],
    updatedAt,
  } = data || {}

  // Monthly chart data with labels
  const monthlyChartData = monthlyVolume.map(m => ({
    ...m,
    label: monthLabel(m.month),
  }))

  // Assignee chart — sorted desc, highlight highest
  const sortedAssignees = [...byAssignee].sort((a, b) => b.openCount - a.openCount)
  const maxAssigneeCount = sortedAssignees[0]?.openCount || 1
  const topAssignee = sortedAssignees[0]?.name

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">🌐 Website Helpdesk</h1>
          <p className="text-gray-300 text-sm mt-0.5">
            {updatedAt ? `Updated ${formatUpdated(updatedAt)}` : 'Loading…'}
            {' · '}
            <span className="text-gray-400">Zendesk · tag: website_helpdesk</span>
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 text-sm font-medium rounded-lg transition-colors border border-gray-700"
        >
          <span className={refreshing ? 'animate-spin' : ''}>↻</span>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────── */}
      <section>
        <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-3">
          Queue Overview
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KpiCard
            label="Open Helpdesk Tickets"
            value={queue.total ?? '—'}
            sub={`${queue.new ?? 0}n · ${queue.open ?? 0}o · ${queue.pending ?? 0}p`}
            color={
              queue.total > 50
                ? 'text-red-400'
                : queue.total > 20
                ? 'text-amber-400'
                : 'text-teal-400'
            }
          />
          <KpiCard
            label="New (Unworked)"
            value={queue.new ?? '—'}
            sub="status: new"
            color={
              queue.new > 20
                ? 'text-red-400'
                : queue.new > 10
                ? 'text-amber-400'
                : 'text-white'
            }
          />
          <KpiCard
            label="Avg Resolution Time"
            value={formatHours(resolutionTime.mean)}
            sub={`${resolutionTime.sampleSize ?? 0} closed tickets sampled`}
            color="text-teal-400"
          />
          <KpiCard
            label="Median Resolution Time"
            value={formatHours(resolutionTime.median)}
            sub="50th percentile"
            color="text-teal-400"
          />
        </div>
      </section>

      {/* ── Monthly Volume Chart ─────────────────────────────── */}
      {monthlyChartData.length > 0 && (
        <section>
          <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-3">
            Monthly Ticket Volume — Last 12 Months
          </h2>
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={monthlyChartData}
                margin={{ top: 4, right: 8, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  axisLine={{ stroke: '#374151' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  axisLine={{ stroke: '#374151' }}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    return (
                      <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm">
                        <p className="text-gray-300 font-medium">{label}</p>
                        <p className="text-teal-400 font-bold">{payload[0].value} tickets</p>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {monthlyChartData.map((entry, i) => {
                    const isLatest = i === monthlyChartData.length - 1
                    return (
                      <Cell
                        key={`mv-${i}`}
                        fill={isLatest ? '#14b8a6' : '#0f766e'}
                        opacity={isLatest ? 1 : 0.75}
                      />
                    )
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* ── Resolution Time Breakdown + By Assignee ──────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Resolution Time Stats */}
        <section>
          <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-3">
            Resolution Time Breakdown
          </h2>
          <div className="space-y-3">
            {[
              { label: 'Mean (Avg)', value: resolutionTime.mean, color: 'text-teal-400' },
              { label: 'Median (50th pct)', value: resolutionTime.median, color: 'text-teal-400' },
              { label: 'Mode (Most Common)', value: resolutionTime.mode, color: 'text-teal-300' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-gray-900 rounded-xl p-5 border border-gray-800 flex items-center justify-between">
                <div>
                  <p className="text-gray-300 text-xs font-medium uppercase tracking-wider">{label}</p>
                  {label.includes('Mean') && (
                    <p className="text-gray-300 text-xs mt-0.5">n={resolutionTime.sampleSize ?? 0} closed tickets</p>
                  )}
                </div>
                <p className={`text-3xl font-bold ${color}`}>{formatHours(value)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* By Growth Advisor */}
        <section>
          <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-3">
            Open Tickets by Growth Advisor
          </h2>
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            {sortedAssignees.length > 0 ? (
              <div className="space-y-4">
                {sortedAssignees.map(({ name, openCount }) => {
                  const pct = maxAssigneeCount > 0 ? (openCount / maxAssigneeCount) * 100 : 0
                  const isTop = name === topAssignee && openCount > 0
                  const barColor = isTop ? '#f59e0b' : openCount > 15 ? '#ef4444' : '#14b8a6'
                  const textColor = isTop ? 'text-amber-400' : openCount > 15 ? 'text-red-400' : 'text-teal-400'
                  return (
                    <div key={name}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            isTop ? 'bg-amber-900 text-amber-300' : 'bg-teal-900 text-teal-300'
                          }`}>
                            {name[0]}
                          </span>
                          <span className="text-white text-sm font-medium">{name}</span>
                          {isTop && openCount > 0 && (
                            <span className="text-amber-500 text-xs">↑ highest</span>
                          )}
                        </div>
                        <span className={`text-sm font-bold ${textColor}`}>{openCount}</span>
                      </div>
                      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: barColor }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-gray-300 text-sm text-center py-8">No assignee data available</p>
            )}
          </div>
        </section>
      </div>

      {/* ── Recent Open Tickets ──────────────────────────────── */}
      <section>
        <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-3">
          Recent Open Tickets
        </h2>
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          {recentTickets.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left px-4 py-3 text-gray-300 text-xs uppercase tracking-wider w-20">ID</th>
                    <th className="text-left px-4 py-3 text-gray-300 text-xs uppercase tracking-wider">Subject</th>
                    <th className="text-left px-4 py-3 text-gray-300 text-xs uppercase tracking-wider w-24">Status</th>
                    <th className="text-left px-4 py-3 text-gray-300 text-xs uppercase tracking-wider w-28">Created</th>
                    <th className="text-left px-4 py-3 text-gray-300 text-xs uppercase tracking-wider w-36">Assignee</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTickets.map((ticket, i) => (
                    <tr
                      key={ticket.id}
                      className={`border-b border-gray-800 last:border-0 hover:bg-gray-800/40 transition-colors ${
                        i % 2 === 0 ? '' : 'bg-gray-900/60'
                      }`}
                    >
                      <td className="px-4 py-3 text-gray-300 font-mono text-xs">
                        <a
                          href={`https://gycawesome.zendesk.com/agent/tickets/${ticket.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-teal-500 hover:text-teal-400 hover:underline"
                        >
                          #{ticket.id}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-gray-200 max-w-xs">
                        <span title={ticket.subject}>
                          {ticket.subject.length > 60
                            ? ticket.subject.slice(0, 60) + '…'
                            : ticket.subject}
                        </span>
                        {ticket.requester && ticket.requester !== `#${ticket.id}` && (
                          <p className="text-gray-300 text-xs mt-0.5">{ticket.requester}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${statusColor(ticket.status)}`}>
                          {ticket.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{ticket.createdAt}</td>
                      <td className="px-4 py-3 text-gray-300 text-xs">
                        {ticket.assignee === 'Unassigned' ? (
                          <span className="text-gray-300 italic">Unassigned</span>
                        ) : (
                          ticket.assignee
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-5 py-10 text-center text-gray-300 text-sm">
              No open tickets found
            </div>
          )}
        </div>
      </section>

    </div>
  )
}
