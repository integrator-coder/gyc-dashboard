'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

function StatusPill({ label, value, tone = 'violet' }) {
  const toneMap = {
    violet: 'border-violet-500/30 bg-violet-500/12 text-violet-100',
    cyan: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100',
    emerald: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100',
    amber: 'border-amber-400/30 bg-amber-400/10 text-amber-100',
    rose: 'border-rose-400/30 bg-rose-400/10 text-rose-100',
  }

  return (
    <div className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] ${toneMap[tone] || toneMap.violet}`}>
      {label}: <span className="ml-1">{value}</span>
    </div>
  )
}

function Meter({ label, value, tone = 'violet' }) {
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
        <div className={`h-full rounded-full bg-gradient-to-r ${barMap[tone] || barMap.violet}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function HUDFrame({ title, eyebrow, tone = 'violet', children, aside }) {
  const toneMap = {
    violet: 'border-violet-500/30 shadow-[0_0_45px_rgba(120,70,255,0.12)]',
    cyan: 'border-cyan-400/30 shadow-[0_0_45px_rgba(20,200,255,0.10)]',
    emerald: 'border-emerald-400/30 shadow-[0_0_45px_rgba(16,185,129,0.10)]',
    amber: 'border-amber-400/30 shadow-[0_0_45px_rgba(245,158,11,0.10)]',
    rose: 'border-rose-400/30 shadow-[0_0_45px_rgba(251,113,133,0.10)]',
  }

  return (
    <section className={`relative overflow-hidden rounded-[26px] border bg-[linear-gradient(180deg,rgba(12,12,18,0.96),rgba(8,8,12,1))] p-6 ${toneMap[tone] || toneMap.violet}`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,0.14),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.03),transparent_35%,rgba(255,255,255,0.02))]" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          {eyebrow ? <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gray-400">{eyebrow}</div> : null}
          <h2 className="mt-2 text-lg font-semibold text-white">{title}</h2>
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
      <div className="relative mt-5 text-sm text-gray-300">{children}</div>
    </section>
  )
}

function TacticalList({ items, tone = 'violet' }) {
  const bulletMap = {
    violet: 'bg-violet-400',
    cyan: 'bg-cyan-400',
    emerald: 'bg-emerald-400',
    amber: 'bg-amber-400',
    rose: 'bg-rose-400',
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 rounded-2xl border border-white/6 bg-black/20 px-4 py-3">
          <span className={`mt-1 h-2.5 w-2.5 rounded-full ${bulletMap[tone] || bulletMap.violet}`} />
          <span className="text-sm leading-6 text-gray-200">{item}</span>
        </li>
      ))}
    </ul>
  )
}

function FactionCard({ title, role, tone, bullets }) {
  return (
    <HUDFrame title={title} eyebrow={role} tone={tone}>
      <TacticalList items={bullets} tone={tone} />
    </HUDFrame>
  )
}

