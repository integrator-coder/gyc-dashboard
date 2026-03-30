'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend,
  Cell,
} from 'recharts'

const SALES_REPS = new Set(['Jesse', 'Pia', 'Briana', 'Matt', 'Lex'])
const UPSELL_REPS = new Set(['JC', 'Zu', 'Stefen', 'Todd', 'Travis', 'Kim'])
const fmt$ = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(n || 0))
const fmtN = (n) => new Intl.NumberFormat('en-US').format(Number(n || 0))

function classifyDealType(rep, year) {
  if (rep === 'Sebastian') return Number(year) >= 2026 ? 'Upsell' : 'Sales'
  if (SALES_REPS.has(rep)) return 'Sales'
  if (UPSELL_REPS.has(rep)) return 'Upsell'
  return 'Unclassified'
}

function Card({ label, value, sub, tone = 'default' }) {
  const toneCls = tone === 'good' ? 'text-emerald-300' : tone === 'warn' ? 'text-amber-300' : tone === 'bad' ? 'text-rose-300' : 'text-white'
  return (
    <div className="rounded-xl border border-[#2a1a3e] bg-black/40 p-4">
      <div className="text-[11px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${toneCls}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  )
}

function Panel({ title, sub, children, href, tone = 'neutral' }) {
  const rail = tone === 'good' ? '#22c55e' : tone === 'warn' ? '#f59e0b' : tone === 'bad' ? '#ef4444' : '#732FBA'
  return (
    <div className="rounded-xl border border-[#2a1a3e] bg-[#111111] p-5" style={{ boxShadow: `inset 3px 0 0 ${rail}` }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-white font-semibold">{title}</h3>
          {sub && <p className="text-xs text-gray-500 mt-0.5 mb-3">{sub}</p>}
        </div>
        {href && (
          <Link href={href} className="text-xs text-violet-300 hover:text-violet-100 whitespace-nowrap">Open →</Link>
        )}
      </div>
      {children}
    </div>
  )
}

export default function LeadershipPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState({})

  useEffect(() => {
    let active = true
    Promise.all([
      fetch('/api/metrics/finance').then(r => r.json()),
      fetch('/api/metrics/churn').then(r => r.json()),
      fetch('/api/metrics/dunning').then(r => r.json()),
      fetch('/api/metrics/sales').then(r => r.json()),
      fetch('/api/metrics/ghl-leads').then(r => r.json()),
      fetch('/api/metrics/deal-size').then(r => r.json()),
      fetch('/api/metrics/new-business').then(r => r.json()),
      fetch('/api/metrics/sales-analysis').then(r => r.json()),
      fetch('/api/metrics/client-health').then(r => r.json()),
      fetch('/api/metrics/cx').then(r => r.json()),
    ])
      .then(([finance, churn, dunning, sales, leads, dealSize, newBusiness, salesAnalysis, clientHealth, cx]) => {
        if (!active) return
        setData({ finance, churn, dunning, sales, leads, dealSize, newBusiness, salesAnalysis, clientHealth, cx })
      })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false))

    return () => { active = false }
  }, [])

  const derived = useMemo(() => {
    const finance = data.finance || {}
    const metrics = finance.metrics || {}
    const daily = finance.dailyRevenue || []
    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    const todayCash = daily.find(d => d.date === today)?.amount || 0
    const yesterdayCash = daily.find(d => d.date === yesterday)?.amount || 0
    const avg7 = daily.slice(-7).length ? daily.slice(-7).reduce((s, d) => s + d.amount, 0) / daily.slice(-7).length : 0

    const churn = data.churn?.marketing || {}
    const monthly = churn.monthly || []
    const latestChurn = monthly[monthly.length - 1] || {}

    const salesAnalysisDeals = data.salesAnalysis?.rawDeals || []
    const byService = {}
    for (const d of salesAnalysisDeals) {
      const type = d.dealType || classifyDealType(d.rep, d.year)
      const s = d.service || 'Unknown'
      if (!byService[s]) byService[s] = { service: s, salesFP: 0, upsellFP: 0, unclassifiedFP: 0, total: 0 }
      if (type === 'Sales') byService[s].salesFP += Number(d.firstPayment || 0)
      else if (type === 'Upsell') byService[s].upsellFP += Number(d.firstPayment || 0)
      else byService[s].unclassifiedFP += Number(d.firstPayment || 0)
      byService[s].total += Number(d.firstPayment || 0)
    }
    const serviceByType = Object.values(byService).sort((a, b) => b.total - a.total).slice(0, 10)

    const cx = data.cx || {}
    const currentQ = cx.currentQuarter || 'Q1'
    const qStats = (cx.quarterStats || {})[currentQ] || { met: 0, total: 0, pct: 0 }

    const alerts = {
      churn: Number(latestChurn?.churnPct || 0) > 3 ? 'bad' : Number(latestChurn?.churnPct || 0) > 2 ? 'warn' : 'good',
      dunning: Number(data.dunning?.summary?.pastDueCount || 0) > 10 ? 'bad' : Number(data.dunning?.summary?.pastDueCount || 0) > 0 ? 'warn' : 'good',
      cash: todayCash < avg7 * 0.6 ? 'warn' : 'good',
      cx: Number(qStats?.pct || 0) < 50 ? 'bad' : Number(qStats?.pct || 0) < 80 ? 'warn' : 'good',
    }

    return {
      metrics,
      todayCash,
      yesterdayCash,
      avg7,
      latestChurn,
      nrr: churn.nrr || {},
      serviceByType,
      qStats,
      alerts,
    }
  }, [data])

  if (loading) return <div className="flex items-center justify-center h-full text-gray-400">Loading leadership board…</div>
  if (error) return <div className="text-red-400 p-6">Error: {error}</div>

  const { finance, churn, dunning, sales, leads, dealSize, newBusiness, clientHealth } = data
  const { metrics, todayCash, yesterdayCash, avg7, latestChurn, nrr, serviceByType, qStats, alerts } = derived

  const dailyCashChart = (finance?.dailyRevenue || []).map(d => ({ label: new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), amount: d.amount }))
  const newMoneyChart = (newBusiness?.monthlyComparison || []).map(m => ({ month: m.month, y2026: m['2026'] || 0, y2025: m['2025'] || 0 }))
  const renewalsChart = newBusiness?.renewalProjection || []

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Leadership Board</h1>
          <p className="text-sm text-gray-500">Cross-sectional command view — finance, churn, risk, growth, CX, and commercial mix</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          ['Cash Velocity', alerts?.cash],
          ['Churn Pressure', alerts?.churn],
          ['Dunning Risk', alerts?.dunning],
          ['CX Completion', alerts?.cx],
        ].map(([name, state]) => (
          <span key={name} className={`text-xs px-2.5 py-1 rounded-full border ${state === 'good' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : state === 'warn' ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-rose-500/30 bg-rose-500/10 text-rose-300'}`}>
            {name}: {state === 'good' ? 'Stable' : state === 'warn' ? 'Watch' : 'Action'}
          </span>
        ))}
      </div>

      {/* Finance Topline */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card label="MRR" value={fmt$(metrics?.mrr)} />
        <Card label="Revenue (30d)" value={fmt$(metrics?.totalRevenue)} />
        <Card label="ARR" value={fmt$(Number(metrics?.mrr || 0) * 12)} />
        <Card label="Est Annual Revenue" value={fmt$(Number(metrics?.totalRevenue || 0) * 12)} />
        <Card label="Active Clients" value={fmtN(metrics?.activeCustomers)} />
        <Card label="Churned (30d)" value={fmtN(metrics?.churnedCustomers)} tone={Number(metrics?.churnedCustomers || 0) > 10 ? 'bad' : 'warn'} />
        <Card label="RPE (MRR)" value={fmt$(Number(metrics?.mrr || 0) * 12 / 18.5)} sub="MRR x12 / 18.5" />
        <Card label="RPE (Revenue)" value={fmt$(Number(metrics?.totalRevenue || 0) * 12 / 18.5)} sub="30d x12 / 18.5" />
        <Card label="Today's Cash" value={fmt$(todayCash)} />
        <Card label="Yesterday" value={fmt$(yesterdayCash)} sub={`7d avg ${fmt$(avg7)}`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Panel title="Daily Cash Collected (30d)" sub="Finance cash velocity">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={dailyCashChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="label" tick={{ fill: '#9CA3AF', fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tickFormatter={(v) => `$${Math.round(v/1000)}k`} tick={{ fill: '#9CA3AF', fontSize: 11 }} />
              <Tooltip formatter={(v) => fmt$(v)} />
              <Bar dataKey="amount" fill="#AE2BCF" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="New Money by Month" sub="New Business comparison 2026 vs 2025">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={newMoneyChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="month" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `$${Math.round(v/1000)}k`} tick={{ fill: '#9CA3AF', fontSize: 11 }} />
              <Tooltip formatter={(v) => fmt$(v)} />
              <Legend />
              <Bar dataKey="y2026" name="2026" fill="#14B8A6" radius={[4,4,0,0]} />
              <Bar dataKey="y2025" name="2025" fill="#374151" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* Risk + Churn + Dunning */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <Card label="Client Churn Rate" value={`${(latestChurn?.churnPct || 0).toFixed(1)}%`} tone={(latestChurn?.churnPct || 0) > 3 ? 'bad' : 'warn'} />
        <Card label="Revenue Churn Rate" value={`${(latestChurn?.churnRevPct || 0).toFixed(1)}%`} tone={(latestChurn?.churnRevPct || 0) > 3 ? 'bad' : 'warn'} />
        <Card label="Net MRR Change" value={`${Number(latestChurn?.netMRR || 0) >= 0 ? '+' : '-'}${fmt$(latestChurn?.netMRR || 0)}`} tone={Number(latestChurn?.netMRR || 0) >= 0 ? 'good' : 'bad'} />
        <Card label="Client Movement" value={`-${latestChurn?.clientsLost || 0} / +${latestChurn?.clientsAdded || 0}`} />
        <Card label="NRR (Current / 3m / 12m)" value={`${(nrr?.currentMonth || 0).toFixed(1)}% / ${(nrr?.trailing3mo || 0).toFixed(1)}% / ${(nrr?.trailing12mo || 0).toFixed(1)}%`} tone={(nrr?.currentMonth || 0) >= 100 ? 'good' : 'warn'} />
        <Card label="Dunning Topline" value={`${fmtN(dunning?.summary?.pastDueCount)} past due`} sub={`${fmt$(dunning?.summary?.mrrAtRisk)} at risk · ${fmt$(dunning?.summary?.totalOutstanding)} outstanding`} tone={Number(dunning?.summary?.pastDueCount || 0) > 0 ? 'bad' : 'good'} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Panel title="Projected MRR Renewals" sub="From New Business renewal forecast" href="/new-business" tone="neutral">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={renewalsChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="label" tick={{ fill: '#9CA3AF', fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={52} />
              <YAxis tickFormatter={(v) => `$${Math.round(v/1000)}k`} tick={{ fill: '#9CA3AF', fontSize: 11 }} />
              <Tooltip formatter={(v) => `${fmt$(v)}/mo`} />
              <Bar dataKey="mrr" fill="#14B8A6" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Service by Sale vs Upsell" sub="Cross-sectional leverage by service (first payment $)">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={serviceByType}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="service" tick={{ fill: '#9CA3AF', fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={52} />
              <YAxis tickFormatter={(v) => `$${Math.round(v/1000)}k`} tick={{ fill: '#9CA3AF', fontSize: 11 }} />
              <Tooltip formatter={(v) => fmt$(v)} />
              <Legend />
              <Bar dataKey="salesFP" name="Sales" fill="#AE2BCF" stackId="a" />
              <Bar dataKey="upsellFP" name="Upsell" fill="#F59E0B" stackId="a" />
              <Bar dataKey="unclassifiedFP" name="Unclassified" fill="#6B7280" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* Sales + CX command strip */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <Card label="Leads Today / Week / Month" value={`${leads?.newLeads?.today || 0} / ${leads?.newLeads?.week || 0} / ${leads?.newLeads?.month || 0}`} />
        <Card label="Qualified Leads Today / Week" value={`${leads?.qualifiedLeads?.today || 0} / ${leads?.qualifiedLeads?.week || 0}`} />
        <Card label="Avg Deal Size (30d)" value={fmt$(dealSize?.avgDealSize || 0)} sub={`${dealSize?.totalDeals || 0} closed-won deals`} />
        <Card label="Team Agreements Closed (Month)" value={fmtN(sales?.team?.metrics?.['Agreements Closed']?.month || 0)} />
        <Card label="Client Health (G/Y/R)" value={`${fmtN(clientHealth?.green)} / ${fmtN(clientHealth?.yellow)} / ${fmtN(clientHealth?.red)}`} />
        <Card label="Meeting Completion" value={`${(qStats?.pct || 0).toFixed(1)}%`} sub={`${qStats?.met || 0}/${qStats?.total || 0} this quarter`} tone={(qStats?.pct || 0) >= 80 ? 'good' : (qStats?.pct || 0) >= 50 ? 'warn' : 'bad'} />
      </div>

      <Panel title="Executive Notes" sub="Suggested cross-sectional watchpoints">
        <ul className="text-sm text-gray-300 space-y-1 list-disc pl-5">
          <li>Track divergence between New Money momentum and net MRR change to catch quality vs quantity gaps.</li>
          <li>Prioritize services where Upsell contribution outpaces Sales contribution — that is your retention leverage engine.</li>
          <li>Watch dunning-at-risk MRR alongside churn trend; both are early-warning signals for cash pressure.</li>
        </ul>
      </Panel>
    </div>
  )
}
