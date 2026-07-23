'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

// ── Formatters ─────────────────────────────────────────────────────────────────
function fmt$(n) {
  if (!n && n !== 0) return '—'
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtDuration(secs) {
  if (!secs) return '—'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function fmtDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtMonthYear(month, yearLabel) {
  if (!month || !yearLabel) return '—'
  return `${month} ${yearLabel}`
}

// ── Badge Components ────────────────────────────────────────────────────────────
function PIFBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-emerald-900 border border-emerald-700 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
      💰 PIF
    </span>
  )
}

function MRRBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-blue-900 border border-blue-700 px-2.5 py-0.5 text-xs font-semibold text-blue-300">
      📅 MRR
    </span>
  )
}

function DealTypeBadge({ type }) {
  const isUpsell = type === 'Upsell'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
      isUpsell
        ? 'bg-violet-900 border-violet-700 text-violet-300'
        : 'bg-teal-900 border-teal-700 text-teal-300'
    }`}>
      {isUpsell ? '⬆️ Upsell' : '🆕 New Sale'}
    </span>
  )
}

// ── External Link Button ────────────────────────────────────────────────────────
function ExternalLink({ href, label, emoji, dim }) {
  if (!href) return null
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors hover:border-gray-500 hover:text-white ${
        dim
          ? 'border-gray-700 text-gray-500 hover:bg-gray-800'
          : 'border-gray-600 text-gray-300 hover:bg-gray-700'
      }`}
    >
      <span>{emoji}</span>
      <span>{label}</span>
      <span className="text-[10px] text-gray-600">↗</span>
    </a>
  )
}

// ── Info Row ────────────────────────────────────────────────────────────────────
function InfoRow({ label, value }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-gray-500 w-28 shrink-0">{label}</span>
      <span className="text-xs text-gray-200 break-all">{value}</span>
    </div>
  )
}

