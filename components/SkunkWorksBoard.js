'use client'

import { useCallback, useEffect, useState } from 'react'

// ─── Local Design System ──────────────────────────────────────────────────────

function StatusPill({ label, value, tone = 'amber' }) {
  const toneMap = {
    violet: 'border-violet-500/30 bg-violet-500/12 text-violet-100',
    cyan: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100',
    emerald: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100',
    amber: 'border-amber-400/30 bg-amber-400/10 text-amber-100',
    rose: 'border-rose-400/30 bg-rose-400/10 text-rose-100',
  }
  return (
    <div className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] ${toneMap[tone] || toneMap.amber}`}>
      {label}: <span className="ml-1">{value}</span>
    </div>
  )
}

function Meter({ label, value, tone = 'amber' }) {
  const barMap = {
    violet: 'from-violet-500 via-fuchsia-400 to-cyan-400',
    cyan: 'from-cyan-500 via-sky-400 to-violet-400',
    emerald: 'from-emerald-500 via-teal-400 to-cyan-400',
    amber: 'from-amber-500 via-orange-400 to-rose-400',
    rose: 'from-rose-500 via-fuchsia-400 to-violet-400',
  }
  return (
    <div className="space-y-2 rounded-2xl border border-white/8 bg-black/30 p-4">
      <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.18em] text-gray-400">
        <span>{label}</span>
        <span className="text-white">{value}%</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-white/8">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${barMap[tone] || barMap.amber}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )
}

function HUDFrame({ title, eyebrow, tone = 'amber', children, aside }) {
  const toneMap = {
    violet: 'border-violet-500/30 shadow-[0_0_45px_rgba(120,70,255,0.12)]',
    cyan: 'border-cyan-400/30 shadow-[0_0_45px_rgba(20,200,255,0.10)]',
    emerald: 'border-emerald-400/30 shadow-[0_0_45px_rgba(16,185,129,0.10)]',
    amber: 'border-amber-400/30 shadow-[0_0_45px_rgba(245,158,11,0.10)]',
    rose: 'border-rose-400/30 shadow-[0_0_45px_rgba(251,113,133,0.10)]',
  }
  return (
    <section
      className={`relative overflow-hidden rounded-[26px] border bg-[linear-gradient(180deg,rgba(12,12,18,0.96),rgba(8,8,12,1))] p-6 ${toneMap[tone] || toneMap.amber}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.10),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.03),transparent_35%,rgba(255,255,255,0.02))]" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          {eyebrow ? (
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gray-400">{eyebrow}</div>
          ) : null}
          <h2 className="mt-2 text-lg font-semibold text-white">{title}</h2>
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
      <div className="relative mt-5 text-sm text-gray-300">{children}</div>
    </section>
  )
}

