'use client'

import { useEffect, useState, useCallback } from 'react'

const ACCENT_WEBSITE = '#AE2BCF'
const ACCENT_PAID = '#F59E0B'
const ACCENT_ORPHAN = '#ef4444'
const REFRESH_INTERVAL_MS = 10 * 60 * 1000

function formatUpdated(isoStr) {
  if (!isoStr) return ''
  const diff = Math.floor((Date.now() - new Date(isoStr)) / 60000)
  if (diff < 1) return 'just now'
  if (diff === 1) return '1 min ago'
  return `${diff} min ago`
}

// ── Shared components ────────────────────────────────────────────────────────

function SectionDivider() {
  return (
    <div className="my-10">
      <div style={{
        height: 2,
        background: 'linear-gradient(to right, transparent, #731494 15%, #AE2BCF 50%, #731494 85%, transparent)',
        boxShadow: '0 0 16px rgba(174,43,207,0.5), 0 0 40px rgba(174,43,207,0.2)',
      }} />
    </div>
  )
}

function SectionShell({ title, subtitle, accent = ACCENT_WEBSITE, children, divider = true }) {
  return (
    <section>
      {divider && <SectionDivider />}
      <div className="flex items-end justify-between gap-4 mb-4 mt-4">
        <div>
          <h2 className="text-gray-200 text-lg font-semibold">{title}</h2>
          {subtitle && <p className="text-gray-400 text-sm mt-1">{subtitle}</p>}
        </div>
        <div className="w-12 h-1 rounded-full" style={{ backgroundColor: accent }} />
      </div>
      {children}
    </section>
  )
}

function MetricCard({ title, value, subtitle, accent = ACCENT_WEBSITE }) {
  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
      <div className="w-10 h-1 rounded-full mb-3" style={{ backgroundColor: accent }} />
      <p className="text-gray-300 text-xs font-medium uppercase tracking-wider mb-2">{title}</p>
      <p className="text-3xl font-bold text-white">{value ?? '—'}</p>
      {subtitle && <p className="text-gray-400 text-xs mt-1">{subtitle}</p>}
    </div>
  )
}

function ShimmerCard() {
  return (
    <div className="rounded-xl p-5 animate-pulse" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
      <div className="w-10 h-1 rounded-full mb-3 bg-gray-700" />
      <div className="h-3 w-24 rounded bg-gray-700 mb-3" />
      <div className="h-8 w-16 rounded bg-gray-700" />
    </div>
  )
}

// ── Website Support ──────────────────────────────────────────────────────────

function PersonCard({ person, count, tasks }) {
  const shown = tasks.slice(0, 5)
  const overflow = tasks.length - shown.length

  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-white font-semibold">{person}</p>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: count === 0 ? '#1f1f1f' : 'rgba(174,43,207,0.2)', color: count === 0 ? '#6b7280' : ACCENT_WEBSITE }}
        >
          {count}
        </span>
      </div>
      {count === 0 ? (
        <p className="text-gray-600 text-xs">No open tasks</p>
      ) : (
        <ul className="space-y-1">
          {shown.map((name, i) => (
            <li key={i} className="text-xs text-gray-400 truncate">• {name}</li>
          ))}
          {overflow > 0 && (
            <li className="text-xs text-gray-500">+{overflow} more</li>
          )}
        </ul>
      )}
    </div>
  )
}

function WebsiteSupportSection({ data }) {
  if (!data) return null

  const activePeople = (data.byPerson || []).filter((p) => p.count > 0).length

  return (
    <SectionShell
      title="🔧 Live Website Support"
      subtitle="Open tasks across the support queue and per team member."
      accent={ACCENT_WEBSITE}
      divider={false}
    >
      {/* Summary row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <MetricCard title="Total Open Tasks" value={data.totalOpen} accent={ACCENT_WEBSITE} />
        <MetricCard title="In Queue / Unassigned" value={data.unassignedQueue} accent={ACCENT_WEBSITE} />
        <MetricCard title="Team Members Active" value={activePeople} subtitle="with ≥1 open task" accent={ACCENT_WEBSITE} />
      </div>

      {/* Per-person grid */}
      {data.byPerson && data.byPerson.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.byPerson.map((p) => (
            <PersonCard key={p.person} {...p} />
          ))}
        </div>
      )}
    </SectionShell>
  )
}

// ── Paid Media ───────────────────────────────────────────────────────────────