function AuditBadge({ children, tone = 'violet' }) {
  const toneMap = {
    violet: 'border-violet-500/30 bg-violet-500/12 text-violet-100',
    cyan: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100',
    emerald: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100',
    amber: 'border-amber-400/30 bg-amber-400/10 text-amber-100',
    rose: 'border-rose-400/30 bg-rose-400/10 text-rose-100',
  }

  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${toneMap[tone] || toneMap.violet}`}>{children}</span>
}

function OverlapAuditTable({ rows, auditState, onAuditUpdate }) {
  const ownerTone = {
    M3: 'text-emerald-200',
    GYC: 'text-cyan-200',
    Shared: 'text-violet-200',
    Review: 'text-amber-200',
  }

  const overlapTone = {
    High: 'rose',
    Medium: 'amber',
    Low: 'emerald',
  }

  const actionTone = {
    'Keep Building': 'emerald',
    Review: 'amber',
    Handoff: 'violet',
    AlignNow: 'rose',
  }

  return (
    <div className="overflow-x-auto rounded-[22px] border border-white/10 bg-black/35">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-white/5 text-[11px] uppercase tracking-[0.22em] text-gray-400">
          <tr>
            <th className="px-4 py-3">Done</th>
            <th className="px-4 py-3">Feature</th>
            <th className="px-4 py-3">GYC Status</th>
            <th className="px-4 py-3">M3 Status</th>
            <th className="px-4 py-3">Overlap</th>
            <th className="px-4 py-3">Owner</th>
            <th className="px-4 py-3">Directive</th>
            <th className="px-4 py-3">Action</th>
            <th className="px-4 py-3">Controls</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const state = auditState?.[row.key] || {}
            const ownerValue = state.ownerOverride || row.owner
            const notesValue = state.notes || ''
            const done = !!state.done
            return (
              <>
                <tr key={row.key} className="border-t border-white/6 align-top">
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={(e) => onAuditUpdate(row.key, { done: e.target.checked })}
                      className="h-4 w-4 rounded border-white/20 bg-black/50 text-violet-500 focus:ring-violet-500"
                    />
                  </td>
                  <td className="px-4 py-4 text-white">{row.feature}</td>
                  <td className="px-4 py-4 text-gray-300">{row.gyc}</td>
                  <td className="px-4 py-4 text-gray-300">{row.m3}</td>
                  <td className="px-4 py-4"><AuditBadge tone={overlapTone[row.overlap] || 'amber'}>{row.overlap}</AuditBadge></td>
                  <td className={`px-4 py-4 font-medium ${ownerTone[ownerValue] || 'text-violet-200'}`}>{ownerValue}</td>
                  <td className="px-4 py-4"><AuditBadge tone={actionTone[row.directive] || 'violet'}>{row.directive}</AuditBadge></td>
                  <td className="px-4 py-4 text-gray-200">{row.action}</td>
                  <td className="px-4 py-4">
                    <button
                      onClick={() => onAuditUpdate(row.key, { expanded: !state.expanded })}
                      className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-gray-200 transition hover:border-violet-500/30 hover:text-white"
                    >
                      {state.expanded ? 'Hide' : 'Open'}
                    </button>
                  </td>
                </tr>
                {state.expanded ? (
                  <tr key={`${row.key}-expanded`} className="border-t border-white/6 bg-white/[0.02]">
                    <td colSpan={9} className="px-4 py-4">
                      <div className="grid gap-4 xl:grid-cols-[220px_1fr_220px]">
                        <div>
                          <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-gray-400">Owner Override</div>
                          <select
                            value={ownerValue}
                            onChange={(e) => onAuditUpdate(row.key, { ownerOverride: e.target.value })}
                            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-violet-500/40 focus:outline-none"
                          >
                            <option value="M3">M3</option>
                            <option value="GYC">GYC</option>
                            <option value="Shared">Shared</option>
                            <option value="Review">Review</option>
                          </select>
                        </div>
                        <div>
                          <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-gray-400">Notes / Commentary</div>
                          <textarea
                            value={notesValue}
                            onChange={(e) => onAuditUpdate(row.key, { notes: e.target.value })}
                            rows={4}
                            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-violet-500/40 focus:outline-none"
                            placeholder="Add what was learned, blockers, or exact alignment notes..."
                          />
                        </div>
                        <div>
                          <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-gray-400">Last Reviewed</div>
                          <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-gray-300">
                            {state.lastReviewedAt ? new Date(state.lastReviewedAt).toLocaleString() : 'Not reviewed yet'}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function QuestRow({ task, onToggle }) {
  const priorityTone = task.priority === 'high' ? 'text-amber-200' : task.priority === 'medium' ? 'text-cyan-200' : 'text-gray-300'
  const ownerColor = {
    Todd: 'text-violet-300',
    Zac: 'text-cyan-300',
    Hakeem: 'text-emerald-300',
    Kaci: 'text-sky-300',
    Travis: 'text-amber-300',
    Bruce: 'text-rose-300',
    Aditya: 'text-indigo-300',
    Anom: 'text-purple-300',
    Sara: 'text-pink-300',
    Aeron: 'text-teal-300',
    Lex: 'text-orange-300',
  }

  const ownerDisplay = task.owner || task.dev || null
  const ownerKey = ownerDisplay ? ownerDisplay.split(/[\s+\/]/)[0] : null
  const ownerClass = ownerKey && ownerColor[ownerKey] ? ownerColor[ownerKey] : 'text-gray-400'

  return (
    <label className={`flex items-start gap-3 rounded-2xl border px-4 py-3 transition ${task.done ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-white/8 bg-black/20 hover:border-violet-500/30'}`}>
      <input
        type="checkbox"
        checked={!!task.done}
        onChange={(e) => onToggle(task.id, e.target.checked)}
        className="mt-1 h-4 w-4 rounded border-white/20 bg-black/50 text-violet-500 focus:ring-violet-500"
      />
      <div className="min-w-0 flex-1">
        <div className={`text-sm font-medium ${task.done ? 'text-emerald-100 line-through' : 'text-white'}`}>{task.title}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-gray-400">
          {ownerDisplay ? <span className={`font-semibold ${ownerClass}`}>👤 {ownerDisplay}</span> : null}
          <span>{task.lane}</span>
          <span className={priorityTone}>● {task.priority}</span>
          {task.dueDate ? <span className="text-rose-300">Due {task.dueDate}</span> : null}
          {task.version ? <span className="text-gray-500">{task.version}</span> : null}
          {task.done ? <span className="text-emerald-300">completed</span> : <span>active</span>}
        </div>
        {task.description ? <div className="mt-1.5 text-xs leading-5 text-gray-500 line-clamp-2">{task.description}</div> : null}
      </div>
    </label>
  )
}

