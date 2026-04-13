'use client'

import { useEffect, useState, useCallback } from 'react'
import MetricTooltip from '@/components/MetricTooltip'
import {
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  CartesianGrid,
} from 'recharts'

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: '#0a0a0a',
  card: '#111111',
  border: '#2a1a3e',
  muted: '#9ca3af',
  purple: '#AE2BCF',
  indigo: '#6366f1',
  amber: '#f59e0b',
  green: '#10b981',
  red: '#ef4444',
  teal: '#14b8a6',
  gray: '#6b7280',
  white: '#ffffff',
}

const ANNUAL_TARGET = 4_200_000
const MONTHLY_TARGET = ANNUAL_TARGET / 12

// ─── Formatters ───────────────────────────────────────────────────────────────
function fmt$(n, compact = false) {
  if (n == null) return '—'
  const num = Number(n)
  if (isNaN(num)) return '—'
  if (compact) {
    if (Math.abs(num) >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`
    if (Math.abs(num) >= 1_000) return `$${(num / 1_000).toFixed(0)}K`
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num)
}

function fmtM(n) { return fmt$(n, true) }

function fmtPct(n) {
  if (n == null) return '—'
  return `${Number(n).toFixed(1)}%`
}

// ─── Custom chart tooltip ─────────────────────────────────────────────────────
function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#1a0d2b', border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', maxWidth: 220 }}>
      <p style={{ color: C.white, fontWeight: 600, margin: '0 0 6px', fontSize: 13 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || C.muted, margin: '2px 0', fontSize: 12 }}>
          {p.name}: {typeof p.value === 'number' ? fmtM(p.value) : p.value}
        </p>
      ))}
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ title, value, sub, icon, accent, danger }) {
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${danger ? C.red + '55' : accent ? accent + '55' : C.border}`,
      borderRadius: 12,
      padding: '16px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <p style={{ color: C.muted, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>{title}</p>
        <span style={{ fontSize: 20, opacity: 0.75 }}>{icon}</span>
      </div>
      <p style={{ color: danger ? C.red : accent || C.white, fontSize: 26, fontWeight: 700, margin: 0, lineHeight: 1.1 }}>{value}</p>
      {sub && <p style={{ color: C.muted, fontSize: 11, margin: 0 }}>{sub}</p>}
    </div>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, sub, children }) {
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ color: C.white, fontSize: 16, fontWeight: 700, margin: 0 }}>{title}</h2>
        {sub && <p style={{ color: C.muted, fontSize: 12, marginTop: 4, margin: '4px 0 0' }}>{sub}</p>}
      </div>
      {children}
    </div>
  )
}

