'use client'

import { useEffect, useState } from 'react'

const fmt$ = (n) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(n || 0))

function fmtDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function StatusBadge({ status }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center rounded-full border border-emerald-700 bg-emerald-900/50 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
        Active
      </span>
    )
  }
  if (status === 'expired') {
    return (
      <span className="inline-flex items-center rounded-full border border-gray-700 bg-gray-800 px-2 py-0.5 text-[10px] font-semibold text-gray-400">
        Expired
      </span>
    )
  }
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-700 bg-amber-900/50 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
        Pending
      </span>
    )
  }
  return null
}

function SummaryBar({ summary, loading }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 rounded-xl border border-gray-800 bg-gray-900 animate-pulse" />
        ))}
      </div>
    )
  }

  const totalOffline = summary?.totalMrrOffline || 0
  const totalOnline  = summary?.totalMrrComingOnline || 0
  const nextDate     = summary?.nextReturnDate
  const nextAmt      = summary?.nextReturnAmount || 0
  const unclassified = summary?.unclassifiedPifCount || 0

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
      <div className="rounded-xl border border-red-900/60 bg-red-950/30 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-red-400 mb-1">
          Total MRR Offline
        </p>
        <p className="text-xl font-bold text-red-300">{fmt$(totalOffline)}<span className="text-xs text-red-500 ml-1">/mo</span></p>
        <p className="text-[10px] text-gray-500 mt-0.5">Active lateral PIFs</p>
      </div>
      <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/30 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400 mb-1">
          MRR Returning
        </p>
        <p className="text-xl font-bold text-emerald-300">{fmt$(totalOnline)}<span className="text-xs text-emerald-600 ml-1">/mo</span></p>
        <p className="text-[10px] text-gray-500 mt-0.5">When active laterals expire</p>
      </div>
      <div className="rounded-xl border border-blue-900/60 bg-blue-950/30 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-400 mb-1">
          Next Return
        </p>
        <p className="text-xl font-bold text-blue-300">{nextDate ? fmtDate(nextDate) : '—'}</p>
        {nextAmt > 0 && (
          <p className="text-[10px] text-gray-400 mt-0.5">{fmt$(nextAmt)}/mo returning</p>
        )}
      </div>
      {unclassified > 0 && (
        <div className="sm:col-span-3 rounded-xl border border-amber-900/50 bg-amber-950/20 px-4 py-2 flex items-center gap-2">
          <span className="text-amber-400">⚠️</span>
          <p className="text-xs text-amber-300">
            <strong>{unclassified}</strong> PIF deal{unclassified !== 1 ? 's' : ''} have no Deal Outcome set — they won&apos;t appear in the tables below.{' '}
            <a href="/deals" className="underline hover:text-white">Set outcomes in Closed Deals ↗</a>
          </p>
        </div>
      )}
    </div>
  )
}