function StageCard({ stage, count, tasks }) {
  const shown = tasks.slice(0, 5)
  const overflow = tasks.length - shown.length

  return (
    <div className="rounded-xl p-4 min-w-[200px] flex-1" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-gray-300 text-xs font-semibold uppercase tracking-wide">{stage}</p>
        <span
          className="text-lg font-bold"
          style={{ color: ACCENT_PAID }}
        >
          {count}
        </span>
      </div>
      <ul className="space-y-1 mt-2">
        {shown.map((name, i) => (
          <li key={i} className="text-xs text-gray-400 truncate">• {name}</li>
        ))}
        {overflow > 0 && (
          <li className="text-xs text-gray-500">+{overflow} more</li>
        )}
      </ul>
    </div>
  )
}

function PaidMediaSection({ data }) {
  if (!data) return null

  return (
    <SectionShell
      title="📣 Paid Media Requests"
      subtitle="T&C work requests by stage."
      accent={ACCENT_PAID}
    >
      <div className="mb-4">
        <MetricCard title="Total Open Tasks" value={data.totalOpen} accent={ACCENT_PAID} />
      </div>

      {data.byStage && data.byStage.length > 0 && (
        <div className="flex flex-wrap gap-4">
          {data.byStage.map((s) => (
            <StageCard key={s.key} {...s} />
          ))}
        </div>
      )}
    </SectionShell>
  )
}

// ── Orphaned Tasks ───────────────────────────────────────────────────────────

function OrphanedTasksSection({ data }) {
  if (!data) return null

  return (
    <SectionShell
      title="⚠️ Unattached Tasks"
      subtitle="Tasks with no project — flying under the radar."
      accent={ACCENT_ORPHAN}
    >
      {/* Warning banner */}
      <div
        className="rounded-xl p-4 mb-4 flex items-start gap-3"
        style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}
      >
        <span className="text-red-400 text-lg mt-0.5">⚠️</span>
        <p className="text-red-300 text-sm">
          These tasks are not assigned to any project. They may be getting missed.
        </p>
      </div>

      {/* Count badge */}
      <div className="mb-4">
        <span
          className="inline-block px-4 py-2 rounded-full text-sm font-bold"
          style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: ACCENT_ORPHAN }}
        >
          {data.count} unattached task{data.count !== 1 ? 's' : ''}
        </span>
        {data.note && (
          <span className="ml-3 text-xs text-gray-500">{data.note}</span>
        )}
      </div>

      {/* Task list */}
      {data.tasks && data.tasks.length > 0 && (
        <div
          className="rounded-xl overflow-y-auto max-h-96"
          style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #2a1a3e' }}>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-semibold uppercase tracking-wider">Task</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-semibold uppercase tracking-wider">Assignee</th>
              </tr>
            </thead>
            <tbody>
              {data.tasks.map((t, i) => (
                <tr
                  key={i}
                  style={{ borderBottom: i < data.tasks.length - 1 ? '1px solid #1a1a2e' : undefined }}
                >
                  <td className="px-4 py-2.5 text-gray-300 text-xs">{t.name}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{t.assignee || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionShell>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function WorkloadPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true)
    try {
      const res = await fetch('/api/metrics/workload', { cache: 'no-store' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      const json = await res.json()
      setData(json)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(() => load(), REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [load])

  return (
    <main className="min-h-screen px-6 py-8" style={{ backgroundColor: '#0a0a0a', color: '#fff' }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Workload</h1>
          <p className="text-gray-400 text-sm mt-1">
            Live task queue across website support, paid media, and ad-hoc requests.
          </p>
          {data?.updatedAt && (
            <p className="text-gray-600 text-xs mt-1">Updated {formatUpdated(data.updatedAt)}</p>
          )}
        </div>
        <button
          onClick={() => load(true)}
          disabled={loading || refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          style={{
            backgroundColor: '#1a1a2e',
            border: '1px solid #2a1a3e',
            color: refreshing ? '#6b7280' : '#d1d5db',
            cursor: loading || refreshing ? 'not-allowed' : 'pointer',
          }}
        >
          <span className={refreshing ? 'animate-spin' : ''}>↻</span>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div
          className="rounded-xl p-4 mb-6"
          style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5' }}
        >
          <p className="font-semibold text-sm mb-1">Failed to load workload data</p>
          <p className="text-xs opacity-80">{error}</p>
        </div>
      )}

      {/* Loading state */}
      {loading && !data && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => <ShimmerCard key={i} />)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
            {[0, 1, 2, 3, 4, 5].map((i) => <ShimmerCard key={i} />)}
          </div>
        </div>
      )}

      {/* Content */}
      {data && (
        <>
          <WebsiteSupportSection data={data.websiteSupport} />
          <PaidMediaSection data={data.paidMedia} />
          <OrphanedTasksSection data={data.orphanedTasks} />
        </>
      )}
    </main>
  )
}