// ─── Section 2: Actuals + Projections chart ───────────────────────────────────
function ActualsProjectionsChart({ data }) {
  if (!data) return null
  const { monthlyActuals = [], scenarios = {}, meta = {} } = data
  const { projStartKey } = meta

  // Build combined chart data: all actuals + projection months
  const allKeys = new Set()

  // Actual months (2025 + 2026)
  for (const r of monthlyActuals) allKeys.add(r.key)

  // Projection months
  for (const sc of Object.values(scenarios)) {
    for (const p of (sc.points || [])) allKeys.add(p.month)
  }

  const sortedKeys = [...allKeys].sort()
  const actualsMap = {}
  for (const r of monthlyActuals) actualsMap[r.key] = r

  const chartData = sortedKeys.map((key) => {
    const actual = actualsMap[key]
    const isProjection = !actual && key >= projStartKey
    const [y, m] = key.split('-').map(Number)
    const label = `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1]} ${String(y).slice(2)}`
    const row = { key, label }

    if (actual) {
      if (actual.year === 2025) row.actual2025 = actual.revenue
      else row.actual2026 = actual.revenue
    }

    if (key >= projStartKey) {
      row.projBase = scenarios.base?.points?.find((p) => p.month === key)?.mrr
      row.projTarget = scenarios.target?.points?.find((p) => p.month === key)?.mrr
      row.projStretch = scenarios.stretch?.points?.find((p) => p.month === key)?.mrr
    }

    return row
  })

  // Only show 2025 + 2026 + partial 2027
  const filtered = chartData.filter((d) => d.key >= '2025-01' && d.key <= '2027-06')

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 16px' }}>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={filtered} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a1a3e" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} interval={1} />
          <YAxis tickFormatter={(v) => fmtM(v)} tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={58} />
          <Tooltip content={<ChartTip />} />
          <Legend wrapperStyle={{ fontSize: 11, color: C.muted }} />

          {/* Actual bars */}
          <Bar dataKey="actual2025" name="2025 Actuals" fill={C.gray} radius={[3,3,0,0]} maxBarSize={18} />
          <Bar dataKey="actual2026" name="2026 Actuals" fill={C.indigo} radius={[3,3,0,0]} maxBarSize={18} />

          {/* Projection lines */}
          <Line type="monotone" dataKey="projBase" name="Base Case" stroke={C.indigo} strokeWidth={2} dot={false} strokeDasharray="6 3" connectNulls />
          <Line type="monotone" dataKey="projTarget" name="$4.2M Target" stroke={C.amber} strokeWidth={2} dot={false} strokeDasharray="6 3" connectNulls />
          <Line type="monotone" dataKey="projStretch" name="Stretch" stroke={C.green} strokeWidth={2} dot={false} strokeDasharray="6 3" connectNulls />

          {/* $350K monthly target line */}
          <ReferenceLine
            y={MONTHLY_TARGET}
            stroke={C.amber}
            strokeDasharray="4 4"
            strokeOpacity={0.5}
            label={{ value: '$350K/mo target', fill: C.amber, fontSize: 10, position: 'insideTopRight' }}
          />

          {/* Today marker */}
          {projStartKey && (
            <ReferenceLine
              x={filtered.find((d) => d.key >= projStartKey)?.label}
              stroke={C.purple}
              strokeDasharray="3 3"
              strokeOpacity={0.7}
              label={{ value: 'Today', fill: C.purple, fontSize: 10, position: 'insideTopLeft' }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Section 3: Forward MRR Bridge ──────────────────────────────────────────────
function ForwardMRRBridge({ bridge = [] }) {
  if (!bridge.length) return <p style={{ color: C.muted, fontSize: 13 }}>No bridge data available.</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Chart */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 16px' }}>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={bridge} margin={{ top: 16, right: 24, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a1a3e" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => fmtM(v)} tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={62} />
            <ReferenceLine y={0} stroke={C.border} />
            <Tooltip content={<ChartTip />} />
            <Legend wrapperStyle={{ fontSize: 11, color: C.muted }} />
            <Bar dataKey="newMrr" name="New MRR" stackId="pos" fill={C.teal} maxBarSize={40} />
            <Bar dataKey="renewalMrr" name="Renewal MRR" stackId="pos" fill={C.indigo} radius={[3,3,0,0]} maxBarSize={40} />
            <Bar dataKey="churnMrr" name="Churn MRR" stackId="neg" fill={C.red} radius={[0,0,3,3]} maxBarSize={40} />
            <Line type="monotone" dataKey="endMrr" name="Ending MRR" stroke={C.purple} strokeWidth={2.5} dot={{ fill: C.purple, r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Numbers table */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {['Month', 'Begin MRR', '+ New', '+ Renewal', '− Churn', 'Net', 'End MRR'].map((h) => (
                <th key={h} style={{ padding: '8px 14px', textAlign: h === 'Month' ? 'left' : 'right', color: C.muted, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bridge.map((row, i) => (
              <tr key={i} style={{ borderBottom: i < bridge.length - 1 ? `1px solid ${C.border}` : 'none', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                <td style={{ padding: '7px 14px', color: C.white, fontWeight: 600 }}>{row.label}</td>
                <td style={{ padding: '7px 14px', textAlign: 'right', color: C.muted }}>{fmtM(row.beginMrr)}</td>
                <td style={{ padding: '7px 14px', textAlign: 'right', color: C.teal }}>+{fmtM(row.newMrr)}</td>
                <td style={{ padding: '7px 14px', textAlign: 'right', color: C.indigo }}>+{fmtM(row.renewalMrr)}</td>
                <td style={{ padding: '7px 14px', textAlign: 'right', color: C.red }}>−{fmtM(row.churnMrrAbs)}</td>
                <td style={{ padding: '7px 14px', textAlign: 'right', color: row.netChange >= 0 ? C.green : C.red, fontWeight: 600 }}>
                  {row.netChange >= 0 ? '+' : ''}{fmtM(row.netChange)}
                </td>
                <td style={{ padding: '7px 14px', textAlign: 'right', color: C.purple, fontWeight: 700 }}>{fmtM(row.endMrr)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Section 4: Scenario Comparison Table ────────────────────────────────────
function ScenarioTable({ table, scenarios }) {
  if (!table?.rows) return null

  const cols = ['base', 'target', 'stretch']
  const colors = { base: C.indigo, target: C.amber, stretch: C.green }
  const labels = { base: 'Base Case', target: '$4.2M Target', stretch: 'Stretch' }

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
            <th style={{ padding: '12px 16px', textAlign: 'left', color: C.muted, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Metric
            </th>
            {cols.map((col) => (
              <th key={col} style={{ padding: '12px 16px', textAlign: 'right', color: colors[col], fontSize: 12, fontWeight: 700 }}>
                {labels[col]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: i < table.rows.length - 1 ? `1px solid ${C.border}` : 'none', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
              <td style={{ padding: '10px 16px', color: C.muted, fontWeight: 500 }}>{row.label}</td>
              {cols.map((col) => {
                const val = row[col]
                const formatted = row.format === 'currency' && val != null
                  ? fmtM(val)
                  : val == null ? '—' : String(val)
                const isHighlight = row.format === 'currency' && val != null
                return (
                  <td key={col} style={{ padding: '10px 16px', textAlign: 'right', color: isHighlight ? colors[col] : C.white, fontWeight: isHighlight ? 700 : 400 }}>
                    {formatted}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Section 5: Sensitivity Heatmaps ─────────────────────────────────────────
function cellColor(value) {
  if (value >= 4_200_000) return { bg: '#065f46', text: '#34d399', border: '#10b981' }
  if (value >= 3_800_000) return { bg: '#1a4731', text: '#6ee7b7', border: '#059669' }
  if (value >= 3_500_000) return { bg: '#1c2a1a', text: '#86efac', border: '#4ade80' }
  if (value >= 3_200_000) return { bg: '#451a03', text: '#fcd34d', border: '#f59e0b' }
  return { bg: '#450a0a', text: '#fca5a5', border: '#ef4444' }
}

const SENSITIVITY_LEGEND = [
  { label: '< $3.2M',      bg: '#450a0a', text: '#fca5a5' },
  { label: '$3.2M–$3.5M', bg: '#451a03', text: '#fcd34d' },
  { label: '$3.5M–$3.8M', bg: '#1c2a1a', text: '#86efac' },
  { label: '$3.8M–$4.2M', bg: '#1a4731', text: '#6ee7b7' },
  { label: '≥ $4.2M 🎯',  bg: '#065f46', text: '#34d399' },
]

function SensitivityGrid({ data: sens, colHeader }) {
  if (!sens) return null
  const { dealCounts, colValues, colType, matrix } = sens
  const fmtCol = (v) => colType === 'churn' ? `${(v * 100).toFixed(1)}%` : `$${(v / 1000).toFixed(0)}K`

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
            <th style={{ padding: '10px 14px', textAlign: 'left', color: C.muted, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
              {colHeader}
            </th>
            {colValues.map((v) => (
              <th key={v} style={{ padding: '10px 14px', textAlign: 'center', color: C.muted, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
                {fmtCol(v)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dealCounts.map((deals, ri) => (
            <tr key={deals} style={{ borderBottom: ri < dealCounts.length - 1 ? `1px solid ${C.border}` : 'none' }}>
              <td style={{ padding: '8px 14px', color: C.white, fontWeight: 600 }}>{deals}/mo</td>
              {colValues.map((_, ci) => {
                const val = matrix[ri][ci]
                const { bg, text, border } = cellColor(val)
                return (
                  <td key={ci} style={{ padding: '8px 14px', textAlign: 'center' }}>
                    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 6, padding: '4px 8px', color: text, fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' }}>
                      {fmtM(val)}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', gap: 12, padding: '10px 14px', borderTop: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
        {SENSITIVITY_LEGEND.map((l) => (
          <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: l.text }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: l.bg, display: 'inline-block', border: `1px solid ${l.text}` }} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Section 6: Renewal Pipeline ─────────────────────────────────────────────
function RenewalPipeline({ pipeline = [] }) {
  if (!pipeline.length) return null

  const maxMrr = Math.max(...pipeline.map((p) => p.mrr), 1)

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 16px' }}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={pipeline} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a1a3e" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={(v) => fmtM(v)} tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={58} />
          <Tooltip content={<ChartTip />} />
          <Bar dataKey="mrr" name="Renewal MRR" radius={[4,4,0,0]}>
            {pipeline.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.isCurrent ? C.purple : entry.isPast ? C.gray : C.teal}
                opacity={entry.mrr === 0 ? 0.3 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p style={{ color: C.muted, fontSize: 11, marginTop: 8, margin: '8px 0 0' }}>
        <span style={{ color: C.gray }}>■ Past </span>
        <span style={{ color: C.purple }}>■ Current month </span>
        <span style={{ color: C.teal }}>■ Upcoming </span>
        — PIF renewal MRR entering each month (at various renewal rates per scenario)
      </p>
    </div>
  )
}

// ─── Section 7: Key Metrics ───────────────────────────────────────────────────
function KeyMetrics({ metrics }) {
  if (!metrics) return null
  const { nrr, quickRatio, daysToTarget, churnCost, currentMRR } = metrics

  const items = [
    {
      label: 'Net Revenue Retention (NRR)',
      value: nrr != null ? `${nrr}%` : '—',
      accent: nrr >= 100 ? C.green : nrr >= 95 ? C.amber : C.red,
      tooltip: 'NRR measures what % of last period\'s revenue was retained (plus expansions). >100% means the existing base is growing. Approximated from MRR snapshots.',
    },
    {
      label: 'Quick Ratio',
      value: quickRatio != null ? `${quickRatio}x` : '—',
      accent: quickRatio >= 4 ? C.green : quickRatio >= 2 ? C.amber : C.red,
      tooltip: 'Quick Ratio = New MRR ÷ Churned MRR. A ratio >4 is healthy. Approximated using avg deal MRR × new/churned customer counts.',
    },
    {
      label: 'Monthly Churn Cost',
      value: churnCost != null ? fmt$(churnCost) : '—',
      accent: C.red,
      tooltip: `The "re-earn burden" — how much new MRR you must close every month just to stay flat. = Current MRR × 2.5% base churn rate. Currently: ${fmt$(currentMRR)} × 2.5% = ${fmt$(churnCost)}.`,
    },
    {
      label: 'Days to $4.2M',
      value: daysToTarget != null ? `${daysToTarget} days` : '—',
      accent: daysToTarget < 200 ? C.green : daysToTarget < 300 ? C.amber : C.red,
      tooltip: 'Estimated days to reach $4.2M annual run rate based on current YTD cash pace. = (Target − YTD Cash) ÷ Daily Revenue Rate.',
    },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
      {items.map((item) => (
        <div key={item.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px' }}>
          <p style={{ color: C.muted, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px', display: 'flex', alignItems: 'center' }}>
            {item.label}
            <MetricTooltip text={item.tooltip} />
          </p>
          <p style={{ color: item.accent, fontSize: 28, fontWeight: 700, margin: 0 }}>{item.value}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ProjectionsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/metrics/projections', { cache: 'no-store' })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const s = data?.scoreboard
  const scenarios = data?.scenarios

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 32, background: C.bg, minHeight: '100vh' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ color: C.white, fontSize: 26, fontWeight: 800, margin: 0 }}>📈 Revenue Projections</h1>
          <p style={{ color: C.muted, fontSize: 13, marginTop: 6, margin: '6px 0 0' }}>
            GYC 2026 · Three scenarios · CEO presentation view
            {data?.meta?.generatedAt && (
              <span style={{ marginLeft: 8, color: '#4a3060' }}>
                · Updated {new Date(data.meta.generatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          style={{
            border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 14px',
            fontSize: 12, fontWeight: 500, color: '#d1d5db', background: 'transparent',
            cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1,
          }}
        >
          {loading ? 'Loading…' : '↻ Refresh'}
        </button>
      </div>

      {error && (
        <div style={{ background: '#7f1d1d33', border: `1px solid ${C.red}44`, borderRadius: 10, padding: 16, color: C.red, fontSize: 13 }}>
          ⚠️ {error}
        </div>
      )}

      {/* ── Section 1: Scoreboard ────────────────────────────────────────────── */}
      <Section title="Scoreboard" sub="Live metrics pulled from Stripe + cash ledger">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
          <KpiCard
            title="Current MRR"
            value={loading ? '…' : fmtM(s?.mrr)}
            sub={`${s?.activeClients ?? '…'} active clients`}
            icon="🔁"
            accent={C.purple}
          />
          <KpiCard
            title="YTD Cash"
            value={loading ? '…' : fmtM(s?.ytdCash)}
            sub={`${s?.daysElapsed ?? '…'} days elapsed`}
            icon="💵"
            accent={C.indigo}
          />
          <KpiCard
            title="On Track For"
            value={loading ? '…' : fmtM(s?.onTrackFor)}
            sub="YTD annualized run rate"
            icon="🎯"
            accent={s?.onTrackFor >= 4_200_000 ? C.green : s?.onTrackFor >= 3_500_000 ? C.amber : C.red}
          />
          <KpiCard
            title="Gap to $4.2M"
            value={loading ? '…' : fmtM(Math.abs(s?.gapToTarget ?? 0))}
            sub={s?.gapToTarget > 0 ? 'behind target' : 'ahead of target!'}
            icon="🏔️"
            danger={s?.gapToTarget > 0}
            accent={s?.gapToTarget <= 0 ? C.green : undefined}
          />
          <KpiCard
            title="Quick Ratio"
            value={loading ? '…' : (s?.quickRatio != null ? `${s.quickRatio}x` : '—')}
            sub="New MRR ÷ Churned MRR"
            icon="⚡"
            accent={s?.quickRatio >= 4 ? C.green : s?.quickRatio >= 2 ? C.amber : C.red}
          />
          <KpiCard
            title="Churn Cost/Month"
            value={loading ? '…' : fmtM(s?.churnCost)}
            sub="Monthly re-earn burden"
            icon="🔥"
            danger
          />
        </div>
      </Section>

      {/* ── Section 2: Actuals + Projections chart ───────────────────────────── */}
      <Section
        title="Actuals vs Projections"
        sub="Monthly cash collected (bars) + 3 scenario MRR projections (lines). Dashed = $350K/mo target."
      >
        {loading ? (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: C.muted }}>Loading chart…</p>
          </div>
        ) : (
          <ActualsProjectionsChart data={data} />
        )}
      </Section>

      {/* ── Section 3: Forward MRR Bridge ────────────────────────────────────── */}
      <Section
        title="MRR Bridge — Next 6 Months (Base Case)"
        sub="Projected MRR movement May–Oct 2026 assuming current sales pace and 2.5% monthly churn."
      >
        {loading ? (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: C.muted }}>Loading…</p>
          </div>
        ) : (
          <ForwardMRRBridge bridge={data?.forwardMrrBridge} />
        )}
      </Section>

      {/* ── Section 4: Scenario Comparison Table ─────────────────────────────── */}
      <Section
        title="Scenario Comparison"
        sub="Three paths to 2027. Assumptions drive the outcome — churn and new deals are the biggest levers."
      >
        {loading ? (
          <p style={{ color: C.muted }}>Loading…</p>
        ) : (
          <>
            {/* Scenario badges */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              {scenarios && Object.entries(scenarios).map(([key, sc]) => (
                <div key={key} style={{ background: sc.color + '15', border: `1px solid ${sc.color}44`, borderRadius: 10, padding: '8px 16px', maxWidth: 280 }}>
                  <p style={{ color: sc.color, fontWeight: 700, fontSize: 13, margin: '0 0 4px' }}>{sc.label}</p>
                  <p style={{ color: C.muted, fontSize: 11, margin: 0 }}>{sc.description}</p>
                </div>
              ))}
            </div>
            <ScenarioTable table={data?.scenarioTable} scenarios={scenarios} />
          </>
        )}
      </Section>

      {/* ── Section 5: Sensitivity Tables ─────────────────────────────────────── */}
      <Section
        title="Lever Sensitivity — EOY 2026 Revenue"
        sub={data?.avgDealStats ? `PIF deals use renewal amount as MRR; monthly deals use first payment. 2025 avg: $${data.avgDealStats.avgDealMRR.toLocaleString()} MRR/deal, $${data.avgDealStats.avgFirstPayment.toLocaleString()} first payment/deal.` : 'Green = hits $4.2M target.'}
      >
        {loading ? (
          <p style={{ color: C.muted }}>Loading…</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Table 1: Deals × Expansion MRR */}
            <div>
              <p style={{ color: C.white, fontSize: 13, fontWeight: 600, margin: '0 0 4px' }}>Table 1 — New Deals × Expansion MRR (2.5% churn fixed)</p>
              <p style={{ color: C.muted, fontSize: 11, margin: '0 0 10px' }}>How upsells / expansion MRR from existing clients changes the outcome. Each column adds $X/mo from in-contract upsells.</p>
              <SensitivityGrid data={data?.sensitivityDealsExpansion} colHeader="Deals/mo ↓ | Expansion MRR →" />
              <p style={{ color: '#4a3060', fontSize: 11, marginTop: 8 }}>Assumes 2.5% monthly churn. Reducing churn adds ~$40K per 0.5% reduction.</p>
            </div>

            {/* Table 2: Deals × Churn */}
            <div>
              <p style={{ color: C.white, fontSize: 13, fontWeight: 600, margin: '0 0 4px' }}>Table 2 — New Deals × Churn Rate ($3K expansion fixed)</p>
              <p style={{ color: C.muted, fontSize: 11, margin: '0 0 10px' }}>Shows retention value. Assumes $3K/mo expansion MRR (moderate upsell). Churn reduction = permanent compounding gains.</p>
              <SensitivityGrid data={data?.sensitivityDealsChurn} colHeader="Deals/mo ↓ | Churn Rate →" />
            </div>
          </div>
        )}
      </Section>

      {/* ── Section 6: Renewal Pipeline ──────────────────────────────────────── */}
      <Section
        title="2026 Renewal Pipeline"
        sub="PIF renewal MRR entering each month (computed from Google Sheets deal history). Teal = upcoming."
      >
        {loading ? (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: C.muted }}>Loading…</p>
          </div>
        ) : (
          <RenewalPipeline pipeline={data?.renewalPipeline} />
        )}
      </Section>

      {/* ── Section 7: Key Metrics ────────────────────────────────────────────── */}
      <Section title="Key Metrics" sub="NRR, Quick Ratio, Days to Target — with context.">
        {loading ? (
          <p style={{ color: C.muted }}>Loading…</p>
        ) : (
          <KeyMetrics metrics={data?.keyMetrics} />
        )}
      </Section>

      {/* Footer */}
      <p style={{ color: '#4a3060', fontSize: 11 }}>
        Projections are models, not guarantees. Base case assumes 2025 sales pace + 2.5%/mo churn.
        {data?.meta?.generatedAt && ` · Generated ${new Date(data.meta.generatedAt).toLocaleString()}`}
      </p>
    </div>
  )
}
