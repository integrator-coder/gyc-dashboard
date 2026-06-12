'use client'

import { useState, useEffect } from 'react'
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/solid'

const BENCHMARK_CPC_MIN = 3.00
const BENCHMARK_CPC_MAX = 4.50

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

export default function GoogleAdsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showAllAccounts, setShowAllAccounts] = useState(false)

  useEffect(() => {
    fetch('/api/google-ads')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
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

  const { accounts, aggregates } = data
  const flaggedAccounts = accounts.filter(a => a.flagged)
  const activeAccounts = accounts.filter(a => !a.flagged)

  // Sort flagged by CPC change descending (worst first)
  flaggedAccounts.sort((a, b) => (b.cpcChange || 0) - (a.cpcChange || 0))

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: '#0a0a0a' }}>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Google Ads Performance</h1>
        <p className="text-gray-400 mt-2">Last 30 Days vs Prior 30 Days</p>
        {data.accounts[0] && (
          <p className="text-gray-500 text-sm mt-1">
            Last synced: {new Date(data.accounts[0].lastSynced).toLocaleString()}
          </p>
        )}
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

      {/* Needs Attention Section */}
      {flaggedAccounts.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-2xl font-bold text-white">🚨 Needs Attention</h2>
            <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-sm font-semibold">
              {flaggedAccounts.length} accounts
            </span>
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
          <h2 className="text-2xl font-bold text-white">All Active Accounts</h2>
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