const OVERLAP_ROWS = [
  {
    key: 'leadership-kpi-dashboard',
    feature: 'Leadership KPI dashboard',
    gyc: 'Already built / actively used in GYC dashboard',
    m3: 'Hakeem indicated admin/super-user style surfacing is already feasible in M3',
    overlap: 'High',
    owner: 'Shared',
    directive: 'Handoff',
    action: 'Keep refining metrics at GYC, but treat M3 as long-term surface for integrated admin visibility.',
  },
  {
    key: 'client-hub-client-overview',
    feature: 'Client hub / client overview',
    gyc: 'Client card and overview pages already being built',
    m3: 'Client dashboard MVP is actively being built this sprint',
    overlap: 'High',
    owner: 'M3',
    directive: 'AlignNow',
    action: 'Do not let this become a parallel product; use GYC work as prototype input and module reference.',
  },
  {
    key: 'website-ux-analysis',
    feature: 'Website / UX analysis',
    gyc: 'Website tab exists with traffic, page speed, mobile friendliness, audit history',
    m3: 'Hakeem said UX/UI analysis already does some heavy lifting here',
    overlap: 'High',
    owner: 'Shared',
    directive: 'AlignNow',
    action: 'Audit exact duplicate signals and reduce duplicated presentation logic; keep GYC as proving ground.',
  },
  {
    key: 'seo-visibility',
    feature: 'SEO visibility',
    gyc: 'SEO tab planned / partially scaffolded',
    m3: 'Likely adjacent to website/UX analysis but not yet clearly mapped',
    overlap: 'Medium',
    owner: 'Review',
    directive: 'Review',
    action: 'Need clearer M3 doc review before more UI investment; avoid overbuilding until mapped.',
  },
  {
    key: 'gbp-google-auth-google-connected-surfaces',
    feature: 'GBP / Google auth / Google-connected surfaces',
    gyc: 'GBP work and Google-derived data are part of current dashboard direction',
    m3: 'Hakeem explicitly said Google auth already exists in M3',
    overlap: 'High',
    owner: 'M3',
    directive: 'AlignNow',
    action: 'Prefer consuming or aligning with M3 auth/integration patterns instead of inventing new ones.',
  },
  {
    key: 'client-tasks-communication-touchpoints',
    feature: 'Client tasks / communication touchpoints',
    gyc: 'Call classification, notes, Zendesk linkage, and client history concept are being built',
    m3: 'Client dashboard MVP includes task drops and growth-advisor touchpoints',
    overlap: 'High',
    owner: 'Shared',
    directive: 'AlignNow',
    action: 'Define strict boundary: M3 for client-facing interaction layer, GYC for internal ops intelligence unless promoted.',
  },
  {
    key: 'call-intelligence-transcript-archive',
    feature: 'Call intelligence / transcript archive',
    gyc: 'Strong active build direction around Zoom transcript filing and searchable history',
    m3: 'No explicit matching feature confirmed from meeting',
    overlap: 'Low',
    owner: 'GYC',
    directive: 'Keep Building',
    action: 'Continue as internal differentiator, but package as a modular handoff candidate later.',
  },
  {
    key: 'financial-stripe-visibility',
    feature: 'Financial / Stripe visibility',
    gyc: 'Finance tab, linkage review, dunning, churn, revenue views are active',
    m3: 'No evidence from meeting that equivalent client-safe financial module is active',
    overlap: 'Low',
    owner: 'GYC',
    directive: 'Keep Building',
    action: 'Keep internal-only and avoid exposing sensitive finance data client-facing; only port safe/admin views intentionally.',
  },
  {
    key: 'crm-enrollment-opportunity-views',
    feature: 'CRM / enrollment / opportunity views',
    gyc: 'Strong active direction with location-level enrollment and opportunity math',
    m3: 'Not enough confirmed from meeting to prove active overlap',
    overlap: 'Medium',
    owner: 'Review',
    directive: 'Review',
    action: 'Map against M3 roadmap before deeper build; could become a valuable module if not already covered.',
  },
  {
    key: 'design-workflow-ui-generation',
    feature: 'Design workflow / UI generation',
    gyc: 'Currently ad hoc but improving',
    m3: 'Pencil.dev workflow is actively being used by Hakeem side',
    overlap: 'Medium',
    owner: 'Shared',
    directive: 'Handoff',
    action: 'Adopt compatible design workflow so GYC prototypes move at M3 speed and feel closer to M3 patterns.',
  },
]

