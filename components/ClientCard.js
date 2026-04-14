'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'

// ── Formatters ────────────────────────────────────────────────────────────────

function fmt$(v) {
  if (v == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(v))
}

function fmtDate(v) {
  if (!v) return '—'
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(v))
  } catch { return '—' }
}

function fmtPct(v) {
  if (v == null) return '—'
  const n = Number(v)
  return Number.isNaN(n) ? '—' : `${n.toFixed(1)}%`
}

function fmtNum(v) {
  if (v == null) return '—'
  return new Intl.NumberFormat('en-US').format(Number(v))
}

function fmtMonth(v) {
  if (!v) return '—'
  const [y, m] = String(v).split('-')
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(new Date(Number(y), Number(m) - 1, 1))
  } catch { return v }
}

function fmtDuration(secs) {
  if (!secs) return null
  const totalSec = Number(secs)
  if (totalSec < 60) return `${totalSec}s`
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}m${s > 0 ? ` ${s}s` : ''}`
}

function fmtDurationMins(mins) {
  if (!mins) return null
  return fmtDuration(Number(mins) * 60)
}

// ── Shared UI primitives ──────────────────────────────────────────────────────

const STATUS_COLORS = {
  active:     'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  onboarding: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  paused:     'bg-amber-500/15 text-amber-300 border-amber-500/30',
  cancelled:  'bg-rose-500/15 text-rose-300 border-rose-500/30',
}

function Badge({ label, className = '' }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}

function StatusBadge({ status }) {
  const s = String(status || '').toLowerCase()
  return <Badge label={s || 'unknown'} className={`capitalize ${STATUS_COLORS[s] || 'border-gray-500/30 bg-gray-500/10 text-gray-300'}`} />
}

function SectionCard({ title, eyebrow, children, action, id }) {
  return (
    <section id={id} className="overflow-hidden rounded-3xl border border-[var(--brand-border)] bg-[radial-gradient(circle_at_top,#1a1024,transparent_45%),var(--brand-bg-card)]">
      <div className="border-b border-[var(--brand-border)] px-6 py-4">
        <div className="flex items-end justify-between">
          <div>
            {eyebrow && <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">{eyebrow}</div>}
            <h2 className="mt-0.5 text-lg font-bold text-white">{title}</h2>
          </div>
          {action}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </section>
  )
}

function StatBox({ label, value, sub, warn }) {
  return (
    <div className="rounded-2xl border border-[var(--brand-border)] bg-black/25 px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-gray-400">{label}</div>
      <div className={`mt-1 text-xl font-bold ${warn ? 'text-rose-300' : 'text-white'}`}>{value ?? '—'}</div>
      {sub && <div className="mt-0.5 text-xs text-gray-400">{sub}</div>}
    </div>
  )
}

function Empty({ children }) {
  return <div className="rounded-xl border border-dashed border-[var(--brand-border)] px-4 py-5 text-sm text-gray-500">{children}</div>
}

// ── Health score bar ──────────────────────────────────────────────────────────

function HealthScore({ score }) {
  const pct   = (score / 10) * 100
  const color = score >= 8 ? '#10b981' : score >= 5 ? '#f59e0b' : '#f43f5e'
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <div className="absolute inset-y-0 left-0 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="w-14 text-right text-sm font-semibold text-white">{score}/10</span>
    </div>
  )
}

// ── Service tile ──────────────────────────────────────────────────────────────

function ServiceTile({ icon, label, active }) {
  return (
    <div className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center ${active ? 'border-violet-500/40 bg-violet-500/15 text-violet-200' : 'border-[var(--brand-border)] bg-black/20 text-gray-600'}`}>
      <span className="text-2xl">{icon}</span>
      <span className="text-[11px] font-medium leading-tight">{label}</span>
    </div>
  )
}

function TrendBadge({ trend, changePct }) {
  if (!trend) return <span className="text-gray-500 text-sm">— No data</span>
  if (trend === 'up')     return <span className="font-semibold text-emerald-400">↑ Up {changePct != null ? `(+${changePct}%)` : ''}</span>
  if (trend === 'down')   return <span className="font-semibold text-rose-400">↓ Down {changePct != null ? `(${changePct}%)` : ''}</span>
  if (trend === 'stable') return <span className="text-gray-300">→ Stable</span>
  return null
}

// ── Transcript viewer ─────────────────────────────────────────────────────────

