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
  Cell
} from 'recharts'

// GYC has 18.5 normalized employees
const NORMALIZED_EMPLOYEES = 18.5
// RPE target: $250,000/year
const RPE_TARGET = 250000

// Brand colors
const B = {
  card: '#111111',
  border: '#2a1a3e',
  p1: '#340B67',
  p2: '#731494',
  p3: '#732FBA',
  p4: '#AE2BCF',
  accent: '#C19C46',
  muted: '#9ca3af',
  elevated: '#1a1a1a',
}

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
      <div style={{ background: B.elevated, border: `1px solid ${B.border}` }} className="rounded-lg px-3 py-2 text-sm">
        <p style={{ color: B.muted }}>{label}</p>
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
  const mrrHistory = data?.mrrHistory || []
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
  const rpeTrend = previous
    ? calcTrend(
        (metrics.mrr * 12) / NORMALIZED_EMPLOYEES,
        (previous.mrr * 12) / NORMALIZED_EMPLOYEES
      )
    : null

  // Trend calculations
  const mrrTrend = metrics && previous ? calcTrend(metrics.mrr, previous.mrr) : null
  const clientTrend = metrics && previous ? calcTrend(metrics.activeCustomers, previous.activeCustomers) : null


  if (loading || syncing) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: B.p4, borderTopColor: 'transparent' }} />
          <p style={{ color: B.muted }}>{syncing ? 'Syncing Stripe data…' : 'Loading…'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold text-white"
            style={{ borderLeft: `3px solid ${B.p3}`, paddingLeft: '12px' }}
          >
            Finance
          </h1>
          <p style={{ color: B.muted }} className="text-sm mt-0.5 pl-4">
            {lastSync ? `Last synced ${formatDate(lastSync.syncedAt)}` : 'No sync data yet'}
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          style={{ backgroundColor: B.p3, borderColor: B.p2 }}
          className="flex items-center gap-2 px-4 py-2 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-opacity border"
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
        <div className="rounded-xl p-5" style={{ backgroundColor: B.card, border: `1px solid ${B.border}` }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-white font-semibold">RPE — MRR Based</h3>
              <p style={{ color: B.muted }} className="text-xs mt-0.5">
                MRR × 12 ÷ {NORMALIZED_EMPLOYEES} employees · Target: {formatCurrency(RPE_TARGET)}/yr
              </p>
            </div>
            <div className="text-right">
              <div style={{ color: rpeMrr && rpeMrr >= RPE_TARGET ? '#22c55e' : B.accent }} className="text-2xl font-bold">
                {formatCurrency(rpeMrr)}
              </div>
              <div style={{ color: B.muted }} className="text-xs">per year</div>
            </div>
          </div>
          <div className="w-full rounded-full h-2.5" style={{ backgroundColor: B.elevated }}>
            <div
              className="h-2.5 rounded-full transition-all"
              style={{
                width: `${rpeProgress}%`,
                backgroundColor: rpeProgress >= 100 ? '#22c55e' : B.p3,
              }}
            />
          </div>
          <div className="flex justify-between text-xs mt-1.5" style={{ color: B.muted }}>
            <span>$0</span>
            <span style={{ color: rpeProgress >= 100 ? '#22c55e' : B.accent }}>
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
        <div className="rounded-xl p-5" style={{ backgroundColor: B.card, border: `1px solid ${B.border}` }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-white font-semibold">RPE — Revenue Based</h3>
              <p style={{ color: B.muted }} className="text-xs mt-0.5">
                30d Cash × 12 ÷ {NORMALIZED_EMPLOYEES} employees · Target: {formatCurrency(RPE_TARGET)}/yr
              </p>
            </div>
            <div className="text-right">
              <div style={{ color: rpeRevenue && rpeRevenue >= RPE_TARGET ? '#22c55e' : B.accent }} className="text-2xl font-bold">
                {formatCurrency(rpeRevenue)}
              </div>
              <div style={{ color: B.muted }} className="text-xs">per year</div>
            </div>
          </div>
          <div className="w-full rounded-full h-2.5" style={{ backgroundColor: B.elevated }}>
            <div
              className="h-2.5 rounded-full transition-all"
              style={{
                width: `${rpeRevenueProgress}%`,
                backgroundColor: rpeRevenueProgress >= 100 ? '#22c55e' : B.p4,
              }}
            />
          </div>
          <div className="flex justify-between text-xs mt-1.5" style={{ color: B.muted }}>
            <span>$0</span>
            <span style={{ color: rpeRevenueProgress >= 100 ? '#22c55e' : B.accent }}>
              {rpeRevenueProgress.toFixed(1)}% of target
            </span>
            <span>{formatCurrency(RPE_TARGET)}</span>
          </div>
        </div>
      </div>

      {/* MRR Trend — real daily bars, last 30 days */}
      {mrrHistory.length > 0 && (
        <div className="rounded-xl p-5" style={{ backgroundColor: B.card, border: `1px solid ${B.border}` }}>
          <div className="flex items-center justify-between mb-4">
            <h3
              className="text-white font-semibold"
              style={{ borderLeft: `3px solid ${B.p3}`, paddingLeft: '10px' }}
            >
              MRR — Last 30 Days
            </h3>
            <span style={{ color: B.muted }} className="text-xs">Real daily MRR from active subscriptions</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={mrrHistory} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <XAxis
                dataKey="label"
                tick={{ fill: B.muted, fontSize: 10 }}
                axisLine={{ stroke: B.border }}
                tickLine={false}
                interval={0}
                tickFormatter={(value, index) => (
                  index % 5 === 0 || index === mrrHistory.length - 1 ? value : ''
                )}
              />
              <YAxis
                tick={{ fill: B.muted, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                domain={['auto', 'auto']}
              />
              <Tooltip
                formatter={(v) => [`$${Number(v).toLocaleString()}`, 'MRR']}
                contentStyle={{ backgroundColor: '#0a0a0a', border: `1px solid ${B.border}`, borderRadius: 8 }}
                labelStyle={{ color: B.muted }}
                itemStyle={{ color: B.p3 }}
              />
              <Bar dataKey="mrr" radius={[4, 4, 0, 0]}>
                {mrrHistory.map((entry, index) => (
                  <Cell
                    key={`cell-mrr-${entry.date}`}
                    fill={index === mrrHistory.length - 1 ? B.p4 : B.p2}
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
            <div className="rounded-xl p-5" style={{ backgroundColor: B.card, border: `1px solid ${B.border}` }}>
              <p style={{ color: B.muted }} className="text-xs uppercase tracking-wider mb-1">Yesterday</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(yesterdayRevenue)}</p>
              <p style={{ color: B.muted }} className="text-xs mt-1">Cash collected yesterday</p>
            </div>
            <div className="rounded-xl p-5" style={{ backgroundColor: B.card, border: `1px solid ${B.border}` }}>
              <p style={{ color: B.muted }} className="text-xs uppercase tracking-wider mb-1">7-Day Avg</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(sevenDayAvg)}</p>
              <p style={{ color: B.muted }} className="text-xs mt-1">Average daily cash (last 7 days)</p>
            </div>
          </div>

          {/* Daily bar chart */}
          <div className="rounded-xl p-5" style={{ backgroundColor: B.card, border: `1px solid ${B.border}` }}>
            <h3
              className="text-white font-semibold mb-1"
              style={{ borderLeft: `3px solid ${B.p3}`, paddingLeft: '10px' }}
            >
              Daily Cash Collected (30d)
            </h3>
            <p style={{ color: B.muted }} className="text-xs mb-4">Successful charges per day</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dailyChartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fill: B.muted, fontSize: 10 }}
                  axisLine={{ stroke: B.border }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: B.muted, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(174,43,207,0.07)' }} />
                <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                  {dailyChartData.map((entry, index) => (
                    <Cell
                      key={`cell-daily-${index}`}
                      fill={entry.date === todayStr ? B.accent : B.p3}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p style={{ color: '#4a3060' }} className="text-xs mt-2 text-center">Today highlighted in gold</p>
          </div>
        </div>
      )}

    </div>
  )
}
