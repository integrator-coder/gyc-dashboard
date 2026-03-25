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
    onTimeCount = 0,
    lateCount = 0,
    onTimePct = 0,
    avgBuildTimeDays = 0,
    totalWebProjects = 0,
    completedWebProjectsLast90d = 0,
    updatedAt,
  } = data || {}

  const onTimeBarColor = onTimePct >= 80 ? '#22c55e' : onTimePct >= 60 ? '#eab308' : '#ef4444'
  const onTimeTextColor = onTimePct >= 80 ? 'text-green-400' : onTimePct >= 60 ? 'text-yellow-400' : 'text-red-400'

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Production</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {updatedAt ? `Updated ${formatUpdated(updatedAt)}` : 'Loading…'}
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); fetchData() }}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors border border-gray-700"
        >
          ↻ Refresh
        </button>
      </div>

      <section>
        <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-3">
          Web Production KPIs
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <ProductionMetricCard
            title="Projects In Production (Web)"
            value={projectsInProduction}
            subtitle="Active web projects not yet launched or completed"
          />
          <ProductionMetricCard
            title="On-Time Completion"
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
            title="Total Web Projects"
            value={totalWebProjects}
            subtitle="Portfolio items tagged to WEB"
            accent="#731494"
          />
        </div>
      </section>

      <section>
        <div className="rounded-xl p-5" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-white font-semibold">On-Time Delivery Health</h2>
              <p className="text-gray-600 text-sm mt-1">Client approval stage projects due on or before today are counted as late.</p>
            </div>
            <div className="text-right shrink-0">
              <p className={`text-3xl font-bold ${onTimeTextColor}`}>{onTimePct}%</p>
              <p className="text-gray-600 text-xs">on-time rate</p>
            </div>
          </div>

          <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(onTimePct, 100)}%`, backgroundColor: onTimeBarColor }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 text-sm">
            <div className="rounded-lg bg-gray-900 border border-gray-800 px-4 py-3">
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">On Time</p>
              <p className="text-green-400 text-2xl font-bold">{onTimeCount}</p>
            </div>
            <div className="rounded-lg bg-gray-900 border border-gray-800 px-4 py-3">
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Late</p>
              <p className="text-red-400 text-2xl font-bold">{lateCount}</p>
            </div>
            <div className="rounded-lg bg-gray-900 border border-gray-800 px-4 py-3">
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Completed Web Builds (90d)</p>
              <p className="text-brand-p4 text-2xl font-bold">{completedWebProjectsLast90d}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