function TranscriptViewer({ text }) {
  const [open, setOpen] = useState(false)

  if (!text) return null
  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-medium text-violet-400 hover:text-violet-300 transition"
      >
        <span className={`transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
        {open ? 'Hide transcript' : 'View transcript (permanent record)'}
      </button>
      {open && (
        <div className="mt-2 max-h-96 overflow-y-auto rounded-xl border border-[var(--brand-border)] bg-black/40 p-4">
          <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-gray-300">{text}</pre>
        </div>
      )}
    </div>
  )
}

// ── Single call card ──────────────────────────────────────────────────────────

function CallCard({ call, isPending }) {
  const [summaryOpen, setSummaryOpen] = useState(false)

  const classification = call.classifiedAs || call.aiClassification || null
  const rep = call.assignedRepName || call.repName || call.hostName || call.gaName || null
  const callDate = call.startTime || call.startedAt || call.callDate
  const durSecs  = call.durationSecs || (call.duration ? call.duration * 60 : null)
  const hasTranscript = !!call.transcriptText
  const hasAISummary  = !!call.aiSummary
  const hasRecording  = !!call.recordingUrl || !!call.callLink
  const purposes = Array.isArray(call.purposes) ? call.purposes : []

  // Recording link note
  const recUrl   = call.recordingUrl || call.callLink
  const classifyUrl = `/team/classify?callId=${call.id}`

  return (
    <div className={`rounded-2xl border ${isPending ? 'border-amber-500/25 bg-amber-500/5' : 'border-[var(--brand-border)] bg-black/20'} p-4 space-y-3`}>
      {/* Header row */}
      <div className="flex flex-wrap items-start gap-2">
        {/* Date chip */}
        <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-xs text-violet-200">
          {fmtDate(callDate)}
        </span>

        {/* Duration */}
        {durSecs && (
          <span className="rounded-full border border-[var(--brand-border)] bg-black/30 px-2.5 py-1 text-xs text-gray-300">
            {fmtDuration(durSecs)}
          </span>
        )}

        {/* Rep */}
        {rep && (
          <span className="rounded-full border border-[var(--brand-border)] bg-black/30 px-2.5 py-1 text-xs text-gray-300">
            {rep}
          </span>
        )}

        {/* Classification */}
        {classification ? (
          <span className="rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-2.5 py-1 text-xs uppercase tracking-wide text-fuchsia-200">
            {classification}
          </span>
        ) : (
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300">
            unclassified
          </span>
        )}

        {/* Purposes */}
        {purposes.map((p) => (
          <span key={p} className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-xs text-blue-300">
            {p}
          </span>
        ))}

        {/* Deal closed */}
        {call.dealClosed && (
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
            ✓ Deal closed
          </span>
        )}

        {/* Asset availability chips */}
        {hasTranscript && (
          <span className="rounded-full border border-violet-500/20 bg-black/20 px-2 py-1 text-[10px] text-gray-400" title="Transcript saved permanently in our DB">
            📄 transcript
          </span>
        )}
        {hasAISummary && (
          <span className="rounded-full border border-violet-500/20 bg-black/20 px-2 py-1 text-[10px] text-gray-400">
            🤖 AI summary
          </span>
        )}
      </div>

      {/* Topic */}
      <div className="font-semibold text-white">
        {call.topic || 'Untitled call'}
      </div>

      {/* AI Summary (collapsible) */}
      {hasAISummary && (
        <div>
          <button
            onClick={() => setSummaryOpen((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-violet-400 hover:text-violet-300 transition"
          >
            <span className={`transition-transform ${summaryOpen ? 'rotate-90' : ''}`}>›</span>
            {summaryOpen ? 'Hide AI summary' : 'View AI summary'}
          </button>
          {summaryOpen && (
            <div className="mt-2 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 text-sm text-gray-300 leading-relaxed">
              {call.aiSummary}
            </div>
          )}
        </div>
      )}

      {/* Transcript viewer */}
      <TranscriptViewer text={call.transcriptText} />

      {/* Notes */}
      {call.notes && (
        <div className="rounded-xl bg-black/20 px-3 py-2 text-xs text-gray-400">{call.notes}</div>
      )}

      {/* Action links */}
      <div className="flex flex-wrap gap-3 pt-1">
        {hasRecording && (
          <a
            href={recUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-violet-400 hover:underline"
            title="Recording links expire after ~30–120 days on Zoom's plan"
          >
            🎬 Recording
            <span className="text-[10px] text-gray-600">(may expire)</span>
          </a>
        )}
        {isPending && (
          <Link
            href={classifyUrl}
            className="inline-flex items-center gap-1 text-xs text-amber-400 hover:underline"
          >
            🏷 Classify this call →
          </Link>
        )}
      </div>
    </div>
  )
}

// ── Calls Panel ───────────────────────────────────────────────────────────────

function CallsPanel({ profile, allCalls, pendingCalls, potentialUnlinkedCount }) {
  const [view, setView] = useState('all') // 'all' | 'pending'

  const displayed = view === 'pending' ? pendingCalls : allCalls
  const classifiedCount = allCalls.length - pendingCalls.length
  const withTranscript  = allCalls.filter((c) => c.transcriptText).length
  const withAI          = allCalls.filter((c) => c.aiSummary).length

  return (
    <SectionCard
      title="Call Log"
      eyebrow="Section 5"
      id="calls"
      action={
        <div className="flex gap-2">
          <span className="text-xs text-gray-500">{allCalls.length} total</span>
        </div>
      }
    >
      {/* Potential unlinked calls banner */}
      {potentialUnlinkedCount > 0 && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <span className="text-lg">🔎</span>
          <div>
            <div className="text-sm font-semibold text-amber-300">
              {potentialUnlinkedCount} potential call{potentialUnlinkedCount !== 1 ? 's' : ''} found via email match
            </div>
            <div className="mt-0.5 text-xs text-amber-200/70">
              These calls have participant emails matching this client but aren't linked yet.{' '}
              <Link href="/team/classify" className="underline hover:text-amber-300">
                Review in Call Intelligence →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Stats strip */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBox label="Total calls" value={allCalls.length} />
        <StatBox label="Classified" value={classifiedCount} />
        <StatBox label="With transcript" value={withTranscript} sub="Permanent record" />
        <StatBox label="AI summaries" value={withAI} />
      </div>

      {/* View toggle */}
      {pendingCalls.length > 0 && (
        <div className="mb-4 flex gap-2">
          {[
            { key: 'all',     label: `All calls (${allCalls.length})` },
            { key: 'pending', label: `Needs classification (${pendingCalls.length})` },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                view === key
                  ? key === 'pending'
                    ? 'border-amber-500/50 bg-amber-500/15 text-amber-200'
                    : 'border-violet-500/50 bg-violet-500/15 text-violet-200'
                  : 'border-[var(--brand-border)] text-gray-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Needs classification note */}
      {view === 'pending' && pendingCalls.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 text-xs text-amber-300">
          These calls are linked to this client but haven't been classified yet.
          Click <strong>"Classify this call →"</strong> on any row to open Call Intelligence.
        </div>
      )}

      {/* Call list */}
      {displayed.length === 0 ? (
        <Empty>
          {view === 'pending'
            ? 'All calls are classified — great!'
            : 'No Zoom calls on record for this client.'}
        </Empty>
      ) : (
        <div className="space-y-4">
          {displayed.map((call) => (
            <CallCard
              key={call.id}
              call={call}
              isPending={!call.classifiedAs && !call.aiClassification && (!call.purposes || call.purposes.length === 0)}
            />
          ))}
        </div>
      )}
    </SectionCard>
  )
}

// ── Notes section ─────────────────────────────────────────────────────────────

function NotesSection({ acronym, initialNotes }) {
  const [notes, setNotes] = useState(initialNotes || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [error, setError]   = useState('')
  const timer = useRef(null)

  async function save() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/clients/${acronym}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamNotes: notes }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Save failed') }
      setSaved(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionCard title="Team Notes" eyebrow="Section 7" id="notes">
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={5}
        placeholder="Add internal notes for the team…"
        className="w-full rounded-xl border border-[var(--brand-border)] bg-black/40 p-3 text-sm text-gray-200 placeholder-gray-600 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30"
      />
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-xl border border-violet-500/40 bg-violet-500/15 px-4 py-2 text-sm font-medium text-violet-300 transition hover:bg-violet-500/25 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Notes'}
        </button>
        {saved && <span className="text-sm text-emerald-400">✓ Saved</span>}
        {error && <span className="text-sm text-rose-400">{error}</span>}
      </div>
    </SectionCard>
  )
}

// ── Raw data (admin collapsible) ──────────────────────────────────────────────

function RawDataSection({ profile, user }) {
  const [open, setOpen] = useState(false)
  if (!['superadmin', 'admin'].includes(user?.role)) return null
  return (
    <section className="overflow-hidden rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-bg-card)]">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-6 py-4 text-left">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">Admin</div>
          <h2 className="mt-0.5 text-lg font-bold text-white">Raw Profile Data</h2>
        </div>
        <span style={{ color: '#6d4c89' }} className={`text-xl transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
      </button>
      {open && (
        <div className="border-t border-[var(--brand-border)] px-6 pb-6 pt-4">
          <pre className="overflow-x-auto rounded-xl bg-black/40 p-4 text-[11px] text-gray-300">
            {JSON.stringify(profile, null, 2)}
          </pre>
        </div>
      )}
    </section>
  )
}

