'use client'

import { useEffect, useState, useCallback } from 'react'
import ProductionPipeline from '@/components/ProductionPipeline'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

function formatUpdated(isoStr) {
  if (!isoStr) return ''
  const diff = Math.floor((Date.now() - new Date(isoStr)) / 60000)
  if (diff < 1) return 'just now'
  if (diff === 1) return '1 min ago'
  return `${diff} min ago`
}

function formatMetricValue(value, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(value)) return 'N/A'
  return `${value}${suffix}`
}

function ProductionMetricCard({ title, value, subtitle, accent = '#AE2BCF', valueClass = 'text-white', children }) {
  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
      <div className="w-10 h-1 rounded-full mb-3" style={{ backgroundColor: accent }} />
      <p className="text-gray-300 text-xs font-medium uppercase tracking-wider mb-2">{title}</p>
      <p className={`text-3xl font-bold ${valueClass}`}>{value}</p>
      {subtitle && <p className="text-gray-300 text-xs mt-1">{subtitle}</p>}
      {children}
    </div>
  )
}

function StageNode({ label, value, accent = '#AE2BCF', danger = false }) {
  return (
    <div
      className={`rounded-xl px-4 py-4 min-w-[132px] ${danger ? 'border-red-800 bg-red-950/40' : ''}`}
      style={danger ? undefined : { backgroundColor: '#111111', border: '1px solid #2a1a3e' }}
    >
      <p className={`text-xs font-semibold uppercase tracking-widest mb-2 ${danger ? 'text-red-300' : 'text-gray-300'}`}>
        {label}
      </p>
      <div className="flex items-end justify-between gap-3">
        <p className={`text-3xl font-bold ${danger ? 'text-red-300' : 'text-white'}`}>{value}</p>
        <div className="w-8 h-1 rounded-full" style={{ backgroundColor: danger ? '#ef4444' : accent }} />
      </div>
    </div>
  )
}

function SectionDivider() {
  return (
    <div className="my-10">
      <div style={{
        height: 2,
        background: 'linear-gradient(to right, transparent, #731494 15%, #AE2BCF 50%, #731494 85%, transparent)',
        boxShadow: '0 0 16px rgba(174,43,207,0.5), 0 0 40px rgba(174,43,207,0.2)',
      }} />
    </div>
  )
}

