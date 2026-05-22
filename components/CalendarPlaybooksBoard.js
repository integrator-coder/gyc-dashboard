'use client'

import { useCallback, useEffect, useState } from 'react'

// ─── Design system helpers (matching M3IntegrationBoard) ──────────────────────

function StatusPill({ label, value, tone = 'cyan' }) {
  const toneMap = {
    violet: 'border-violet-500/30 bg-violet-500/12 text-violet-100',
    cyan: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100',
    emerald: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100',
    amber: 'border-amber-400/30 bg-amber-400/10 text-amber-100',
    rose: 'border-rose-400/30 bg-rose-400/10 text-rose-100',
  }
  return (
    <div className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] ${toneMap[tone] || toneMap.cyan}`}>
      {label}: <span className="ml-1">{value}</span>
    </div>
  )
}

function HUDFrame({ title, subtitle, eyebrow, tone = 'cyan', children, aside }) {
  const toneMap = {
    violet: 'border-violet-500/30 shadow-[0_0_45px_rgba(120,70,255,0.12)]',
    cyan: 'border-cyan-400/30 shadow-[0_0_45px_rgba(20,200,255,0.10)]',
    emerald: 'border-emerald-400/30 shadow-[0_0_45px_rgba(16,185,129,0.10)]',
    amber: 'border-amber-400/30 shadow-[0_0_45px_rgba(245,158,11,0.10)]',
    rose: 'border-rose-400/30 shadow-[0_0_45px_rgba(251,113,133,0.10)]',
  }
  return (
    <section className={`relative overflow-hidden rounded-[26px] border bg-[linear-gradient(180deg,rgba(12,12,18,0.96),rgba(8,8,12,1))] p-6 ${toneMap[tone] || toneMap.cyan}`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(20,200,255,0.08),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.03),transparent_35%,rgba(255,255,255,0.02))]" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          {eyebrow ? <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gray-400">{eyebrow}</div> : null}
          <h2 className="mt-2 text-lg font-semibold text-white">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm leading-5 text-gray-400">{subtitle}</p> : null}
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
      <div className="relative mt-5 text-sm text-gray-300">{children}</div>
    </section>
  )
}

function TacticalList({ items, tone = 'cyan' }) {
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
          <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${bulletMap[tone] || bulletMap.cyan}`} />
          <span className="text-sm leading-6 text-gray-200">{item}</span>
        </li>
      ))}
    </ul>
  )
}

