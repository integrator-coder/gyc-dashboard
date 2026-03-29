'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'

const PURPLE = '#AE2BCF'
const VIOLET = '#731494'
const GOLD = '#C19C46'
const GRAY = '#4a3060'

function fmt$(v) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(v || 0))
}

function StatCard({ label, value, sub, accent = PURPLE }) {
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
      <div className="w-8 h-0.5 rounded-full mb-2" style={{ backgroundColor: accent }} />
      <p className="text-gray-500 text-xs uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
      {sub ? <p className="text-gray-600 text-xs mt-1">{sub}</p> : null}
    </div>
  )
}

function SectionHeader({ title, sub }) {
  return (
    <div className="mb-3">
      <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-widest">{title}</h2>
      {sub ? <p className="text-gray-600 text-xs mt-0.5">{sub}</p> : null}
    </div>
  )
}

function DataTable({ columns, rows, maxRows }) {
  const visible = maxRows ? rows.slice(0, maxRows) : rows
  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid #2a1a3e' }}>
              {columns.map((col) => (
                <th key={col.key} className={`px-4 py-3 text-gray-500 text-xs uppercase tracking-wider font-semibold ${col.right ? 'text-right' : 'text-left'}`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => (
              <tr key={i} style={{ borderBottom: i < visible.length - 1 ? '1px solid #1a0a2e' : 'none' }} className="hover:bg-white/5">
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-2.5 text-gray-200 ${col.right ? 'text-right tabular-nums' : ''}`}>
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const PIE_COLORS = [PURPLE, VIOLET, GOLD, '#5b21b6', '#7c3aed', '#C19C46', '#2a1a3e', '#9333ea']

function SmallPie({ data, label }) {
  return (
    <div>
      <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-2">{label}</p>
      <div className="flex items-center gap-4">
        <PieChart width={120} height={120}>
          <Pie data={data} dataKey="value" cx={55} cy={55} innerRadius={30} outerRadius={52} paddingAngle={3}>
            {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(v) => fmt$(v)} />
        </PieChart>
        <div className="space-y-1.5">
          {data.map((d, i) => (
            <div key={d.name} className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
              <span className="text-gray-400">{d.name}</span>
              <span className="text-white font-medium">{fmt$(d.value)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function SalesAnalysisPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [yearView, setYearView] = useState('overall')

  useEffect(() => {
    let active = true
    fetch('/api/metrics/sales-analysis')
      .then((r) => r.json())
      .then((json) => {
        if (!active) return
        if (json.error) throw new Error(json.error)
        setData(json)
      })
      .catch((e) => setError(e.message))
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const view = data?.[yearView]

  const topServiceBars = useMemo(() => {
    if (!view?.byService) return []
    return view.byService.slice(0, 12).map((s) => ({
      name: s.name.length > 18 ? s.name.slice(0, 16) + '…' : s.name,
      fullName: s.name,
      revenue: Math.round(s.revenue),
      deals: s.count,
    }))
  }, [view])

  const sizeBars = useMemo(() => view?.bySize || [], [view])

  const pifPieData = useMemo(() => {
    if (!view?.totals) return []
    return [
      { name: 'PIF', value: view.totals.pifCount },
      { name: 'Monthly', value: view.totals.monthlyCount },
    ]
  }, [view])

  const stripeYearBars = useMemo(() => {
    if (!data?.stripe?.byYear) return []
    return data.stripe.byYear.map((r) => ({
      year: String(r.year),
      subs: r.count,
      active: r.activeCount,
    }))
  }, [data])

  const pifShift = useMemo(() => {
    if (!data) return null
    const { year2025: y25, year2026: y26 } = data
    return [
      { year: '2025', pif: y25.totals.pifCount, monthly: y25.totals.monthlyCount, total: y25.totals.count },
      { year: '2026 YTD', pif: y26.totals.pifCount, monthly: y26.totals.monthlyCount, total: y26.totals.count },
    ]
  }, [data])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-[#AE2BCF] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Building sales analysis…</p>
        </div>
      </div>
    )
  }

  if (error) return <div className="text-red-300">⚠️ {error}</div>

  const t = view?.totals || {}
  const pifPct = t.count ? Math.round((t.pifCount / t.count) * 100) : 0

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Sales Analysis</h1>
          <p className="text-gray-500 text-sm mt-1">
            Product mix · sale-size distribution · package decomposition · payment type trend
          </p>
        </div>
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
          {[['overall', '2025 + 2026'], ['year2025', '2025 Only'], ['year2026', '2026 YTD']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setYearView(key)}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${yearView === key ? 'brand-active text-white' : 'text-gray-400 hover:text-white'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Deals Closed" value={t.count || '—'} sub="From Sales Scorecard" />
        <StatCard label="First Payment Sold" value={fmt$(t.revenue)} sub="Upfront new money" accent={VIOLET} />
        <StatCard label="New MRR Added" value={fmt$(t.mrr)} sub="Monthly recurring revenue" accent={GOLD} />
        <StatCard label="PIF Rate" value={`${pifPct}%`} sub={`${t.pifCount} PIF vs ${t.monthlyCount} monthly`} accent={PURPLE} />
      </div>

      {/* Service Revenue + Sale Sizes */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3">
          <SectionHeader title="Revenue by Service" sub="First payment collected per package/service" />
          <div className="rounded-xl p-4" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={topServiceBars} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a1a3e" horizontal={false} />
                <XAxis type="number" stroke="#6b7280" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
                <YAxis type="category" dataKey="name" stroke="#6b7280" tick={{ fontSize: 11 }} width={100} />
                <Tooltip
                  formatter={(val, name, props) => [fmt$(val), props.payload.fullName]}
                  contentStyle={{ backgroundColor: '#1a0a2e', border: '1px solid #2a1a3e', borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="revenue" name="Revenue" fill={PURPLE} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="xl:col-span-2 space-y-6">
          <div>
            <SectionHeader title="Sale Size Distribution" />
            <div className="rounded-xl p-4" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={sizeBars}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a1a3e" />
                  <XAxis dataKey="bucket" stroke="#6b7280" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#6b7280" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1a0a2e', border: '1px solid #2a1a3e', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" name="Deals" fill={VIOLET} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <SectionHeader title="PIF vs Monthly" />
            <div className="rounded-xl p-4" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
              <SmallPie
                label=""
                data={pifPieData.map((d, i) => ({ ...d, value: d.value }))}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Detailed service table */}
      <section>
        <SectionHeader title="Service Detail" sub="All packages and services with deal counts, revenue, and payment type" />
        <DataTable
          columns={[
            { key: 'name', label: 'Service / Package' },
            { key: 'count', label: 'Deals', right: true },
            { key: 'revenue', label: 'First Payment', right: true, render: (v) => fmt$(v) },
            { key: 'avg', label: 'Avg Sale', right: true, render: (v) => fmt$(v) },
            { key: 'mrr', label: 'MRR Added', right: true, render: (v) => fmt$(v) },
            { key: 'pifCount', label: 'PIF', right: true },
            { key: 'monthlyCount', label: 'Monthly', right: true },
          ]}
          rows={view?.byService || []}
        />
      </section>

      {/* Line items */}
      <section>
        <SectionHeader
          title="Line Items Inside Packages"
          sub="When someone buys Web+SEO+CRM that counts as 3 units — shows actual volume of each service sold"
        />
        <DataTable
          columns={[
            { key: 'name', label: 'Service Component' },
            { key: 'count', label: 'Units Sold', right: true },
            { key: 'revenue', label: 'Attributed Revenue', right: true, render: (v) => fmt$(v) },
          ]}
          rows={view?.lineItems || []}
        />
      </section>

      {/* PIF Shift */}
      <section>
        <SectionHeader
          title="PIF vs Monthly Shift (2025 → 2026)"
          sub="This is the market signal — are clients shifting to paid-in-full or moving away from monthly commitments?"
        />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="rounded-xl p-4" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={pifShift}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a1a3e" />
                <XAxis dataKey="year" stroke="#6b7280" tick={{ fontSize: 12 }} />
                <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1a0a2e', border: '1px solid #2a1a3e', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
                <Bar dataKey="pif" name="PIF" fill={PURPLE} radius={[4, 4, 0, 0]} stackId="a" />
                <Bar dataKey="monthly" name="Monthly" fill={GRAY} radius={[4, 4, 0, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3">
            {pifShift?.map((row) => {
              const pct = row.total > 0 ? Math.round((row.pif / row.total) * 100) : 0
              return (
                <div key={row.year} className="rounded-xl p-4" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-white font-semibold">{row.year}</span>
                    <span className="text-[#AE2BCF] font-bold text-lg">{pct}% PIF</span>
                  </div>
                  <div className="flex gap-4 text-sm text-gray-400">
                    <span>{row.pif} paid-in-full</span>
                    <span>{row.monthly} monthly</span>
                    <span>{row.total} total</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-gray-800 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: PURPLE }} />
                  </div>
                </div>
              )
            })}
            <div className="rounded-xl p-4" style={{ backgroundColor: '#1a0a2e', border: '1px solid #2a1a3e' }}>
              <p className="text-xs text-gray-400">
                <strong className="text-violet-300">What this tells you:</strong> A jump from 13% PIF in 2025 to 53% PIF in 2026 YTD suggests clients are either more willing to commit upfront, or your team is positioning PIF more aggressively. Monitor whether this is correlated with larger or smaller deal sizes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stripe Historical */}
      <section>
        <SectionHeader
          title="Stripe — Client Acquisition by Year"
          sub="Subscription start dates from Stripe — shows how many new clients signed in each year"
        />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="rounded-xl p-4" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={stripeYearBars}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a1a3e" />
                <XAxis dataKey="year" stroke="#6b7280" tick={{ fontSize: 12 }} />
                <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1a0a2e', border: '1px solid #2a1a3e', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="subs" name="New Clients" fill={PURPLE} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <DataTable
              columns={[
                { key: 'year', label: 'Year' },
                { key: 'count', label: 'New Subs', right: true },
                { key: 'activeCount', label: 'Still Active', right: true },
                { key: 'canceledCount', label: 'Canceled', right: true },
                { key: 'totalMrr', label: 'MRR on File', right: true, render: (v) => fmt$(v) },
              ]}
              rows={data?.stripe?.byYear || []}
            />
          </div>
        </div>
      </section>
    </div>
  )
}