function LateralPifsTable({ lateralPifs, loading }) {
  const active = lateralPifs.filter(p => p.status === 'active')
  const expired = lateralPifs.filter(p => p.status === 'expired')

  if (loading) {
    return <div className="h-32 rounded-xl border border-gray-800 bg-gray-900 animate-pulse" />
  }

  if (lateralPifs.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 px-4 py-6 text-center text-sm text-gray-500">
        No lateral PIFs found. Set <code className="text-xs bg-gray-800 px-1 rounded">Deal Outcome = Lateral</code> on PIF deals in Closed Deals.
      </div>
    )
  }

  const rows = [...active, ...expired]

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-800">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-800 bg-gray-900/80">
            <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">Client</th>
            <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">Rep</th>
            <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-500">MRR Offline</th>
            <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">PIF Start</th>
            <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">PIF End</th>
            <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-500">Returns At</th>
            <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-500">Months Left</th>
            <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800 bg-gray-900">
          {rows.map((p, i) => (
            <tr
              key={i}
              className={p.status === 'expired' ? 'opacity-40' : 'hover:bg-gray-800/40 transition-colors'}
            >
              <td className="px-4 py-2.5 font-medium text-white">{p.clientName}</td>
              <td className="px-4 py-2.5 text-gray-400">{p.rep}</td>
              <td className="px-4 py-2.5 text-right font-mono text-red-300">
                {p.mrrOffline ? fmt$(p.mrrOffline) : '—'}
              </td>
              <td className="px-4 py-2.5 text-gray-400">{fmtDate(p.pifStartDate)}</td>
              <td className="px-4 py-2.5 text-gray-400">{fmtDate(p.pifEndDate)}</td>
              <td className="px-4 py-2.5 text-right font-mono text-emerald-300">{fmt$(p.mrrReturnAmount)}</td>
              <td className="px-4 py-2.5 text-right text-gray-300">
                {p.status === 'active' ? (
                  <span className="font-semibold">{p.monthsRemaining ?? '—'}</span>
                ) : '—'}
              </td>
              <td className="px-4 py-2.5">
                <StatusBadge status={p.status} />
              </td>
            </tr>
          ))}
        </tbody>
        {active.length > 0 && (
          <tfoot>
            <tr className="border-t border-gray-700 bg-gray-900/60">
              <td colSpan={2} className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                Active Total
              </td>
              <td className="px-4 py-2 text-right font-mono font-bold text-red-300">
                {fmt$(active.reduce((s, p) => s + (p.mrrOffline || 0), 0))}
              </td>
              <td colSpan={3} />
              <td colSpan={2} className="px-4 py-2 text-right font-mono font-bold text-emerald-300">
                {fmt$(active.reduce((s, p) => s + (p.mrrReturnAmount || 0), 0))} returning
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

function NewPifsTable({ newPifs, loading }) {
  if (loading) {
    return <div className="h-32 rounded-xl border border-gray-800 bg-gray-900 animate-pulse" />
  }

  if (newPifs.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 px-4 py-6 text-center text-sm text-gray-500">
        No new PIFs found. Set <code className="text-xs bg-gray-800 px-1 rounded">Deal Outcome = New Deal</code> on PIF deals in Closed Deals.
      </div>
    )
  }

  const pending = newPifs.filter(p => p.status === 'pending')
  const active  = newPifs.filter(p => p.status === 'active')
  const rows = [...pending, ...active]

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-800">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-800 bg-gray-900/80">
            <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">Client</th>
            <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">Rep</th>
            <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-500">PIF Amount</th>
            <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">MRR Online Date</th>
            <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-500">Expected MRR</th>
            <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-500">Months Until</th>
            <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800 bg-gray-900">
          {rows.map((p, i) => (
            <tr key={i} className="hover:bg-gray-800/40 transition-colors">
              <td className="px-4 py-2.5 font-medium text-white">{p.clientName}</td>
              <td className="px-4 py-2.5 text-gray-400">{p.rep}</td>
              <td className="px-4 py-2.5 text-right font-mono text-blue-300">{fmt$(p.pifAmount)}</td>
              <td className="px-4 py-2.5 text-gray-400">{fmtDate(p.mrrOnlineDate)}</td>
              <td className="px-4 py-2.5 text-right font-mono text-emerald-300">
                {fmt$(p.mrrOnlineAmount)}<span className="text-gray-500">/mo</span>
              </td>
              <td className="px-4 py-2.5 text-right text-gray-300">
                {p.status === 'pending' ? (
                  <span className="font-semibold">
                    {p.monthsUntilOnline != null ? p.monthsUntilOnline : '—'}
                  </span>
                ) : <span className="text-emerald-400">Online ✓</span>}
              </td>
              <td className="px-4 py-2.5">
                <StatusBadge status={p.status} />
              </td>
            </tr>
          ))}
        </tbody>
        {pending.length > 0 && (
          <tfoot>
            <tr className="border-t border-gray-700 bg-gray-900/60">
              <td colSpan={4} className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                Pending Total
              </td>
              <td className="px-4 py-2 text-right font-mono font-bold text-emerald-300">
                {fmt$(pending.reduce((s, p) => s + (p.mrrOnlineAmount || 0), 0))}/mo
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

/**
 * PifMrrImpact — self-contained PIF MRR Impact section.
 * Drop into any page that needs it.
 */
export default function PifMrrImpact() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    let active = true
    fetch('/api/metrics/pif-mrr')
      .then(r => r.json())
      .then(json => {
        if (!active) return
        if (json.error) throw new Error(json.error)
        setData(json)
      })
      .catch(e => active && setError(e.message))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  return (
    <section className="space-y-5">
      {/* Section Header */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-gradient-to-r from-red-900/60 via-gray-700/40 to-transparent" />
        <h2 className="text-sm font-bold uppercase tracking-widest text-red-400 whitespace-nowrap">
          📉 PIF MRR Impact
        </h2>
        <div className="h-px flex-1 bg-gradient-to-l from-red-900/60 via-gray-700/40 to-transparent" />
      </div>

      {error && (
        <div className="rounded-xl border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          Error loading PIF data: {error}
        </div>
      )}

      {/* Summary bar */}
      <SummaryBar summary={data?.summary} loading={loading} />

      {/* Table A — Lateral PIFs (MRR offline) */}
      <div>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-gray-400">
          📉 Table A — MRR Offline (Lateral PIFs)
        </h3>
        <LateralPifsTable lateralPifs={data?.lateralPifs || []} loading={loading} />
      </div>

      {/* Table B — New PIFs (MRR coming online) */}
      <div>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-gray-400">
          📈 Table B — MRR Coming Online (New PIFs)
        </h3>
        <NewPifsTable newPifs={data?.newPifs || []} loading={loading} />
      </div>
    </section>
  )
}
