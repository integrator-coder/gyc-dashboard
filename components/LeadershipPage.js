'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import MetricTooltip from '@/components/MetricTooltip'
import PifMrrImpact from '@/components/PifMrrImpact'
import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line, ReferenceLine,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend,
} from 'recharts'

const SALES_REPS = new Set(['Jesse'])  // Jesse is the only active sales rep. Briana: moved to GA. Pia: starting, no targets. Matt/Lex: historical only.
const UPSELL_REPS = new Set(['JC', 'Zu', 'Stefen', 'Todd', 'Travis', 'Kim'])
const fmt$ = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(n || 0))
const fmtN = (n) => new Intl.NumberFormat('en-US').format(Number(n || 0))
const hasValue = (n) => n !== null && n !== undefined && n !== '' && Number.isFinite(Number(n))
const fmtMaybe$ = (n) => hasValue(n) ? fmt$(n) : '—'
const fmtMaybeN = (n) => hasValue(n) ? fmtN(n) : '—'
const fmtMaybePct = (n) => hasValue(n) ? `${Number(n).toFixed(1)}%` : '—'
const chartGrid = 'rgba(150, 160, 179, 0.14)'
const chartAxis = '#96A0B3'

function classifyDealType(rep, year) {
  if (rep === 'Sebastian') return Number(year) >= 2026 ? 'Upsell' : 'Sales'
  if (SALES_REPS.has(rep)) return 'Sales'
  if (UPSELL_REPS.has(rep)) return 'Upsell'
  return 'Unclassified'
}

function Card({ label, value, sub, tone = 'default', tooltip }) {
  const toneCls = tone === 'good' ? 'text-emerald-300' : tone === 'warn' ? 'text-amber-300' : tone === 'bad' ? 'text-rose-300' : 'text-white'
  return (
    <div className="surface-card rounded-2xl p-4">
      <div className="flex items-center text-[11px] font-semibold uppercase tracking-[0.18em] executive-muted">
        {label}
        {tooltip && <MetricTooltip text={tooltip} />}
      </div>
      <div className={`metric-card-value mt-2 text-2xl font-semibold ${toneCls}`}>{value}</div>
      {sub && <div className="mt-1 text-[13px] executive-muted">{sub}</div>}
    </div>
  )
}