function SectionShell({ title, subtitle, children, divider = true }) {
  return (
    <section>
      {divider && <SectionDivider />}
      <div className="flex items-end justify-between gap-4 mb-3 mt-4">
        <div>
          <h2 className="text-gray-200 text-lg font-semibold">{title}</h2>
          {subtitle && <p className="text-gray-300 text-sm mt-1">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

function HistoryTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border border-[#2a1a3e] bg-[#0b0b0f] px-3 py-2 shadow-xl">
      <p className="text-sm font-semibold text-white mb-1">{label}</p>
      {payload.map(item => (
        <p key={item.dataKey} className="text-xs" style={{ color: item.color }}>
          {item.name}: {item.value ?? 0}
        </p>
      ))}
    </div>
  )
}

export default function ProductionPage() {
  const [productionData, setProductionData] = useState(null)
  const [historyData, setHistoryData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [asanaHistory, setAsanaHistory] = useState(null)
  const [asanaDays, setAsanaDays] = useState(30)

  const fetchData = useCallback(async () => {
    try {
      const [productionRes, historyRes] = await Promise.all([
        fetch('/api/metrics/production-snapshot'),
        fetch('/api/metrics/production-history'),
      ])

      const [productionJson, historyJson] = await Promise.all([
        productionRes.json(),
        historyRes.json(),
      ])

      if (!productionRes.ok || productionJson.error) {
        throw new Error(productionJson.error || 'Failed to load production metrics')
      }

      if (!historyRes.ok || historyJson.error) {
        throw new Error(historyJson.error || 'Failed to load production history')
      }

      setProductionData(productionJson)
      setHistoryData(historyJson)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchData])

  useEffect(() => {
    fetch(`/api/metrics/asana-workload-history?days=${asanaDays}`)
      .then(r => r.json())
      .then(d => setAsanaHistory(d))
      .catch(() => {})
  }, [asanaDays])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-[#AE2BCF] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading Production data…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto mt-10">
        <div className="bg-red-950 border border-red-800 rounded-lg px-4 py-3 text-red-300 text-sm">
          ⚠️ Error loading Production data: {error}
        </div>
      </div>
    )
  }

  const {
    projectsInProduction = 0,
    stageBreakdown = {},
    overdueCount = 0,
    typeBreakdown = {},
    onTimeCount = 0,
    lateCount = 0,
    onTimePct = 0,
    avgBuildTimeDays = 0,
    avgClientApprovalDays = 0,
    clientApprovalQueue = [],
    seoInProduction = 0,
    seoStageBreakdown = {},
    seoOverdueCount = 0,
    blockedProjects = [],
    updatedAt: productionUpdatedAt,
  } = productionData || {}

  const {
    trailing30 = { total: 0, onTime: 0, late: 0, onTimePct: 0, clientDelayPct: 0, internalDelayPct: 0 },
    monthlyHistory = [],
    quarterlyHistory = [],
    allTime = {
      total: 0,
      onTimePct: 0,
      avgTimelineScore: 0,
      byType: { landingPage: 0, quickLaunch: 0, fullLaunch: 0 },
    },
    lastUpdated: historyUpdatedAt,
  } = historyData || {}

  const webBlockedCount = stageBreakdown.blocked || 0
  const seoBlockedCount = seoStageBreakdown.blocked || 0
  const onTimeTextColor = onTimePct >= 80 ? 'text-green-400' : onTimePct >= 60 ? 'text-yellow-400' : 'text-red-400'
  const historyOnTimeColor = trailing30.onTimePct >= 80 ? 'text-green-400' : trailing30.onTimePct >= 60 ? 'text-yellow-400' : 'text-red-400'

  const monthlyTrendData = monthlyHistory.map(entry => ({
    label: entry.month,
    onTime: entry.onTime,
    late: entry.late,
    ahead: entry.ahead,
  }))

  const lastUpdated = historyUpdatedAt || productionUpdatedAt

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Production</h1>
          <p className="text-gray-300 text-sm mt-0.5">
            {lastUpdated ? `Updated ${formatUpdated(lastUpdated)}` : 'Loading…'}
          </p>
          {productionData?.snapshot?.asOf && (
            <p className="text-xs text-gray-300 mt-1">Data as of {new Date(productionData.snapshot.asOf).toLocaleString()} · {productionData.snapshot.source}</p>
          )}
        </div>
        <button
          onClick={() => {
            setLoading(true)
            fetchData()
          }}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors border border-gray-700"
        >
          ↻ Refresh
        </button>
      </div>

      {/* ── Asana Workload Trends ──────────────────────────────────────── */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-white text-lg font-semibold">Asana Workload Trends</h2>
            <p className="text-gray-400 text-xs mt-0.5">Daily snapshots across 40 staff members</p>
          </div>
          <div className="flex gap-2">
            {[14, 30, 60, 90].map(d => (
              <button
                key={d}
                onClick={() => setAsanaDays(d)}
                className="text-xs px-3 py-1 rounded-full border transition-colors"
                style={{
                  borderColor: asanaDays === d ? '#AE2BCF' : '#2a1a3e',
                  background: asanaDays === d ? '#2d0a3e' : 'transparent',
                  color: asanaDays === d ? '#e879f9' : '#9ca3af',
                }}
              >{d}d</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Chart 1: Task Health — Open, Overdue, Due Soon */}
          <div className="rounded-xl p-5" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
            <p className="text-gray-300 text-xs font-semibold uppercase tracking-wider mb-4">Task Health</p>
            {!asanaHistory ? (
              <div className="h-48 flex items-center justify-center text-gray-600 text-xs">Loading…</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={asanaHistory.data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2e" />
                  <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#18102a', border: '1px solid #3b2060', borderRadius: 8, fontSize: 11 }}
                    labelStyle={{ color: '#c4b5fd' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
                  <Line type="monotone" dataKey="totalOpen" name="Open" stroke="#7c3aed" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="totalOverdue" name="Overdue" stroke="#ef4444" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="dueSoon" name="Due Soon" stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Chart 2: Throughput — Completed This Week */}
          <div className="rounded-xl p-5" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
            <p className="text-gray-300 text-xs font-semibold uppercase tracking-wider mb-4">Weekly Throughput</p>
            {!asanaHistory ? (
              <div className="h-48 flex items-center justify-center text-gray-600 text-xs">Loading…</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={asanaHistory.data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2e" />
                  <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#18102a', border: '1px solid #3b2060', borderRadius: 8, fontSize: 11 }}
                    labelStyle={{ color: '#c4b5fd' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
                  <Bar dataKey="completedThisWeek" name="Completed This Week" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="dueSoon" name="Due Soon" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Summary stat row */}
        {asanaHistory?.data?.length > 0 && (() => {
          const latest = asanaHistory.data[asanaHistory.data.length - 1]
          const first = asanaHistory.data[0]
          const overdueChange = latest.totalOverdue - first.totalOverdue
          const openChange = latest.totalOpen - first.totalOpen
          return (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              {[
                { label: 'Open Tasks', value: latest.totalOpen, change: openChange, suffix: '' },
                { label: 'Overdue', value: latest.totalOverdue, change: overdueChange, suffix: '', danger: true },
                { label: 'Due Soon', value: latest.dueSoon, change: null, suffix: '' },
                { label: 'Completed / Week', value: latest.completedThisWeek, change: null, suffix: '' },
              ].map(({ label, value, change, suffix, danger }) => (
                <div key={label} className="rounded-lg px-4 py-3" style={{ backgroundColor: '#0a0a0a', border: '1px solid #1f1535' }}>
                  <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">{label}</p>
                  <p className="text-white text-xl font-bold">{value}{suffix}</p>
                  {change !== null && (
                    <p className={`text-xs mt-0.5 ${change > 0 ? (danger ? 'text-red-400' : 'text-purple-400') : 'text-green-400'}`}>
                      {change > 0 ? `▲ +${change}` : `▼ ${change}`} vs {asanaDays}d ago
                    </p>
                  )}
                </div>
              ))}
            </div>
          )
        })()}
      </section>

      <SectionShell title="WEB Builds" subtitle="Active web builds — delivery health and project pipeline." divider={false}>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
          <ProductionMetricCard
            title="Projects In Production"
            value={projectsInProduction}
            subtitle="Active WEB projects not launched, approved, or completed"
          />
          <ProductionMetricCard
            title="On-Time %"
            value={`${onTimePct}%`}
            subtitle={`${onTimeCount} on time · ${lateCount} late`}
            accent="#22c55e"
            valueClass={onTimeTextColor}
          />
          <ProductionMetricCard
            title="Avg Build Time"
            value={`${avgBuildTimeDays} days`}
            subtitle="Average across completed web builds in the last 90 days"
            accent="#732FBA"
          />
          <ProductionMetricCard
            title="Overdue Count"
            value={overdueCount}
            subtitle="Past due and not yet in client approval"
            accent={overdueCount > 0 ? '#ef4444' : '#AE2BCF'}
            valueClass={overdueCount > 0 ? 'text-red-400' : 'text-white'}
          />
        </div>

        <div className="rounded-xl p-5 mb-4" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
          <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
            <div>
              <h3 className="text-white font-semibold">Stage Pipeline</h3>
              <p className="text-gray-300 text-sm mt-1">Copy → Image Selection → Design → FL Build → QC → Client Approval, with blocked work called out separately.</p>
            </div>
            <div className="rounded-full px-3 py-1 text-xs font-semibold border border-red-800 bg-red-950 text-red-300">
              Blocked: {webBlockedCount}
            </div>
          </div>

          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-3 text-gray-300">
              <StageNode label="Copy" value={stageBreakdown.copy || 0} accent="#A855F7" />
              <span className="text-2xl text-gray-200">→</span>
              <StageNode label="Image Selection" value={stageBreakdown.imageSelection || 0} accent="#9333EA" />
              <span className="text-2xl text-gray-200">→</span>
              <StageNode label="Design" value={stageBreakdown.design || 0} accent="#8B5CF6" />
              <span className="text-2xl text-gray-200">→</span>
              <StageNode label="FL Build" value={stageBreakdown.build || 0} accent="#7C3AED" />
              <span className="text-2xl text-gray-200">→</span>
              <StageNode label="QC" value={stageBreakdown.qc || 0} accent="#6D28D9" />
              <span className="text-2xl text-gray-200">→</span>
              <StageNode label="Client Approval" value={stageBreakdown.clientApproval || 0} accent="#22c55e" />
            </div>
            <div className="xl:min-w-[160px]">
              <StageNode label="Blocked" value={webBlockedCount} danger />
            </div>
          </div>

          {(stageBreakdown.other || 0) > 0 && (
            <p className="text-sm text-gray-300 mt-4">Other WEB stage values: {stageBreakdown.other}</p>
          )}
        </div>

        <div className="rounded-xl p-5" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
          <h3 className="text-white font-semibold mb-4">Website Type Breakdown</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <ProductionMetricCard title="Website" value={typeBreakdown.website || 0} accent="#A855F7" />
            <ProductionMetricCard title="Redesign" value={typeBreakdown.redesign || 0} accent="#8B5CF6" />
            <ProductionMetricCard title="Mobile-rich Website" value={typeBreakdown.mobileRich || 0} accent="#7C3AED" />
            <ProductionMetricCard title="Other" value={typeBreakdown.other || 0} accent="#4C1D95" />
          </div>
        </div>

        <div className="mt-4">
          <h3 className="text-white font-semibold mb-3">⏳ Client Approval Queue</h3>
          <div className="mb-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg" style={{ backgroundColor: avgClientApprovalDays > 30 ? '#450a0a' : '#1a0a2e', border: `1px solid ${avgClientApprovalDays > 30 ? '#991b1b' : '#3b1d8a'}` }}>
              <span className="text-sm text-gray-400">Avg time in Client Approval:</span>
              <span className={`text-lg font-bold ${avgClientApprovalDays > 30 ? 'text-red-400' : avgClientApprovalDays > 14 ? 'text-yellow-400' : 'text-green-400'}`}>
                {avgClientApprovalDays} days
              </span>
            </div>
          </div>
          {clientApprovalQueue.length === 0 ? (
            <p className="text-gray-300 text-sm">No projects in Client Approval.</p>
          ) : (
            <div className="space-y-2">
              {clientApprovalQueue.map((project, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3 rounded-lg" style={{ backgroundColor: '#0a0a0a', border: '1px solid #1f1f3a' }}>
                  <span className="text-sm text-white">{project.name}</span>
                  <div className="flex items-center gap-4">
                    {project.dueDate && <span className="text-xs text-gray-300">Due: {project.dueDate}</span>}
                    <span className={`text-sm font-semibold ${(project.daysWaiting || 0) > 60 ? 'text-red-400' : (project.daysWaiting || 0) > 30 ? 'text-yellow-400' : 'text-gray-300'}`}>
                      {project.daysWaiting != null ? `${project.daysWaiting}d` : '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <ProductionPipeline dept="WEB" />
      </SectionShell>

      <SectionShell title="SEO" subtitle="Active SEO projects — stage breakdown and project pipeline.">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <ProductionMetricCard
            title="SEO In Production"
            value={seoInProduction}
            subtitle="Active SEO projects in the Asana portfolio"
          />
          <ProductionMetricCard
            title="Blocked SEO"
            value={seoBlockedCount}
            subtitle="SEO projects currently marked blocked"
            accent={seoBlockedCount > 0 ? '#ef4444' : '#AE2BCF'}
            valueClass={seoBlockedCount > 0 ? 'text-red-400' : 'text-white'}
          />
          <ProductionMetricCard
            title="Overdue SEO"
            value={seoOverdueCount}
            subtitle="SEO projects past due date"
            accent={seoOverdueCount > 0 ? '#ef4444' : '#AE2BCF'}
            valueClass={seoOverdueCount > 0 ? 'text-red-400' : 'text-white'}
          />
        </div>

        <div className="rounded-xl p-5" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
          <h3 className="text-white font-semibold mb-4">SEO Stage Breakdown</h3>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3 text-gray-300">
              <StageNode label="Set Up" value={seoStageBreakdown.setUp || 0} accent="#A855F7" />
              <span className="text-2xl text-gray-200">→</span>
              <StageNode label="Delivery" value={seoStageBreakdown.delivery || 0} accent="#22c55e" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:min-w-[320px]">
              <StageNode label="Blocked" value={seoBlockedCount} danger />
              <StageNode label="Other" value={seoStageBreakdown.other || 0} accent="#4C1D95" />
            </div>
          </div>
        </div>

        <ProductionPipeline dept="SEO" />
      </SectionShell>

      <SectionShell title="CRM Builds" subtitle="Active CRM onboarding and build projects — stage breakdown and project pipeline.">
        <ProductionPipeline dept="CRM" />
      </SectionShell>

      <SectionShell title="Blocked Projects" subtitle="Anything stalled in production across WEB and SEO.">
        <div className="rounded-xl p-5 border border-red-900 bg-red-950/30">
          {blockedProjects.length === 0 ? (
            <p className="text-green-300 font-medium">No blocked projects ✅</p>
          ) : (
            <div className="space-y-3">
              {blockedProjects.map(project => (
                <div
                  key={`${project.department}-${project.name}`}
                  className="rounded-lg border border-red-900 bg-black/20 px-4 py-4 flex flex-col gap-2"
                >
                  {/* Header row */}
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {project.escalation && (
                        <span className="text-base" title="Escalated">{project.escalation}</span>
                      )}
                      <p className="text-white font-semibold">{project.name}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-950 text-red-400 border border-red-800">
                        {project.department}
                      </span>
                      {project.ga && (
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#1a1a2e', color: '#9ca3af', border: '1px solid #2a1a3e' }}>
                          GA: {project.ga}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-red-100/90 md:text-right shrink-0">
                      <p>{project.daysPastDue === null ? 'no due date' : `${project.daysPastDue}d past due`}</p>
                      {project.dueDate && <p className="text-red-300/70 text-xs">{project.dueDate}</p>}
                    </div>
                  </div>
                  {/* Reason row */}
                  {(project.status || project.notes) && (
                    <div className="flex flex-col gap-1 pl-1">
                      {project.status && (
                        <p className="text-sm font-medium" style={{ color: '#fca5a5' }}>
                          {project.status}
                        </p>
                      )}
                      {project.notes && (
                        <p className="text-sm text-gray-400 italic">
                          {project.notes}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionShell>

      <SectionShell title="📈 Production History" subtitle="Lada's scorecard history from the WEB sheet — trailing 30-day performance, monthly trend, quarterly rollup, and all-time mix.">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
          <ProductionMetricCard
            title="Builds (Trailing 30d)"
            value={trailing30.total || 0}
            subtitle={`${trailing30.onTime || 0} on time or ahead · ${trailing30.late || 0} late`}
            accent="#A855F7"
          />
          <ProductionMetricCard
            title="On-Time % (Trailing 30d)"
            value={formatMetricValue(trailing30.onTimePct, '%')}
            subtitle="On time + ahead, based on go-live history"
            accent="#22c55e"
            valueClass={historyOnTimeColor}
          />
          <ProductionMetricCard
            title="Client Delay %"
            value={formatMetricValue(trailing30.clientDelayPct, '%')}
            subtitle="Share of late builds tagged Client"
            accent="#F59E0B"
            valueClass="text-yellow-300"
          />
          <ProductionMetricCard
            title="Internal Delay %"
            value={formatMetricValue(trailing30.internalDelayPct, '%')}
            subtitle="Share of late builds tagged Internal"
            accent="#EF4444"
            valueClass="text-red-400"
          />
        </div>

        <div className="rounded-xl p-5 mb-4" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
          <div className="mb-4">
            <h3 className="text-white font-semibold">Monthly Trend</h3>
            <p className="text-gray-300 text-sm mt-1">Go-live volume by month from the production scorecard.</p>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrendData} barGap={8}>
                <CartesianGrid stroke="#221530" strokeDasharray="3 3" />
                <XAxis dataKey="label" stroke="#6B7280" tickLine={false} axisLine={{ stroke: '#2a1a3e' }} />
                <YAxis stroke="#6B7280" tickLine={false} axisLine={{ stroke: '#2a1a3e' }} allowDecimals={false} />
                <Tooltip content={<HistoryTooltip />} />
                <Bar dataKey="onTime" name="On Time" fill="#22c55e" radius={[6, 6, 0, 0]} />
                <Bar dataKey="late" name="Late" fill="#ef4444" radius={[6, 6, 0, 0]} />
                <Bar dataKey="ahead" name="Ahead" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl p-5 overflow-x-auto mb-4" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
          <div className="mb-4">
            <h3 className="text-white font-semibold">Quarterly Summary</h3>
            <p className="text-gray-300 text-sm mt-1">Quarterly rollup from the scorecard history.</p>
          </div>
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-[#2a1a3e] text-left text-gray-400 uppercase tracking-wider text-xs">
                <th className="py-3 pr-4">Quarter</th>
                <th className="py-3 pr-4">Total</th>
                <th className="py-3 pr-4">On Time</th>
                <th className="py-3 pr-4">Late</th>
                <th className="py-3 pr-4">Ahead</th>
                <th className="py-3 pr-4">On-Time %</th>
                <th className="py-3 pr-4">Avg Timeline Score</th>
                <th className="py-3">Avg Bugs</th>
              </tr>
            </thead>
            <tbody>
              {quarterlyHistory.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-4 text-gray-300">No quarterly history available.</td>
                </tr>
              ) : (
                quarterlyHistory.map(row => (
                  <tr key={row.quarter} className="border-b border-[#1d1329] text-gray-200">
                    <td className="py-3 pr-4 font-medium text-white">{row.quarter}</td>
                    <td className="py-3 pr-4">{row.total || 0}</td>
                    <td className="py-3 pr-4 text-green-400">{row.onTime || 0}</td>
                    <td className="py-3 pr-4 text-red-400">{row.late || 0}</td>
                    <td className="py-3 pr-4 text-blue-400">{row.ahead || 0}</td>
                    <td className="py-3 pr-4">{formatMetricValue(row.onTimePct, '%')}</td>
                    <td className="py-3 pr-4">{formatMetricValue(row.avgTimelineScore)}</td>
                    <td className="py-3">{formatMetricValue(row.avgBugs)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <ProductionMetricCard
            title="All-Time Builds"
            value={allTime.total || 0}
            subtitle="All scorecard rows with a valid go-live or due date"
            accent="#A855F7"
          />
          <ProductionMetricCard
            title="All-Time On-Time %"
            value={formatMetricValue(allTime.onTimePct, '%')}
            subtitle="On time + ahead across full scorecard history"
            accent="#22c55e"
            valueClass={allTime.onTimePct >= 80 ? 'text-green-400' : allTime.onTimePct >= 60 ? 'text-yellow-400' : 'text-red-400'}
          />
          <ProductionMetricCard
            title="Avg Timeline Score"
            value={formatMetricValue(allTime.avgTimelineScore)}
            subtitle="Average score from Lada's timeline scoring"
            accent="#7C3AED"
          />
          <ProductionMetricCard
            title="By Type"
            value={`${allTime.byType?.fullLaunch || 0} / ${allTime.byType?.quickLaunch || 0} / ${allTime.byType?.landingPage || 0}`}
            subtitle="Full launch / Quick launch / Landing page"
            accent="#3B82F6"
          />
        </div>
      </SectionShell>
    </div>
  )
}
