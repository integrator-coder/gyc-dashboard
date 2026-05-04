'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import MetricCard from '@/components/MetricCard'
import MetricTooltip from '@/components/MetricTooltip'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ComposedChart,
  Line,
  Legend,
} from 'recharts'

const NORMALIZED_EMPLOYEES = 18.5
const RPE_TARGET = 250000

const B = {
  card: 'var(--brand-bg-card)',
  panel: 'var(--brand-surface-2)',
  inset: 'var(--brand-surface-3)',
  border: 'var(--brand-border)',
  borderStrong: 'var(--brand-border-strong)',
  p2: 'var(--brand-primary-2)',
  p3: 'var(--brand-primary-3)',
  p4: 'var(--brand-primary-4)',
  accent: 'var(--brand-accent)',
  muted: 'var(--brand-text-muted)',
  faint: 'var(--brand-text-faint)',
}

function formatCurrency(value) {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

function calcTrend(current, previous) {
  if (!previous || previous === 0) return null
  const pct = ((current - previous) / previous) * 100
  return { pct: Math.abs(pct).toFixed(1), positive: pct >= 0 }
}

function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: `linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0)), ${B.panel}`, border: `1px solid ${B.borderStrong}` }} className="rounded-xl px-3 py-2 text-sm shadow-2xl">
        <p style={{ color: B.muted }}>{label}</p>
        <p className="font-semibold text-white">{formatCurrency(payload[0].value)}</p>
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
  const [mrrTrendData, setMrrTrendData] = useState(null)

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

  const fetchMrrTrend = useCallback(async () => {
    try {
      const res = await fetch('/api/metrics/finance/mrr-trend')
      const json = await res.json()
      if (!Array.isArray(json)) throw new Error('Invalid response')
      setMrrTrendData(json.filter((p) => p.month >= '2023-01'))
    } catch (err) {
      console.error('MRR trend fetch error:', err.message)
    }
  }, [])

  useEffect(() => {
    fetchMrrTrend()
  }, [fetchMrrTrend])

  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch('/api/metrics/finance')
        const json = await res.json()
        if (!json.metrics) {
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
  const lastSync = data?.lastSync
  const mrrHistory = data?.mrrHistory || []
  const dailyRevenue = data?.dailyRevenue || []
  const ytdCash = data?.ytdCash ?? 0

  const todayStr = new Date().toISOString().split('T')[0]
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  const todayRevenue = dailyRevenue.find((d) => d.date === todayStr)?.amount ?? 0
  const yesterdayRevenue = dailyRevenue.find((d) => d.date === yesterdayStr)?.amount ?? 0
  const last7Days = dailyRevenue.slice(-7)
  const sevenDayAvg = last7Days.length > 0
    ? last7Days.reduce((s, d) => s + d.amount, 0) / last7Days.length
    : 0

  const dailyChartData = dailyRevenue.map((d) => ({
    name: new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    amount: d.amount,
    date: d.date,
  }))

  const now = new Date()
  const startOfYear = new Date(now.getFullYear(), 0, 1)
  const daysElapsed = Math.floor((now - startOfYear) / 86400000) + 1
  const estAnnualRevenue = ytdCash > 0 ? (ytdCash / daysElapsed) * 365 : null

  const rpeMrr = metrics ? (metrics.mrr * 12) / NORMALIZED_EMPLOYEES : null
  const rpeRevenue = estAnnualRevenue ? estAnnualRevenue / NORMALIZED_EMPLOYEES : metrics ? (metrics.totalRevenue * 12) / NORMALIZED_EMPLOYEES : null
  const rpeProgress = rpeMrr ? Math.min((rpeMrr / RPE_TARGET) * 100, 100) : 0
  const rpeRevenueProgress = rpeRevenue ? Math.min((rpeRevenue / RPE_TARGET) * 100, 100) : 0
  const rpeTrend = previous
    ? calcTrend(
        (metrics.mrr * 12) / NORMALIZED_EMPLOYEES,
        (previous.mrr * 12) / NORMALIZED_EMPLOYEES,
      )
    : null

  const mrrTrend = metrics && previous ? calcTrend(metrics.mrr, previous.mrr) : null
  const clientTrend = metrics && previous ? calcTrend(metrics.activeCustomers, previous.activeCustomers) : null

  if (loading || syncing) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: B.p4, borderTopColor: 'transparent' }} />
          <p className="executive-muted">{syncing ? 'Syncing Stripe data…' : 'Loading…'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="executive-kicker">Finance Command</div>
          <h1 className="mt-2 border-l-[3px] border-[var(--brand-primary-4)] pl-3 text-3xl font-semibold text-white">Finance</h1>
          <p className="mt-1 pl-3 text-sm executive-muted">
            {lastSync ? `Last synced ${formatDate(lastSync.syncedAt)}` : 'No sync data yet'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/finance/linkage-review" className="rounded-xl border border-[var(--brand-border)] bg-black/20 px-4 py-2.5 text-sm font-medium text-gray-200 transition hover:border-violet-500/40 hover:text-white">
            Linkage Review
          </Link>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="executive-button px-4 py-2.5"
          >
            {syncing ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border border-white border-t-transparent" />
                Syncing…
              </>
            ) : (
              '↻ Sync Now'
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
          ⚠️ {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          title="MRR"
          value={formatCurrency(metrics?.mrr)}
          subtitle="Monthly Recurring Revenue"
          trend={mrrTrend ? `${mrrTrend.pct}% vs last sync` : undefined}
          trendPositive={mrrTrend?.positive}
          icon="💰"
          tooltip="Sum of all active Stripe subscription amounts. Monthly subs count at face value; annual subs are divided by 12. Includes active + past_due subscriptions. Excludes one-time payments and cancelled subs. Snapshotted at last sync."
        />
        <MetricCard
          title="Revenue (30d)"
          value={formatCurrency(metrics?.totalRevenue)}
          subtitle="Cash collected, last 30 days"
          icon="💵"
          tooltip="Total cash collected from paid Stripe invoices in the rolling 30-day window prior to last sync. Includes both recurring subscription charges and one-time payments."
        />
        <MetricCard
          title="ARR"
          value={formatCurrency(metrics ? metrics.mrr * 12 : null)}
          subtitle="MRR × 12"
          icon="📈"
          tooltip="MRR × 12. Represents the annualized value of current recurring subscriptions if the subscriber base stayed flat for a full year."
        />
        <MetricCard
          title="YTD Annualized Revenue"
          value={formatCurrency(estAnnualRevenue)}
          subtitle={`YTD cash annualized (${daysElapsed}d)`}
          icon="◉"
          tooltip="Year-to-date cash collected, annualized using actual elapsed days: YTD cash ÷ days elapsed × 365. Includes recurring and one-time cash collected."
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <MetricCard
          title="Active Clients"
          value={metrics?.activeCustomers ?? '—'}
          subtitle="Active Stripe subscriptions"
          trend={clientTrend ? `${clientTrend.pct}% vs last sync` : undefined}
          trendPositive={clientTrend?.positive}
          icon="👥"
          tooltip="Count of unique Stripe subscriptions in active or past_due status at the time of last sync. Each subscription counts as one client (a customer with multiple subs counts multiple times)."
        />
        <MetricCard
          title="New Clients (30d)"
          value={metrics?.newCustomers ?? '—'}
          subtitle="New subscriptions, last 30 days"
          icon="✦"
          tooltip="Count of Stripe subscriptions whose created date falls within the rolling 30-day window before last sync. Based on subscription start date, not customer creation date."
        />
        <Link href="/finance/churn" className="block transition hover:-translate-y-0.5">
          <MetricCard
            title="Churned (30d)"
            value={metrics?.churnedCustomers ?? '—'}
            subtitle="Tap to view details →"
            icon="↘"
            tooltip="Count of Stripe subscriptions with cancelled status whose cancellation date falls within the rolling 30-day window before last sync. Tap to see the full list of churned clients."
          />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="surface-card rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between gap-4">
            <div>
              <h3 className="flex items-center font-semibold text-white">
                RPE — MRR Based
                <MetricTooltip text={`(MRR × 12) ÷ ${NORMALIZED_EMPLOYEES} normalized employees. Measures annualized recurring revenue generated per employee. Target is ${formatCurrency(RPE_TARGET)}/yr per employee. MRR-based RPE excludes one-time project revenue.`} />
              </h3>
              <p className="mt-1 text-xs executive-muted">
                MRR × 12 ÷ {NORMALIZED_EMPLOYEES} employees · Target: {formatCurrency(RPE_TARGET)}/yr
              </p>
            </div>
            <div className="text-right">
              <div style={{ color: rpeMrr && rpeMrr >= RPE_TARGET ? '#86efac' : B.accent }} className="text-2xl font-semibold">
                {formatCurrency(rpeMrr)}
              </div>
              <div className="text-xs executive-muted">per year</div>
            </div>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: B.inset }}>
            <div
              className="h-2.5 rounded-full transition-all"
              style={{
                width: `${rpeProgress}%`,
                backgroundColor: rpeProgress >= 100 ? '#34d399' : 'var(--brand-primary-3)',
              }}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs executive-muted">
            <span>$0</span>
            <span style={{ color: rpeProgress >= 100 ? '#86efac' : B.accent }}>
              {rpeProgress.toFixed(1)}% of target
            </span>
            <span>{formatCurrency(RPE_TARGET)}</span>
          </div>
          {rpeTrend && (
            <p className={`mt-3 text-sm font-medium ${rpeTrend.positive ? 'text-emerald-300' : 'text-rose-300'}`}>
              {rpeTrend.positive ? '↑' : '↓'} {rpeTrend.pct}% vs last sync
            </p>
          )}
        </div>

        <div className="surface-card rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between gap-4">
            <div>
              <h3 className="flex items-center font-semibold text-white">
                RPE — Revenue Based
                <MetricTooltip text={`(YTD cash ÷ ${daysElapsed} days elapsed × 365) ÷ ${NORMALIZED_EMPLOYEES} normalized employees. Annualizes actual YTD cash collected and divides by headcount. Updates every day of the year.`} />
              </h3>
              <p className="mt-1 text-xs executive-muted">
                YTD ann. ÷ {NORMALIZED_EMPLOYEES} employees · Target: {formatCurrency(RPE_TARGET)}/yr
              </p>
            </div>
            <div className="text-right">
              <div style={{ color: rpeRevenue && rpeRevenue >= RPE_TARGET ? '#86efac' : B.accent }} className="text-2xl font-semibold">
                {formatCurrency(rpeRevenue)}
              </div>
              <div className="text-xs executive-muted">per year</div>
            </div>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: B.inset }}>
            <div
              className="h-2.5 rounded-full transition-all"
              style={{
                width: `${rpeRevenueProgress}%`,
                backgroundColor: rpeRevenueProgress >= 100 ? '#34d399' : 'var(--brand-primary-4)',
              }}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs executive-muted">
            <span>$0</span>
            <span style={{ color: rpeRevenueProgress >= 100 ? '#86efac' : B.accent }}>
              {rpeRevenueProgress.toFixed(1)}% of target
            </span>
            <span>{formatCurrency(RPE_TARGET)}</span>
          </div>
        </div>
      </div>

      {/* MRR Trend — 3 Year History */}
      <div className="rounded-2xl p-6 executive-surface">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold executive-label">
            MRR Trend — 3 Year History
          </h3>
          <span className="text-xs executive-muted">Jan 2023 – Present</span>
        </div>
        <p className="text-xs executive-muted mb-4">
          Jan 2023–Feb 2026: source Google Sheets · Mar 2026+: source Stripe · New MRR shown from Mar 2026 onwards
        </p>
        {!mrrTrendData ? (
          <div className="flex items-center justify-center h-48">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: B.p4, borderTopColor: 'transparent' }} />
          </div>
        ) : mrrTrendData.length === 0 ? (
          <p className="text-center text-sm executive-muted py-12">No MRR history available</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={mrrTrendData} margin={{ top: 5, right: 40, left: 10, bottom: 5 }}>
              <XAxis
                dataKey="month"
                tick={{ fill: B.muted, fontSize: 10 }}
                axisLine={{ stroke: B.border }}
                tickLine={false}
                tickFormatter={(month, index) => {
                  if (index % 6 !== 0) return ''
                  const [yr, mo] = month.split('-')
                  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
                  return months[parseInt(mo, 10) - 1] + ' \'' + yr.slice(2)
                }}
              />
              <YAxis
                yAxisId="left"
                tick={{ fill: B.muted, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => '$' + (v / 1000).toFixed(0) + 'k'}
                domain={['auto', 'auto']}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: B.muted, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => '$' + (v / 1000).toFixed(0) + 'k'}
                domain={[0, 'auto']}
              />
              <Tooltip
                formatter={(value, name) => [
                  '$' + Number(value).toLocaleString(),
                  name === 'mrr' ? 'Total MRR' : 'New MRR',
                ]}
                contentStyle={{ background: B.panel, border: `1px solid ${B.borderStrong}`, borderRadius: 12 }}
                labelStyle={{ color: B.muted }}
                itemStyle={{ color: B.p4 }}
                labelFormatter={(label) => {
                  const [yr, mo] = label.split('-')
                  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
                  return months[parseInt(mo, 10) - 1] + ' ' + yr
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 12, color: B.muted }}
                formatter={(value) => value === 'mrr' ? 'Total MRR' : 'New MRR'}
              />
              <Bar
                yAxisId="right"
                dataKey="newMrr"
                fill={B.accent}
                radius={[3, 3, 0, 0]}
                opacity={0.75}
                maxBarSize={12}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="mrr"
                stroke={B.p4}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: B.p4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {mrrHistory.length > 0 && (
        <div className="surface-card rounded-2xl p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="border-l-[3px] border-[var(--brand-primary-4)] pl-3 font-semibold text-white">
              MRR — Last 30 Days
            </h3>
            <span className="text-xs executive-muted">Real daily MRR from active subscriptions</span>
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
                contentStyle={{ background: B.panel, border: `1px solid ${B.borderStrong}`, borderRadius: 12 }}
                labelStyle={{ color: B.muted }}
                itemStyle={{ color: B.p4 }}
              />
              <Bar dataKey="mrr" radius={[4, 4, 0, 0]}>
                {mrrHistory.map((entry, index) => (
                  <Cell key={`cell-mrr-${entry.date}`} fill={index === mrrHistory.length - 1 ? B.p4 : B.p2} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {dailyRevenue.length > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <MetricCard
              title="Today's Cash"
              value={formatCurrency(todayRevenue)}
              subtitle="Cash collected today"
              icon="💵"
              tooltip="Sum of all paid Stripe invoices dated today (calendar date in UTC). Updates each time a sync runs. May be $0 early in the day if no charges have processed yet."
            />
            <div className="surface-card rounded-2xl p-5">
              <p className="mb-1 flex items-center text-[11px] font-semibold uppercase tracking-[0.18em] executive-muted">
                Yesterday
                <MetricTooltip text="Sum of all paid Stripe invoices dated yesterday (calendar date in UTC). Pulled from the DailyRevenue table populated during Stripe sync." />
              </p>
              <p className="metric-card-value text-2xl font-semibold text-white">{formatCurrency(yesterdayRevenue)}</p>
              <p className="mt-1 text-[13px] executive-muted">Cash collected yesterday</p>
            </div>
            <div className="surface-card rounded-2xl p-5">
              <p className="mb-1 flex items-center text-[11px] font-semibold uppercase tracking-[0.18em] executive-muted">
                7-Day Avg
                <MetricTooltip text="Average daily cash over the last 7 calendar days (sum ÷ 7). Based on paid Stripe invoices grouped by day. Smooths out day-of-week variation to show typical daily run rate." />
              </p>
              <p className="metric-card-value text-2xl font-semibold text-white">{formatCurrency(sevenDayAvg)}</p>
              <p className="mt-1 text-[13px] executive-muted">Average daily cash (last 7 days)</p>
            </div>
          </div>

          <div className="surface-card rounded-2xl p-5">
            <h3 className="mb-1 border-l-[3px] border-[var(--brand-primary-4)] pl-3 font-semibold text-white">
              Daily Cash Collected (30d)
            </h3>
            <p className="mb-4 text-xs executive-muted">Successful charges per day</p>
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
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(166, 111, 205, 0.08)' }} />
                <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                  {dailyChartData.map((entry, index) => (
                    <Cell key={`cell-daily-${index}`} fill={entry.date === todayStr ? B.accent : B.p3} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="mt-2 text-center text-xs executive-faint">Today is highlighted in gold</p>
          </div>
        </div>
      )}
    </div>
  )
}
