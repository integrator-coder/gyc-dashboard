'use client'

import { useState, useEffect } from 'react'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  Tooltip, Legend, CartesianGrid, Area, AreaChart
} from 'recharts'

const BENCHMARKS = { leadToTour: 50, tourToReg: 25, leadToReg: 25 }

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtMonth(m) {
  if (!m) return '—'
  const [y, mo] = m.split('-')
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleString('default', { month: 'short', year: '2-digit' })
}

function ConvPill({ value, benchmark, label }) {
  if (value === null || value === undefined) return null
  const good = value >= benchmark
  const mid  = value >= benchmark * 0.7
  const cls  = good ? 'bg-green-500/20 text-green-400 border-green-500/30'
             : mid  ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                    : 'bg-red-500/20 text-red-400 border-red-500/30'
  return (
    <div className={`flex flex-col items-center px-4 py-3 rounded-xl border ${cls}`}>
      <span className="text-2xl font-bold">{value}%</span>
      <span className="text-xs mt-0.5 opacity-75">{label}</span>
      <span className="text-xs opacity-50">bench {benchmark}%</span>
    </div>
  )
}

function StatCard({ label, value, sub, highlight }) {
  return (
    <div
      className="rounded-xl px-5 py-4"
      style={{
        backgroundColor: highlight ? '#1a0a2e' : '#111111',
        border: highlight ? '1px solid #731494' : '1px solid #2a1a3e',
      }}
    >
      <p style={{ color: '#9ca3af' }} className="text-xs">{label}</p>
      <p className="text-3xl font-bold text-white mt-1">{value}</p>
      {sub && <p style={{ color: '#4a3060' }} className="text-xs mt-1">{sub}</p>}
    </div>
  )
}

const LEADERBOARD_MODES = [
  { id: 'leads',        label: 'Most Leads',         metric: 'leads',      suffix: '' },
  { id: 'registrations',label: 'Most Registrations', metric: 'registered', suffix: '' },
  { id: 'conversion',   label: 'Best Conversion',    metric: 'leadToReg',  suffix: '%' },
]

const CHART_MODES = [
  { id: 'volume',  label: 'Volume' },
  { id: 'avg',     label: 'Per Client Avg' },
  { id: 'conv',    label: 'Conversion Rates' },
  { id: 'clients', label: 'Institutions' },
]

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl px-4 py-3 text-sm shadow-xl" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
      <p style={{ color: '#9ca3af' }} className="mb-2 font-medium">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-400">{p.name}:</span>
          <span className="text-white font-semibold">{p.value?.toLocaleString()}{p.unit || ''}</span>
        </div>
      ))}
    </div>
  )
}

