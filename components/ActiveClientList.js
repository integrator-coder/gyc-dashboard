'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

function fmt$(v) {
  if (v == null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(v))
}

function fmtDate(v) {
  if (!v) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(v))
}

const STATUS_COLORS = {
  active: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  onboarding: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  paused: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  cancelled: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
}

const SERVICE_META = [
  { key: 'hasWebsite', label: 'Website', short: 'Web', icon: '🌐' },
  { key: 'hasSEO', label: 'SEO', short: 'SEO', icon: '📈' },
  { key: 'hasCRM', label: 'CRM', short: 'CRM', icon: '🤝' },
  { key: 'hasBlueprint', label: 'Blueprint', short: 'BP', icon: '📊' },
  { key: 'hasGoogleAds', label: 'Google Ads', short: 'Ads', icon: '📢' },
  { key: 'hasPaidMedia', label: 'Paid Media', short: 'Paid', icon: '💰' },
]

function StatusBadge({ status }) {
  const normalized = String(status || '').toLowerCase()
  const cls = STATUS_COLORS[normalized] || 'bg-gray-500/15 text-gray-300 border-gray-500/30'
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${cls}`}>
      {normalized || 'unknown'}
    </span>
  )
}

function TrendBadge({ trend }) {
  if (!trend) return <span className="text-xs text-gray-500">—</span>
  if (trend === 'up') {
    return <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">↑ Up</span>
  }
  if (trend === 'down') {
    return <span className="inline-flex items-center rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-300">↓ Down</span>
  }
  if (trend === 'stable') {
    return <span className="inline-flex items-center rounded-full border border-gray-500/30 bg-gray-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-300">→ Stable</span>
  }
  return <span className="text-xs text-gray-500">—</span>
}

function HealthPill({ score }) {
  const numericScore = Number(score || 0)
  const tone = numericScore >= 8
    ? 'border-emerald-500/30 bg-emerald-500/12 text-emerald-200'
    : numericScore >= 5
      ? 'border-amber-500/30 bg-amber-500/12 text-amber-200'
      : 'border-rose-500/30 bg-rose-500/12 text-rose-200'

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${tone}`}>
      <span className={`h-2 w-2 rounded-full ${numericScore >= 8 ? 'bg-emerald-400' : numericScore >= 5 ? 'bg-amber-400' : 'bg-rose-400'}`} />
      H {numericScore || '—'}/10
    </span>
  )
}

function ServiceStack({ client }) {
  const active = SERVICE_META.filter((item) => client[item.key])

  if (!active.length) {
    return <span className="text-xs text-gray-500">No mapped services</span>
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {active.slice(0, 4).map((service) => (
        <span
          key={service.key}
          title={service.label}
          className="inline-flex items-center gap-1 rounded-full border border-[var(--brand-border)] bg-black/35 px-2 py-1 text-[10px] font-medium text-gray-200"
        >
          <span>{service.icon}</span>
          <span>{service.short}</span>
        </span>
      ))}
      {active.length > 4 ? (
        <span className="inline-flex items-center rounded-full border border-[var(--brand-border)] bg-black/35 px-2 py-1 text-[10px] font-medium text-gray-300">
          +{active.length - 4}
        </span>
      ) : null}
    </div>
  )
}

function StatsBar({ matched, visible, pageMrr, overdueCount, trendDownCount }) {
  const stats = [
    { label: 'Matched', value: matched.toLocaleString() },
    { label: 'This page', value: visible.toLocaleString() },
    { label: 'Page MRR', value: fmt$(pageMrr) },
    { label: 'Overdue on page', value: overdueCount.toLocaleString(), warn: overdueCount > 0 },
    { label: 'Trend down', value: trendDownCount.toLocaleString(), warn: trendDownCount > 0 },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {stats.map(({ label, value, warn }) => (
        <div key={label} className="rounded-2xl border border-[var(--brand-border)] bg-black/25 px-4 py-3">
          <div className="text-[10px] uppercase tracking-[0.24em] text-gray-400">{label}</div>
          <div className={`mt-1.5 text-lg font-bold ${warn ? 'text-rose-300' : 'text-white'}`}>{value}</div>
        </div>
      ))}
    </div>
  )
}

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

