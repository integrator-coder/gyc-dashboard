'use client'

import { useState, useEffect } from 'react'
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/solid'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts'

const BENCHMARK_CPC_MIN = 3.00
const BENCHMARK_CPC_MAX = 4.50
// Custom dot: hollow circle for partial month, filled for completed
const CustomDot = (color) => (props) => {
  const { cx, cy, payload } = props
  if (!cx || !cy) return null
  if (payload.partial) {
    return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={5} fill="#0a0a0a" stroke={color} strokeWidth={2} strokeDasharray="3 2" />
  }
  return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={4} fill={color} />
}
// Custom bar fill: muted for partial month
const barFill = (entry) => entry.partial ? '#4c1d95' : '#7c3aed'

function StatCard({ label, value, change, valuePrefix = '', valueSuffix = '' }) {
  const isPositive = change > 0
  const isNegative = change < 0
  return (
    <div className="rounded-xl px-6 py-5" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
      <p className="text-xs text-gray-400">{label}</p>
      <div className="flex items-baseline gap-2 mt-2">
        <p className="text-3xl font-bold text-white">{valuePrefix}{value?.toLocaleString()}{valueSuffix}</p>
        {change !== null && change !== undefined && (
          <span className={`flex items-center gap-1 text-sm font-medium ${
            isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-gray-400'
          }`}>
            {isPositive && <ArrowUpIcon className="w-4 h-4" />}
            {isNegative && <ArrowDownIcon className="w-4 h-4" />}
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  )
}

function FlagBadge({ flag }) {
  return (
    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
      {flag}
    </span>
  )
}

function LastUpdatedBadge({ timestamp, label = 'Last synced' }) {
  if (!timestamp) return null
  const date = new Date(timestamp)
  const formatted = date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
  return (
    <span className="text-gray-500 text-xs">
      {label}: {formatted}
    </span>
  )
}

export default function GoogleAdsPage() {
  const [data, setData] = useState(null)
  const [monthlyData, setMonthlyData] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAllAccounts, setShowAllAccounts] = useState(false)
  const [showFullHistory, setShowFullHistory] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/google-ads').then(r => r.json()),
      fetch('/api/google-ads/monthly').then(r => r.json())
    ])
      .then(([adsData, monthly]) => {
        setData(adsData)
        // Transform monthly data for charts
        const chartData = monthly.snapshots.map(s => ({
          month: s.monthLabel.replace(' 2026', ''),
          spend: s.spend,
          clicks: s.clicks,
          impressions: s.impressions,
          avgCpc: s.avgCpc,
          partial: s.isPartial
        }))
        setMonthlyData(chartData)
        setLoading(false)
      })
      .catch(e => { console.error('Google Ads fetch error:', e); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: '#0a0a0a' }}>
        <p className="text-gray-400">Loading Google Ads data...</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: '#0a0a0a' }}>
        <p className="text-red-400">Failed to load data</p>
      </div>
    )
  }

  const { accounts, aggregates, lastSynced, monthlyLastUpdated } = data
  const flaggedAccounts = accounts.filter(a => a.flagged)
  const activeAccounts = accounts.filter(a => !a.flagged)

  // Sort flagged by CPC change descending (worst first)
  flaggedAccounts.sort((a, b) => (b.cpcChange || 0) - (a.cpcChange || 0))

  // Derived: what to show in charts
  const chartData = showFullHistory ? monthlyData : monthlyData.slice(-24)

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: '#0a0a0a' }}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-baseline gap-4">
          <h1 className="text-3xl font-bold text-white">Google Ads Performance</h1>
          <LastUpdatedBadge timestamp={lastSynced} />
        </div>
        <p className="text-gray-400 mt-2">Last 30 Days vs Prior 30 Days</p>
      </div>

      {/* Monthly Trend Charts */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-yellow-500">⚠ Months marked with ⚠ are partial (in-progress). Not comparable to full months.</p>
        <button 
          onClick={() => setShowFullHistory(!showFullHistory)}
          className="text-xs text-purple-400 hover:text-purple-300 border border-purple-800 rounded px-2 py-1"
        >
          {showFullHistory ? 'Show last 24 months' : 'Show full history (2022–present)'}
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl p-4" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
          <div className="flex justify-between items-center mb-3">
            <p className="text-xs text-gray-400">Monthly Spend Trend</p>
            <LastUpdatedBadge timestamp={monthlyLastUpdated} label="Updated" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a1a3e" />
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a0a2e', border: '1px solid #4c1d95' }}
                formatter={(v, name, props) => [
                  `$${Number(v).toLocaleString()}${props.payload?.partial ? ' (partial month)' : ''}`,
                  'Spend'
                ]}
              />
              <Line type="monotone" dataKey="spend" stroke="#a78bfa" strokeWidth={2}
                dot={CustomDot('#a78bfa')}
                strokeDasharray={(d) => d?.partial ? '5 4' : undefined}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
          <div className="flex justify-between items-center mb-3">
            <p className="text-xs text-gray-400">Monthly Clicks Trend</p>
            <LastUpdatedBadge timestamp={monthlyLastUpdated} label="Updated" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a1a3e" />
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a0a2e', border: '1px solid #4c1d95' }}
                formatter={(v, name, props) => [
                  `${Number(v).toLocaleString()}${props.payload?.partial ? ' (partial month)' : ''}`,
                  'Clicks'
                ]}
              />
              <Bar dataKey="clicks" radius={[4,4,0,0]} fill="#7c3aed"
                shape={(props) => {
                  const { x, y, width, height, payload } = props
                  return <rect x={x} y={y} width={width} height={height}
                    fill={payload.partial ? '#4c1d95' : '#7c3aed'}
                    rx={4} ry={4}
                    stroke={payload.partial ? '#7c3aed' : 'none'}
                    strokeWidth={payload.partial ? 1.5 : 0}
                    strokeDasharray={payload.partial ? '4 3' : 'none'}
                  />
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard 
          label="Total Spend" 
          value={(aggregates.totalSpend / 1000).toFixed(1)} 
          valuePrefix="$" 
          valueSuffix="K"
          change={null}
        />
        <StatCard 
          label="Total Clicks" 
          value={aggregates.totalClicks} 
          change={null}
        />
        <StatCard 
          label="Avg CPC" 
          value={aggregates.avgCpc.toFixed(2)} 
          valuePrefix="$"
          change={null}
        />
        <StatCard 
          label="Active Accounts" 
          value={aggregates.totalAccounts}
          change={null}
        />
      </div>

      {/* Benchmark Callout */}
      <div className="mb-8 rounded-xl px-6 py-4" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
        <p className="text-sm text-gray-400">
          <span className="font-semibold text-white">Childcare Benchmark:</span> $3.00–$4.50 CPC
        </p>
      </div>

      {/* Portfolio Performance Charts */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-2xl font-bold text-white">📊 Portfolio Performance Charts</h2>
        </div>
        <p className="text-sm text-gray-400 mb-4">Source: GYC Google Ads MCC Report — June 2026</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: '#111111', borderColor: '#2a1a3e' }}>
            <div className="p-4">
              <img 
                src="/google-ads-charts/chart-01.png" 
                alt="Portfolio Performance Chart 1" 
                className="w-full rounded-lg"
              />
            </div>
          </div>
          <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: '#111111', borderColor: '#2a1a3e' }}>
            <div className="p-4">
              <img 
                src="/google-ads-charts/chart-02.png" 
                alt="Portfolio Performance Chart 2" 
                className="w-full rounded-lg"
              />
            </div>
          </div>
          <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: '#111111', borderColor: '#2a1a3e' }}>
            <div className="p-4">
              <img 
                src="/google-ads-charts/chart-03.png" 
                alt="Portfolio Performance Chart 3" 
                className="w-full rounded-lg"
              />
            </div>
          </div>
          <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: '#111111', borderColor: '#2a1a3e' }}>
            <div className="p-4">
              <img 
                src="/google-ads-charts/chart-04.png" 
                alt="Portfolio Performance Chart 4" 
                className="w-full rounded-lg"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Needs Attention Section */}
      {flaggedAccounts.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-2xl font-bold text-white">🚨 Needs Attention</h2>
            <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-sm font-semibold">
              {flaggedAccounts.length} accounts
            </span>
            <LastUpdatedBadge timestamp={lastSynced} label="Data from" />
          </div>

          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#111111', border: '1px solid #731494' }}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: '#1a0a2e' }}>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300">Client Name</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">CPC (curr)</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">CPC (prev)</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">CPC Δ%</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">Clicks Δ%</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">Impr Δ%</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">30d Spend</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300">Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {flaggedAccounts.map((account, idx) => {
                    const cpcChangeAbs = Math.abs(account.cpcChange || 0)
                    const cpcColor = cpcChangeAbs > 100 ? 'text-red-400' 
                                   : cpcChangeAbs > 50  ? 'text-orange-400'
                                   : cpcChangeAbs > 20  ? 'text-yellow-400'
                                   : 'text-gray-400'
                    
                    return (
                      <tr key={account.id} style={{ borderBottom: idx < flaggedAccounts.length - 1 ? '1px solid #2a1a3e' : 'none' }}>
                        <td className="px-4 py-4 text-sm text-white font-medium">{account.accountName}</td>
                        <td className="px-4 py-4 text-sm text-right text-white">${account.currCpc.toFixed(2)}</td>
                        <td className="px-4 py-4 text-sm text-right text-gray-400">${account.prevCpc.toFixed(2)}</td>
                        <td className={`px-4 py-4 text-sm text-right font-semibold ${cpcColor}`}>
                          {account.cpcChange > 0 ? '+' : ''}{account.cpcChange?.toFixed(1)}%
                        </td>
                        <td className="px-4 py-4 text-sm text-right text-gray-300">
                          {account.clicksChange > 0 ? '+' : ''}{account.clicksChange?.toFixed(1)}%
                        </td>
                        <td className="px-4 py-4 text-sm text-right text-gray-300">
                          {account.impressionsChange > 0 ? '+' : ''}{account.impressionsChange?.toFixed(1)}%
                        </td>
                        <td className="px-4 py-4 text-sm text-right text-white">
                          ${account.currSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-4 py-4 text-sm">
                          <div className="flex flex-wrap gap-1">
                            {account.flags.map((flag, i) => <FlagBadge key={i} flag={flag} />)}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Top Performers Section */}
      {aggregates.topPerformers.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-2xl font-bold text-white">🏆 Top Performers</h2>
            <LastUpdatedBadge timestamp={lastSynced} label="Data from" />
          </div>

          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#111111', border: '1px solid #2a7c3e' }}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: '#0a2e1a' }}>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300">Client Name</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">Clicks</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">CPC</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">CTR</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">Spend</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-300">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregates.topPerformers.map((account, idx) => (
                    <tr key={account.id} style={{ borderBottom: idx < aggregates.topPerformers.length - 1 ? '1px solid #2a1a3e' : 'none' }}>
                      <td className="px-4 py-4 text-sm text-white font-medium">{account.accountName}</td>
                      <td className="px-4 py-4 text-sm text-right text-white">{account.currClicks.toLocaleString()}</td>
                      <td className="px-4 py-4 text-sm text-right text-white">${account.currCpc.toFixed(2)}</td>
                      <td className="px-4 py-4 text-sm text-right text-gray-300">{account.currCtr?.toFixed(2)}%</td>
                      <td className="px-4 py-4 text-sm text-right text-white">
                        ${account.currSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-green-400 text-sm font-semibold">
                          ▲ {account.clicksChange?.toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* All Active Accounts Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-white">All Active Accounts</h2>
            <LastUpdatedBadge timestamp={lastSynced} label="Data from" />
          </div>
          <button
            onClick={() => setShowAllAccounts(!showAllAccounts)}
            className="text-sm text-purple-400 hover:text-purple-300 font-medium"
          >
            {showAllAccounts ? 'Hide' : 'Show'} ({activeAccounts.length} accounts)
          </button>
        </div>

        {showAllAccounts && (
          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: '#1a0a2e' }}>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300">Client Name</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">Clicks</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">Impressions</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">CPC</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">CTR</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">30d Spend</th>
                  </tr>
                </thead>
                <tbody>
                  {activeAccounts.map((account, idx) => (
                    <tr key={account.id} style={{ borderBottom: idx < activeAccounts.length - 1 ? '1px solid #2a1a3e' : 'none' }}>
                      <td className="px-4 py-4 text-sm text-white font-medium">{account.accountName}</td>
                      <td className="px-4 py-4 text-sm text-right text-white">{account.currClicks.toLocaleString()}</td>
                      <td className="px-4 py-4 text-sm text-right text-gray-300">{account.currImpressions.toLocaleString()}</td>
                      <td className="px-4 py-4 text-sm text-right text-white">${account.currCpc.toFixed(2)}</td>
                      <td className="px-4 py-4 text-sm text-right text-gray-300">{account.currCtr?.toFixed(2)}%</td>
                      <td className="px-4 py-4 text-sm text-right text-white">
                        ${account.currSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
