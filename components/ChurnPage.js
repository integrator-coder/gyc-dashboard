'use client'

import { useEffect, useState } from 'react'
import {
  LineChart, Line,
  BarChart, Bar,
  ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import MetricTooltip from '@/components/MetricTooltip'

const TEAL   = '#14B8A6'
const RED    = '#EF4444'
const AMBER  = '#F59E0B'
const GRAY   = '#374151'
const PURPLE = '#A855F7'

const fmt$  = (n) => '$' + Math.abs(Math.round(n ?? 0)).toLocaleString()
const fmtK  = (n) => {
  const abs = Math.abs(n ?? 0)
  const prefix = (n ?? 0) < 0 ? '-$' : '$'
  return abs >= 1000 ? prefix + (abs / 1000).toFixed(0) + 'K' : prefix + Math.round(abs)
}
const fmtPct = (n) => (n != null && n !== 0 ? n.toFixed(1) + '%' : '—')

function trendline(data, dataKey, outKey) {
  const n = data.length
  if (n < 2) return data.map(d => ({ ...d, [outKey]: d[dataKey] ?? 0 }))
  const xs = data.map((_, i) => i)
  const ys = data.map(d => d[dataKey] ?? 0)
  const sumX = xs.reduce((s, x) => s + x, 0)
  const sumY = ys.reduce((s, y) => s + y, 0)
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0)
  const sumXX = xs.reduce((s, x) => s + x * x, 0)
  const denom = n * sumXX - sumX * sumX
  if (denom === 0) return data.map(d => ({ ...d, [outKey]: sumY / n }))
  const slope = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n
  return data.map((d, i) => ({ ...d, [outKey]: parseFloat((slope * i + intercept).toFixed(4)) }))
}

