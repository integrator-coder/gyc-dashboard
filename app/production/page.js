'use client'

import { useEffect, useState, useCallback } from 'react'

function formatUpdated(isoStr) {
  if (!isoStr) return ''
  const diff = Math.floor((Date.now() - new Date(isoStr)) / 60000)
  if (diff < 1) return 'just now'
  if (diff === 1) return '1 min ago'
  return `${diff} min ago`
}

function ProductionMetricCard({ title, value, subtitle, accent = '#AE2BCF', valueClass = 'text-white' }) {
  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
      <div className="w-10 h-1 rounded-full mb-3" style={{ backgroundColor: accent }} />
      <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2">{title}</p>
      <p className={`text-3xl font-bold ${valueClass}`}>{value}</p>
      {subtitle && <p className="text-gray-600 text-xs mt-1">{subtitle}</p>}
    </div>
  )
}

function StageNode({ label, value, accent = '#AE2BCF', danger = false }) {
  return (
    <div
      className={`rounded-xl px-4 py-4 min-w-[132px] ${danger ? 'border-red-800 bg-red-950/40' : ''}`}
      style={danger ? undefined : { backgroundColor: '#111111', border: '1px solid #2a1a3e' }}
    >
      <p className={`text-xs font-semibold uppercase tracking-widest mb-2 ${danger ? 'text-red-300' : 'text-gray-500'}`}>
        {label}
      </p>
      <div className="flex items-end justify-between gap-3">
        <p className={`text-3xl font-bold ${danger ? 'text-red-300' : 'text-white'}`}>{value}</p>
        <div className="w-8 h-1 rounded-full" style={{ backgroundColor: danger ? '#ef4444' : accent }} />
      </div>
    </div>
  )
}

function SectionShell({ title, subtitle, children }) {
  return (
    <section>
      <div className="flex items-end justify-between gap-4 mb-3">
        <div>
          <h2 className="text-gray-200 text-lg font-semibold">{title}</h2>
          {subtitle && <p className="text-gray-500 text-sm mt-1">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

export default function ProductionPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/metrics/production')
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
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
    seoInProduction = 0,
    seoStageBreakdown = {},
    seoOverdueCount = 0,
    blockedProjects = [],
    updatedAt,
  } = data || {}

  const webBlockedCount = stageBreakdown.blocked || 0
  const seoBlockedCount = seoStageBreakdown.blocked || 0
  const onTimeTextColor = onTimePct >= 80 ? 'text-green-400' : onTimePct >= 60 ? 'text-yellow-400' : 'text-red-400'

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Production</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {updatedAt ? `Updated ${formatUpdated(updatedAt)}` : 'Loading…'}
          </p>
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

      <SectionShell title="WEB Builds" subtitle="Live view of active web production, delivery health, and project mix.">
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
              <p className="text-gray-600 text-sm mt-1">Design → Copy → FL Build → Client Approval, with blocked work called out separately.</p>
            </div>
            <div className="rounded-full px-3 py-1 text-xs font-semibold border border-red-800 bg-red-950 text-red-300">
              Blocked: {webBlockedCount}
            </div>
          </div>

          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-3 text-gray-500">
              <StageNode label="Design" value={stageBreakdown.design || 0} accent="#A855F7" />
              <span className="text-2xl text-gray-700">→</span>
              <StageNode label="Copy" value={stageBreakdown.copy || 0} accent="#8B5CF6" />
              <span className="text-2xl text-gray-700">→</span>
              <StageNode label="FL Build" value={stageBreakdown.flBuild || 0} accent="#7C3AED" />
              <span className="text-2xl text-gray-700">→</span>
              <StageNode label="Client Approval" value={stageBreakdown.clientApproval || 0} accent="#22c55e" />
            </div>
            <div className="xl:min-w-[160px]">
              <StageNode label="Blocked" value={webBlockedCount} danger />
            </div>
          </div>

          {(stageBreakdown.other || 0) > 0 && (
            <p className="text-sm text-gray-500 mt-4">Other WEB stage values: {stageBreakdown.other}</p>
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
      </SectionShell>

      <SectionShell title="SEO Builds" subtitle="Active SEO work with stage visibility and at-risk projects.">
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
            <div className="flex flex-wrap items-center gap-3 text-gray-500">
              <StageNode label="Set Up" value={seoStageBreakdown.setUp || 0} accent="#A855F7" />
              <span className="text-2xl text-gray-700">→</span>
              <StageNode label="Delivery" value={seoStageBreakdown.delivery || 0} accent="#22c55e" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:min-w-[320px]">
              <StageNode label="Blocked" value={seoBlockedCount} danger />
              <StageNode label="Other" value={seoStageBreakdown.other || 0} accent="#4C1D95" />
            </div>
          </div>
        </div>
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
                  className="rounded-lg border border-red-900 bg-black/20 px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2"
                >
                  <div>
                    <p className="text-white font-semibold">{project.name}</p>
                    <p className="text-sm text-red-200/80">{project.department}</p>
                  </div>
                  <div className="text-sm text-red-100/90 md:text-right">
                    <p>{project.daysPastDue === null ? 'no due date' : `${project.daysPastDue} days past due`}</p>
                    <p className="text-red-300/70">{project.dueDate || 'No due date set'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionShell>
    </div>
  )
}
