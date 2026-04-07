'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  card:    '#111111',
  border:  '#2a1a3e',
  muted:   '#9ca3af',
  bg:      '#0a0a0a',
  purple:  '#AE2BCF',
  teal:    '#14b8a6',
  green:   '#22c55e',
  yellow:  '#f59e0b',
  red:     '#ef4444',
  blue:    '#3b82f6',
}

// ─── Status config ─────────────────────────────────────────────────────────────
const STATUS_META = {
  'document.draft':              { label: 'Draft',            color: C.muted  },
  'document.sent':               { label: 'Sent',             color: C.blue   },
  'document.viewed':             { label: 'Viewed',           color: '#8b5cf6' },
  'document.waiting_approval':   { label: 'Pending Approval', color: C.yellow },
  'document.approved':           { label: 'Approved',         color: C.teal   },
  'document.waiting_pay':        { label: 'Waiting Payment',  color: C.yellow },
  'document.completed':          { label: 'Signed',           color: C.green  },
  'document.paid':               { label: 'Signed & Paid',    color: C.green  },
  'document.voided':             { label: 'Voided',           color: C.red    },
  'document.expired':            { label: 'Expired',          color: C.red    },
  'document.rejected':           { label: 'Rejected',         color: C.red    },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt$(n) {
  if (n == null || n === '') return '—'
  const num = typeof n === 'string' ? parseFloat(n) : n
  if (isNaN(num)) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(num)
}

function fmtShort$(n) {
  if (n == null || n === '') return '—'
  const num = typeof n === 'string' ? parseFloat(n) : n
  if (isNaN(num)) return '—'
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000)     return `$${(num / 1_000).toFixed(1)}K`
  return fmt$(num)
}

