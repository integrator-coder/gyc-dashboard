'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

// ── Formatters ────────────────────────────────────────────────────────────────

function fmt$( v) {
  if (v == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(v))
}

function fmtDate(v) {
  if (!v) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(v))
}

// ── Badges ────────────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  active:      'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  onboarding:  'bg-blue-500/15 text-blue-300 border-blue-500/30',
  paused:      'bg-amber-500/15 text-amber-300 border-amber-500/30',
  cancelled:   'bg-rose-500/15 text-rose-300 border-rose-500/30',
}

function StatusBadge({ status }) {
  const s = String(status || '').toLowerCase()
  const cls = STATUS_COLORS[s] || 'bg-gray-500/15 text-gray-300 border-gray-500/30'
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {s || 'unknown'}
    </span>
  )
}

function TrendBadge({ trend }) {
  if (!trend) return <span className="text-gray-500">—</span>
  if (trend === 'up')     return <span className="text-emerald-400 font-semibold">↑ up</span>
  if (trend === 'down')   return <span className="text-rose-400 font-semibold">↓ down</span>
  if (trend === 'stable') return <span className="text-gray-400">→ stable</span>
  return <span className="text-gray-500">—</span>
}

function ServiceBadges({ client }) {
  const badges = []
  if (client.hasWebsite)    badges.push({ icon: '🌐', label: 'Web' })
  if (client.hasSEO)        badges.push({ icon: '📈', label: 'SEO' })
  if (client.hasCRM)        badges.push({ icon: '🤝', label: 'CRM' })
  if (client.hasBlueprint)  badges.push({ icon: '📊', label: 'Blueprint' })
  if (client.hasGoogleAds)  badges.push({ icon: '📢', label: 'Ads' })
  if (client.hasPaidMedia)  badges.push({ icon: '💰', label: 'Paid' })

  if (!badges.length) return <span className="text-gray-600 text-xs">—</span>
  return (
    <div className="flex flex-wrap gap-1">
      {badges.map(({ icon, label }) => (
        <span
          key={label}
          title={label}
          className="inline-flex items-center gap-0.5 rounded border border-[var(--brand-border)] bg-black/30 px-1.5 py-0.5 text-[11px] text-gray-300"
        >
          <span>{icon}</span>
        </span>
      ))}
    </div>
  )
}

function HealthDot({ score }) {
  const color = score >= 8 ? 'bg-emerald-400' : score >= 5 ? 'bg-amber-400' : 'bg-rose-400'
  return (
    <span title={`Health: ${score}/10`} className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />
  )
}

// ── Stat Cards ────────────────────────────────────────────────────────────────

