'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  LineChart, Line,
  ComposedChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

function formatCurrency(value) {
  if (value === null || value === undefined) return '—'
  const abs = Math.abs(value)
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(abs)
  return value < 0 ? `-${formatted}` : formatted
}

function formatNumber(value) {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('en-US').format(value)
}

function formatMonthShortLabel(monthLabel) {
  if (!monthLabel || typeof monthLabel !== 'string') return '—'
  const date = new Date(`${monthLabel} 1`)
  if (Number.isNaN(date.getTime())) return monthLabel
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit' })
    .format(date)
    .replace(',', '')
}

// Linear regression — adds a `outKey` field to each data point
function trendline(data, key, outKey = 'trend') {
  const n = data.length
  if (n < 2) return data.map(d => ({ ...d, [outKey]: d[key] }))
  const xs = data.map((_, i) => i)
  const ys = data.map(d => d[key])
  const sumX = xs.reduce((a, b) => a + b, 0)
  const sumY = ys.reduce((a, b) => a + b, 0)
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0)
  const sumXX = xs.reduce((s, x) => s + x * x, 0)
  const denom = n * sumXX - sumX * sumX
  if (denom === 0) return data.map(d => ({ ...d, [outKey]: sumY / n }))
  const slope = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n
  return data.map((d, i) => ({ ...d, [outKey]: parseFloat((slope * i + intercept).toFixed(4)) }))
}

function StatCard({ label, value, sub, color = 'white', prefix, suffix }) {
  const colorClass = {
    red: 'text-red-400',
    green: 'text-green-400',
    white: 'text-white',
    yellow: 'text-yellow-400',
    blue: 'text-blue-400',
  }[color] || 'text-white'

  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
      <p className="text-gray-300 text-xs uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${colorClass}`}>
        {prefix}{value}{suffix}
      </p>
      {sub && <p className="text-gray-300 text-xs mt-1">{sub}</p>}
    </div>
  )
}

function MovementTable({ title, rows, kind }) {
  if (!rows?.length) return null
  return <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden"><div className="px-5 py-4 border-b border-gray-800"><h3 className="text-white font-semibold">{title}</h3></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-gray-400 text-xs uppercase"><tr><th className="text-left px-4 py-3">Client</th><th className="text-left px-4 py-3">Outcome</th><th className="text-right px-4 py-3">Source MRR</th><th className="text-right px-4 py-3">Destination MRR</th><th className="text-right px-4 py-3">Net</th><th className="text-left px-4 py-3">Reason / evidence</th></tr></thead><tbody>{rows.map((r,i)=>{const known=r.destinationMrr!==null&&r.destinationMrr!==undefined;return <tr key={`${r.logoKey}-${i}`} className="border-t border-gray-800 text-gray-200"><td className="px-4 py-3">{r.clientName}</td><td className="px-4 py-3">{kind==='pif' ? `Deferred · ${r.expectedReturnDate ? new Date(r.expectedReturnDate).toLocaleDateString() : 'return date needs review'}` : `${r.logoOutcome} / ${r.programOutcome}`}</td><td className="px-4 py-3 text-right">{formatCurrency(Number(r.sourceMrr))}</td><td className="px-4 py-3 text-right">{known ? formatCurrency(Number(r.destinationMrr)) : 'Needs review'}</td><td className="px-4 py-3 text-right">{known ? formatCurrency(Number(r.destinationMrr)-Number(r.sourceMrr)) : '—'}</td><td className="px-4 py-3">{kind==="pif" && <span className="block text-blue-300 capitalize">{(r.pifLifecycleStatus||"needs_review").replaceAll("_"," ")}</span>}{r.reason || r.reasonCategory || 'Unknown'}<span className="block text-xs text-gray-400">{r.confidence || 'unknown'} confidence{r.evidence ? ` · ${r.evidence}` : ''}</span></td></tr>})}</tbody></table></div></div>
}

// Custom tooltip for churn rate chart
function ChurnRateTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const rate = payload.find(p => p.dataKey === 'churnRateCount')
  const trend = payload.find(p => p.dataKey === 'trendChurn')
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs">
      <p className="text-gray-400 mb-1 font-medium">{label}</p>
      {rate && <p className="text-red-400">Churn Rate: {rate.value?.toFixed(1)}%</p>}
      {trend && <p className="text-zinc-400">Trend: {trend.value?.toFixed(1)}%</p>}
    </div>
  )
}