export default function ClientsPage() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState(null)
  const [lbMode, setLbMode]       = useState('leads')
  const [lbPeriod, setLbPeriod]   = useState('lastMonth')
  const [lb2Mode, setLb2Mode]     = useState('leads')
  const [lb2Period, setLb2Period] = useState('lastMonth')
  const [chartMode, setChartMode] = useState('volume')
  const [statMode, setStatMode]   = useState('avg') // avg | median | mode

  useEffect(() => {
    fetch('/api/metrics/client-funnels/summary')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { console.error('client-funnels fetch error:', e); setLoading(false) })
  }, [])

  async function handleSync() {
    setSyncing(true); setSyncMsg(null)
    const res  = await fetch('/api/sync/client-funnels', { method: 'POST' })
    const json = await res.json()
    setSyncing(false)
    setSyncMsg(json.ok ? `✅ Synced ${json.synced} clients` : `❌ ${json.error}`)
    if (json.ok) {
      setLoading(true)
      fetch('/api/metrics/client-funnels/summary').then(r => r.json()).then(d => { setData(d); setLoading(false) })
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
    </div>
  )

  if (!data) return (
    <div className="flex items-center justify-center h-64 text-red-400">
      Failed to load Client Results. Check the server log.
    </div>
  )

  const { allTimeTotals, byMonth, latestMonth, leaderboards, locationLeaderboards, lastSync, clientCount, lastCompleteMonth } = data

  // Chart data — last 24 months
  const chartData = byMonth.slice(-24).map(m => ({
    month:      fmtMonth(m.month),
    Leads:      m.leads,
    Tours:      m.tours,
    Registered: m.registered,
    'Avg Leads':      m.avgLeads,
    'Avg Tours':      m.avgTours,
    'Avg Reg':        m.avgRegistered,
    'L→T %':          m.leadToTour,
    'T→R %':          m.tourToReg,
    'L→R %':          m.leadToReg,
    Institutions:     m.clientCount,
    Locations:        m.locationCount,
    // avg
    'Leads/Loc':         m.avgLeadsPerLoc,
    'Tours/Loc':         m.avgToursPerLoc,
    'Reg/Loc':           m.avgRegisteredPerLoc,
    // median
    'Median Leads':      m.medianLeads,
    'Median Tours':      m.medianTours,
    'Median Reg':        m.medianRegistered,
    // mode
    'Mode Leads':        m.modeLeads,
    'Mode Tours':        m.modeTours,
    'Mode Reg':          m.modeRegistered,
  }))

  const LB_PERIODS = [
    { id: 'allTime',     label: 'All Time' },
    { id: 'months12',    label: '12 Months' },
    { id: 'lastQuarter', label: 'Last Quarter' },
    { id: 'lastMonth',   label: 'Last Month' },
  ]
  const activeLb      = leaderboards?.[lbPeriod] ?? {}
  const leaderboard   = lbMode === 'leads'         ? (activeLb.byLeads ?? [])
                      : lbMode === 'registrations' ? (activeLb.byRegistrations ?? [])
                      : (activeLb.byConversion ?? [])
  const underperforming = activeLb.redFlag ?? []
  const lowLeadFlow     = activeLb.lowLeadFlow ?? []
  const lbMetric      = LEADERBOARD_MODES.find(m => m.id === lbMode)
  const maxVal        = Math.max(...leaderboard.map(c => c[lbMetric.metric] ?? 0), 1)

  // Top 10 Locations — independent controls, uses location-level data
  const activeLb2     = locationLeaderboards?.[lb2Period] ?? {}
  const leaderboard2  = lb2Mode === 'leads'         ? (activeLb2.byLeads ?? [])
                      : lb2Mode === 'registrations' ? (activeLb2.byRegistrations ?? [])
                      : (activeLb2.byConversion ?? [])
  const lb2Metric     = LEADERBOARD_MODES.find(m => m.id === lb2Mode)
  const maxVal2       = Math.max(...leaderboard2.map(c => c[lb2Metric.metric] ?? 0), 1)
  const maxUnderLeads = Math.max(...underperforming.map(c => c.leads ?? 0), 1)

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Client Performance</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {clientCount} active clients
            {lastSync && <span className="text-gray-600"> · Synced {new Date(lastSync.syncedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
          </p>
        </div>
        <button onClick={handleSync} disabled={syncing}
          className="flex items-center gap-1.5 text-sm bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white border border-gray-700 px-3 py-1.5 rounded-lg transition-colors">
          {syncing && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          {syncing ? 'Syncing...' : '🔄 Sync from Sheets'}
        </button>
      </div>

      {syncMsg && (
        <div className={`text-sm px-4 py-2.5 rounded-xl border ${syncMsg.startsWith('✅') ? 'bg-green-950/40 border-green-800/50 text-green-400' : 'bg-red-950/40 border-red-800/50 text-red-400'}`}>
          {syncMsg}
        </div>
      )}

      {/* All-time totals */}
      <div>
        <p className="text-xs text-gray-600 uppercase tracking-wider mb-3">All Time — Across All Clients</p>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <StatCard label="Total Leads"         value={allTimeTotals.leads.toLocaleString()}      sub="all clients, all time" />
          <StatCard label="Total Tours"         value={allTimeTotals.tours.toLocaleString()}      sub="all clients, all time" />
          <StatCard label="Total Registrations" value={allTimeTotals.registered.toLocaleString()} sub="all clients, all time" highlight />
        </div>
      </div>

      {/* Conversion rates */}
      <div>
        <p className="text-xs text-gray-600 uppercase tracking-wider mb-3">All-Time Average Conversion Rates</p>
        <div className="grid grid-cols-3 gap-3">
          <ConvPill value={allTimeTotals.leadToTour} benchmark={BENCHMARKS.leadToTour} label="Lead → Tour" />
          <ConvPill value={allTimeTotals.tourToReg}  benchmark={BENCHMARKS.tourToReg}  label="Tour → Reg" />
          <ConvPill value={allTimeTotals.leadToReg}  benchmark={BENCHMARKS.leadToReg}  label="Lead → Reg" />
        </div>
      </div>

      {/* Latest month snapshot */}
      {latestMonth && (
        <div>
          <p className="text-xs text-gray-600 uppercase tracking-wider mb-3">
            Latest Month — {fmtMonth(latestMonth.month)} ({latestMonth.clientCount} institutions reporting)
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Leads"         value={latestMonth.leads.toLocaleString()} />
            <StatCard label="Tours"         value={latestMonth.tours.toLocaleString()} />
            <StatCard label="Registrations" value={latestMonth.registered.toLocaleString()} highlight />
            <StatCard label="Avg per Client"
              value={`${latestMonth.avgLeads}L / ${latestMonth.avgRegistered}R`}
              sub={`${latestMonth.leadToReg ?? '—'}% conversion`} />
          </div>
        </div>
      )}

      {/* Trendline chart */}
      <div className="rounded-xl p-5" style={{ backgroundColor: "#111111", border: "1px solid #2a1a3e" }}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="text-white font-semibold">Trends — Last 24 Months</h2>
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
            {CHART_MODES.map(m => (
              <button key={m.id} onClick={() => setChartMode(m.id)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors`} style={chartMode === m.id ? { backgroundColor: "#731494", color: "#fff" } : { color: "#9ca3af" }}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={280}>
          {chartMode === 'volume' ? (
            <ComposedChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Bar dataKey="Leads"      fill="#AE2BCF" opacity={0.8} radius={[2,2,0,0]} />
              <Bar dataKey="Tours"      fill="#732FBA" opacity={0.8} radius={[2,2,0,0]} />
              <Bar dataKey="Registered" fill="#C19C46" opacity={0.9} radius={[2,2,0,0]} />
            </ComposedChart>
          ) : chartMode === 'avg' ? (
            <ComposedChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Line dataKey="Avg Leads" stroke="#AE2BCF" strokeWidth={2} dot={false} />
              <Line dataKey="Avg Tours" stroke="#732FBA" strokeWidth={2} dot={false} />
              <Line dataKey="Avg Reg"   stroke="#C19C46" strokeWidth={2} dot={false} />
            </ComposedChart>
          ) : chartMode === 'conv' ? (
            <ComposedChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} axisLine={false} unit="%" domain={[0, 100]} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Line dataKey="L→T %" stroke="#AE2BCF" strokeWidth={2} dot={false} unit="%" />
              <Line dataKey="T→R %" stroke="#732FBA" strokeWidth={2} dot={false} unit="%" />
              <Line dataKey="L→R %" stroke="#C19C46" strokeWidth={2.5} dot={false} unit="%" />
            </ComposedChart>
          ) : (
            <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <defs>
                <linearGradient id="instGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#AE2BCF" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#AE2BCF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area dataKey="Institutions" stroke="#AE2BCF" strokeWidth={2} fill="url(#instGrad)" dot={false} />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Per Location chart */}
      <div className="rounded-xl p-5" style={{ backgroundColor: "#111111", border: "1px solid #2a1a3e" }}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <h2 className="text-white font-semibold">Per Location — Last 24 Months</h2>
            <p className="text-gray-500 text-xs mt-0.5">
              {latestMonth ? `${latestMonth.locationCount} locations reporting in ${fmtMonth(latestMonth.month)}` : ''}
            </p>
          </div>
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
            {[['avg','Mean'],['median','Median'],['mode','Mode']].map(([val, label]) => (
              <button key={val} onClick={() => setStatMode(val)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${statMode === val ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {statMode === 'avg' && <>
              <Bar dataKey="Leads/Loc" fill="#AE2BCF" opacity={0.8} radius={[2,2,0,0]} />
              <Bar dataKey="Tours/Loc" fill="#732FBA" opacity={0.8} radius={[2,2,0,0]} />
              <Bar dataKey="Reg/Loc"   fill="#C19C46" opacity={0.9} radius={[2,2,0,0]} />
            </>}
            {statMode === 'median' && <>
              <Bar dataKey="Median Leads" fill="#AE2BCF" opacity={0.8} radius={[2,2,0,0]} />
              <Bar dataKey="Median Tours" fill="#732FBA" opacity={0.8} radius={[2,2,0,0]} />
              <Bar dataKey="Median Reg"   fill="#C19C46" opacity={0.9} radius={[2,2,0,0]} />
            </>}
            {statMode === 'mode' && <>
              <Bar dataKey="Mode Leads" fill="#AE2BCF" opacity={0.8} radius={[2,2,0,0]} />
              <Bar dataKey="Mode Tours" fill="#732FBA" opacity={0.8} radius={[2,2,0,0]} />
              <Bar dataKey="Mode Reg"   fill="#C19C46" opacity={0.9} radius={[2,2,0,0]} />
            </>}
          </ComposedChart>
        </ResponsiveContainer>

        {/* Latest month summary numbers */}
        {latestMonth && (
          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-800">
            {[
              { label: 'Leads', blue: true,
                avg: latestMonth.avgLeadsPerLoc, median: latestMonth.medianLeads, mode: latestMonth.modeLeads },
              { label: 'Tours', purple: true,
                avg: latestMonth.avgToursPerLoc, median: latestMonth.medianTours, mode: latestMonth.modeTours },
              { label: 'Registrations', green: true,
                avg: latestMonth.avgRegisteredPerLoc, median: latestMonth.medianRegistered, mode: latestMonth.modeRegistered },
            ].map(col => (
              <div key={col.label} className="text-center">
                <p className={`text-2xl font-bold ${col.blue ? 'text-blue-400' : col.purple ? 'text-purple-400' : 'text-green-400'}`}>
                  {col[statMode]}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {statMode === 'avg' ? 'Mean' : statMode === 'median' ? 'Median' : 'Mode'} {col.label} / Location
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top 5 Leaderboard */}
      <div className="rounded-xl p-5" style={{ backgroundColor: "#111111", border: "1px solid #2a1a3e" }}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="text-white font-semibold">Top 10 Performers</h2>
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
            {LB_PERIODS.map(p => (
              <button key={p.id} onClick={() => setLbPeriod(p.id)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${lbPeriod === p.id ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
            {LEADERBOARD_MODES.map(m => (
              <button key={m.id} onClick={() => setLbMode(m.id)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${lbMode === m.id ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {leaderboard.map((perf, i) => {
            const val    = perf[lbMetric.metric] ?? 0
            const barPct = maxVal > 0 ? (val / maxVal) * 100 : 0
            const rank   = ['#1', '#2', '#3', '#4', '#5'][i]
            return (
              <div key={perf.acronym || i} className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-500 w-6 text-center">{rank}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <span className="text-white font-semibold text-sm">{perf.acronym}</span>
                      {lbPeriod === 'lastMonth' && <span className="text-gray-500 text-xs ml-2">{fmtMonth(lastCompleteMonth)}</span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>{perf.leads} leads</span>
                      <span>{perf.tours} tours</span>
                      <span className="text-green-400 font-semibold">{perf.registered} reg</span>
                      {perf.leadToReg !== null && (
                        <span className={`font-bold ${perf.leadToReg >= BENCHMARKS.leadToReg ? 'text-green-400' : 'text-yellow-400'}`}>
                          {perf.leadToReg}% L→R
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        lbMode === 'conversion'
                          ? perf.leadToReg >= BENCHMARKS.leadToReg ? 'bg-green-500' : 'bg-yellow-500'
                          : 'bg-blue-500'
                      }`}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                </div>
                <span className="text-white font-bold text-sm w-12 text-right">
                  {val.toLocaleString()}{lbMetric.suffix}
                </span>
              </div>
            )
          })}

          {leaderboard.length === 0 && (
            <p className="text-gray-600 text-sm text-center py-4">No recent data — run a sync first</p>
          )}
        </div>
      </div>

      {/* Top 10 Locations */}
      <div className="rounded-xl p-5" style={{ backgroundColor: "#111111", border: "1px solid #2a1a3e" }}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="text-white font-semibold">Top 10 Locations</h2>
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
            {LB_PERIODS.map(p => (
              <button key={p.id} onClick={() => setLb2Period(p.id)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${lb2Period === p.id ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
            {LEADERBOARD_MODES.map(m => (
              <button key={m.id} onClick={() => setLb2Mode(m.id)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${lb2Mode === m.id ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {leaderboard2.map((perf, i) => {
            const val    = perf[lb2Metric.metric] ?? 0
            const barPct = maxVal2 > 0 ? (val / maxVal2) * 100 : 0
            const rank   = ['#1', '#2', '#3', '#4', '#5', '#6', '#7', '#8', '#9', '#10'][i] ?? `#${i + 1}`
            return (
              <div key={perf.acronym || i} className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-500 w-6 text-center">{rank}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <span className="text-white font-semibold text-sm">{perf.acronym}</span>
                      {perf.parent && <span className="text-gray-500 text-xs ml-2">({perf.parent})</span>}
                      {lb2Period === 'lastMonth' && <span className="text-gray-500 text-xs ml-2">{fmtMonth(lastCompleteMonth)}</span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>{perf.leads} leads</span>
                      <span>{perf.tours} tours</span>
                      <span className="text-green-400 font-semibold">{perf.registered} reg</span>
                      {perf.leadToReg !== null && (
                        <span className={`font-bold ${perf.leadToReg >= BENCHMARKS.leadToReg ? 'text-green-400' : 'text-yellow-400'}`}>
                          {perf.leadToReg}% L→R
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        lb2Mode === 'conversion'
                          ? perf.leadToReg >= BENCHMARKS.leadToReg ? 'bg-green-500' : 'bg-yellow-500'
                          : 'bg-blue-500'
                      }`}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                </div>
                <span className="text-white font-bold text-sm w-12 text-right">
                  {val.toLocaleString()}{lb2Metric.suffix}
                </span>
              </div>
            )
          })}

          {leaderboard2.length === 0 && (
            <p className="text-gray-600 text-sm text-center py-4">No recent data — run a sync first</p>
          )}
        </div>
      </div>

      {/* Red Flag — high volume, low conversion */}
      {underperforming?.length > 0 && (
        <div className="bg-gray-900 border border-red-900/40 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-red-400">🚩</span>
            <h2 className="text-white font-semibold">Red Flag — Low Conversion</h2>
            <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full ml-1">
              {underperforming.length} clients
            </span>
          </div>
          <p className="text-gray-500 text-xs mb-4">
            10+ leads · L→R below 18% (70% of {BENCHMARKS.leadToReg}% benchmark) · sorted by volume
          </p>
          <div className="space-y-3">
            {underperforming.map((perf, i) => {
              const barPct = (perf.leads / maxUnderLeads) * 100
              return (
                <div key={perf.acronym || i} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-600 w-5 text-right">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <span className="text-white font-semibold text-sm">{perf.acronym}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-gray-400">{perf.leads} leads</span>
                        <span className="text-gray-400">{perf.tours} tours</span>
                        <span className="text-gray-400">{perf.registered} reg</span>
                        <span className="font-bold text-red-400">{perf.leadToReg}% L→R</span>
                        <span className={perf.leadToTour < BENCHMARKS.leadToTour ? 'text-orange-400' : 'text-gray-500'}>
                          {perf.leadToTour}% L→T
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-red-500/60" style={{ width: `${barPct}%` }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Low Lead Flow — top-of-funnel problem */}
      {lowLeadFlow?.length > 0 && (
        <div className="bg-gray-900 border border-orange-900/40 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-orange-400">📉</span>
            <h2 className="text-white font-semibold">Low Lead Flow</h2>
            <span className="text-xs bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full ml-1">
              {lowLeadFlow.length} clients
            </span>
          </div>
          <p className="text-gray-500 text-xs mb-4">
            Lowest lead volume among reporting clients · top-of-funnel concern · sorted by fewest leads
          </p>
          <div className="space-y-3">
            {lowLeadFlow.map((perf, i) => {
              const maxLow = lowLeadFlow[lowLeadFlow.length - 1]?.leads || 1
              const barPct = (perf.leads / maxLow) * 100
              return (
                <div key={perf.acronym || i} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-600 w-5 text-right">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <span className="text-white font-semibold text-sm">{perf.acronym}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="font-bold text-orange-400">{perf.leads} leads</span>
                        <span className="text-gray-400">{perf.tours} tours</span>
                        <span className="text-gray-400">{perf.registered} reg</span>
                        {perf.leadToReg !== null && (
                          <span className={`font-medium ${perf.leadToReg >= BENCHMARKS.leadToReg ? 'text-green-400' : 'text-gray-500'}`}>
                            {perf.leadToReg}% L→R
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-orange-500/60" style={{ width: `${barPct}%` }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

    </div>
  )
}
