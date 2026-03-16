'use client'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'

const fmt$ = (n) => '$' + Math.round(n ?? 0).toLocaleString()
const fmtK = (n) => (n >= 1000 ? '$' + (n / 1000).toFixed(0) + 'K' : '$' + Math.round(n))

const RED = '#EF4444'
const AMBER = '#F59E0B'
const RED_DIM = '#7F1D1D'
const AMBER_DIM = '#78350F'

function KpiCard({ label, value, sub, danger }) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        danger ? 'bg-red-950/40 border-red-800/60' : 'bg-gray-900 border-gray-800'
      }`}
    >
      <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${danger ? 'text-red-400' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
    </div>
  )
}

function BucketTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm">
      <p className="text-white font-semibold mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name === 'count' ? `${p.value} subscriptions` : `${fmtK(p.value)} MRR at risk`}
        </p>
      ))}
    </div>
  )
}

function bucketColor(label) {
  if (label === '0–7 days' || label === '8–14 days') return AMBER
  return RED
}

export default function DunningPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/metrics/dunning')
      .then((r) => r.json())
      .then((d) => {
        setData(d)
        setLoading(false)
      })
      .catch((e) => {
        setError(e.message)
        setLoading(false)
      })
  }, [])

  if (loading)
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading dunning data…
      </div>
    )
  if (error || data?.error)
    return <div className="text-red-400 p-6">Error: {error || data.error}</div>

  const { summary, buckets, pastDue, updatedAt } = data
  const { pastDueCount, mrrAtRisk, totalOutstanding, avgAttempts } = summary

  // Chart data with dual bars
  const chartData = buckets.map((b) => ({
    label: b.label,
    count: b.count,
    mrr: Math.round(b.mrr),
    color: bucketColor(b.label),
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Failed Payments &amp; Dunning</h1>
        <p className="text-gray-400 text-sm mt-1">
          Past-due subscriptions · Outstanding invoices · Stripe retry status ·{' '}
          Updated {new Date(updatedAt).toLocaleTimeString()}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Past-Due Subscriptions"
          value={pastDueCount}
          sub={pastDueCount > 0 ? 'Needs immediate attention' : 'All clear ✓'}
          danger={pastDueCount > 0}
        />
        <KpiCard
          label="MRR at Risk"
          value={fmt$(mrrAtRisk)}
          sub="From past-due subs"
          danger={mrrAtRisk > 0}
        />
        <KpiCard
          label="Total Outstanding"
          value={fmt$(totalOutstanding)}
          sub="Unpaid open invoices"
          danger={totalOutstanding > 0}
        />
        <KpiCard
          label="Avg Payment Attempts"
          value={avgAttempts.toFixed(1)}
          sub="Before invoice failure"
          danger={false}
        />
      </div>

      {/* Buckets Chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-white font-semibold mb-1">Days Past Due — Breakdown</h2>
        <p className="text-gray-500 text-xs mb-4">
          Amber = earlier buckets (0–14 days) · Red = older (15+ days, higher risk)
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Count chart */}
          <div>
            <p className="text-gray-400 text-xs mb-2 font-medium uppercase tracking-wide">
              Subscriptions by age bucket
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="label" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: '#9CA3AF', fontSize: 11 }}
                  width={32}
                />
                <Tooltip
                  content={({ active, payload, label }) =>
                    active && payload?.length ? (
                      <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm">
                        <p className="text-white font-semibold mb-1">{label}</p>
                        <p style={{ color: payload[0].payload.color }}>
                          {payload[0].value} subscription{payload[0].value !== 1 ? 's' : ''}
                        </p>
                      </div>
                    ) : null
                  }
                />
                <Bar dataKey="count" name="count" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* MRR chart */}
          <div>
            <p className="text-gray-400 text-xs mb-2 font-medium uppercase tracking-wide">
              MRR at risk by age bucket
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="label" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                <YAxis tickFormatter={fmtK} tick={{ fill: '#9CA3AF', fontSize: 11 }} width={48} />
                <Tooltip
                  content={({ active, payload, label }) =>
                    active && payload?.length ? (
                      <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm">
                        <p className="text-white font-semibold mb-1">{label}</p>
                        <p style={{ color: payload[0].payload.color }}>
                          {fmt$(payload[0].value)} MRR at risk
                        </p>
                      </div>
                    ) : null
                  }
                />
                <Bar dataKey="mrr" name="mrr" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bucket summary pills */}
        <div className="flex flex-wrap gap-3 mt-4">
          {buckets.map((b) => (
            <div
              key={b.label}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border ${
                bucketColor(b.label) === AMBER
                  ? 'bg-amber-950/40 border-amber-800/50 text-amber-300'
                  : 'bg-red-950/40 border-red-800/50 text-red-300'
              }`}
            >
              <span>{b.label}</span>
              <span className="text-gray-400">·</span>
              <span>{b.count} subs</span>
              <span className="text-gray-400">·</span>
              <span>{fmt$(b.mrr)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Past-Due Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-white font-semibold">Past-Due Subscriptions</h2>
            <p className="text-gray-500 text-xs mt-0.5">Sorted by days past due — oldest first</p>
          </div>
          {pastDueCount > 0 && (
            <span className="text-red-400 text-xs font-semibold px-3 py-1 bg-red-950/50 border border-red-800/50 rounded-full">
              {pastDueCount} past due
            </span>
          )}
        </div>

        {pastDue.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-2xl mb-2">✅</p>
            <p className="font-medium text-gray-400">No past-due subscriptions</p>
            <p className="text-xs mt-1">All subscriptions are current</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-xs uppercase border-b border-gray-800">
                  <th className="text-left pb-2 pr-4">Client</th>
                  <th className="text-right pb-2 pr-4">MRR</th>
                  <th className="text-right pb-2 pr-4">Days Past Due</th>
                  <th className="text-right pb-2 pr-4">Outstanding</th>
                  <th className="text-right pb-2 pr-4">Attempts</th>
                  <th className="text-right pb-2">Next Retry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {pastDue.map((row, i) => {
                  const isOld = row.daysPastDue >= 14
                  return (
                    <tr key={i} className="hover:bg-gray-800/50">
                      <td className="py-3 pr-4">
                        <p className="text-white font-medium">{row.name}</p>
                        {row.email && (
                          <p className="text-gray-500 text-xs mt-0.5">{row.email}</p>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-right text-white">{fmt$(row.mrr)}</td>
                      <td className="py-3 pr-4 text-right">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                            isOld
                              ? 'bg-red-950 text-red-400 border border-red-800/50'
                              : 'bg-amber-950 text-amber-400 border border-amber-800/50'
                          }`}
                        >
                          {row.daysPastDue}d
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right text-red-400 font-medium">
                        {fmt$(row.amountDue)}
                      </td>
                      <td className="py-3 pr-4 text-right text-gray-300">
                        {row.attemptCount}×
                      </td>
                      <td className="py-3 text-right text-gray-400 text-xs">
                        {row.nextAttempt ?? '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer note */}
      <p className="text-gray-600 text-xs pb-4">
        Data pulled from Stripe · Read-only · Retry schedules managed by Stripe Smart Retries
      </p>
    </div>
  )
}