function DualMetricCard({ label, primaryValue, primarySub, secondaryValue, secondarySub, atRisk, tooltip }) {
  return (
    <div className="surface-card rounded-2xl p-4">
      <div className="flex items-center text-[11px] font-semibold uppercase tracking-[0.18em] executive-muted">
        {label}
        {tooltip && <MetricTooltip text={tooltip} />}
      </div>
      <div className="mt-2 text-2xl font-semibold text-white">{primaryValue}</div>
      {primarySub && <div className="mt-0.5 text-[11px] executive-muted">{primarySub}</div>}
      <div className="mt-2 pt-2 border-t border-white/10">
        <div className="text-base font-semibold text-white/50">{secondaryValue}</div>
        {secondarySub && (
          <div className="mt-0.5 text-[11px] executive-muted">
            {secondarySub}
            {atRisk && <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300 border border-amber-500/20">{atRisk} at risk</span>}
          </div>
        )}
      </div>
    </div>
  )
}

function Panel({ title, sub, children, href, tone = 'neutral' }) {
  const rail = tone === 'good' ? '#34d399' : tone === 'warn' ? '#fbbf24' : tone === 'bad' ? '#fb7185' : 'var(--brand-primary-4)'
  return (
    <div className="surface-panel rounded-2xl p-5" style={{ boxShadow: `inset 3px 0 0 ${rail}, inset 0 1px 0 rgba(255,255,255,0.03), var(--brand-shadow)` }}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-white">{title}</h3>
          {sub && <p className="mt-1 text-xs executive-muted">{sub}</p>}
        </div>
        {href && (
          <Link href={href} className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-primary-4)] hover:text-white whitespace-nowrap">Open</Link>
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
  const [serviceTimeframe, setServiceTimeframe] = useState('all')
  const [now] = useState(() => new Date())
  const [yoyData, setYoyData] = useState(null)
  const [yoyMetric, setYoyMetric] = useState('deals')

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

  useEffect(() => {
    fetch('/api/metrics/sales-yoy')
      .then((r) => r.json())
      .then((d) => { if (!d.error) setYoyData(d) })
      .catch(() => {})
  }, [])

  const derived = useMemo(() => {
    const finance = data.finance || {}
    const metrics = finance.metrics || {}
    const daily = finance.dailyRevenue || []
    const easternDate = (date) => new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(date)
    const today = easternDate(now)
    const yesterdayDate = new Date(now.getTime() - 86400000)
    const yesterday = easternDate(yesterdayDate)
    const todayCash = daily.find((d) => d.date === today)?.amount || 0
    const yesterdayCash = daily.find((d) => d.date === yesterday)?.amount || 0
    const completedDays = daily.filter((d) => d.date < today).slice(-7)
    const avg7 = completedDays.length ? completedDays.reduce((s, d) => s + d.amount, 0) / completedDays.length : 0

    const churn = data.churn?.marketing || {}
    const monthly = churn.monthly || []
    const latestChurn = monthly[monthly.length - 1] || {}

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
      qStats,
      alerts,
    }
  }, [data, now])

  const serviceByType = useMemo(() => {
    const salesAnalysisDeals = data.salesAnalysis?.rawDeals || []
    const filtered = serviceTimeframe === 'all'
      ? salesAnalysisDeals
      : salesAnalysisDeals.filter((d) => {
          if (!d.year && !d.month) return false
          if (serviceTimeframe === 'month') return d.year === now.getFullYear() && d.month === (now.getMonth() + 1)
          if (serviceTimeframe === 'quarter') return d.year === now.getFullYear() && Math.floor((d.month - 1) / 3) === Math.floor(now.getMonth() / 3)
          if (serviceTimeframe === 'ytd') return d.year === now.getFullYear()
          return true
        })
    const byService = {}
    for (const d of filtered) {
      const type = d.dealType || classifyDealType(d.rep, d.year)
      const s = d.service || 'Unknown'
      if (!byService[s]) byService[s] = { service: s, salesFP: 0, upsellFP: 0, unclassifiedFP: 0, total: 0 }
      if (type === 'Sales') byService[s].salesFP += Number(d.firstPayment || 0)
      else if (type === 'Upsell') byService[s].upsellFP += Number(d.firstPayment || 0)
      else byService[s].unclassifiedFP += Number(d.firstPayment || 0)
      byService[s].total += Number(d.firstPayment || 0)
    }
    return Object.values(byService).sort((a, b) => b.total - a.total).slice(0, 10)
  }, [data, serviceTimeframe, now])

  if (loading) return <div className="flex h-full items-center justify-center executive-muted">Loading leadership board…</div>
  if (error) return <div className="p-6 text-rose-300">Error: {error}</div>

  const { finance, dunning, sales, leads, dealSize, newBusiness, clientHealth } = data
  const { metrics, todayCash, yesterdayCash, avg7, latestChurn, nrr, qStats, alerts } = derived
  const latestChurnPeriod = `${latestChurn?.month || 'Latest month'}${data.churn?.latestMonthIsPartial ? ' MTD' : ''}`
  const lateralTotals = data.churn?.lateralMovements?.totals || {}
  const grr = data.churn?.marketing?.grr || {}
  const sourceHealth = data.meta?.sourceHealth || {}
  const staleSources = Object.entries(sourceHealth).filter(([, health]) => health?.stale || !health?.ok)

  const ytdCash = data?.finance?.ytdCash || 0
  const startOfYear = new Date(now.getFullYear(), 0, 1)
  const daysElapsed = Math.max(1, Math.floor((now.getTime() - startOfYear.getTime()) / 86400000) + 1)
  const estAnnualRevenue = ytdCash > 0 ? (ytdCash / daysElapsed) * 365 : Number(metrics?.totalRevenue || 0) * 12

  const currentMonthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][now.getMonth()]
  const dailyCashChart = (finance?.dailyRevenue || []).map((d) => ({ label: new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), amount: d.amount }))
  const newMoneyChart = (newBusiness?.monthlyComparison || []).map((m) => ({
    month: m.month,
    contractValue26: m.fullTerm26 || 0,
    contractValue25: m.fullTerm25 || 0,
    cashAtSigning26: m['2026'] || 0,
    cashAtSigning25: m['2025'] || 0,
    mrr26: m.mrr26 || 0,
  }))
  const _windowStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const _windowEnd = new Date(_windowStart)
  _windowEnd.setMonth(_windowEnd.getMonth() + 13)
  const _wStartStr = _windowStart.toISOString().slice(0, 7)
  const _wEndStr = _windowEnd.toISOString().slice(0, 7)
  const renewalsChart = (newBusiness?.renewalProjection || []).filter((r) => r.key >= _wStartStr && r.key < _wEndStr)

  const _wStartLabel = _windowStart.toLocaleString('default', { month: 'short', year: 'numeric' })
  const _wEndMonthDate = new Date(_windowEnd.getFullYear(), _windowEnd.getMonth() - 1, 1)
  const _wEndLabel = _wEndMonthDate.toLocaleString('default', { month: 'short', year: 'numeric' })
  const renewalPipelineLabel = `Forward 13-Month Renewal Pipeline (${_wStartLabel} – ${_wEndLabel})`

  const _nextMonthMRR = renewalsChart.find((r) => r.key === _wStartStr)?.mrr || 0
  const _full13Total = renewalsChart.reduce((s, r) => s + r.mrr, 0)
  const _curQ = Math.floor(now.getMonth() / 3)
  const _curY = now.getFullYear()
  const _thisQtrRemaining = renewalsChart.filter((r) => {
    const [y, m] = r.key.split('-').map(Number)
    return y === _curY && Math.floor((m - 1) / 3) === _curQ
  }).reduce((s, r) => s + r.mrr, 0)
  const _nextQIdx = (_curQ + 1) % 4
  const _nextQYear = _curQ === 3 ? _curY + 1 : _curY
  const _nextQtrMRR = renewalsChart.filter((r) => {
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
      rightColor: '#4B5563',
    },
    cashAtSigning: {
      leftKey: 'cashAtSigning26',
      rightKey: 'cashAtSigning25',
      leftName: '2026 Cash at Signing',
      rightName: '2025 Cash at Signing',
      leftColor: '#A66FCD',
      rightColor: '#6B7280',
    },
    mrr: {
      leftKey: 'mrr26',
      rightKey: null,
      leftName: '2026 New MRR',
      rightName: null,
      leftColor: '#C5A35F',
      rightColor: null,
    },
  }
  const selectedNewMoneyMetric = newMoneyMetricConfig[newMoneyMetric] || newMoneyMetricConfig.contractValue

  const serviceTimeframeLabels = { month: 'This Month', quarter: 'This Quarter', ytd: 'YTD', all: 'All Time' }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="executive-kicker">Leadership Command</div>
          <h1 className="mt-2 text-3xl font-semibold text-white">Leadership Board</h1>
          <p className="mt-1 text-sm executive-muted">Cross-sectional command view — finance, churn, risk, growth, CX, and commercial mix</p>
          {data?.snapshot?.asOf && (
            <p className="mt-1 text-xs executive-faint">Snapshot: {new Date(data.snapshot.asOf).toLocaleString()} · {data.snapshot.source}</p>
          )}
          {staleSources.length > 0 && (
            <p className="mt-1 text-xs text-amber-300">
              Source notice: {staleSources.map(([name, health]) => `${name}${health?.asOf ? ` (${new Date(health.asOf).toLocaleDateString()})` : ''}`).join(', ')} {staleSources.length === 1 ? 'is' : 'are'} not current.
            </p>
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
          <span key={name} className={`rounded-full border px-2.5 py-1 text-xs font-medium ${state === 'good' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : state === 'warn' ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-rose-500/30 bg-rose-500/10 text-rose-300'}`}>
            {name}: {state === 'good' ? 'Stable' : state === 'warn' ? 'Watch' : 'Action'}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <DualMetricCard
          label="MRR"
          primaryValue={fmt$(metrics?.mrrCollected || metrics?.mrr)}
          primarySub="Active + past-due subs"
          secondaryValue={fmtMaybe$(metrics?.mrrContracted)}
          secondarySub={`Contracted incl. ${fmtMaybeN(metrics?.unpaidCount)} unpaid subs`}
          atRisk={metrics?.mrrAtRisk ? fmt$(metrics.mrrAtRisk) : null}
          tooltip="Two MRR views: Active MRR counts active + past-due subscriptions (money being collected now). Contracted MRR also includes unpaid subscriptions that have failed payments but haven't yet cancelled. The at-risk amount is the gap between the two."
        />
        <Card label="Revenue (30d)" value={fmt$(metrics?.totalRevenue)} tooltip="Total cash collected in the last 30 days across all Stripe payments. Includes one-time fees, signing payments, and recurring charges. Source: Stripe." />
        <DualMetricCard
          label="ARR"
          primaryValue={fmt$(metrics?.arrCollected || Number(metrics?.mrrCollected || metrics?.mrr || 0) * 12)}
          primarySub="Active ARR (collected)"
          secondaryValue={fmt$(metrics?.arrContracted || Number(metrics?.mrrContracted || 0) * 12)}
          secondarySub="Contracted ARR (incl. at-risk)"
          tooltip="Two ARR views: Active ARR = Active MRR × 12 (conservative, what we're actually collecting). Contracted ARR = Contracted MRR × 12 (includes at-risk unpaid subs that haven't yet cancelled)."
        />
        <Card label="Cash Collected, YTD" value={fmt$(ytdCash)} tooltip="Total cash actually collected year-to-date from all Stripe payments. Raw sum of daily revenue from January 1 to today. Source: Stripe DailyRevenue." />
        <Card label="YTD Annualized Revenue" value={fmt$(estAnnualRevenue)} tooltip={`Year-to-date cash collected, annualized using actual elapsed days: YTD cash ÷ ${daysElapsed} days elapsed × 365. Includes recurring and one-time cash collected. Source: Stripe YTD.`} />
        <Card label="Active Subscriptions" value={fmtMaybeN(metrics?.activeCustomers)} sub={hasValue(latestChurn?.clientCount) ? `${fmtN(latestChurn.clientCount)} clients in ${latestChurnPeriod} churn cohort` : null} tooltip="Count of active Stripe subscriptions, which is not the same as unique clients because one customer can hold multiple subscriptions. The sub-label shows the client count used by the monthly churn cohort." />
        <Card label={`True Clients Lost (${latestChurnPeriod})`} value={fmtMaybeN(latestChurn?.clientsLost)} tone={Number(latestChurn?.clientsLost || 0) > 10 ? 'bad' : 'warn'} tooltip="Unique customers truly lost in the displayed month. Duplicate subscription cancellations are deduplicated and confirmed Monthly → PIF lateral movements are excluded. Source: Stripe cohort and confirmed PIF movement ledger." />
        <Card label="RPE (MRR)" value={fmt$(Number(metrics?.mrr || 0) * 12 / 18.5)} sub="MRR x12 / 18.5" tooltip="Revenue Per Employee based on MRR: (MRR × 12) ÷ 18.5 headcount. Measures annualized MRR productivity per team member. Headcount fixed at 18.5." />
        <Card label="RPE (Revenue)" value={fmt$(estAnnualRevenue / 18.5)} sub="YTD ann. / 18.5" tooltip={`Revenue Per Employee based on YTD annualized revenue: (YTD ÷ ${daysElapsed}d × 365) ÷ 18.5 headcount. Includes one-time fees. Headcount fixed at 18.5.`} />
        <Card label="Today's Cash" value={fmt$(todayCash)} tooltip="Total cash collected today from Stripe payments. Resets at midnight. Source: Stripe daily revenue feed." />
        <Card label="Yesterday" value={fmt$(yesterdayCash)} sub={`7d avg ${fmt$(avg7)}`} tooltip="Total cash collected yesterday from Stripe. Sub-label shows rolling 7-day average for comparison. Source: Stripe daily revenue feed." />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card label="YTD Contract Value" value={fmt$(newBusiness?.summary?.ytdFullTerm || 0)} sub="Full term — normalized PIF + monthly" tooltip="Full-term contract value of all new deals closed year-to-date. Formula: sum of (MRR × term months) for monthly deals + full PIF amount for paid-in-full deals. Source: Sales KPI Google Sheet." />
        <Card label="Cash at Signing (YTD)" value={fmt$(newBusiness?.summary?.ytdFirstPayment || 0)} sub="First payments collected at close" tooltip="Total first payments collected at the point of signing year-to-date. For monthly deals: first month's payment. For PIF deals: full amount paid upfront. Source: Sales KPI Google Sheet." />
        <Card label="New MRR Added (YTD)" value={fmt$(newBusiness?.summary?.mrr?.ytd26 || 0)} sub="Monthly recurring value from new deals" tooltip="Total new monthly recurring revenue added from deals closed year-to-date. Monthly deals contribute their MRR; PIF deals contribute $0 ongoing MRR. Source: Sales KPI Google Sheet." />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel title="Daily Cash Collected (30d)" sub="Finance cash velocity">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={dailyCashChart}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
              <XAxis dataKey="label" tick={{ fill: chartAxis, fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tickFormatter={(v) => `$${Math.round(v / 1000)}k`} tick={{ fill: chartAxis, fontSize: 11 }} />
              <Tooltip formatter={(v) => fmt$(v)} contentStyle={{ background: 'var(--brand-surface-2)', border: '1px solid var(--brand-border-strong)', borderRadius: 12 }} />
              <Bar dataKey="amount" fill="var(--brand-primary-4)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="New Money by Month" sub="Toggle between contract value, cash at signing, and new MRR">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {[
              ['contractValue', 'Contract Value'],
              ['cashAtSigning', 'Cash at Signing'],
              ['mrr', 'New MRR'],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setNewMoneyMetric(key)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${newMoneyMetric === key ? 'border-[var(--brand-border-accent)] bg-[rgba(166,111,205,0.14)] text-white' : 'border-[var(--brand-border)] text-[var(--brand-text-muted)] hover:border-[var(--brand-border-strong)] hover:text-white'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={newMoneyChart}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
              <XAxis dataKey="month" tick={{ fill: chartAxis, fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `$${Math.round(v / 1000)}k`} tick={{ fill: chartAxis, fontSize: 11 }} />
              <Tooltip formatter={(v) => fmt$(v)} contentStyle={{ background: 'var(--brand-surface-2)', border: '1px solid var(--brand-border-strong)', borderRadius: 12 }} />
              <Legend />
              <Bar dataKey={selectedNewMoneyMetric.leftKey} name={selectedNewMoneyMetric.leftName} fill={selectedNewMoneyMetric.leftColor} radius={[4, 4, 0, 0]} />
              {selectedNewMoneyMetric.rightKey && (
                <Bar dataKey={selectedNewMoneyMetric.rightKey} name={selectedNewMoneyMetric.rightName} fill={selectedNewMoneyMetric.rightColor} radius={[4, 4, 0, 0]} />
              )}
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {yoyData?.ytdSummary && (() => {
        const ytd = yoyData.ytdSummary
        const curY = ytd.currentYear
        const preY = ytd.priorYear
        const pctTone = (p) => p === null ? 'default' : Number(p) >= 0 ? 'good' : 'bad'
        const pctLabel = (p) => p === null ? '' : ` · ${Number(p) >= 0 ? '+' : ''}${p}% YoY`
        return (
          <Panel
            title="YTD Sales Comparison — Year-over-Year"
            sub={`${curY} YTD vs ${preY} same period · revenue, deals, cash at signing, new MRR`}
            href="/sales-analysis"
          >
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Card
                label={`Cash Revenue YTD`}
                value={`${curY}: ${fmt$(ytd.revenue.current)}`}
                sub={`${preY}: ${fmt$(ytd.revenue.prior)}${pctLabel(ytd.revenue.pctChange)}`}
                tone={pctTone(ytd.revenue.pctChange)}
                tooltip={`Total cash collected year-to-date in ${curY} vs the same calendar period in ${preY}. Source: DailyRevenue (Stripe).`}
              />
              <Card
                label={`Deals Closed YTD`}
                value={`${curY}: ${fmtN(ytd.deals.current)}`}
                sub={`${preY}: ${fmtN(ytd.deals.prior)}${pctLabel(ytd.deals.pctChange)}`}
                tone={pctTone(ytd.deals.pctChange)}
                tooltip={`Count of closed-won deals year-to-date in ${curY} vs the same period in ${preY}. Source: SalesDeal.`}
              />
              <Card
                label={`Cash at Signing YTD`}
                value={`${curY}: ${fmt$(ytd.cashAtSigning.current)}`}
                sub={`${preY}: ${fmt$(ytd.cashAtSigning.prior)}${pctLabel(ytd.cashAtSigning.pctChange)}`}
                tone={pctTone(ytd.cashAtSigning.pctChange)}
                tooltip={`First payments collected at close year-to-date in ${curY} vs ${preY}. Source: SalesDeal.`}
              />
              <Card
                label={`New MRR Added YTD`}
                value={`${curY}: ${fmt$(ytd.mrr.current)}/mo`}
                sub={`${preY}: ${fmt$(ytd.mrr.prior)}/mo${pctLabel(ytd.mrr.pctChange)}`}
                tone={pctTone(ytd.mrr.pctChange)}
                tooltip={`New monthly recurring revenue added from deals closed year-to-date in ${curY} vs same period ${preY}. Monthly deals only (PIF excluded). Source: SalesDeal.`}
              />
            </div>
          </Panel>
        )
      })()}

      {yoyData && (
        <Panel
          title="Monthly Sales — Year over Year"
          sub={`${(yoyData.years || []).join(' vs ')} · ${yoyMetric === 'deals' ? 'Deal Count' : yoyMetric === 'mrr' ? 'New MRR' : 'Cash Collected'} by Month`}
        >
          <div className="mb-3 flex flex-wrap gap-1.5">
            {[['deals', 'Deal Count'], ['cash', 'Cash Collected'], ['mrr', 'New MRR']].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setYoyMetric(key)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  yoyMetric === key
                    ? 'border-[var(--brand-border-accent)] bg-[rgba(166,111,205,0.14)] text-white'
                    : 'border-[var(--brand-border)] text-[var(--brand-text-muted)] hover:border-[var(--brand-border-strong)] hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={yoyData.monthly || []} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
              <XAxis dataKey="month" tick={{ fill: chartAxis, fontSize: 11 }} />
              <YAxis
                tickFormatter={yoyMetric !== 'deals' ? (v) => `$${Math.round(v / 1000)}k` : undefined}
                tick={{ fill: chartAxis, fontSize: 11 }}
              />
              <Tooltip
                formatter={(v, name) => yoyMetric !== 'deals' ? [fmt$(v), name] : [v + ' deals', name]}
                contentStyle={{ background: 'var(--brand-surface-2)', border: '1px solid var(--brand-border-strong)', borderRadius: 12 }}
              />
              <Legend />
              <ReferenceLine
                x={currentMonthShort}
                stroke="#fbbf24"
                strokeDasharray="4 4"
                label={{ value: 'Now', fill: '#fbbf24', fontSize: 10, position: 'insideTopRight' }}
              />
              {(yoyData.years || []).map((year) => {
                const yearColors = { '2024': '#A66FCD', '2025': '#6B7280', '2026': '#14B8A6' }
                // Cash view uses DailyRevenue keys (revenue_YEAR) which includes 2024 data
                const metricKey = yoyMetric === 'cash' ? `revenue_${year}` : `${yoyMetric}_${year}`
                return (
                  <Line
                    key={year}
                    type="monotone"
                    dataKey={metricKey}
                    name={year}
                    stroke={yearColors[year] || '#94a3b8'}
                    strokeWidth={year === yoyData.latestYear ? 2.5 : 1.5}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                    connectNulls={false}
                  />
                )
              })}
            </LineChart>
          </ResponsiveContainer>

          {(() => {
            const curMonth = now.getMonth() + 1
            const change = yoyData.yoyChanges?.[curMonth]
            if (!change) return null
            const dealsChg = change.deals !== null ? Number(change.deals) : null
            const cashChg = change.cash !== null ? Number(change.cash) : null
            const monthName = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][curMonth - 1]
            return (
              <div className="mt-3 flex flex-wrap gap-3 text-xs">
                {dealsChg !== null && (
                  <div className={`rounded-lg px-3 py-1.5 ${
                    dealsChg >= 0 ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'
                  }`}>
                    Deals YoY ({monthName}): {dealsChg >= 0 ? '+' : ''}{change.deals}%
                  </div>
                )}
                {cashChg !== null && (
                  <div className={`rounded-lg px-3 py-1.5 ${
                    cashChg >= 0 ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'
                  }`}>
                    Cash YoY ({monthName}): {cashChg >= 0 ? '+' : ''}{change.cash}%
                  </div>
                )}
              </div>
            )
          })()}
        </Panel>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-7">
        <Card label={`Client Churn (${latestChurnPeriod})`} value={fmtMaybePct(latestChurn?.churnPct)} tone={(latestChurn?.churnPct || 0) > 3 ? 'bad' : 'warn'} tooltip="True unique clients lost ÷ start-of-month active clients. Duplicate cancellations and confirmed Monthly → PIF movements are excluded. Current month is month-to-date. Source: Stripe cohort." />
        <Card label={`Revenue Churn (${latestChurnPeriod})`} value={fmtMaybePct(latestChurn?.churnRevPct)} tone={(latestChurn?.churnRevPct || 0) > 3 ? 'bad' : 'warn'} tooltip="True churned MRR ÷ start-of-month cohort MRR. Confirmed Monthly → PIF movements are excluded. Current month is month-to-date. Source: Stripe cohort." />
        <Card label={`Book MRR Change (${latestChurnPeriod})`} value={hasValue(latestChurn?.netMRR) ? `${Number(latestChurn.netMRR) >= 0 ? '+' : ''}${fmt$(latestChurn.netMRR)}` : '—'} tone={Number(latestChurn?.netMRR || 0) >= 0 ? 'good' : 'bad'} tooltip="New subscription MRR minus true churned MRR for the displayed month. This is book MRR movement; confirmed PIF conversion value is tracked separately as deferred recurring value." />
        <Card label={`Client Movement (${latestChurnPeriod})`} value={hasValue(latestChurn?.clientsLost) && hasValue(latestChurn?.clientsAdded) ? `-${latestChurn.clientsLost} / +${latestChurn.clientsAdded}` : '—'} sub={hasValue(lateralTotals?.count) ? `${lateralTotals.count} Monthly → PIF excluded` : null} tooltip="True unique clients lost versus clients added. Duplicate cancellations are deduplicated; only human-confirmed Monthly → PIF movements are excluded." />
        <Card label="NRR (MTD / 3m / 12m)" value={`${fmtMaybePct(nrr?.currentMonth)} / ${fmtMaybePct(nrr?.trailing3mo)} / ${fmtMaybePct(nrr?.trailing12mo)}`} tone={(nrr?.currentMonth || 0) >= 100 ? 'good' : 'warn'} tooltip="Net Revenue Retention for the existing-client cohort, including contraction/expansion and excluding confirmed Monthly → PIF movements from churn. Current month is MTD; trailing values are monthly averages. Source: Stripe cohort for May 2026 onward." />
        <Card label="GRR (MTD / 3m / 12m)" value={`${fmtMaybePct(grr?.current)} / ${fmtMaybePct(grr?.trailing3m)} / ${fmtMaybePct(grr?.trailing12m)}`} tone={(grr?.current || 0) >= 95 ? 'good' : 'warn'} tooltip="Gross Revenue Retention for the existing-client cohort before expansion. Confirmed Monthly → PIF movements are excluded from churn. Current month is MTD." />
        <Card label="Dunning Topline" value={`${fmtN(dunning?.summary?.pastDueCount)} past due`} sub={`${fmt$(dunning?.summary?.mrrAtRisk)} at risk · ${fmt$(dunning?.summary?.totalOutstanding)} outstanding`} tone={Number(dunning?.summary?.pastDueCount || 0) > 0 ? 'bad' : 'good'} tooltip="Clients currently in the dunning (payment recovery) process with past-due Stripe invoices. MRR at Risk = monthly revenue from past-due clients. Outstanding = total unpaid invoice amount. Source: Stripe dunning data." />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel title="Projected MRR Renewals" sub={renewalPipelineLabel} href="/new-business" tone="neutral">
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="surface-subtle rounded-xl p-3 text-center">
              <div className="mb-1 text-[10px] uppercase tracking-wider executive-muted">Next Month</div>
              <div className="text-lg font-semibold text-teal-300">{fmt$(_nextMonthMRR)}</div>
            </div>
            <div className="surface-subtle rounded-xl p-3 text-center">
              <div className="mb-1 text-[10px] uppercase tracking-wider executive-muted">This Qtr Remaining</div>
              <div className="text-lg font-semibold text-teal-300">{fmt$(_thisQtrRemaining)}</div>
            </div>
            <div className="surface-subtle rounded-xl p-3 text-center">
              <div className="mb-1 text-[10px] uppercase tracking-wider executive-muted">Next Quarter</div>
              <div className="text-lg font-semibold text-teal-300">{fmt$(_nextQtrMRR)}</div>
            </div>
            <div className="surface-subtle rounded-xl p-3 text-center">
              <div className="mb-1 text-[10px] uppercase tracking-wider executive-muted">Full 13-Month Pipeline</div>
              <div className="text-lg font-semibold text-teal-300">{fmt$(_full13Total)}</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={renewalsChart}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
              <XAxis dataKey="label" tick={{ fill: chartAxis, fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={52} />
              <YAxis tickFormatter={(v) => `$${Math.round(v / 1000)}k`} tick={{ fill: chartAxis, fontSize: 11 }} />
              <Tooltip formatter={(v) => `${fmt$(v)}/mo`} contentStyle={{ background: 'var(--brand-surface-2)', border: '1px solid var(--brand-border-strong)', borderRadius: 12 }} />
              <Bar dataKey="mrr" fill="#14B8A6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Service by Sale vs Upsell" sub={`Cross-sectional leverage by service (first payment $) · ${serviceTimeframeLabels[serviceTimeframe]}`}>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {[
              ['month', 'This Month'],
              ['quarter', 'This Quarter'],
              ['ytd', 'YTD'],
              ['all', 'All Time'],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setServiceTimeframe(key)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${serviceTimeframe === key ? 'border-[var(--brand-border-accent)] bg-[rgba(166,111,205,0.14)] text-white' : 'border-[var(--brand-border)] text-[var(--brand-text-muted)] hover:border-[var(--brand-border-strong)] hover:text-white'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={serviceByType}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
              <XAxis dataKey="service" tick={{ fill: chartAxis, fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={52} />
              <YAxis tickFormatter={(v) => `$${Math.round(v / 1000)}k`} tick={{ fill: chartAxis, fontSize: 11 }} />
              <Tooltip formatter={(v) => fmt$(v)} contentStyle={{ background: 'var(--brand-surface-2)', border: '1px solid var(--brand-border-strong)', borderRadius: 12 }} />
              <Legend />
              <Bar dataKey="salesFP" name="Sales" fill="var(--brand-primary-4)" stackId="a" />
              <Bar dataKey="upsellFP" name="Upsell" fill="var(--brand-accent)" stackId="a" />
              <Bar dataKey="unclassifiedFP" name="Unclassified" fill="#6B7280" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <Card label="Leads Today / Week / Month" value={`${leads?.newLeads?.today || 0} / ${leads?.newLeads?.week || 0} / ${leads?.newLeads?.month || 0}`} tooltip="New leads (contacts) created in GHL (GoHighLevel) CRM. Today = current calendar day, Week = current 7-day rolling window, Month = current calendar month. Source: GHL leads API." />
        <Card label="Qualified Leads Today / Week" value={`${leads?.qualifiedLeads?.today || 0} / ${leads?.qualifiedLeads?.week || 0}`} tooltip="Leads that have reached a qualified stage in the GHL pipeline. Today = current calendar day, Week = current 7-day rolling window. Source: GHL leads API." />
        <Card label="Avg Deal Size (30d)" value={fmt$(dealSize?.avgDealSize || 0)} sub={`${dealSize?.totalDeals || 0} closed-won deals`} tooltip="Average cash at signing (first payment) per closed-won deal in the last 30 days. Formula: Total first payments ÷ number of closed-won deals. Source: Sales KPI Google Sheet via deal-size API." />
        <Card label="Team Agreements Closed (Month)" value={fmtMaybeN(sales?.team?.metrics?.['Agreements Closed']?.month)} tooltip="Total number of agreements (contracts) closed by the full sales team in the current calendar month. An em dash means the source metric is unavailable; it is not converted to a false zero. Source: Sales KPI Google Sheet." />
        <Card label="Client Health (G/Y/R)" value={`${fmtN(clientHealth?.green)} / ${fmtN(clientHealth?.yellow)} / ${fmtN(clientHealth?.red)}`} tooltip="Count of clients by health status — Green (on-track), Yellow (at-risk), Red (critical). Based on engagement, deliverable completion, and performance benchmarks. Source: Client health tracker." />
        <Card label="Meeting Completion" value={Number(qStats?.total || 0) > 0 ? `${Number(qStats.pct).toFixed(1)}%` : '—'} sub={Number(qStats?.total || 0) > 0 ? `${qStats.met}/${qStats.total} this quarter` : 'No scheduled-meeting denominator available'} tone={Number(qStats?.total || 0) > 0 ? ((qStats?.pct || 0) >= 80 ? 'good' : (qStats?.pct || 0) >= 50 ? 'warn' : 'bad') : 'warn'} tooltip="Percentage of scheduled client meetings completed this quarter. Formula: Meetings Completed ÷ Total Meetings Scheduled × 100. An em dash means no denominator is available; it does not mean 0% completion. Source: CX meeting tracker." />
      </div>

      <Panel title="Executive Notes" sub="Suggested cross-sectional watchpoints">
        <ul className="list-disc space-y-1 pl-5 text-sm executive-muted">
          <li>Track divergence between New Money momentum and net MRR change to catch quality vs quantity gaps.</li>
          <li>Prioritize services where Upsell contribution outpaces Sales contribution — that is your retention leverage engine.</li>
          <li>Watch dunning-at-risk MRR alongside churn trend; both are early-warning signals for cash pressure.</li>
        </ul>
      </Panel>

      {/* ── PIF MRR Impact ──────────────────────────────────────────────────── */}
      <div className="surface-panel rounded-2xl p-5">
        <PifMrrImpact />
      </div>
    </div>
  )
}
