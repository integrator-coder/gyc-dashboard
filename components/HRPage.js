'use client'

import { useEffect, useState, useCallback } from 'react'
import MetricCard from '@/components/MetricCard'

const B = {
  card: '#111111',
  border: '#2a1a3e',
  p1: '#340B67',
  p2: '#731494',
  p3: '#732FBA',
  p4: '#AE2BCF',
  accent: '#C19C46',
  muted: '#9ca3af',
  elevated: '#1a1a1a',
}

function formatCurrency(value) {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

const PLANNED_METRICS = [
  {
    title: 'Overall Sentiment Score',
    description: 'AI-derived composite score from meeting transcripts and Slack messages.',
    icon: '🧠',
  },
  {
    title: 'Meeting Contribution Index',
    description: 'Speaking time % per team member over time. Flags imbalances.',
    icon: '🎙️',
  },
  {
    title: 'Meeting Attendance Rate',
    description: 'Per-person attendance rate, rolling 90 days.',
    icon: '📅',
  },
  {
    title: 'Engagement Trend',
    description: 'Up / down / stable over last 3 months. Derived from combined signals.',
    icon: '📈',
  },
  {
    title: 'Flagged Signals',
    description: 'Spike or drop in contribution. Early warning for at-risk team members.',
    icon: '🚨',
  },
]

export default function HRPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [scorecard, setScorecard] = useState([])
  const [scorecardLoading, setScorecardLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/metrics/hr')
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

  const fetchScorecard = useCallback(async () => {
    try {
      const res = await fetch('/api/metrics/hr/scorecard')
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setScorecard(Array.isArray(json) ? json : [])
    } catch (err) {
      console.error('Scorecard fetch error:', err)
    } finally {
      setScorecardLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    fetchScorecard()
  }, [fetchData, fetchScorecard])

  const handleEditStart = () => {
    setEditValue(String(data?.config?.monthlyPayroll || ''))
    setSaveError(null)
    setEditing(true)
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const val = parseFloat(editValue.replace(/[^0-9.]/g, ''))
      if (isNaN(val) || val <= 0) throw new Error('Enter a valid monthly payroll amount')
      const res = await fetch('/api/metrics/hr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthlyPayroll: val }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setEditing(false)
      await fetchData()
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4"
            style={{ borderColor: B.p4, borderTopColor: 'transparent' }} />
          <p style={{ color: B.muted }}>Loading HR data…</p>
        </div>
      </div>
    )
  }

  // Scorecard helpers
  const latest = scorecard.length > 0 ? scorecard[scorecard.length - 1] : null

  function rpeColor(val) {
    if (val === null || val === undefined) return null
    if (val >= 100000) return '#4ade80'
    if (val >= 70000)  return '#fbbf24'
    return '#f87171'
  }

  function compRatioColor(pct) {
    if (pct === null || pct === undefined) return null
    if (pct <= 40) return '#4ade80'
    if (pct <= 50) return '#fbbf24'
    return '#f87171'
  }

  function fmtPct(val) {
    if (val === null || val === undefined) return '—'
    return val.toFixed(2) + '%'
  }

  function fmtRoi(val) {
    if (val === null || val === undefined) return '—'
    return '$' + val.toFixed(2)
  }

  function fmtHc(val) {
    if (val === null || val === undefined) return '—'
    return Number(val).toFixed(1)
  }

  // Current month derived values (used in latestMonthRow + JSX)
  const monthlyPayroll = data?.config?.monthlyPayroll ?? 132500
  const impliedHeadcount = data?.computed?.impliedHeadcount ?? 18.5
  const rpe = data?.computed?.rpe ?? null
  const mrr = data?.computed?.mrr ?? 0

  // Synthetic "Latest Month" row from live config + computed data
  const latestMonthRow = {
    period: 'Latest Month',
    periodType: 'monthly',
    revenue: mrr,
    headcount: impliedHeadcount,
    baseSalaryTotal: monthlyPayroll,
    totalComp: monthlyPayroll,
    rpe: impliedHeadcount > 0 ? (mrr * 12) / impliedHeadcount : null,
    impliedHcBase: (monthlyPayroll * 12) / 85000,
    impliedHcTotal: (monthlyPayroll * 12) / 85000,
    standardizedRpe: ((monthlyPayroll * 12) / 85000) > 0
      ? (mrr * 12) / ((monthlyPayroll * 12) / 85000)
      : null,
    compRatioPct: mrr > 0 ? (monthlyPayroll / mrr) * 100 : null,
    roi: monthlyPayroll > 0 ? mrr / monthlyPayroll : null,
  }

  const displayScorecard = scorecard.length > 0 ? [...scorecard, latestMonthRow] : []

  // Build YoY table columns/rows dynamically from scorecard
  const scorecardCols = displayScorecard.length > 0
    ? ['Metric', ...displayScorecard.map(r => r.period)]
    : ['Metric', '2023', '2024', '2025', '2026 YTD']

  function buildRowValues(getVal, getFmt, getColor) {
    if (displayScorecard.length === 0) return []
    return displayScorecard.map(r => {
      const raw = getVal(r)
      return { display: getFmt(raw, r), color: getColor ? getColor(raw) : null }
    })
  }

  const scorecardRows = [
    {
      label: 'Revenue',
      tooltip: 'Total recognized revenue for the period. Source: Stripe.',
      values: buildRowValues(
        r => r.revenue !== null ? Number(r.revenue) : null,
        v => formatCurrency(v),
        () => null,
      ),
    },
    {
      label: 'Headcount',
      tooltip: 'Average headcount over the period. Full-time = 1.0, Part-time = 0.5. Source: Payroll Tracker.',
      values: buildRowValues(
        r => r.headcount !== null ? Number(r.headcount) : null,
        v => fmtHc(v),
        () => null,
      ),
    },
    {
      label: 'Implied HC — Base Only ($85K)',
      tooltip: 'Total base salaries ÷ $85,000. Normalizes headcount to $85K-equivalent FTEs using base pay only. Source: Gusto.',
      values: buildRowValues(
        r => r.impliedHcBase,
        v => fmtHc(v),
        () => null,
      ),
    },
    {
      label: 'Implied HC — Total Comp ($85K)',
      tooltip: 'Total compensation ÷ $85,000. Normalizes headcount using fully-loaded cost (base + commissions + benefits + employer taxes). Source: Gusto / Deel.',
      values: buildRowValues(
        r => r.impliedHcTotal,
        v => fmtHc(v),
        () => null,
      ),
    },
    {
      label: 'Total Comp',
      tooltip: 'Fully-loaded compensation including base salaries, commissions, benefits, and employer taxes. Source: Gusto / Deel.',
      values: buildRowValues(
        r => r.totalComp !== null ? Number(r.totalComp) : null,
        v => formatCurrency(v),
        () => null,
      ),
    },
    {
      label: 'Annual RPE',
      tooltip: 'Revenue Per Employee. Revenue ÷ actual headcount, annualized. Measures how much revenue each real person generates. Benchmark: <$70K Low · $70K–$100K Healthy · >$100K Strong.',
      values: buildRowValues(
        r => r.rpe,
        v => formatCurrency(v),
        v => rpeColor(v),
      ),
    },
    {
      label: 'Standardized RPE ($85K)',
      tooltip: 'Standardized Revenue Per Employee. Revenue ÷ (Total Comp ÷ $85K). Normalizes headcount to $85K-equivalent FTEs for apples-to-apples comparison across years regardless of salary mix. Benchmark: <$70K Low · $70K–$100K Healthy · >$100K Strong.',
      values: buildRowValues(
        r => r.standardizedRpe,
        v => formatCurrency(v),
        v => rpeColor(v),
      ),
    },
    {
      label: 'Comp Ratio %',
      tooltip: 'Total Compensation ÷ Revenue, expressed as a percentage. Lower is better — measures how much of revenue is consumed by people costs. Benchmark: >50% Watch Zone · 40–50% Healthy · ≤40% Elite.',
      values: buildRowValues(
        r => r.compRatioPct,
        v => fmtPct(v),
        v => compRatioColor(v),
      ),
    },
    {
      label: 'ROI per $1 Comp',
      tooltip: 'Revenue ÷ Total Compensation. How much revenue is generated for every $1 spent on total comp. Higher is better.',
      values: buildRowValues(
        r => r.roi,
        v => fmtRoi(v),
        () => null,
      ),
    },
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <h1
          className="text-2xl font-bold text-white"
          style={{ borderLeft: `3px solid ${B.p3}`, paddingLeft: '12px' }}
        >
          🧑‍💼 HR
        </h1>
        <p style={{ color: B.muted }} className="text-sm mt-0.5 pl-4">
          Headcount, payroll efficiency, and team health
        </p>
      </div>

      {error && (
        <div className="bg-red-950 border border-red-800 rounded-lg px-4 py-3 text-red-300 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* ── Data Gaps Banner ──────────────────────────────────── */}
      <div
        className="rounded-xl p-4"
        style={{ backgroundColor: '#1a1206', border: '1px solid #78350f' }}
      >
        <div className="flex items-start gap-3">
          <span className="text-lg">📋</span>
          <div className="flex-1">
            <p className="text-amber-400 font-semibold text-sm mb-2">Data still needed from Carmella</p>
            <ul className="space-y-1 text-xs" style={{ color: '#d97706' }}>
              <li>• <strong>Base Salaries row</strong> in the HR Scorecard sheet — 2023, 2024, 2025 annual totals from Gusto (enables Implied HC — Base Only for all years)</li>
              <li>• <strong>2023 Headcount</strong> — currently blank; confirm avg headcount for the year</li>
              <li>• <strong>Verify 2026 Q1 Total Comp</strong> ($544,244) — confirm it includes base + commissions + benefits + employer taxes</li>
              <li>• <strong>Performance Review section</strong> — metrics TBD; work with Todd to define before building dashboard section</li>
            </ul>
            <p className="text-xs mt-2" style={{ color: '#92400e' }}>
              Tasks in Asana · Sheet syncs to dashboard every Monday at 7am automatically
            </p>
          </div>
        </div>
      </div>

      {/* ── Section 1: Payroll Top-Line ─────────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold text-white mb-4" style={{ color: B.p4 }}>
          Payroll & Efficiency
        </h2>

        {/* Editable Payroll Card */}
        <div
          className="rounded-xl p-5 mb-5"
          style={{ backgroundColor: B.elevated, border: `1px solid ${B.border}` }}
        >
          <div className="flex items-center justify-between mb-1">
            <div>
              <p style={{ color: B.muted }} className="text-xs font-semibold uppercase tracking-widest mb-1">
                Latest Month Payroll
              </p>
              {editing ? (
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="rounded-lg px-3 py-2 text-white text-lg font-bold bg-black border border-violet-700 focus:outline-none focus:border-violet-400 w-44"
                    placeholder="e.g. 132500"
                    autoFocus
                  />
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                    style={{ backgroundColor: B.p3 }}
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <span className="text-2xl font-bold text-white">{formatCurrency(monthlyPayroll)}<span className="text-base font-normal text-gray-300">/mo</span></span>
                  <button
                    onClick={handleEditStart}
                    className="text-xs px-3 py-1 rounded-lg border text-gray-400 hover:text-white hover:border-violet-500 transition"
                    style={{ borderColor: B.border }}
                  >
                    ✏️ Edit
                  </button>
                </div>
              )}
              {saveError && <p className="text-red-400 text-xs mt-2">{saveError}</p>}
            </div>
            <div style={{ color: B.muted }} className="text-3xl">💼</div>
          </div>
          {data?.config?.updatedAt && (
            <p style={{ color: B.muted }} className="text-xs mt-2">
              Last updated {formatDate(data.config.updatedAt)}{data.config.updatedBy ? ` by ${data.config.updatedBy}` : ''}
            </p>
          )}
          <p style={{ color: B.muted }} className="text-xs mt-1">
            Admin-only. Used to calculate implied headcount and RPE. Assumes $85,000/yr per FTE.
          </p>
        </div>

        {/* Implied Headcount + RPE cards */}
        <div className="grid grid-cols-3 gap-4">
          <MetricCard
            title="Monthly Payroll"
            value={formatCurrency(monthlyPayroll)}
            subtitle="Per month"
            icon="💼"
            tooltip="Total monthly payroll cost. Manually entered by admin. Used to derive implied headcount and RPE."
          />
          <MetricCard
            title="Implied Headcount"
            value={impliedHeadcount.toFixed(1)}
            subtitle="Payroll ÷ $85k/yr"
            icon="👥"
            tooltip={`Monthly payroll (${formatCurrency(monthlyPayroll)}) ÷ ($85,000 ÷ 12). Represents implied full-time equivalent headcount based on payroll cost.`}
          />
          <MetricCard
            title="RPE (MRR-based)"
            value={formatCurrency(rpe)}
            subtitle="ARR ÷ implied HC"
            icon="📊"
            tooltip={`(MRR × 12) ÷ implied headcount. MRR: ${formatCurrency(mrr)}/mo. Headcount: ${impliedHeadcount.toFixed(1)}. Measures annualized recurring revenue per employee. Target: $250,000/yr.`}
          />
        </div>
      </section>

      {/* ── Section 2: HR Scorecard ─────────────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold mb-1" style={{ color: B.p4 }}>
          📊 HR Scorecard
        </h2>
        <p style={{ color: B.muted }} className="text-xs mb-5">
          Year-over-year efficiency metrics · Source: Gusto / Deel · Payroll Tracker · Stripe
        </p>

        {/* A. 2026 YTD Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-3">
          <MetricCard
            title="Headcount"
            value={latest ? fmtHc(latest.headcount) : '37'}
            subtitle={latest ? `${latest.period} avg (FT=1, PT=0.5)` : 'Q1 2026 avg (FT=1, PT=0.5)'}
            icon="👥"
          />
          <MetricCard
            title="Annual RPE (est.)"
            value={latest ? (formatCurrency(latest.rpe) || '—') : '$95,316'}
            subtitle={latest ? `${latest.period} annualized · ${latest.rpe >= 100000 ? 'Strong zone' : latest.rpe >= 70000 ? 'Healthy zone' : 'Low zone'}` : 'Q1 annualized · Healthy zone'}
            icon="📈"
            tooltip="Actual RPE: Revenue ÷ actual headcount (FT=1, PT=0.5). Uses the real people count from payroll. Annualized for quarterly periods. Benchmark: <$70K Low · $70K–$100K Healthy · >$100K Strong."
          />
          <MetricCard
            title="Standardized RPE (est.)"
            value={latest ? (formatCurrency(latest.standardizedRpe) || '—') : '$137,698'}
            subtitle={latest ? `${latest.period} annualized · ${latest.standardizedRpe >= 100000 ? 'Strong zone' : latest.standardizedRpe >= 70000 ? 'Healthy zone' : 'Low zone'}` : 'Q1 annualized · Strong zone'}
            icon="📊"
            tooltip="Standardized RPE: Revenue ÷ (Total Comp ÷ $85K). Normalizes headcount to $85K-equivalent FTEs regardless of actual salary or hours. Annualized for quarterly periods. Benchmark: <$70K Low · $70K–$100K Healthy · >$100K Strong."
          />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-2 gap-4 mb-6">
          <MetricCard
            title="Comp Ratio"
            value={latest ? (fmtPct(latest.compRatioPct) || '—') : '61.73%'}
            subtitle={latest ? `${latest.period} · ${latest.compRatioPct > 50 ? 'Watch Zone (>50%)' : latest.compRatioPct > 40 ? 'Healthy (40–50%)' : 'Elite (≤40%)'}` : 'Q1 2026 · Watch Zone (>50%)'}
            icon="⚖️"
          />
          <MetricCard
            title="ROI per $1 Comp"
            value={latest ? (fmtRoi(latest.roi) || '—') : '$1.62'}
            subtitle="Revenue per $1 of total comp"
            icon="💰"
          />
        </div>

        {/* B. Year-over-year trend table */}
        <div
          className="rounded-xl overflow-hidden mb-4"
          style={{ backgroundColor: B.elevated, border: `1px solid ${B.border}` }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: B.p1 }}>
                {scorecardCols.map((col) => (
                  <th
                    key={col}
                    className="px-4 py-3 text-left font-semibold"
                    style={{
                      borderBottom: `1px solid ${B.border}`,
                      color: col === 'Latest Month' ? B.p4 : '#ffffff',
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scorecardLoading ? (
                <tr>
                  <td colSpan={scorecardCols.length} className="px-4 py-6 text-center" style={{ color: B.muted }}>
                    Loading scorecard…
                  </td>
                </tr>
              ) : scorecardRows.map((row, rowIdx) => (
                <tr
                  key={row.label}
                  style={{
                    backgroundColor: rowIdx % 2 === 0 ? '#131313' : '#1a1a1a',
                    borderBottom: `1px solid ${B.border}`,
                  }}
                >
                  <td className="px-4 py-3 font-medium" style={{ color: B.muted }}>
                    <span className="flex items-center gap-1.5">
                      {row.label}
                      {row.tooltip && (
                        <span title={row.tooltip} className="cursor-help text-xs" style={{ color: B.p4 }}>ⓘ</span>
                      )}
                    </span>
                  </td>
                  {row.values.map((cell, i) => (
                    <td
                      key={i}
                      className="px-4 py-3 font-mono"
                      style={{ color: cell.color || (scorecardCols[i + 1] === 'Latest Month' ? B.p4 : '#e5e7eb') }}
                    >
                      {cell.display}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-2 text-xs" style={{ color: B.muted }}>
            * 2026 YTD figures annualized from Q1 data. Standardized RPE = Revenue ÷ (Total Comp ÷ $85K)
          </p>
        </div>

        {/* C. Benchmark legend */}
        <div className="flex flex-wrap gap-6 text-xs" style={{ color: B.muted }}>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">RPE:</span>
            <span style={{ color: '#f87171' }}>🔴 &lt;$70K Low</span>
            <span style={{ color: '#fbbf24' }}>🟡 $70K–$100K Healthy</span>
            <span style={{ color: '#4ade80' }}>🟢 &gt;$100K Strong</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">Comp Ratio:</span>
            <span style={{ color: '#4ade80' }}>🟢 ≤40% Elite</span>
            <span style={{ color: '#fbbf24' }}>🟡 40–50% Healthy</span>
            <span style={{ color: '#f87171' }}>🔴 &gt;50% Watch Zone</span>
          </div>
        </div>
      </section>

      {/* ── Section 3: Sentiment Analysis Placeholder ───────────────────── */}
      <section>
        <h2 className="text-base font-semibold mb-4" style={{ color: B.p4 }}>
          Employee Sentiment Analysis
        </h2>

        {/* Coming Soon Banner */}
        <div
          className="rounded-xl p-5 mb-5"
          style={{ backgroundColor: B.elevated, border: `1px dashed ${B.p2}` }}
        >
          <div className="flex items-start gap-4">
            <div className="text-3xl">🔬</div>
            <div>
              <p className="text-white font-semibold mb-1">Coming Soon</p>
              <p style={{ color: B.muted }} className="text-sm leading-relaxed">
                Employee sentiment analysis will use Zoom transcript data and Slack channel activity
                to track engagement trends, contribution patterns, and early warning signals.
                Source: Internal Zoom meetings (hosted by Lada/Carmella) + Slack channel messages.
              </p>
            </div>
          </div>
        </div>

        {/* Greyed-out planned metric cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {PLANNED_METRICS.map((m) => (
            <div
              key={m.title}
              className="rounded-xl p-4"
              style={{
                backgroundColor: '#0d0d0d',
                border: `1px solid #1c1c2e`,
                opacity: 0.5,
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{m.icon}</span>
                <span className="text-sm font-semibold text-gray-400">{m.title}</span>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">{m.description}</p>
              <div className="mt-3">
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#1a1a2e', color: '#4a4a6a' }}>
                  Data pipeline not yet built
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  )
}
