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

  useEffect(() => {
    fetchData()
  }, [fetchData])

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

  const monthlyPayroll = data?.config?.monthlyPayroll ?? 132500
  const impliedHeadcount = data?.computed?.impliedHeadcount ?? 18.5
  const rpe = data?.computed?.rpe ?? null
  const mrr = data?.computed?.mrr ?? 0

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
                Monthly Payroll
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
                  <span className="text-2xl font-bold text-white">{formatCurrency(monthlyPayroll)}<span className="text-base font-normal text-gray-500">/mo</span></span>
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

      {/* ── Section 2: Sentiment Analysis Placeholder ───────────────────── */}
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
              <p className="text-xs text-gray-600 leading-relaxed">{m.description}</p>
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
