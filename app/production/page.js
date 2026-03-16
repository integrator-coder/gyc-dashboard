'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

function formatUpdated(isoStr) {
  if (!isoStr) return ''
  const diff = Math.floor((Date.now() - new Date(isoStr)) / 60000)
  if (diff < 1) return 'just now'
  if (diff === 1) return '1 min ago'
  return `${diff} min ago`
}

function firstName(name) {
  return name ? name.split(' ')[0] : name
}

const CustomBarTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm">
        <p className="text-gray-300 font-medium">{label}</p>
        <p className="text-teal-400 font-bold">{payload[0].value} open tasks</p>
      </div>
    )
  }
  return null
}

export default function ProductionPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/metrics/asana')
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

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchData])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading Production data…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto mt-10">
        <div className="bg-red-950 border border-red-800 rounded-lg px-4 py-3 text-red-300 text-sm">
          ⚠️ Error loading Production data: {error}
        </div>
      </div>
    )
  }

  const {
    totalOpen = 0,
    totalOverdue = 0,
    dueSoon = 0,
    completedThisWeek = 0,
    completedThisMonth = 0,
    assignees = [],
    syncedAt,
  } = data || {}

  const maxOpen = assignees.length > 0 ? Math.max(...assignees.map(a => a.totalOpen)) : 1

  const chartData = assignees.map(a => ({
    name: firstName(a.name),
    open: a.totalOpen,
  }))

  const chartHeight = Math.max(220, assignees.length * 36)

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Production</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {syncedAt ? `Synced ${formatUpdated(syncedAt)}` : 'Loading…'}
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); fetchData() }}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors border border-gray-700"
        >
          ↻ Refresh
        </button>
      </div>

      {/* ── Section 1: Overview Cards ───────────────────────── */}
      <section>
        <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-3">
          Task Overview
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">

          {/* Total Open Tasks */}
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2">Total Open</p>
            <p className="text-3xl font-bold text-white">{totalOpen}</p>
            <p className="text-gray-600 text-xs mt-1">tasks in flight</p>
          </div>

          {/* Overdue */}
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2">Overdue</p>
            <p className={`text-3xl font-bold ${totalOverdue > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {totalOverdue}
            </p>
            <p className="text-gray-600 text-xs mt-1">
              {totalOverdue > 0 ? 'past due date' : 'all on track ✓'}
            </p>
          </div>

          {/* Due This Week */}
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2">Due This Week</p>
            <p className={`text-3xl font-bold ${dueSoon > 20 ? 'text-yellow-400' : 'text-green-400'}`}>
              {dueSoon}
            </p>
            <p className="text-gray-600 text-xs mt-1">due in next 7 days</p>
          </div>

          {/* Completed This Week */}
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2">Done This Week</p>
            <p className="text-3xl font-bold text-teal-400">{completedThisWeek}</p>
            <p className="text-gray-600 text-xs mt-1">completed last 7d</p>
          </div>

          {/* Completed This Month */}
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2">Done This Month</p>
            <p className="text-3xl font-bold text-teal-400">{completedThisMonth}</p>
            <p className="text-gray-600 text-xs mt-1">completed this month</p>
          </div>

        </div>
      </section>

      {/* ── Section 2: High Output This Week ───────────────── */}
      {(() => {
        const highOutput = [...assignees]
          .filter(a => a.completedThisWeek > 0)
          .sort((a, b) => b.completedThisWeek - a.completedThisWeek)
          .slice(0, 8)
        const maxDone = highOutput.length > 0 ? highOutput[0].completedThisWeek : 1
        if (highOutput.length === 0) return null
        return (
          <section>
            <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-3">
              🏆 High Output — This Week
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {highOutput.map((a, i) => {
                const barPct = (a.completedThisWeek / maxDone) * 100
                const medals = ['🥇','🥈','🥉']
                return (
                  <div key={a.name} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-7 h-7 rounded-full bg-teal-900 flex items-center justify-center text-xs text-teal-300 font-bold shrink-0">
                        {a.name[0]}
                      </span>
                      <span className="text-white text-sm font-medium truncate">{a.name.split(' ')[0]}</span>
                      {medals[i] && <span className="ml-auto text-base">{medals[i]}</span>}
                    </div>
                    <p className="text-2xl font-bold text-teal-400">{a.completedThisWeek}</p>
                    <p className="text-gray-600 text-xs mb-2">tasks completed</p>
                    <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-teal-500 rounded-full" style={{ width: `${barPct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })()}

      {/* ── Section 3: Team Workload Table ──────────────────── */}
      {assignees.length > 0 && (
        <section>
          <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-3">
            Team Workload
          </h2>
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left px-4 py-3 text-gray-500 text-xs uppercase tracking-wider">Name</th>
                    <th className="text-right px-4 py-3 text-gray-500 text-xs uppercase tracking-wider">Open Tasks</th>
                    <th className="text-right px-4 py-3 text-gray-500 text-xs uppercase tracking-wider">Overdue</th>
                    <th className="text-right px-4 py-3 text-gray-500 text-xs uppercase tracking-wider">Due This Week</th>
                  </tr>
                </thead>
                <tbody>
                  {assignees.map(a => {
                    const barPct = maxOpen > 0 ? (a.totalOpen / maxOpen) * 100 : 0
                    return (
                      <tr key={a.name} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/40">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-full bg-teal-900 flex items-center justify-center text-xs text-teal-300 font-bold shrink-0">
                              {a.name[0]}
                            </span>
                            <span className="text-white font-medium">{a.name}</span>
                          </div>
                        </td>
                        <td className="text-right px-4 py-3">
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-white font-semibold">{a.totalOpen}</span>
                            <div className="w-24 h-1 bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-teal-500 rounded-full transition-all"
                                style={{ width: `${barPct}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="text-right px-4 py-3">
                          <span className={`font-semibold ${a.overdue > 0 ? 'text-red-400' : 'text-gray-600'}`}>
                            {a.overdue}
                          </span>
                        </td>
                        <td className="text-right px-4 py-3 text-gray-300">{a.dueSoon}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ── Section 4: Workload Bar Chart ───────────────────── */}
      {assignees.length > 0 && (
        <section>
          <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-3">
            Workload Distribution
          </h2>
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 4, right: 24, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  axisLine={{ stroke: '#374151' }}
                  tickLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  axisLine={{ stroke: '#374151' }}
                  tickLine={false}
                  width={80}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  content={<CustomBarTooltip />}
                />
                <Bar dataKey="open" fill="#14b8a6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {assignees.length === 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 px-5 py-8 text-center text-gray-500 text-sm">
          No GYC staff assignees found. Tasks may be unassigned or assigned to non-GYC emails.
        </div>
      )}

    </div>
  )
}
