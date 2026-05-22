'use client'
import { useState, useEffect } from 'react'

const MODULE_COLORS = {
  1: 'from-violet-600/20 to-purple-900/20 border-violet-500/30',
  2: 'from-purple-600/20 to-indigo-900/20 border-purple-500/30',
  3: 'from-blue-600/20 to-cyan-900/20 border-blue-500/30',
  4: 'from-amber-600/20 to-orange-900/20 border-amber-500/30',
}

const MODULE_BADGE = {
  1: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  2: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  3: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  4: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
}

const TAG_COLORS = {
  'beginners': 'bg-violet-500/15 text-violet-300',
  'fundamentals': 'bg-purple-500/15 text-purple-300',
  'skills': 'bg-indigo-500/15 text-indigo-300',
  'google-ads': 'bg-blue-500/15 text-blue-300',
  'paid-media': 'bg-cyan-500/15 text-cyan-300',
  'ai-landscape': 'bg-amber-500/15 text-amber-300',
  'strategy': 'bg-orange-500/15 text-orange-300',
  'mcp': 'bg-emerald-500/15 text-emerald-300',
  'featured': 'bg-[var(--brand-gold)]/20 text-yellow-300',
  'reference': 'bg-gray-500/15 text-gray-300',
  'cheatsheet': 'bg-pink-500/15 text-pink-300',
}

function ResourceCard({ resource }) {
  const isNotion = resource.type === 'notion'
  return (
    <a
      href={resource.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-2xl border border-[var(--brand-gold)]/30 bg-gradient-to-br from-yellow-900/10 to-amber-900/5 p-5 hover:border-[var(--brand-gold)]/60 transition-all group"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{isNotion ? '📖' : '🔗'}</span>
          <div>
            <div className="font-bold text-white text-sm leading-tight">{resource.title}</div>
            <div className="text-[10px] text-[var(--brand-gold)] mt-0.5 uppercase tracking-wider">
              {resource.type === 'notion' ? 'Notion' : 'External'}
            </div>
          </div>
        </div>
        <span className="text-gray-500 group-hover:text-gray-300 transition text-xs">↗</span>
      </div>
      <p className="text-xs text-gray-400 leading-relaxed mb-3">{resource.description}</p>
      <div className="flex flex-wrap gap-1">
        {resource.tags?.map(tag => (
          <span key={tag} className={`text-[10px] px-2 py-0.5 rounded-full ${TAG_COLORS[tag] || 'bg-gray-500/15 text-gray-400'}`}>
            {tag}
          </span>
        ))}
      </div>
    </a>
  )
}

function PresentationCard({ deck }) {
  const colors = MODULE_COLORS[deck.module] || 'from-gray-600/20 to-gray-900/20 border-gray-500/30'
  const badge  = MODULE_BADGE[deck.module] || 'bg-gray-500/20 text-gray-300'

  return (
    <div className={`rounded-2xl border bg-gradient-to-br ${colors} p-5 flex flex-col gap-3 hover:scale-[1.01] transition-transform`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold shrink-0 ${badge}`}>
          Module {deck.module}
        </span>
        <span className="text-[10px] text-gray-500">{deck.slideCount} slides</span>
      </div>

      {/* Title */}
      <div>
        <h3 className="font-bold text-white text-sm leading-snug">{deck.title}</h3>
        {deck.audience && (
          <p className="text-[10px] text-gray-500 mt-1">For: {deck.audience}</p>
        )}
      </div>

      {/* Description */}
      <p className="text-xs text-gray-400 leading-relaxed flex-1">{deck.description}</p>

      {/* Tags */}
      <div className="flex flex-wrap gap-1">
        {deck.tags?.map(tag => (
          <span key={tag} className={`text-[10px] px-2 py-0.5 rounded-full ${TAG_COLORS[tag] || 'bg-gray-500/15 text-gray-400'}`}>
            {tag}
          </span>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <a
          href={deck.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 text-center text-xs py-2 rounded-lg bg-[var(--brand-violet)]/20 hover:bg-[var(--brand-violet)]/40 text-violet-300 hover:text-white transition font-semibold border border-[var(--brand-violet)]/30"
        >
          ▶ Open Deck
        </a>
        {deck.sourceUrl && (
          <a
            href={deck.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 text-xs py-2 rounded-lg bg-gray-500/10 hover:bg-gray-500/20 text-gray-400 hover:text-gray-200 transition border border-gray-500/20"
            title={`Source: ${deck.source}`}
          >
            Source ↗
          </a>
        )}
      </div>
    </div>
  )
}

export default function PresentationLibraryPage() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('all')

  useEffect(() => {
    fetch('/api/team/presentations')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const presentations = data?.presentations || []
  const resources     = data?.resources     || []
  const filtered = filter === 'all'
    ? presentations
    : presentations.filter(p => p.tags?.includes(filter) || p.category === filter)

  const allTags = [...new Set(presentations.flatMap(p => p.tags || []))]

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">🎬 Presentation Library</h1>
        <p className="mt-1 text-sm text-gray-400">
          All GYC AI training decks, reference docs, and resources in one place. Editable by all GYC staff.
        </p>
      </div>

      {/* Featured Resources */}
      {resources.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--brand-gold)] mb-3">
            ⭐ Featured Resources
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {resources.filter(r => r.tags?.includes('featured')).map(r => (
              <ResourceCard key={r.id} resource={r} />
            ))}
          </div>
        </section>
      )}

      {/* Filter */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-gray-500">Filter:</span>
        <button
          onClick={() => setFilter('all')}
          className={`text-xs px-3 py-1 rounded-full border transition ${filter === 'all' ? 'bg-violet-500/20 border-violet-500/40 text-violet-300' : 'border-white/10 text-gray-400 hover:text-white'}`}
        >
          All ({presentations.length})
        </button>
        {allTags.filter(t => !['featured'].includes(t)).map(tag => (
          <button
            key={tag}
            onClick={() => setFilter(tag)}
            className={`text-xs px-3 py-1 rounded-full border transition ${filter === tag ? 'bg-violet-500/20 border-violet-500/40 text-violet-300' : 'border-white/10 text-gray-400 hover:text-white'}`}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Decks Grid */}
      {loading && <div className="text-sm text-gray-500 py-8 text-center">Loading library...</div>}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-5">
          {filtered.map(deck => (
            <PresentationCard key={deck.id} deck={deck} />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-2 text-sm text-gray-500 py-8 text-center">No presentations match this filter.</div>
          )}
        </div>
      )}

      {/* Footer */}
      {data?.updatedAt && (
        <div className="text-xs text-gray-600 text-right">
          Last updated: {new Date(data.updatedAt).toLocaleDateString()}
          {' '}— Wall·E 🤖
        </div>
      )}
    </div>
  )
}
