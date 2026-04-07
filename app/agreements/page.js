'use client'

import { useEffect, useState, useCallback } from 'react'
import MetricCard from '@/components/MetricCard'

// ─── Brand palette ────────────────────────────────────────────────────────────
const B = {
  card: '#111111',
  border: '#2a1a3e',
  muted: '#9ca3af',
  elevated: '#1a1a1a',
  p2: '#731494',
  p4: '#AE2BCF',
}

// ─── Period filters ───────────────────────────────────────────────────────────
const PERIODS = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'q1', label: 'Q1' },
  { value: 'q2', label: 'Q2' },
  { value: 'q3', label: 'Q3' },
  { value: 'q4', label: 'Q4' },
  { value: 'ytd', label: 'YTD' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt$(n) {
  if (n === null || n === undefined) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

function fmtDate(str) {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const STATUS_LABELS = {
  'document.draft': { label: 'Draft', color: '#6b7280' },
  'document.sent': { label: 'Sent', color: '#3b82f6' },
  'document.viewed': { label: 'Viewed', color: '#8b5cf6' },
  'document.waiting_approval': { label: 'Pending Approval', color: '#f59e0b' },
  'document.approved': { label: 'Approved', color: '#10b981' },
  'document.waiting_pay': { label: 'Waiting Payment', color: '#f59e0b' },
  'document.completed': { label: 'Signed', color: '#22c55e' },
  'document.paid': { label: 'Signed & Paid', color: '#22c55e' },
  'document.voided': { label: 'Voided', color: '#ef4444' },
  'document.expired': { label: 'Expired', color: '#ef4444' },
  'document.rejected': { label: 'Rejected', color: '#ef4444' },
}

function StatusBadge({ status }) {
  const info = STATUS_LABELS[status] || { label: status, color: B.muted }
  return (
    <span
      style={{
        background: `${info.color}22`,
        color: info.color,
        border: `1px solid ${info.color}55`,
        borderRadius: '9999px',
        padding: '2px 10px',
        fontSize: '11px',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {info.label}
    </span>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AgreementsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [period, setPeriod] = useState('this_month')

  const fetchData = useCallback(async (selectedPeriod) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/metrics/agreements?period=${selectedPeriod}`, { cache: 'no-store' })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(period)
  }, [fetchData, period])

  function handlePeriodChange(val) {
    setPeriod(val)
  }

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Agreements</h1>
          <p style={{ color: B.muted }} className="text-sm mt-1">
            PandaDoc — sent, signed, and revenue tracking
          </p>
        </div>
        <div className="flex items-center gap-3">
          {data?.periodLabel && (
            <p style={{ color: B.muted }} className="text-xs">
              {data.periodLabel}
            </p>
          )}
          <button
            onClick={() => fetchData(period)}
            disabled={loading}
            style={{ border: `1px solid ${B.border}` }}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-300 transition hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-white disabled:opacity-50"
          >
            {loading ? 'Loading…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Period filters */}
      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => {
          const active = period === p.value
          return (
            <button
              key={p.value}
              onClick={() => handlePeriodChange(p.value)}
              style={{
                background: active ? B.p2 : 'transparent',
                color: active ? 'white' : B.muted,
                border: `1px solid ${active ? B.p4 : B.border}`,
                borderRadius: '8px',
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: active ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {p.label}
            </button>
          )
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-400 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <MetricCard
          title="Agreements Sent"
          value={loading ? '…' : data?.agreementsSent ?? '—'}
          subtitle="Sent, viewed, or pending"
          icon="📤"
        />
        <MetricCard
          title="Agreements Signed"
          value={loading ? '…' : data?.agreementsSigned ?? '—'}
          subtitle="Completed or paid"
          icon="✅"
        />
        <MetricCard
          title="Proposed Value"
          value={loading ? '…' : fmt$(data?.totalProposedAmount)}
          subtitle="Sent but not yet signed"
          icon="💼"
        />
        <MetricCard
          title="Closed Value"
          value={loading ? '…' : fmt$(data?.closedAmount)}
          subtitle="Signed agreements total"
          icon="🏆"
        />
        <MetricCard
          title="MRR (from Agreements)"
          value={loading ? '…' : data?.mrr !== null && data?.mrr !== undefined ? fmt$(data?.mrr) : '—'}
          subtitle={
            data?.mrr !== null && data?.mrr !== undefined
              ? `Derived from ${data?.mrrDerivedFromDocs ?? 0} docs`
              : 'No MRR tokens found'
          }
          icon="🔁"
        />
      </div>

      {/* Caveats */}
      {data?.caveats?.length > 0 && (
        <div
          style={{ background: '#1a1a1a', border: `1px solid ${B.border}` }}
          className="rounded-xl p-4 space-y-1"
        >
          <p className="text-xs font-semibold text-violet-300 uppercase tracking-wide mb-2">
            ℹ️ Notes &amp; Caveats
          </p>
          {data.caveats.map((c, i) => (
            <p key={i} style={{ color: B.muted }} className="text-xs">
              • {c}
            </p>
          ))}
        </div>
      )}

      {/* Recent Agreements Table */}
      <div>
        <h2 className="text-base font-semibold text-white mb-3">
          Agreements
          {data?.filteredDocCount !== undefined && !loading && (
            <span style={{ color: B.muted }} className="text-sm font-normal ml-2">
              ({data.filteredDocCount} in period)
            </span>
          )}
        </h2>
        <div
          style={{ background: B.card, border: `1px solid ${B.border}` }}
          className="rounded-xl overflow-hidden"
        >
          {loading ? (
            <p style={{ color: B.muted }} className="p-6 text-sm text-center">
              Loading agreements…
            </p>
          ) : !data?.recentAgreements?.length ? (
            <p style={{ color: B.muted }} className="p-6 text-sm text-center">
              No agreements found for this period.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: `1px solid ${B.border}` }}>
                    {['Name', 'Status', 'Amount', 'Recipients', 'Created', 'Signed / Completed'].map(
                      (h) => (
                        <th
                          key={h}
                          style={{ color: B.muted }}
                          className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap"
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.recentAgreements.map((doc, i) => (
                    <tr
                      key={doc.id}
                      style={{
                        borderBottom:
                          i < data.recentAgreements.length - 1 ? `1px solid ${B.border}` : 'none',
                      }}
                      className="hover:bg-white/5 transition-colors"
                    >
                      <td className="px-4 py-3 text-white font-medium max-w-[220px] truncate">
                        <a
                          href={`https://app.pandadoc.com/a/#/documents/${doc.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#AE2BCF' }}
                          className="hover:underline"
                          title={doc.name}
                        >
                          {doc.name}
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={doc.status} />
                      </td>
                      <td className="px-4 py-3 text-white font-medium whitespace-nowrap">
                        {fmt$(doc.amount)}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs max-w-[180px] truncate">
                        {doc.recipients.join(', ') || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                        {fmtDate(doc.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                        {fmtDate(doc.completedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Footer meta */}
      {data && (
        <p style={{ color: '#4a3060' }} className="text-xs">
          {data.totalDocsFetched} total docs fetched · {data.filteredDocCount} in period · {data.durationMs}ms
        </p>
      )}
    </div>
  )
}