// ─── Classification badge ─────────────────────────────────────────────────────
function ClassificationBadge({ status }) {
  const styleMap = {
    'pending-review': 'border-amber-500/40 bg-amber-500/10 text-amber-200',
    'classified': 'border-violet-500/40 bg-violet-500/10 text-violet-200',
    'active': 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
    'paused': 'border-gray-500/40 bg-gray-500/10 text-gray-300',
  }
  const labelMap = {
    'pending-review': '⏳ Pending Review',
    'classified': '✅ Classified',
    'active': '🟢 Active',
    'paused': '⏸ Paused',
  }
  return (
    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${styleMap[status] || styleMap['pending-review']}`}>
      {labelMap[status] || status}
    </span>
  )
}

// ─── Meeting card ─────────────────────────────────────────────────────────────
function MeetingCard({ meeting }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-black/30 p-5 shadow-[0_0_30px_rgba(20,200,255,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-base font-semibold text-white">{meeting.title}</div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400">
            <span>📅 {meeting.frequency}</span>
            <span>👥 {meeting.typicalAttendees}</span>
          </div>
        </div>
        <ClassificationBadge status={meeting.classificationStatus} />
      </div>

      <div className="mt-3 rounded-xl border border-white/6 bg-black/20 px-3 py-2">
        {meeting.workflow ? (
          <div className="text-xs text-cyan-200">
            <span className="font-semibold uppercase tracking-[0.14em] text-gray-400">Workflow: </span>
            {meeting.workflow}
          </div>
        ) : (
          <div className="text-xs text-gray-500 italic">No workflow set — review required</div>
        )}
      </div>

      {meeting.notes ? (
        <div className="mt-2 text-xs leading-5 text-gray-400">{meeting.notes}</div>
      ) : null}

      <div className="mt-3 flex justify-end">
        <button
          disabled
          className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-gray-500 cursor-not-allowed opacity-50"
          title="Editing available in a future update"
        >
          Edit
        </button>
      </div>
    </div>
  )
}

// ─── Main board ───────────────────────────────────────────────────────────────
export default function CalendarPlaybooksBoard() {
  const [data, setData] = useState({ meetings: [], calendarConnected: false, workflowOptions: [] })
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/mission-control/meeting-playbooks', { cache: 'no-store' })
      const json = await res.json()
      setData(json)
    } catch {
      setData({ meetings: [], calendarConnected: false, workflowOptions: [] })
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const meetings = data?.meetings || []
  const classified = meetings.filter((m) => m.classificationStatus !== 'pending-review').length
  const active = meetings.filter((m) => m.workflowStatus === 'active').length
  const calendarConnected = data?.calendarConnected || false
  const workflowOptions = data?.workflowOptions || []

  return (
    <div className="space-y-6">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-[30px] border border-cyan-400/30 bg-[linear-gradient(180deg,rgba(10,18,28,0.97),rgba(7,7,10,1))] p-8 shadow-[0_0_80px_rgba(20,200,255,0.18)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(20,200,255,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(120,70,255,0.10),transparent_30%)]" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">Mission Control // Calendar & Automations</div>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-white">📅 Calendar & Meeting Playbooks</h1>
            <p className="mt-3 text-sm leading-6 text-gray-300">
              Review and classify each meeting type before any automation runs. Nothing fires until you approve the workflow.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill
              label="Calendar"
              value={calendarConnected ? 'Connected' : 'Not Connected'}
              tone={calendarConnected ? 'emerald' : 'rose'}
            />
            <StatusPill
              label="Meetings Classified"
              value={`${classified} / ${meetings.length}`}
              tone="cyan"
            />
            <StatusPill
              label="Automations Active"
              value={String(active)}
              tone={active > 0 ? 'emerald' : 'amber'}
            />
          </div>
        </div>
      </div>

      {/* ─── Calendar Setup ──────────────────────────────────────────────── */}
      <HUDFrame
        title="Calendar Connection"
        eyebrow="Setup Required"
        tone={calendarConnected ? 'emerald' : 'rose'}
        aside={<StatusPill label="status" value={calendarConnected ? 'Connected' : 'Not Connected'} tone={calendarConnected ? 'emerald' : 'rose'} />}
      >
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">What's Needed</div>
            <TacticalList
              tone="rose"
              items={[
                'Share your Google Calendar with: wall-e@hybrid-shine-489717-e0.iam.gserviceaccount.com',
                'View-only access is sufficient',
                'Zoom API already connected ✅',
                'Notion: API token + workspace needed',
              ]}
            />
          </div>
          <div>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">How It Works</div>
            <TacticalList
              tone="cyan"
              items={[
                'Cron polls calendar every 10 min for meetings that ended in the last 15 min',
                'Meeting title matched against playbooks below',
                'Playbook fires ONLY if classificationStatus = \'active\'',
                'Unclassified meetings → flagged to Todd for review, no action taken',
                'All processed meetings logged with outcome',
              ]}
            />
          </div>
        </div>
      </HUDFrame>

      {/* ─── Meeting Registry ─────────────────────────────────────────────── */}
      <HUDFrame
        title="Meeting Types & Playbooks"
        eyebrow="Meeting Registry"
        tone="cyan"
        subtitle="Every meeting type listed below. Each must be reviewed and classified before any workflow can run."
        aside={<StatusPill label="total" value={String(meetings.length)} tone="cyan" />}
      >
        {loading ? (
          <div className="py-6 text-center text-sm text-gray-400">Loading meeting registry...</div>
        ) : meetings.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-black/20 py-10 text-center text-sm text-gray-400">
            No meetings registered yet.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {meetings.map((meeting) => (
              <MeetingCard key={meeting.id} meeting={meeting} />
            ))}
          </div>
        )}
      </HUDFrame>

      {/* ─── How Classification Works ────────────────────────────────────── */}
      <HUDFrame
        title="How to Classify a Meeting"
        eyebrow="Classification Guide"
        tone="violet"
      >
        <div className="space-y-4">
          <ol className="space-y-3">
            {[
              {
                n: 1,
                label: 'Review',
                text: 'Read the meeting type card above. Confirm the title pattern, frequency, and attendees are correct.',
              },
              {
                n: 2,
                label: 'Define the workflow',
                text: 'Decide what happens after this meeting ends. Options: Notion page, Google Doc, Slack post, Mission Control task update, Vision Board entry, or no action.',
              },
              {
                n: 3,
                label: 'Approve',
                text: "Tell Wall·E the workflow is approved. Status changes from Pending → Active.",
              },
              {
                n: 4,
                label: 'Amend anytime',
                text: "If a meeting's purpose changes, update the playbook. Nothing is permanent.",
              },
            ].map(({ n, label, text }) => (
              <li key={n} className="flex items-start gap-4 rounded-2xl border border-white/6 bg-black/20 px-4 py-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-xs font-bold text-violet-200">
                  {n}
                </span>
                <span className="text-sm leading-6 text-gray-200">
                  <span className="font-semibold text-white">{label} — </span>
                  {text}
                </span>
              </li>
            ))}
          </ol>

          <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-4">
            <div className="flex items-start gap-3 text-sm text-amber-100">
              <span className="shrink-0 text-base">⚠️</span>
              <span className="leading-6">
                <span className="font-semibold">Nothing runs automatically</span> until a meeting is explicitly set to Active. Pending meetings are logged but no action is taken.
              </span>
            </div>
          </div>
        </div>
      </HUDFrame>

      {/* ─── Workflow Options Reference ───────────────────────────────────── */}
      <HUDFrame
        title="Available Workflow Actions"
        eyebrow="Workflow Reference"
        tone="amber"
        subtitle="These are the options available when classifying a meeting type. Tell Wall·E which one applies."
      >
        <div className="flex flex-wrap gap-2 pt-1">
          {workflowOptions.length === 0 ? (
            <span className="text-sm text-gray-500">No workflow options defined yet.</span>
          ) : (
            workflowOptions.map((opt) => (
              <span
                key={opt}
                className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-100"
              >
                {opt}
              </span>
            ))
          )}
        </div>
      </HUDFrame>
    </div>
  )
}
