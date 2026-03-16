'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import MetricCard from '@/components/MetricCard'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell
} from 'recharts'

// GYC has 18.5 normalized employees
const NORMALIZED_EMPLOYEES = 18.5
// RPE target: $250,000/year
const RPE_TARGET = 250000

function formatCurrency(value) {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value)
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
  })
}

function calcTrend(current, previous) {
  if (!previous || previous === 0) return null
  const pct = ((current - previous) / previous) * 100
  return { pct: Math.abs(pct).toFixed(1), positive: pct >= 0 }
}

// Custom tooltip for Recharts
function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm">
        <p className="text-gray-400">{label}</p>
        <p className="text-white font-bold">{formatCurrency(payload[0].value)}</p>
      </div>
    )
  }
  return null
}

export default function FinancePage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/metrics/finance')
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

  // Trigger a sync if no data exists yet, then fetch
  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch('/api/metrics/finance')
        const json = await res.json()
        if (!json.metrics) {
          // No data — do initial sync
          setSyncing(true)
          await fetch('/api/sync/stripe', { method: 'POST' })
          setSyncing(false)
        }
        await fetchData()
      } catch (err) {
        setError(err.message)
        setLoading(false)
        setSyncing(false)
      }
    }
    init()
  }, [fetchData])

  const handleSync = async () => {
    setSyncing(true)
    setError(null)
    try {
      const res = await fetch('/api/sync/stripe', { method: 'POST' })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      await fetchData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSyncing(false)
    }
  }

  const metrics = data?.metrics
  const previous = data?.previous
  const customers = data?.customers || []
  const lastSync = data?.lastSync
  const history = data?.history || []
  const dailyRevenue = data?.dailyRevenue || []

  // Daily cash stats
  const todayStr = new Date().toISOString().split('T')[0]
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  const todayRevenue = dailyRevenue.find(d => d.date === todayStr)?.amount ?? 0
  const yesterdayRevenue = dailyRevenue.find(d => d.date === yesterdayStr)?.amount ?? 0
  const last7Days = dailyRevenue.slice(-7)
  const sevenDayAvg = last7Days.length > 0
    ? last7Days.reduce((s, d) => s + d.amount, 0) / last7Days.length
    : 0

  // Chart data for daily revenue
  const dailyChartData = dailyRevenue.map(d => ({
    name: new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    amount: d.amount,
    date: d.date
  }))

  // RPE calculations
  const rpeMrr = metrics ? (metrics.mrr * 12) / NORMALIZED_EMPLOYEES : null
  const rpeRevenue = metrics ? (metrics.totalRevenue * 12) / NORMALIZED_EMPLOYEES : null
  const rpeProgress = rpeMrr ? Math.min((rpeMrr / RPE_TARGET) * 100, 100) : 0
  const rpeRevenueProgress = rpeRevenue ? Math.min((rpeRevenue / RPE_TARGET) * 100, 100) : 0
  // Keep rpe as alias for backwards compat
  const rpe = rpeMrr
  const rpeTrend = previous
    ? calcTrend(
        (metrics.mrr * 12) / NORMALIZED_EMPLOYEES,
        (previous.mrr * 12) / NORMALIZED_EMPLOYEES
      )
    : null

  // Trend calculations
  const mrrTrend = metrics && previous ? calcTrend(metrics.mrr, previous.mrr) : null
  const clientTrend = metrics && previous ? calcTrend(metrics.activeCustomers, previous.activeCustomers) : null

  // Chart data — format dates for X axis
  const chartData = history.map((h, i) => ({
    name: new Date(h.syncedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    mrr: h.mrr,
    index: i
  }))

  if (loading || syncing) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">{syncing ? 'Syncing Stripe data…' : 'Loading…'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Finance</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {lastSync ? `Last synced ${formatDate(lastSync.syncedAt)}` : 'No sync data yet'}
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
        >
          {syncing ? (
            <>
              <span className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin" />
              Syncing…
            </>
          ) : (
            '↻ Sync Now'
          )}
        </button>
      </div>

      {error && (
        <div className="bg-red-950 border border-red-800 rounded-lg px-4 py-3 text-red-300 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Row 1 — Revenue Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="MRR"
          value={formatCurrency(metrics?.mrr)}
          subtitle="Monthly Recurring Revenue"
          trend={mrrTrend ? `${mrrTrend.pct}% vs last sync` : undefined}
          trendPositive={mrrTrend?.positive}
          icon="💰"
        />
        <MetricCard
          title="Revenue (30d)"
          value={formatCurrency(metrics?.totalRevenue)}
          subtitle="Cash collected, last 30 days"
          icon="💵"
        />
        <MetricCard
          title="ARR"
          value={formatCurrency(metrics ? metrics.mrr * 12 : null)}
          subtitle="MRR × 12"
          icon="📈"
        />
        <MetricCard
          title="Est. Annual Revenue"
          value={formatCurrency(metrics ? metrics.totalRevenue * 12 : null)}
          subtitle="30d cash × 12"
          icon="🟢"
        />
      </div>

      {/* Row 2 — Client Metrics */}
      <div className="grid grid-cols-3 gap-4">
        <MetricCard
          title="Active Clients"
          value={metrics?.activeCustomers ?? '—'}
          subtitle="Active Stripe subscriptions"
          trend={clientTrend ? `${clientTrend.pct}% vs last sync` : undefined}
          trendPositive={clientTrend?.positive}
          icon="👥"
        />
        <MetricCard
          title="New Clients (30d)"
          value={metrics?.newCustomers ?? '—'}
          subtitle="New subscriptions, last 30 days"
          icon="✨"
        />
        <Link href="/finance/churn" className="block hover:opacity-80 transition-opacity">
          <MetricCard
            title="Churned (30d)"
            value={metrics?.churnedCustomers ?? '—'}
            subtitle="Tap to view details →"
            icon="📉"
          />
        </Link>
      </div>

      {/* RPE Cards */}
      <div className="grid grid-cols-1 gap-4">
        {/* RPE based on MRR */}
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-white font-semibold">RPE — MRR Based</h3>
              <p className="text-gray-500 text-xs mt-0.5">
                MRR × 12 ÷ {NORMALIZED_EMPLOYEES} employees · Target: {formatCurrency(RPE_TARGET)}/yr
              </p>
            </div>
            <div className="text-right">
              <div className={`text-2xl font-bold ${rpeMrr && rpeMrr >= RPE_TARGET ? 'text-green-400' : 'text-white'}`}>
                {formatCurrency(rpeMrr)}
              </div>
              <div className="text-gray-500 text-xs">per year</div>
            </div>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all ${rpeProgress >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
              style={{ width: `${rpeProgress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-600 mt-1.5">
            <span>$0</span>
            <span className={rpeProgress >= 100 ? 'text-green-400' : 'text-gray-400'}>
              {rpeProgress.toFixed(1)}% of target
            </span>
            <span>{formatCurrency(RPE_TARGET)}</span>
          </div>
          {rpeTrend && (
            <p className={`text-sm mt-2 font-medium ${rpeTrend.positive ? 'text-green-400' : 'text-red-400'}`}>
              {rpeTrend.positive ? '↑' : '↓'} {rpeTrend.pct}% vs last sync
            </p>
          )}
        </div>

        {/* RPE based on actual revenue collected */}
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-white font-semibold">RPE — Revenue Based</h3>
              <p className="text-gray-500 text-xs mt-0.5">
                30d Cash × 12 ÷ {NORMALIZED_EMPLOYEES} employees · Target: {formatCurrency(RPE_TARGET)}/yr
              </p>
            </div>
            <div className="text-right">
              <div className={`text-2xl font-bold ${rpeRevenue && rpeRevenue >= RPE_TARGET ? 'text-green-400' : 'text-white'}`}>
                {formatCurrency(rpeRevenue)}
              </div>
              <div className="text-gray-500 text-xs">per year</div>
            </div>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all ${rpeRevenueProgress >= 100 ? 'bg-green-500' : 'bg-purple-500'}`}
              style={{ width: `${rpeRevenueProgress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-600 mt-1.5">
            <span>$0</span>
            <span className={rpeRevenueProgress >= 100 ? 'text-green-400' : 'text-gray-400'}>
              {rpeRevenueProgress.toFixed(1)}% of target
            </span>
            <span>{formatCurrency(RPE_TARGET)}</span>
          </div>
        </div>
      </div>

      {/* MRR Chart (only show if we have history) */}
      {chartData.length > 1 && (
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <h3 className="text-white font-semibold mb-4">MRR History</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <XAxis
                dataKey="name"
                tick={{ fill: '#6b7280', fontSize: 11 }}
                axisLine={{ stroke: '#374151' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#6b7280', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
              <Bar dataKey="mrr" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={index === chartData.length - 1 ? '#3b82f6' : '#1e3a5f'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Daily Cash Collected */}
      {dailyRevenue.length > 0 && (
        <div className="space-y-4">
          {/* Today / Yesterday / 7-day avg cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricCard
              title="Today's Cash"
              value={formatCurrency(todayRevenue)}
              subtitle="Cash collected today"
              icon="💵"
            />
            <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Yesterday</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(yesterdayRevenue)}</p>
              <p className="text-gray-500 text-xs mt-1">Cash collected yesterday</p>
            </div>
            <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">7-Day Avg</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(sevenDayAvg)}</p>
              <p className="text-gray-500 text-xs mt-1">Average daily cash (last 7 days)</p>
            </div>
          </div>

          {/* Daily bar chart */}
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <h3 className="text-white font-semibold mb-1">Daily Cash Collected (30d)</h3>
            <p className="text-gray-500 text-xs mb-4">Successful charges per day</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dailyChartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#6b7280', fontSize: 10 }}
                  axisLine={{ stroke: '#374151' }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                  {dailyChartData.map((entry, index) => (
                    <Cell
                      key={`cell-daily-${index}`}
                      fill={entry.date === todayStr ? '#22c55e' : '#3b82f6'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="text-gray-600 text-xs mt-2 text-center">Today highlighted in green</p>
          </div>
        </div>
      )}

      {/* Top Customers Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-white font-semibold">Active Clients</h3>
          <span className="text-gray-500 text-sm">{customers.length} total</span>
        </div>
        {customers.length === 0 ? (
          <div className="px-5 py-10 text-center text-gray-600">
            No customer data yet. Sync to load clients.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-5 py-3 text-gray-500 text-xs font-medium uppercase tracking-wider">Client</th>
                  <th className="text-left px-5 py-3 text-gray-500 text-xs font-medium uppercase tracking-wider">Email</th>
                  <th className="text-right px-5 py-3 text-gray-500 text-xs font-medium uppercase tracking-wider">MRR</th>
                  <th className="text-right px-5 py-3 text-gray-500 text-xs font-medium uppercase tracking-wider">ARR</th>
                  <th className="text-left px-5 py-3 text-gray-500 text-xs font-medium uppercase tracking-wider">Since</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c, i) => (
                  <tr
                    key={c.id}
                    className={`border-b border-gray-800 last:border-0 hover:bg-gray-800/50 transition-colors`}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-900 flex items-center justify-center text-xs text-blue-300 font-bold shrink-0">
                          {(c.name || c.email || '?')[0].toUpperCase()}
                        </div>
                        <span className="text-white text-sm font-medium">
                          {c.name || <span className="text-gray-500 italic">No name</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-400 text-sm">{c.email || '—'}</td>
                    <td className="px-5 py-3 text-right text-white text-sm font-medium">{formatCurrency(c.mrr)}</td>
                    <td className="px-5 py-3 text-right text-gray-400 text-sm">{formatCurrency(c.mrr * 12)}</td>
                    <td className="px-5 py-3 text-gray-400 text-sm">
                      {new Date(c.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
              {customers.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-800/50">
                    <td className="px-5 py-3 text-gray-400 text-sm font-medium" colSpan={2}>Total</td>
                    <td className="px-5 py-3 text-right text-blue-400 text-sm font-bold">
                      {formatCurrency(customers.reduce((s, c) => s + c.mrr, 0))}
                    </td>
                    <td className="px-5 py-3 text-right text-blue-400 text-sm font-bold">
                      {formatCurrency(customers.reduce((s, c) => s + c.mrr * 12, 0))}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
