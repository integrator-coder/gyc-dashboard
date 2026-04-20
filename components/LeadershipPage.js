'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import MetricTooltip from '@/components/MetricTooltip'
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

function Card({ label, value, sub, tone = 'default', tooltip }) {
  const toneCls = tone === 'good' ? 'text-emerald-300' : tone === 'warn' ? 'text-amber-300' : tone === 'bad' ? 'text-rose-300' : 'text-white'
  return (
    <div className="rounded-xl border border-[#2a1a3e] bg-black/40 p-4">
      <div className="text-[11px] uppercase tracking-wider text-gray-300 flex items-center">
        {label}
        {tooltip && <MetricTooltip text={tooltip} />}
      </div>
      <div className={`text-2xl font-bold mt-1 ${toneCls}`}>{value}</div>
      {sub && <div className="text-xs text-gray-300 mt-1">{sub}</div>}
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
          {sub && <p className="text-xs text-gray-300 mt-0.5 mb-3">{sub}</p>}
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
  const [newMoneyMetric, setNewMoneyMetric] = useState('contractValue')

  useEffect(() => {
    let active = true
    fetch('/api/metrics/leadership')
      .then((r) => r.json())
      .then((bundle) => {
        if (!active) return
        if (bundle.error) throw new Error(bundle.error)
        setData(bundle)
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

  // Dynamic Est. Annual Revenue — YTD ÷ actual days elapsed × 365 (never stale)
  const ytdCash = data?.finance?.ytdCash || 0
  const daysElapsed = Math.max(1, Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86400000) + 1)
  const estAnnualRevenue = ytdCash > 0 ? (ytdCash / daysElapsed) * 365 : Number(metrics?.totalRevenue || 0) * 12

  const dailyCashChart = (finance?.dailyRevenue || []).map(d => ({ label: new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), amount: d.amount }))
  const newMoneyChart = (newBusiness?.monthlyComparison || []).map(m => ({
    month: m.month,
    contractValue26: m.fullTerm26 || 0,
    contractValue25: m.fullTerm25 || 0,
    cashAtSigning26: m['2026'] || 0,
    cashAtSigning25: m['2025'] || 0,
    mrr26: m.mrr26 || 0,
  }))
  // Forward 13-month renewal window (starts next month, rolling)
  const _now = new Date()
  const _windowStart = new Date(_now.getFullYear(), _now.getMonth() + 1, 1)
  const _windowEnd = new Date(_windowStart)
  _windowEnd.setMonth(_windowEnd.getMonth() + 13)
  const _wStartStr = _windowStart.toISOString().slice(0, 7) // YYYY-MM
  const _wEndStr = _windowEnd.toISOString().slice(0, 7)
  const renewalsChart = (newBusiness?.renewalProjection || []).filter(r => r.key >= _wStartStr && r.key < _wEndStr)

  // Dynamic label for the pipeline window
  const _wStartLabel = _windowStart.toLocaleString('default', { month: 'short', year: 'numeric' })
  const _wEndMonthDate = new Date(_windowEnd.getFullYear(), _windowEnd.getMonth() - 1, 1)
  const _wEndLabel = _wEndMonthDate.toLocaleString('default', { month: 'short', year: 'numeric' })
  const renewalPipelineLabel = `Forward 13-Month Renewal Pipeline (${_wStartLabel} – ${_wEndLabel})`

  // Summary card calculations
  const _nextMonthMRR = renewalsChart.find(r => r.key === _wStartStr)?.mrr || 0
  const _full13Total = renewalsChart.reduce((s, r) => s + r.mrr, 0)
  const _curQ = Math.floor(_now.getMonth() / 3)
  const _curY = _now.getFullYear()
  const _thisQtrRemaining = renewalsChart.filter(r => {
    const [y, m] = r.key.split('-').map(Number)
    return y === _curY && Math.floor((m - 1) / 3) === _curQ
  }).reduce((s, r) => s + r.mrr, 0)
  const _nextQIdx = (_curQ + 1) % 4
  const _nextQYear = _curQ === 3 ? _curY + 1 : _curY
  const _nextQtrMRR = renewalsChart.filter(r => {
    const [y, m] = r.key.split('-').map(Number)
    return y === _nextQYear && Math.floor((m - 1) / 3) === _nextQIdx
  }).reduce((s, r) => s + r.mrr, 0)

  const newMoneyMetricConfig = {
    contractValue: {
      leftKey: 'contractValue26',
      rightKey: 'contractValue25',
      leftName: '2026 Contract Value',
      rightName: '2025 Contract Value',
      leftColor: '#14B8A6',
      rightColor: '#374151',
    },
    cashAtSigning: {
      leftKey: 'cashAtSigning26',
      rightKey: 'cashAtSigning25',
      leftName: '2026 Cash at Signing',
      rightName: '2025 Cash at Signing',
      leftColor: '#AE2BCF',
      rightColor: '#6B7280',
    },
    mrr: {
      leftKey: 'mrr26',
      rightKey: null,
      leftName: '2026 New MRR',
      rightName: null,
      leftColor: '#F59E0B',
      rightColor: null,
    },
  }
  const selectedNewMoneyMetric = newMoneyMetricConfig[newMoneyMetric] || newMoneyMetricConfig.contractValue

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Leadership Board</h1>
          <p className="text-sm text-gray-300">Cross-sectional command view — finance, churn, risk, growth, CX, and commercial mix</p>
          {data?.snapshot?.asOf && (
            <p className="text-xs text-gray-300 mt-1">Snapshot: {new Date(data.snapshot.asOf).toLocaleString()} · {data.snapshot.source}</p>
          )}
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
        <Card label="MRR" value={fmt$(metrics?.mrr)} tooltip="Monthly Recurring Revenue: total contracted monthly subscription revenue from all active clients. Source: Stripe. Updated every 8h via snapshot cache." />
        <Card label="Revenue (30d)" value={fmt$(metrics?.totalRevenue)} tooltip="Total cash collected in the last 30 days across all Stripe payments. Includes one-time fees, signing payments, and recurring charges. Source: Stripe." />
        <Card label="ARR" value={fmt$(Number(metrics?.mrr || 0) * 12)} tooltip="Annualized Recurring Revenue: MRR × 12. A forward-looking measure of annual subscription run-rate. Assumes current MRR holds flat. Source: Stripe MRR." />
        <Card label="Est Annual Revenue" value={fmt$(estAnnualRevenue)} tooltip={`Estimated annual revenue: YTD cash collected ÷ ${daysElapsed} days elapsed × 365. Dynamically updates every day of the year. Source: Stripe YTD.`} />
        <Card label="Active Clients" value={fmtN(metrics?.activeCustomers)} tooltip="Number of clients with at least one active Stripe subscription. Source: Stripe." />
        <Card label="Churned (30d)" value={fmtN(metrics?.churnedCustomers)} tone={Number(metrics?.churnedCustomers || 0) > 10 ? 'bad' : 'warn'} tooltip="Number of clients whose subscriptions were cancelled in the last 30 days. Source: Stripe." />
        <Card label="RPE (MRR)" value={fmt$(Number(metrics?.mrr || 0) * 12 / 18.5)} sub="MRR x12 / 18.5" tooltip="Revenue Per Employee based on MRR: (MRR × 12) ÷ 18.5 headcount. Measures annualized MRR productivity per team member. Headcount fixed at 18.5." />
        <Card label="RPE (Revenue)" value={fmt$(estAnnualRevenue / 18.5)} sub={`YTD ann. / 18.5`} tooltip={`Revenue Per Employee based on YTD annualized revenue: (YTD ÷ ${daysElapsed}d × 365) ÷ 18.5 headcount. Includes one-time fees. Headcount fixed at 18.5.`} />
        <Card label="Today's Cash" value={fmt$(todayCash)} tooltip="Total cash collected today from Stripe payments. Resets at midnight. Source: Stripe daily revenue feed." />
        <Card label="Yesterday" value={fmt$(yesterdayCash)} sub={`7d avg ${fmt$(avg7)}`} tooltip="Total cash collected yesterday from Stripe. Sub-label shows rolling 7-day average for comparison. Source: Stripe daily revenue feed." />
      </div>

      {/* New Business KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card label="YTD Contract Value" value={fmt$(newBusiness?.summary?.ytdFullTerm || 0)} sub="Full term — normalized PIF + monthly" tooltip="Full-term contract value of all new deals closed year-to-date. Formula: sum of (MRR × term months) for monthly deals + full PIF amount for paid-in-full deals. Source: Sales KPI Google Sheet." />
        <Card label="Cash at Signing (YTD)" value={fmt$(newBusiness?.summary?.ytdFirstPayment || 0)} sub="First payments collected at close" tooltip="Total first payments collected at the point of signing year-to-date. For monthly deals: first month's payment. For PIF deals: full amount paid upfront. Source: Sales KPI Google Sheet." />
        <Card label="New MRR Added (YTD)" value={fmt$(newBusiness?.summary?.mrr?.ytd26 || 0)} sub="Monthly recurring value from new deals" tooltip="Total new monthly recurring revenue added from deals closed year-to-date. Monthly deals contribute their MRR; PIF deals contribute $0 ongoing MRR. Source: Sales KPI Google Sheet." />
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

        <Panel title="New Money by Month" sub="Toggle between contract value, cash at signing, and new MRR">
          <div className="flex gap-1.5 mb-3 flex-wrap">
            {[
              ['contractValue', 'Contract Value'],
              ['cashAtSigning', 'Cash at Signing'],
              ['mrr', 'New MRR'],
            ].map(([key, label]) => (
              <button key={key} onClick={() => setNewMoneyMetric(key)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${newMoneyMetric === key ? 'border-teal-500/40 bg-teal-500/15 text-teal-200' : 'border-[#2a1a3e] text-gray-400 hover:text-white'}`}>
                {label}
              </button>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={newMoneyChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="month" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `$${Math.round(v/1000)}k`} tick={{ fill: '#9CA3AF', fontSize: 11 }} />
              <Tooltip formatter={(v) => fmt$(v)} />
              <Legend />
              <Bar dataKey={selectedNewMoneyMetric.leftKey} name={selectedNewMoneyMetric.leftName} fill={selectedNewMoneyMetric.leftColor} radius={[4,4,0,0]} />
              {selectedNewMoneyMetric.rightKey && (
                <Bar dataKey={selectedNewMoneyMetric.rightKey} name={selectedNewMoneyMetric.rightName} fill={selectedNewMoneyMetric.rightColor} radius={[4,4,0,0]} />
              )}
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* Risk + Churn + Dunning */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <Card label="Client Churn Rate" value={`${(latestChurn?.churnPct || 0).toFixed(1)}%`} tone={(latestChurn?.churnPct || 0) > 3 ? 'bad' : 'warn'} tooltip="Percentage of active clients who cancelled in the most recent tracked month. Formula: Clients Lost ÷ Start-of-Month Active Clients × 100. Source: GYC Churn Tracker Google Sheet." />
        <Card label="Revenue Churn Rate" value={`${(latestChurn?.churnRevPct || 0).toFixed(1)}%`} tone={(latestChurn?.churnRevPct || 0) > 3 ? 'bad' : 'warn'} tooltip="Percentage of MRR lost due to cancellations in the most recent tracked month. Formula: MRR Lost ÷ Start-of-Month MRR × 100. Source: GYC Churn Tracker Google Sheet." />
        <Card label="Net MRR Change" value={`${Number(latestChurn?.netMRR || 0) >= 0 ? '+' : '-'}${fmt$(latestChurn?.netMRR || 0)}`} tone={Number(latestChurn?.netMRR || 0) >= 0 ? 'good' : 'bad'} tooltip="Net change in MRR for the most recent tracked month: new MRR added minus MRR lost to churn. Positive = growing, negative = contracting. Source: GYC Churn Tracker Google Sheet." />
        <Card label="Client Movement" value={`-${latestChurn?.clientsLost || 0} / +${latestChurn?.clientsAdded || 0}`} tooltip="Net client count change in the most recent tracked month: clients lost (cancelled) vs. clients added (new). Source: GYC Churn Tracker Google Sheet." />
        <Card label="NRR (Current / 3m / 12m)" value={`${(nrr?.currentMonth || 0).toFixed(1)}% / ${(nrr?.trailing3mo || 0).toFixed(1)}% / ${(nrr?.trailing12mo || 0).toFixed(1)}%`} tone={(nrr?.currentMonth || 0) >= 100 ? 'good' : 'warn'} tooltip="Net Revenue Retention: % of MRR retained from existing clients including expansions, contractions, and churn. >100% means upsells offset churn. Shows: current month / 3-month trailing avg / 12-month trailing avg. Source: GYC Churn Tracker Google Sheet." />
        <Card label="Dunning Topline" value={`${fmtN(dunning?.summary?.pastDueCount)} past due`} sub={`${fmt$(dunning?.summary?.mrrAtRisk)} at risk · ${fmt$(dunning?.summary?.totalOutstanding)} outstanding`} tone={Number(dunning?.summary?.pastDueCount || 0) > 0 ? 'bad' : 'good'} tooltip="Clients currently in the dunning (payment recovery) process with past-due Stripe invoices. MRR at Risk = monthly revenue from past-due clients. Outstanding = total unpaid invoice amount. Source: Stripe dunning data." />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Panel title="Projected MRR Renewals" sub={renewalPipelineLabel} href="/new-business" tone="neutral">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="rounded-lg bg-gray-900/60 border border-gray-800 p-3 text-center">
              <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Next Month</div>
              <div className="text-lg font-bold text-teal-300">{fmt$(_nextMonthMRR)}</div>
            </div>
            <div className="rounded-lg bg-gray-900/60 border border-gray-800 p-3 text-center">
              <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">This Qtr Remaining</div>
              <div className="text-lg font-bold text-teal-300">{fmt$(_thisQtrRemaining)}</div>
            </div>
            <div className="rounded-lg bg-gray-900/60 border border-gray-800 p-3 text-center">
              <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Next Quarter</div>
              <div className="text-lg font-bold text-teal-300">{fmt$(_nextQtrMRR)}</div>
            </div>
            <div className="rounded-lg bg-gray-900/60 border border-gray-800 p-3 text-center">
              <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Full 13-Month Pipeline</div>
              <div className="text-lg font-bold text-teal-300">{fmt$(_full13Total)}</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
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
        <Card label="Leads Today / Week / Month" value={`${leads?.newLeads?.today || 0} / ${leads?.newLeads?.week || 0} / ${leads?.newLeads?.month || 0}`} tooltip="New leads (contacts) created in GHL (GoHighLevel) CRM. Today = current calendar day, Week = current 7-day rolling window, Month = current calendar month. Source: GHL leads API." />
        <Card label="Qualified Leads Today / Week" value={`${leads?.qualifiedLeads?.today || 0} / ${leads?.qualifiedLeads?.week || 0}`} tooltip="Leads that have reached a qualified stage in the GHL pipeline. Today = current calendar day, Week = current 7-day rolling window. Source: GHL leads API." />
        <Card label="Avg Deal Size (30d)" value={fmt$(dealSize?.avgDealSize || 0)} sub={`${dealSize?.totalDeals || 0} closed-won deals`} tooltip="Average cash at signing (first payment) per closed-won deal in the last 30 days. Formula: Total first payments ÷ number of closed-won deals. Source: Sales KPI Google Sheet via deal-size API." />
        <Card label="Team Agreements Closed (Month)" value={fmtN(sales?.team?.metrics?.['Agreements Closed']?.month || 0)} tooltip="Total number of agreements (contracts) closed by the full sales team in the current calendar month. Includes all reps across Sales and Upsell deal types. Source: Sales KPI Google Sheet." />
        <Card label="Client Health (G/Y/R)" value={`${fmtN(clientHealth?.green)} / ${fmtN(clientHealth?.yellow)} / ${fmtN(clientHealth?.red)}`} tooltip="Count of clients by health status — Green (on-track), Yellow (at-risk), Red (critical). Based on engagement, deliverable completion, and performance benchmarks. Source: Client health tracker." />
        <Card label="Meeting Completion" value={`${(qStats?.pct || 0).toFixed(1)}%`} sub={`${qStats?.met || 0}/${qStats?.total || 0} this quarter`} tone={(qStats?.pct || 0) >= 80 ? 'good' : (qStats?.pct || 0) >= 50 ? 'warn' : 'bad'} tooltip="Percentage of scheduled client meetings completed this quarter. Formula: Meetings Completed ÷ Total Meetings Scheduled × 100. Source: CX meeting tracker (current quarter)." />
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
