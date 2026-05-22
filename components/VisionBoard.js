'use client'

import { useCallback, useEffect, useState } from 'react'

// ─── Section config ───────────────────────────────────────────────────────────
const SECTION_ORDER = [
  { key: 'brucesDirection', tone: 'amber',   icon: '🧭' },
  { key: 'vision',          tone: 'violet',  icon: '🌟' },
  { key: 'goals90Day',      tone: 'cyan',    icon: '🎯' },
  { key: 'activePriorities',tone: 'emerald', icon: '⚡' },
  { key: 'openQuestions',   tone: 'rose',    icon: '❓' },
  { key: 'decisions',       tone: 'violet',  icon: '✅' },
  { key: 'wins',            tone: 'emerald', icon: '🏆' },
  { key: 'personal',        tone: 'amber',   icon: '🌱' },
]

// ─── Design helpers ───────────────────────────────────────────────────────────
function HUDFrame({ title, subtitle, tone = 'violet', icon, children, aside }) {
  const toneMap = {
    violet:  'border-violet-500/35 shadow-[0_0_50px_rgba(120,70,255,0.14)]',
    cyan:    'border-cyan-400/30 shadow-[0_0_50px_rgba(20,200,255,0.10)]',
    emerald: 'border-emerald-400/30 shadow-[0_0_50px_rgba(16,185,129,0.10)]',
    amber:   'border-amber-400/30 shadow-[0_0_50px_rgba(245,158,11,0.12)]',
    rose:    'border-rose-400/30 shadow-[0_0_50px_rgba(251,113,133,0.10)]',
  }

  const glowMap = {
    violet:  'rgba(168,85,247,0.12)',
    cyan:    'rgba(20,200,255,0.08)',
    emerald: 'rgba(52,211,153,0.08)',
    amber:   'rgba(245,158,11,0.10)',
    rose:    'rgba(251,113,133,0.08)',
  }

  return (
    <section
      className={`relative overflow-hidden rounded-[26px] border bg-[linear-gradient(180deg,rgba(14,10,22,0.97),rgba(8,8,12,1))] p-6 ${toneMap[tone] || toneMap.violet}`}
      style={{ backgroundImage: `radial-gradient(circle at top right, ${glowMap[tone] || glowMap.violet}, transparent 35%), linear-gradient(180deg,rgba(14,10,22,0.97),rgba(8,8,12,1))` }}
    >
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {icon ? <span className="text-lg">{icon}</span> : null}
            <h2 className="text-base font-bold text-white">{title}</h2>
          </div>
          {subtitle ? <p className="mt-1 text-xs leading-5 text-gray-400 italic">{subtitle}</p> : null}
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
      <div className="relative mt-4 text-sm text-gray-300">{children}</div>
    </section>
  )
}

function TacticalList({ items, tone = 'violet' }) {
  const bulletMap = {
    violet:  'bg-violet-400',
    cyan:    'bg-cyan-400',
    emerald: 'bg-emerald-400',
    amber:   'bg-amber-400',
    rose:    'bg-rose-400',
  }
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3 rounded-2xl border border-white/6 bg-black/20 px-4 py-3">
          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${bulletMap[tone] || bulletMap.violet}`} />
          <span className="text-sm leading-6 text-gray-200">{item}</span>
        </li>
      ))}
    </ul>
  )
}

function EmptySection({ tone, sectionKey }) {
  const colorMap = {
    violet:  'text-violet-400/60',
    cyan:    'text-cyan-400/60',
    emerald: 'text-emerald-400/60',
    amber:   'text-amber-400/60',
    rose:    'text-rose-400/60',
  }
  const messages = {
    brucesDirection: 'Ready — will be populated from 1:1s with Bruce once the meeting playbook is active.',
    vision:          'Ready — Todd\'s long-horizon vision will appear here after a strategic session with Wall·E.',
    goals90Day:      'Ready — 90-day commitments will be captured from the next 1:1 or planning session.',
    activePriorities:'Ready — Todd\'s current top priorities will be surfaced here.',
    openQuestions:   'Ready — questions to raise with Bruce will be logged here as they come up.',
    decisions:       'Ready — decisions from 1:1s will be captured and committed here.',
    wins:            'Ready — milestones and progress worth celebrating will appear here.',
    personal:        'Ready — growth areas and development themes will be tracked here.',
  }
  return (
    <div className={`rounded-2xl border border-white/6 bg-black/20 px-4 py-5 text-sm italic ${colorMap[tone] || colorMap.violet}`}>
      {messages[sectionKey] || 'Nothing here yet. Wall·E will populate this from your 1:1s once the meeting playbook is active.'}
    </div>
  )
}

// ─── Main board ───────────────────────────────────────────────────────────────
export default function VisionBoard() {
  const [data, setData] = useState({ sections: {}, updatedAt: null })
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/mission-control/vision-board', { cache: 'no-store' })
      const json = await res.json()
      setData(json)
    } catch {
      setData({ sections: {}, updatedAt: null })
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const sections = data?.sections || {}
  const updatedAt = data?.updatedAt ? new Date(data.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : null

  return (
    <div className="space-y-6">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-[30px] border border-violet-500/35 bg-[linear-gradient(160deg,rgba(20,10,40,0.98),rgba(8,7,12,1))] p-8 shadow-[0_0_100px_rgba(120,40,220,0.30)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.10),transparent_28%),linear-gradient(90deg,transparent,rgba(255,255,255,0.025),transparent)]" />
        {/* Gold accent strip */}
        <div className="pointer-events-none absolute left-0 right-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />

        <div className="relative">
          <div className="text-xs font-semibold uppercase tracking-[0.38em] text-amber-400/80">Mission Control // Private — Superadmin Only</div>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-white">🎯 Bruce's Vision Board</h1>
          <p className="mt-2 text-sm leading-6 text-violet-200/70">
            Todd's strategic direction, goals, and 1:1 insights — private.
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Visible to you only. Populated from 1:1s with Bruce and strategic sessions with Wall·E.
          </p>
          {updatedAt ? (
            <div className="mt-3 inline-flex rounded-full border border-amber-500/20 bg-amber-500/8 px-3 py-1 text-xs text-amber-200/60">
              Last updated: {updatedAt}
            </div>
          ) : null}
        </div>
      </div>

      {/* ─── Section grid ────────────────────────────────────────────────── */}
      {loading ? (
        <div className="py-16 text-center text-sm text-gray-400">Loading vision board...</div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {SECTION_ORDER.map(({ key, tone, icon }) => {
            const section = sections[key]
            if (!section) return null
            const items = section.items || []

            return (
              <HUDFrame
                key={key}
                title={section.title}
                subtitle={section.description}
                tone={tone}
                icon={icon}
              >
                {items.length === 0 ? (
                  <EmptySection tone={tone} sectionKey={key} />
                ) : (
                  <TacticalList items={items} tone={tone} />
                )}
              </HUDFrame>
            )
          })}
        </div>
      )}

      {/* ─── Footer note ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 px-5 py-4 text-sm text-violet-200/60">
        <span className="font-semibold text-violet-300">How this gets populated:</span>{' '}
        After your 1:1 with Bruce, Wall·E will ask about key insights, decisions, and direction. Those notes update this board automatically once the meeting playbook is active. You can also tell Wall·E anything worth capturing at any time.
      </div>
    </div>
  )
}