// Custom tooltip for MRR chart
function MrrTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const lost = payload.find(p => p.dataKey === 'mrrLost')
  const added = payload.find(p => p.dataKey === 'mrrAdded')
  const trendLost = payload.find(p => p.dataKey === 'trendLost')
  const trendAdded = payload.find(p => p.dataKey === 'trendAdded')
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs">
      <p className="text-gray-400 mb-1 font-medium">{label}</p>
      {lost && <p className="text-red-400">Lost: {formatCurrency(lost.value)}</p>}
      {added && <p className="text-green-400">Added: {formatCurrency(added.value)}</p>}
      {trendLost && <p className="text-red-300/70">Lost Trend: {formatCurrency(trendLost.value)}</p>}
      {trendAdded && <p className="text-green-300/70">Added Trend: {formatCurrency(trendAdded.value)}</p>}
    </div>
  )
}

export default function FinanceChurnPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedKey, setSelectedKey] = useState(null)

  useEffect(() => {
    fetch('/api/metrics/finance/churn')
      .then(res => res.json())
      .then(json => {
        if (json.error) throw new Error(json.error)

        // Normalize payload shape so charts still render if API response is wrapped
        // or chartData is temporarily omitted.
        const months = Array.isArray(json?.months) ? json.months : []
        const chartDataFromPayload = Array.isArray(json?.chartData)
          ? json.chartData
          : Array.isArray(json?.data?.chartData)
            ? json.data.chartData
            : []

        const fallbackChartData = months
          .slice()
          .reverse()
          .map(m => ({
            month: formatMonthShortLabel(m.month),
            churnRateCount: Number(m.churnRateCount) || 0,
            mrrLost: Math.abs(Number(m.mrrLost) || 0),
            mrrAdded: Number(m.mrrAdded) || 0,
          }))

        const normalized = {
          ...json,
          months,
          chartData: chartDataFromPayload.length > 0 ? chartDataFromPayload : fallbackChartData,
        }

        setData(normalized)
        if (normalized.months.length) {
          setSelectedKey(normalized.months[0].key)
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading churn data…</p>
        </div>
      </div>
    )
  }

  const selected = data?.months?.find(m => m.key === selectedKey) ?? data?.months?.[0]
  const leadership = selected ? data?.leadership?.[selected.key] : null
  const netMrr = selected ? selected.newMrr - selected.lostMrr : null
  const netMrrColor = netMrr === null ? 'white' : netMrr >= 0 ? 'green' : 'red'

  // Compute trendline data for charts
  const rawChartData = data?.chartData || []
  const churnChartData = trendline(rawChartData, 'churnRateCount', 'trendChurn')
  const mrrChartData = trendline(
    trendline(rawChartData, 'mrrLost', 'trendLost'),
    'mrrAdded',
    'trendAdded'
  )

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/finance"
          className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm"
        >
          ← Back
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Churn Report</h1>
          <p className="text-gray-300 text-sm mt-0.5">
            Last 3 months — Google Sheets history + live Stripe data
            {data?.latestMonthIsPartial ? ' · Current month is month-to-date' : ''}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-950 border border-red-800 rounded-lg px-4 py-3 text-red-300 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Month Tabs */}
      {data?.months?.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {data.months.map(m => (
            <button
              key={m.key}
              onClick={() => setSelectedKey(m.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                m.key === selectedKey
                  ? 'bg-red-900/50 border-red-700 text-white'
                  : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'
              }`}
            >
              {m.month}
              <span
                className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
                  m.key === selectedKey
                    ? 'bg-red-700 text-white'
                    : 'bg-gray-700 text-gray-300'
                }`}
              >
                {m.clientsLost}
              </span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Clients Lost + MRR Lost */}
            <div className="rounded-xl p-5" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
              <p className="text-gray-300 text-xs uppercase tracking-wider mb-1">Logos Lost</p>
              <p className="text-4xl font-bold text-red-400">{selected.clientsLost}</p>
              <p className="text-red-400/70 text-sm font-medium mt-1">
                {formatCurrency(selected.mrrLost)} MRR
              </p>
            </div>

            {/* Card 2: Clients Added + MRR Added */}
            <div className="rounded-xl p-5" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
              <p className="text-gray-300 text-xs uppercase tracking-wider mb-1">Clients Added</p>
              <p className="text-4xl font-bold text-green-400">{selected.clientsAdded}</p>
              <p className="text-green-400/70 text-sm font-medium mt-1">
                {formatCurrency(selected.mrrAdded)} MRR
              </p>
            </div>

            {/* Card 3: Churn Rates */}
            <div className="rounded-xl p-5" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
              <p className="text-gray-300 text-xs uppercase tracking-wider mb-1">Logo Churn Rate</p>
              <p className="text-4xl font-bold text-red-400">{selected.churnRateCount}%</p>
              <p className="text-gray-300 text-xs mt-1">
                Revenue churn: <span className="text-red-400/80">{selected.churnRateRevenue}%</span>
              </p>
            </div>

            {/* Card 4: Net MRR */}
            <div className="rounded-xl p-5" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
              <p className="text-gray-300 text-xs uppercase tracking-wider mb-1">Net MRR Change</p>
              <p className={`text-4xl font-bold ${netMrrColor === 'green' ? 'text-green-400' : 'text-red-400'}`}>
                {netMrr >= 0 ? '+' : ''}{formatCurrency(netMrr)}
              </p>
              <p className="text-gray-300 text-xs mt-1">
                New minus lost
              </p>
            </div>
          </div>

          {data?.definitions && (
            <section className="rounded-xl p-5 bg-gray-900 border border-gray-800">
              <h2 className="text-white font-semibold">Churn definitions</h2>
              <div className="mt-3 space-y-2 text-xs text-gray-300">
                <p><span className="text-white font-medium">Client/logo churn:</span> {data.definitions.clientChurn}</p>
                <p><span className="text-white font-medium">Revenue churn:</span> {data.definitions.revenueChurn}</p>
                <p><span className="text-white font-medium">Program churn:</span> {data.definitions.programChurn}</p>
                <p><span className="text-white font-medium">Unknowns:</span> {data.definitions.unknowns}</p>
                <p><span className="text-white font-medium">GRR:</span> {data.definitions.grr}</p>
                <p><span className="text-white font-medium">NRR:</span> {data.definitions.nrr}</p>
              </div>
            </section>
          )}

          {data?.lateralMovements?.confirmed?.length > 0 && (
            <section className="rounded-xl p-5 space-y-4 bg-blue-950/30 border border-blue-800">
              <div>
                <h2 className="text-white font-semibold">Monthly → PIF Lateral Movements</h2>
                <p className="text-gray-300 text-xs mt-1">Confirmed billing conversions are retained clients, not churn. MRR is temporarily offline while PIF cash is collected upfront.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.lateralMovements.confirmed.map(row => (
                  <div key={`${row.clientName}-${row.movementDate}`} className="bg-gray-950/60 border border-blue-900 rounded-lg p-4">
                    <p className="text-white font-medium">{row.clientName}</p>
                    <p className="text-gray-300 text-xs mt-1">{formatCurrency(row.mrrMoved)} MRR moved → {formatCurrency(row.pifCashReceived)} PIF cash</p>
                    <p className="text-blue-300 text-xs mt-2">{row.termMonths}-month term · recurring return {new Date(row.scheduledReturnDate).toLocaleDateString('en-US', { timeZone: 'UTC' })}</p>
                  </div>
                ))}
              </div>
              <p className="text-gray-400 text-xs">{data.lateralMovements.policy} June&apos;s unmatched PIF deals remain unclassified.</p>
            </section>
          )}

          {/* Trend Charts — 2 col grid */}
          {(
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Chart 1: Churn Rate */}
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                <p className="text-white font-semibold text-sm">Churn Rate (Client Count)</p>
                <p className="text-gray-300 text-xs mt-0.5 mb-4">Last 6 months</p>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={churnChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: '#9ca3af', fontSize: 11 }}
                      axisLine={{ stroke: '#4b5563' }}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={v => `${v.toFixed(1)}%`}
                      tick={{ fill: '#9ca3af', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={45}
                    />
                    <Tooltip content={<ChurnRateTooltip />} />
                    {/* Actual churn rate */}
                    <Line
                      type="monotone"
                      dataKey="churnRateCount"
                      stroke="#AE2BCF"
                      strokeWidth={2}
                      dot={{ r: 4, fill: '#f87171', strokeWidth: 0 }}
                      activeDot={{ r: 5 }}
                      name="Churn Rate"
                    />
                    {/* Trendline */}
                    <Line
                      type="linear"
                      dataKey="trendChurn"
                      stroke="#71717a"
                      strokeWidth={1.5}
                      strokeDasharray="5 4"
                      dot={false}
                      activeDot={false}
                      name="Trend"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Chart 2: Lost vs Added MRR */}
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                <p className="text-white font-semibold text-sm">Lost vs Added MRR</p>
                <p className="text-gray-300 text-xs mt-0.5 mb-4">Last 6 months</p>
                <ResponsiveContainer width="100%" height={240}>
                  <ComposedChart data={mrrChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: '#9ca3af', fontSize: 11 }}
                      axisLine={{ stroke: '#4b5563' }}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={v => `$${Math.round(v / 1000)}k`}
                      tick={{ fill: '#9ca3af', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={45}
                    />
                    <Tooltip content={<MrrTooltip />} />
                    {/* MRR Lost bar */}
                    <Bar dataKey="mrrLost" fill="#731494" name="MRR Lost" radius={[3, 3, 0, 0]} maxBarSize={32} />
                    {/* MRR Added bar */}
                    <Bar dataKey="mrrAdded" fill="#C19C46" name="MRR Added" radius={[3, 3, 0, 0]} maxBarSize={32} />
                    {/* Lost trendline */}
                    <Line
                      type="linear"
                      dataKey="trendLost"
                      stroke="#fca5a5"
                      strokeWidth={1.5}
                      strokeDasharray="5 4"
                      dot={false}
                      activeDot={false}
                      name="Lost Trend"
                    />
                    {/* Added trendline */}
                    <Line
                      type="linear"
                      dataKey="trendAdded"
                      stroke="#86efac"
                      strokeWidth={1.5}
                      strokeDasharray="5 4"
                      dot={false}
                      activeDot={false}
                      name="Added Trend"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {leadership && <>
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
              <StatCard label="True logo exits" value={leadership.totals.logosLost} sub={`${formatCurrency(leadership.totals.logoMrrLost)} MRR`} color="red" />
              <StatCard label="Program exits" value={leadership.totals.programsLost} sub={`${formatCurrency(leadership.totals.programMrrLost)} downsell`} color="yellow" />
              <StatCard label="Internal laterals" value={leadership.mix.internal_lateral.count} sub={`${formatCurrency(leadership.totals.lateralGrossMrr)} source MRR`} color="blue" />
              <StatCard label="PIF deferred" value={leadership.mix.pif_deferred.count} sub={`${formatCurrency(leadership.totals.pifOfflineMrr)} offline · ${formatCurrency(leadership.totals.pifCash)} cash`} color="blue" />
              <StatCard label="Billing artifacts" value={leadership.mix.billing_replacement.count + leadership.mix.duplicate_artifact.count} sub="Excluded from churn" />
              <StatCard label="Needs review" value={leadership.totals.needsReview} sub="Never inferred" color="yellow" />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3"><StatCard label="Economic GRR" value={selected.economicGrr==null?'—':`${selected.economicGrr}%`} sub="Credits confirmed deferred PIF MRR" color="green"/><StatCard label="Stripe-recurring GRR" value={selected.stripeGrr==null?'—':`${selected.stripeGrr}%`} sub="Offline PIF value excluded"/><StatCard label="Economic NRR" value={selected.economicNrr==null?'—':`${selected.economicNrr}%`} sub="Contracted economic value" color="green"/><StatCard label="Stripe-recurring NRR" value={selected.stripeNrr==null?'—':`${selected.stripeNrr}%`} sub="Visible recurring Stripe MRR"/></div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3"><StatCard label="Opening programs" value={selected.openingPrograms} sub="Unique logo + canonical program denominator"/><StatCard label="Standalone program exits" value={selected.programChurnClients} sub={`${formatCurrency(selected.programChurnMrr)} while logo retained`} color="yellow"/><StatCard label="Programs lost with logo exit" value={leadership.totals.programsLostWithLogoExit} sub={`${formatCurrency(leadership.totals.programMrrLostWithLogoExit)} included in logo exit`} color="red"/><StatCard label="Program churn rate" value={`${selected.programChurnRate}%`} sub={`${selected.programsLost} total programs lost ÷ ${selected.openingPrograms} opening programs`} color="yellow"/></div>
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5"><h3 className="text-white font-semibold">Cancellation mix & MRR movement</h3><p className="text-gray-400 text-xs mt-1 mb-4">Each event is in exactly one bucket. Destination and net delta appear only when verified.</p><div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">{Object.entries(leadership.mix).map(([k,v])=><div key={k} className="rounded-lg bg-black/30 p-3"><div className="text-xs text-gray-400 capitalize">{k.replaceAll('_',' ')}</div><div className="text-lg text-white font-semibold">{v.count}</div><div className="text-xs text-gray-300">{formatCurrency(v.sourceMrr)} source</div></div>)}</div></div>
            <MovementTable title="True logo exits" rows={leadership.logoExits} />
            <MovementTable title="Program exits / downsells" rows={leadership.programExits} />
            <MovementTable title="Internal laterals" rows={leadership.laterals} />
            <MovementTable title="Monthly → PIF lifecycle" rows={leadership.pifLifecycle} kind="pif" />
            <MovementTable title="Billing replacements and duplicates" rows={leadership.replacements} />
            <MovementTable title="Needs classification review" rows={leadership.needsReview} />
            <div className="rounded-xl border border-purple-900 bg-purple-950/20 p-4 text-xs text-gray-300 space-y-1"><p><b className="text-white">Logo churn</b> means no retained GYC program; program churn is a downsell while the logo remains.</p><p><b className="text-white">Laterals</b> show source recurring MRR, verified destination MRR, and net delta.</p><p><b className="text-white">PIF</b> is temporarily offline recurring value, not churn. PIF cash stays separate from MRR. Economic retention credits confirmed deferred value; Stripe-recurring retention does not.</p><p><b className="text-white">Unknowns</b> remain Needs Review and are never inferred.</p></div>
          </>}

          {/* Monthly Summary Grid */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800">
              <h3 className="text-white font-semibold">Monthly Summary — {selected.month}</h3>
              <p className="text-gray-300 text-xs mt-0.5">All key metrics for this month</p>
            </div>

            <div className="p-5 space-y-6">
              {/* Portfolio Health */}
              <div>
                <h4 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Portfolio Health</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <StatCard
                    label="Total Clients"
                    value={formatNumber(selected.clientCount)}
                    color="white"
                  />
                  <StatCard
                    label="Avg MRR / Client"
                    value={formatCurrency(selected.avgMrrPerClient)}
                    color="white"
                  />
                  <StatCard
                    label="Total MRR"
                    value={formatCurrency(selected.totalMrr)}
                    color="blue"
                  />
                </div>
              </div>

              {/* Churn */}
              <div>
                <h4 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Churn</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard
                    label="Logos Lost"
                    value={selected.clientsLost}
                    color="red"
                  />
                  <StatCard
                    label="Logo-Churn MRR"
                    value={formatCurrency(selected.mrrLost)}
                    color="red"
                  />
                  <StatCard
                    label="Logo Churn (Count)"
                    value={`${selected.churnRateCount}%`}
                    color="red"
                  />
                  <StatCard
                    label="Churn Rate (Revenue)"
                    value={`${selected.churnRateRevenue}%`}
                    color="red"
                  />
                </div>
              </div>

              {selected.programChurnClients > 0 && (
                <div>
                  <h4 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Program Churn (retained logos)</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <StatCard label="Programs Lost" value={selected.programChurnClients} color="red" />
                    <StatCard label="Program MRR Lost" value={formatCurrency(selected.programChurnMrr)} color="red" />
                  </div>
                </div>
              )}

              {/* New Business */}
              <div>
                <h4 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">New Business</h4>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard
                    label="Clients Added"
                    value={selected.clientsAdded}
                    color="green"
                  />
                  <StatCard
                    label="MRR Added (New)"
                    value={formatCurrency(selected.mrrAdded)}
                    color="green"
                  />
                </div>
              </div>

              {/* Expansions & Contractions */}
              <div>
                <h4 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Expansions & Contractions (Existing Clients)</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <StatCard
                    label="Reductions (MRR Lost)"
                    value={formatCurrency(selected.reductions)}
                    sub={selected.reductions == null ? 'Not separated in Stripe snapshot' : undefined}
                    color="red"
                  />
                  <StatCard
                    label="Upsells (MRR Added)"
                    value={formatCurrency(selected.upsells)}
                    sub={selected.upsells == null ? 'Not separated in Stripe snapshot' : undefined}
                    color="green"
                  />
                  <StatCard
                    label="Net Upsells"
                    value={formatCurrency(selected.netUpsells)}
                    sub={selected.netUpsells == null ? 'Not separated in Stripe snapshot' : undefined}
                    color={selected.netUpsells >= 0 ? 'green' : 'red'}
                  />
                </div>
              </div>

              {/* MRR Flow */}
              <div>
                <h4 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">MRR Flow</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <StatCard
                    label="Lost MRR (Cancels + Reductions)"
                    value={formatCurrency(selected.lostMrr)}
                    color="red"
                    sub="Cancelled + reduced"
                  />
                  <StatCard
                    label="New MRR (Upsells + New)"
                    value={formatCurrency(selected.newMrr)}
                    color="green"
                    sub="Upsells + new clients"
                  />
                  <StatCard
                    label="Net MRR Change"
                    value={(netMrr >= 0 ? '+' : '') + formatCurrency(netMrr)}
                    color={netMrrColor}
                    sub="New minus lost"
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
