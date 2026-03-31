'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'

function formatDate(value) {
  if (!value) return 'No calls yet'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

function formatMrr(value) {
  if (!value && value !== 0) return null
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value))
}

export default function ClientBrowserPage({ user }) {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  const loadClients = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/clients', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load clients.')
      setClients(json.clients || [])
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadClients()
  }, [loadClients])

  const filteredClients = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return clients
    return clients.filter((client) => [
      client.name,
      client.acronym,
      client.centerName,
      client.ownerName,
      client.gaName,
      client.repName,
    ].some((value) => String(value || '').toLowerCase().includes(needle)))
  }, [clients, query])

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-violet-300">Team Portal</div>
          <h1 className="mt-2 text-3xl font-bold text-white">Client Intel</h1>
          <p className="mt-1 text-sm text-gray-400">Browse every client card in one place. {user?.role === 'ga' ? 'Scoped to the clients tied to your calls.' : 'CX and admin can see the full book.'}</p>
        </div>
        <button onClick={loadClients} className="rounded-xl border border-[var(--brand-border)] px-4 py-2 text-sm font-medium text-gray-300 transition hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-white">Refresh</button>
      </div>

      <div className="rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-bg-card)] p-5 shadow-[0_0_0_1px_rgba(115,20,148,0.08)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-gray-400">Client Browser</div>
            <div className="mt-1 text-sm text-gray-500">Search by center name, acronym, owner, or growth advisor.</div>
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search clients…"
            className="w-full max-w-xl rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-violet-500/50"
          />
        </div>
      </div>

      {error ? <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}

      {loading ? (
        <div className="rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-bg-card)] p-6 text-sm text-gray-400">Loading clients…</div>
      ) : filteredClients.length === 0 ? (
        <div className="rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-bg-card)] p-10 text-center">
          <div className="text-2xl font-bold text-white">No clients matched</div>
          <div className="mt-2 text-sm text-gray-500">Try a broader search, or refresh if new calls were just synced.</div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredClients.map((client) => {
            const centerName = client.centerName || client.companyName || client.name || client.acronym
            const ownerName = client.ownerName || client.owner || client.contactName || client.name || 'Unknown'
            const growthAdvisor = client.gaName || client.assignedGA || 'Unassigned'
            const mrr = formatMrr(client.mrr)
            const isPastDue = client.status === 'past_due'
            const isActive = client.status === 'active'

            return (
              <Link key={client.id} href={`/clients/${client.acronym}`} className="group rounded-3xl border border-[var(--brand-border)] bg-[radial-gradient(circle_at_top,#1a1024,transparent_50%),var(--brand-bg-card)] p-6 transition hover:border-violet-500/40 hover:bg-[radial-gradient(circle_at_top,#2a133e,transparent_55%),var(--brand-bg-card)] hover:shadow-[0_0_40px_rgba(115,20,148,0.15)]">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-300">Client Intel Card</div>
                      {isActive && (
                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">Active</span>
                      )}
                      {isPastDue && (
                        <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-400">Past Due</span>
                      )}
                    </div>
                    <h2 className="mt-2 truncate text-xl font-bold text-white transition group-hover:text-violet-100">{centerName}</h2>
                    {mrr && (
                      <div className="mt-0.5 text-xs font-medium text-gray-400">{mrr}<span className="ml-1 text-gray-600">/mo</span></div>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-violet-200">{client.acronym}</span>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-[var(--brand-border)] bg-black/20 px-4 py-3">
                    <div className="text-xs uppercase tracking-wider text-gray-500">Center Name</div>
                    <div className="mt-1 text-sm font-semibold text-white truncate">{centerName}</div>
                  </div>
                  <div className="rounded-2xl border border-[var(--brand-border)] bg-black/20 px-4 py-3">
                    <div className="text-xs uppercase tracking-wider text-gray-500">Owner&apos;s Name</div>
                    <div className="mt-1 text-sm font-semibold text-white truncate">{ownerName}</div>
                  </div>
                  <div className="rounded-2xl border border-[var(--brand-border)] bg-black/20 px-4 py-3">
                    <div className="text-xs uppercase tracking-wider text-gray-500">Growth Advisor</div>
                    <div className="mt-1 text-sm font-semibold text-white truncate">{growthAdvisor}</div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-[var(--brand-border)] bg-black/20 px-4 py-3">
                    <div className="text-xs uppercase tracking-wider text-gray-500">Last Activity</div>
                    <div className="mt-1 text-sm font-semibold text-white">{formatDate(client.lastCallDate)}</div>
                  </div>
                  {mrr && (
                    <div className="rounded-2xl border border-[var(--brand-border)] bg-black/20 px-4 py-3">
                      <div className="text-xs uppercase tracking-wider text-gray-500">MRR</div>
                      <div className={`mt-1 text-sm font-semibold ${isPastDue ? 'text-rose-400' : 'text-emerald-400'}`}>{mrr}</div>
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