function KpiCard({ label, value, sub, highlight, negative, tooltip }) {
  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-1 ${
      highlight ? 'bg-teal-950 border-teal-700' :
      negative  ? 'bg-red-950/60 border-red-800' :
      'bg-gray-900 border-gray-800'
    }`}>
      <p className="text-gray-400 text-xs font-medium uppercase tracking-wide leading-tight flex items-center">
        {label}
        {tooltip && <MetricTooltip text={tooltip} />}
      </p>
      <p className={`text-xl font-bold leading-snug ${
        highlight ? 'text-teal-300' : negative ? 'text-red-400' : 'text-white'
      }`}>{value}</p>
      {sub && <p className="text-gray-300 text-xs leading-snug">{sub}</p>}
    </div>
  )
}

const ChartTip = ({ active, payload, label, fmtVal }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm min-w-[140px]">
      <p className="text-white font-semibold mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {fmtVal ? fmtVal(p.value) : p.value}
        </p>
      ))}
    </div>
  )
}

export default function ChurnPage() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [activeTab, setActiveTab] = useState('marketing')

  useEffect(() => {
    fetch('/api/metrics/churn')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      Loading churn data…
    </div>
  )
  if (error || data?.error) return (
    <div className="text-red-400 p-6">Error: {error || data?.error}</div>
  )

  const section  = activeTab === 'marketing' ? data.marketing : data.recruiting
  const { monthly } = section
  const latest   = monthly.length > 0 ? monthly[monthly.length - 1] : {}
  const first    = monthly.length > 0 ? monthly[0] : {}

  // NRR, GRR, AvgDaysToChurn — only available for marketing tab
  const nrr            = activeTab === 'marketing' ? data.marketing?.nrr            : null
  const grr            = activeTab === 'marketing' ? data.marketing?.grr            : null
  const avgDaysToChurn = activeTab === 'marketing' ? data.marketing?.avgDaysToChurn : null
  const nrrColor = (v) => {
    if (v == null) return 'text-gray-400'
    if (v >= 100) return 'text-teal-400'
    if (v >= 90)  return 'text-amber-400'
    return 'text-red-400'
  }
  const nrrBg = (v) => {
    if (v == null) return 'bg-gray-900 border-gray-800'
    if (v >= 100) return 'bg-teal-950 border-teal-700'
    if (v >= 90)  return 'bg-amber-950/60 border-amber-700'
    return 'bg-red-950/60 border-red-800'
  }

  // Augment chart data with negated lostMRR for the bar chart
  // Filter out outlier churn % values (>20%) that skew the scale — typically first-month artifacts
  const chartData = monthly.map(m => ({
    ...m,
    lostMRRNeg: m.lostMRR ? -Math.abs(m.lostMRR) : 0,
    churnPct:    m.churnPct    > 20 ? null : m.churnPct,
    churnRevPct: m.churnRevPct > 20 ? null : m.churnRevPct,
  }))

  // Avg Days to Churn chart — only show from Nov 2023 onward (filter sparse early months)
  const avgDaysChartData = (data?.marketing?.monthly || []).filter(m => {
    if (!m.avgDaysToChurn || m.avgDaysToChurn <= 0) return false
    // Parse "Nov-23" format — months from Nov 2023 onward
    const parts = m.month?.split('-')
    if (!parts || parts.length !== 2) return false
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const monthIdx = monthNames.indexOf(parts[0])
    const year = 2000 + parseInt(parts[1], 10)
    const d = new Date(year, monthIdx, 1)
    return d >= new Date(2023, 10, 1) // Nov 2023
  })

  // Zoom-ins: year-to-date (auto-grows month by month)
  const latestMonth = chartData[chartData.length - 1]?.month || ''
  const latestYearSuffix = latestMonth.split('-')[1] || ''
  const ytdData = chartData.filter(m => (m.month?.split('-')[1] || '') === latestYearSuffix)
  const churnZoom = trendline(ytdData, 'churnPct', 'trendChurnPct')
  const mrrZoom = trendline(
    trendline(ytdData, 'newMRR', 'trendNewMRR'),
    'lostMRRNeg',
    'trendLostMRRNeg'
  )

  // Yearly summaries
  const yearSummaries = (() => {
    const years = {}
    for (const m of monthly) {
      const yr = m.month?.split('-')[1] ? '20' + m.month.split('-')[1] : null
      if (!yr) continue
      if (!years[yr]) years[yr] = {
        year: yr, clientsLost: 0, clientsAdded: 0,
        mrrLost: 0, mrrAdded: 0, netMRR: 0,
        churnPcts: [], months: [],
        startMRR: null, endMRR: null,
        startClients: null, endClients: null,
      }
      const y = years[yr]
      y.clientsLost += m.clientsLost || 0
      y.clientsAdded += m.clientsAdded || 0
      y.mrrLost += m.lostMRR || 0
      y.mrrAdded += m.newMRR || 0
      y.netMRR += m.netMRR || 0
      if (m.churnPct != null && m.churnPct > 0 && m.churnPct <= 20) y.churnPcts.push(m.churnPct)
      y.months.push(m)
      if (y.startMRR === null && m.totalMRR) y.startMRR = m.totalMRR
      if (m.totalMRR) y.endMRR = m.totalMRR
      if (y.startClients === null && m.clientCount) y.startClients = m.clientCount
      if (m.clientCount) y.endClients = m.clientCount
    }
    return Object.values(years).sort((a, b) => a.year - b.year).map(y => ({
      ...y,
      avgChurnPct: y.churnPcts.length ? (y.churnPcts.reduce((s, v) => s + v, 0) / y.churnPcts.length) : null,
      netClients: y.clientsAdded - y.clientsLost,
    }))
  })()

  return (
    <div className="space-y-6">

      {/* ── Header + Tabs ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Churn</h1>
          <p className="text-gray-400 text-sm mt-1">
            Client retention · MRR trends · Data refreshed {new Date(data.updatedAt).toLocaleString()}
            {data.latestMonthIsPartial ? ' · Current month is month-to-date' : ''}
          </p>
        </div>
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1">
          {['marketing', 'recruiting'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      {monthly.length === 0 ? (
        <div className="text-gray-400 text-sm">No data available for this section.</div>
      ) : (
        <>
          {/* KPI Cards — current month snapshot */}
          <p className="text-gray-300 text-xs uppercase tracking-wide font-medium">
            Latest Month Snapshot — {latest.month}
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <KpiCard
              label="Active Clients"
              value={latest.clientCount != null ? latest.clientCount.toLocaleString() : '—'}
              sub={`${first.clientCount != null ? (latest.clientCount - first.clientCount > 0 ? '+' : '') + (latest.clientCount - first.clientCount) + ' since ' + first.month : ''}`}
              highlight
              tooltip="Total number of active clients at the end of the latest month. Source: Google Sheets (client count row)."
            />
            <KpiCard
              label="Total MRR"
              value={latest.totalMRR ? fmt$(latest.totalMRR) : '—'}
              sub={`Avg ${latest.avgMRR ? fmt$(latest.avgMRR) : '—'} per client`}
              tooltip="Total Monthly Recurring Revenue from all active clients in the latest month. Average per client = Total MRR ÷ Active Clients. Source: Google Sheets."
            />
            <KpiCard
              label="Client Churn Rate"
              value={fmtPct(latest.churnPct)}
              sub="% of clients cancelled — healthy: <2%"
              negative={latest.churnPct > 3}
              tooltip="Unique customers truly lost ÷ opening active customers. Multiple canceled subscriptions count once, and confirmed Monthly → PIF conversions are excluded. Healthy target: <2%."
            />
            <KpiCard
              label="Revenue Churn Rate"
              value={fmtPct(latest.churnRevPct)}
              sub="% of MRR lost — healthy: <3%"
              negative={latest.churnRevPct > 3}
              tooltip="MRR lost from true cancellations ÷ opening MRR. Confirmed Monthly → PIF movements are deferred retained value and excluded. Healthy target: <3%."
            />
            <KpiCard
              label="Net MRR Change"
              value={latest.netMRR != null
                ? (latest.netMRR >= 0 ? '+' : '-') + fmt$(latest.netMRR)
                : '—'}
              sub={`New: ${latest.newMRR ? fmt$(latest.newMRR) : '—'} · Lost: ${latest.lostMRR ? fmt$(latest.lostMRR) : '—'}`}
              highlight={latest.netMRR > 0}
              negative={latest.netMRR < 0}
              tooltip="Net MRR movement in the period. Formula: New MRR Added − MRR Lost from cancellations. Positive = growing, negative = shrinking. Source: Google Sheets row 22."
            />
            <KpiCard
              label="Client Movement"
              value={`-${latest.clientsLost ?? 0} / +${latest.clientsAdded ?? 0}`}
              sub={`Net ${(latest.clientsAdded ?? 0) - (latest.clientsLost ?? 0) >= 0 ? '+' : ''}${(latest.clientsAdded ?? 0) - (latest.clientsLost ?? 0)} clients this month`}
              negative={(latest.clientsLost ?? 0) > (latest.clientsAdded ?? 0)}
              tooltip="Unique customers truly lost vs clients gained this month. Multiple canceled subscriptions for one customer count once. Confirmed Monthly → PIF conversions are excluded. Net = Clients Added − Clients Lost."
            />
          </div>

          {activeTab === 'marketing' && data.lateralMovements?.confirmed?.length > 0 && (
            <section className="bg-blue-950/30 border border-blue-800 rounded-xl p-5 space-y-4">
              <div>
                <h2 className="text-white font-semibold">Monthly → PIF Lateral Movements</h2>
                <p className="text-gray-300 text-xs mt-1">
                  Confirmed clients who moved from monthly billing to an upfront term. Their MRR is temporarily offline, so they are excluded from true churn and scheduled for recurring return.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard label="Confirmed Conversions" value={data.lateralMovements.totals.count} sub="Excluded from clients lost" />
                <KpiCard label="MRR Moved Offline" value={fmt$(data.lateralMovements.totals.mrrMoved)} sub="Deferred, not lost" />
                <KpiCard label="New Recurring MRR" value={fmt$(data.lateralMovements.totals.returningMrr)} sub={data.lateralMovements.totals.returningMrrPendingCount ? `${data.lateralMovements.totals.returningMrrPendingCount} deal mapping pending` : 'Scheduled to return'} highlight />
                <KpiCard label="PIF Cash Received" value={fmt$(data.lateralMovements.totals.pifCashReceived)} sub={data.lateralMovements.totals.pifCashPendingCount ? `${data.lateralMovements.totals.pifCashPendingCount} payment pending verification` : 'Verified upfront cash'} highlight />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-gray-400 text-xs uppercase">
                    <tr className="border-b border-blue-900">
                      <th className="text-left py-2 pr-4">Client</th>
                      <th className="text-right py-2 px-4">MRR moved</th>
                      <th className="text-right py-2 px-4">PIF cash</th>
                      <th className="text-right py-2 px-4">Term</th>
                      <th className="text-right py-2 px-4">New recurring MRR</th>
                      <th className="text-right py-2 pl-4">Return date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.lateralMovements.confirmed.map(row => (
                      <tr key={`${row.stripeCustomerId}-${row.movementDate}`} className="border-b border-blue-950 text-gray-200">
                        <td className="py-3 pr-4"><span className="font-medium text-white">{row.clientName}</span><br /><span className="text-xs text-gray-400">Moved {new Date(row.movementDate).toLocaleDateString('en-US', { timeZone: 'UTC' })}</span></td>
                        <td className="text-right py-3 px-4">{fmt$(row.mrrMoved)}</td>
                        <td className="text-right py-3 px-4 text-teal-300">{row.pifCashReceived == null ? 'Pending verification' : fmt$(row.pifCashReceived)}</td>
                        <td className="text-right py-3 px-4">{row.termMonths} months</td>
                        <td className="text-right py-3 px-4"><span className="text-teal-300">{row.returningMrr == null ? 'Needs deal mapping' : fmt$(row.returningMrr)}</span>{row.returningProgram && <><br /><span className="text-xs text-gray-400">{row.returningProgram}</span></>}</td>
                        <td className="text-right py-3 pl-4">{new Date(row.scheduledReturnDate).toLocaleDateString('en-US', { timeZone: 'UTC' })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-gray-400 text-xs">Policy: {data.lateralMovements.policy} June&apos;s unmatched PIF deals remain unclassified.</p>
            </section>
          )}

          {/* Yearly Summaries */}
          <p className="text-gray-300 text-xs uppercase tracking-wide font-medium">Year-by-Year Summary</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {yearSummaries.map(y => (
              <div key={y.year} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-teal-400 text-sm font-bold mb-3">{y.year}</p>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">MRR range</span>
                    <span className="text-white font-medium">{y.startMRR ? fmtK(y.startMRR) : '—'} → {y.endMRR ? fmtK(y.endMRR) : '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Client range</span>
                    <span className="text-white font-medium">{y.startClients ?? '—'} → {y.endClients ?? '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Clients lost</span>
                    <span className={y.clientsLost > 0 ? 'text-red-400 font-medium' : 'text-white'}>{y.clientsLost}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Clients added</span>
                    <span className="text-teal-400 font-medium">+{y.clientsAdded}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Net clients</span>
                    <span className={y.netClients >= 0 ? 'text-teal-400 font-medium' : 'text-red-400 font-medium'}>{y.netClients >= 0 ? '+' : ''}{y.netClients}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">MRR lost</span>
                    <span className="text-red-400 font-medium">-{fmtK(y.mrrLost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">MRR added</span>
                    <span className="text-teal-400 font-medium">+{fmtK(y.mrrAdded)}</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-800 pt-1.5 mt-1.5">
                    <span className="text-gray-400">Net MRR</span>
                    <span className={y.netMRR >= 0 ? 'text-teal-400 font-bold' : 'text-red-400 font-bold'}>{y.netMRR >= 0 ? '+' : '-'}{fmtK(y.netMRR)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Avg churn rate</span>
                    <span className={y.avgChurnPct > 3 ? 'text-red-400 font-medium' : y.avgChurnPct > 2 ? 'text-amber-400 font-medium' : 'text-teal-400 font-medium'}>
                      {y.avgChurnPct != null ? y.avgChurnPct.toFixed(1) + '%' : '—'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── NRR (Net Revenue Retention) — marketing only ─────────── */}
          {nrr && (
            <>
              <p className="text-gray-300 text-xs uppercase tracking-wide font-medium">
                Net Revenue Retention (NRR)
              </p>

              {/* NRR KPI cards */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Current month */}
                <div className={`rounded-xl border p-4 flex flex-col gap-1 ${nrrBg(nrr.currentMonth)}`}>
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide leading-tight flex items-center">
                    Current Month NRR
                    <MetricTooltip text="Net Revenue Retention for the most recent month. Formula: (Starting MRR + Upsells − Reductions − Cancellations) ÷ Starting MRR × 100. Above 100% means existing clients are growing revenue on their own. Source: Google Sheets upsell/reduction/cancellation rows." />
                  </p>
                  <p className={`text-2xl font-bold leading-snug ${nrrColor(nrr.currentMonth)}`}>
                    {nrr.currentMonth != null ? nrr.currentMonth.toFixed(1) + '%' : '—'}
                  </p>
                  <p className="text-gray-300 text-xs leading-snug">
                    {nrr.currentMonth != null
                      ? nrr.currentMonth >= 100
                        ? 'Existing clients growing ✓'
                        : nrr.currentMonth >= 90
                          ? 'Slight revenue shrink from base'
                          : 'Revenue shrinking from base ✗'
                      : 'No data'}
                  </p>
                </div>

                {/* Trailing 3-month */}
                <div className={`rounded-xl border p-4 flex flex-col gap-1 ${nrrBg(nrr.trailing3mo)}`}>
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide leading-tight flex items-center">
                    Trailing 3-Month NRR
                    <MetricTooltip text="Average Net Revenue Retention over the last 3 months. Smooths out single-month noise. Same formula as Current Month NRR, averaged across 3 periods." />
                  </p>
                  <p className={`text-2xl font-bold leading-snug ${nrrColor(nrr.trailing3mo)}`}>
                    {nrr.trailing3mo != null ? nrr.trailing3mo.toFixed(1) + '%' : '—'}
                  </p>
                  <p className="text-gray-300 text-xs leading-snug">Avg over last 3 months</p>
                </div>

                {/* Trailing 12-month */}
                <div className={`rounded-xl border p-4 flex flex-col gap-1 ${nrrBg(nrr.trailing12mo)}`}>
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide leading-tight flex items-center">
                    Trailing 12-Month NRR
                    <MetricTooltip text="Average Net Revenue Retention over the last 12 months. Best-in-class SaaS benchmark: 110–130%. Outlier months (NRR <0% or >200%) are filtered. Formula: (Starting MRR + Upsells − Reductions − Cancellations) ÷ Starting MRR × 100." />
                  </p>
                  <p className={`text-2xl font-bold leading-snug ${nrrColor(nrr.trailing12mo)}`}>
                    {nrr.trailing12mo != null ? nrr.trailing12mo.toFixed(1) + '%' : '—'}
                  </p>
                  <p className="text-gray-300 text-xs leading-snug">
                    Best-in-class SaaS: 110–130%
                  </p>
                </div>
              </div>

              {/* NRR Split KPI cards — Monthly vs PIF */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Monthly Subscribers NRR */}
                <div className={`rounded-xl border p-4 flex flex-col gap-1 ${nrrBg(nrr.monthlyCurrentMonth)}`}>
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide leading-tight flex items-center">
                    Current Month — Monthly Sub NRR
                    <MetricTooltip text="Net Revenue Retention for monthly subscription clients only. Shows how well monthly recurring revenue is being retained and expanded." />
                  </p>
                  <p className={`text-2xl font-bold leading-snug ${nrrColor(nrr.monthlyCurrentMonth)}`}>
                    {nrr.monthlyCurrentMonth != null ? nrr.monthlyCurrentMonth.toFixed(1) + '%' : '—'}
                  </p>
                  <p className="text-gray-300 text-xs leading-snug">
                    Monthly subscribers only
                  </p>
                </div>

                {/* PIF (Annual) NRR */}
                <div className={`rounded-xl border p-4 flex flex-col gap-1 ${nrrBg(nrr.pifCurrentMonth)}`}>
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide leading-tight flex items-center">
                    Current Month — PIF NRR
                    <MetricTooltip text="Net Revenue Retention for Pay-in-Full (annual) clients. Shows how well annual subscription revenue is being retained and expanded." />
                  </p>
                  <p className={`text-2xl font-bold leading-snug ${nrrColor(nrr.pifCurrentMonth)}`}>
                    {nrr.pifCurrentMonth != null ? nrr.pifCurrentMonth.toFixed(1) + '%' : '—'}
                  </p>
                  <p className="text-gray-300 text-xs leading-snug">
                    Annual (PIF) subscribers only
                  </p>
                </div>
              </div>

              {/* NRR line chart */}
              {nrr.monthly?.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <h2 className="text-white font-semibold mb-1 flex items-center">
                    NRR Over Time
                    <MetricTooltip text="Monthly NRR trend. Each point = (Starting MRR + Upsells − Reductions − Cancellations) ÷ Starting MRR × 100. Hover a point to see the component values. Outliers filtered." />
                  </h2>
                  <p className="text-gray-300 text-xs mb-4">
                    Monthly Net Revenue Retention · 100% = breakeven · 110% = best-in-class
                  </p>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart
                      data={nrr.monthly}
                      margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis
                        dataKey="month"
                        tick={{ fill: '#9CA3AF', fontSize: 10 }}
                        interval="preserveStartEnd"
                        minTickGap={36}
                      />
                      <YAxis
                        tickFormatter={v => v + '%'}
                        tick={{ fill: '#9CA3AF', fontSize: 11 }}
                        width={52}
                        domain={['auto', 'auto']}
                      />
                      {/* Breakeven */}
                      <ReferenceLine
                        y={100}
                        stroke="#6B7280"
                        strokeWidth={1.5}
                        label={{ value: 'breakeven', fill: '#9CA3AF', fontSize: 10, position: 'insideTopRight' }}
                      />
                      {/* Best-in-class */}
                      <ReferenceLine
                        y={110}
                        stroke={TEAL}
                        strokeDasharray="5 3"
                        strokeWidth={1.5}
                        label={{ value: 'best-in-class', fill: TEAL, fontSize: 10, position: 'insideTopRight' }}
                      />
                      <Tooltip
                        content={({ active, payload, label }) =>
                          active && payload?.length ? (
                            <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm min-w-[200px]">
                              <p className="text-white font-semibold mb-1">{label}</p>
                              <p className={nrrColor(payload[0].value)}>
                                NRR: {payload[0].value?.toFixed(1)}%
                              </p>
                              {payload[0].payload && (
                                <div className="mt-1 text-gray-400 text-xs space-y-0.5">
                                  {payload[0].payload.startMRR != null && <p>Start MRR: {fmt$(payload[0].payload.startMRR)}</p>}
                                  <p>Source: {payload[0].payload.source}</p>
                                  {payload[0].payload.source !== 'Stripe cohort' && <p>Upsells: +{fmt$(payload[0].payload.upsells)}</p>}
                                  {payload[0].payload.source !== 'Stripe cohort' && <p>Reductions: -{fmt$(payload[0].payload.reductions)}</p>}
                                  <p>Cancellations: -{fmt$(payload[0].payload.cancellations)}</p>
                                </div>
                              )}
                            </div>
                          ) : null
                        }
                      />
                      <Line
                        type="monotone"
                        dataKey="nrr"
                        name="Combined NRR"
                        stroke={
                          nrr.currentMonth != null && nrr.currentMonth >= 100
                            ? TEAL
                            : nrr.currentMonth != null && nrr.currentMonth >= 90
                              ? AMBER
                              : RED
                        }
                        strokeWidth={2.5}
                        dot={false}
                        connectNulls
                      />
                      <Line
                        type="monotone"
                        dataKey="monthlyNRR"
                        name="Monthly NRR"
                        stroke="#10B981"
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                        strokeDasharray="6 2"
                      />
                      <Line
                        type="monotone"
                        dataKey="pifNRR"
                        name="PIF NRR"
                        stroke="#F59E0B"
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                        strokeDasharray="6 2"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}

          {/* ── GRR (Gross Revenue Retention) — marketing only ─────────── */}
          {grr && (
            <>
              <p className="text-gray-300 text-xs uppercase tracking-wide font-medium">
                Gross Revenue Retention (GRR)
              </p>

              {/* GRR KPI cards */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Current month */}
                <div className="rounded-xl border p-4 flex flex-col gap-1 bg-teal-950 border-teal-700">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide leading-tight flex items-center">
                    Current Month GRR
                    <MetricTooltip text="Gross Revenue Retention — % of MRR kept excluding expansions. Formula: (Starting MRR - Churned MRR) ÷ Starting MRR × 100. 100% = perfect retention." />
                  </p>
                  <p className="text-2xl font-bold leading-snug text-teal-300">
                    {grr.current != null ? grr.current.toFixed(1) + '%' : '—'}
                  </p>
                  <p className="text-gray-300 text-xs leading-snug">
                    {grr.current != null
                      ? grr.current >= 98
                        ? 'Strong retention ✓'
                        : grr.current >= 95
                          ? 'Moderate revenue shrink'
                          : 'High revenue erosion ✗'
                      : 'No data'}
                  </p>
                </div>

                {/* Trailing 3-month */}
                <div className="rounded-xl border p-4 flex flex-col gap-1 bg-teal-950 border-teal-700">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide leading-tight flex items-center">
                    Trailing 3-Month GRR
                    <MetricTooltip text="Gross Revenue Retention — % of MRR kept excluding expansions. Formula: (Starting MRR - Churned MRR) ÷ Starting MRR × 100. 100% = perfect retention." />
                  </p>
                  <p className="text-2xl font-bold leading-snug text-teal-300">
                    {grr.trailing3m != null ? grr.trailing3m.toFixed(1) + '%' : '—'}
                  </p>
                  <p className="text-gray-300 text-xs leading-snug">Avg over last 3 months</p>
                </div>

                {/* Trailing 12-month */}
                <div className="rounded-xl border p-4 flex flex-col gap-1 bg-teal-950 border-teal-700">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide leading-tight flex items-center">
                    Trailing 12-Month GRR
                    <MetricTooltip text="Gross Revenue Retention — % of MRR kept excluding expansions. Formula: (Starting MRR - Churned MRR) ÷ Starting MRR × 100. 100% = perfect retention." />
                  </p>
                  <p className="text-2xl font-bold leading-snug text-teal-300">
                    {grr.trailing12m != null ? grr.trailing12m.toFixed(1) + '%' : '—'}
                  </p>
                  <p className="text-gray-300 text-xs leading-snug">
                    Best-in-class: &gt;95%
                  </p>
                </div>
              </div>

              {/* GRR line chart */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h2 className="text-white font-semibold mb-1 flex items-center">
                  GRR Over Time
                  <MetricTooltip text="Gross Revenue Retention — % of MRR kept excluding expansions. Formula: (Starting MRR - Churned MRR) ÷ Starting MRR × 100. 100% = perfect retention." />
                </h2>
                <p className="text-gray-300 text-xs mb-4">
                  Monthly Gross Revenue Retention · 100% = no revenue lost · excludes upsells
                </p>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart
                    data={chartData.filter(d => d.grr != null)}
                    margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: '#9CA3AF', fontSize: 10 }}
                      interval="preserveStartEnd"
                      minTickGap={36}
                    />
                    <YAxis
                      tickFormatter={v => v + '%'}
                      tick={{ fill: '#9CA3AF', fontSize: 11 }}
                      width={52}
                      domain={[80, 100]}
                    />
                    <ReferenceLine
                      y={100}
                      stroke="#6B7280"
                      strokeWidth={1.5}
                      label={{ value: '100%', fill: '#9CA3AF', fontSize: 10, position: 'insideTopRight' }}
                    />
                    <Tooltip
                      content={({ active, payload, label }) =>
                        active && payload?.length ? (
                          <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm min-w-[160px]">
                            <p className="text-white font-semibold mb-1">{label}</p>
                            <p style={{ color: TEAL }}>GRR: {payload[0].value?.toFixed(1)}%</p>
                          </div>
                        ) : null
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="grr"
                      name="GRR"
                      stroke={TEAL}
                      strokeWidth={2.5}
                      dot={false}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {/* ── Avg Days to Churn — marketing only ───────────────────────── */}
          {avgDaysToChurn && (
            <>
              <p className="text-gray-300 text-xs uppercase tracking-wide font-medium">
                Implied Client Lifetime
              </p>

              {/* Avg Days KPI cards */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Current month */}
                <div className="rounded-xl border p-4 flex flex-col gap-1 bg-purple-950/60 border-purple-800">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide leading-tight flex items-center">
                    Current Implied Lifetime
                    <MetricTooltip text="Modeled client lifetime based on the current monthly churn rate. Formula: (1 ÷ Monthly Churn Rate) × 30. This is not observed cancellation tenure." />
                  </p>
                  <p className="text-2xl font-bold leading-snug text-purple-300">
                    {avgDaysToChurn.current != null ? avgDaysToChurn.current.toLocaleString() + 'd' : '—'}
                  </p>
                  <p className="text-gray-300 text-xs leading-snug">
                    {avgDaysToChurn.current != null
                      ? avgDaysToChurn.current >= 365
                        ? 'Long-term clients ✓'
                        : avgDaysToChurn.current >= 180
                          ? 'Moderate tenure'
                          : 'Short tenure — high churn risk ✗'
                      : 'No data'}
                  </p>
                </div>

                {/* Trailing 3-month */}
                <div className="rounded-xl border p-4 flex flex-col gap-1 bg-purple-950/60 border-purple-800">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide leading-tight flex items-center">
                    Trailing 3-Month Lifetime
                    <MetricTooltip text="Average modeled client lifetime over the latest three months. This is inferred from churn rate, not observed cancellation tenure." />
                  </p>
                  <p className="text-2xl font-bold leading-snug text-purple-300">
                    {avgDaysToChurn.trailing3m != null ? avgDaysToChurn.trailing3m.toLocaleString() + 'd' : '—'}
                  </p>
                  <p className="text-gray-300 text-xs leading-snug">Avg over last 3 months</p>
                </div>

                {/* Trailing 12-month */}
                <div className="rounded-xl border p-4 flex flex-col gap-1 bg-purple-950/60 border-purple-800">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide leading-tight flex items-center">
                    Trailing 12-Month Lifetime
                    <MetricTooltip text="Average modeled client lifetime over the latest twelve months. This is inferred from churn rate, not observed cancellation tenure." />
                  </p>
                  <p className="text-2xl font-bold leading-snug text-purple-300">
                    {avgDaysToChurn.trailing12m != null ? avgDaysToChurn.trailing12m.toLocaleString() + 'd' : '—'}
                  </p>
                  <p className="text-gray-300 text-xs leading-snug">
                    Higher = better client retention
                  </p>
                </div>
              </div>

              {/* Avg Days line chart */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h2 className="text-white font-semibold mb-1 flex items-center">
                  Implied Client Lifetime Over Time
                  <MetricTooltip text="Modeled lifetime derived from monthly churn: (1 ÷ churn rate) × 30. This is not observed cancellation tenure." />
                </h2>
                <p className="text-gray-300 text-xs mb-4">
                  Higher = clients staying longer · null months excluded (zero churn = infinite days)
                </p>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart
                    data={avgDaysChartData}
                    margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: '#9CA3AF', fontSize: 10 }}
                      interval="preserveStartEnd"
                      minTickGap={36}
                    />
                    <YAxis
                      tickFormatter={v => v + 'd'}
                      tick={{ fill: '#9CA3AF', fontSize: 11 }}
                      width={60}
                      domain={[0, 'auto']}
                    />
                    <Tooltip
                      content={({ active, payload, label }) =>
                        active && payload?.length ? (
                          <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm min-w-[180px]">
                            <p className="text-white font-semibold mb-1">{label}</p>
                            <p style={{ color: PURPLE }}>Implied lifetime: {payload[0].value?.toLocaleString()}d</p>
                          </div>
                        ) : null
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="avgDaysToChurn"
                      name="Implied Client Lifetime"
                      stroke={PURPLE}
                      strokeWidth={2.5}
                      dot={false}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {/* ── Row 1: Client Count + Total MRR ─────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-white font-semibold mb-1">Client Count</h2>
              <p className="text-gray-300 text-xs mb-4">Full history</p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" tick={{ fill: '#9CA3AF', fontSize: 10 }} interval="preserveStartEnd" minTickGap={36} />
                  <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} width={48} />
                  <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm">
                      <p className="text-white font-semibold mb-1">{label}</p>
                      <p style={{ color: TEAL }}>Clients: {payload[0].value?.toLocaleString()}</p>
                    </div>
                  ) : null} />
                  <Line type="monotone" dataKey="clientCount" name="Clients" stroke={TEAL} strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-white font-semibold mb-1">Total MRR</h2>
              <p className="text-gray-300 text-xs mb-4">Full history</p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" tick={{ fill: '#9CA3AF', fontSize: 10 }} interval="preserveStartEnd" minTickGap={36} />
                  <YAxis tickFormatter={fmtK} tick={{ fill: '#9CA3AF', fontSize: 11 }} width={56} />
                  <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm">
                      <p className="text-white font-semibold mb-1">{label}</p>
                      <p style={{ color: TEAL }}>MRR: {fmt$(payload[0].value)}</p>
                    </div>
                  ) : null} />
                  <Line type="monotone" dataKey="totalMRR" name="Total MRR" stroke={TEAL} strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Row 2: Year-to-Date Zoom-Ins ─────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Zoom-In: Monthly Churn Rate */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-white font-semibold mb-1 flex items-center">
                Monthly Churn Rate (Year to Date)
                <MetricTooltip text="Client churn % month by month, year to date. Dashed line = linear trendline. Values >20% filtered as artifacts. Amber reference line at 3% = warning threshold. Source: Google Sheets row 13." />
              </h2>
              <p className="text-gray-300 text-xs mb-4">YTD + trendline (auto-expands each month)</p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={churnZoom} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                  <YAxis tickFormatter={v => v + '%'} tick={{ fill: '#9CA3AF', fontSize: 11 }} width={44} />
                  <ReferenceLine y={3} stroke={AMBER} strokeDasharray="4 2" label={{ value: '3%', fill: AMBER, fontSize: 10, position: 'right' }} />
                  <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm">
                      <p className="text-white font-semibold mb-1">{label}</p>
                      {payload.map(p => (
                        <p key={p.name} style={{ color: p.color }}>{p.name}: {p.value?.toFixed?.(1)}%</p>
                      ))}
                    </div>
                  ) : null} />
                  <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }} />
                  <Line type="monotone" dataKey="churnPct" name="Client Churn %" stroke={RED} strokeWidth={2.5} dot />
                  <Line type="monotone" dataKey="trendChurnPct" name="Trend" stroke="#9CA3AF" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Zoom-In: Lost vs Added MRR */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-white font-semibold mb-1 flex items-center">
                Lost vs Added MRR (Year to Date)
                <MetricTooltip text="New MRR added (teal bars) vs MRR lost from cancellations (red bars) each month, year to date. Amber line = Net MRR (New − Lost). Trendlines show direction of travel." />
              </h2>
              <p className="text-gray-300 text-xs mb-4">YTD + trendlines (auto-expands each month)</p>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={mrrZoom} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                  <YAxis tickFormatter={fmtK} tick={{ fill: '#9CA3AF', fontSize: 11 }} width={56} />
                  <ReferenceLine y={0} stroke="#6B7280" strokeWidth={1} />
                  <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm">
                      <p className="text-white font-semibold mb-1">{label}</p>
                      {payload.map(p => (
                        <p key={p.name} style={{ color: p.color }}>{p.name}: {fmt$(p.value)}</p>
                      ))}
                    </div>
                  ) : null} />
                  <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }} />
                  <Bar  dataKey="newMRR" name="New MRR" fill={TEAL} radius={[4, 4, 0, 0]} />
                  <Bar  dataKey="lostMRRNeg" name="Lost MRR" fill={RED} radius={[0, 0, 4, 4]} />
                  <Line type="monotone" dataKey="netMRR" name="Net MRR" stroke={AMBER} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="trendNewMRR" name="New Trend" stroke={TEAL} strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                  <Line type="monotone" dataKey="trendLostMRRNeg" name="Lost Trend" stroke="#9CA3AF" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Row 3: Churn Rate + Lost vs Added MRR (Full History) ─────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Churn Rate */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-white font-semibold mb-1 flex items-center">
                Monthly Churn Rate
                <MetricTooltip text="Full history of client churn % (red) and revenue churn % (amber dashed). Client churn = cancelled clients ÷ total clients. Revenue churn = MRR lost ÷ total MRR. Source: Google Sheets rows 13–14." />
              </h2>
              <p className="text-gray-300 text-xs mb-4">Client count &amp; revenue churn over time</p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" tick={{ fill: '#9CA3AF', fontSize: 10 }} interval="preserveStartEnd" minTickGap={36} />
                  <YAxis tickFormatter={v => v + '%'} tick={{ fill: '#9CA3AF', fontSize: 11 }} width={44} />
                  <ReferenceLine y={3} stroke={AMBER} strokeDasharray="4 2" label={{ value: '3%', fill: AMBER, fontSize: 10, position: 'right' }} />
                  <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm">
                      <p className="text-white font-semibold mb-1">{label}</p>
                      {payload.map(p => (
                        <p key={p.name} style={{ color: p.color }}>{p.name}: {p.value?.toFixed(1)}%</p>
                      ))}
                    </div>
                  ) : null} />
                  <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }} />
                  <Line type="monotone" dataKey="churnPct"    name="Client Churn %"  stroke={RED}   strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="churnRevPct" name="Revenue Churn %"  stroke={AMBER} strokeWidth={2}   strokeDasharray="4 2" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Lost vs Added MRR */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-white font-semibold mb-1 flex items-center">
                Lost vs Added MRR
                <MetricTooltip text="Full history of New MRR added (teal bars) vs MRR lost from cancellations (red bars). Amber line = Net MRR = New MRR − Lost MRR. Positive net = revenue growing. Source: Google Sheets rows 20–22." />
              </h2>
              <p className="text-gray-300 text-xs mb-4">New MRR (teal) vs Lost MRR (red) + net line</p>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" tick={{ fill: '#9CA3AF', fontSize: 10 }} interval="preserveStartEnd" minTickGap={36} />
                  <YAxis tickFormatter={fmtK} tick={{ fill: '#9CA3AF', fontSize: 11 }} width={56} />
                  <ReferenceLine y={0} stroke="#6B7280" strokeWidth={1} />
                  <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm">
                      <p className="text-white font-semibold mb-1">{label}</p>
                      {payload.map(p => (
                        <p key={p.name} style={{ color: p.color }}>{p.name}: {fmt$(p.value)}</p>
                      ))}
                    </div>
                  ) : null} />
                  <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }} />
                  <Bar  dataKey="newMRR"    name="New MRR"  fill={TEAL} radius={[4, 4, 0, 0]} />
                  <Bar  dataKey="lostMRRNeg" name="Lost MRR" fill={RED}  radius={[0, 0, 4, 4]} />
                  <Line type="monotone" dataKey="netMRR" name="Net MRR" stroke={AMBER} strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>


        </>
      )}
    </div>
  )
}
