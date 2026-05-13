'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

const STATUS_STYLES = {
  available:  { bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-300', label: 'Available Now' },
  pilot:      { bg: 'bg-violet-500/15',  border: 'border-violet-500/30',  text: 'text-violet-300',  label: 'Pilot' },
  research:   { bg: 'bg-amber-500/15',   border: 'border-amber-500/30',   text: 'text-amber-300',   label: 'Research' },
  blocked:    { bg: 'bg-rose-500/15',    border: 'border-rose-500/30',    text: 'text-rose-300',    label: 'Blocked' },
}

const CATEGORY_EMOJI = {
  design:   '🎨',
  creative: '✨',
  media:    '🎬',
  data:     '📊',
  ai:       '🤖',
  ops:      '⚙️',
  other:    '🔧',
}

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.research
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.bg} ${s.border} ${s.text}`}>
      {s.label}
    </span>
  )
}

function ToolCard({ tool }) {
  const [open, setOpen] = useState(false)
  const emoji = CATEGORY_EMOJI[tool.category] || '🔧'

  return (
    <div className="rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top_left,#1a1024,transparent_60%)] p-5 transition hover:border-violet-500/30">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{emoji}</span>
          <div>
            <div className="font-bold text-white text-base leading-tight">{tool.name}</div>
            {tool.source && <div className="text-[10px] text-gray-500 mt-0.5">Source: {tool.source}</div>}
          </div>
        </div>
        <StatusBadge status={tool.status} />
      </div>

      {/* Summary */}
      <p className="text-sm text-gray-300 mb-4 leading-relaxed">{tool.summary}</p>

      {/* How it works */}
      {tool.howItWorks && (
        <div className="mb-3">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1">How it works</div>
          <p className="text-xs text-gray-400">{tool.howItWorks}</p>
        </div>
      )}

      {/* Expand toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        className="text-xs text-violet-400 hover:text-violet-300 transition mt-1"
      >
        {open ? '▲ Less' : '▼ Workflow ideas & more'}
      </button>

      {open && (
        <div className="mt-4 space-y-4 border-t border-white/5 pt-4">
          {tool.workflowIdeas?.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1">Workflow ideas</div>
              <ul className="space-y-1">
                {tool.workflowIdeas.map((w, i) => <li key={i} className="text-xs text-gray-400 flex gap-1.5"><span className="text-violet-400 shrink-0">→</span>{w}</li>)}
              </ul>
            </div>
          )}
          {tool.unlocks?.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1">Unlocks</div>
              <ul className="space-y-1">
                {tool.unlocks.map((u, i) => <li key={i} className="text-xs text-gray-400 flex gap-1.5"><span className="text-emerald-400 shrink-0">✓</span>{u}</li>)}
              </ul>
            </div>
          )}
          {tool.notes && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1">Notes</div>
              <p className="text-xs text-gray-500 italic">{tool.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ToolkitConsolePage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/team/toolkit')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load')
      setData(json)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const tools = data?.tools || []
  const filtered = filter === 'all' ? tools : tools.filter(t => t.status === filter)

  const counts = {
    all: tools.length,
    available: tools.filter(t => t.status === 'available').length,
    pilot: tools.filter(t => t.status === 'pilot').length,
    research: tools.filter(t => t.status === 'research').length,
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link href="/team/mission-control" className="text-sm text-gray-400 hover:text-violet-300 transition">← Mission Control</Link>
          <h1 className="mt-2 text-3xl font-black text-white">🔧 Toolkit Console</h1>
          <p className="mt-1 text-sm text-gray-400">AI tools, workflows, and capabilities available to GYC</p>
        </div>
        <button onClick={load} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-gray-300 hover:border-violet-500/40 hover:text-white transition">
          Refresh
        </button>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { key: 'all',       label: 'Total Tools',    color: 'text-white' },
          { key: 'available', label: 'Available Now',  color: 'text-emerald-400' },
          { key: 'pilot',     label: 'In Pilot',       color: 'text-violet-400' },
          { key: 'research',  label: 'In Research',    color: 'text-amber-400' },
        ].map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-xl border p-4 text-left transition ${filter === key ? 'border-violet-500/40 bg-violet-500/10' : 'border-white/10 bg-white/[0.03] hover:border-violet-500/20'}`}
          >
            <div className={`text-2xl font-black ${color}`}>{counts[key]}</div>
            <div className="text-xs text-gray-500 mt-0.5">{label}</div>
          </button>
        ))}
      </div>

      {/* Tools grid */}
      {loading && <div className="text-sm text-gray-500 py-8 text-center">Loading toolkit...</div>}
      {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>}
      {!loading && !error && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.length === 0
            ? <div className="col-span-3 text-sm text-gray-500 py-8 text-center">No tools in this category.</div>
            : filtered.map(tool => <ToolCard key={tool.id} tool={tool} />)
          }
        </div>
      )}

      {data?.updatedAt && (
        <div className="text-xs text-gray-600 text-right">Last updated: {new Date(data.updatedAt).toLocaleString()}</div>
      )}
    </div>
  )
}
