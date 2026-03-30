'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Area, AreaChart,
  Bar, BarChart,
  CartesianGrid, Cell,
  Legend,
  Pie, PieChart,
  ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'

// ─── Brand palette ────────────────────────────────────────────────────────────
const C = {
  purple:  '#AE2BCF',
  violet:  '#731494',
  deep:    '#340B67',
  gold:    '#C19C46',
  gray:    '#4a3060',
  slate:   '#6b7280',
  bg:      '#111111',
  border:  '#2a1a3e',
  bgDeep:  '#1a0a2e',
}

// Service → colour mapping (consistent across all charts)
const SERVICE_COLORS = {
  'Website':              '#AE2BCF',
  'Website Maintenance':  '#731494',
  'Paid Media':           '#C19C46',
  'Social Media':         '#5b21b6',
  'SEO':                  '#22d3ee',
  'SEO Core':             '#0e9aaa',
  'Blueprint':            '#f59e0b',
  'Blueprint + SEO':      '#d97706',
  'Command':              '#10b981',
  'CRM':                  '#3b82f6',
  'Website + CRM':        '#2563eb',
  'Website + SEO':        '#8b5cf6',
  'S3':                   '#ec4899',
  'Master':               '#ef4444',
  'Staffing':             '#6b7280',
  'Accelerator/Enrollment': '#78716c',
  'Virtual Tour':         '#a78bfa',
}
function serviceColor(name) { return SERVICE_COLORS[name] || '#9ca3af' }

function fmt$(v) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(v || 0))
}

// ─── Reusable UI pieces ───────────────────────────────────────────────────────
function Card({ label, value, sub, accent = C.purple }) {
  return (
    <div style={{ backgroundColor: C.bg, border: `1px solid ${C.border}` }} className="rounded-xl p-4">
      <div className="w-8 h-0.5 rounded-full mb-2" style={{ backgroundColor: accent }} />
      <p style={{ color: C.slate }} className="text-xs uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
      {sub && <p style={{ color: '#4a5568' }} className="text-xs mt-1">{sub}</p>}
    </div>
  )
}

function Section({ title, sub, children }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 style={{ color: '#9ca3af' }} className="text-xs font-semibold uppercase tracking-widest">{title}</h2>
        {sub && <p style={{ color: '#4a5568' }} className="text-xs mt-0.5">{sub}</p>}
      </div>
      {children}
    </section>
  )
}

function Panel({ children, h }) {
  return (
    <div style={{ backgroundColor: C.bg, border: `1px solid ${C.border}` }} className="rounded-xl p-4">
      <div style={h ? { height: h } : undefined}>{children}</div>
    </div>
  )
}

function Insight({ text }) {
  return (
    <div style={{ backgroundColor: C.bgDeep, border: `1px solid ${C.border}` }} className="rounded-xl p-4">
      <p className="text-xs text-gray-400">{text}</p>
    </div>
  )
}

function DataTable({ columns, rows }) {
  return (
    <div style={{ backgroundColor: C.bg, border: `1px solid ${C.border}` }} className="rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {columns.map((col) => (
                <th key={col.key} className={`px-4 py-3 text-xs uppercase tracking-wider font-semibold ${col.right ? 'text-right' : 'text-left'}`} style={{ color: C.slate }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ borderBottom: i < rows.length - 1 ? `1px solid ${C.bgDeep}` : 'none' }} className="hover:bg-white/5">
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

const TOOLTIP_STYLE = { backgroundColor: C.bgDeep, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }

// ─── Custom tooltip for stacked bars ─────────────────────────────────────────
function StackedTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + (p.value || 0), 0)
  return (
    <div style={TOOLTIP_STYLE} className="p-3 min-w-[160px]">
      <p className="text-white font-semibold mb-2">{label}</p>
      {[...payload].reverse().map((p) => p.value > 0 && (
        <div key={p.dataKey} className="flex justify-between gap-4 text-xs">
          <span style={{ color: p.fill }}>{p.name}</span>
          <span className="text-gray-300 tabular-nums">{p.value}</span>
        </div>
      ))}
      <div className="mt-1 pt-1 flex justify-between text-xs font-semibold border-t border-gray-700">
        <span className="text-gray-400">Total</span>
        <span className="text-white">{total}</span>
      </div>
    </div>
  )
}

