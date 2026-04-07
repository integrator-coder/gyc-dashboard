'use client'

import { useEffect, useState, useCallback } from 'react'

const B = {
  card: '#111111',
  border: '#2a1a3e',
  muted: '#9ca3af',
  elevated: '#1a1a1a',
  p2: '#731494',
  p4: '#AE2BCF',
}

const PERIODS = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'q1', label: 'Q1' },
  { value: 'q2', label: 'Q2' },
  { value: 'q3', label: 'Q3' },
  { value: 'q4', label: 'Q4' },
  { value: 'ytd', label: 'YTD' },
  { value: 'last_30', label: 'Last 30d' },
  { value: 'last_90', label: 'Last 90d' },
]

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'sent', label: 'Sent / Open' },
  { value: 'signed', label: 'Signed' },
]

const SORT_COLS = [
  { value: 'createdAt',   label: 'Created' },
  { value: 'completedAt', label: 'Signed Date' },
  { value: 'amount',      label: 'Amount' },
  { value: 'mrr',         label: 'MRR' },
  { value: 'name',        label: 'Name' },
  { value: 'status',      label: 'Status' },
]

const STATUS_LABELS = {
  'document.draft':              { label: 'Draft',            color: '#6b7280' },
  'document.sent':               { label: 'Sent',             color: '#3b82f6' },
  'document.viewed':             { label: 'Viewed',           color: '#8b5cf6' },
  'document.waiting_approval':   { label: 'Pending Approval', color: '#f59e0b' },
  'document.approved':           { label: 'Approved',         color: '#10b981' },
  'document.waiting_pay':        { label: 'Waiting Payment',  color: '#f59e0b' },
  'document.completed':          { label: 'Signed',           color: '#22c55e' },
  'document.paid':               { label: 'Signed & Paid',    color: '#22c55e' },
  'document.voided':             { label: 'Voided',           color: '#ef4444' },
  'document.expired':            { label: 'Expired',          color: '#ef4444' },
  'document.rejected':           { label: 'Rejected',         color: '#ef4444' },
}

