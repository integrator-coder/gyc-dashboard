'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  ReferenceLine
} from 'recharts'

const GROWTH_ADVISORS = ['Sebastian', 'Stefen', 'JC', 'Zu']

function formatUpdated(isoStr) {
  if (!isoStr) return ''
  const diff = Math.floor((Date.now() - new Date(isoStr)) / 60000)
  if (diff < 1) return 'just now'
  if (diff === 1) return '1 min ago'
  return `${diff} min ago`
}

function formatCurrency(val) {
  if (!val && val !== 0) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0
  }).format(val)
}

function completionColor(pct) {
  if (pct >= 80) return 'bg-green-500'
  if (pct >= 50) return 'bg-yellow-500'
  return 'bg-red-500'
}

function completionTextColor(pct) {
  if (pct >= 80) return 'text-green-400'
  if (pct >= 50) return 'text-yellow-400'
  return 'text-red-400'
}

function completionBarColor(pct) {
  if (pct >= 80) return '#22c55e'
  if (pct >= 50) return '#eab308'
  return '#ef4444'
}

function MiniProgressBar({ met, total }) {
  const pct = total > 0 ? (met / total) * 100 : 0
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs mb-1">
        <span className={completionTextColor(pct)}>{met}/{total}</span>
        <span className={completionTextColor(pct)}>{pct.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${completionColor(pct)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function McCard({ mcName, data }) {
  const pct = data.total > 0 ? (data.met / data.total) * 100 : 0
  const avatar = mcName === 'Unassigned' ? '?' : mcName[0]
  const avatarBg = mcName === 'Unassigned' ? 'bg-gray-700 text-gray-400' : 'bg-brand-p1 text-brand-p4'

  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${avatarBg}`}>
          {avatar}
        </div>
        <div>
          <div className="text-white font-semibold text-sm">{mcName}</div>
          <div className="text-gray-300 text-xs">{data.total} clients</div>
        </div>
        <div className={`ml-auto text-lg font-bold ${completionTextColor(pct)}`}>
          {pct.toFixed(0)}%
        </div>
      </div>
      <MiniProgressBar met={data.met} total={data.total} />
    </div>
  )
}

function HealthBandStat({ label, icon, pct, count, colorClass }) {
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-gray-300 text-xs font-medium uppercase tracking-wider mb-1">{icon} {label}</p>
          <p className={`text-3xl font-bold ${colorClass}`}>{pct.toFixed(1)}%</p>
        </div>
        <div className="text-right">
          <p className="text-white text-lg font-semibold">{count}</p>
          <p className="text-gray-300 text-xs">clients</p>
        </div>
      </div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const entry = payload[0].payload
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm">
        <p className="text-gray-300 font-medium">{label}</p>
        <p className="text-brand-p4 font-bold">{payload[0].value.toFixed(1)}%</p>
        {entry.met !== undefined && (
          <p className="text-gray-300 text-xs">{entry.met} / {entry.total} clients met</p>
        )}
        {entry.months && (
          <p className="text-gray-300 text-xs mt-0.5">{entry.months}</p>
        )}
      </div>
    )
  }
  return null
}

export default function CXPage() {
  const [data, setData] = useState(null)
  const [ghlData, setGhlData] = useState(null)
  const [zendeskData, setZendeskData] = useState(null)
  const [healthData, setHealthData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [ghlLoading, setGhlLoading] = useState(true)
  const [zendeskLoading, setZendeskLoading] = useState(true)
  const [healthLoading, setHealthLoading] = useState(true)
  const [error, setError] = useState(null)
  const [healthError, setHealthError] = useState(null)
  const [ghlPeriod, setGhlPeriod] = useState('month')

  const fetchCxData = useCallback(async () => {
    try {
      const res = await fetch('/api/metrics/cx')
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

  const fetchHealthData = useCallback(async () => {
    setHealthLoading(true)
    try {
      const res = await fetch('/api/metrics/client-health')
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setHealthData(json)
      setHealthError(null)
    } catch (err) {
      setHealthError(err.message)
      setHealthData(null)
    } finally {
      setHealthLoading(false)
    }
  }, [])

  const fetchGhlData = useCallback(async () => {
    setGhlLoading(true)
    try {
      const res = await fetch(`/api/metrics/ghl?period=${ghlPeriod}`)
      const json = await res.json()
      setGhlData(json.error ? null : json)
    } catch {
      setGhlData(null)
    } finally {
      setGhlLoading(false)
    }
  }, [ghlPeriod])

  const fetchZendeskData = useCallback(async () => {
    setZendeskLoading(true)
    try {
      const res = await fetch('/api/metrics/zendesk')
      const json = await res.json()
      setZendeskData(json)
    } catch {
      setZendeskData(null)
    } finally {
      setZendeskLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCxData()
    const interval = setInterval(fetchCxData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchCxData])

  useEffect(() => {
    fetchHealthData()
    const interval = setInterval(fetchHealthData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchHealthData])

  useEffect(() => {
    fetchGhlData()
  }, [fetchGhlData])

  useEffect(() => {
    fetchZendeskData()
    const interval = setInterval(fetchZendeskData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchZendeskData])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading CX data…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto mt-10">
        <div className="bg-red-950 border border-red-800 rounded-lg px-4 py-3 text-red-300 text-sm">
          ⚠️ Error loading CX data: {error}
        </div>
      </div>
    )
  }

  const {
    totalClients = 0,
    currentQuarter = 'Q1',
    currentQuarterMonthBreakdown = {},
    quarterStats = {},
    byMc = {},
    updatedAt
  } = data || {}

  const currentQStats = quarterStats[currentQuarter] || { met: 0, total: totalClients, pct: 0 }
  const notMetCount = currentQStats.total - currentQStats.met

  const chartData = ['Q1', 'Q2', 'Q3', 'Q4'].map(q => ({
    quarter: q,
    pct: quarterStats[q]?.pct || 0,
    met: quarterStats[q]?.met || 0,
    total: quarterStats[q]?.total || totalClients,
    isCurrent: q === currentQuarter,
    months: quarterStats[q]?.months?.join(', ') || ''
  }))

  const knownMCs = ['Sebastian', 'Stefen', 'JC', 'Zu']
  const mcOrder = knownMCs.filter(mc => byMc[mc])

  const gaByRep = ghlData?.byRep
    ? Object.fromEntries(
        Object.entries(ghlData.byRep).filter(([rep]) => GROWTH_ADVISORS.includes(rep))
      )
    : {}

  const gaTotalDeals = Object.values(gaByRep).reduce((s, r) => s + (r.deals || 0), 0)
  const gaTotalValue = Object.values(gaByRep).reduce((s, r) => s + (r.value || 0), 0)

  const contactsWithScores = healthData?.contactsWithScores ?? 0
  const sampleSize = healthData?.sampleSize ?? 0
  const coveragePct = sampleSize > 0 ? (contactsWithScores / sampleSize) * 100 : 0
  const lowCoverage = coveragePct < 20
  const healthSegments = [
    { key: 'green', label: 'Green', icon: '🟢', pct: healthData?.greenPct ?? 0, count: healthData?.green ?? 0, color: 'text-green-400', bg: '#22c55e' },
    { key: 'yellow', label: 'Yellow', icon: '🟡', pct: healthData?.yellowPct ?? 0, count: healthData?.yellow ?? 0, color: 'text-yellow-400', bg: '#eab308' },
    { key: 'red', label: 'Red', icon: '🔴', pct: healthData?.redPct ?? 0, count: healthData?.red ?? 0, color: 'text-red-400', bg: '#ef4444' },
  ]

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Client Experience</h1>
          <p className="text-gray-300 text-sm mt-0.5">
            {updatedAt ? `Updated ${formatUpdated(updatedAt)}` : 'Loading…'}
            {' · '}
            <span className="text-brand-p4 font-medium">{totalClients} active clients</span>
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); fetchCxData(); fetchHealthData(); fetchGhlData(); fetchZendeskData() }}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors border border-gray-700"
        >
          ↻ Refresh
        </button>
      </div>

      <section>
        <div className="flex items-center justify-between mb-3 gap-4">
          <div>
            <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-widest">Client Health</h2>
            <p className="text-gray-300 text-xs mt-1">Health scores pulled from GHL custom fields</p>
          </div>
          {healthData?.updatedAt && (
            <span className="text-gray-300 text-xs">Updated {formatUpdated(healthData.updatedAt)}</span>
          )}
        </div>

        {healthError ? (
          <div className="bg-red-950 border border-red-800 rounded-lg px-4 py-3 text-red-300 text-sm">
            ⚠️ Unable to load client health: {healthError}
          </div>
        ) : healthLoading && !healthData ? (
          <div className="rounded-xl border border-gray-800 px-5 py-8 flex items-center justify-center gap-3" style={{ backgroundColor: '#111111' }}>
            <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-300 text-sm">Loading client health data…</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {healthSegments.map(segment => (
                <HealthBandStat
                  key={segment.key}
                  label={segment.label}
                  icon={segment.icon}
                  pct={segment.pct}
                  count={segment.count}
                  colorClass={segment.color}
                />
              ))}
            </div>

            <div className="rounded-xl p-5" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
              <div className="flex items-center justify-between gap-4 mb-3">
                <div>
                  <p className="text-gray-300 text-xs font-medium uppercase tracking-wider mb-1">Health Score Coverage</p>
                  <p className="text-white text-lg font-semibold">{contactsWithScores} of {sampleSize} clients have health scores.</p>
                  <p className="text-gray-300 text-sm mt-1">
                    {contactsWithScores} of {sampleSize} clients have health scores. Score more clients in GHL to get full coverage.
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-3xl font-bold text-brand-p4">{coveragePct.toFixed(1)}%</p>
                  <p className="text-gray-300 text-xs">coverage</p>
                </div>
              </div>

              <div className="h-4 bg-gray-800 rounded-full overflow-hidden flex">
                {healthSegments.map(segment => (
                  <div
                    key={segment.key}
                    className="h-full transition-all"
                    style={{ width: `${segment.pct}%`, backgroundColor: segment.bg }}
                    title={`${segment.label}: ${segment.pct.toFixed(1)}%`}
                  />
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3 mt-3 text-xs">
                {healthSegments.map(segment => (
                  <div key={segment.key} className="text-gray-300">
                    <span className={segment.color}>{segment.icon} {segment.label}</span>
                    <span className="text-gray-200 mx-1">·</span>
                    <span>{segment.count} clients</span>
                  </div>
                ))}
              </div>

              {lowCoverage && (
                <div className="mt-4 rounded-lg border border-yellow-800 bg-yellow-950/40 px-4 py-3 text-yellow-200 text-sm">
                  Coverage is low ({coveragePct.toFixed(1)}%). Team should fill in client health scores in GHL so this dashboard reflects the full book of business.
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-3">
          {currentQuarter} — Meeting Completion
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl p-5" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
            <p className="text-gray-300 text-xs font-medium uppercase tracking-wider mb-2">Met This Quarter</p>
            <p className={`text-3xl font-bold ${completionTextColor(currentQStats.pct)}`}>
              {currentQStats.met}
              <span className="text-gray-300 text-lg font-normal"> / {currentQStats.total}</span>
            </p>
          </div>

          <div className="rounded-xl p-5" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
            <p className="text-gray-300 text-xs font-medium uppercase tracking-wider mb-2">% Complete</p>
            <p className={`text-3xl font-bold mb-3 ${completionTextColor(currentQStats.pct)}`}>
              {currentQStats.pct.toFixed(1)}%
            </p>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${completionColor(currentQStats.pct)}`}
                style={{ width: `${currentQStats.pct}%` }}
              />
            </div>
          </div>

          <div className="rounded-xl p-5" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
            <p className="text-gray-300 text-xs font-medium uppercase tracking-wider mb-2">Not Yet Met</p>
            <p className={`text-3xl font-bold ${notMetCount > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {notMetCount}
            </p>
            <p className="text-gray-300 text-xs mt-1">
              {notMetCount > 0 ? 'clients still need a meeting' : 'all clients met! 🎉'}
            </p>
          </div>
        </div>

        {Object.keys(currentQuarterMonthBreakdown).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-3">
            {Object.entries(currentQuarterMonthBreakdown).map(([month, stats]) => (
              <div key={month} className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs">
                <span className="text-gray-300 mr-2">{month}</span>
                <span className={completionTextColor(stats.pct)}>
                  {stats.done} logged
                </span>
                <span className="text-gray-200 mx-1">·</span>
                <span className={completionTextColor(stats.pct)}>{stats.pct.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {mcOrder.length > 0 && (
        <section>
          <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-3">
            By Growth Advisor — {currentQuarter}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {mcOrder.map(mc => (
              <McCard key={mc} mcName={mc} data={byMc[mc]} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-3">
          Quarterly Trend — {new Date().getFullYear()}
        </h2>
        <div className="rounded-xl p-5" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis
                dataKey="quarter"
                tick={{ fill: '#6b7280', fontSize: 12 }}
                axisLine={{ stroke: '#374151' }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tickFormatter={v => `${v}%`}
                tick={{ fill: '#6b7280', fontSize: 12 }}
                axisLine={{ stroke: '#374151' }}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      entry.isCurrent
                        ? '#AE2BCF'
                        : entry.pct === 0
                        ? '#1f2937'
                        : completionBarColor(entry.pct)
                    }
                    opacity={entry.pct === 0 && !entry.isCurrent ? 0.5 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-widest">
            Support (Zendesk)
          </h2>
          {zendeskData?.syncedAt && (
            <span className="text-gray-300 text-xs">
              Synced {formatUpdated(zendeskData.syncedAt)}
            </span>
          )}
        </div>

        {zendeskLoading && !zendeskData ? (
          <div className="bg-gray-900 rounded-xl border border-gray-800 px-5 py-10 flex items-center justify-center gap-3">
            <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-300 text-sm">Loading Zendesk data…</span>
          </div>
        ) : zendeskData ? (
          <div className="space-y-4">
            <div>
              <p className="text-gray-300 text-xs mb-2 uppercase tracking-wider">Queue Health</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl p-5" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
                  <p className="text-gray-300 text-xs font-medium uppercase tracking-wider mb-2">Active Queue</p>
                  <p className={`text-3xl font-bold ${
                    zendeskData.queue.total > 500
                      ? 'text-red-400'
                      : zendeskData.queue.total > 200
                      ? 'text-yellow-400'
                      : 'text-green-400'
                  }`}>
                    {zendeskData.queue.total}
                  </p>
                  <p className="text-gray-300 text-xs mt-1">
                    {zendeskData.queue.new}n · {zendeskData.queue.open}o · {zendeskData.queue.pending}p · {zendeskData.queue.hold}h
                  </p>
                </div>

                <div className="rounded-xl p-5" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
                  <p className="text-gray-300 text-xs font-medium uppercase tracking-wider mb-2">New This Month</p>
                  <p className="text-3xl font-bold text-white">{zendeskData.thisMonth.created}</p>
                  <p className="text-gray-300 text-xs mt-1">tickets created</p>
                </div>

                <div className="rounded-xl p-5" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
                  <p className="text-gray-300 text-xs font-medium uppercase tracking-wider mb-2">Resolved This Month</p>
                  <p className="text-3xl font-bold text-brand-p4">{zendeskData.thisMonth.resolved}</p>
                  <p className="text-gray-300 text-xs mt-1">tickets solved</p>
                </div>

                <div className="rounded-xl p-5" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
                  <p className="text-gray-300 text-xs font-medium uppercase tracking-wider mb-2">Resolution Rate</p>
                  <p className={`text-3xl font-bold ${
                    zendeskData.thisMonth.resolutionRate >= 80
                      ? 'text-green-400'
                      : zendeskData.thisMonth.resolutionRate >= 50
                      ? 'text-yellow-400'
                      : 'text-red-400'
                  }`}>
                    {zendeskData.thisMonth.resolutionRate}%
                  </p>
                  <p className="text-gray-300 text-xs mt-1">resolved / created</p>
                </div>
              </div>
            </div>

            <div>
              <p className="text-gray-300 text-xs mb-2 uppercase tracking-wider">Resolution Time</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Mean Resolution', value: zendeskData.resolutionTime.mean },
                  { label: 'Median Resolution', value: zendeskData.resolutionTime.median },
                  { label: 'Mode Resolution', value: zendeskData.resolutionTime.mode },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl p-5" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
                    <p className="text-gray-300 text-xs font-medium uppercase tracking-wider mb-2">{label}</p>
                    <p className="text-3xl font-bold text-brand-p4">
                      {value >= 24
                        ? `${(value / 24).toFixed(1)}d`
                        : `${value}h`}
                    </p>
                  </div>
                ))}
                <div className="rounded-xl p-5" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
                  <p className="text-gray-300 text-xs font-medium uppercase tracking-wider mb-2">Sample Size</p>
                  <p className="text-3xl font-bold text-white">{zendeskData.resolutionTime.sampleSize}</p>
                  <p className="text-gray-300 text-xs mt-1">closed tickets</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-xl p-5" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
                <p className="text-gray-300 text-xs font-medium uppercase tracking-wider mb-3">Resolution Time Distribution</p>
                {zendeskData.resolutionTime.buckets.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={zendeskData.resolutionTime.buckets}
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
                          if (active && payload && payload.length) {
                            const count = payload[0].value
                            const total = zendeskData.resolutionTime.sampleSize
                            const pct = total > 0 ? ((count / total) * 100).toFixed(1) : 0
                            return (
                              <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm">
                                <p className="text-gray-300 font-medium">{label}</p>
                                <p className="text-brand-p4 font-bold">{count} tickets</p>
                                <p className="text-gray-300 text-xs">{pct}% of total</p>
                              </div>
                            )
                          }
                          return null
                        }}
                      />
                      {(() => {
                        const mean = zendeskData.resolutionTime.mean
                        const buckets = zendeskData.resolutionTime.buckets
                        const idx = buckets.findIndex(b => mean >= b.minHours && mean < b.maxHours)
                        return idx >= 0 ? (
                          <ReferenceLine
                            x={buckets[idx].label}
                            stroke="#f59e0b"
                            strokeDasharray="4 2"
                            label={{ value: 'Mean', fill: '#f59e0b', fontSize: 10, position: 'top' }}
                          />
                        ) : null
                      })()}
                      {(() => {
                        const median = zendeskData.resolutionTime.median
                        const buckets = zendeskData.resolutionTime.buckets
                        const idx = buckets.findIndex(b => median >= b.minHours && median < b.maxHours)
                        return idx >= 0 ? (
                          <ReferenceLine
                            x={buckets[idx].label}
                            stroke="#a78bfa"
                            strokeDasharray="4 2"
                            label={{ value: 'Median', fill: '#a78bfa', fontSize: 10, position: 'top' }}
                          />
                        ) : null
                      })()}
                      <Bar dataKey="count" fill="#AE2BCF" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[220px] flex items-center justify-center text-gray-300 text-sm">No data yet</div>
                )}
              </div>

              <div className="rounded-xl p-5" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
                <p className="text-gray-300 text-xs font-medium uppercase tracking-wider mb-3">Open Tickets by Type</p>
                {(() => {
                  const typeLabels = {
                    website_build: 'Website Build',
                    website_helpdesk: 'Website Helpdesk',
                    smm: 'SMM',
                    google_ads: 'Google Ads',
                    crm: 'CRM',
                  }
                  const typeData = Object.entries(typeLabels).map(([key, label]) => ({
                    label,
                    count: zendeskData.byType[key] || 0,
                  }))
                  return (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart
                        data={typeData}
                        layout="vertical"
                        margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                        <XAxis
                          type="number"
                          tick={{ fill: '#6b7280', fontSize: 11 }}
                          axisLine={{ stroke: '#374151' }}
                          tickLine={false}
                          allowDecimals={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="label"
                          tick={{ fill: '#9ca3af', fontSize: 11 }}
                          axisLine={{ stroke: '#374151' }}
                          tickLine={false}
                          width={110}
                        />
                        <Tooltip
                          cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm">
                                  <p className="text-gray-300 font-medium">{label}</p>
                                  <p className="text-brand-p4 font-bold">{payload[0].value} open</p>
                                </div>
                              )
                            }
                            return null
                          }}
                        />
                        <Bar dataKey="count" fill="#AE2BCF" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )
                })()}
              </div>
            </div>

            {zendeskData.firstReplyTime && (
              <div>
                <p className="text-gray-300 text-xs mb-2 uppercase tracking-wider">First Response Time</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: 'Mean First Reply', value: zendeskData.firstReplyTime.mean },
                    { label: 'Median First Reply', value: zendeskData.firstReplyTime.median },
                  ].map(({ label, value }) => {
                    const hours = value / 60
                    const display = value === 0
                      ? '—'
                      : hours >= 24
                      ? `${(hours / 24).toFixed(1)}d`
                      : hours >= 1
                      ? `${hours.toFixed(1)}h`
                      : `${Math.round(value)}m`
                    const color = value === 0
                      ? 'text-gray-300'
                      : hours <= 4
                      ? 'text-green-400'
                      : hours <= 24
                      ? 'text-yellow-400'
                      : 'text-red-400'
                    return (
                      <div key={label} className="rounded-xl p-5" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
                        <p className="text-gray-300 text-xs font-medium uppercase tracking-wider mb-2">{label}</p>
                        <p className={`text-3xl font-bold ${color}`}>{display}</p>
                        {value > 0 && (
                          <p className="text-gray-300 text-xs mt-1">{Math.round(value)} minutes</p>
                        )}
                      </div>
                    )
                  })}
                  <div className="rounded-xl p-5" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
                    <p className="text-gray-300 text-xs font-medium uppercase tracking-wider mb-2">FRT Sample</p>
                    <p className="text-3xl font-bold text-white">{zendeskData.firstReplyTime.sampleSize}</p>
                    <p className="text-gray-300 text-xs mt-1">tickets measured</p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <p className="text-gray-300 text-xs mb-2 uppercase tracking-wider">SLA &amp; Overdue</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl p-5" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
                  <p className="text-gray-300 text-xs font-medium uppercase tracking-wider mb-2">Overdue Tickets</p>
                  <p className={`text-3xl font-bold ${
                    (zendeskData.overdueTickets || 0) > 20
                      ? 'text-red-400'
                      : (zendeskData.overdueTickets || 0) > 5
                      ? 'text-yellow-400'
                      : 'text-green-400'
                  }`}>
                    {zendeskData.overdueTickets ?? 0}
                  </p>
                  <p className="text-gray-300 text-xs mt-1">past due date</p>
                </div>
                <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 sm:col-span-3">
                  <p className="text-gray-300 text-xs font-medium uppercase tracking-wider mb-2">Overdue as % of Queue</p>
                  {(() => {
                    const total = zendeskData.queue?.total || 0
                    const overdue = zendeskData.overdueTickets || 0
                    const pct = total > 0 ? ((overdue / total) * 100).toFixed(1) : 0
                    const barColor = overdue / total > 0.2 ? 'bg-red-500' : overdue / total > 0.1 ? 'bg-yellow-500' : 'bg-green-500'
                    return (
                      <div>
                        <p className="text-white text-sm mb-2">{pct}% of {total} active tickets are overdue</p>
                        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>

            {zendeskData.monthlyVolume && zendeskData.monthlyVolume.length > 0 && (
              <div>
                <p className="text-gray-300 text-xs mb-2 uppercase tracking-wider">Ticket Volume — Last 12 Months</p>
                <div className="rounded-xl p-5" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={zendeskData.monthlyVolume}
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
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm">
                                <p className="text-gray-300 font-medium">{label}</p>
                                <p className="text-brand-p4 font-bold">{payload[0].value} tickets</p>
                              </div>
                            )
                          }
                          return null
                        }}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {zendeskData.monthlyVolume.map((entry, index) => {
                          const isLatest = index === zendeskData.monthlyVolume.length - 1
                          return (
                            <Cell
                              key={`mv-${index}`}
                              fill={isLatest ? '#AE2BCF' : '#731494'}
                              opacity={isLatest ? 1 : 0.75}
                            />
                          )
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {zendeskData.assigneeLoads && zendeskData.assigneeLoads.length > 0 && (
                <div className="rounded-xl p-5" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
                  <p className="text-gray-300 text-xs font-medium uppercase tracking-wider mb-4">Open Tickets by Growth Advisor</p>
                  <div className="space-y-3">
                    {(() => {
                      const maxCount = Math.max(...zendeskData.assigneeLoads.map(a => a.openCount), 1)
                      return zendeskData.assigneeLoads
                        .slice()
                        .sort((a, b) => b.openCount - a.openCount)
                        .map(({ name, openCount }) => {
                          const pct = (openCount / maxCount) * 100
                          const barColor = openCount > 30 ? '#ef4444' : openCount > 15 ? '#eab308' : '#AE2BCF'
                          return (
                            <div key={name}>
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="w-6 h-6 rounded-full bg-brand-p1 flex items-center justify-center text-xs text-brand-p4 font-bold shrink-0">
                                    {name[0]}
                                  </span>
                                  <span className="text-white text-sm font-medium">{name}</span>
                                </div>
                                <span className={`text-sm font-bold ${openCount > 30 ? 'text-red-400' : openCount > 15 ? 'text-yellow-400' : 'text-brand-p4'}`}>
                                  {openCount}
                                </span>
                              </div>
                              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{ width: `${pct}%`, backgroundColor: barColor }}
                                />
                              </div>
                            </div>
                          )
                        })
                    })()}
                  </div>
                </div>
              )}

              {zendeskData.orgTickets && zendeskData.orgTickets.length > 0 && (
                <div className="rounded-xl p-5" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-gray-300 text-xs font-medium uppercase tracking-wider">Top Clients by Ticket Volume</p>
                    <span className="text-gray-300 text-xs">churn risk signal</span>
                  </div>
                  <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
                    {zendeskData.orgTickets.slice(0, 15).map(({ orgName, openCount }, i) => {
                      const maxC = zendeskData.orgTickets[0]?.openCount || 1
                      const pct = (openCount / maxC) * 100
                      const riskColor = openCount >= 10 ? 'text-red-400' : openCount >= 5 ? 'text-yellow-400' : 'text-gray-400'
                      const barColor = openCount >= 10 ? '#ef4444' : openCount >= 5 ? '#eab308' : '#374151'
                      return (
                        <div key={orgName} className="flex items-center gap-3">
                          <span className="text-gray-300 text-xs w-4 shrink-0">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-gray-300 text-xs truncate mr-2">{orgName}</span>
                              <span className={`text-xs font-bold shrink-0 ${riskColor}`}>{openCount}</span>
                            </div>
                            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${pct}%`, backgroundColor: barColor }}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {zendeskData.partialError && (
              <p className="text-yellow-600 text-xs">⚠️ Some Zendesk data could not be loaded (partial error)</p>
            )}
          </div>
        ) : (
          <div className="bg-gray-900 rounded-xl border border-gray-800 px-5 py-6 text-gray-300 text-sm">
            Unable to load Zendesk data.
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-widest">
            Upsells — Growth Advisors
          </h2>
          <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-0.5">
            {[['month', 'This Month'], ['year', 'This Year']].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setGhlPeriod(key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  ghlPeriod === key
                    ? 'bg-brand-p300 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-gray-300 text-xs mb-3">
          Closed Won · {ghlData?.period ?? (ghlPeriod === 'month' ? 'This Month' : 'This Year')} · from GHL
        </p>

        {ghlLoading ? (
          <div className="bg-gray-900 rounded-xl border border-gray-800 px-5 py-8 flex items-center justify-center gap-3">
            <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-300 text-sm">Loading deals…</span>
          </div>
        ) : (
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left px-4 py-3 text-gray-300 text-xs uppercase tracking-wider">Growth Advisor</th>
                    <th className="text-right px-4 py-3 text-gray-300 text-xs uppercase tracking-wider">Deals Closed</th>
                    <th className="text-right px-4 py-3 text-gray-300 text-xs uppercase tracking-wider">Total Value</th>
                  </tr>
                </thead>
                <tbody>
                  {GROWTH_ADVISORS.map(ga => {
                    const rep = gaByRep[ga]
                    const deals = rep?.deals ?? 0
                    const value = rep?.value ?? 0
                    return (
                      <tr key={ga} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/40">
                        <td className="px-4 py-3 text-white font-medium flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-brand-p1 flex items-center justify-center text-xs text-brand-p4 font-bold shrink-0">
                            {ga[0]}
                          </span>
                          {ga}
                        </td>
                        <td className="text-right px-4 py-3 text-white font-semibold">
                          {ghlData ? deals : '—'}
                        </td>
                        <td className="text-right px-4 py-3 text-brand-p4 font-semibold">
                          {ghlData ? formatCurrency(value) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                  {ghlData && (
                    <tr className="bg-gray-800/60">
                      <td className="px-4 py-3 text-gray-400 font-semibold text-xs uppercase tracking-wider">Total</td>
                      <td className="text-right px-4 py-3 text-white font-bold">{gaTotalDeals}</td>
                      <td className="text-right px-4 py-3 text-brand-p4 font-bold">{formatCurrency(gaTotalValue)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

    </div>
  )
}