function ToolkitCard({ tool, onUpdate }) {
  const [expanded, setExpanded] = useState(false)
  const statusTone = {
    available: 'emerald',
    pilot: 'violet',
    research: 'amber',
    blocked: 'rose',
  }

  return (
    <div className="rounded-[24px] border border-white/10 bg-black/30 p-5 shadow-[0_0_35px_rgba(90,30,160,0.08)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-gray-400">{tool.category}</div>
          <div className="mt-1 text-lg font-semibold text-white">{tool.name}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <AuditBadge tone={statusTone[tool.status] || 'violet'}>{tool.status}</AuditBadge>
            <AuditBadge tone={tool.researchStatus === 'usable_now' ? 'emerald' : 'amber'}>{tool.researchStatus === 'usable_now' ? 'ready' : 'research needed'}</AuditBadge>
          </div>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-gray-200 transition hover:border-violet-500/30 hover:text-white"
        >
          {expanded ? 'Hide' : 'Open'}
        </button>
      </div>

      <p className="mt-4 text-sm leading-6 text-gray-300">{tool.summary}</p>

      {expanded ? (
        <div className="mt-5 space-y-4">
          <div>
            <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-gray-400">How it works</div>
            <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-gray-200">{tool.howItWorks || 'Not documented yet.'}</div>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <div>
              <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-gray-400">Workflow Ideas</div>
              <TacticalList items={tool.workflowIdeas?.length ? tool.workflowIdeas : ['No workflow ideas yet']} tone="cyan" />
            </div>
            <div>
              <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-gray-400">Future Projects</div>
              <TacticalList items={tool.projectIdeas?.length ? tool.projectIdeas : ['No project ideas yet']} tone="violet" />
            </div>
            <div>
              <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-gray-400">Unlocks</div>
              <TacticalList items={tool.unlocks?.length ? tool.unlocks : ['No unlocks logged yet']} tone="emerald" />
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_220px_220px]">
            <div>
              <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-gray-400">Notes</div>
              <textarea
                value={tool.notes || ''}
                onChange={(e) => onUpdate(tool.id, { notes: e.target.value })}
                rows={4}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-violet-500/40 focus:outline-none"
              />
            </div>
            <div>
              <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-gray-400">Status</div>
              <select
                value={tool.status || 'research'}
                onChange={(e) => onUpdate(tool.id, { status: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-violet-500/40 focus:outline-none"
              >
                <option value="research">research</option>
                <option value="pilot">pilot</option>
                <option value="available">available</option>
                <option value="blocked">blocked</option>
              </select>
            </div>
            <div>
              <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-gray-400">Source</div>
              <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-gray-300">{tool.source || 'unknown'}</div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div>
              <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-gray-400">Linked Ideas</div>
              <div className="flex flex-wrap gap-2">
                {(tool.linkedIdeas || []).map((idea) => <AuditBadge key={idea} tone="violet">{idea}</AuditBadge>)}
                {!tool.linkedIdeas?.length ? <span className="text-sm text-gray-500">No linked ideas yet.</span> : null}
              </div>
            </div>
            <div>
              <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-gray-400">Linked Tasks</div>
              <div className="flex flex-wrap gap-2">
                {(tool.linkedTasks || []).map((task) => <AuditBadge key={task} tone="amber">{task}</AuditBadge>)}
                {!tool.linkedTasks?.length ? <span className="text-sm text-gray-500">No linked tasks yet.</span> : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function M3IntegrationBoard({ report }) {
  const [data, setData] = useState({ tasks: [], updatedAt: null, audit: {} })
  const [toolkit, setToolkit] = useState({ tools: [], updatedAt: null })
  const [loading, setLoading] = useState(true)
  const [toolsLoading, setToolsLoading] = useState(true)
  const [newTask, setNewTask] = useState('')
  const [newTaskLane, setNewTaskLane] = useState('mission')
  const [newTaskPriority, setNewTaskPriority] = useState('medium')
  const [newTool, setNewTool] = useState('')
  const [saving, setSaving] = useState(false)
  const [ownerFilter, setOwnerFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('active')
  const [auditFilter, setAuditFilter] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/team/m3-integration', { cache: 'no-store' })
      const json = await res.json()
      setData(json)
    } catch {
      setData({ tasks: [], updatedAt: null, audit: {} })
    }
    setLoading(false)
  }, [])

  const loadToolkit = useCallback(async () => {
    setToolsLoading(true)
    try {
      const res = await fetch('/api/team/toolkit', { cache: 'no-store' })
      const json = await res.json()
      setToolkit(json)
    } catch {
      setToolkit({ tools: [], updatedAt: null })
    }
    setToolsLoading(false)
  }, [])

  useEffect(() => {
    load()
    loadToolkit()
  }, [load, loadToolkit])

  async function toggleTask(taskId, done) {
    setData((prev) => ({
      ...prev,
      tasks: (prev.tasks || []).map((task) => task.id === taskId ? { ...task, done } : task),
    }))

    await fetch('/api/team/m3-integration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle', taskId, done }),
    })
  }

  async function updateAudit(featureKey, patch) {
    setData((prev) => ({
      ...prev,
      audit: {
        ...(prev.audit || {}),
        [featureKey]: {
          ...((prev.audit || {})[featureKey] || {}),
          ...patch,
          lastReviewedAt: new Date().toISOString(),
        },
      },
    }))

    await fetch('/api/team/m3-integration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'updateAudit', featureKey, patch }),
    })
  }

  async function updateTool(toolId, patch) {
    setToolkit((prev) => ({
      ...prev,
      tools: (prev.tools || []).map((tool) => tool.id === toolId ? { ...tool, ...patch } : tool),
    }))

    await fetch('/api/team/toolkit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', toolId, patch }),
    })
  }

  async function addTool(e) {
    e.preventDefault()
    if (!newTool.trim()) return
    try {
      const res = await fetch('/api/team/toolkit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          tool: {
            name: newTool.trim(),
            category: 'other',
            status: 'research',
            source: 'manual add from Todd/Wall·E',
            summary: 'Newly added tool. Fulcrum research needed.',
            howItWorks: 'Dispatch Fulcrum to document exact usage steps.',
            workflowIdeas: ['Map tool to a real workflow'],
            projectIdeas: ['Find at least one blocked board/task this tool could unlock'],
            unlocks: ['Potential future unlock'],
            linkedIdeas: [],
            linkedTasks: [],
            notes: 'Needs initial research pass.',
            researchStatus: 'needs_fulcrum_playbook',
          },
        }),
      })
      const json = await res.json()
      if (json?.data) {
        setToolkit(json.data)
        setNewTool('')
      }
    } catch {}
  }

  async function addTask(e) {
    e.preventDefault()
    if (!newTask.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/team/m3-integration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', title: newTask.trim(), lane: newTaskLane, priority: newTaskPriority }),
      })
      const json = await res.json()
      if (json?.data) {
        setData(json.data)
        setNewTask('')
      }
    } finally {
      setSaving(false)
    }
  }

  const tasks = data?.tasks || []
  const completed = tasks.filter((t) => t.done).length
  const completionRate = tasks.length ? Math.round((completed / tasks.length) * 100) : 0
  const highPriorityOpen = tasks.filter((t) => !t.done && t.priority === 'high').length
  const missionTasks = tasks.filter((t) => t.lane === 'mission')
  const opsTasks = tasks.filter((t) => t.lane === 'ops')
  const designTasks = tasks.filter((t) => t.lane === 'design')
  const buildTasks = tasks.filter((t) => t.lane === 'build')
  const infraTasks = tasks.filter((t) => t.lane === 'infra')

  const priorityOrder = { high: 0, medium: 1, low: 2 }

  // Extract unique owners from all tasks
  const allOwners = useMemo(() => {
    const owners = new Set()
    tasks.forEach((t) => {
      const raw = t.owner || t.dev || ''
      // Handle compound owners like "Todd / Kaci" or "Aditya + Hakeem"
      raw.split(/[\s+\/,&]+/).forEach((name) => {
        const trimmed = name.trim()
        if (trimmed && trimmed.length > 1) owners.add(trimmed)
      })
    })
    return ['all', ...Array.from(owners).sort()]
  }, [tasks])

  const filteredTasks = useMemo(() => {
    return tasks
      .filter((t) => {
        // Status filter
        if (statusFilter === 'active' && t.done) return false
        if (statusFilter === 'completed' && !t.done) return false
        // Owner filter
        if (ownerFilter !== 'all') {
          const raw = (t.owner || t.dev || '').toLowerCase()
          if (!raw.includes(ownerFilter.toLowerCase())) return false
        }
        return true
      })
      .sort((a, b) => {
        // Completed tasks go to the bottom
        if (a.done !== b.done) return a.done ? 1 : -1
        // Tasks with due dates come first, sorted by date
        if (a.dueDate && !b.dueDate) return -1
        if (!a.dueDate && b.dueDate) return 1
        if (a.dueDate && b.dueDate) {
          const dateDiff = new Date(a.dueDate) - new Date(b.dueDate)
          if (dateDiff !== 0) return dateDiff
        }
        // Then sort by priority
        return (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2)
      })
  }, [tasks, ownerFilter, statusFilter])

  // Keep openTasks as an alias for backward compat
  const openTasks = filteredTasks

  const auditRows = useMemo(() => {
    if (auditFilter === 'all') return OVERLAP_ROWS
    if (auditFilter === 'high') return OVERLAP_ROWS.filter((row) => row.overlap === 'High')
    if (auditFilter === 'medium') return OVERLAP_ROWS.filter((row) => row.overlap === 'Medium')
    if (auditFilter === 'low') return OVERLAP_ROWS.filter((row) => row.overlap === 'Low')
    if (auditFilter === 'align-now') return OVERLAP_ROWS.filter((row) => row.directive === 'AlignNow')
    if (auditFilter === 'review') return OVERLAP_ROWS.filter((row) => row.directive === 'Review')
    if (auditFilter === 'keep-building') return OVERLAP_ROWS.filter((row) => row.directive === 'Keep Building')
    if (auditFilter === 'handoff') return OVERLAP_ROWS.filter((row) => row.directive === 'Handoff')
    return OVERLAP_ROWS
  }, [auditFilter])

  const auditSummary = {
    high: OVERLAP_ROWS.filter((row) => row.overlap === 'High').length,
    medium: OVERLAP_ROWS.filter((row) => row.overlap === 'Medium').length,
    low: OVERLAP_ROWS.filter((row) => row.overlap === 'Low').length,
    alignNow: OVERLAP_ROWS.filter((row) => row.directive === 'AlignNow').length,
    review: OVERLAP_ROWS.filter((row) => row.directive === 'Review').length,
    keepBuilding: OVERLAP_ROWS.filter((row) => row.directive === 'Keep Building').length,
    handoff: OVERLAP_ROWS.filter((row) => row.directive === 'Handoff').length,
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-[30px] border border-violet-500/30 bg-[linear-gradient(180deg,rgba(18,10,28,0.95),rgba(7,7,10,1))] p-8 shadow-[0_0_80px_rgba(95,35,180,0.28)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.14),transparent_26%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.18),transparent_30%),linear-gradient(90deg,transparent,rgba(255,255,255,0.03),transparent)]" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-4xl">
            <div className="text-xs font-semibold uppercase tracking-[0.35em] text-violet-300">Mission Control // Strategic Alignment Console</div>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-white">M3 Integration Project</h1>
            <p className="mt-3 text-sm leading-6 text-gray-300">
              A command-surface for staying synced with the M3 team: overlap control, integration targets, misalignment tracking,
              ownership rules, and next actions that keep Todd’s dashboard work useful without drifting into duplicate build lanes.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill label="alignment" value="active" tone="emerald" />
            <StatusPill label="mode" value="client-zero" tone="violet" />
            <StatusPill label="risk" value="duplicate-work" tone="amber" />
            <StatusPill label="open high-priority" value={String(highPriorityOpen)} tone="rose" />
          </div>
        </div>

        <div className="relative mt-6 grid gap-4 xl:grid-cols-4">
          <Meter label="Mission Completion" value={completionRate} tone="emerald" />
          <Meter label="Alignment Confidence" value={68} tone="emerald" />
          <Meter label="Overlap Audit" value={32} tone="amber" />
          <Meter label="Hand-off Readiness" value={41} tone="violet" />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <HUDFrame title="Quest Log" eyebrow="Interactive Mission Tasks" tone="violet" aside={<StatusPill label="tasks" value={`${completed}/${tasks.length}`} tone="violet" />}>
          <p className="mb-4 text-xs leading-5 text-gray-500">All active tasks across the M3 project — sorted by due date, then priority. Each task shows its owner, lane, and any deadline. Check tasks off as they’re completed. Add new tasks using the form below with lane and priority set.</p>
          <div className="mb-4 flex flex-wrap gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-violet-500/40 focus:outline-none"
            >
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="all">All</option>
            </select>
            <select
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-violet-500/40 focus:outline-none"
            >
              {allOwners.map((owner) => (
                <option key={owner} value={owner}>
                  {owner === 'all' ? 'All Owners' : owner}
                </option>
              ))}
            </select>
          </div>
          <form onSubmit={addTask} className="mb-4 flex flex-col gap-3 md:flex-row">
            <input
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              placeholder="Add a new M3 integration task..."
              className="flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:border-violet-500/40 focus:outline-none"
            />
            <select
              value={newTaskLane}
              onChange={(e) => setNewTaskLane(e.target.value)}
              className="rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-sm text-white focus:border-violet-500/40 focus:outline-none"
            >
              <option value="mission">Mission</option>
              <option value="ops">Ops</option>
              <option value="build">Build</option>
              <option value="infra">Infra</option>
              <option value="design">Design</option>
            </select>
            <select
              value={newTaskPriority}
              onChange={(e) => setNewTaskPriority(e.target.value)}
              className="rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-sm text-white focus:border-violet-500/40 focus:outline-none"
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl border border-violet-500/40 bg-violet-500/15 px-4 py-3 text-sm font-medium text-violet-100 transition hover:bg-violet-500/25 disabled:opacity-50"
            >
              {saving ? 'Adding...' : '+ Add Quest'}
            </button>
          </form>

          <div className="space-y-3">
            {loading ? <div className="text-sm text-gray-400">Loading quest log...</div> : null}
            {!loading && !tasks.length ? <div className="text-sm text-gray-400">No tasks yet.</div> : null}
            {!loading && (ownerFilter !== 'all' || statusFilter !== 'active') && (
              <div className="text-xs text-gray-500">
                Showing <span className="text-violet-300 font-semibold">{filteredTasks.length}</span> task{filteredTasks.length !== 1 ? 's' : ''}
                {ownerFilter !== 'all' ? <> assigned to <span className="text-violet-300 font-semibold">{ownerFilter}</span></> : null}
              </div>
            )}
            {filteredTasks.map((task) => <QuestRow key={task.id} task={task} onToggle={toggleTask} />)}
            {!loading && filteredTasks.length === 0 ? (
              <div className="text-sm text-gray-500">No tasks match the current filters.</div>
            ) : null}
          </div>
        </HUDFrame>

        <HUDFrame title="Threat Radar" eyebrow="Drift / Duplication / Ambiguity" tone="rose" aside={<StatusPill label="threat level" value="moderate" tone="rose" />}>
          <p className="mb-4 text-xs leading-5 text-gray-500">Active risks to the project — things that could cause wasted work, misaligned builds, or silent drift between GYC’s dashboard and M3’s roadmap. Review and discuss at every Skunkworks meeting.</p>
          <TacticalList
            tone="rose"
            items={[
              'Standalone-product drift instead of prototype-to-M3 thinking.',
              'Client-facing vs internal-only boundaries still need explicit labels.',
              'Overlap risk remains high until the audit is complete.',
              'Module ownership can still blur if alignment meetings do not happen regularly.',
            ]}
          />
        </HUDFrame>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <HUDFrame title="Mission Lane" eyebrow="Core Workstream" tone="emerald" aside={<StatusPill label="open" value={String(missionTasks.filter((t) => !t.done).length)} tone="emerald" />}>
          <p className="mb-4 text-xs leading-5 text-gray-500">Strategic work that defines direction — overlap audits, surface labeling, alignment decisions, and anything that determines what GYC builds vs what M3 owns.</p>
          <TacticalList tone="emerald" items={missionTasks.length ? missionTasks.map((t) => t.title) : ['No mission tasks yet']} />
        </HUDFrame>

        <HUDFrame title="Ops Lane" eyebrow="Coordination Layer" tone="amber" aside={<StatusPill label="open" value={String(opsTasks.filter((t) => !t.done).length)} tone="amber" />}>
          <p className="mb-4 text-xs leading-5 text-gray-500">People, process, and meeting cadence — scoping docs, Skunkworks prep, cross-team deliverables, and anything needed to keep GYC, M3, and Travis’s CRM roadmaps in sync.</p>
          <TacticalList tone="amber" items={opsTasks.length ? opsTasks.map((t) => t.title) : ['No ops tasks yet']} />
        </HUDFrame>

        <HUDFrame title="Build Lane" eyebrow="Active Development" tone="violet" aside={<StatusPill label="open" value={String(buildTasks.filter((t) => !t.done).length)} tone="violet" />}>
          <p className="mb-4 text-xs leading-5 text-gray-500">Features being actively developed or prototyped — M3 roadmap items, GYC-to-M3 handoff candidates, Pencil/AI tooling, and any working prototypes being built for dev intake.</p>
          <TacticalList tone="violet" items={buildTasks.length ? buildTasks.map((t) => t.title) : ['No build tasks yet']} />
        </HUDFrame>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <HUDFrame title="Infra Lane" eyebrow="Architecture / Data / Security" tone="cyan" aside={<StatusPill label="open" value={String(infraTasks.filter((t) => !t.done).length)} tone="cyan" />}>
          <p className="mb-4 text-xs leading-5 text-gray-500">Foundation work that everything else depends on — tenant safety, data access models, user roles, system integrations (GHL ↔ M3), and anything architectural that must be stable before features can ship.</p>
          <TacticalList tone="cyan" items={infraTasks.length ? infraTasks.map((t) => t.title) : ['No infra tasks yet']} />
        </HUDFrame>

        <HUDFrame title="Design Lane" eyebrow="UI / Pencil / Speed" tone="rose" aside={<StatusPill label="open" value={String(designTasks.filter((t) => !t.done).length)} tone="rose" />}>
          <p className="mb-4 text-xs leading-5 text-gray-500">UI/UX work and design tooling — Pencil AI design setup for Kaci and Wall·E, design system alignment with M3’s Shadcn/UI standard, and any mockups or visual prototypes before dev begins.</p>
          <TacticalList tone="rose" items={designTasks.length ? designTasks.map((t) => t.title) : ['No design tasks yet']} />
        </HUDFrame>
      </div>

      <HUDFrame title="Overlap Audit" eyebrow="First-Pass M3 vs GYC Map" tone="amber" aside={<StatusPill label="audit status" value="v1 draft" tone="amber" />}>
        <p className="mb-5 text-xs leading-5 text-gray-500">A feature-by-feature comparison of what GYC has already built vs what M3 is building. Use this to prevent duplicate work and decide what to hand off, keep internal, or align on ownership. Check the “Done” column when a feature’s ownership is resolved. Add notes to record what was decided and when.</p>
        <div className="mb-4 grid gap-4 xl:grid-cols-4">
          <Meter label="High Overlap Zones" value={Math.round((auditSummary.high / OVERLAP_ROWS.length) * 100)} tone="rose" />
          <Meter label="Needs Review" value={Math.round((auditSummary.review / OVERLAP_ROWS.length) * 100)} tone="amber" />
          <Meter label="Safe To Keep Building" value={Math.round((auditSummary.keepBuilding / OVERLAP_ROWS.length) * 100)} tone="emerald" />
          <Meter label="Ownership Clarity" value={46} tone="cyan" />
        </div>
        <div className="mb-4 grid gap-3 xl:grid-cols-4">
          <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4">
            <div className="text-[11px] uppercase tracking-[0.22em] text-rose-200">Must Align Now</div>
            <div className="mt-2 text-3xl font-black text-white">{auditSummary.alignNow}</div>
            <div className="mt-1 text-xs text-rose-100/80">High-risk duplicate-work zones</div>
          </div>
          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4">
            <div className="text-[11px] uppercase tracking-[0.22em] text-amber-200">Needs Review</div>
            <div className="mt-2 text-3xl font-black text-white">{auditSummary.review}</div>
            <div className="mt-1 text-xs text-amber-100/80">Areas blocked on clearer mapping</div>
          </div>
          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4">
            <div className="text-[11px] uppercase tracking-[0.22em] text-emerald-200">Safe To Keep Building</div>
            <div className="mt-2 text-3xl font-black text-white">{auditSummary.keepBuilding}</div>
            <div className="mt-1 text-xs text-emerald-100/80">Low-overlap internal differentiators</div>
          </div>
          <div className="rounded-2xl border border-violet-500/25 bg-violet-500/10 p-4">
            <div className="text-[11px] uppercase tracking-[0.22em] text-violet-200">Handoff Candidates</div>
            <div className="mt-2 text-3xl font-black text-white">{auditSummary.handoff}</div>
            <div className="mt-1 text-xs text-violet-100/80">Should be structured for shared adoption</div>
          </div>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {[
            ['all', 'All'],
            ['high', 'High'],
            ['medium', 'Medium'],
            ['low', 'Low'],
            ['align-now', 'Align Now'],
            ['review', 'Needs Review'],
            ['keep-building', 'Keep Building'],
            ['handoff', 'Handoff'],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setAuditFilter(value)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] transition ${auditFilter === value ? 'border-violet-500/40 bg-violet-500/15 text-violet-100' : 'border-white/10 bg-black/20 text-gray-300 hover:text-white'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <OverlapAuditTable rows={auditRows} auditState={data.audit || {}} onAuditUpdate={updateAudit} />
      </HUDFrame>

      <div className="grid gap-6 xl:grid-cols-4">
        <FactionCard
          title="Todd"
          role="Operator / Integrator"
          tone="violet"
          bullets={[
            'Owns GYC-side dashboard direction and operating needs.',
            'Needs clear guidance on what to keep building vs stop building.',
          ]}
        />
        <FactionCard
          title="Hakeem"
          role="Workflow / Sprint Command"
          tone="amber"
          bullets={[
            'Needs module inventory, overlap clarity, and ownership boundaries.',
            'Key partner for preventing duplicate work and structuring handoff.',
          ]}
        />
        <FactionCard
          title="Zac + Kaci"
          role="Design / UX / Delivery Interface"
          tone="cyan"
          bullets={[
            'Need alignment on client-facing surfaces and repo-aware design flow.',
            'Pencil can help speed iteration if paired with real context and code.',
          ]}
        />
        <FactionCard
          title="M3"
          role="Long-term Product Surface"
          tone="emerald"
          bullets={[
            'Should consume the right proven modules instead of rebuilding them blindly.',
            'Needs clean chunked handoff instead of giant dashboard merge attempts.',
          ]}
        />
      </div>

      <div id="toolkit-console">
      <HUDFrame title="Toolkit Console" eyebrow="Tools We Should Know How To Use" tone="cyan" aside={<StatusPill label="tool count" value={String((toolkit.tools || []).length)} tone="cyan" />}>
        <form onSubmit={addTool} className="mb-5 flex flex-col gap-3 md:flex-row">
          <input
            value={newTool}
            onChange={(e) => setNewTool(e.target.value)}
            placeholder="Add a new tool for research and workflow mapping..."
            className="flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:border-violet-500/40 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/20"
          >
            + Add Tool
          </button>
        </form>
        <div className="mb-4 grid gap-4 xl:grid-cols-4">
          <Meter label="Ready / Available" value={(toolkit.tools || []).length ? Math.round(((toolkit.tools || []).filter((tool) => tool.status === 'available').length / (toolkit.tools || []).length) * 100) : 0} tone="emerald" />
          <Meter label="Pilot Tools" value={(toolkit.tools || []).length ? Math.round(((toolkit.tools || []).filter((tool) => tool.status === 'pilot').length / (toolkit.tools || []).length) * 100) : 0} tone="violet" />
          <Meter label="Research Queue" value={(toolkit.tools || []).length ? Math.round(((toolkit.tools || []).filter((tool) => tool.researchStatus !== 'usable_now').length / (toolkit.tools || []).length) * 100) : 0} tone="amber" />
          <Meter label="Workflow Unlock Potential" value={67} tone="cyan" />
        </div>
        <div className="mb-5 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-gray-300">
          <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-300">Operating Rule</div>
          <p className="mt-2 leading-6">
            When a new tool is added here, it should trigger research: how it actually works, what workflow it fits into, what blocked task or idea it could unlock,
            and whether it belongs in GYC ops, M3 integration, creative production, or fleet infrastructure.
          </p>
        </div>
        <div className="space-y-4">
          {toolsLoading ? <div className="text-sm text-gray-400">Loading toolkit...</div> : null}
          {(toolkit.tools || []).map((tool) => <ToolkitCard key={tool.id} tool={tool} onUpdate={updateTool} />)}
        </div>
      </HUDFrame>
      </div>

      <HUDFrame title="System Review Console" eyebrow="Cross-Linking / Staleness / Reference Integrity" tone="amber" aside={<StatusPill label="review mode" value="manual + evolving" tone="amber" />}>
        <div className="mb-4 grid gap-4 xl:grid-cols-4">
          <Meter label="Cross-Link Coverage" value={36} tone="cyan" />
          <Meter label="Freshness Confidence" value={44} tone="emerald" />
          <Meter label="Reference Integrity" value={39} tone="amber" />
          <Meter label="System Drift Risk" value={63} tone="rose" />
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <div>
            <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-gray-400">Why this matters</div>
            <TacticalList
              tone="amber"
              items={[
                'Mission Control is turning into a real operating system, so orphaned pages and stale boards will quietly create bad decisions.',
                'If one section discovers a tool, blocker, or workflow improvement, that insight needs to propagate to the boards it affects.',
                'Pages built in isolation need explicit references when they affect each other: ideas, tasks, toolkits, client intelligence, M3 alignment, and dashboards.',
              ]}
            />
          </div>
          <div>
            <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-gray-400">Systematic review checklist</div>
            <TacticalList
              tone="cyan"
              items={[
                'Check whether each important page still reflects the current state of work.',
                'Check whether a new tool, decision, or blocker should create links to idea board, task board, or M3 integration board.',
                'Check whether duplicate concepts exist in multiple places without references between them.',
                'Check whether any page now needs a cross-link to another board or dashboard section.',
              ]}
            />
          </div>
        </div>
        <div className="mt-6 overflow-x-auto rounded-[22px] border border-white/10 bg-black/35">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/5 text-[11px] uppercase tracking-[0.22em] text-gray-400">
              <tr>
                <th className="px-4 py-3">System / Page</th>
                <th className="px-4 py-3">What should reference it</th>
                <th className="px-4 py-3">What it should reference</th>
                <th className="px-4 py-3">Current gap</th>
                <th className="px-4 py-3">Review action</th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  system: 'M3 Integration Page',
                  incoming: 'Mission Control main menu, Project Links, task board, toolkit discoveries',
                  outgoing: 'Toolkit Console, overlap audit, task board, ideas linked to M3 work',
                  gap: 'Still needs stronger backlinks into mission-control surfaces and idea/task references.',
                  action: 'Keep making it the hub for M3-related decisions and link outward more aggressively.',
                },
                {
                  system: 'Toolkit Console',
                  incoming: 'Mission Control menu, YouTube review outputs, Zoom transcript findings, tool discoveries',
                  outgoing: 'Idea Board, Task Board, M3 alignment, creative/ops pages where tool applies',
                  gap: 'Tool-to-board linking is still mostly conceptual, not fully automated.',
                  action: 'Add explicit board-link fields and use toolkit as unlock registry for blocked work.',
                },
                {
                  system: 'Idea Board',
                  incoming: 'Toolkit discoveries, meeting notes, ongoing ops discoveries',
                  outgoing: 'Task Board when promoted, M3 Integration when idea touches overlap/ownership',
                  gap: 'Ideas can sit disconnected from tools or overlapping M3 concerns.',
                  action: 'Require ideas to note relevant tools and related boards when applicable.',
                },
                {
                  system: 'Task Board',
                  incoming: 'Idea Board promotions, M3 alignment work, blockers surfaced elsewhere',
                  outgoing: 'Relevant dashboards/pages/toolkit entries when task depends on them',
                  gap: 'Blocked tasks are not yet systematically linked to unlocking tools or reference pages.',
                  action: 'Introduce reference links for blocked tasks and toolkit unlock mapping.',
                },
                {
                  system: 'Dashboard / Client Pages',
                  incoming: 'Mission Control, M3 alignment, toolkit-informed design/ops improvements',
                  outgoing: 'Relevant M3 alignment notes when overlap exists',
                  gap: 'Some pages are evolving fast without explicit references back to system-level planning.',
                  action: 'Review major pages periodically for stale assumptions and missing system links.',
                },
              ].map((row) => (
                <tr key={row.system} className="border-t border-white/6 align-top">
                  <td className="px-4 py-4 text-white">{row.system}</td>
                  <td className="px-4 py-4 text-gray-300">{row.incoming}</td>
                  <td className="px-4 py-4 text-gray-300">{row.outgoing}</td>
                  <td className="px-4 py-4 text-amber-100">{row.gap}</td>
                  <td className="px-4 py-4 text-gray-200">{row.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </HUDFrame>

      <div className="grid gap-6 xl:grid-cols-3">
        <HUDFrame title="Comms To Hakeem" eyebrow="Need To Clarify" tone="amber">
          <TacticalList
            tone="amber"
            items={[
              'Full module inventory of what Todd is building.',
              'Internal-only vs client-facing intent by module/tab.',
              'Which surfaces are stable vs placeholder vs broken.',
            ]}
          />
        </HUDFrame>

        <HUDFrame title="Comms To Team" eyebrow="Broadcast Internally" tone="cyan">
          <TacticalList
            tone="cyan"
            items={[
              'Dashboard work is an M3-aligned prototyping lane, not an isolated build stream.',
              'New features require overlap checks before deeper investment.',
              'Client-facing structure should follow narrative flow, not just available data.',
            ]}
          />
        </HUDFrame>

        <HUDFrame title="Design Ops / Pencil" eyebrow="Speed Upgrade" tone="violet">
          <TacticalList
            tone="violet"
            items={[
              'Use Pencil as a design acceleration layer, not a build replacement.',
              'Point it at the real repo and pair it with docs / PRDs / acceptance criteria.',
              'Pilot it on M3-facing modules and dashboard polish where iteration speed matters.',
            ]}
          />
        </HUDFrame>
      </div>

      <HUDFrame title="Reference Draft" eyebrow="Raw Alignment Intelligence" tone="violet" aside={<StatusPill label="source" value="internal draft" tone="violet" />}>
        {report ? (
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-[22px] border border-white/10 bg-black/45 p-5 text-xs leading-6 text-gray-300 shadow-inner shadow-violet-500/5">{report}</pre>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-gray-400">Alignment draft report not found yet.</div>
        )}
      </HUDFrame>
    </div>
  )
}