// ─── Analyse raw deals with filter ───────────────────────────────────────────
function analyseDeals(deals) {
  const SALE_SIZE_BUCKETS = [
    { label: '<$500', min: 0, max: 500 },
    { label: '$500–$999', min: 500, max: 1000 },
    { label: '$1k–$1.9k', min: 1000, max: 2000 },
    { label: '$2k–$4.9k', min: 2000, max: 5000 },
    { label: '$5k+', min: 5000, max: Infinity },
  ]
  function bucket(v) { return SALE_SIZE_BUCKETS.find(b => v >= b.min && v < b.max)?.label || '$5k+' }
  function normSvc(s) {
    const t = String(s||'').toLowerCase()
    if (t.includes('web')||t.includes('site')) return 'Website'
    if (t.includes('seo')) return 'SEO'
    if (t.includes('paid')||t.includes('ads')||t.includes('media')) return 'Paid Media'
    if (t.includes('crm')) return 'CRM'
    if (t.includes('blueprint')) return 'Blueprint'
    if (t.includes('command')) return 'Command'
    if (t.includes('master')) return 'Master'
    if (t.includes('s3')) return 'S3'
    return s
  }
  function splitItems(svc) {
    const raw = String(svc||'').trim()
    const parts = raw.replace(/\s*\+\s*/g,'+').split('+').map(p=>p.trim()).filter(Boolean)
    return (parts.length > 1 ? parts : [raw]).map(normSvc).filter(Boolean)
  }

  const byService = {}, bySize = {}, lineItems = {}
  SALE_SIZE_BUCKETS.forEach(b => { bySize[b.label] = { count:0, revenue:0 } })

  for (const d of deals) {
    const svc = d.service || 'Unknown'
    const amt = d.firstPayment || 0
    if (!byService[svc]) byService[svc] = { count:0, revenue:0, avg:0, mrr:0, pifCount:0, monthlyCount:0 }
    byService[svc].count++; byService[svc].revenue += amt; byService[svc].mrr += d.mrr||0
    if (d.pif) byService[svc].pifCount++; else byService[svc].monthlyCount++
    bySize[bucket(amt)].count++; bySize[bucket(amt)].revenue += amt
    for (const comp of splitItems(svc)) {
      if (!lineItems[comp]) lineItems[comp] = { count:0, revenue:0 }
      lineItems[comp].count++; lineItems[comp].revenue += amt
    }
  }
  for (const k of Object.keys(byService)) {
    byService[k].avg = byService[k].count ? Math.round(byService[k].revenue / byService[k].count) : 0
  }
  const totals = deals.reduce((a,d) => {
    a.count++; a.revenue += d.firstPayment||0; a.mrr += d.mrr||0
    if (d.pif) a.pifCount++; else a.monthlyCount++
    return a
  }, { count:0, revenue:0, mrr:0, pifCount:0, monthlyCount:0 })
  const sort = (obj, fn) => Object.entries(obj).sort((a,b)=>fn(b[1])-fn(a[1])).map(([name,val])=>({name,...val}))
  return {
    totals,
    byService: sort(byService, v=>v.revenue),
    bySize: Object.entries(bySize).map(([bucket,val])=>({bucket,...val})),
    lineItems: sort(lineItems, v=>v.count),
  }
}