function fmt$(n) {
  if (!n && n !== 0) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function fmtDate(str) {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function StatusBadge({ status }) {
  const info = STATUS_LABELS[status] || { label: status, color: B.muted }
  return (
    <span style={{ background: `${info.color}22`, color: info.color, border: `1px solid ${info.color}55`, borderRadius: '9999px', padding: '2px 10px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' }}>
      {info.label}
    </span>
  )
}

function KpiCard({ title, value, subtitle, icon }) {
  return (
    <div style={{ background: B.card, border: `1px solid ${B.border}`, borderRadius: '12px', padding: '16px 20px' }}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p style={{ color: B.muted, fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</p>
          <p style={{ color: 'white', fontSize: '24px', fontWeight: 700, marginTop: '4px', lineHeight: 1 }}>{value}</p>
          {subtitle && <p style={{ color: B.muted, fontSize: '11px', marginTop: '6px' }}>{subtitle}</p>}
        </div>
        <span style={{ fontSize: '22px', opacity: 0.7 }}>{icon}</span>
      </div>
    </div>
  )
}

function FilterBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{ background: active ? B.p2 : 'transparent', color: active ? 'white' : B.muted, border: `1px solid ${active ? B.p4 : B.border}`, borderRadius: '8px', padding: '5px 12px', fontSize: '12px', fontWeight: active ? 600 : 400, cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
      {children}
    </button>
  )
}

function SortBtn({ col, current, dir, onClick }) {
  const active = current === col.value
  return (
    <button onClick={() => onClick(col.value)} style={{ background: active ? '#1a1a2e' : 'transparent', color: active ? '#AE2BCF' : B.muted, border: `1px solid ${active ? B.p2 : B.border}`, borderRadius: '6px', padding: '4px 10px', fontSize: '11px', fontWeight: active ? 600 : 400, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
      {col.label}
      {active && <span>{dir === 'desc' ? '↓' : '↑'}</span>}
    </button>
  )
}

export default function AgreementsPage() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [period, setPeriod]   = useState('this_month')
  const [filter, setFilter]   = useState('all')
  const [sortBy, setSortBy]   = useState('createdAt')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage]       = useState(1)

  const fetchData = useCallback(async (opts = {}) => {
    setLoading(true)
    setError(null)
    const p  = opts.period  ?? period
    const f  = opts.filter  ?? filter
    const s  = opts.sortBy  ?? sortBy
    const d  = opts.sortDir ?? sortDir
    const pg = opts.page    ?? page
    try {
      const res = await fetch(`/api/metrics/agreements-db?period=${p}&status=${f}&sort=${s}&dir=${d}&page=${pg}`, { cache: 'no-store' })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [period, filter, sortBy, sortDir, page])

  useEffect(() => { fetchData() }, [fetchData])

  function changePeriod(v) { setPeriod(v); setPage(1); fetchData({ period: v, page: 1 }) }
  function changeFilter(v) { setFilter(v); setPage(1); fetchData({ filter: v, page: 1 }) }
  function changeSort(col) {
    const newDir = sortBy === col && sortDir === 'desc' ? 'asc' : 'desc'
    setSortBy(col); setSortDir(newDir); setPage(1)
    fetchData({ sortBy: col, sortDir: newDir, page: 1 })
  }
  function changePage(p) { setPage(p); fetchData({ page: p }) }

  const kpis = data?.kpis
  const rows = data?.rows || []
  const pg   = data?.pagination

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Agreements</h1>
          <p style={{ color: B.muted }} className="text-sm mt-1">
            PandaDoc · synced every 3h
            {kpis?.lastSynced && (
              <span> · Last sync: {fmtDate(kpis.lastSynced)}</span>
            )}
          </p>
        </div>
        <button onClick={() => fetchData()} disabled={loading} style={{ border: `1px solid ${B.border}` }}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-300 hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-white disabled:opacity-50 transition">
          {loading ? 'Loading…' : '↻ Refresh'}
        </button>
      </div>

      {/* Period filters */}
      <div className="flex flex-wrap gap-2">
        {PERIODS.map(p => (
          <FilterBtn key={p.value} active={period === p.value} onClick={() => changePeriod(p.value)}>
            {p.label}
          </FilterBtn>
        ))}
      </div>

      {/* Period label */}
      {data?.periodLabel && (
        <p style={{ color: '#6b5a8a', fontSize: '12px' }}>{data.periodLabel}</p>
      )}

      {/* Error / Notice */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-400 text-sm">⚠️ {error}</div>
      )}
      {data?.notice && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-yellow-300 text-sm">ℹ️ {data.notice}</div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard title="Agreements Sent"  value={loading ? '…' : kpis?.sentCount ?? '—'}        subtitle="Open / pending"      icon="📤" />
        <KpiCard title="Agreements Signed" value={loading ? '…' : kpis?.signedCount ?? '—'}      subtitle="Completed or paid"   icon="✅" />
        <KpiCard title="Proposed Value"   value={loading ? '…' : fmt$(kpis?.proposedValue)}      subtitle="Sent, not yet signed" icon="💼" />
        <KpiCard title="Closed Value"     value={loading ? '…' : fmt$(kpis?.closedValue)}        subtitle="Signed total"        icon="🏆" />
        <KpiCard title="MRR (Signed)"     value={loading ? '…' : kpis?.totalMrr ? fmt$(kpis.totalMrr) : '—'} subtitle="Monthly recurring"  icon="🔁" />
      </div>

      {/* Table controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status filter */}
        <div className="flex gap-1">
          {STATUS_FILTERS.map(f => (
            <FilterBtn key={f.value} active={filter === f.value} onClick={() => changeFilter(f.value)}>
              {f.label}
            </FilterBtn>
          ))}
        </div>
        <div style={{ color: B.border }}>|</div>
        {/* Sort */}
        <div className="flex items-center gap-1 flex-wrap">
          <span style={{ color: B.muted, fontSize: '11px' }}>Sort:</span>
          {SORT_COLS.map(col => (
            <SortBtn key={col.value} col={col} current={sortBy} dir={sortDir} onClick={changeSort} />
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: B.card, border: `1px solid ${B.border}`, borderRadius: '12px', overflow: 'hidden' }}>
        {loading ? (
          <p style={{ color: B.muted }} className="p-6 text-sm text-center">Loading…</p>
        ) : rows.length === 0 ? (
          <p style={{ color: B.muted }} className="p-6 text-sm text-center">No agreements found for this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: `1px solid ${B.border}` }}>
                  {['Name', 'Status', 'Amount', 'MRR', 'Recipients', 'Created', 'Signed'].map(h => (
                    <th key={h} style={{ color: B.muted }} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.docId} style={{ borderBottom: i < rows.length - 1 ? `1px solid ${B.border}` : 'none' }}
                    className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-white font-medium max-w-[240px] truncate">
                      <a href={`https://app.pandadoc.com/a/#/documents/${row.docId}`} target="_blank" rel="noopener noreferrer"
                        style={{ color: '#AE2BCF' }} className="hover:underline" title={row.name}>
                        {row.name}
                      </a>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                    <td className="px-4 py-3 text-white font-medium whitespace-nowrap">{fmt$(row.amount)}</td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: row.mrr ? '#22c55e' : B.muted }}>{row.mrr ? fmt$(row.mrr) + '/mo' : '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-[180px] truncate">{(row.recipients || []).join(', ') || '—'}</td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{fmtDate(row.createdAt)}</td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{fmtDate(row.completedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pg && pg.totalPages > 1 && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p style={{ color: B.muted, fontSize: '12px' }}>
            {pg.total} agreements · Page {pg.page} of {pg.totalPages}
          </p>
          <div className="flex gap-2">
            <button onClick={() => changePage(pg.page - 1)} disabled={pg.page <= 1}
              style={{ border: `1px solid ${B.border}`, borderRadius: '6px', padding: '4px 12px', color: B.muted, fontSize: '12px', background: 'transparent', cursor: 'pointer' }}
              className="disabled:opacity-30">
              ← Prev
            </button>
            <button onClick={() => changePage(pg.page + 1)} disabled={pg.page >= pg.totalPages}
              style={{ border: `1px solid ${B.border}`, borderRadius: '6px', padding: '4px 12px', color: B.muted, fontSize: '12px', background: 'transparent', cursor: 'pointer' }}
              className="disabled:opacity-30">
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      {data && (
        <p style={{ color: '#4a3060' }} className="text-xs">
          {pg?.total ?? 0} total · {data.durationMs}ms
        </p>
      )}
    </div>
  )
}
