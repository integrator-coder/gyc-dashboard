'use client'

import { useEffect, useState } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts'

const YEAR_COLORS = {
  2023: '#6366f1',
  2024: '#10b981',
  2025: '#f59e0b',
  2026: '#ef4444',
}

const CATEGORY_COLORS = {
  website: '#6366f1',
  seo: '#10b981',
  blueprint: '#f59e0b',
  crm: '#ef4444',
  paid_media: '#8b5cf6',
  legacy: '#6b7280',
  other: '#374151',
}

const CATEGORY_LABELS = {
  website: 'Website',
  seo: 'SEO',
  blueprint: 'Blueprint',
  crm: 'CRM',
  paid_media: 'Paid Media',
  legacy: 'Legacy',
  other: 'Other',
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

function heatColor(val, min, max) {
  if (!val) return '#1f2937'
  const ratio = (val - min) / (max - min || 1)
  const opacity = 0.2 + ratio * 0.8
  return `rgba(16, 185, 129, ${opacity.toFixed(2)})`
}

// ── Existing Sections ────────────────────────────────────────────────────────

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
  const currentYear = new Date().getFullYear()
  const currentMonthIdx = new Date().getMonth()
  const currentMonthAbbr = MONTH_NAMES[currentMonthIdx]
  const filteredData = chartData.map(entry => {
    if (entry.month === currentMonthAbbr) {
      const { [currentYear]: _excluded, ...rest } = entry
      return rest
    }
    return entry
  })
  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-6">
      <h2 className="text-white font-semibold text-lg mb-4">📈 Year-over-Year Revenue (Jan–Dec)</h2>
      <p className="text-gray-400 text-sm mb-4">All years overlaid — compare seasonal patterns at a glance</p>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={filteredData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis domain={[225000, 'auto']} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <Tooltip formatter={(val, name) => [fmtFull(val), name]} contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#e5e7eb' }} />
          <Legend wrapperStyle={{ paddingTop: 16 }} />
          {[2023, 2024, 2025, 2026].map(year => (
            <Line key={year} type="monotone" dataKey={year.toString()} stroke={YEAR_COLORS[year]} strokeWidth={year === 2026 ? 2.5 : 2} strokeDasharray={year === 2026 ? '6 3' : undefined} dot={false} connectNulls={false} name={year === 2026 ? `${year} (partial)` : year.toString()} />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <p className="text-gray-500 text-xs mt-2 text-center">{currentMonthAbbr} {currentYear} excluded from {currentYear} line — month in progress.</p>
    </div>
  )
}

function QuarterlyChart({ quarterlyData }) {
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
          <Tooltip formatter={(val, name) => [fmtFull(val), name]} contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#e5e7eb' }} />
          <Legend />
          {years.map(year => (
            <Bar key={year} dataKey={year.toString()} name={year === 2026 ? `${year} (partial)` : year.toString()} fill={YEAR_COLORS[year]} radius={[3, 3, 0, 0]} />
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
                  <span className={`font-bold ${row.retentionPct >= 90 ? 'text-emerald-400' : row.retentionPct >= 75 ? 'text-yellow-400' : 'text-red-400'}`}>{row.retentionPct}%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
          <div key={row.month} className="rounded-lg p-3 text-center" style={{ backgroundColor: heatColor(row.avg, min, max) }}>
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

// ── NEW: MRR Trend from StripeSubscriptionHistory ────────────────────────────

function MrrTrendChart({ mrrTrend }) {
  if (!mrrTrend?.length) return null
  // Show all months with > 0 MRR, limit to last 24
  const data = mrrTrend
    .filter(r => r.mrr > 0)
    .slice(-24)
    .map(r => ({
      month: r.month?.slice(2), // '2025-06' → '25-06'
      mrr: r.mrr,
      newMrr: r.newMrr || 0,
      churnedMrr: r.churnedMrr || 0,
    }))

  const latestMrr = data[data.length - 1]?.mrr || 0
  const prevMrr = data[data.length - 2]?.mrr || 0
  const momGrowth = prevMrr > 0 ? Math.round(((latestMrr - prevMrr) / prevMrr) * 100 * 10) / 10 : null

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-white font-semibold text-lg">📈 Subscription MRR Trend</h2>
          <p className="text-gray-400 text-sm mt-1">Monthly recurring revenue from active subscriptions · Last 24 months</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-white">{fmt(latestMrr)}</div>
          <div className="text-xs text-gray-500">Latest MRR</div>
          {momGrowth != null && (
            <div className={`text-sm font-semibold ${momGrowth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {momGrowth >= 0 ? '↑' : '↓'} {Math.abs(momGrowth)}% MoM
            </div>
          )}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} interval={2} />
          <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <Tooltip
            formatter={(val, name) => [fmtFull(val), name === 'mrr' ? 'MRR' : name === 'newMrr' ? 'New MRR' : 'Churned MRR']}
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
          />
          <Legend />
          <Bar dataKey="mrr" name="MRR" fill="#6366f1" radius={[3, 3, 0, 0]} />
          <Bar dataKey="newMrr" name="New MRR" fill="#10b981" radius={[3, 3, 0, 0]} />
          <Bar dataKey="churnedMrr" name="Churned MRR" fill="#ef4444" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <p className="text-gray-500 text-xs mt-2 text-center">
        Data from StripeSubscriptionHistory · Reflects subscriptions tracked in Stripe
      </p>
    </div>
  )
}

// ── NEW: Revenue by Program ───────────────────────────────────────────────────

function RevenueByProgramChart({ revenueByProgram }) {
  if (!revenueByProgram?.length) return null

  const years = [...new Set(revenueByProgram.map(r => r.year))].sort()
  const categories = ['website', 'seo', 'blueprint', 'crm', 'paid_media']

  const data = years.map(year => {
    const entry = { year: year.toString() }
    for (const cat of categories) {
      const row = revenueByProgram.find(r => r.year === year && r.category === cat)
      entry[cat] = row?.mrrContribution || 0
      entry[`${cat}_clients`] = row?.clients || 0
    }
    return entry
  })

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-6">
      <h2 className="text-white font-semibold text-lg mb-4">📦 Revenue by Program per Year</h2>
      <p className="text-gray-400 text-sm mb-4">Subscription MRR contribution by service line</p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <Tooltip
            formatter={(val, name) => [fmtFull(val), CATEGORY_LABELS[name] || name]}
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
          />
          <Legend formatter={name => CATEGORY_LABELS[name] || name} />
          {categories.map(cat => (
            <Bar key={cat} dataKey={cat} stackId="a" fill={CATEGORY_COLORS[cat]} name={cat} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── NEW: Program Churn Rate ───────────────────────────────────────────────────

function ProgramChurnChart({ programChurn }) {
  if (!programChurn?.length) return null

  // Aggregate across all years for overall churn rate
  const byCategory = {}
  for (const r of programChurn) {
    if (!byCategory[r.category]) byCategory[r.category] = { total: 0, canceled: 0 }
    byCategory[r.category].total += r.totalStarted
    byCategory[r.category].canceled += r.totalCanceled
  }

  const data = Object.entries(byCategory)
    .map(([cat, v]) => ({
      category: CATEGORY_LABELS[cat] || cat,
      churnRate: v.total > 0 ? Math.round((v.canceled / v.total) * 100 * 10) / 10 : 0,
      total: v.total,
      canceled: v.canceled,
    }))
    .sort((a, b) => b.churnRate - a.churnRate)

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-6">
      <h2 className="text-white font-semibold text-lg mb-4">🔄 Program Churn Rate</h2>
      <p className="text-gray-400 text-sm mb-4">% of subscriptions canceled by service line (all time)</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 60, left: 80, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis type="number" tickFormatter={v => `${v}%`} tick={{ fill: '#9ca3af', fontSize: 12 }} domain={[0, 100]} />
          <YAxis type="category" dataKey="category" tick={{ fill: '#9ca3af', fontSize: 12 }} width={75} />
          <Tooltip
            formatter={(val, name, props) => [`${val}% (${props.payload.canceled}/${props.payload.total})`, 'Churn Rate']}
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
          />
          <Bar dataKey="churnRate" radius={[0, 4, 4, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.churnRate > 50 ? '#ef4444' : entry.churnRate > 25 ? '#f59e0b' : '#10b981'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── NEW: Program Retention at Milestones ─────────────────────────────────────

function ProgramRetentionTable({ programRetention }) {
  if (!programRetention?.length) return null
  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-6">
      <h2 className="text-white font-semibold text-lg mb-4">📐 Program Retention at Milestones</h2>
      <p className="text-gray-400 text-sm mb-4">% of subscriptions still active at 3 / 6 / 12 / 24 months</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left py-2 pr-4">Program</th>
              <th className="text-right py-2 pr-4">Total</th>
              <th className="text-right py-2 pr-4">@ 3mo</th>
              <th className="text-right py-2 pr-4">@ 6mo</th>
              <th className="text-right py-2 pr-4">@ 12mo</th>
              <th className="text-right py-2 pr-4">@ 24mo</th>
              <th className="text-right py-2">Avg Tenure (churned)</th>
            </tr>
          </thead>
          <tbody>
            {programRetention.map(row => (
              <tr key={row.category} className="border-b border-gray-700/50">
                <td className="py-3 pr-4">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[row.category] || '#6b7280' }} />
                    <span className="text-white font-medium">{CATEGORY_LABELS[row.category] || row.category}</span>
                  </span>
                </td>
                <td className="text-right py-3 pr-4 text-gray-300">{row.total}</td>
                {[row.pct3m, row.pct6m, row.pct12m, row.pct24m].map((pct, i) => (
                  <td key={i} className="text-right py-3 pr-4">
                    <span className={`font-semibold ${pct >= 80 ? 'text-emerald-400' : pct >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>{pct}%</span>
                  </td>
                ))}
                <td className="text-right py-3 text-gray-400">
                  {row.avgTenureChurned != null ? `${row.avgTenureChurned}mo` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── NEW: Client Program Mix ───────────────────────────────────────────────────

const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

function ClientProgramMix({ clientProgramMix }) {
  if (!clientProgramMix?.length) return null
  const total = clientProgramMix.reduce((s, r) => s + r.clientCount, 0)
  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-6">
      <h2 className="text-white font-semibold text-lg mb-4">🥧 Client Program Mix</h2>
      <p className="text-gray-400 text-sm mb-4">How many active service lines each client has</p>
      <div className="flex items-center gap-8">
        <ResponsiveContainer width="50%" height={220}>
          <PieChart>
            <Pie data={clientProgramMix} dataKey="clientCount" nameKey="label" cx="50%" cy="50%" outerRadius={90} label={({ label, percent }) => `${label} ${Math.round(percent * 100)}%`} labelLine={false}>
              {clientProgramMix.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(val, name) => [val, name]} contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex-1 space-y-3">
          {clientProgramMix.map((row, i) => (
            <div key={row.label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                <span className="text-gray-300 text-sm">{row.label}</span>
              </div>
              <div className="text-right">
                <span className="text-white font-semibold">{row.clientCount}</span>
                <span className="text-gray-500 text-xs ml-1">({Math.round((row.clientCount / total) * 100)}%)</span>
              </div>
            </div>
          ))}
          <div className="border-t border-gray-700 pt-2 flex items-center justify-between">
            <span className="text-gray-400 text-sm font-medium">Total active clients</span>
            <span className="text-white font-bold">{total}</span>
          </div>
          {clientProgramMix.find(r => r.programCount >= 2) && (
            <div className="text-emerald-400 text-sm font-medium">
              {Math.round((clientProgramMix.filter(r => r.programCount >= 2).reduce((s, r) => s + r.clientCount, 0) / total) * 100)}% of clients have 2+ programs
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── NEW: Additional Insights ──────────────────────────────────────────────────

function AdditionalInsights({ avgClientTenure, revenueConcentration, seasonalAcquisition, mrrTrend }) {
  const insights = []

  if (avgClientTenure) {
    const years = Math.floor(avgClientTenure / 12)
    const months = Math.round(avgClientTenure % 12)
    insights.push({
      icon: '⏱️',
      title: 'Average Client Tenure (Churned)',
      value: `${years > 0 ? `${years}y ` : ''}${months}mo`,
      detail: `Clients who cancel stay an average of ${avgClientTenure.toFixed(1)} months before churning`,
    })
  }

  if (revenueConcentration) {
    insights.push({
      icon: '💰',
      title: 'Revenue Concentration',
      value: `${revenueConcentration.top20Pct}%`,
      detail: `Top 20% of clients (${Math.round(revenueConcentration.totalClients * 0.2)} clients) drive ${revenueConcentration.top20Pct}% of MRR`,
    })
  }

  if (seasonalAcquisition?.length) {
    const best = seasonalAcquisition.reduce((a, b) => b.newSubs > a.newSubs ? b : a)
    const worst = seasonalAcquisition.reduce((a, b) => b.newSubs < a.newSubs ? b : a)
    insights.push({
      icon: '📅',
      title: 'Seasonal Acquisition',
      value: best.month,
      detail: `Most subscriptions start in ${best.month} (${best.newSubs} subs) · slowest is ${worst.month} (${worst.newSubs} subs)`,
    })
  }

  if (mrrTrend?.length >= 2) {
    const recent = mrrTrend.filter(r => r.mrr > 0).slice(-6)
    const totalNewMrr = recent.reduce((s, r) => s + (r.newMrr || 0), 0)
    const totalChurned = recent.reduce((s, r) => s + (r.churnedMrr || 0), 0)
    const netMrr = totalNewMrr - totalChurned
    if (totalNewMrr > 0) {
      insights.push({
        icon: '🆕',
        title: 'New vs Expansion (Last 6 Months)',
        value: fmt(totalNewMrr),
        detail: `${fmt(totalNewMrr)} new MRR added · ${fmt(totalChurned)} churned · net ${fmt(netMrr)} (${netMrr >= 0 ? '+' : ''}${Math.round((netMrr / (totalNewMrr || 1)) * 100)}%)`,
      })
    }
  }

  if (!insights.length) return null

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-6">
      <h2 className="text-white font-semibold text-lg mb-4">🔬 Deep Dive Insights</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {insights.map((ins, i) => (
          <div key={i} className="bg-gray-900 rounded-lg p-4 border border-gray-700/50">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{ins.icon}</span>
              <span className="text-gray-400 text-xs font-medium uppercase tracking-wide">{ins.title}</span>
            </div>
            <div className="text-2xl font-bold text-white mb-1">{ins.value}</div>
            <div className="text-gray-500 text-xs leading-relaxed">{ins.detail}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── NEW: Seasonal Acquisition Bar ────────────────────────────────────────────

function SeasonalAcquisitionChart({ seasonalAcquisition }) {
  if (!seasonalAcquisition?.length) return null
  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-6">
      <h2 className="text-white font-semibold text-lg mb-4">📅 Seasonal Subscription Starts</h2>
      <p className="text-gray-400 text-sm mb-4">Which months see the most new subscription activations (all years combined)</p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={seasonalAcquisition} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
          <Bar dataKey="newSubs" name="New Subscriptions" radius={[4, 4, 0, 0]}>
            {(seasonalAcquisition || []).map((entry, i) => {
              const max = Math.max(...seasonalAcquisition.map(r => r.newSubs))
              const ratio = entry.newSubs / max
              const opacity = 0.4 + ratio * 0.6
              return <Cell key={i} fill={`rgba(99, 102, 241, ${opacity})`} />
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Existing KeyInsights ──────────────────────────────────────────────────────

function KeyInsights({ annualSummary, seasonalHeatmap, cohortData }) {
  const insights = []
  if (annualSummary?.length >= 3) {
    const yr2023 = annualSummary.find(y => y.year === 2023)
    const yr2024 = annualSummary.find(y => y.year === 2024)
    const yr2025 = annualSummary.find(y => y.year === 2025)
    const yr2026 = annualSummary.find(y => y.year === 2026)
    if (yr2024?.yoyGrowth != null) insights.push({ icon: '📈', text: `2024 delivered ${yr2024.yoyGrowth > 0 ? '+' : ''}${yr2024.yoyGrowth}% YoY growth over 2023 — cash collected jumped from ${fmt(yr2023?.total)} to ${fmt(yr2024?.total)}.` })
    if (yr2025?.yoyGrowth != null) insights.push({ icon: yr2025.yoyGrowth >= 0 ? '🚀' : '⚠️', text: `2025 saw ${yr2025.yoyGrowth > 0 ? '+' : ''}${yr2025.yoyGrowth}% growth over 2024. ${yr2025.yoyGrowth < 0 ? 'Revenue contracted slightly — worth investigating.' : 'Solid continued growth.'}` })
    if (yr2026?.annualized) insights.push({ icon: '🔮', text: `2026 is tracking toward ${fmt(yr2026.annualized)} annualized (based on ${fmt(yr2026.total)} YTD through early April) — ${yr2026.yoyGrowth != null ? `${yr2026.yoyGrowth > 0 ? '+' : ''}${yr2026.yoyGrowth}% vs 2025` : 'pace TBD'}.` })
  }
  if (seasonalHeatmap?.length) {
    const best = seasonalHeatmap.reduce((a, b) => b.avg > a.avg ? b : a, { avg: 0 })
    const worst = seasonalHeatmap.filter(r => r.avg > 0).reduce((a, b) => b.avg < a.avg ? b : a, { avg: Infinity })
    insights.push({ icon: '📅', text: `Seasonality is real: ${best.month} is historically the strongest month (avg ${fmt(best.avg)}), while ${worst.month} tends to be the slowest (avg ${fmt(worst.avg)}). Plan campaigns accordingly.` })
  }
  if (cohortData?.length) {
    const high = cohortData.filter(r => r.year >= 2022 && r.year <= 2024)
    if (high.length) {
      const avgRetention = Math.round(high.reduce((s, r) => s + r.retentionPct, 0) / high.length)
      insights.push({ icon: '💪', text: `Customer retention is exceptional — ${avgRetention}% avg retention across 2022–2024 cohorts still active today. This indicates strong product-market fit and low voluntary churn.` })
    }
  }
  insights.push({ icon: '🔍', text: `October 2025 was an outlier — $410K collected vs the year's ~$295K average. Investigate whether this was a billing cycle catch-up, promo push, or one-time event.` })
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

// ── Main Page ─────────────────────────────────────────────────────────────────

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
        <p className="text-gray-400 mt-1">3 years of revenue data · Subscription MRR · Program-level churn · Retention analysis</p>
      </div>

      {/* 1. Summary Cards */}
      <SummaryCards annualSummary={data?.annualSummary || []} />

      {/* 2. Key Insights — above the fold */}
      <KeyInsights annualSummary={data?.annualSummary} seasonalHeatmap={data?.seasonalHeatmap} cohortData={data?.cohortData} />

      {/* 3. YoY Line Chart */}
      <YoYChart chartData={data?.chartData || []} />

      {/* 4. Quarterly Breakdown */}
      <QuarterlyChart quarterlyData={data?.quarterlyData || []} />

      {/* 5. Seasonal Heatmap */}
      <SeasonalHeatmap seasonalHeatmap={data?.seasonalHeatmap} />

      {/* 6. Customer Cohort Table */}
      <CohortTable cohortData={data?.cohortData || []} />

      {/* ── NEW SUBSCRIPTION SECTIONS ─────────────────────────── */}
      <div className="mt-2 mb-6 border-t border-gray-700 pt-6">
        <h2 className="text-xl font-bold text-white mb-1">🔬 Subscription Intelligence</h2>
        <p className="text-gray-500 text-sm">Program-level breakdown from StripeSubscriptionHistory · {data?.mrrTrend?.filter(r => r.mrr > 0).length || 0} months of data · {data?.clientProgramMix?.reduce((s, r) => s + r.clientCount, 0) || 0} active clients tracked</p>
      </div>

      {/* 7. Subscription MRR Trend */}
      <MrrTrendChart mrrTrend={data?.mrrTrend} />

      {/* 8. Revenue by Program */}
      <RevenueByProgramChart revenueByProgram={data?.revenueByProgram} />

      {/* 9. Program Churn Rate */}
      <ProgramChurnChart programChurn={data?.programChurn} />

      {/* 10. Program Retention at Milestones */}
      <ProgramRetentionTable programRetention={data?.programRetention} />

      {/* 11. Client Program Mix */}
      <ClientProgramMix clientProgramMix={data?.clientProgramMix} />

      {/* 12. Seasonal Acquisition */}
      <SeasonalAcquisitionChart seasonalAcquisition={data?.seasonalAcquisition} />

      {/* 13. Deep Dive Insights (tenure, concentration, new vs expansion) */}
      <AdditionalInsights
        avgClientTenure={data?.avgClientTenure}
        revenueConcentration={data?.revenueConcentration}
        seasonalAcquisition={data?.seasonalAcquisition}
        mrrTrend={data?.mrrTrend}
      />

      {/* Footer note */}
      <div className="text-xs text-gray-600 mt-4 text-center">
        Data from Neon PostgreSQL · DailyRevenue + StripeCustomer + StripeSubscriptionHistory + MRRHistory · Synced by Eve
      </div>
    </div>
  )
}