// ── Main ClientCard ───────────────────────────────────────────────────────────

export default function ClientCard({ acronym, user }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res  = await fetch(`/api/clients/${acronym}/profile`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load client.')
      setData(json)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [acronym])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-3xl text-violet-400">⟳</div>
          <p className="mt-3 text-sm text-gray-500">Loading client profile…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl py-12 text-center space-y-4">
        <div className="text-4xl">😬</div>
        <h1 className="text-xl font-bold text-white">{error}</h1>
        <Link href="/clients" className="text-sm text-violet-400 hover:underline">← Back to Clients</Link>
      </div>
    )
  }

  if (!data) return null

  const { profile, allCalls = [], pendingCalls = [], activityLog = [], funnelHistory = [], potentialUnlinkedCount = 0 } = data
  const hasFunnel = funnelHistory.length > 0 || profile.funnelDataMonths > 0
  const ghlUrl = profile.ghlContactId ? `https://app.gohighlevel.com/contacts/${profile.ghlContactId}` : null

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">

      {/* Back nav */}
      <Link href="/clients" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-violet-300 transition">
        ← All Clients
      </Link>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-3xl border border-[var(--brand-border)] bg-[radial-gradient(circle_at_top_left,#1a1024,transparent_60%),var(--brand-bg-card)] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div style={{ color: '#AE2BCF' }} className="text-5xl font-black tracking-tight">{profile.acronym}</div>
            <div className="mt-1 text-xl font-semibold text-white">{profile.companyName || '—'}</div>
            <div className="mt-0.5 text-sm text-gray-400">{profile.ownerName || '—'}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusBadge status={profile.status} />
              {profile.assignedGA && (
                <Badge label={`👤 ${profile.assignedGA}`} className="border-violet-500/30 bg-violet-500/10 text-violet-200" />
              )}
              {profile.crmType && (
                <Badge label={`🔗 ${profile.crmType}`} className="border-[var(--brand-border)] bg-black/30 text-gray-300" />
              )}
              {profile.isOverdue && (
                <Badge label="⚠️ Overdue" className="border-rose-500/40 bg-rose-500/15 text-rose-300" />
              )}
              {potentialUnlinkedCount > 0 && (
                <Badge
                  label={`🔎 ${potentialUnlinkedCount} unlinked call${potentialUnlinkedCount !== 1 ? 's' : ''}`}
                  className="border-amber-500/30 bg-amber-500/10 text-amber-300"
                />
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center lg:w-72">
            <div className="rounded-2xl border border-[var(--brand-border)] bg-black/30 px-3 py-3">
              <div className="text-[11px] text-gray-400 uppercase tracking-wide">MRR</div>
              <div className="mt-1 text-lg font-bold text-white">{profile.mrr ? fmt$(profile.mrr) : '—'}</div>
            </div>
            <div className="rounded-2xl border border-[var(--brand-border)] bg-black/30 px-3 py-3">
              <div className="text-[11px] text-gray-400 uppercase tracking-wide">Locations</div>
              <div className="mt-1 text-lg font-bold text-white">{profile.locationCount || '—'}</div>
            </div>
            <div className="rounded-2xl border border-[var(--brand-border)] bg-black/30 px-3 py-3">
              <div className="text-[11px] text-gray-400 uppercase tracking-wide">Calls</div>
              <div className="mt-1 text-lg font-bold text-white">{allCalls.length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 1: Services ─────────────────────────────────────────── */}
      <SectionCard title="Services" eyebrow="Section 1" id="services">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          <ServiceTile icon="🌐" label="Website"    active={!!profile.hasWebsite} />
          <ServiceTile icon="📈" label="SEO"        active={!!profile.hasSEO} />
          <ServiceTile icon="🤝" label="CRM"        active={!!profile.hasCRM} />
          <ServiceTile icon="📊" label="Blueprint"  active={!!profile.hasBlueprint} />
          <ServiceTile icon="📢" label="Google Ads" active={!!profile.hasGoogleAds} />
          <ServiceTile icon="💰" label="Paid Media" active={!!profile.hasPaidMedia} />
        </div>
        {profile.serviceList?.length > 0 && (
          <div className="mt-3 text-xs text-gray-500">Services: {profile.serviceList.join(' · ')}</div>
        )}
      </SectionCard>

      {/* ── Section 2: Business Metrics ─────────────────────────────────── */}
      <SectionCard title="Business Metrics" eyebrow="Section 2" id="metrics">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatBox label="MRR"            value={profile.mrr ? fmt$(profile.mrr) : '—'} />
          <StatBox label="Lifetime Value" value={profile.lifetimeValue ? fmt$(profile.lifetimeValue) : '—'} />
          <StatBox label="Overdue Amount" value={profile.overdueAmount ? fmt$(profile.overdueAmount) : '—'} warn={!!profile.isOverdue} />
        </div>

        {profile.isOverdue && (
          <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm">
            <div className="font-semibold text-rose-300 mb-2">Overdue History</div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-gray-300">
              <span className="text-gray-500">Episodes:</span>        <span>{profile.overdueCount || '—'}</span>
              <span className="text-gray-500">Last date:</span>       <span>{fmtDate(profile.lastOverdueDate)}</span>
              <span className="text-gray-500">Catch-up rate:</span>   <span>{profile.catchUpRate != null ? fmtPct(Number(profile.catchUpRate) * 100) : '—'}</span>
              <span className="text-gray-500">Avg days:</span>        <span>{profile.avgDaysToCatchUp ?? '—'}</span>
              {profile.lastOverdueReason && (
                <><span className="text-gray-500">Reason:</span><span>{profile.lastOverdueReason}</span></>
              )}
            </div>
          </div>
        )}

        <div className="mt-4">
          <div className="mb-2 text-sm font-medium text-gray-300">Health Score</div>
          <HealthScore score={profile.healthScore} />
        </div>

        {profile.stripeStatus && (
          <div className="mt-3 text-xs text-gray-500">
            Stripe:{' '}
            <span className={`font-medium ${profile.stripeStatus === 'active' ? 'text-emerald-400' : profile.stripeStatus === 'past_due' ? 'text-rose-400' : 'text-gray-300'}`}>
              {profile.stripeStatus}
            </span>
            {profile.stripeCustomerId && (
              <a
                href={`https://dashboard.stripe.com/customers/${profile.stripeCustomerId}`}
                target="_blank"
                rel="noreferrer"
                className="ml-2 text-violet-400 hover:underline"
              >
                View in Stripe ↗
              </a>
            )}
          </div>
        )}
      </SectionCard>

      {/* ── Section 3: Enrollment Funnel ────────────────────────────────── */}
      <SectionCard title="Enrollment Funnel" eyebrow="Section 3" id="funnel">
        {!hasFunnel ? (
          <Empty>No funnel data available for this client.</Empty>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatBox label="Avg Monthly Leads"       value={fmtNum(profile.avgMonthlyLeads)} />
              <StatBox label="Avg Monthly Tours"       value={fmtNum(profile.avgMonthlyTours)} />
              <StatBox label="Avg Enrollments"         value={fmtNum(profile.avgMonthlyRegistered)} />
              <StatBox label="Funnel Trend"            value={<TrendBadge trend={profile.funnelTrend} changePct={profile.trendChangePct} />} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StatBox label="Lead → Tour Rate"        value={profile.leadToTourRate != null ? fmtPct(Number(profile.leadToTourRate)) : '—'} />
              <StatBox label="Tour → Enrollment Rate"  value={profile.tourToRegRate  != null ? fmtPct(Number(profile.tourToRegRate))  : '—'} />
            </div>

            {funnelHistory.length > 0 && (
              <div>
                <div className="mb-2 text-sm font-medium text-gray-300">Last 12 months — Leads / Tours / Enrolled</div>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={funnelHistory} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={fmtMonth} />
                      <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} width={32} />
                      <Tooltip
                        contentStyle={{ background: '#0a0a0a', border: '1px solid #2a1a3e', borderRadius: 12 }}
                        labelStyle={{ color: '#9ca3af' }}
                        labelFormatter={fmtMonth}
                      />
                      <Line type="monotone" dataKey="leads"      stroke="#AE2BCF" strokeWidth={2} dot={false} name="Leads" />
                      <Line type="monotone" dataKey="tours"      stroke="#3b82f6" strokeWidth={2} dot={false} name="Tours" />
                      <Line type="monotone" dataKey="registered" stroke="#10b981" strokeWidth={2} dot={false} name="Enrolled" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 flex gap-4 text-xs">
                  <span style={{ color: '#AE2BCF' }}>● Leads</span>
                  <span style={{ color: '#3b82f6' }}>● Tours</span>
                  <span style={{ color: '#10b981' }}>● Enrolled</span>
                </div>
              </div>
            )}
            <div className="text-xs text-gray-500">
              {profile.funnelDataMonths || 0} month(s) of data
              {profile.latestFunnelMonth ? ` · Latest: ${fmtMonth(profile.latestFunnelMonth)}` : ''}
            </div>
          </div>
        )}
      </SectionCard>

      {/* ── Section 4: Contact Info ──────────────────────────────────────── */}
      <SectionCard title="Contact Info" eyebrow="Section 4" id="contact">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2.5 text-sm">
            {[
              ['Owner',   profile.ownerName],
              ['Email',   profile.email,   `mailto:${profile.email}`],
              ['Phone',   profile.phone,   `tel:${profile.phone}`],
              ['Website', profile.website, profile.website?.startsWith('http') ? profile.website : `https://${profile.website}`],
            ].map(([label, value, href]) => (
              <div key={label} className="flex gap-3">
                <span className="w-20 shrink-0 text-gray-500">{label}</span>
                {value ? (
                  href
                    ? <a href={href} target={href.startsWith('http') ? '_blank' : '_self'} rel="noreferrer" className="text-violet-400 hover:underline break-all">{value}</a>
                    : <span className="text-gray-200">{value}</span>
                ) : <span className="text-gray-600">—</span>}
              </div>
            ))}
          </div>
          <div className="space-y-2.5 text-sm">
            {[
              ['GHL Stage', profile.ghlPipelineStage],
              ['City', [profile.city, profile.state].filter(Boolean).join(', ')],
              ['CRM', profile.crmType],
              ['Since', profile.startDate ? fmtDate(profile.startDate) : null],
            ].map(([label, value]) => (
              <div key={label} className="flex gap-3">
                <span className="w-20 shrink-0 text-gray-500">{label}</span>
                <span className="text-gray-200">{value || '—'}</span>
              </div>
            ))}
            {ghlUrl && (
              <div className="flex gap-3">
                <span className="w-20 shrink-0 text-gray-500">GHL</span>
                <a href={ghlUrl} target="_blank" rel="noreferrer" className="text-violet-400 hover:underline">Open contact ↗</a>
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      {/* ── Section 5: Call Log (full panel) ────────────────────────────── */}
      <CallsPanel
        profile={profile}
        allCalls={allCalls}
        pendingCalls={pendingCalls}
        potentialUnlinkedCount={potentialUnlinkedCount}
      />

      {/* ── Section 6: Activity Log ──────────────────────────────────────── */}
      <SectionCard title="Activity Log" eyebrow="Section 6" id="activity">
        {activityLog.length === 0 ? (
          <Empty>No activity events recorded yet.</Empty>
        ) : (
          <div className="space-y-2">
            {activityLog.slice(0, 10).map((event) => (
              <div key={event.id} className="flex gap-3 rounded-xl border border-[var(--brand-border)] bg-black/20 px-4 py-3">
                <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-violet-500" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white">{event.summary || event.type || 'Event'}</div>
                  <div className="mt-0.5 flex gap-3 text-xs text-gray-500">
                    <span>{fmtDate(event.createdAt)}</span>
                    {event.actorName && <span>· {event.actorName}</span>}
                    {event.type     && <span>· {event.type}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── Section 7: Team Notes ────────────────────────────────────────── */}
      <NotesSection acronym={profile.acronym} initialNotes={profile.teamNotes} />

      {/* ── Section 8: Raw Data (admin only) ────────────────────────────── */}
      <RawDataSection profile={profile} user={user} />
    </div>
  )
}
