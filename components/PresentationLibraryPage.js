'use client'
import { useState, useEffect, useMemo } from 'react'

const CATEGORY_CONFIG = {
  'getting-started': {
    label: 'Start Here — AI Foundations',
    icon: '🟢',
    tagline: 'New to AI? Start here.',
    description: 'These four resources take you from zero to confident with AI tools. Follow the sequence — each one builds on the last. Complete this path before moving to Level Up.',
    audience: 'All GYC staff',
    color: 'violet',
    gradient: 'from-violet-900/60 via-purple-900/40 to-slate-900/80',
    sequential: true,
    sequenceLabel: 'Follow in order',
  },
  'level-up': {
    label: 'Level Up — Advanced Skills & Systems',
    icon: '⚡',
    tagline: 'Ready to go deeper?',
    description: 'Build AI skills, design repeatable workflows, and create full AI systems. These modules build on each other — follow the sequence for best results.',
    audience: 'All staff (after foundations)',
    color: 'cyan',
    gradient: 'from-cyan-900/60 via-blue-900/40 to-slate-900/80',
    sequential: true,
    sequenceLabel: 'Follow in order',
  },
  'role-specific': {
    label: 'For Your Role',
    icon: '🎯',
    tagline: 'Targeted by function.',
    description: 'These decks are built for specific GYC roles. Find your function and go deep — they are independent of each other, pick what applies to you.',
    audience: 'Paid Media · SEO · Sales teams',
    color: 'emerald',
    gradient: 'from-emerald-900/60 via-teal-900/40 to-slate-900/80',
    sequential: false,
  },
  'ai-landscape': {
    label: 'AI Landscape & Strategy',
    icon: '🌍',
    tagline: 'Understand the bigger picture.',
    description: "Where is AI headed, and what does it mean for GYC's business and clients? These research decks are independent — explore in any order, in any session.",
    audience: 'Leadership · Curious staff',
    color: 'amber',
    gradient: 'from-amber-900/60 via-orange-900/40 to-slate-900/80',
    sequential: false,
  },
  'client-facing': {
    label: 'Client-Facing & Sales',
    icon: '🎤',
    tagline: 'Built for client conversations.',
    description: 'Decks designed for prospects and client-facing presentations. Use these when talking to childcare centers about GYC services.',
    audience: 'Sales team · Growth Advisors',
    color: 'pink',
    gradient: 'from-pink-900/60 via-rose-900/40 to-slate-900/80',
    sequential: false,
  },
  'internal': {
    label: 'Internal Reference',
    icon: '🔒',
    tagline: 'For GYC leadership.',
    description: 'Reference documents for Todd and GYC leadership. Not for general staff distribution.',
    audience: 'Todd · Leadership',
    color: 'slate',
    gradient: 'from-slate-800/60 via-gray-900/40 to-slate-900/80',
    sequential: false,
  },
}

const CATEGORY_ORDER = ['getting-started', 'level-up', 'role-specific', 'ai-landscape', 'client-facing', 'internal']