function TacticalList({ items, tone = 'amber' }) {
  const bulletMap = {
    violet: 'bg-violet-400',
    cyan: 'bg-cyan-400',
    emerald: 'bg-emerald-400',
    amber: 'bg-amber-400',
    rose: 'bg-rose-400',
  }
  return (
    <ul className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3 rounded-2xl border border-white/6 bg-black/20 px-4 py-3">
          <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${bulletMap[tone] || bulletMap.amber}`} />
          <span className="text-sm leading-6 text-gray-200">{item}</span>
        </li>
      ))}
    </ul>
  )
}

// ─── Workflow Card ────────────────────────────────────────────────────────────

function WorkflowCard({ name, owner, status, accuracy, notes, tone = 'amber' }) {
  const statusTone = {
    'In Progress': 'amber',
    'To Do': 'violet',
    Backlog: 'cyan',
    Done: 'emerald',
  }
  const st = statusTone[status] || 'amber'
  const stMap = {
    violet: 'border-violet-500/30 bg-violet-500/12 text-violet-100',
    cyan: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100',
    emerald: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100',
    amber: 'border-amber-400/30 bg-amber-400/10 text-amber-100',
  }

  return (
    <div className="rounded-[22px] border border-white/10 bg-black/30 p-5 shadow-[0_0_30px_rgba(245,158,11,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-white">{name}</div>
          <div className="mt-1 text-xs text-gray-400">
            Owner: <span className="text-amber-200 font-medium">{owner}</span>
          </div>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${stMap[st] || stMap.amber}`}>
          {status}
        </span>
      </div>
      <div className="mt-4">
        <Meter label="Accuracy" value={accuracy} tone={accuracy >= 99 ? 'emerald' : accuracy >= 75 ? 'amber' : 'rose'} />
      </div>
      <ul className="mt-4 space-y-2">
        {notes.map((n, i) => (
          <li key={i} className="flex items-start gap-2 text-xs leading-5 text-gray-400">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/60" />
            {n}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Kanban Task Card ─────────────────────────────────────────────────────────

function KanbanCard({ task }) {
  const [expanded, setExpanded] = useState(false)

  const priorityTone = {
    high: 'text-rose-300',
    medium: 'text-amber-300',
    low: 'text-gray-400',
  }

  return (
    <div
      className="cursor-pointer rounded-2xl border border-white/8 bg-black/25 p-3 transition hover:border-amber-500/30"
      onClick={() => setExpanded((v) => !v)}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">#{task.id}</div>
          <div className="mt-0.5 text-sm font-medium text-white leading-5">{task.title}</div>
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-[0.16em] shrink-0 ${priorityTone[task.priority] || 'text-gray-400'}`}>
          {task.priority}
        </span>
      </div>
      {task.owner ? (
        <div className="mt-2 text-[11px] text-amber-200/70">👤 {task.owner}</div>
      ) : null}
      {expanded ? (
        <div className="mt-3 space-y-2 border-t border-white/8 pt-3 text-xs text-gray-400">
          {task.description ? <p className="leading-5">{task.description}</p> : null}
          {task.nextSteps && task.nextSteps.length ? (
            <ul className="space-y-1">
              {task.nextSteps.map((s, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/50" />
                  {s}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

// ─── Kanban Board ─────────────────────────────────────────────────────────────

const KANBAN_COLS = [
  { key: 'backlog', label: 'Backlog', tone: 'gray' },
  { key: 'in_progress', label: 'In Progress', tone: 'amber' },
  { key: 'review', label: 'Review', tone: 'violet' },
  { key: 'done', label: 'Done', tone: 'emerald' },
]

function KanbanBoard({ tasks }) {
  const colHeaderMap = {
    gray: 'text-gray-400 border-gray-500/30 bg-gray-500/10',
    amber: 'text-amber-200 border-amber-500/30 bg-amber-500/10',
    violet: 'text-violet-200 border-violet-500/30 bg-violet-500/10',
    emerald: 'text-emerald-200 border-emerald-500/30 bg-emerald-500/10',
  }

  return (
    <div className="grid gap-4 xl:grid-cols-4">
      {KANBAN_COLS.map((col) => {
        const colTasks = tasks.filter((t) => {
          const s = (t.status || '').toLowerCase().replace(/\s+/g, '_')
          return s === col.key
        })
        return (
          <div key={col.key} className="flex flex-col gap-3">
            <div
              className={`rounded-xl border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.20em] ${colHeaderMap[col.tone]}`}
            >
              {col.label} <span className="ml-1 opacity-60">({colTasks.length})</span>
            </div>
            {colTasks.length === 0 ? (
              <div className="rounded-2xl border border-white/6 bg-black/10 px-3 py-4 text-center text-xs text-gray-600">
                Empty
              </div>
            ) : null}
            {colTasks.map((t) => (
              <KanbanCard key={t.id} task={t} />
            ))}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Board ───────────────────────────────────────────────────────────────

export default function SkunkWorksBoard() {
  const [tasks, setTasks] = useState([])
  const [tasksLoading, setTasksLoading] = useState(true)

  const loadTasks = useCallback(async () => {
    setTasksLoading(true)
    try {
      const res = await fetch('/api/mission-control/tasks', { cache: 'no-store' })
      const json = await res.json()
      const all = Array.isArray(json) ? json : (json.tasks || [])
      setTasks(all.filter((t) => t.project === 'Skunk Works'))
    } catch {
      setTasks([])
    }
    setTasksLoading(false)
  }, [])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-[30px] border border-amber-500/30 bg-[linear-gradient(180deg,rgba(20,12,4,0.97),rgba(7,7,10,1))] p-8 shadow-[0_0_80px_rgba(200,100,10,0.22)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.12),transparent_26%),radial-gradient(circle_at_top_right,rgba(245,158,11,0.16),transparent_30%),linear-gradient(90deg,transparent,rgba(255,255,255,0.02),transparent)]" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-300">
              GYC AI Automation Lab
            </div>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-white">⚗️ Skunk Works</h1>
            <p className="mt-3 text-sm leading-6 text-gray-300">
              Validating workflows before they scale. Every pipeline must hit 75%+ effort reduction and 99%+ accuracy
              before promoting to M3.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill label="Phase" value="Active" tone="amber" />
            <StatusPill label="Target" value="75%+ Effort Reduction" tone="amber" />
            <StatusPill label="Quality Bar" value="99% Accuracy" tone="emerald" />
            <StatusPill label="Promotes To" value="M3" tone="violet" />
          </div>
        </div>
      </div>

      {/* ── Section 1: Mission ──────────────────────────────────────────── */}
      <HUDFrame title="Mission" tone="amber">
        <div className="grid gap-6 xl:grid-cols-2">
          <div>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.26em] text-amber-300">Goals</div>
            <TacticalList
              tone="amber"
              items={[
                'Reduce time-to-launch AND human effort by >75% on every workflow',
                'If it took 4 hours before, it takes 1 hour or less after',
                'If it took 1 week queue-to-delivery, it now takes 1.5 days',
                'Minimum threshold: 75% reduction. No exceptions.',
              ]}
            />
          </div>
          <div>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.26em] text-amber-300">Why It Matters</div>
            <TacticalList
              tone="amber"
              items={[
                'Competitors are doing this right now — we move first or get buried',
                'Lower costs → lower pricing → more competitive than anyone in the market',
                'Higher margins → capital to grow, hire, and burn out competitors',
                'Speed of delivery = perceived value for clients',
              ]}
            />
          </div>
        </div>
      </HUDFrame>

      {/* ── Section 2: Framework ────────────────────────────────────────── */}
      <HUDFrame title="The Framework — Every Workflow Must Follow This" tone="violet">
        {/* Step list */}
        <ol className="space-y-3 mb-6">
          {[
            {
              n: 1,
              title: 'Validate Inputs',
              desc: 'Confirm all required collateral exists (images, copy, brand guide, etc.) before any agent starts',
            },
            {
              n: 2,
              title: 'Skill File',
              desc: 'The AI instruction set for the specific task. One skill per micro-task.',
            },
            {
              n: 3,
              title: 'Reference File',
              desc: 'Examples of best-practice output. The quality bar the AI is aiming for.',
            },
            {
              n: 4,
              title: 'QC Sub-Agent',
              desc: 'Runs after the skill agent. Checks output against the reference file and spec. The reverse of the skill prompt.',
            },
            {
              n: 5,
              title: 'Human QC Gate',
              desc: 'Required if accuracy is below 99%. Once consistently ≥99%, the gate can be automated.',
            },
          ].map((step) => (
            <li
              key={step.n}
              className="flex items-start gap-4 rounded-2xl border border-violet-500/20 bg-violet-500/5 px-4 py-3"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-violet-400/40 bg-violet-500/20 text-xs font-black text-violet-200">
                {step.n}
              </span>
              <div>
                <div className="text-sm font-semibold text-violet-100">{step.title}</div>
                <div className="mt-0.5 text-xs leading-5 text-gray-400">{step.desc}</div>
              </div>
            </li>
          ))}
        </ol>

        {/* Accuracy thresholds callout */}
        <div className="rounded-[20px] border border-amber-500/30 bg-amber-500/8 p-5">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.26em] text-amber-300">
            Accuracy Thresholds
          </div>
          <ul className="space-y-2">
            {[
              {
                badge: '< 99%',
                tone: 'text-rose-300',
                text: 'Usable, but requires human judgment before passing to next step. Do NOT automate handoff.',
              },
              {
                badge: '≥ 99%',
                tone: 'text-emerald-300',
                text: 'Good-to-great output consistently. Eligible for automated handoff and M3 promotion.',
              },
              {
                badge: 'Chained Agents',
                tone: 'text-violet-300',
                text: 'Every agent in a chain must independently hit ≥99% before the handoff between them can be automated.',
              },
            ].map((row) => (
              <li key={row.badge} className="flex items-start gap-3 text-sm">
                <span className={`shrink-0 font-bold ${row.tone}`}>{row.badge}:</span>
                <span className="text-gray-300">{row.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </HUDFrame>

      {/* ── Section 3: Active Workflows ─────────────────────────────────── */}
      <HUDFrame title="Active Workflows" tone="cyan">
        <div className="grid gap-5 xl:grid-cols-3">
          <WorkflowCard
            name="Photo Pipeline"
            owner="Wall·E + Courtney"
            status="In Progress"
            accuracy={60}
            notes={[
              '4 sub-agents: Sort → Portrait resize → Landscape resize → Enhance',
              "Courtney's existing workflow covers basic rename/tag — needs decomposition",
              'Face alignment check for mobile (2/3 up screen) not yet built',
            ]}
          />
          <WorkflowCard
            name="Content/Copy Pipeline"
            owner="TBD"
            status="To Do"
            accuracy={0}
            notes={[
              'Skill file not yet built',
              'Reference file needed (best-practice childcare copy examples)',
              'Input validation: brand guide + client brief + target keywords',
            ]}
          />
          <WorkflowCard
            name="Video Pipeline"
            owner="Wall·E"
            status="Backlog"
            accuracy={0}
            notes={[
              'AI voice (ElevenLabs) + scene generation (Seedance/Runway)',
              'Internal team update videos — cartoon Todd format',
              'Also covers placeholder videos when client footage is delayed',
            ]}
          />
        </div>
      </HUDFrame>

      {/* ── Section 4: M3 Bridge ────────────────────────────────────────── */}
      <HUDFrame title="→ M3 Promotion Pipeline" tone="emerald">
        <p className="mb-6 text-sm leading-6 text-gray-400">
          Workflows that hit ≥99% accuracy consistently are promoted to the M3 roadmap. This is the engine that feeds
          M3 with validated, battle-tested AI pipelines.
        </p>

        {/* 3-stage pipeline visual */}
        <div className="mb-6 flex items-center gap-0">
          {[
            { icon: '⚗️', label: 'Experiment', tone: 'amber', border: 'border-amber-500/40 bg-amber-500/10 text-amber-200' },
            { icon: '🔬', label: 'Validate', tone: 'violet', border: 'border-violet-500/40 bg-violet-500/10 text-violet-200' },
            { icon: '🚀', label: 'Promote to M3', tone: 'emerald', border: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200' },
          ].map((stage, i) => (
            <div key={stage.label} className="flex items-center">
              <div
                className={`rounded-2xl border px-5 py-3 text-sm font-semibold ${stage.border}`}
              >
                {stage.icon} {stage.label}
              </div>
              {i < 2 ? (
                <div className="px-2 text-lg font-black text-gray-600">→</div>
              ) : null}
            </div>
          ))}
        </div>

        {/* M3 candidates */}
        <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-emerald-300 mb-3">
          M3 Promotion Candidates
        </div>
        <ul className="space-y-3">
          {[
            { name: 'Photo Pipeline', note: 'Awaiting 99% accuracy milestone' },
            { name: 'Content/Copy Pipeline', note: 'Not yet started' },
            { name: 'Agent Handoff Protocol', note: 'Engineering standard for M3 agent chains' },
            { name: '99% Quality Bar', note: 'Core M3 quality requirement' },
          ].map((item) => (
            <li
              key={item.name}
              className="flex items-center gap-4 rounded-2xl border border-emerald-400/15 bg-emerald-400/5 px-4 py-3"
            >
              <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
              <span className="text-sm font-semibold text-white">{item.name}</span>
              <span className="text-xs text-gray-500">{item.note}</span>
            </li>
          ))}
        </ul>
      </HUDFrame>

      {/* ── Section 5: Live Task Board ──────────────────────────────────── */}
      <HUDFrame title="Skunk Works Task Board" tone="violet">
        {tasksLoading ? (
          <div className="text-sm text-gray-400">Loading tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-6 text-center text-sm text-gray-500">
            No Skunk Works tasks found. Tasks with <code className="text-amber-300">project: "Skunk Works"</code> will appear here.
          </div>
        ) : (
          <KanbanBoard tasks={tasks} />
        )}
      </HUDFrame>

      {/* ── Section 6: Session Log ──────────────────────────────────────── */}
      <HUDFrame title="Session Log" tone="cyan">
        <p className="mb-5 text-sm leading-6 text-gray-400">
          Every session opens with a 2-minute big picture context. Log key decisions and outcomes here.
        </p>
        <div className="space-y-4">

          {/* Session 1 — summary + collapsed full notes */}
          <div className="rounded-[22px] border border-cyan-400/20 bg-cyan-400/5 p-5">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300">May 12, 2026</span>
              <span className="text-[11px] text-gray-500">Session 1 — Kickoff</span>
              <span className="ml-auto text-[10px] uppercase tracking-wider text-cyan-400/60">Attendees: Todd, Zac, Bruce, Courtney, Kaci, Hakeem</span>
            </div>

            {/* Key outcomes — always visible */}
            <ul className="space-y-2 mb-4">
              {[
                'Framework defined: Validate → Skill → Reference → QC Agent → Human (if <99%)',
                'Goal locked: 75%+ reduction in both time AND effort on every workflow — minimum, no exceptions',
                'Photo Pipeline selected as first full skill set build (4 sub-agents: sort, portrait resize, landscape resize, enhance)',
                'Ricky May resize/face-align step identified for automation — Kaci to test auto-crop agent',
                'End state: 4x business capacity, cut prices in half while doubling margins',
                'Workflows hitting 99% accuracy → promoted to M3 roadmap',
              ].map((bullet, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-gray-300">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400/70" />
                  {bullet}
                </li>
              ))}
            </ul>

            {/* Action items */}
            <div className="mb-4 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-300 mb-2">Action Items</div>
              <ul className="space-y-1.5">
                {[
                  { owner: 'Lex', item: 'Set up Claude GYC org account — everyone on this call gets a seat ($20/mo, upgrade to $100 if needed)' },
                  { owner: 'Kaci', item: 'Test service account (Elsa) for Google Drive image access in Courtney\'s script' },
                  { owner: 'Kaci', item: 'Test AI auto-crop agent — prompt with image type, face specifics, see output quality' },
                  { owner: 'Zac', item: 'Demo UGC AI ad video workflow at next session (workshop coming this month)' },
                  { owner: 'Hakeem + Courtney', item: 'Build Claude Design → Figma automation workflow; explore Figma → HTML export for landing pages' },
                  { owner: 'Courtney', item: 'Write setup instructions for Vincent for image renamer/selector script' },
                  { owner: 'Zac', item: 'Involve Aaron in workflow testing before anything goes to M3' },
                ].map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                    <span className="shrink-0 rounded-md border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">{a.owner}</span>
                    <span className="leading-5">{a.item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Collapsible full meeting notes */}
            <details className="group">
              <summary className="cursor-pointer list-none">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-400/70 hover:text-cyan-300 transition">
                  <span className="group-open:rotate-90 inline-block transition-transform">›</span>
                  Full Meeting Notes
                </div>
              </summary>
              <div className="mt-4 space-y-5 border-t border-white/8 pt-4">

                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-cyan-300 mb-2">Context &amp; Origin</div>
                  <p className="text-sm leading-6 text-gray-400">Meeting was originally the M3 tech/design sync. Zac reframed it as Skunk Works — named after Lockheed Martin&apos;s WWII advanced weapons division: no bureaucracy, no restrictions, just allowed to build. Cadence modelled on game development: demo, get Bruce&apos;s go-ahead, iterate. Not a think tank — a &quot;do tank.&quot; Goal of next 2 months: refine GYC&apos;s automation pipeline across all production lines.</p>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-cyan-300 mb-2">The Problem (Zac)</div>
                  <p className="text-sm leading-6 text-gray-400">Production lines are half-automated, half grunt work. People are working in silos — Todd/Kaci on one side, M3 (Aditya/Anam) on the other, Zac/Courtney floating. Biggest friction: production lines. Example: image selection pipeline is one step, but there are many more between it and final delivery (resize, face alignment, mobile crop) — all still manual. Ricky May spending hours on resizing that could take minutes.</p>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-cyan-300 mb-2">Bruce&apos;s Business Case</div>
                  <ul className="space-y-1.5">
                    {[
                      '75% time reduction → cut prices in half → double margin → double capacity → 2x revenue potential with same team',
                      'Speed = perception of value. Client pays, then waits — there\'s a threshold before they get annoyed (restaurant analogy)',
                      'Childcare agency market is consolidating — fewer agencies will survive. It\'s us or competitors. We move first or lose',
                      'AI is making everyone a creative director (no more pushing pixels) and a coder (prompt the software you need)',
                    ].map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-600" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-cyan-300 mb-2">Demo 1: Courtney — Claude Design for Industry Reports</div>
                  <ul className="space-y-1.5">
                    {[
                      'Build a design system (fonts, colors, graphics, examples) → upload doc → Claude formats it into a polished layout',
                      'Export as HTML → import into Figma → clean up → export as PDF',
                      'Time save: InDesign used to take 4 hours. Now ~1 hour (or less)',
                      'Also tested on Bluefish landing page — comparable quality to manual Figma work',
                      'Currently under personal Courtney account — needs GYC org Claude account to share with team',
                      'Bruce: set up org account like ChatGPT. $20/seat regular, $100/seat max. Lex to action.',
                    ].map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-600" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-cyan-300 mb-2">Demo 2: Courtney — Image Selector/Renamer Script</div>
                  <ul className="space-y-1.5">
                    {[
                      'Python script + Claude Vision API: dump images in folder, run script, images renamed with descriptive alt tags',
                      'Step 2: extract headlines from copy doc via ChatGPT prompt',
                      'Step 3: ChatGPT matches image filenames to headlines → outputs spreadsheet',
                      'Human reviews, uploads tagged images to Drive',
                      'Current limitation: must use local folder (Google Drive doesn\'t work yet — Kaci testing service account fix)',
                      'Bruce vision for M3: client connects Apple Photos → weekly auto-sync → tag by age (infant/toddler/preschool/school-age) + USP (STEM, creative, music, dance, outdoor, indoor, food) → searchable interface → auto-resize for mobile + landscape → powers automated ad creation',
                    ].map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-600" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-cyan-300 mb-2">Demo 3: Todd — Client Intelligence Dashboard</div>
                  <ul className="space-y-1.5">
                    {[
                      'New ACL pulling from Notion, Stripe, and GoHighLevel into one database',
                      'Client card showing: funnel data (tours, close rate, conversion), financials (Stripe MRR/LTV/payments), GBP health per location, website analytics (GA4), SEO heat maps (DataForSEO)',
                      'Weekly cron updates via Wall·E — eventually: heat map overlays showing change over time',
                      'Pending: client-facing vs internal labels on each data point; health score redesign',
                      'Bruce: page speed metric to be removed — not meaningful enough',
                      'Pipeline: technical SEO issues from dashboard → fed to Kaci\'s bot → queued for dev work',
                    ].map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-600" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-amber-300 mb-2">Bruce on the Methodology</div>
                  <p className="text-sm leading-6 text-gray-400 italic">&quot;AI is exceptionally good at taking the smallest derivative of a task and doing it well. It starts failing when you add complexity sideways. A 1% error in step 1 cascades — three steps later you&apos;re off by 15-20%. Each bot handles one tiny job. Chain them. If each step is clean, the chain is clean.&quot;</p>
                </div>

              </div>
            </details>
          </div>
        </div>
      </HUDFrame>

      {/* ── Section 7: Master Action Items ──────────────────────────────── */}
      <HUDFrame title="📋 Master Action Items" tone="amber">
        <p className="mb-5 text-sm leading-6 text-gray-400">
          All open action items across Skunk Works — grouped by owner. Click a name to expand their items.
        </p>
        <MasterActionItems />
      </HUDFrame>

    </div>
  )
}

// ─── Master Action Items ───────────────────────────────────────────────────
const ACTION_OWNERS = [
  {
    owner: 'Lex',
    tone: 'emerald',
    items: [
      {
        task: 'Set up Claude GYC org account — seats for everyone on the Skunk Works call',
        detail: '$20/mo per seat to start. Upgrade to $100 for heavy users. Mirror how ChatGPT org accounts are managed. Lex has the main account under Webmaster.',
        source: 'Session 1',
        status: 'open',
      },
    ],
  },
  {
    owner: 'Kaci',
    tone: 'cyan',
    items: [
      {
        task: 'Test service account for Google Drive image access in Courtney\'s script',
        detail: "Courtney's script requires local folder — can't read images directly from Google Drive. If the service account works, it eliminates the download/re-upload step entirely.",
        source: 'Session 1',
        status: 'open',
      },
      {
        task: 'Test AI auto-crop agent — face-centered, segment-aware cropping',
        detail: 'Prompt with image type + face specifics. Goal: eliminate Ricky May\'s manual Canva resize step. Zac mentioned Khyber may have a solution too.',
        source: 'Session 1',
        status: 'open',
      },
    ],
  },
  {
    owner: 'Zac',
    tone: 'violet',
    items: [
      {
        task: 'Demo UGC AI ad video workflow at next session',
        detail: 'Workshop coming this month. Show the group the full video ad generation pipeline and how it applies to our client ad workflow.',
        source: 'Session 1',
        status: 'open',
      },
      {
        task: 'Involve Aaron in workflow testing before anything goes to M3',
        detail: 'Aaron should verify/QA workflows at the pre-M3 gate. Needs a Claude org seat as part of the account setup.',
        source: 'Session 1',
        status: 'open',
      },
    ],
  },
  {
    owner: 'Courtney',
    tone: 'rose',
    items: [
      {
        task: 'Write setup instructions for Vincent — image renamer/selector script',
        detail: 'Full step-by-step so Vincent (and others) can run it independently. Lot of steps currently — once documented and set up it runs fast.',
        source: 'Session 1',
        status: 'open',
      },
      {
        task: 'Claude Design → Figma automation workflow (with Hakeem)',
        detail: 'Automate the HTML export → Figma import chain. Also explore Figma → HTML export for landing pages. Could unlock much faster templated site builds.',
        source: 'Session 1',
        status: 'open',
      },
    ],
  },
  {
    owner: 'Hakeem',
    tone: 'amber',
    items: [
      {
        task: 'Claude Design → Figma automation workflow (with Courtney)',
        detail: 'Automate the import/export chain. Hakeem has M3 context on how this connects to the broader design pipeline.',
        source: 'Session 1',
        status: 'open',
      },
    ],
  },
  {
    owner: 'Todd',
    tone: 'violet',
    items: [
      {
        task: 'Document current time benchmarks per workflow type',
        detail: 'Baseline is required before we can measure 75% reduction. List all workflow types. Log: active work time + queue/wait time per type. Create tracking sheet.',
        source: 'sw-003',
        status: 'open',
      },
      {
        task: 'Label each dashboard data point: client-facing or internal only',
        detail: 'Required before M3 handoff. Each element on the client card must be classified. Pending from Session 1 demo.',
        source: 'Session 1',
        status: 'open',
      },
    ],
  },
  {
    owner: 'Wall·E',
    tone: 'violet',
    items: [
      {
        task: 'Build QC Framework template (sw-001)',
        detail: 'Define: reference file format, QC agent prompt pattern (reverse of skill prompt), 99% accuracy threshold per output type (visual, copy, data). First implementation: Photo Pipeline.',
        source: 'sw-001',
        status: 'open',
      },
      {
        task: 'Build Photo Pipeline — 4 sub-agents (sw-002)',
        detail: 'Sort → Portrait resize + face alignment → Landscape resize + face alignment → Enhance. Each needs its own skill file + reference file + QC agent. Chain only after each hits 99%+.',
        source: 'sw-002',
        status: 'open',
      },
      {
        task: 'Pre-populate 2-min context block before each Skunk Works session',
        detail: 'Pull from Memory + Mission Control taskboard. Summarize: what shipped since last session, what\'s in flight, next milestone. Deliver to Todd before each meeting.',
        source: 'sw-004',
        status: 'open',
      },
    ],
  },
  {
    owner: 'Todd — M3 Decisions',
    tone: 'rose',
    items: [
      {
        task: 'Complete GBP map links file (Option B) — ~200+ locations',
        detail: 'HARD BLOCKER. Until complete: DataForSEO sync, heatmaps, GBP tab population, and Market Intel tab for all non-CTI clients are frozen. Everything downstream in the SEO/GBP pipeline waits on this file.',
        source: 'M3 Scope Q1',
        status: 'open',
      },
      {
        task: 'Decide: client-facing access model — login, read-only share, or internal-only for now?',
        detail: 'Option A: clients log in (requires client auth + data scoping build). Option B: GAs share read-only links/PDFs. Option C: internal-only at go-live, client-facing as Phase 2. Recommendation: Option C to ship faster. This is the single most scope-impactful decision.',
        source: 'M3 Scope Q2',
        status: 'open',
      },
      {
        task: 'Decide: Health Score — internal only or client-visible?',
        detail: 'If internal-only: keep current. If client-visible: major redesign needed (formula, weighting, display, explanation copy). Recommendation: internal-only first, expand later. This decision unlocks the Health Score redesign scope.',
        source: 'M3 Scope Q3',
        status: 'open',
      },
      {
        task: 'Decide: M3 IP arrangement — what access does Hakeem\'s team get?',
        detail: 'Does GYC retain codebase ownership? Does M3 fork it, read it, or rebuild from docs only? Is it one-way or can M3 commit back? Must be decided before any code is shared with Hakeem.',
        source: 'M3 Scope Q4',
        status: 'open',
      },
      {
        task: 'Decide: GYC Dashboard + M3 — converging or diverging long-term?',
        detail: 'Converging = same product, GYC dashboard becomes M3. Diverging = separate products that share a common origin. This changes the M3 architecture recommendation significantly.',
        source: 'M3 Scope Q5',
        status: 'open',
      },
      {
        task: 'Define what GHL/CRM data should appear on the CRM tab',
        detail: 'Pipeline stage? Open deals? Contact counts? Enrollment stage? Recent activity? This drives the schema and sync design. Travis needs access granted too.',
        source: 'M3 Scope Q6',
        status: 'open',
      },
      {
        task: 'Decide: paid media tab — go-live requirement or \u201ccoming soon\u201d?',
        detail: 'Meta + Google Ads APIs are both blocked on external parties (Kaci/Sebastian for Meta, Zac for Google). If paid media is required at go-live, it blocks the timeline. Recommendation: mark as coming soon for initial launch.',
        source: 'M3 Scope Q7',
        status: 'open',
      },
      {
        task: 'Approve ~$22.60 heatmap batch run cost',
        detail: 'One-time cost to run heatmaps for all 113 SEO client locations. Blocked on GBP map links file first. Just needs explicit approval before Wall\u00b7E triggers the batch.',
        source: 'M3 Scope Q13',
        status: 'open',
      },
      {
        task: 'Decide: custom domain for the dashboard?',
        detail: 'e.g., dashboard.growyourchildcare.com. Kaci needs this for DNS setup as part of Vercel deployment. Low priority but needs an answer before go-live.',
        source: 'M3 Scope Q12',
        status: 'open',
      },
      {
        task: 'Confirm Day 1 internal users + rollout approach (phased or all-at-once)',
        detail: 'Who gets access on go-live day? Recommend: Todd + Lex + one GA as pilot first. Full team rollout after smoke test. Need names to build accounts.',
        source: 'M3 Scope Q10',
        status: 'open',
      },
    ],
  },
  {
    owner: 'Todd + Wall\u00b7E — M3 Builds',
    tone: 'amber',
    items: [
      {
        task: 'GBP place_id bulk upsert + DataForSEO baseline sync (113 clients)',
        detail: 'Once map links file is complete: bulk upsert place_ids into GBPLocation table → run DataForSEO baseline sync → establishes day-zero baseline for all trend data. Wall\u00b7E runs scripts, Todd reviews output.',
        source: 'M3 Scope 1B',
        status: 'open',
      },
      {
        task: 'Heatmap batch run — 113 locations (~$22.60)',
        detail: 'Blocked on map links + Todd approval. Wall\u00b7E triggers batch, validates sample output. Runs after DataForSEO baseline sync.',
        source: 'M3 Scope 1C',
        status: 'open',
      },
      {
        task: 'Vercel deployment + environment variable migration',
        detail: 'Kaci sets up Vercel project. Wall\u00b7E connects git repo for auto-deploy on push. All env vars migrated from Mac Mini. Smoke test all major features. Custom domain configured once Todd decides on one.',
        source: 'M3 Scope 3A',
        status: 'open',
      },
      {
        task: 'Client card completeness audit — which cards are go-live ready',
        detail: 'Systematic check: which fields are populated, which are empty, which are wrong. Define \u201cminimum viable client card\u201d. Output: X clients ready, Y need specific data, Z blocked on dependency.',
        source: 'M3 Scope 2H',
        status: 'open',
      },
      {
        task: 'Internal team account creation + role mapping',
        detail: 'Create accounts for all Day 1 internal users once Todd confirms the list. Map each person to their role (admin, ga, cx, sales, etc.). Brief the team on what the dashboard is and isn\u2019t yet.',
        source: 'M3 Scope 3B',
        status: 'open',
      },
      {
        task: 'Health Score redesign (once decision on scope is made)',
        detail: 'Current formula is thin (billing signals only). Full redesign needs: what signals to include, weighting, scoring logic, client-visibility decision. Blocked on Todd\'s Q3 answer.',
        source: 'M3 Scope 2G',
        status: 'open',
      },
      {
        task: 'GHL / CRM tab integration (pending Travis providing API access)',
        detail: 'Build GHL nightly sync (ETL: GHL → Neon). Schema + CRM tab UI. Blocked on: Travis granting access AND Todd defining what CRM data to show.',
        source: 'M3 Scope 1G',
        status: 'open',
      },
      {
        task: 'M3 handoff documentation — architecture, schema, API routes, data sources',
        detail: 'Full stack doc: Next.js App Router, Neon Postgres, Prisma, Wall\u00b7E pipeline, auth system. ERD for all tables. API routes reference. Data sources guide (Stripe, DataForSEO, GA4, etc.). GYC-specific vs reusable component map.',
        source: 'M3 Scope WS4',
        status: 'open',
      },
      {
        task: 'Skunk Works → M3 validated workflow library tracking',
        detail: 'Track all Skunk Works workflows in a candidate registry. Flag each as: Experimental / Validated / Promoted. First batch: Photo Pipeline, Content/Copy, Video Pipeline. Promoted = enters M3 formal roadmap.',
        source: 'sw-m3-002',
        status: 'open',
      },
      {
        task: '99% accuracy standard — add to M3 engineering requirements',
        detail: 'Formal requirement: any agent pipeline in M3 must hit 99% accuracy before automated handoff. Define accuracy measurement methodology per output type. Build into M3 agent QC layer.',
        source: 'sw-m3-001',
        status: 'open',
      },
    ],
  },
]

const TONE_STYLES = {
  violet:  { border: 'border-violet-500/30',  bg: 'bg-violet-500/10',  text: 'text-violet-200',  dot: 'bg-violet-400',  badge: 'border-violet-500/30 bg-violet-500/10 text-violet-300' },
  cyan:    { border: 'border-cyan-400/30',    bg: 'bg-cyan-400/8',     text: 'text-cyan-200',    dot: 'bg-cyan-400',    badge: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300' },
  emerald: { border: 'border-emerald-400/30', bg: 'bg-emerald-400/8',  text: 'text-emerald-200', dot: 'bg-emerald-400', badge: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' },
  amber:   { border: 'border-amber-400/30',   bg: 'bg-amber-400/8',    text: 'text-amber-200',   dot: 'bg-amber-400',   badge: 'border-amber-400/30 bg-amber-400/10 text-amber-300' },
  rose:    { border: 'border-rose-400/30',    bg: 'bg-rose-400/8',     text: 'text-rose-200',    dot: 'bg-rose-400',    badge: 'border-rose-400/30 bg-rose-400/10 text-rose-300' },
}

function MasterActionItems() {
  const [open, setOpen] = useState({})
  const total = ACTION_OWNERS.reduce((sum, o) => sum + o.items.filter(i => i.status === 'open').length, 0)
  const allExpanded = ACTION_OWNERS.every(o => open[o.owner])

  return (
    <div className="space-y-2.5">
      {/* Summary + expand/collapse all */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <span className="text-sm text-gray-400">
          <span className="text-white font-semibold">{total}</span> open items across{' '}
          <span className="text-white font-semibold">{ACTION_OWNERS.length}</span> people
        </span>
        <button
          onClick={() => {
            const next = {}
            if (!allExpanded) ACTION_OWNERS.forEach(o => { next[o.owner] = true })
            setOpen(next)
          }}
          className="ml-auto text-[11px] uppercase tracking-wider text-amber-400/70 hover:text-amber-300 transition"
        >
          {allExpanded ? 'Collapse all' : 'Expand all'}
        </button>
      </div>

      {/* Per-owner accordion */}
      {ACTION_OWNERS.map((owner) => {
        const t = TONE_STYLES[owner.tone] || TONE_STYLES.amber
        const isOpen = !!open[owner.owner]
        const openCount = owner.items.filter(i => i.status === 'open').length

        return (
          <div key={owner.owner} className={`rounded-[18px] border ${t.border} overflow-hidden`}>
            {/* Header — click to toggle */}
            <button
              className={`w-full flex items-center gap-3 px-4 py-3.5 ${t.bg} hover:brightness-125 transition text-left`}
              onClick={() => setOpen(prev => ({ ...prev, [owner.owner]: !prev[owner.owner] }))}
            >
              <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${t.dot}`} />
              <span className={`font-semibold text-sm ${t.text}`}>{owner.owner}</span>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${t.badge}`}>
                {openCount} open
              </span>
              <span className={`ml-auto text-sm transition-transform duration-150 ${isOpen ? 'rotate-90' : ''} ${t.text}`}>›</span>
            </button>

            {/* Items list */}
            {isOpen && (
              <div className="divide-y divide-white/5">
                {owner.items.map((item, idx) => (
                  <div key={idx} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 flex-1">
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.status === 'open' ? t.dot : 'bg-emerald-400'}`} />
                        <span className="text-sm font-medium text-white leading-5">{item.task}</span>
                      </div>
                      <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        item.status === 'open'
                          ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                          : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      }`}>
                        {item.status === 'open' ? 'Open' : 'Done'}
                      </span>
                    </div>
                    <p className="mt-2 ml-[18px] text-xs leading-5 text-gray-400">{item.detail}</p>
                    <div className="mt-2 ml-[18px]">
                      <span className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-gray-500">
                        {item.source}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
