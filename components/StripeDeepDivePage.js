'use client'

import { useEffect, useState } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts'

const YEAR_COLORS = {
  2023: '#6366f1',
  2024: '#10b981',
  2025: '#f59e0b',
  2026: '#ef4444',
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmt(n) {
  if (n == null) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n).toLocaleString()}`
}

function fmtFull(n) {
  if (n == null) return '—'
  return `$${Math.round(n).toLocaleString()}`
}

function growthBadge(pct) {
  if (pct == null) return null
  const color = pct >= 0 ? 'text-emerald-400' : 'text-red-400'
  const arrow = pct >= 0 ? '↑' : '↓'
  return <span className={`text-sm font-bold ${color}`}>{arrow} {Math.abs(pct)}% YoY</span>
}

// Color scale for heatmap
function heatColor(val, min, max) {
  if (!val) return '#1f2937'
  const ratio = (val - min) / (max - min || 1)
  // deep blue → emerald
  const r = Math.round(16 + ratio * (16 - 16))
  const g = Math.round(55 + ratio * (185 - 55))
  const b = Math.round(92 + ratio * (129 - 92))
  // Simple: use opacity
  const opacity = 0.2 + ratio * 0.8
  return `rgba(16, 185, 129, ${opacity.toFixed(2)})`
}

function SummaryCards({ annualSummary }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {annualSummary.map(yr => (
        <div key={yr.year} className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center justify-between mb-1">
            <span className="text-gray-400 text-sm font-medium">{yr.year}</span>
            {yr.ytdFlag && (
              <span className="text-xs bg-yellow-900 text-yellow-300 px-2 py-0.5 rounded-full">YTD → Annualized</span>
            )}
          </div>
          <div className="text-2xl font-bold text-white mb-1">
            {fmt(yr.ytdFlag ? yr.annualized : yr.total)}
          </div>
          {yr.ytdFlag && (
            <div className="text-xs text-gray-500 mb-1">YTD: {fmt(yr.total)}</div>
          )}
          <div className="mt-2">{growthBadge(yr.yoyGrowth)}</div>
          <div className="mt-2 text-xs text-gray-500">
            Avg/mo: {fmt(yr.avgMonthly)}
          </div>
          <div className="text-xs text-gray-500">
            Peak: {yr.peakMonth} ({fmt(yr.peakAmount)})
          </div>
        </div>
      ))}
    </div>
  )
}

function YoYChart({ chartData }) {
  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-6">
      <h2 className="text-white font-semibold text-lg mb-4">📈 Year-over-Year Revenue (Jan–Dec)</h2>
      <p className="text-gray-400 text-sm mb-4">All years overlaid — compare seasonal patterns at a glance</p>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis
            tickFormatter={v => `$${(v / 1000).toFixed(0)}K`}
            tick={{ fill: '#9ca3af', fontSize: 12 }}
          />
          <Tooltip
            formatter={(val, name) => [fmtFull(val), name]}
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#e5e7eb' }}
          />
          <Legend wrapperStyle={{ paddingTop: 16 }} />
          {[2023, 2024, 2025, 2026].map(year => (
            <Line
              key={year}
              type="monotone"
              dataKey={year.toString()}
              stroke={YEAR_COLORS[year]}
              strokeWidth={year === 2026 ? 2.5 : 2}
              strokeDasharray={year === 2026 ? '6 3' : undefined}
              dot={false}
              connectNulls={false}
              name={year === 2026 ? `${year} (partial)` : year.toString()}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function QuarterlyChart({ quarterlyData }) {
  // Group for grouped bar chart
  const years = [2023, 2024, 2025, 2026]
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4']
  const data = quarters.map(q => {
    const entry = { quarter: q }
    for (const year of years) {
      const row = quarterlyData.find(r => r.year === year && r.quarter === q)
      entry[year] = row?.revenue || null
    }
    return entry
  })

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-6">
      <h2 className="text-white font-semibold text-lg mb-4">📊 Quarterly Revenue Breakdown</h2>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="quarter" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <Tooltip
            formatter={(val, name) => [fmtFull(val), name]}
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#e5e7eb' }}
          />
          <Legend />
          {years.map(year => (
            <Bar key={year} dataKey={year.toString()} name={year === 2026 ? `${year} (partial)` : year.toString()}
              fill={YEAR_COLORS[year]} radius={[3, 3, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function CohortTable({ cohortData }) {
  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-6">
      <h2 className="text-white font-semibold text-lg mb-4">👥 Customer Cohort Retention</h2>
      <p className="text-gray-400 text-sm mb-4">Customers acquired each year — how many are still active today</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left py-2 pr-4">Cohort Year</th>
              <th className="text-right py-2 pr-4">Acquired</th>
              <th className="text-right py-2 pr-4">Still Active</th>
              <th className="text-right py-2 pr-4">Past Due</th>
              <th className="text-right py-2 pr-4">Churned</th>
              <th className="text-right py-2">Retention %</th>
            </tr>
          </thead>
          <tbody>
            {cohortData.map(row => (
              <tr key={row.year} className="border-b border-gray-700/50 hover:bg-gray-750">
                <td className="py-3 pr-4 font-medium text-white">{row.year}</td>
                <td className="text-right py-3 pr-4 text-gray-300">{row.acquired}</td>
                <td className="text-right py-3 pr-4 text-emerald-400 font-semibold">{row.stillActive}</td>
                <td className="text-right py-3 pr-4 text-yellow-400">{row.pastDue}</td>
                <td className="text-right py-3 pr-4 text-red-400">{row.churned}</td>
                <td className="text-right py-3">
                  <span className={`font-bold ${row.retentionPct >= 90 ? 'text-emerald-400' : row.retentionPct >= 75 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {row.retentionPct}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MrrTrendChart({ mrrTrend }) {
  if (!mrrTrend?.length) return null
  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-6">
      <h2 className="text-white font-semibold text-lg mb-4">📉 MRR Snapshots</h2>
      <p className="text-gray-400 text-sm mb-4">Monthly MRR from Stripe sync history</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={mrrTrend}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <Tooltip
            formatter={(val, name) => [fmtFull(val), name === 'mrr' ? 'MRR' : name]}
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
          />
          <Bar dataKey="mrr" name="MRR" fill="#6366f1" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-3 flex gap-6 text-sm text-gray-400">
        {mrrTrend.map(m => (
          <div key={m.month}>
            <span className="text-gray-500">{m.month}: </span>
            <span className="text-white font-medium">{fmt(m.mrr)}</span>
            <span className="text-gray-600"> · {m.activeCustomers} active · {m.churnedCustomers} churned</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SeasonalHeatmap({ seasonalHeatmap }) {
  if (!seasonalHeatmap?.length) return null
  const values = seasonalHeatmap.map(r => r.avg).filter(v => v > 0)
  const min = Math.min(...values)
  const max = Math.max(...values)

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-6">
      <h2 className="text-white font-semibold text-lg mb-4">🌡️ Seasonal Revenue Heatmap</h2>
      <p className="text-gray-400 text-sm mb-4">Average monthly revenue 2023–2025 · Darker green = higher revenue</p>
      <div className="grid grid-cols-6 md:grid-cols-12 gap-2">
        {seasonalHeatmap.map(row => (
          <div
            key={row.month}
            className="rounded-lg p-3 text-center"
            style={{ backgroundColor: heatColor(row.avg, min, max) }}
          >
            <div className="text-xs font-semibold text-white/90">{row.month}</div>
            <div className="text-xs text-white/70 mt-1">{row.avg ? `$${(row.avg / 1000).toFixed(0)}K` : '—'}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-4 text-xs text-gray-500">
        <span>🟢 Best: {seasonalHeatmap.reduce((a, b) => b.avg > a.avg ? b : a, { avg: 0 }).month} ({fmt(seasonalHeatmap.reduce((a, b) => b.avg > a.avg ? b : a, { avg: 0 }).avg)})</span>
        <span>🔵 Slowest: {seasonalHeatmap.filter(r => r.avg > 0).reduce((a, b) => b.avg < a.avg ? b : a, { avg: Infinity }).month} ({fmt(seasonalHeatmap.filter(r => r.avg > 0).reduce((a, b) => b.avg < a.avg ? b : a, { avg: Infinity }).avg)})</span>
      </div>
    </div>
  )
}

function KeyInsights({ annualSummary, seasonalHeatmap, cohortData }) {
  // Derive insights from data
  const insights = []

  if (annualSummary?.length >= 3) {
    const yr2023 = annualSummary.find(y => y.year === 2023)
    const yr2024 = annualSummary.find(y => y.year === 2024)
    const yr2025 = annualSummary.find(y => y.year === 2025)
    const yr2026 = annualSummary.find(y => y.year === 2026)

    if (yr2024?.yoyGrowth != null) {
      insights.push({
        icon: '📈',
        text: `2024 delivered ${yr2024.yoyGrowth > 0 ? '+' : ''}${yr2024.yoyGrowth}% YoY growth over 2023 — cash collected jumped from ${fmt(yr2023?.total)} to ${fmt(yr2024?.total)}.`,
      })
    }
    if (yr2025?.yoyGrowth != null) {
      insights.push({
        icon: yr2025.yoyGrowth >= 0 ? '🚀' : '⚠️',
        text: `2025 saw ${yr2025.yoyGrowth > 0 ? '+' : ''}${yr2025.yoyGrowth}% growth over 2024. ${yr2025.yoyGrowth < 0 ? 'Revenue contracted slightly — worth investigating.' : 'Solid continued growth.'}`,
      })
    }
    if (yr2026?.annualized) {
      insights.push({
        icon: '🔮',
        text: `2026 is tracking toward ${fmt(yr2026.annualized)} annualized (based on ${fmt(yr2026.total)} YTD through early April) — ${yr2026.yoyGrowth != null ? `${yr2026.yoyGrowth > 0 ? '+' : ''}${yr2026.yoyGrowth}% vs 2025` : 'pace TBD'}.`,
      })
    }
  }

  // Seasonal insight
  if (seasonalHeatmap?.length) {
    const best = seasonalHeatmap.reduce((a, b) => b.avg > a.avg ? b : a, { avg: 0 })
    const worst = seasonalHeatmap.filter(r => r.avg > 0).reduce((a, b) => b.avg < a.avg ? b : a, { avg: Infinity })
    insights.push({
      icon: '📅',
      text: `Seasonality is real: ${best.month} is historically the strongest month (avg ${fmt(best.avg)}), while ${worst.month} tends to be the slowest (avg ${fmt(worst.avg)}). Plan campaigns accordingly.`,
    })
  }

  // Cohort insight
  if (cohortData?.length) {
    const high = cohortData.filter(r => r.year >= 2022 && r.year <= 2024)
    if (high.length) {
      const avgRetention = Math.round(high.reduce((s, r) => s + r.retentionPct, 0) / high.length)
      insights.push({
        icon: '💪',
        text: `Customer retention is exceptional — ${avgRetention}% avg retention across 2022–2024 cohorts still active today. This indicates strong product-market fit and low voluntary churn.`,
      })
    }
  }

  // Oct 2025 spike note
  insights.push({
    icon: '🔍',
    text: `October 2025 was an outlier — $410K collected vs the year's ~$295K average. Investigate whether this was a billing cycle catch-up, promo push, or one-time event.`,
  })

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-6">
      <h2 className="text-white font-semibold text-lg mb-4">💡 Key Insights</h2>
      <div className="space-y-3">
        {insights.map((ins, i) => (
          <div key={i} className="flex gap-3 p-3 bg-gray-750 rounded-lg border border-gray-700/50">
            <span className="text-xl flex-shrink-0 mt-0.5">{ins.icon}</span>
            <p className="text-gray-300 text-sm leading-relaxed">{ins.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function StripeDeepDivePage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/metrics/stripe-deep-dive')
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setData(d)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 animate-pulse">Loading Stripe Deep Dive...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 bg-red-900/20 rounded-xl border border-red-800 text-red-300">
        Error: {error}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">💳 Stripe Deep Dive</h1>
        <p className="text-gray-400 mt-1">3 years of revenue data · Year-over-year analysis · Cohort retention · Seasonal trends</p>
      </div>

      {/* 1. Summary Cards */}
      <SummaryCards annualSummary={data?.annualSummary || []} />

      {/* 7. Key Insights — above the fold */}
      <KeyInsights
        annualSummary={data?.annualSummary}
        seasonalHeatmap={data?.seasonalHeatmap}
        cohortData={data?.cohortData}
      />

      {/* 2. YoY Line Chart */}
      <YoYChart chartData={data?.chartData || []} />

      {/* 3. Quarterly Breakdown */}
      <QuarterlyChart quarterlyData={data?.quarterlyData || []} />

      {/* 6. Seasonal Heatmap */}
      <SeasonalHeatmap seasonalHeatmap={data?.seasonalHeatmap} />

      {/* 4. Customer Cohort Table */}
      <CohortTable cohortData={data?.cohortData || []} />

      {/* 5. MRR / Churn Timeline */}
      <MrrTrendChart mrrTrend={data?.mrrTrend} />

      {/* Footer note */}
      <div className="text-xs text-gray-600 mt-4 text-center">
        Data from Neon PostgreSQL · DailyRevenue + StripeCustomer + StripeMetrics · Updated nightly by Eve
      </div>
    </div>
  )
}