const COLOR_STYLES = {
  violet: {
    header: 'text-violet-300 border-violet-500/30',
    badge: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
    card: 'from-violet-600/15 to-purple-900/15 border-violet-500/25 hover:border-violet-400/50',
    btn: 'bg-violet-500/20 hover:bg-violet-500/40 text-violet-300 hover:text-white border-violet-500/30',
    stepBg: 'bg-violet-500/10',
    stepBorder: 'border-violet-500/40',
    stepText: 'text-violet-300',
  },
  cyan: {
    header: 'text-cyan-300 border-cyan-500/30',
    badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    card: 'from-cyan-600/15 to-blue-900/15 border-cyan-500/25 hover:border-cyan-400/50',
    btn: 'bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-300 hover:text-white border-cyan-500/30',
    stepBg: 'bg-cyan-500/10',
    stepBorder: 'border-cyan-500/40',
    stepText: 'text-cyan-300',
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
  slate: {
    header: 'text-slate-300 border-slate-500/30',
    badge: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
    card: 'from-slate-600/15 to-gray-900/15 border-slate-500/25 hover:border-slate-400/50',
    btn: 'bg-slate-500/20 hover:bg-slate-500/40 text-slate-300 hover:text-white border-slate-500/30',
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

function SequentialCard({ deck, stepNum, colorKey, isNew, isCompleted, onToggleComplete }) {
  const c = COLOR_STYLES[colorKey] || COLOR_STYLES.violet
  return (
    <div className={`relative rounded-2xl border bg-gradient-to-br ${c.card} p-5 flex flex-col gap-3 transition-all min-h-[280px]`}>
      {/* Step number badge - prominent in top-left */}
      <div className={`absolute top-4 left-4 w-10 h-10 rounded-full ${c.stepBg} border-2 ${c.stepBorder} flex items-center justify-center`}>
        <span className={`text-lg font-bold ${c.stepText}`}>{stepNum}</span>
      </div>
      
      {/* Completed checkmark overlay - offset for step badge */}
      {isCompleted && (
        <div className="absolute top-16 left-4 w-7 h-7 rounded-full bg-green-500/20 border-2 border-green-500/40 flex items-center justify-center">
          <span className="text-green-400 text-sm">✓</span>
        </div>
      )}
      
      {/* NEW badge */}
      {isNew && (
        <div className="absolute top-3 right-3">
          <span className="bg-green-500/20 text-green-300 border border-green-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">NEW</span>
        </div>
      )}
      
      <div className="flex items-start justify-end gap-2 pt-1">
        <span className="text-[9px] text-gray-500 uppercase tracking-widest">Sequential Step {stepNum}</span>
        {deck.slideCount && (
          <span className="text-[10px] text-gray-500">{deck.slideCount} slides</span>
        )}
      </div>
      
      <div className="mt-2">
        <h3 className="font-bold text-white text-base leading-snug">{deck.title}</h3>
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
        <button
          onClick={(e) => {
            e.preventDefault()
            onToggleComplete(deck.id)
          }}
          className={`px-3 text-xs py-2 rounded-lg font-semibold border transition shrink-0 ${
            isCompleted
              ? 'bg-green-500/20 hover:bg-green-500/30 text-green-300 border-green-500/30'
              : 'bg-gray-500/10 hover:bg-gray-500/20 text-gray-400 hover:text-gray-200 border-gray-500/20'
          }`}
          title={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
        >
          {isCompleted ? '✓ Done' : '✓'}
        </button>
        {deck.sourceUrl && (
          <a
            href={deck.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 text-xs py-2 rounded-lg bg-gray-500/10 hover:bg-gray-500/20 text-gray-400 hover:text-gray-200 transition border border-gray-500/20 shrink-0"
            title={`Source: ${deck.source}`}
          >
            Source ↗
          </a>
        )}
      </div>
    </div>
  )
}

function IndependentCard({ deck, colorKey, isNew, isCompleted, onToggleComplete }) {
  const c = COLOR_STYLES[colorKey] || COLOR_STYLES.violet
  return (
    <div className={`relative rounded-2xl border bg-gradient-to-br ${c.card} p-5 flex flex-col gap-3 transition-all`}>
      {/* Completed checkmark overlay */}
      {isCompleted && (
        <div className="absolute top-4 left-4 w-8 h-8 rounded-full bg-green-500/20 border-2 border-green-500/40 flex items-center justify-center">
          <span className="text-green-400 text-lg">✓</span>
        </div>
      )}
      
      {/* NEW badge */}
      {isNew && (
        <div className="absolute top-3 right-3">
          <span className="bg-green-500/20 text-green-300 border border-green-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">NEW</span>
        </div>
      )}
      
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
        <h3 className="font-bold text-white text-base leading-snug">{deck.title}</h3>
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
        <button
          onClick={(e) => {
            e.preventDefault()
            onToggleComplete(deck.id)
          }}
          className={`px-3 text-xs py-2 rounded-lg font-semibold border transition ${
            isCompleted
              ? 'bg-green-500/20 hover:bg-green-500/30 text-green-300 border-green-500/30'
              : 'bg-gray-500/10 hover:bg-gray-500/20 text-gray-400 hover:text-gray-200 border-gray-500/20'
          }`}
          title={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
        >
          {isCompleted ? '✓ Done' : '✓'}
        </button>
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

function RecentlyAddedCard({ deck, onToggleComplete, isCompleted }) {
  return (
    <div className="relative flex-shrink-0 w-72 rounded-xl border border-green-500/30 bg-gradient-to-br from-green-900/10 to-emerald-900/5 p-4 hover:border-green-400/50 transition-all">
      {/* NEW badge */}
      <div className="absolute top-2 right-2">
        <span className="bg-green-500/20 text-green-300 border border-green-500/30 text-[9px] font-bold px-2 py-0.5 rounded-full">NEW</span>
      </div>
      {/* Completed checkmark */}
      {isCompleted && (
        <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-green-500/20 border-2 border-green-500/40 flex items-center justify-center">
          <span className="text-green-400 text-xs">✓</span>
        </div>
      )}
      <div className="mb-2">
        <h4 className="font-bold text-white text-sm leading-snug line-clamp-2">{deck.title}</h4>
        {deck.audience && (
          <p className="text-[9px] text-gray-500 mt-1">For: {deck.audience}</p>
        )}
      </div>
      <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-3 mb-3">{deck.description}</p>
      <div className="flex gap-2">
        <a
          href={deck.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 text-center text-[11px] py-1.5 rounded-lg font-semibold border transition bg-green-500/20 hover:bg-green-500/40 text-green-300 hover:text-white border-green-500/30"
        >
          ▶ Open
        </a>
        <button
          onClick={() => onToggleComplete(deck.id)}
          className={`px-2 text-[11px] py-1.5 rounded-lg font-semibold border transition ${
            isCompleted
              ? 'bg-green-500/30 text-green-300 border-green-500/40'
              : 'bg-gray-500/10 hover:bg-gray-500/20 text-gray-400 border-gray-500/20'
          }`}
        >
          {isCompleted ? '✓' : '✓'}
        </button>
      </div>
    </div>
  )
}

function SectionHero({ config, deckCount }) {
  return (
    <div className={`relative rounded-2xl border overflow-hidden bg-gradient-to-br ${config.gradient} border-${config.color}-500/30 p-8 mb-6`}>
      <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
        {/* Left: Icon with glow */}
        <div className="relative shrink-0">
          <div className="absolute inset-0 bg-white/5 rounded-full blur-2xl"></div>
          <div className="relative text-7xl md:text-8xl">{config.icon}</div>
        </div>
        
        {/* Right: Content */}
        <div className="flex-1">
          <div className={`text-[10px] uppercase tracking-widest font-semibold mb-2 ${COLOR_STYLES[config.color].header.split(' ')[0]}`}>
            {config.tagline}
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">{config.label}</h2>
          <p className="text-sm text-gray-300 max-w-2xl leading-relaxed mb-3">{config.description}</p>
          <span className={`inline-block text-xs px-3 py-1 rounded-full border ${COLOR_STYLES[config.color].badge}`}>
            For: {config.audience}
          </span>
        </div>
        
        {/* Bottom right: deck count */}
        <div className="absolute bottom-4 right-6 text-xs text-gray-500">
          {deckCount} {deckCount === 1 ? 'deck' : 'decks'}
        </div>
      </div>
    </div>
  )
}

export default function PresentationLibraryPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [completedDecks, setCompletedDecks] = useState({})

  useEffect(() => {
    fetch('/api/team/presentations')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
    
    // Load completed state from localStorage
    if (typeof window !== 'undefined') {
      const saved = {}
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('gyc-library-complete-')) {
          const deckId = key.replace('gyc-library-complete-', '')
          saved[deckId] = localStorage.getItem(key) === 'true'
        }
      })
      setCompletedDecks(saved)
    }
  }, [])

  const toggleComplete = (deckId) => {
    if (typeof window !== 'undefined') {
      const newState = !completedDecks[deckId]
      localStorage.setItem(`gyc-library-complete-${deckId}`, newState.toString())
      setCompletedDecks(prev => ({ ...prev, [deckId]: newState }))
    }
  }

  const isNew = (deck) => {
    if (!deck.addedDate) return false
    const added = new Date(deck.addedDate)
    const now = new Date()
    const daysDiff = (now - added) / (1000 * 60 * 60 * 24)
    return daysDiff <= 30
  }

  const presentations = data?.presentations || []
  const resources = data?.resources || []

  // Recently added decks (last 30 days)
  const recentlyAdded = useMemo(() => {
    return presentations.filter(isNew)
  }, [presentations])

  // Compute stats (exclude internal from progress tracking)
  const totalDecks = presentations.length
  const totalSlides = presentations.reduce((sum, d) => sum + (d.slideCount || 0), 0)
  const trackableDecks = presentations.filter(p => p.category !== 'internal')
  const completedCount = trackableDecks.filter(d => completedDecks[d.id]).length
  const progressPercent = trackableDecks.length > 0 ? Math.round((completedCount / trackableDecks.length) * 100) : 0

  // Group by category
  const grouped = CATEGORY_ORDER.reduce((acc, cat) => {
    const items = presentations.filter(p => p.category === cat)
    if (items.length) {
      // Sort by order if sequential
      if (CATEGORY_CONFIG[cat]?.sequential) {
        items.sort((a, b) => (a.order || 999) - (b.order || 999))
      }
      acc[cat] = items
    }
    return acc
  }, {})

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-10">
      {/* Page Hero */}
      <div className="text-center space-y-3 py-8">
        <h1 className="text-4xl font-bold text-white">GYC AI Training Program</h1>
        <p className="text-lg text-gray-400 max-w-3xl mx-auto">
          Your self-guided AI education. Pick your starting point, follow the path, and level up at your own pace.
        </p>
        {!loading && (
          <>
            <div className="flex items-center justify-center gap-6 text-sm text-gray-500 pt-2">
              <span>{totalDecks} decks</span>
              <span>·</span>
              <span>{totalSlides} slides</span>
              <span>·</span>
              <span>Updated {data?.updatedAt ? new Date(data.updatedAt).toLocaleDateString() : 'recently'}</span>
            </div>
            {/* Progress bar */}
            <div className="max-w-md mx-auto pt-4">
              <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                <span>Your Progress</span>
                <span>{completedCount} of {trackableDecks.length} completed ({progressPercent}%)</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-green-500 to-emerald-500 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Recently Added Section */}
      {!loading && recentlyAdded.length > 0 && (
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              🆕 Recently Added
            </h2>
            <p className="text-xs text-gray-500 mt-1">New material — check these out</p>
          </div>
          <div className="overflow-x-auto pb-4 -mx-2 px-2">
            <div className="flex gap-4 min-w-min">
              {recentlyAdded.map(deck => (
                <RecentlyAddedCard
                  key={deck.id}
                  deck={deck}
                  onToggleComplete={toggleComplete}
                  isCompleted={completedDecks[deck.id]}
                />
              ))}
            </div>
          </div>
        </section>
      )}

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
        const config = CATEGORY_CONFIG[cat]
        if (!config) return null
        
        return (
          <section key={cat}>
            <SectionHero config={config} deckCount={decks.length} />
            
            {config.sequential ? (
              // Sequential layout
              <>
                <div className="hidden md:flex flex-row gap-0 items-stretch mb-4">
                  {decks.map((deck, idx) => (
                    <div key={deck.id} className="flex items-stretch">
                      <div className="flex-1 px-2">
                        <SequentialCard
                          deck={deck}
                          stepNum={idx + 1}
                          colorKey={config.color}
                          isNew={isNew(deck)}
                          isCompleted={completedDecks[deck.id]}
                          onToggleComplete={toggleComplete}
                        />
                      </div>
                      {idx < decks.length - 1 && (
                        <div className="flex items-center px-2">
                          <div className="text-2xl text-gray-600">→</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {/* Mobile: stack vertically */}
                <div className="flex md:hidden flex-col gap-4">
                  {decks.map((deck, idx) => (
                    <div key={deck.id}>
                      <SequentialCard
                        deck={deck}
                        stepNum={idx + 1}
                        colorKey={config.color}
                        isNew={isNew(deck)}
                        isCompleted={completedDecks[deck.id]}
                        onToggleComplete={toggleComplete}
                      />
                      {idx < decks.length - 1 && (
                        <div className="text-center py-2">
                          <div className="text-2xl text-gray-600">↓</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              // Independent grid layout
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {decks.map(deck => (
                  <IndependentCard
                    key={deck.id}
                    deck={deck}
                    colorKey={config.color}
                    isNew={isNew(deck)}
                    isCompleted={completedDecks[deck.id]}
                    onToggleComplete={toggleComplete}
                  />
                ))}
              </div>
            )}
          </section>
        )
      })}

      {!loading && presentations.length === 0 && (
        <div className="text-sm text-gray-500 py-8 text-center">No presentations found.</div>
      )}

      {/* Footer */}
      <div className="text-xs text-gray-600 text-center pt-6 border-t border-gray-800">
        Last updated {data?.updatedAt ? new Date(data.updatedAt).toLocaleDateString() : 'recently'} · Built by Wall·E 🤖
      </div>
    </div>
  )
}