function FilterChip({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-violet-500/25 bg-violet-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-200">
      {children}
    </span>
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

  const [search, setSearch] = useState('')
  const [ga, setGa] = useState('All GAs')
  const [status, setStatus] = useState('All Statuses')
  const [service, setService] = useState('')
  const [overdue, setOverdue] = useState(false)
  const [sort, setSort] = useState('companyName')

  const searchTimer = useRef(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(searchTimer.current)
  }, [search])

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (ga !== 'All GAs') params.set('ga', ga)
    if (status !== 'All Statuses') params.set('status', status)
    if (service) params.set('service', service)
    if (overdue) params.set('overdue', 'true')
    params.set('sort', sort)
    params.set('page', String(page))
    params.set('limit', '75')
    return params.toString()
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

  const pageMrr = useMemo(() => clients.reduce((sum, client) => sum + (client.mrr || 0), 0), [clients])
  const overdueCount = useMemo(() => clients.filter((client) => client.isOverdue).length, [clients])
  const trendDownCount = useMemo(() => clients.filter((client) => client.funnelTrend === 'down').length, [clients])

  const activeFilters = useMemo(() => {
    const chips = []
    if (debouncedSearch) chips.push(`Search: ${debouncedSearch}`)
    if (ga !== 'All GAs') chips.push(`GA: ${ga}`)
    if (status !== 'All Statuses') chips.push(`Status: ${status}`)
    if (service) {
      const found = SERVICE_OPTIONS.find((option) => option.value === service)
      chips.push(found?.label || `Service: ${service}`)
    }
    if (overdue) chips.push('Overdue only')
    if (sort !== 'companyName') {
      const found = SORT_OPTIONS.find((option) => option.value === sort)
      chips.push(`Sort: ${found?.label || sort}`)
    }
    return chips
  }, [debouncedSearch, ga, overdue, service, sort, status])

  const hasActiveFilters = activeFilters.length > 0

  function resetFilters() {
    setSearch('')
    setGa('All GAs')
    setStatus('All Statuses')
    setService('')
    setOverdue(false)
    setSort('companyName')
    setPage(1)
  }

  function openClient(acronym) {
    router.push(`/clients/${acronym}`)
  }

  const roleDescription = user?.role === 'ga'
    ? 'Your assigned clients, arranged for faster triage and scanability.'
    : 'A denser view of the book with faster scanning across status, services, and revenue.'

  return (
    <div className="mx-auto max-w-[1680px] space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-violet-300">Client Management</div>
          <h1 className="mt-2 text-3xl font-bold text-white">Active Clients</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-400">{roleDescription}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-2xl border border-[var(--brand-border)] bg-black/20 px-4 py-2 text-right">
            <div className="text-[10px] uppercase tracking-[0.24em] text-gray-400">Matched clients</div>
            <div className="mt-1 text-lg font-bold text-white">{loading ? '…' : total.toLocaleString()}</div>
          </div>
          <button
            onClick={() => loadClients(queryString)}
            className="rounded-xl border border-[var(--brand-border)] px-4 py-2 text-sm font-medium text-gray-300 transition hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-white"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-bg-card)] p-5 shadow-[0_0_0_1px_rgba(115,20,148,0.08)]">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <input
            type="text"
            placeholder="Search center or acronym…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-[260px] flex-1 rounded-xl border border-[var(--brand-border)] bg-black/40 px-3 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30"
          />
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <FilterSelect value={ga} onChange={setGa} options={GA_OPTIONS} />
            <FilterSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} />
            <FilterSelect value={service} onChange={setService} options={SERVICE_OPTIONS} />
            <FilterSelect value={sort} onChange={setSort} options={SORT_OPTIONS} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setOverdue((current) => !current)}
              className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                overdue
                  ? 'border-rose-500/50 bg-rose-500/15 text-rose-300'
                  : 'border-[var(--brand-border)] text-gray-300 hover:border-rose-500/30 hover:text-rose-300'
              }`}
            >
              {overdue ? 'Overdue only' : 'All accounts'}
            </button>
            {hasActiveFilters ? (
              <button
                onClick={resetFilters}
                className="rounded-xl border border-[var(--brand-border)] px-3 py-2 text-sm font-medium text-gray-300 transition hover:border-violet-500/30 hover:text-white"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-[var(--brand-border)] pt-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-xs text-gray-400">
            Showing <span className="font-semibold text-white">{loading ? '…' : clients.length.toLocaleString()}</span> clients on page <span className="font-semibold text-white">{page}</span>
            {totalPages > 1 ? <span> of <span className="font-semibold text-white">{totalPages}</span></span> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {hasActiveFilters ? activeFilters.map((filter) => <FilterChip key={filter}>{filter}</FilterChip>) : <span className="text-xs text-gray-500">No filters applied</span>}
          </div>
        </div>
      </div>

      <StatsBar
        matched={total}
        visible={clients.length}
        pageMrr={pageMrr}
        overdueCount={overdueCount}
        trendDownCount={trendDownCount}
      />

      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</div>
      ) : null}

      <div className="overflow-hidden rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-bg-card)] shadow-[0_0_0_1px_rgba(115,20,148,0.08)]">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-[#120827]/95 backdrop-blur">
              <tr className="border-b border-[var(--brand-border)]">
                {['Client', 'Team + activity', 'Services', 'Revenue', 'Signals', 'Open'].map((heading) => (
                  <th
                    key={heading}
                    className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <span className="animate-spin text-violet-400">⟳</span>
                      Loading clients…
                    </div>
                  </td>
                </tr>
              ) : clients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-gray-500">
                    No clients match these filters.
                  </td>
                </tr>
              ) : (
                clients.map((client, index) => {
                  const companyName = client.companyName || client.name || client.acronym || 'Unnamed client'
                  const ownerName = client.ownerName || client.owner || client.contactName || 'Unknown owner'
                  const gaName = client.assignedGA || 'Unassigned'
                  const lastActivity = fmtDate(client.lastCallDate)
                  const location = [client.city, client.state].filter(Boolean).join(', ')
                  const isPIF = client.serviceList?.some?.((item) => String(item).toLowerCase().includes('pif')) || client.stripeStatus === 'pif'

                  return (
                    <tr
                      key={client.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openClient(client.acronym)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          openClient(client.acronym)
                        }
                      }}
                      className={`cursor-pointer border-b border-[var(--brand-border)] align-top transition hover:bg-violet-500/5 focus-within:bg-violet-500/5 ${index % 2 === 0 ? 'bg-white/[0.015]' : 'bg-transparent'}`}
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex min-w-[260px] items-start gap-3">
                          <HealthPill score={client.healthScore} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-200">
                                {client.acronym || '—'}
                              </span>
                              <StatusBadge status={client.status} />
                            </div>
                            <div className="mt-2 truncate text-sm font-semibold text-white">{companyName}</div>
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400">
                              <span>Owner: <span className="text-gray-200">{ownerName}</span></span>
                              {location ? <span>{location}</span> : null}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="min-w-[210px] space-y-1.5 text-xs">
                          <div className="text-gray-400">GA</div>
                          <div className="font-semibold text-white">{gaName}</div>
                          <div className="pt-1 text-gray-400">Last activity</div>
                          <div className="font-medium text-gray-200">{lastActivity}</div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="min-w-[180px] space-y-2">
                          <ServiceStack client={client} />
                          {Array.isArray(client.serviceList) && client.serviceList.length > 0 ? (
                            <div className="truncate text-[11px] text-gray-500">{client.serviceList.slice(0, 3).join(' · ')}</div>
                          ) : null}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="min-w-[150px] space-y-1.5 text-xs">
                          <div className="text-lg font-bold text-white">
                            {isPIF ? (
                              <span className="rounded-full border border-violet-500/40 bg-violet-500/15 px-2.5 py-1 text-xs font-semibold text-violet-300">PIF</span>
                            ) : client.mrr ? (
                              fmt$(client.mrr)
                            ) : '—'}
                          </div>
                          <div className="text-gray-400">{isPIF ? 'Paid in full' : 'Monthly recurring revenue'}</div>
                          {client.isOverdue ? (
                            <div className="font-medium text-rose-300">Overdue {fmt$(client.overdueAmount || 0)}</div>
                          ) : (
                            <div className="text-emerald-300">Current</div>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="min-w-[170px] space-y-2">
                          <TrendBadge trend={client.funnelTrend} />
                          <div className="text-xs text-gray-400">
                            Stripe: <span className={`font-medium ${client.stripeStatus === 'past_due' ? 'text-rose-300' : 'text-gray-200'}`}>{client.stripeStatus || '—'}</span>
                          </div>
                          {client.isOverdue ? (
                            <div className="text-xs font-medium text-rose-300">Needs follow-up</div>
                          ) : (
                            <div className="text-xs text-gray-500">No urgent payment flag</div>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <Link
                          href={`/clients/${client.acronym}`}
                          onClick={(event) => event.stopPropagation()}
                          className="inline-flex items-center rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-200 transition hover:border-violet-400/50 hover:bg-violet-500/20 hover:text-white"
                        >
                          Open →
                        </Link>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 ? (
          <div className="flex flex-col gap-3 border-t border-[var(--brand-border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-gray-400">
              Page <span className="font-semibold text-white">{page}</span> of <span className="font-semibold text-white">{totalPages}</span> · {total.toLocaleString()} matched clients
            </div>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
                className="rounded-lg border border-[var(--brand-border)] px-3 py-1.5 text-xs text-gray-300 transition hover:enabled:bg-violet-500/10 disabled:opacity-40"
              >
                ← Prev
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-lg border border-[var(--brand-border)] px-3 py-1.5 text-xs text-gray-300 transition hover:enabled:bg-violet-500/10 disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
