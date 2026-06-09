'use client'
import { useState, useEffect } from 'react'

const CATEGORY_CONFIG = {
  'training-module': {
    label: '📚 Training Modules',
    description: 'The GYC AI Training Hub — numbered modules for all staff',
    color: 'violet',
  },
  'how-to': {
    label: '🔧 How-To Guides',
    description: 'Step-by-step practical workshops',
    color: 'cyan',
  },
  'strategy': {
    label: '🚀 AI Strategy & Implementation',
    description: 'Big picture frameworks and implementation guides',
    color: 'amber',
  },
  'sales': {
    label: '🎤 Sales & Client-Facing',
    description: 'Webinars and prospect-facing decks',
    color: 'emerald',
  },
  'company': {
    label: '🦸 Company',
    description: 'Internal and all-team presentations',
    color: 'pink',
  },
}

const CATEGORY_ORDER = ['training-module', 'how-to', 'strategy', 'sales', 'company']

const COLOR_STYLES = {
  violet: {
    header: 'text-violet-300 border-violet-500/30',
    badge: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
    card: 'from-violet-600/15 to-purple-900/15 border-violet-500/25 hover:border-violet-400/50',
    btn: 'bg-violet-500/20 hover:bg-violet-500/40 text-violet-300 hover:text-white border-violet-500/30',
  },
  cyan: {
    header: 'text-cyan-300 border-cyan-500/30',
    badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    card: 'from-cyan-600/15 to-blue-900/15 border-cyan-500/25 hover:border-cyan-400/50',
    btn: 'bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-300 hover:text-white border-cyan-500/30',
  },
  amber: {
    header: 'text-amber-300 border-amber-500/30',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    card: 'from-amber-600/15 to-orange-900/15 border-amber-500/25 hover:border-amber-400/50',
    btn: 'bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 hover:text-white border-amber-500/30',
  },
  emerald: {
    header: 'text-emerald-300 border-emerald-500/30',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    card: 'from-emerald-600/15 to-teal-900/15 border-emerald-500/25 hover:border-emerald-400/50',
    btn: 'bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 hover:text-white border-emerald-500/30',
  },
  pink: {
    header: 'text-pink-300 border-pink-500/30',
    badge: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
    card: 'from-pink-600/15 to-rose-900/15 border-pink-500/25 hover:border-pink-400/50',
    btn: 'bg-pink-500/20 hover:bg-pink-500/40 text-pink-300 hover:text-white border-pink-500/30',
  },
}

function ResourceCard({ resource }) {
  return (
    <a
      href={resource.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-2xl border border-yellow-500/30 bg-gradient-to-br from-yellow-900/10 to-amber-900/5 p-5 hover:border-yellow-400/60 transition-all group"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{resource.type === 'notion' ? '📖' : '🔗'}</span>
          <div>
            <div className="font-bold text-white text-sm leading-tight">{resource.title}</div>
            <div className="text-[10px] text-yellow-400 mt-0.5 uppercase tracking-wider">
              {resource.type === 'notion' ? 'Notion' : 'External'}
            </div>
          </div>
        </div>
        <span className="text-gray-500 group-hover:text-gray-300 transition text-xs">↗</span>
      </div>
      <p className="text-xs text-gray-400 leading-relaxed">{resource.description}</p>
    </a>
  )
}

function PresentationCard({ deck, colorKey }) {
  const c = COLOR_STYLES[colorKey] || COLOR_STYLES.violet
  return (
    <div className={`rounded-2xl border bg-gradient-to-br ${c.card} p-5 flex flex-col gap-3 transition-all`}>
      <div className="flex items-start justify-between gap-2">
        {deck.module && (
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold shrink-0 ${c.badge}`}>
            Module {deck.module}
          </span>
        )}
        {deck.slideCount && (
          <span className="ml-auto text-[10px] text-gray-500">{deck.slideCount} slides</span>
        )}
      </div>
      <div>
        <h3 className="font-bold text-white text-sm leading-snug">{deck.title}</h3>
        {deck.audience && (
          <p className="text-[10px] text-gray-500 mt-1">For: {deck.audience}</p>
        )}
      </div>
      <p className="text-xs text-gray-400 leading-relaxed flex-1">{deck.description}</p>
      <div className="flex gap-2 pt-1">
        <a
          href={deck.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex-1 text-center text-xs py-2 rounded-lg font-semibold border transition ${c.btn}`}
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
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/team/presentations')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const presentations = data?.presentations || []
  const resources = data?.resources || []

  // Group by category, in defined order
  const grouped = CATEGORY_ORDER.reduce((acc, cat) => {
    const items = presentations.filter(p => p.category === cat)
    if (items.length) acc[cat] = items
    return acc
  }, {})

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">🎬 Presentation Library</h1>
        <p className="mt-1 text-sm text-gray-400">
          Every deck Wall·E and Todd have built together — organized by category.
        </p>
      </div>

      {/* Featured Resources */}
      {resources.filter(r => r.tags?.includes('featured')).length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-yellow-400 mb-3">
            ⭐ Featured Resources
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {resources.filter(r => r.tags?.includes('featured')).map(r => (
              <ResourceCard key={r.id} resource={r} />
            ))}
          </div>
        </section>
      )}

      {/* Loading */}
      {loading && <div className="text-sm text-gray-500 py-8 text-center">Loading library...</div>}

      {/* Categories */}
      {!loading && Object.entries(grouped).map(([cat, decks]) => {
        const config = CATEGORY_CONFIG[cat] || { label: cat, color: 'violet' }
        const c = COLOR_STYLES[config.color] || COLOR_STYLES.violet
        return (
          <section key={cat}>
            <div className={`flex items-center gap-3 mb-4 pb-3 border-b ${c.header}`}>
              <h2 className="text-base font-bold">{config.label}</h2>
              <span className="text-[10px] text-gray-500">{decks.length} deck{decks.length !== 1 ? 's' : ''}</span>
              {config.description && (
                <span className="ml-auto text-xs text-gray-500 hidden md:block">{config.description}</span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {decks.map(deck => (
                <PresentationCard key={deck.id} deck={deck} colorKey={config.color} />
              ))}
            </div>
          </section>
        )
      })}

      {!loading && presentations.length === 0 && (
        <div className="text-sm text-gray-500 py-8 text-center">No presentations found.</div>
      )}

      {data?.updatedAt && (
        <div className="text-xs text-gray-600 text-right">
          Last updated: {new Date(data.updatedAt).toLocaleDateString()} — Wall·E 🤖
        </div>
      )}
    </div>
  )
}