// ─── Main page ────────────────────────────────────────────────────────────────
// Filter modes: 'overall' | 'year2025' | 'year2026' | 'YYYY-MM' (specific month) | 'range:YYYY-MM:YYYY-MM'
export default function SalesAnalysisPage() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [filterMode, setFilterMode] = useState('overall')
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd,   setRangeEnd]   = useState('')
  const [showMonthPicker, setShowMonthPicker] = useState(false)

  useEffect(() => {
    let active = true
    fetch('/api/metrics/sales-analysis')
      .then((r) => r.json())
      .then((json) => {
        if (!active) return
        if (json.error) throw new Error(json.error)
        setData(json)
        // pre-set range to full available span
        if (json.availableMonths?.length) {
          setRangeStart(json.availableMonths[0].key)
          setRangeEnd(json.availableMonths[json.availableMonths.length-1].key)
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  // ── Derive the current view from raw deals + filterMode ─────────────────
  const view = useMemo(() => {
    if (!data) return null
    const raw = data.rawDeals || []

    let filtered = raw
    if (filterMode === 'year2025') {
      filtered = raw.filter(d => d.year === 2025)
    } else if (filterMode === 'year2026') {
      filtered = raw.filter(d => d.year === 2026)
    } else if (filterMode.match(/^\d{4}-\d{2}$/)) {
      const [yr, mo] = filterMode.split('-').map(Number)
      filtered = raw.filter(d => d.year === yr && d.month === mo)
    } else if (filterMode === 'range' && rangeStart && rangeEnd) {
      filtered = raw.filter(d => {
        if (!d.year || !d.month) return false
        const key = `${d.year}-${String(d.month).padStart(2,'0')}`
        return key >= rangeStart && key <= rangeEnd
      })
    }
    // 'overall' = all raw deals

    return analyseDeals(filtered)
  }, [data, filterMode, rangeStart, rangeEnd])

  const t = view?.totals || {}
  const pifPct = t.count ? Math.round((t.pifCount / t.count) * 100) : 0

  // Horizontal bar: revenue by package
  const revBars = useMemo(() => (view?.byService || []).slice(0, 14).map((s) => ({
    name:     s.name.length > 22 ? s.name.slice(0, 20) + '…' : s.name,
    fullName: s.name,
    revenue:  Math.round(s.revenue),
    deals:    s.count,
  })), [view])

  // Individual service unit counts
  const unitBars = useMemo(() => (view?.lineItems || []).map((li) => ({
    name:  li.name,
    count: li.count,
    color: serviceColor(li.name),
  })), [view])

  // Sale-size distribution
  const sizeBars = useMemo(() => view?.bySize || [], [view])

  // PIF shift bars — always compare 2025 vs 2026 regardless of filter, include revenue split
  const pifShift = useMemo(() => {
    const raw = data?.rawDeals || []
    const calc = (deals) => {
      const t = analyseDeals(deals).totals
      const pifRev = deals.filter(d=>d.pif).reduce((s,d)=>s+(d.firstPayment||0),0)
      const mthRev = deals.filter(d=>!d.pif).reduce((s,d)=>s+(d.firstPayment||0),0)
      return { ...t, pifRevenue: pifRev, monthlyRevenue: mthRev }
    }
    const s25 = calc(raw.filter(d=>d.year===2025))
    const s26 = calc(raw.filter(d=>d.year===2026))
    return [
      { year: '2025',     pif: s25.pifCount, monthly: s25.monthlyCount, count: s25.count, pifRevenue: s25.pifRevenue, monthlyRevenue: s25.monthlyRevenue },
      { year: '2026 YTD', pif: s26.pifCount, monthly: s26.monthlyCount, count: s26.count, pifRevenue: s26.pifRevenue, monthlyRevenue: s26.monthlyRevenue },
    ]
  }, [data])

  // ── Stripe historical charts ──────────────────────────────────────────────

  // All unique service names that appear across years (sorted by total)
  const stripeYears  = useMemo(() => data?.stripe?.byYear || [], [data])

  const stripeServiceTotals = useMemo(() => {
    const totals = {}
    stripeYears.forEach((yr) => yr.services.forEach((s) => { totals[s.name] = (totals[s.name] || 0) + s.count }))
    return Object.entries(totals).sort((a, b) => b[1] - a[1]).map(([name]) => name)
  }, [stripeYears])

  // Stacked bar data: one bar per year, each service stacked
  const stripeStackedBars = useMemo(() => stripeYears.map((yr) => {
    const row = { year: String(yr.year) }
    yr.services.forEach((s) => { row[s.name] = s.count })
    return row
  }), [stripeYears])

  // Area chart: website vs paid media vs seo/blueprint/command over years
  const stripeEraLines = useMemo(() => stripeYears.map((yr) => {
    const svcMap = Object.fromEntries(yr.services.map((s) => [s.name, s.count]))
    return {
      year:                  yr.year,
      Website:               (svcMap['Website'] || 0) + (svcMap['Website Maintenance'] || 0),
      'Paid Media':          svcMap['Paid Media'] || 0,
      'Social Media':        svcMap['Social Media'] || 0,
      'Modern Stack':        (svcMap['SEO'] || 0) + (svcMap['SEO Core'] || 0) + (svcMap['Blueprint'] || 0) + (svcMap['Blueprint + SEO'] || 0) + (svcMap['Command'] || 0) + (svcMap['CRM'] || 0),
      'Accelerator/Legacy':  (svcMap['Accelerator/Enrollment'] || 0) + (svcMap['Staffing'] || 0) + (svcMap['Virtual Tour'] || 0),
    }
  }), [stripeYears])

  // Retention cards
  const retentionData = useMemo(() => stripeYears.map((yr) => ({
    year:      yr.year,
    total:     yr.total,
    active:    yr.active,
    pct:       yr.total > 0 ? Math.round((yr.active / yr.total) * 100) : 0,
  })), [stripeYears])

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-[#AE2BCF] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-400">Building sales analysis…</p>
        <p className="text-gray-600 text-xs mt-1">Fetching Stripe history — ~30s first load</p>
      </div>
    </div>
  )

  if (error) return <div className="text-red-300 p-6">⚠️ {error}</div>

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-16">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Sales Analysis</h1>
          <p className="text-gray-500 text-sm mt-1">What we sold · how many · deal size distribution · how clients pay · how the business has shifted since 2022</p>
        </div>
      </div>

      {/* ── Filter bar ───────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {/* Quick presets */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-gray-500 text-xs uppercase tracking-wider">Period:</span>
          {[
            ['overall', 'All Time'],
            ['year2025', '2025'],
            ['year2026', '2026 YTD'],
            ['range', 'Date Range'],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => { setFilterMode(key === 'range' ? 'range' : key); if (key !== 'range') setShowMonthPicker(false) }}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                (key === 'range' ? filterMode === 'range' || filterMode.match(/^\d{4}-\d{2}$/) : filterMode === key)
                  ? 'border-violet-500/40 bg-violet-500/15 text-violet-100'
                  : 'border-[var(--brand-border)] bg-black/20 text-gray-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}

          {/* Individual months */}
          <button
            onClick={() => setShowMonthPicker(v => !v)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              filterMode.match(/^\d{4}-\d{2}$/)
                ? 'border-[#C19C46]/40 bg-[#C19C46]/10 text-[#C19C46]'
                : 'border-[var(--brand-border)] bg-black/20 text-gray-400 hover:text-white'
            }`}
          >
            {filterMode.match(/^\d{4}-\d{2}$/)
              ? (data?.availableMonths?.find(m => m.key === filterMode)?.label || 'Month')
              : 'Pick Month ▾'}
          </button>
        </div>

        {/* Month picker */}
        {showMonthPicker && (
          <div style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }} className="rounded-xl p-4">
            <div className="flex flex-wrap gap-2">
              {(data?.availableMonths || []).map((m) => (
                <button
                  key={m.key}
                  onClick={() => { setFilterMode(m.key); setShowMonthPicker(false) }}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    filterMode === m.key
                      ? 'border-[#C19C46]/50 bg-[#C19C46]/15 text-[#C19C46]'
                      : 'border-[var(--brand-border)] text-gray-400 hover:text-white hover:border-violet-500/30'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Range picker */}
        {filterMode === 'range' && (
          <div style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }} className="rounded-xl p-4 flex flex-wrap items-center gap-4">
            <span className="text-gray-400 text-sm">From</span>
            <select
              value={rangeStart}
              onChange={(e) => setRangeStart(e.target.value)}
              style={{ backgroundColor: '#0a0a0a', border: '1px solid #2a1a3e' }}
              className="rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-violet-500/40"
            >
              {(data?.availableMonths || []).map(m => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
            <span className="text-gray-400 text-sm">to</span>
            <select
              value={rangeEnd}
              onChange={(e) => setRangeEnd(e.target.value)}
              style={{ backgroundColor: '#0a0a0a', border: '1px solid #2a1a3e' }}
              className="rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-violet-500/40"
            >
              {(data?.availableMonths || []).map(m => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
            <span className="text-gray-500 text-xs">
              {t.count} deals in range
            </span>
          </div>
        )}

        {/* Active filter label */}
        {(filterMode !== 'overall') && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600">Showing:</span>
            <span className="text-xs font-medium" style={{ color: '#AE2BCF' }}>
              {filterMode === 'year2025' ? '2025 only'
                : filterMode === 'year2026' ? '2026 YTD'
                : filterMode === 'range' ? `${rangeStart} → ${rangeEnd}`
                : (data?.availableMonths?.find(m => m.key === filterMode)?.label || filterMode)}
            </span>
            <span className="text-gray-600 text-xs">— {t.count} deals, {new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(t.revenue)}</span>
            <button onClick={() => setFilterMode('overall')} className="text-xs text-gray-600 hover:text-gray-300 transition ml-1">✕ clear</button>
          </div>
        )}
      </div>

      {/* ── Summary cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card label="Deals Closed"           value={t.count ?? '—'}  sub="# of deals (not $)" />
        <Card label="First Payment Collected" value={fmt$(t.revenue)} sub={`PIF + first month · ${t.pifCount} PIF, ${t.monthlyCount} monthly`} accent={C.violet} />
        <Card label="New MRR Added"           value={fmt$(t.mrr)}     sub="Monthly recurring value (monthly deals only)" accent={C.gold} />
        <Card label="PIF Rate"                value={`${pifPct}%`}    sub={`${t.pifCount} paid-in-full · ${t.monthlyCount} monthly subscriptions`} />
      </div>

      {/* ── Revenue by service ──────────────────────────────────────────────── */}
      <Section
        title="First Payment by Package / Service"
        sub="Dollar value collected at signing — includes PIF lump sums and first monthly payment. Not MRR."
      >
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          <div className="xl:col-span-3">
            <Panel>
              <p className="text-[11px] uppercase tracking-wider mb-2" style={{color:C.slate}}>First payment ($) by service — PIF shown in purple, Monthly in violet</p>
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={revBars} layout="vertical" margin={{ left: 8, right: 32 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.bgDeep} horizontal={false} />
                  <XAxis type="number" stroke={C.slate} tick={{ fontSize: 11 }} tickFormatter={(v) => `$${Math.round(v/1000)}k`} label={{ value: 'First Payment ($)', position: 'insideBottom', offset: -2, fill: C.slate, fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" stroke={C.slate} tick={{ fontSize: 11 }} width={118} />
                  <Tooltip
                    formatter={(v, name, p) => [fmt$(v), `${p.payload.fullName} — First Payment`]}
                    contentStyle={TOOLTIP_STYLE}
                  />
                  <Bar dataKey="revenue" name="First Payment ($)" radius={[0, 6, 6, 0]}>
                    {revBars.map((entry) => <Cell key={entry.name} fill={serviceColor(entry.fullName)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Panel>
          </div>
          <div className="xl:col-span-2 flex flex-col gap-4">
            {/* Deal size by count */}
            <Panel>
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Deal Size Distribution</p>
              <p className="text-[11px] text-gray-600 mb-3">Number of deals (not $) in each size bracket</p>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={sizeBars}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.bgDeep} />
                  <XAxis dataKey="bucket" stroke={C.slate} tick={{ fontSize: 10 }} />
                  <YAxis stroke={C.slate} tick={{ fontSize: 10 }} label={{ value: '# Deals', angle: -90, position: 'insideLeft', fill: C.slate, fontSize: 9 }} />
                  <Tooltip formatter={(v) => [`${v} deals`, '# Deals']} contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="count" name="# Deals" fill={C.violet} radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </Panel>
            {/* PIF vs Monthly — BOTH count and revenue */}
            <Panel>
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-3">PIF vs Monthly — Count & Revenue</p>
              <div className="space-y-3">
                <div>
                  <p className="text-[11px] text-gray-500 mb-1">Deal count</p>
                  <div className="flex items-center gap-5">
                    <PieChart width={80} height={80}>
                      <Pie data={[{v:t.pifCount||0},{v:t.monthlyCount||0}]} dataKey="v" cx={38} cy={38} innerRadius={20} outerRadius={36} paddingAngle={3}>
                        <Cell fill={C.purple} /><Cell fill={C.gray} />
                      </Pie>
                    </PieChart>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{backgroundColor:C.purple}}/>
                        <span className="text-gray-300">PIF: <strong className="text-white">{t.pifCount}</strong> deals ({pifPct}%)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{backgroundColor:C.gray}}/>
                        <span className="text-gray-300">Monthly: <strong className="text-white">{t.monthlyCount}</strong> deals</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{borderTop:`1px solid ${C.border}`}} className="pt-3">
                  <p className="text-[11px] text-gray-500 mb-1">First payment collected ($)</p>
                  {(() => {
                    const raw = data?.rawDeals || []
                    let pifRev = 0, mthRev = 0
                    const filt = filterMode === 'overall' ? raw
                      : filterMode === 'year2025' ? raw.filter(d=>d.year===2025)
                      : filterMode === 'year2026' ? raw.filter(d=>d.year===2026)
                      : filterMode.match(/^\d{4}-\d{2}$/) ? raw.filter(d=>`${d.year}-${String(d.month).padStart(2,'0')}` === filterMode)
                      : filterMode === 'range' ? raw.filter(d => { const k=`${d.year}-${String(d.month).padStart(2,'0')}`; return k >= rangeStart && k <= rangeEnd })
                      : raw
                    for (const d of filt) { if (d.pif) pifRev += d.firstPayment||0; else mthRev += d.firstPayment||0 }
                    const total = pifRev + mthRev || 1
                    const pifRevPct = Math.round(pifRev/total*100)
                    return (
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span style={{color:C.purple}}>PIF {fmt$(pifRev)} ({pifRevPct}%)</span>
                          <span style={{color:C.slate}}>Monthly {fmt$(mthRev)}</span>
                        </div>
                        <div className="h-3 rounded-full overflow-hidden" style={{backgroundColor:C.border}}>
                          <div className="h-full rounded-full" style={{width:`${pifRevPct}%`,backgroundColor:C.purple}}/>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </div>
            </Panel>
          </div>
        </div>
      </Section>

      {/* ── Individual service unit counts ───────────────────────────────────── */}
      <Section
        title="Individual Services Sold — Unit Count (not $)"
        sub="Bundles decomposed: Web+SEO+CRM = 1 Website + 1 SEO + 1 CRM. Each bar = number of times that service was sold, regardless of price."
      >
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Panel>
            <p className="text-[11px] uppercase tracking-wider mb-2" style={{color:C.slate}}>Units sold (count) — not revenue</p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={unitBars} layout="vertical" margin={{ left: 0, right: 32 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.bgDeep} horizontal={false} />
                <XAxis type="number" stroke={C.slate} tick={{ fontSize: 11 }} label={{ value: '# Units Sold', position: 'insideBottom', offset: -2, fill: C.slate, fontSize: 10 }} />
                <YAxis type="category" dataKey="name" stroke={C.slate} tick={{ fontSize: 12 }} width={100} />
                <Tooltip formatter={(v) => [`${v} units`, 'Units Sold (count)']} contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" name="Units Sold (count)" radius={[0, 6, 6, 0]}>
                  {unitBars.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Panel>
          <div className="space-y-3">
            {['2025','2026'].map((yr) => {
              // Build line items from raw deals filtered to this year (always show year breakdown)
              const raw = data?.rawDeals || []
              const yearDeals = raw.filter(d => String(d.year) === yr)
              if (!yearDeals.length) return null
              const li = {}
              function normSvc(s) {
                const t = String(s||'').toLowerCase()
                if (t.includes('web')||t.includes('site')) return 'Website'
                if (t.includes('seo')) return 'SEO'
                if (t.includes('paid')||t.includes('ads')) return 'Paid Media'
                if (t.includes('crm')) return 'CRM'
                if (t.includes('blueprint')) return 'Blueprint'
                if (t.includes('command')) return 'Command'
                if (t.includes('master')) return 'Master'
                if (t.includes('s3')) return 'S3'
                return s
              }
              for (const d of yearDeals) {
                const parts = d.service?.replace(/\s*\+\s*/g,'+').split('+').map(p=>p.trim()).filter(Boolean) || [d.service]
                for (const p of parts) { const n = normSvc(p); if (!li[n]) li[n]=0; li[n]++ }
              }
              const items = Object.entries(li).sort((a,b) => b[1]-a[1])
              return (
                <Panel key={yr}>
                  <p className="text-white font-semibold mb-2">{yr} — services sold</p>
                  <div className="flex flex-wrap gap-2">
                    {items.map(([name,count]) => (
                      <div key={name} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                           style={{ backgroundColor: `${serviceColor(name)}22`, border: `1px solid ${serviceColor(name)}55` }}>
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: serviceColor(name) }} />
                        <span className="text-gray-200">{name}</span>
                        <span className="font-bold" style={{ color: serviceColor(name) }}>×{count}</span>
                      </div>
                    ))}
                  </div>
                </Panel>
              )
            })}
          </div>
        </div>
      </Section>

      {/* ── Full service detail table ─────────────────────────────────────────── */}
      <Section
        title="Full Service Detail Table"
        sub="Deals = # of deals closed. First Payment = $ collected at signing (PIF lump sum OR first monthly payment). MRR = ongoing monthly value from monthly deals only."
      >
        <DataTable
          columns={[
            { key:'name',         label:'Service / Package',    bold: true },
            { key:'count',        label:'# Deals',              right: true },
            { key:'revenue',      label:'First Payment ($)',     right: true, render:(v) => fmt$(v) },
            { key:'avg',          label:'Avg First Payment',     right: true, render:(v) => fmt$(v) },
            { key:'mrr',          label:'MRR Added ($/mo)',      right: true, render:(v) => fmt$(v) },
            { key:'pifCount',     label:'PIF Deals',             right: true },
            { key:'monthlyCount', label:'Monthly Deals',         right: true },
          ]}
          rows={view?.byService || []}
        />
      </Section>

      {/* ── PIF Shift ────────────────────────────────────────────────────────── */}
      <Section title="PIF vs Monthly Shift — 2025 → 2026 YTD" sub="How clients are choosing to pay is a market signal — shown as both deal count and first payment revenue">
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          <div className="xl:col-span-2 space-y-3">
            <Panel>
              <p className="text-[11px] uppercase tracking-wider mb-2" style={{color:C.slate}}>Deal count (# deals, not $)</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={pifShift} barSize={52}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.bgDeep} />
                  <XAxis dataKey="year" stroke={C.slate} tick={{ fontSize: 12 }} />
                  <YAxis stroke={C.slate} tick={{ fontSize: 11 }} label={{ value:'# Deals', angle:-90, position:'insideLeft', fill:C.slate, fontSize:9 }} />
                  <Tooltip formatter={(v, name) => [`${v} deals`, name]} contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
                  <Bar dataKey="pif"     name="PIF (deals)"     fill={C.purple} stackId="a" radius={[0,0,0,0]} />
                  <Bar dataKey="monthly" name="Monthly (deals)"  fill={C.gray}   stackId="a" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </Panel>
            <Panel>
              <p className="text-[11px] uppercase tracking-wider mb-2" style={{color:C.slate}}>First payment revenue ($) — PIF vs monthly</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={pifShift} barSize={52}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.bgDeep} />
                  <XAxis dataKey="year" stroke={C.slate} tick={{ fontSize: 12 }} />
                  <YAxis stroke={C.slate} tick={{ fontSize: 11 }} tickFormatter={(v) => `$${Math.round(v/1000)}k`} />
                  <Tooltip formatter={(v) => [fmt$(v), '']} contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
                  <Bar dataKey="pifRevenue"     name="PIF Revenue ($)"     fill={C.purple} stackId="b" radius={[0,0,0,0]} />
                  <Bar dataKey="monthlyRevenue" name="Monthly Revenue ($)"  fill={C.gray}   stackId="b" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </Panel>
          </div>
          <div className="xl:col-span-3 flex flex-col gap-3">
            {pifShift.map((row) => {
              const pct = row.count > 0 ? Math.round((row.pif / row.count) * 100) : 0
              const revTotal = (row.pifRevenue || 0) + (row.monthlyRevenue || 0)
              const revPct = revTotal > 0 ? Math.round((row.pifRevenue||0) / revTotal * 100) : 0
              return (
                <Panel key={row.year}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-white font-semibold">{row.year}</span>
                    <span className="font-bold text-xl" style={{ color: C.purple }}>{pct}% PIF deals</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs text-gray-500 mb-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-wider mb-1" style={{color:C.slate}}>Deal count</p>
                      <p><strong className="text-white">{row.pif}</strong> PIF · <strong className="text-white">{row.monthly}</strong> monthly · <span className="text-gray-400">{row.count} total</span></p>
                      <div className="mt-1.5 h-2 rounded-full overflow-hidden" style={{ backgroundColor: C.border }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: C.purple }} />
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider mb-1" style={{color:C.slate}}>First payment revenue</p>
                      <p><strong className="text-white">{fmt$(row.pifRevenue||0)}</strong> PIF · <strong className="text-white">{fmt$(row.monthlyRevenue||0)}</strong> monthly</p>
                      <div className="mt-1.5 h-2 rounded-full overflow-hidden" style={{ backgroundColor: C.border }}>
                        <div className="h-full rounded-full" style={{ width: `${revPct}%`, backgroundColor: C.purple }} />
                      </div>
                    </div>
                  </div>
                </Panel>
              )
            })}
            <Insight text="⚡ 13% PIF in 2025 → 53% PIF in 2026 YTD by deal count. The revenue shift is even more dramatic — PIF deals tend to be larger, so PIF's share of first-payment revenue is typically higher than its share of deal count." />
          </div>
        </div>
      </Section>

      {/* ══════════════════════════════════════════════════════════════════════
          STRIPE HISTORICAL — THE BUSINESS ERA STORY
      ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ borderTop: `1px solid ${C.border}` }} className="pt-8">
        <div className="mb-6">
          <h2 className="text-white text-lg font-bold">GYC Business Model — The Era Shift (2022–2026)</h2>
          <p className="text-gray-500 text-sm mt-1">Stripe subscription data reveals exactly when and how the product mix changed</p>
        </div>

        {/* Era overview area chart */}
        <Section title="Service Category Volume by Year" sub="5 era-based groupings — shows the business model pivot clearly">
          <Panel>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={stripeEraLines} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.bgDeep} />
                <XAxis dataKey="year" stroke={C.slate} tick={{ fontSize: 12 }} />
                <YAxis stroke={C.slate} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af', paddingTop: 8 }} />
                <Area type="monotone" dataKey="Website"              name="Website & Maintenance"  stroke="#AE2BCF" fill="#AE2BCF33" strokeWidth={2} dot={{ r: 4 }} />
                <Area type="monotone" dataKey="Paid Media"           name="Paid Media"              stroke={C.gold}   fill={`${C.gold}22`}  strokeWidth={2} dot={{ r: 4 }} />
                <Area type="monotone" dataKey="Social Media"         name="Social Media"            stroke="#5b21b6"  fill="#5b21b622"  strokeWidth={2} dot={{ r: 4 }} />
                <Area type="monotone" dataKey="Accelerator/Legacy"   name="Accelerator / Staffing"  stroke={C.slate}  fill={`${C.slate}22`} strokeWidth={2} dot={{ r: 4 }} />
                <Area type="monotone" dataKey="Modern Stack"         name="SEO/Blueprint/Command"   stroke="#22d3ee"  fill="#22d3ee22"  strokeWidth={2.5} dot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          </Panel>
        </Section>

        {/* Stacked bar: raw service breakdown per year */}
        <Section title="Services Sold by Year — Stacked" sub="Every service type stacked — see the mix shift year by year">
          <Panel>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stripeStackedBars} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.bgDeep} />
                <XAxis dataKey="year" stroke={C.slate} tick={{ fontSize: 12 }} />
                <YAxis stroke={C.slate} tick={{ fontSize: 11 }} />
                <Tooltip content={<StackedTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af', paddingTop: 8 }} />
                {stripeServiceTotals.slice(0, 12).map((name) => (
                  <Bar key={name} dataKey={name} stackId="a" fill={serviceColor(name)} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </Panel>
        </Section>

        {/* Retention cards per cohort */}
        <Section title="Client Cohort Retention" sub="Of all clients acquired that year, how many are still active today">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {retentionData.map((yr) => (
              <Panel key={yr.year}>
                <p className="text-white font-bold text-lg">{yr.year}</p>
                <p className="text-gray-500 text-xs mb-2">{yr.total} acquired</p>
                <div className="relative h-2 rounded-full overflow-hidden mb-1" style={{ backgroundColor: C.border }}>
                  <div className="h-full rounded-full" style={{ width: `${yr.pct}%`, backgroundColor: yr.pct > 50 ? C.purple : yr.pct > 20 ? C.gold : '#ef4444' }} />
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">{yr.active} active</span>
                  <span className="font-bold" style={{ color: yr.pct > 50 ? C.purple : yr.pct > 20 ? C.gold : '#ef4444' }}>{yr.pct}%</span>
                </div>
              </Panel>
            ))}
          </div>
          <Insight text="Retention drops sharply for 2022–2024 cohorts (old product era) — Social Media, Staffing, and Accelerator products had high churn. The 2026 cohort shows 88%+ retention on the current product stack. This validates the business model pivot." />
        </Section>

        {/* Stripe detail table */}
        <Section title="Stripe Service Detail — All Years">
          <div style={{ backgroundColor: C.bg, border: `1px solid ${C.border}` }} className="rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider font-semibold" style={{ color: C.slate }}>Year</th>
                    <th className="px-4 py-3 text-right text-xs uppercase tracking-wider font-semibold" style={{ color: C.slate }}>Subs</th>
                    <th className="px-4 py-3 text-right text-xs uppercase tracking-wider font-semibold" style={{ color: C.slate }}>Active</th>
                    {stripeServiceTotals.slice(0, 10).map((name) => (
                      <th key={name} className="px-3 py-3 text-right text-xs tracking-wider font-semibold whitespace-nowrap" style={{ color: serviceColor(name) }}>{name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stripeYears.map((yr, i) => {
                    const svcMap = Object.fromEntries(yr.services.map((s) => [s.name, s.count]))
                    return (
                      <tr key={yr.year} style={{ borderBottom: i < stripeYears.length - 1 ? `1px solid ${C.bgDeep}` : 'none' }} className="hover:bg-white/5">
                        <td className="px-4 py-2.5 text-white font-bold">{yr.year}</td>
                        <td className="px-4 py-2.5 text-right text-gray-200 tabular-nums">{yr.total}</td>
                        <td className="px-4 py-2.5 text-right text-gray-200 tabular-nums">{yr.active}</td>
                        {stripeServiceTotals.slice(0, 10).map((name) => (
                          <td key={name} className="px-3 py-2.5 text-right tabular-nums font-medium" style={{ color: (svcMap[name] || 0) > 0 ? serviceColor(name) : C.bgDeep }}>
                            {svcMap[name] || '—'}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Section>

        <Insight text="The numbers tell a clear story: 2022–2023 = Website + Social Media + Staffing agency. 2024 = pivot to Accelerator/Enrollment (high churn). 2025 = Paid Media surge + Website recovery. 2026 = modern stack takes hold — SEO, Blueprint, Command, CRM. Each era had different retention rates. The current product architecture is the strongest so far." />
      </div>

    </div>
  )
}
