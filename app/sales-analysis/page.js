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
const PIE_COLORS = [PURPLE, VIOLET, GOLD, '#5b21b6', '#7c3aed', '#340B67', '#9333ea', '#3d1078']

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

function DataTable({ columns, rows }) {
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
            {rows.map((row, i) => (
              <tr key={i} style={{ borderBottom: i < rows.length - 1 ? '1px solid #1a0a2e' : 'none' }} className="hover:bg-white/5">
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-2.5 text-gray-200 ${col.right ? 'text-right tabular-nums' : ''} ${col.bold ? 'font-semibold text-white' : ''}`}>
                    {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
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

function InsightBox({ text }) {
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: '#1a0a2e', border: '1px solid #2a1a3e' }}>
      <p className="text-xs text-gray-400">{text}</p>
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

  const topServiceBars = useMemo(() => (view?.byService || []).slice(0, 14).map((s) => ({
    name: s.name.length > 20 ? s.name.slice(0, 18) + '…' : s.name,
    fullName: s.name,
    revenue: Math.round(s.revenue),
    deals: s.count,
  })), [view])

  const lineItemBars = useMemo(() => (view?.lineItems || []).map((li) => ({
    name: li.name,
    count: li.count,
  })), [view])

  const sizeBars = useMemo(() => view?.bySize || [], [view])

  const pifShift = useMemo(() => {
    if (!data) return []
    return [
      { year: '2025', ...data.year2025.totals },
      { year: '2026 YTD', ...data.year2026.totals },
    ]
  }, [data])

  // Stripe by-year service heatmap data
  const stripeYears = useMemo(() => data?.stripe?.byYear || [], [data])

  // All unique service names across stripe years (for table columns)
  const stripeServiceNames = useMemo(() => {
    const names = new Set()
    stripeYears.forEach((yr) => yr.services.forEach((s) => names.add(s.name)))
    return [...names]
  }, [stripeYears])

  // Build stripe service table rows
  const stripeServiceRows = useMemo(() => {
    return stripeYears.map((yr) => {
      const row = { year: yr.year, total: yr.total, active: yr.active }
      yr.services.forEach((s) => { row[s.name] = s.count })
      return row
    })
  }, [stripeYears])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-[#AE2BCF] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Building sales analysis — fetching Stripe history…</p>
          <p className="text-gray-600 text-xs mt-1">This may take ~30s on first load</p>
        </div>
      </div>
    )
  }

  if (error) return <div className="text-red-300 p-4">⚠️ {error}</div>

  const t = view?.totals || {}
  const pifPct = t.count ? Math.round((t.pifCount / t.count) * 100) : 0

  return (
    <div className="max-w-7xl mx-auto space-y-8">

      {/* Header + Year Toggle */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Sales Analysis</h1>
          <p className="text-gray-500 text-sm mt-1">What we sold, how many of each, deal size distribution, and the shift in how clients pay</p>
        </div>
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
          {[['overall', '2025 + 2026'], ['year2025', '2025 Only'], ['year2026', '2026 YTD']].map(([key, label]) => (
            <button key={key} onClick={() => setYearView(key)}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${yearView === key ? 'brand-active text-white' : 'text-gray-400 hover:text-white'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Deals Closed" value={t.count ?? '—'} sub="From Sales Scorecard" />
        <StatCard label="First Payment Sold" value={fmt$(t.revenue)} sub="Upfront new money" accent={VIOLET} />
        <StatCard label="New MRR Added" value={fmt$(t.mrr)} sub="Monthly recurring" accent={GOLD} />
        <StatCard label="PIF Rate" value={`${pifPct}%`} sub={`${t.pifCount} PIF · ${t.monthlyCount} monthly`} />
      </div>

      {/* Revenue by Service + Sale Size */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3">
          <SectionHeader title="Revenue by Package / Service" sub="First payment per deal — top-level bundle names" />
          <div className="rounded-xl p-4" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={topServiceBars} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a1a3e" horizontal={false} />
                <XAxis type="number" stroke="#6b7280" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
                <YAxis type="category" dataKey="name" stroke="#6b7280" tick={{ fontSize: 11 }} width={110} />
                <Tooltip formatter={(val, _, props) => [fmt$(val), props.payload.fullName]}
                  contentStyle={{ backgroundColor: '#1a0a2e', border: '1px solid #2a1a3e', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="revenue" name="Revenue" fill={PURPLE} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="xl:col-span-2 flex flex-col gap-6">
          <div>
            <SectionHeader title="Deal Size Distribution" />
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
            <div className="rounded-xl p-4 flex items-center gap-4" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
              <PieChart width={110} height={110}>
                <Pie data={[{ value: t.pifCount || 0 }, { value: t.monthlyCount || 0 }]}
                  dataKey="value" cx={52} cy={52} innerRadius={28} outerRadius={48} paddingAngle={3}>
                  <Cell fill={PURPLE} /><Cell fill={GRAY} />
                </Pie>
              </PieChart>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: PURPLE }} /><span className="text-gray-300">PIF: <strong className="text-white">{t.pifCount}</strong></span></div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: GRAY }} /><span className="text-gray-300">Monthly: <strong className="text-white">{t.monthlyCount}</strong></span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Individual Service Units + Service Detail Table */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div>
          <SectionHeader
            title="Individual Services Sold (Unit Count)"
            sub="Web+SEO+CRM counts as 1 website + 1 SEO + 1 CRM — total units of each service sold"
          />
          <div className="rounded-xl p-4" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={lineItemBars} layout="vertical" margin={{ left: 0, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a1a3e" horizontal={false} />
                <XAxis type="number" stroke="#6b7280" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" stroke="#6b7280" tick={{ fontSize: 12 }} width={90} />
                <Tooltip contentStyle={{ backgroundColor: '#1a0a2e', border: '1px solid #2a1a3e', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" name="Units Sold" fill={GOLD} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div>
          <SectionHeader title="By Year — Services Sold" sub="Line items per year from the Scorecard (2025 + 2026)" />
          <div className="space-y-3">
            {['2025', '2026'].map((yr) => {
              const yrData = view?.byYear?.[yr]
              if (!yrData?.lineItems) return null
              return (
                <div key={yr} className="rounded-xl p-4" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
                  <p className="text-white font-semibold mb-2">{yr}</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(yrData.lineItems).sort((a, b) => b[1] - a[1]).map(([name, count]) => (
                      <span key={name} className="px-2.5 py-1 rounded-full text-xs font-medium text-white" style={{ backgroundColor: '#2a1a3e' }}>
                        {name} <span style={{ color: PURPLE }}>×{count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Detailed service table */}
      <section>
        <SectionHeader title="Full Service Detail" sub="Every package/service with deal count, revenue, avg deal size, and payment type split" />
        <DataTable
          columns={[
            { key: 'name', label: 'Service', bold: true },
            { key: 'count', label: 'Deals', right: true },
            { key: 'revenue', label: 'First Payment', right: true, render: (v) => fmt$(v) },
            { key: 'avg', label: 'Avg Sale', right: true, render: (v) => fmt$(v) },
            { key: 'mrr', label: 'MRR', right: true, render: (v) => fmt$(v) },
            { key: 'pifCount', label: 'PIF', right: true },
            { key: 'monthlyCount', label: 'Monthly', right: true },
          ]}
          rows={view?.byService || []}
        />
      </section>

      {/* PIF Shift */}
      <section>
        <SectionHeader title="PIF vs Monthly Shift — 2025 → 2026" sub="One of the clearest signals of market behaviour change" />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="rounded-xl p-4" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={pifShift}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a1a3e" />
                <XAxis dataKey="year" stroke="#6b7280" tick={{ fontSize: 12 }} />
                <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1a0a2e', border: '1px solid #2a1a3e', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
                <Bar dataKey="pifCount" name="PIF" fill={PURPLE} radius={[4, 4, 0, 0]} stackId="a" />
                <Bar dataKey="monthlyCount" name="Monthly" fill={GRAY} radius={[4, 4, 0, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3">
            {pifShift.map((row) => {
              const pct = row.count > 0 ? Math.round((row.pifCount / row.count) * 100) : 0
              return (
                <div key={row.year} className="rounded-xl p-4" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-white font-semibold">{row.year}</span>
                    <span style={{ color: PURPLE }} className="font-bold text-lg">{pct}% PIF</span>
                  </div>
                  <div className="flex gap-4 text-sm text-gray-400">
                    <span>{row.pifCount} paid-in-full</span>
                    <span>{row.monthlyCount} monthly</span>
                    <span>{row.count} total</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-gray-800 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: PURPLE }} />
                  </div>
                </div>
              )
            })}
            <InsightBox text="⚡ 13% PIF in 2025 → 53% PIF in 2026 YTD is a major signal. Possible reasons: (1) your team is presenting PIF more aggressively, (2) clients prefer to own the asset outright vs monthly commitment risk, (3) market shift toward childcare operators with more capital at decision time. Pair this with deal size trends to understand if PIF clients are buying more or less per deal." />
          </div>
        </div>
      </section>

      {/* Stripe Historical */}
      <section>
        <SectionHeader title="Stripe — Client Acquisition & Services by Year (2022–2026)" sub="Subscription start dates from Stripe. Shows what GYC was actually selling in each era." />

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-4">
          {stripeYears.map((yr) => (
            <div key={yr.year} className="rounded-xl p-4" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="text-white font-bold text-lg">{yr.year}</p>
                  <p className="text-gray-500 text-xs">{yr.total} new subs · {yr.active} still active</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#2a1a3e', color: '#AE2BCF' }}>
                  {yr.total > 0 ? Math.round((yr.active / yr.total) * 100) : 0}% retention
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(yr.services || []).slice(0, 8).map((s) => (
                  <span key={s.name} className="text-xs px-2 py-0.5 rounded-full text-gray-300" style={{ backgroundColor: '#1a0a2e', border: '1px solid #2a1a3e' }}>
                    {s.name} <span style={{ color: GOLD }}>×{s.count}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <SectionHeader title="Services by Year — Stripe Detail Table" />
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid #2a1a3e' }}>
                  <th className="px-4 py-3 text-left text-gray-500 text-xs uppercase tracking-wider">Year</th>
                  <th className="px-4 py-3 text-right text-gray-500 text-xs uppercase tracking-wider">New Subs</th>
                  {stripeServiceNames.slice(0, 10).map((n) => (
                    <th key={n} className="px-3 py-3 text-right text-gray-500 text-xs uppercase tracking-wider whitespace-nowrap">{n}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stripeServiceRows.map((row, i) => (
                  <tr key={row.year} style={{ borderBottom: i < stripeServiceRows.length - 1 ? '1px solid #1a0a2e' : 'none' }} className="hover:bg-white/5">
                    <td className="px-4 py-2.5 text-white font-semibold">{row.year}</td>
                    <td className="px-4 py-2.5 text-right text-gray-200 tabular-nums">{row.total}</td>
                    {stripeServiceNames.slice(0, 10).map((n) => (
                      <td key={n} className="px-3 py-2.5 text-right tabular-nums" style={{ color: (row[n] || 0) > 0 ? '#AE2BCF' : '#2a1a3e' }}>
                        {row[n] || '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <InsightBox text="⚠️ 2024–2025 show high 'Unknown' counts in Stripe — these are real active subscriptions from old product names (Boss Mode, Influence Enrollment System, Core Accelerator). Stripe shows the business model in 2022–2023 was heavily Website + Social Media + Staffing. The pivot to SEO / Blueprint / Command happened in 2025–2026. That shift is visible in the data." />
      </section>

    </div>
  )
}