function fmtDate(str) {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function timeAgo(str) {
  if (!str) return 'never'
  const diff = Date.now() - new Date(str).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 2)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status, color: C.muted }
  return (
    <span style={{
      background: `${meta.color}22`,
      color: meta.color,
      border: `1px solid ${meta.color}55`,
      borderRadius: '9999px',
      padding: '2px 10px',
      fontSize: '11px',
      fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      {meta.label}
    </span>
  )
}

function KpiCard({ title, value, sub, icon, accent }) {
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${accent ? accent + '55' : C.border}`,
      borderRadius: '12px',
      padding: '16px 20px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div>
          <p style={{ color: C.muted, fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>{title}</p>
          <p style={{ color: accent || 'white', fontSize: '24px', fontWeight: 700, marginTop: 4, marginBottom: 0, lineHeight: 1 }}>{value}</p>
          {sub && <p style={{ color: C.muted, fontSize: '11px', marginTop: 6, marginBottom: 0 }}>{sub}</p>}
        </div>
        <span style={{ fontSize: '22px', opacity: 0.7 }}>{icon}</span>
      </div>
    </div>
  )
}

function FilterBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      background: active ? C.purple : 'transparent',
      color: active ? 'white' : C.muted,
      border: `1px solid ${active ? C.purple : C.border}`,
      borderRadius: '8px',
      padding: '5px 14px',
      fontSize: '12px',
      fontWeight: active ? 600 : 400,
      cursor: 'pointer',
      transition: 'all 0.15s',
      whiteSpace: 'nowrap',
    }}>
      {children}
    </button>
  )
}

function SortHeader({ label, field, sortBy, sortDir, onSort }) {
  const active = sortBy === field
  return (
    <th
      onClick={() => onSort(field)}
      style={{
        color: active ? C.purple : C.muted,
        cursor: 'pointer',
        padding: '10px 14px',
        textAlign: 'left',
        fontSize: '11px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
        userSelect: 'none',
      }}
    >
      {label}
      {active && <span style={{ marginLeft: 4 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>}
    </th>
  )
}

// Custom tooltip for charts
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#1a0d2b', border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px' }}>
      <p style={{ color: 'white', fontWeight: 600, margin: '0 0 6px', fontSize: 13 }}>{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color, margin: '2px 0', fontSize: 12 }}>
          {p.name}: {p.name.includes('Amount') || p.name.includes('Value') ? fmt$(p.value) : p.value}
        </p>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
const PERIODS = [
  { value: 'this_month',    label: 'This Month' },
  { value: 'last_month',    label: 'Last Month' },
  { value: 'this_quarter',  label: 'This Quarter' },
  { value: 'ytd',           label: 'YTD' },
  { value: 'custom',        label: 'Custom' },
]

export default function AgreementsPage() {
  const [data,      setData]      = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [period,    setPeriod]    = useState('this_month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo,   setCustomTo]   = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [sortBy,    setSortBy]    = useState('sentDate')
  const [sortDir,   setSortDir]   = useState('desc')
  const [statusFilter, setStatusFilter] = useState('all')

  const load = useCallback(async (opts = {}) => {
    const p   = opts.period     ?? period
    const cf  = opts.customFrom ?? customFrom
    const ct  = opts.customTo   ?? customTo

    setLoading(true)
    setError(null)

    let url = `/api/metrics/agreements?period=${p}`
    if (p === 'custom' && cf && ct) url += `&from=${cf}&to=${ct}`

    try {
      const res  = await fetch(url, { cache: 'no-store' })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [period, customFrom, customTo])

  useEffect(() => { load() }, [load])

  function handlePeriod(v) {
    const isCustom = v === 'custom'
    setShowCustom(isCustom)
    setPeriod(v)
    if (!isCustom) load({ period: v })
  }

  function handleCustomApply() {
    if (customFrom && customTo) load({ period: 'custom', customFrom, customTo })
  }

  function handleSort(field) {
    const dir = sortBy === field && sortDir === 'desc' ? 'asc' : 'desc'
    setSortBy(field)
    setSortDir(dir)
  }

  // Client-side sort + filter
  const rows = useMemo(() => {
    if (!data?.agreements) return []
    let arr = [...data.agreements]

    // Status filter
    if (statusFilter === 'sent')   arr = arr.filter(r => r.sentStatus === 'sent')
    if (statusFilter === 'signed') arr = arr.filter(r => r.sentStatus === 'signed')

    // Sort
    arr.sort((a, b) => {
      let av = a[sortBy], bv = b[sortBy]
      if (av == null) av = sortDir === 'asc' ? Infinity : -Infinity
      if (bv == null) bv = sortDir === 'asc' ? Infinity : -Infinity
      if (typeof av === 'string' && typeof bv === 'string') {
        av = av.toLowerCase(); bv = bv.toLowerCase()
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      return sortDir === 'asc' ? av - bv : bv - av
    })

    return arr
  }, [data, sortBy, sortDir, statusFilter])

  const kpis = data

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ color: 'white', fontSize: 24, fontWeight: 700, margin: 0 }}>Agreements</h1>
          <p style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>
            PandaDoc · {kpis?.periodLabel || ''}
          </p>
        </div>
        <button
          onClick={() => load()}
          disabled={loading}
          style={{
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: '6px 14px',
            fontSize: 12,
            fontWeight: 500,
            color: '#d1d5db',
            background: 'transparent',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.5 : 1,
          }}
        >
          {loading ? 'Loading…' : '↻ Refresh'}
        </button>
      </div>

      {/* Period filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {PERIODS.map(p => (
          <FilterBtn key={p.value} active={period === p.value} onClick={() => handlePeriod(p.value)}>
            {p.label}
          </FilterBtn>
        ))}
      </div>

      {/* Custom date range */}
      {showCustom && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 16px',
        }}>
          <span style={{ color: C.muted, fontSize: 12 }}>From</span>
          <input
            type="date"
            value={customFrom}
            onChange={e => setCustomFrom(e.target.value)}
            style={{ background: '#1a1a1a', border: `1px solid ${C.border}`, color: 'white', borderRadius: 6, padding: '4px 8px', fontSize: 13 }}
          />
          <span style={{ color: C.muted, fontSize: 12 }}>To</span>
          <input
            type="date"
            value={customTo}
            onChange={e => setCustomTo(e.target.value)}
            style={{ background: '#1a1a1a', border: `1px solid ${C.border}`, color: 'white', borderRadius: 6, padding: '4px 8px', fontSize: 13 }}
          />
          <button
            onClick={handleCustomApply}
            disabled={!customFrom || !customTo}
            style={{
              background: C.purple, color: 'white', border: 'none', borderRadius: 6,
              padding: '5px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Apply
          </button>
        </div>
      )}

      {/* Error / Notice */}
      {error && (
        <div style={{ background: '#7f1d1d33', border: `1px solid ${C.red}44`, borderRadius: 10, padding: 16, color: C.red, fontSize: 13 }}>
          ⚠️ {error}
        </div>
      )}
      {data?.notice && (
        <div style={{ background: '#78350f33', border: `1px solid ${C.yellow}44`, borderRadius: 10, padding: 16, color: C.yellow, fontSize: 13 }}>
          ℹ️ {data.notice}
        </div>
      )}

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
        <KpiCard
          title="Sent"
          value={loading ? '…' : (kpis?.agreementsSent ?? '—')}
          sub="Open / pending"
          icon="📤"
        />
        <KpiCard
          title="Signed"
          value={loading ? '…' : (kpis?.agreementsSigned ?? '—')}
          sub="Completed or paid"
          icon="✅"
        />
        <KpiCard
          title="Proposed Value"
          value={loading ? '…' : fmtShort$(kpis?.totalProposedAmount)}
          sub="Sent, not yet signed"
          icon="💼"
        />
        <KpiCard
          title="Closed Value"
          value={loading ? '…' : fmtShort$(kpis?.closedAmount)}
          sub="Signed total"
          icon="🏆"
        />
        <KpiCard
          title="MRR (Signed)"
          value={loading ? '…' : fmtShort$(kpis?.mrr)}
          sub="Monthly recurring"
          icon="🔁"
        />
        <KpiCard
          title="Expired"
          value={loading ? '…' : (kpis?.agreementsExpired ?? '—')}
          sub="Not signed in time"
          icon="⏰"
          accent={C.red}
        />
      </div>

      {/* Charts */}
      {!loading && data?.monthlyData?.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))', gap: 20 }}>

          {/* Chart 1: Proposed vs Closed Value */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 16px' }}>
            <h3 style={{ color: 'white', fontSize: 14, fontWeight: 600, margin: '0 0 16px' }}>
              Proposed vs Closed Value
            </h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.monthlyData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a1a3e" />
                <XAxis dataKey="month" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => fmtShort$(v)} tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={60} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: C.muted }} />
                <Bar dataKey="proposedAmount" name="Proposed Value" fill={C.purple} radius={[3, 3, 0, 0]} />
                <Bar dataKey="closedAmount"   name="Closed Value"   fill={C.teal}   radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Chart 2: Sent vs Signed count */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 16px' }}>
            <h3 style={{ color: 'white', fontSize: 14, fontWeight: 600, margin: '0 0 16px' }}>
              Agreements Sent vs Signed
            </h3>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data.monthlyData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a1a3e" />
                <XAxis dataKey="month" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={30} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: C.muted }} />
                <Line type="monotone" dataKey="sent"    name="Sent"    stroke={C.purple} strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="signed"  name="Signed"  stroke={C.teal}   strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="expired" name="Expired" stroke={C.red}    strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Table controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {[
          { v: 'all',    l: 'All' },
          { v: 'sent',   l: 'Sent / Open' },
          { v: 'signed', l: 'Signed' },
        ].map(f => (
          <FilterBtn key={f.v} active={statusFilter === f.v} onClick={() => setStatusFilter(f.v)}>
            {f.l}
          </FilterBtn>
        ))}
        <span style={{ color: C.muted, fontSize: 12, marginLeft: 8 }}>
          {rows.length} agreement{rows.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <p style={{ color: C.muted, padding: 24, textAlign: 'center', fontSize: 13 }}>Loading…</p>
        ) : rows.length === 0 ? (
          <p style={{ color: C.muted, padding: 24, textAlign: 'center', fontSize: 13 }}>No agreements found for this period.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <SortHeader label="Name"        field="name"          sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortHeader label="Owner"       field="ownerName"     sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortHeader label="Recipient"   field="recipientName" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortHeader label="Status"      field="status"        sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortHeader label="Sent Date"   field="sentDate"      sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortHeader label="Signed Date" field="signedDate"    sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortHeader label="Amount"      field="amount"        sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortHeader label="MRR"         field="mrr"           sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={row.id}
                    style={{
                      borderBottom: i < rows.length - 1 ? `1px solid ${C.border}` : 'none',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '10px 14px', maxWidth: 260 }}>
                      <a
                        href={`https://app.pandadoc.com/a/#/documents/${row.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={row.name}
                        style={{
                          color: C.purple,
                          textDecoration: 'none',
                          fontWeight: 500,
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {row.name}
                      </a>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#d1d5db', whiteSpace: 'nowrap' }}>
                      {row.ownerName || '—'}
                    </td>
                    <td style={{ padding: '10px 14px', maxWidth: 200 }}>
                      <div style={{ color: '#d1d5db', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.recipientName || '—'}
                      </div>
                      {row.recipientEmail && (
                        <div style={{ color: C.muted, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.recipientEmail}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                      <StatusBadge status={row.status} />
                    </td>
                    <td style={{ padding: '10px 14px', color: C.muted, whiteSpace: 'nowrap', fontSize: 12 }}>
                      {fmtDate(row.sentDate)}
                    </td>
                    <td style={{ padding: '10px 14px', color: C.muted, whiteSpace: 'nowrap', fontSize: 12 }}>
                      {fmtDate(row.signedDate)}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'white', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {fmt$(row.amount)}
                    </td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: row.mrr ? C.green : C.muted }}>
                      {row.mrr ? fmt$(row.mrr) + '/mo' : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer */}
      <p style={{ color: '#4a3060', fontSize: 12, margin: 0 }}>
        {data?.syncedAt ? `Last synced: ${timeAgo(data.syncedAt)} · ` : ''}
        {data?.durationMs != null ? `${data.durationMs}ms` : ''}
      </p>
    </div>
  )
}