// ── Deal Card ───────────────────────────────────────────────────────────────────
function DealCard({ deal }) {
  const [expanded, setExpanded] = useState(false)

  const dateLabel = deal.dealDate
    ? fmtDate(deal.dealDate)
    : fmtMonthYear(deal.month, deal.yearLabel)

  const tcvLabel = deal.tcv ? fmt$(deal.tcv) : (deal.fullTerm ? fmt$(deal.fullTerm) : '—')

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 overflow-hidden transition-shadow hover:shadow-lg hover:shadow-black/40">
      {/* ── Card Header ────────────────────────────────────────────────────── */}
      <div
        className="px-5 py-4 cursor-pointer"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-[rgba(166,111,205,0.4)] to-[rgba(95,53,132,0.9)] text-sm font-bold text-white shadow">
            {(deal.companyName || deal.acronym || '?').slice(0, 2).toUpperCase()}
          </div>

          {/* Main info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h3 className="text-base font-semibold text-white leading-tight truncate">
                {deal.companyName || deal.acronym}
              </h3>
              <span className="text-xs text-gray-500 font-mono">{deal.acronym}</span>
              {deal.pif ? <PIFBadge /> : <MRRBadge />}
              {deal.dealType && <DealTypeBadge type={deal.dealType} />}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
              <span>📅 {dateLabel}</span>
              {deal.rep && <span>👤 {deal.rep}</span>}
              {deal.assignedGA && <span>🌱 {deal.assignedGA}</span>}
              {deal.city && deal.state && <span>📍 {deal.city}, {deal.state}</span>}
            </div>

            {/* Services */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {deal.services.split(' · ').filter(Boolean).map(s => (
                <span
                  key={s}
                  className="inline-flex rounded-lg bg-gray-800 border border-gray-700 px-2 py-0.5 text-xs text-gray-300"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* Financial summary */}
          <div className="text-right shrink-0 space-y-1">
            <div className="text-lg font-bold text-white">
              {deal.pif ? fmt$(deal.firstPayment) : `${fmt$(deal.mrr)}/mo`}
            </div>
            <div className="text-xs text-gray-500">TCV {tcvLabel}</div>
            {deal.term > 0 && (
              <div className="text-xs text-gray-500">
                {Math.round(deal.term)} mo term
              </div>
            )}
          </div>

          {/* Expand toggle */}
          <span className={`text-gray-500 text-xs mt-1 ml-2 transition-transform ${expanded ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </div>
      </div>

      {/* ── Expanded Details ────────────────────────────────────────────────── */}
      {expanded && (
        <div className="border-t border-gray-800 px-5 py-4 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

            {/* Deal Financials */}
            <div className="space-y-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">💵 Financials</h4>
              <InfoRow label="Type" value={deal.pif ? 'Paid in Full (PIF)' : 'Monthly Recurring'} />
              <InfoRow label="First Payment" value={fmt$(deal.firstPayment)} />
              {deal.mrr > 0 && <InfoRow label="MRR" value={fmt$(deal.mrr)} />}
              <InfoRow label="Term" value={deal.term ? `${Math.round(deal.term)} months` : null} />
              {deal.renewalAmount > 0 && <InfoRow label="Renewal / mo" value={fmt$(deal.renewalAmount)} />}
              <InfoRow label="TCV" value={tcvLabel} />
              <InfoRow label="Deal Date" value={deal.dealDate ? fmtDate(deal.dealDate) : fmtMonthYear(deal.month, deal.yearLabel)} />
              {deal.renewalDate && <InfoRow label="Renewal Date" value={fmtDate(deal.renewalDate)} />}
              <InfoRow label="Deal Type" value={deal.dealType} />
            </div>

            {/* Client Info */}
            <div className="space-y-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">🏢 Client</h4>
              <InfoRow label="Company" value={deal.companyName} />
              <InfoRow label="Owner" value={deal.ownerName} />
              <InfoRow label="Email" value={deal.email} />
              <InfoRow label="Phone" value={deal.phone} />
              <InfoRow label="Location" value={[deal.city, deal.state].filter(Boolean).join(', ') || null} />
              {deal.website && (
                <div className="flex items-start gap-2">
                  <span className="text-xs text-gray-500 w-28 shrink-0">Website</span>
                  <a href={deal.website} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline break-all">
                    {deal.website}
                  </a>
                </div>
              )}
              <InfoRow label="Status" value={deal.clientStatus} />
            </div>

            {/* People & Calls */}
            <div className="space-y-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">👥 People & Calls</h4>
              <InfoRow label="Sales Rep" value={deal.rep} />
              <InfoRow label="Growth Advisor" value={deal.assignedGA} />
              {deal.assignedGAEmail && <InfoRow label="GA Email" value={deal.assignedGAEmail} />}
              {deal.callCount > 0 && (
                <>
                  <InfoRow label="Calls to Close" value={String(deal.callCount)} />
                  <InfoRow label="Total Call Time" value={fmtDuration(deal.totalCallSecs)} />
                </>
              )}
            </div>
          </div>

          {/* Links */}
          <div className="pt-2">
            <h4 className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 mb-3">🔗 Links</h4>
            <div className="flex flex-wrap gap-2">
              <ExternalLink href={deal.links.acl}      label="ACL Card"    emoji="📋" />
              <ExternalLink href={deal.links.ghl}      label="GHL Contact" emoji="📞" />
              <ExternalLink href={deal.links.stripe}   label="Stripe"      emoji="💳" />
              {deal.callCount > 0 && (
                <ExternalLink href={`/zoom?client=${deal.acronym}`} label={`Calls (${deal.callCount})`} emoji="🎥" />
              )}
              {deal.hasPandaDoc && (
                <ExternalLink href="/agreements" label="PandaDoc" emoji="📝" />
              )}
              {deal.hasRecon && (
                <ExternalLink href="/team/recon" label="Recon" emoji="🔍" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Filter Bar ──────────────────────────────────────────────────────────────────
function FilterBar({ filters, setFilters, reps, loading }) {
  const inputClass = "rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-gray-500 focus:outline-none"

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* Search */}
      <div className="flex-1 min-w-[200px]">
        <label className="block text-xs text-gray-500 mb-1">Search</label>
        <input
          type="text"
          value={filters.search}
          onChange={e => setFilters(f => ({ ...f, search: e.target.value, page: 1 }))}
          placeholder="Client name, rep, service…"
          className={`w-full ${inputClass}`}
        />
      </div>

      {/* Rep */}
      <div className="min-w-[140px]">
        <label className="block text-xs text-gray-500 mb-1">Rep</label>
        <select
          value={filters.rep}
          onChange={e => setFilters(f => ({ ...f, rep: e.target.value, page: 1 }))}
          className={inputClass}
        >
          <option value="">All reps</option>
          {reps.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {/* PIF/MRR */}
      <div className="min-w-[120px]">
        <label className="block text-xs text-gray-500 mb-1">Type</label>
        <select
          value={filters.pif}
          onChange={e => setFilters(f => ({ ...f, pif: e.target.value, page: 1 }))}
          className={inputClass}
        >
          <option value="">All types</option>
          <option value="true">PIF only</option>
          <option value="false">MRR only</option>
        </select>
      </div>

      {/* Date from */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">From</label>
        <input
          type="date"
          value={filters.from}
          onChange={e => setFilters(f => ({ ...f, from: e.target.value, page: 1 }))}
          className={inputClass}
        />
      </div>

      {/* Date to */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">To</label>
        <input
          type="date"
          value={filters.to}
          onChange={e => setFilters(f => ({ ...f, to: e.target.value, page: 1 }))}
          className={inputClass}
        />
      </div>

      {/* Clear */}
      {(filters.search || filters.rep || filters.pif || filters.from || filters.to) && (
        <button
          onClick={() => setFilters({ search: '', rep: '', pif: '', from: '', to: '', page: 1 })}
          className="px-3 py-2 rounded-lg border border-gray-700 text-xs text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
        >
          Clear
        </button>
      )}

      {loading && (
        <div className="text-xs text-gray-500 pb-2">Loading…</div>
      )}
    </div>
  )
}

// ── Summary Bar ─────────────────────────────────────────────────────────────────
function SummaryBar({ deals, total }) {
  const totalTCV = deals.reduce((s, d) => s + (d.tcv || 0), 0)
  const pifCount = deals.filter(d => d.pif).length
  const mrrCount = deals.length - pifCount
  const totalMRR = deals.filter(d => !d.pif).reduce((s, d) => s + (d.mrr || 0), 0)

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="rounded-xl border border-gray-800 bg-gray-900 px-4 py-3">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Shown / Total</p>
        <p className="text-xl font-bold text-white">{deals.length} <span className="text-sm text-gray-500">/ {total}</span></p>
      </div>
      <div className="rounded-xl border border-gray-800 bg-gray-900 px-4 py-3">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">TCV (shown)</p>
        <p className="text-xl font-bold text-emerald-400">{fmt$(totalTCV)}</p>
      </div>
      <div className="rounded-xl border border-gray-800 bg-gray-900 px-4 py-3">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">PIF Deals</p>
        <p className="text-xl font-bold text-white">{pifCount}</p>
      </div>
      <div className="rounded-xl border border-gray-800 bg-gray-900 px-4 py-3">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">MRR Added</p>
        <p className="text-xl font-bold text-blue-400">{fmt$(totalMRR)}<span className="text-sm text-gray-500">/mo</span></p>
      </div>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────────
export default function ClosedDealsPage() {
  const [filters, setFilters] = useState({
    search: '', rep: '', pif: '', from: '', to: '', page: 1,
  })
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)
  const debounceTimer       = useRef(null)

  const fetchData = useCallback(async (f) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (f.search) params.set('search', f.search)
      if (f.rep)    params.set('rep', f.rep)
      if (f.pif === 'true') params.set('pif', 'true')
      if (f.from)   params.set('from', f.from)
      if (f.to)     params.set('to', f.to)
      params.set('page', String(f.page || 1))

      const res = await fetch(`/api/deals/closed?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounce search field, immediate for other filters
  useEffect(() => {
    clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => fetchData(filters), filters.search ? 350 : 0)
    return () => clearTimeout(debounceTimer.current)
  }, [filters, fetchData])

  const deals = data?.deals || []
  const pagination = data?.pagination || {}
  const reps = data?.reps || []

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">🎉 Closed Deals</h1>
        <p className="text-sm text-gray-400 mt-1">
          Every closed deal — client intel, financials, and links in one place.
          {data?.pagination?.total != null && (
            <span className="ml-2 text-gray-500">{data.pagination.total.toLocaleString()} total deals</span>
          )}
        </p>
      </div>

      {/* Filters */}
      <FilterBar filters={filters} setFilters={setFilters} reps={reps} loading={loading} />

      {/* Summary stats for current view */}
      {deals.length > 0 && <SummaryBar deals={deals} total={pagination.total || 0} />}

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-red-800 bg-red-950 px-4 py-3 text-sm text-red-300">
          Error loading deals: {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && deals.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-800 bg-gray-900 py-16 text-gray-500">
          <span className="text-4xl mb-3">🔍</span>
          <p className="text-sm">No deals found for the current filters.</p>
        </div>
      )}

      {/* Deal feed */}
      <div className="space-y-3">
        {deals.map((deal, i) => (
          <DealCard
            key={`${deal.acronym}-${deal.dealDate || deal.month}-${deal.yearLabel}-${deal.rep}-${i}`}
            deal={deal}
          />
        ))}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            disabled={pagination.page <= 1}
            onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
            className="px-4 py-2 rounded-lg border border-gray-700 text-sm text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← Prev
          </button>
          <span className="text-sm text-gray-500">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
            className="px-4 py-2 rounded-lg border border-gray-700 text-sm text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      )}

      {/* Skeleton loader overlay */}
      {loading && deals.length === 0 && !error && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-2xl border border-gray-800 bg-gray-900 animate-pulse"
            />
          ))}
        </div>
      )}
    </div>
  )
}