function StatsBar({ total, totalMrr, overdueCount, trendDownCount }) {
  const stats = [
    { label: 'Clients shown', value: total.toLocaleString() },
    { label: 'Total MRR', value: fmt$(totalMrr) },
    { label: 'Overdue', value: overdueCount.toLocaleString(), warn: overdueCount > 0 },
    { label: 'Trending ↓', value: trendDownCount.toLocaleString(), warn: trendDownCount > 0 },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map(({ label, value, warn }) => (
        <div key={label} className="rounded-2xl border border-[var(--brand-border)] bg-black/25 px-4 py-3">
          <div className="text-[11px] uppercase tracking-wider text-gray-400">{label}</div>
          <div className={`mt-1.5 text-xl font-bold ${warn ? 'text-rose-300' : 'text-white'}`}>{value}</div>
        </div>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

const GA_OPTIONS = ['All GAs', 'Sebastian', 'Stefen', 'JC', 'Zu', 'Briana', 'Lex', 'Travis']
const STATUS_OPTIONS = ['All Statuses', 'active', 'onboarding', 'paused', 'cancelled']
const SERVICE_OPTIONS = [
  { label: 'All Services', value: '' },
  { label: '🌐 Has Website', value: 'website' },
  { label: '📈 Has SEO', value: 'seo' },
  { label: '📊 Has Blueprint', value: 'blueprint' },
  { label: '🤝 Has CRM', value: 'crm' },
  { label: '📢 Google Ads', value: 'google_ads' },
  { label: '💰 Paid Media', value: 'paid_media' },
]
const SORT_OPTIONS = [
  { label: 'Company Name', value: 'companyName' },
  { label: 'MRR (High→Low)', value: 'mrr' },
  { label: 'Growth Advisor', value: 'assignedGA' },
  { label: 'Funnel Trend', value: 'funnelTrend' },
]

function FilterSelect({ value, onChange, options, className = '' }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-xl border border-[var(--brand-border)] bg-black/40 px-3 py-2 text-sm text-gray-200 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30 ${className}`}
    >
      {options.map((opt) => {
        if (typeof opt === 'string') return <option key={opt} value={opt}>{opt}</option>
        return <option key={opt.value} value={opt.value}>{opt.label}</option>
      })}
    </select>
  )
}

export default function ActiveClientList({ user }) {
  const router = useRouter()
  const [clients, setClients] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filters
  const [search, setSearch] = useState('')
  const [ga, setGa] = useState('All GAs')
  const [status, setStatus] = useState('All Statuses')
  const [service, setService] = useState('')
  const [overdue, setOverdue] = useState(false)
  const [sort, setSort] = useState('companyName')

  // Debounce search
  const searchTimer = useRef(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(searchTimer.current)
  }, [search])

  // Build query string
  const queryString = useMemo(() => {
    const p = new URLSearchParams()
    if (debouncedSearch) p.set('search', debouncedSearch)
    if (ga !== 'All GAs') p.set('ga', ga)
    if (status !== 'All Statuses') p.set('status', status)
    if (service) p.set('service', service)
    if (overdue) p.set('overdue', 'true')
    p.set('sort', sort)
    p.set('page', String(page))
    p.set('limit', '50')
    return p.toString()
  }, [debouncedSearch, ga, status, service, overdue, sort, page])

  const loadClients = useCallback(async (qs) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/clients/list?${qs}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load clients.')
      setClients(json.clients || [])
      setTotal(json.total || 0)
      setTotalPages(json.totalPages || 1)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Reload on filter change; reset page to 1 when filters change (not page itself)
  const filtersKey = useMemo(
    () => JSON.stringify({ debouncedSearch, ga, status, service, overdue, sort }),
    [debouncedSearch, ga, status, service, overdue, sort]
  )
  const prevFiltersKey = useRef(filtersKey)

  useEffect(() => {
    if (prevFiltersKey.current !== filtersKey) {
      setPage(1)
      prevFiltersKey.current = filtersKey
    }
  }, [filtersKey])

  useEffect(() => {
    loadClients(queryString)
  }, [queryString, loadClients])

  // Stats
  const totalMrr = useMemo(() => clients.reduce((sum, c) => sum + (c.mrr || 0), 0), [clients])
  const overdueCount = useMemo(() => clients.filter((c) => c.isOverdue).length, [clients])
  const trendDownCount = useMemo(() => clients.filter((c) => c.funnelTrend === 'down').length, [clients])

  const isPIF = (client) =>
    client.serviceList?.some?.((s) => String(s).toLowerCase().includes('pif')) ||
    client.stripeStatus === 'pif'

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-violet-300">Client Management</div>
          <h1 className="mt-2 text-3xl font-bold text-white">Active Clients</h1>
          <p className="mt-1 text-sm text-gray-400">
            {user?.role === 'ga'
              ? 'Your assigned clients — click any row to open the full client card.'
              : '389 clients. Click any row for the full profile.'}
          </p>
        </div>
        <button
          onClick={() => loadClients(queryString)}
          className="self-start rounded-xl border border-[var(--brand-border)] px-4 py-2 text-sm font-medium text-gray-300 transition hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-white"
        >
          Refresh
        </button>
      </div>

      {/* Filter bar */}
      <div className="rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-bg-card)] p-5 shadow-[0_0_0_1px_rgba(115,20,148,0.08)]">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search name or acronym…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-[200px] flex-1 rounded-xl border border-[var(--brand-border)] bg-black/40 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30"
          />
          <FilterSelect value={ga} onChange={setGa} options={GA_OPTIONS} />
          <FilterSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} />
          <FilterSelect
            value={service}
            onChange={setService}
            options={SERVICE_OPTIONS}
          />
          <FilterSelect
            value={sort}
            onChange={setSort}
            options={SORT_OPTIONS}
          />
          <button
            onClick={() => setOverdue((v) => !v)}
            className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
              overdue
                ? 'border-rose-500/50 bg-rose-500/15 text-rose-300'
                : 'border-[var(--brand-border)] text-gray-300 hover:border-rose-500/30 hover:text-rose-300'
            }`}
          >
            {overdue ? '🔴 Overdue only' : 'All (incl. overdue)'}
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <StatsBar
        total={total}
        totalMrr={totalMrr}
        overdueCount={overdueCount}
        trendDownCount={trendDownCount}
      />

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-bg-card)] shadow-[0_0_0_1px_rgba(115,20,148,0.08)]">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--brand-border)]">
                {['Client', 'GA', 'Services', 'MRR', 'Funnel', 'Status', '⚠'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <span className="animate-spin text-violet-400">⟳</span>
                      Loading clients…
                    </div>
                  </td>
                </tr>
              ) : clients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-gray-500">
                    No clients match these filters.
                  </td>
                </tr>
              ) : (
                clients.map((client) => (
                  <tr
                    key={client.id}
                    onClick={() => router.push(`/clients/${client.acronym}`)}
                    className="cursor-pointer border-b border-[var(--brand-border)] transition hover:bg-violet-500/5"
                  >
                    {/* Client */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <HealthDot score={client.healthScore} />
                        <div>
                          <div className="font-bold text-white">{client.acronym}</div>
                          <div className="text-xs text-gray-400">{client.companyName || '—'}</div>
                        </div>
                      </div>
                    </td>

                    {/* GA */}
                    <td className="px-4 py-3.5 text-gray-300">{client.assignedGA || '—'}</td>

                    {/* Services */}
                    <td className="px-4 py-3.5">
                      <ServiceBadges client={client} />
                    </td>

                    {/* MRR */}
                    <td className="px-4 py-3.5 font-medium text-white">
                      {isPIF(client) ? (
                        <span className="rounded-full border border-violet-500/40 bg-violet-500/15 px-2.5 py-0.5 text-xs font-semibold text-violet-300">PIF</span>
                      ) : client.mrr ? (
                        fmt$(client.mrr)
                      ) : '—'}
                    </td>

                    {/* Funnel trend */}
                    <td className="px-4 py-3.5">
                      <TrendBadge trend={client.funnelTrend} />
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <StatusBadge status={client.status} />
                    </td>

                    {/* Overdue */}
                    <td className="px-4 py-3.5">
                      {client.isOverdue ? (
                        <span title={`Overdue $${client.overdueAmount || 0}`} className="text-base">🔴</span>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--brand-border)] px-4 py-3">
            <div className="text-xs text-gray-400">
              Page {page} of {totalPages} ({total.toLocaleString()} total)
            </div>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-[var(--brand-border)] px-3 py-1.5 text-xs text-gray-300 disabled:opacity-40 hover:enabled:bg-violet-500/10"
              >
                ← Prev
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-[var(--brand-border)] px-3 py-1.5 text-xs text-gray-300 disabled:opacity-40 hover:enabled:bg-violet-500/10"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
