'use client'

import { useCallback, useEffect, useState } from 'react'

function fmt$(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(v||0)) }

function ConfidencePill({ level }) {
  const styles = {
    HIGH:   'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    MEDIUM: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
    LOW:    'border-gray-500/30 bg-gray-500/10 text-gray-400',
  }
  return level ? (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase ${styles[level] || styles.LOW}`}>
      {level} confidence
    </span>
  ) : null
}

function MemoCard({ memo }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={`rounded-xl border ${memo.urgent ? 'border-rose-500/40 bg-rose-500/5' : 'border-[var(--brand-border)] bg-black/30'} p-4 space-y-2`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            {memo.urgent && <span className="rounded-full border border-rose-500/40 bg-rose-500/15 px-2 py-0.5 text-[11px] font-bold text-rose-200">🚨 URGENT</span>}
            <ConfidencePill level={memo.confidence} />
            {memo.date && <span className="text-[11px] text-gray-500">{memo.date}</span>}
          </div>
          <button onClick={() => setExpanded(e => !e)} className="text-left text-sm font-semibold text-white hover:text-violet-300 transition">
            {memo.title}
          </button>
        </div>
        <button onClick={() => setExpanded(e => !e)} className="text-gray-500 hover:text-gray-300 text-xs transition shrink-0">
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {memo.recommendedAction && (
        <div className="rounded-lg border border-violet-500/20 bg-violet-500/8 px-3 py-2 text-xs">
          <span className="text-violet-400 font-semibold">→ Action: </span>
          <span className="text-gray-200">{memo.recommendedAction}</span>
        </div>
      )}

      {!expanded && memo.findings?.length > 0 && (
        <ul className="space-y-1">
          {memo.findings.slice(0, 2).map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-gray-400">
              <span className="text-violet-500 mt-0.5 shrink-0">•</span>{f}
            </li>
          ))}
          {memo.findings.length > 2 && <li className="text-xs text-gray-600">+{memo.findings.length - 2} more…</li>}
        </ul>
      )}

      {expanded && (
        <div className="pt-2">
          {memo.findings?.length > 0 && (
            <div className="mb-3">
              <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">Key Findings</p>
              <ul className="space-y-1">
                {memo.findings.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                    <span className="text-violet-500 mt-0.5 shrink-0">•</span>{f}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="rounded-lg border border-[var(--brand-border)] bg-black/20 p-3 text-xs text-gray-400 whitespace-pre-wrap font-mono max-h-80 overflow-auto">
            {memo.fullText}
          </div>
        </div>
      )}
    </div>
  )
}

export default function FulcrumIntel() {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/metrics/intel-snapshot')
      setData(await res.json())
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="text-sm text-gray-400 py-8 text-center">Loading intel feed…</div>

  const memos = data?.missionIntel?.memos || data?.memos || []
  const digest = data?.missionIntel?.digest || data?.digest || []
  const snapshotAsOf = data?.snapshot?.asOf || null

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">🔭 Fulcrum Intel Feed</h2>
          <p className="text-sm text-gray-400 mt-0.5">Strategic memos from Fulcrum — portfolio health, competitive signals, upsell opportunities, and risk flags. Runs every 6 hours on weekdays.</p>
          {snapshotAsOf && <p className="text-[11px] text-gray-600 mt-1">Snapshot as of {new Date(snapshotAsOf).toLocaleString()}</p>}
        </div>
        <button onClick={load} className="rounded-xl border border-[var(--brand-border)] px-3 py-1.5 text-xs text-gray-400 hover:text-white transition">Refresh</button>
      </div>

      {/* Digest feed — one-liners */}
      {digest.length > 0 && (
        <div className="rounded-xl border border-[var(--brand-border)] bg-black/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Recent Digest Feed</p>
          <div className="space-y-2">
            {digest.slice(0, 8).map((d, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <span className="text-[11px] text-gray-600 shrink-0 mt-0.5">{d.date}</span>
                <span className="text-gray-300">{d.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Memos */}
      {memos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--brand-border)] bg-black/10 px-4 py-10 text-center">
          <p className="text-gray-500 text-sm">No memos yet — Fulcrum will write her first one on the next heartbeat cycle (every 6h weekdays).</p>
          <p className="text-gray-600 text-xs mt-2">Topics queued: competitive · churn-risk · product-gaps · sales-process · industry-trends · ops-efficiency · portfolio-health</p>
        </div>
      ) : (
        <div className="space-y-3">
          {memos.map((memo) => <MemoCard key={memo.id} memo={memo} />)}
        </div>
      )}
    </div>
  )
}
