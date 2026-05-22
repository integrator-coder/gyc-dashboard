'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ResponsiveContainer,
  LineChart,
  BarChart,
  Bar,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'
import { ClientFinanceReviewPanel } from '@/components/StripeLinkageReviewPage'
import { funnelStatus } from '@/lib/funnel-benchmarks'
import CompetitorMap from '@/components/CompetitorMap'
import dynamic from 'next/dynamic'
const OverlayTestTab = dynamic(() => import('@/components/OverlayTestTab'), { ssr: false, loading: () => <div className="p-8 text-gray-400">Loading map...</div> })

// ── Formatters ────────────────────────────────────────────────────────────────

function fmt$(v) {
  if (v == null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(Number(v))
}

function fmtMoney(v, opts = {}) {
  if (v == null) return '—'
  const n = Number(v)
  return Number.isNaN(n)
    ? '—'
    : new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
        ...opts,
      }).format(n)
}

function fmtDate(v) {
  if (!v) return '—'
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    }).format(new Date(v))
  } catch { return '—' }
}

function fmtDateTime(v) {
  if (!v) return '—'
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    }).format(new Date(v))
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

function toFiniteNumber(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function normalizeLocationKey(value) {
  return String(value || '').trim().toLowerCase()
}

function getEnrollmentMetrics(source) {
  const currentEnrollment = toFiniteNumber(source?.currentEnrollment)
  const centerCapacity = toFiniteNumber(source?.centerCapacity)
  const avgTuition = toFiniteNumber(source?.avgTuition)
  const hasAllSourceNumbers = [currentEnrollment, centerCapacity, avgTuition].every((v) => v != null)

  if (!hasAllSourceNumbers) {
    return {
      currentEnrollment,
      centerCapacity,
      avgTuition,
      hasAllSourceNumbers: false,
      enrollmentGap: null,
      monthlyOpportunity: null,
      annualOpportunity: null,
      isFull: false,
    }
  }

  const enrollmentGap = Math.max(centerCapacity - currentEnrollment, 0)
  const monthlyOpportunity = enrollmentGap * avgTuition
  const annualOpportunity = monthlyOpportunity * 12

  return {
    currentEnrollment,
    centerCapacity,
    avgTuition,
    hasAllSourceNumbers: true,
    enrollmentGap,
    monthlyOpportunity,
    annualOpportunity,
    isFull: enrollmentGap === 0,
  }
}

function getLocationEnrollmentMetrics(location) {
  return getEnrollmentMetrics({
    currentEnrollment: location?.currentEnrollment,
    centerCapacity: location?.capacity,
    avgTuition: location?.avgTuition,
  })
}

function fmtMonth(v) {
  if (!v) return '—'
  const [y, m] = String(v).split('-')
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(
      new Date(Number(y), Number(m) - 1, 1)
    )
  } catch { return v }
}

function fmtPeriodLong(v) {
  if (!v) return '—'
  const [y, m] = String(v).split('-')
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(
      new Date(Number(y), Number(m) - 1, 1)
    )
  } catch { return v }
}

function fmtVerificationStatus(status) {
  if (status === 'checked_no_change') return 'checked, no changes'
  if (status === 'updated') return 'updated'
  return 'not verified yet'
}

function fmtDuration(secs) {
  if (!secs) return null
  const totalSec = Number(secs)
  if (totalSec < 60) return `${totalSec}s`
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}m${s > 0 ? ` ${s}s` : ''}`
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
  return (
    <Badge
      label={s || 'unknown'}
      className={`capitalize ${STATUS_COLORS[s] || 'border-gray-500/30 bg-gray-500/10 text-gray-300'}`}
    />
  )
}

function Card({ children, className = '' }) {
  return (
    <div className={`rounded-2xl border border-[var(--brand-border)] bg-black/25 px-4 py-3 ${className}`}>
      {children}
    </div>
  )
}

function StatBox({ label, value, sub, warn, big, cardClassName = '', valueClassName = '', tip = '' }) {
  return (
    <Card className={cardClassName}>
      <div className="text-[11px] uppercase tracking-wider text-gray-400 flex items-center gap-1">{label}{tip && <InfoTip text={tip} />}</div>
      <div className={`mt-1 font-bold ${big ? 'text-3xl' : 'text-xl'} ${warn ? 'text-rose-300' : 'text-white'} ${valueClassName}`}>
        {value ?? '—'}
      </div>
      {sub && <div className="mt-0.5 text-xs text-gray-400">{sub}</div>}
    </Card>
  )
}

function Empty({ children }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--brand-border)] px-4 py-5 text-sm text-gray-500">
      {children}
    </div>
  )
}

function InfoRow({ label, value, href, mono }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="w-32 shrink-0 text-gray-500">{label}</span>
      {value ? (
        href ? (
          <a href={href} target="_blank" rel="noreferrer" className="text-violet-400 hover:underline break-all">
            {value}
          </a>
        ) : (
          <span className={`text-gray-200 break-all ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
        )
      ) : (
        <span className="text-gray-600">—</span>
      )}
    </div>
  )
}

function SectionTitle({ children }) {
  return <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-gray-400">{children}</h3>
}

function PlaceholderBanner({ icon = '🔌', message }) {
  return (
    <div className="rounded-xl border border-dashed border-violet-500/20 bg-violet-500/5 px-4 py-4 text-sm text-violet-300/70">
      <span className="mr-2">{icon}</span>{message}
    </div>
  )
}

// ── Health score bar ──────────────────────────────────────────────────────────

function HealthScore({ score }) {
  const pct   = (score / 10) * 100
  const color = score >= 8 ? '#10b981' : score >= 5 ? '#f59e0b' : '#f43f5e'
  const label = score >= 8 ? 'text-emerald-400' : score >= 5 ? 'text-amber-400' : 'text-rose-400'
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className={`w-16 text-right text-sm font-bold ${label}`}>{score}/10</span>
    </div>
  )
}

// ── Service tile ──────────────────────────────────────────────────────────────

function ServiceTile({ icon, label, active, saving, onToggle, onJump }) {
  const clickTimer = useRef(null)

  function handleClick() {
    if (clickTimer.current) clearTimeout(clickTimer.current)
    clickTimer.current = setTimeout(() => {
      onToggle?.()
      clickTimer.current = null
    }, 220)
  }

  function handleDoubleClick() {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current)
      clickTimer.current = null
    }
    onJump?.()
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      disabled={saving}
      title={active ? 'Click to turn off, double click to open tab' : 'Click to turn on, double click to open tab'}
      className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition ${
        active
          ? 'border-violet-500/40 bg-violet-500/15 text-violet-200'
          : 'border-[var(--brand-border)] bg-black/20 text-gray-600'
      } ${saving ? 'cursor-wait opacity-60' : 'cursor-pointer hover:border-violet-400/50 hover:bg-violet-500/10'}`}
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-[11px] font-medium leading-tight">{label}</span>
      {saving && <span className="text-[10px] text-gray-400">Saving…</span>}
    </button>
  )
}

function TrendBadge({ trend, changePct }) {
  if (!trend) return <span className="text-gray-500 text-sm">— No data</span>
  if (trend === 'up')     return <span className="font-semibold text-emerald-400">↑ Up {changePct != null ? `(+${changePct}%)` : ''}</span>
  if (trend === 'down')   return <span className="font-semibold text-rose-400">↓ Down {changePct != null ? `(${changePct}%)` : ''}</span>
  if (trend === 'stable') return <span className="text-gray-300">→ Stable</span>
  return null
}

function FunnelIntelligencePanel({ status }) {
  const [open, setOpen] = useState(false)

  const worstStatus = status.leadToTourStatus === 'critical' || status.tourToRegStatus === 'critical'
    ? 'critical'
    : status.leadToTourStatus === 'warning' || status.tourToRegStatus === 'warning'
    ? 'warning'
    : 'above'

  const borderColor = worstStatus === 'critical' ? '#ef4444' : worstStatus === 'warning' ? '#eab308' : '#22c55e'
  const headerText  = worstStatus === 'critical' ? 'text-red-400'    : worstStatus === 'warning' ? 'text-yellow-400'  : 'text-green-400'

  const constraintLabels = {
    'lead-to-tour': 'Primary constraint: Lead→Tour rate',
    'tour-to-reg':  'Primary constraint: Tour→Reg rate',
    'both':         'Primary constraint: Both rates below benchmark',
    'none':         'All metrics above benchmark',
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 text-xs font-medium text-gray-400 hover:text-gray-200 transition"
      >
        <span className={`transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
        <span className={headerText}>Funnel Intelligence</span>
        {worstStatus === 'critical' && (
          <span className="rounded border border-red-700 bg-red-900/50 px-1.5 py-0.5 text-[10px] text-red-300">⚠ Needs Attention</span>
        )}
      </button>
      {open && (
        <div
          className="mt-2 rounded-xl px-4 py-3 text-sm"
          style={{ backgroundColor: '#0a0a0f', border: `1px solid #2a1a3e`, borderLeft: `3px solid ${borderColor}` }}
        >
          <p className={`text-xs font-semibold mb-2 ${headerText}`}>{constraintLabels[status.primaryConstraint]}</p>
          <ul className="space-y-1.5">
            {status.nextSteps.map((step, i) => (
              <li key={i} className="flex gap-2 text-xs text-gray-300">
                <span className="text-gray-500 shrink-0">•</span>
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
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
  const rep     = call.assignedRepName || call.repName || call.hostName || call.gaName || null
  const callDate = call.startTime || call.startedAt || call.callDate
  const durSecs  = call.durationSecs || (call.duration ? call.duration * 60 : null)
  const purposes = Array.isArray(call.purposes) ? call.purposes : []
  const recUrl   = call.recordingUrl || call.callLink

  return (
    <div
      className={`rounded-2xl border ${
        isPending
          ? 'border-amber-500/25 bg-amber-500/5'
          : 'border-[var(--brand-border)] bg-black/20'
      } p-4 space-y-3`}
    >
      <div className="flex flex-wrap items-start gap-2">
        <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-xs text-violet-200">
          {fmtDate(callDate)}
        </span>
        {durSecs && (
          <span className="rounded-full border border-[var(--brand-border)] bg-black/30 px-2.5 py-1 text-xs text-gray-300">
            {fmtDuration(durSecs)}
          </span>
        )}
        {rep && (
          <span className="rounded-full border border-[var(--brand-border)] bg-black/30 px-2.5 py-1 text-xs text-gray-300">
            {rep}
          </span>
        )}
        {classification ? (
          <span className="rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-2.5 py-1 text-xs uppercase tracking-wide text-fuchsia-200">
            {classification}
          </span>
        ) : (
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300">
            unclassified
          </span>
        )}
        {purposes.map((p) => (
          <span key={p} className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-xs text-blue-300">
            {p}
          </span>
        ))}
        {call.dealClosed && (
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
            ✓ Deal closed
          </span>
        )}
        {call.transcriptText && (
          <span className="rounded-full border border-violet-500/20 bg-black/20 px-2 py-1 text-[10px] text-gray-400">
            📄 transcript
          </span>
        )}
        {call.aiSummary && (
          <span className="rounded-full border border-violet-500/20 bg-black/20 px-2 py-1 text-[10px] text-gray-400">
            🤖 AI summary
          </span>
        )}
      </div>

      <div className="font-semibold text-white">{call.topic || 'Untitled call'}</div>

      {call.aiSummary && (
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

      <TranscriptViewer text={call.transcriptText} />

      {call.notes && (
        <div className="rounded-xl bg-black/20 px-3 py-2 text-xs text-gray-400">{call.notes}</div>
      )}

      <div className="flex flex-wrap gap-3 pt-1">
        {recUrl && (
          <a
            href={recUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-violet-400 hover:underline"
            title="Recording links may expire"
          >
            🎬 Recording
            <span className="text-[10px] text-gray-600">(may expire)</span>
          </a>
        )}
        {isPending && (
          <Link
            href={`/team/classify?callId=${call.id}`}
            className="inline-flex items-center gap-1 text-xs text-amber-400 hover:underline"
          >
            🏷 Classify this call →
          </Link>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB PANELS
// ─────────────────────────────────────────────────────────────────────────────

// ── Tab 1: Overview ───────────────────────────────────────────────────────────

function OverviewTab({ profile, funnelHistory, allCalls, potentialUnlinkedCount, acronym, enrollmentVerification, onJumpTab, onRefresh }) {
  // API returns DESC order (latest first) — index 0 is most recent month
  const latestMonth  = funnelHistory.length > 0 ? funnelHistory[0] : null
  // For charts, reverse to chronological order
  const funnelHistoryAsc = [...funnelHistory].reverse()
  const hasFunnel    = funnelHistory.length > 0 || profile.funnelDataMonths > 0
  const [savingService, setSavingService] = useState('')
  const avgLeads = toFiniteNumber(profile.avgMonthlyLeads)
  const avgRegistered = toFiniteNumber(profile.avgMonthlyRegistered)
  const avgConvRate = avgLeads && avgRegistered != null ? (avgRegistered / avgLeads) * 100 : null
  const displayServiceList = (profile.serviceList || []).map((service) => service === 'CRM' && profile.crmType ? profile.crmType : service)

  const alerts = []
  if (profile.isOverdue) {
    alerts.push({
      icon: '⚠️',
      msg: profile.overdueAmount ? `Overdue balance outstanding (${fmt$(profile.overdueAmount)})` : 'Overdue balance outstanding',
      sub: 'Open Financial tab',
      color: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
      onClick: () => onJumpTab?.('financial'),
    })
  }
  if (profile.funnelTrend === 'down') alerts.push({ icon: '📉', msg: 'Funnel trending down (leads or tours decreasing)', color: 'border-amber-500/30 bg-amber-500/10 text-amber-300' })
  if (potentialUnlinkedCount > 0)  alerts.push({ icon: '🔎', msg: `${potentialUnlinkedCount} potential unlinked call${potentialUnlinkedCount !== 1 ? 's' : ''} — review in Call Intelligence`, color: 'border-amber-500/30 bg-amber-500/10 text-amber-300' })

  async function toggleService(field, nextValue) {
    setSavingService(field)
    try {
      const res = await fetch(`/api/clients/${acronym}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: nextValue }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Failed to update service')
      await onRefresh?.()
    } catch (err) {
      alert(err.message || 'Failed to update service')
    } finally {
      setSavingService('')
    }
  }

  return (
    <div className="space-y-6">
      {/* Alerts strip */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <button
              key={i}
              type="button"
              onClick={a.onClick}
              className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-left text-sm ${a.color} ${a.onClick ? 'cursor-pointer transition hover:bg-white/5' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span>{a.icon}</span>
                <span>{a.msg}</span>
              </div>
              {a.sub && <span className="text-xs opacity-80">{a.sub} ›</span>}
            </button>
          ))}
        </div>
      )}

      {/* Health score */}
      <div>
        <SectionTitle>Client Health</SectionTitle>
        <Card>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-300 flex items-center gap-1">Health Score <InfoTip text="A 1–10 score that flags client risk at a glance. Starts at 10 and deducts points for: overdue invoice (−3), more than one overdue invoice (−1), funnel trend declining (−2), Stripe payment past due (−2). 8–10 = healthy, 5–7 = watch, below 5 = needs immediate attention." /></span>
            <span className={`text-2xl font-black ${
              profile.healthScore >= 8 ? 'text-emerald-400' :
              profile.healthScore >= 5 ? 'text-amber-400' : 'text-rose-400'
            }`}>
              {profile.healthScore}/10
            </span>
          </div>
          <HealthScore score={profile.healthScore} />
          <div className="mt-2 text-xs text-gray-500">
            {profile.healthScore >= 8 ? 'Healthy — no significant concerns' :
             profile.healthScore >= 5 ? 'Moderate — some issues to watch' :
             'Needs attention — action required'}
          </div>
        </Card>
      </div>

      <EnrollmentSnapshotSection
        title="Enrollment Snapshot"
        note="Growth Advisors update these figures during monthly client meetings."
        profile={profile}
        acronym={acronym}
        verification={enrollmentVerification}
        showVerificationControls
        onRefresh={onRefresh}
      />

      {/* This Month Funnel */}
      <div>
        <SectionTitle>
          This Month Funnel
          {latestMonth && <span className="ml-2 normal-case text-[10px] font-normal text-gray-500">({fmtMonth(latestMonth.month)})</span>}
        </SectionTitle>
        {!hasFunnel ? (
          <Empty>No funnel data available for this client.</Empty>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <StatBox label="Leads" value={latestMonth ? fmtNum(latestMonth.leads) : '—'} big tip="Total inquiries or leads received this month — phone calls, form fills, walk-ins tracked in the funnel." />
            <StatBox label="Tours" value={latestMonth ? fmtNum(latestMonth.tours) : '—'} big tip="Number of leads who booked and completed a tour of the facility this month." />
            <StatBox label="Registrations" value={latestMonth ? fmtNum(latestMonth.registered) : '—'} big tip="New enrollments this month — families who toured and signed up." />
          </div>
        )}
      </div>

      {/* Conversion Rate Cards — Current Month */}
      {hasFunnel && latestMonth && (() => {
        const leads      = Number(latestMonth.leads)      || 0
        const tours      = Number(latestMonth.tours)      || 0
        const registered = Number(latestMonth.registered) || 0
        const tourRateNum  = leads > 0 ? (tours      / leads * 100) : null
        const closeRateNum = tours > 0 ? (registered / tours * 100) : null
        const convRateNum  = leads > 0 ? (registered / leads * 100) : null
        const tourRate  = tourRateNum  != null ? `${tourRateNum.toFixed(1)}%`  : '—'
        const closeRate = closeRateNum != null ? `${closeRateNum.toFixed(1)}%` : '—'
        const convRate  = convRateNum  != null ? `${convRateNum.toFixed(1)}%`  : '—'
        const monthStatus = funnelStatus(tourRateNum, closeRateNum)
        const lttColorClass = monthStatus.leadToTourStatus === 'critical' ? 'text-red-400' : monthStatus.leadToTourStatus === 'warning' ? 'text-yellow-400' : 'text-green-400'
        const ttrColorClass = monthStatus.tourToRegStatus === 'critical' ? 'text-red-400' : monthStatus.tourToRegStatus === 'warning' ? 'text-yellow-400' : 'text-green-400'
        const ovColorClass  = monthStatus.overallStatus   === 'critical' ? 'text-red-400' : monthStatus.overallStatus   === 'warning' ? 'text-yellow-400' : 'text-green-400'
        return (
          <div>
            <SectionTitle>
              Conversion Rates
              <span className="ml-2 normal-case text-[10px] font-normal text-gray-500">({fmtMonth(latestMonth.month)})</span>
            </SectionTitle>
            <p className="text-[10px] text-gray-500 mb-2">Benchmarks: Lead→Tour 50% · Tour→Reg 50% · Overall 25%</p>
            <div className="grid grid-cols-3 gap-3">
              <Card>
                <div className="text-[11px] uppercase tracking-wider text-gray-400 flex items-center gap-1">Tour Rate <InfoTip text="% of leads who booked a tour. Benchmark: 50%+. Below 50% usually means the phone/follow-up process needs work — leads are coming in but not converting to tours." /></div>
                <div className={`mt-1 font-bold text-xl ${tourRateNum != null ? lttColorClass : ''}`} style={tourRateNum == null ? { color: '#06b6d4' } : undefined}>{tourRate}</div>
                <div className="mt-0.5 text-xs text-gray-400">Leads that booked a tour</div>
              </Card>
              <Card>
                <div className="text-[11px] uppercase tracking-wider text-gray-400 flex items-center gap-1">Closing Rate <InfoTip text="% of tours that resulted in enrollment. Benchmark: 50%+. Below 50% typically means the tour experience or the close conversation needs improvement." /></div>
                <div className={`mt-1 font-bold text-xl ${closeRateNum != null ? ttrColorClass : ''}`} style={closeRateNum == null ? { color: '#8b5cf6' } : undefined}>{closeRate}</div>
                <div className="mt-0.5 text-xs text-gray-400">Tours that enrolled</div>
              </Card>
              <Card>
                <div className="text-[11px] uppercase tracking-wider text-gray-400 flex items-center gap-1">Conversion Rate <InfoTip text="% of total leads that became enrollments (end-to-end). Benchmark: 25%+. This is the ultimate efficiency metric — combines tour rate and closing rate into one number." /></div>
                <div className={`mt-1 font-bold text-xl ${convRateNum != null ? ovColorClass : ''}`} style={convRateNum == null ? { color: '#C19C46' } : undefined}>{convRate}</div>
                <div className="mt-0.5 text-xs text-gray-400">Lead to enrollment</div>
              </Card>
            </div>
          </div>
        )
      })()}

      {/* Avg conversion rates */}
      {hasFunnel && (() => {
        const lttRate = profile.leadToTourRate != null ? Number(profile.leadToTourRate) : null
        const ttrRate = profile.tourToRegRate  != null ? Number(profile.tourToRegRate)  : null
        const avgStatus = funnelStatus(lttRate, ttrRate)
        const lttColorClass = avgStatus.leadToTourStatus === 'critical' ? 'text-red-400' : avgStatus.leadToTourStatus === 'warning' ? 'text-yellow-400' : 'text-green-400'
        const ttrColorClass = avgStatus.tourToRegStatus === 'critical' ? 'text-red-400' : avgStatus.tourToRegStatus === 'warning' ? 'text-yellow-400' : 'text-green-400'
        const ovColorClass  = avgStatus.overallStatus   === 'critical' ? 'text-red-400' : avgStatus.overallStatus   === 'warning' ? 'text-yellow-400' : 'text-green-400'
        return (
          <div>
            <SectionTitle>Conversion Rates (12-mo avg)</SectionTitle>
            <p className="text-[10px] text-gray-500 mb-2">Benchmarks: Lead→Tour 50% · Tour→Reg 50% · Overall 25%</p>
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatBox label="Avg Leads/mo" value={fmtNum(profile.avgMonthlyLeads)} />
                <StatBox label="Avg Tours/mo" value={fmtNum(profile.avgMonthlyTours)} />
                <StatBox label="Avg Enrollments" value={fmtNum(profile.avgMonthlyRegistered)} />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatBox
                  label="Lead to Tour Ratio"
                  tip="12-month average % of leads who booked a tour. Benchmark: 50%+."
                  value={lttRate != null ? fmtPct(lttRate) : '—'}
                  valueClassName={lttRate != null ? lttColorClass : ''}
                />
                <StatBox
                  label="Tour to Enrollment"
                  tip="12-month average % of tours that converted to enrollment. Benchmark: 50%+."
                  value={ttrRate != null ? fmtPct(ttrRate) : '—'}
                  valueClassName={ttrRate != null ? ttrColorClass : ''}
                />
                <StatBox
                  label="Conversion Rate"
                  tip="12-month average end-to-end conversion: lead → enrollment. Benchmark: 25%+."
                  value={avgConvRate != null ? fmtPct(avgConvRate) : '—'}
                  valueClassName={avgConvRate != null ? ovColorClass : ''}
                />
              </div>
            </div>

            {/* Funnel Intelligence panel */}
            {(lttRate != null || ttrRate != null) && (
              <FunnelIntelligencePanel status={avgStatus} />
            )}
          </div>
        )
      })()}

      {/* 12-Month Trend */}
      {funnelHistoryAsc.length > 1 && (
        <div>
          <SectionTitle>12-Month Trend</SectionTitle>
          <Card className="pt-4">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={funnelHistoryAsc} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 10 }} tickFormatter={fmtMonth} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} width={28} />
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
            <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
              <span>{profile.funnelDataMonths || 0} month(s) of data</span>
              <TrendBadge trend={profile.funnelTrend} changePct={profile.trendChangePct} />
            </div>
          </Card>
        </div>
      )}

      {/* Funnel Conversion Rates — 12 Month Trend */}
      {funnelHistoryAsc.length > 1 && (() => {
        const rateData = funnelHistoryAsc
          .filter(m => Number(m.leads) > 0)
          .map(m => {
            const l = Number(m.leads)      || 0
            const t = Number(m.tours)      || 0
            const r = Number(m.registered) || 0
            return {
              month:     m.month,
              tourRate:  l > 0 ? +(t / l * 100).toFixed(1) : null,
              closeRate: t > 0 ? +(r / t * 100).toFixed(1) : null,
              convRate:  l > 0 ? +(r / l * 100).toFixed(1) : null,
            }
          })
        return (
          <div>
            <SectionTitle>Funnel Conversion Rates — 12 Month Trend</SectionTitle>
            <Card className="pt-4">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rateData} margin={{ left: 8, right: 8, top: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 10 }} tickFormatter={fmtMonth} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} width={40} domain={[0, 100]} tickFormatter={v => `${v}%`} label={{ value: 'Rate (%)', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 10, dx: -4 }} />
                    <Tooltip
                      contentStyle={{ background: '#0a0a0a', border: '1px solid #2a1a3e', borderRadius: 12 }}
                      labelStyle={{ color: '#9ca3af' }}
                      labelFormatter={fmtMonth}
                      formatter={(val) => val != null ? `${val}%` : '—'}
                    />
                    <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="tourRate"  stroke="#06b6d4" strokeWidth={2} dot={false} name="Tour Rate"       connectNulls />
                    <Line type="monotone" dataKey="closeRate" stroke="#731494" strokeWidth={2} dot={false} name="Closing Rate"    connectNulls />
                    <Line type="monotone" dataKey="convRate"  stroke="#C19C46" strokeWidth={2} dot={false} name="Conversion Rate" connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        )
      })()}

      {/* Services */}
      <div>
        <SectionTitle>Active Services</SectionTitle>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          <ServiceTile icon="🌐" label="Website"    active={!!profile.hasWebsite} saving={savingService === 'hasWebsite'} onToggle={() => toggleService('hasWebsite', !profile.hasWebsite)} onJump={() => onJumpTab?.('website')} />
          <ServiceTile icon="📈" label="SEO"        active={!!profile.hasSEO} saving={savingService === 'hasSEO'} onToggle={() => toggleService('hasSEO', !profile.hasSEO)} onJump={() => onJumpTab?.('seo')} />
          <ServiceTile icon="🤝" label={profile.crmType || 'CRM'} active={!!profile.hasCRM} saving={savingService === 'hasCRM'} onToggle={() => toggleService('hasCRM', !profile.hasCRM)} onJump={() => onJumpTab?.('crm')} />
          <ServiceTile icon="📊" label="Blueprint"  active={!!profile.hasBlueprint} saving={savingService === 'hasBlueprint'} onToggle={() => toggleService('hasBlueprint', !profile.hasBlueprint)} onJump={() => onJumpTab?.('blueprint')} />
          <ServiceTile icon="📢" label="Google Ads" active={!!profile.hasGoogleAds} saving={savingService === 'hasGoogleAds'} onToggle={() => toggleService('hasGoogleAds', !profile.hasGoogleAds)} onJump={() => onJumpTab?.('paidmedia')} />
          <ServiceTile icon="💰" label="Paid Media" active={!!profile.hasPaidMedia} saving={savingService === 'hasPaidMedia'} onToggle={() => toggleService('hasPaidMedia', !profile.hasPaidMedia)} onJump={() => onJumpTab?.('paidmedia')} />
        </div>
        {displayServiceList.length > 0 && (
          <div className="mt-2 text-xs text-gray-500">Services: {displayServiceList.join(' · ')}</div>
        )}
      </div>

      {/* Key contact info */}
      <div>
        <SectionTitle>Contact Snapshot</SectionTitle>
        <Card>
          <div className="space-y-2.5">
            <InfoRow label="Owner"    value={profile.ownerName} />
            <InfoRow label="Email"    value={profile.email}    href={profile.email ? `mailto:${profile.email}` : null} />
            <InfoRow label="Phone"    value={profile.phone}    href={profile.phone ? `tel:${profile.phone}` : null} />
            {profile.directorName && <InfoRow label="Director" value={profile.directorName} />}
            <InfoRow label="Location" value={[profile.city, profile.state].filter(Boolean).join(', ')} />
            <InfoRow label="Since"    value={profile.startDate ? fmtDate(profile.startDate) : null} />
          </div>
        </Card>
      </div>
    </div>
  )
}

// ── Tab 2: Financial ──────────────────────────────────────────────────────────

function FinancialTab({ profile, recentPayments = [], user = null }) {
  const [paymentSearch, setPaymentSearch] = useState('')
  const isPIF = profile.lifetimeValue && profile.mrr && Number(profile.lifetimeValue) > Number(profile.mrr) * 10
  const hasRecentPayments = recentPayments.length > 0

  // Build year-by-year summary from full payment history
  const annualSummary = useMemo(() => {
    const byYear = {}
    for (const pmt of recentPayments) {
      const yr = pmt.date ? pmt.date.slice(0, 4) : 'Unknown'
      if (!byYear[yr]) byYear[yr] = { total: 0, count: 0 }
      byYear[yr].total += pmt.amount
      byYear[yr].count += 1
    }
    return Object.entries(byYear)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([year, data]) => ({ year, ...data }))
  }, [recentPayments])

  // Filtered payment list
  const filteredPayments = useMemo(() => {
    if (!paymentSearch.trim()) return recentPayments
    const q = paymentSearch.toLowerCase()
    return recentPayments.filter(p =>
      (p.date && p.date.includes(q)) ||
      (p.description && p.description.toLowerCase().includes(q))
    )
  }, [recentPayments, paymentSearch])

  const totalPaid = recentPayments.reduce((s, p) => s + p.amount, 0)

  const canReviewLinkage = ['admin', 'superadmin'].includes(user?.role)

  return (
    <div className="space-y-6">
      {/* Finance Linkage Review removed — admin-only tool, not relevant in client view */}

      {/* Primary metrics */}
      <div>
        <SectionTitle>Revenue</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatBox label="MRR" value={profile.mrr ? fmt$(profile.mrr) : '—'} sub={profile.stripeCustomerId ? 'Synced/cached Stripe data' : null} big />
          <StatBox label="Lifetime Value" value={profile.lifetimeValue ? fmt$(profile.lifetimeValue) : '—'} />
          <StatBox
            label="Overdue Amount"
            value={profile.isOverdue ? fmt$(profile.overdueAmount || 0) : (profile.overdueAmount ? fmt$(profile.overdueAmount) : '$0')}
            warn={!!profile.isOverdue}
          />
        </div>
        {isPIF && (
          <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
            💰 Paid-in-full indicator — lifetime value is significantly above MRR
          </div>
        )}
      </div>

      {/* Stripe */}
      <div>
        <SectionTitle>Stripe Status</SectionTitle>
        <Card>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Status:</span>
                <span className={`text-sm font-semibold ${
                  profile.stripeStatus === 'active' ? 'text-emerald-400' :
                  profile.stripeStatus === 'past_due' ? 'text-rose-400' :
                  'text-gray-300'
                }`}>
                  {profile.stripeStatus || '—'}
                </span>
              </div>
              {profile.isOverdue ? (
                <div className="text-sm text-rose-300">⚠️ Account is overdue</div>
              ) : (
                <div className="text-sm text-emerald-400">✅ No overdue balance</div>
              )}
            </div>
            {profile.stripeCustomerId && (
              <a
                href={`https://dashboard.stripe.com/customers/${profile.stripeCustomerId}`}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-violet-400 hover:underline"
              >
                View in Stripe ↗
              </a>
            )}
          </div>
        </Card>
      </div>

      {/* Dunning history */}
      <div>
        <SectionTitle>Dunning History</SectionTitle>
        {!profile.overdueCount || profile.overdueCount === 0 ? (
          <Empty>No overdue history on record.</Empty>
        ) : (
          <Card>
            <div className="mb-3 flex items-center gap-2">
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                profile.overdueCount >= 2
                  ? 'border-rose-500/40 bg-rose-500/15 text-rose-300'
                  : 'border-amber-500/40 bg-amber-500/15 text-amber-300'
              }`}>
                {profile.overdueCount >= 2 ? '⚠️ Repeat Offender' : '⚠️ Has overdue history'}
              </span>
              <span className="text-xs text-gray-400">{profile.overdueCount} episode{profile.overdueCount !== 1 ? 's' : ''}</span>
            </div>
            <div className="space-y-2">
              <InfoRow label="Last overdue"    value={fmtDate(profile.lastOverdueDate)} />
              <InfoRow label="Last reason"     value={profile.lastOverdueReason} />
              <InfoRow label="Catch-up rate"   value={profile.catchUpRate != null ? fmtPct(Number(profile.catchUpRate) * 100) : null} />
              <InfoRow label="Avg days to pay" value={profile.avgDaysToCatchUp ? `${profile.avgDaysToCatchUp} days` : null} />
            </div>
          </Card>
        )}
      </div>

      {/* Annual Payment Summary */}
      {annualSummary.length > 0 && (
        <div>
          <SectionTitle>Annual Payment Summary</SectionTitle>
          <Card>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #2a1a3e' }}>
                  <th style={{ textAlign: 'left', padding: '6px 12px', color: '#9ca3af' }}>Year</th>
                  <th style={{ textAlign: 'right', padding: '6px 12px', color: '#9ca3af' }}>Total Paid</th>
                  <th style={{ textAlign: 'right', padding: '6px 12px', color: '#9ca3af' }}>Payments</th>
                </tr>
              </thead>
              <tbody>
                {annualSummary.map(row => (
                  <tr key={row.year} style={{ borderBottom: '1px solid #1a0a2e' }}>
                    <td style={{ padding: '7px 12px', color: '#e2e8f0', fontWeight: 600 }}>{row.year}</td>
                    <td style={{ padding: '7px 12px', textAlign: 'right', color: '#4ade80', fontWeight: 600 }}>
                      ${row.total.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td style={{ padding: '7px 12px', textAlign: 'right', color: '#9ca3af' }}>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* Full Payment History */}
      <div>
        <SectionTitle>
          Payment History
          {hasRecentPayments && (
            <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: '#9ca3af' }}>
              {recentPayments.length} payments, ${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} total
            </span>
          )}
        </SectionTitle>

        {!hasRecentPayments ? (
          <Empty>No synced payment history is loaded for this client card yet.</Empty>
        ) : (
          <>
            <div style={{ marginBottom: 8 }}>
              <input
                type="text"
                placeholder="Search by date or description…"
                value={paymentSearch}
                onChange={e => setPaymentSearch(e.target.value)}
                style={{
                  width: '100%',
                  background: '#1a0a2e',
                  border: '1px solid #2a1a3e',
                  borderRadius: 8,
                  padding: '7px 12px',
                  color: '#e2e8f0',
                  fontSize: 13,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <Card style={{ padding: 0 }}>
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#120827', zIndex: 1 }}>
                    <tr style={{ borderBottom: '1px solid #2a1a3e' }}>
                      <th style={{ textAlign: 'left', padding: '8px 12px', color: '#9ca3af' }}>Date</th>
                      <th style={{ textAlign: 'left', padding: '8px 12px', color: '#9ca3af' }}>Description</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px', color: '#9ca3af' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayments.length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ padding: '12px', textAlign: 'center', color: '#6b7280' }}>No payments match your search.</td>
                      </tr>
                    ) : (
                      filteredPayments.map((pmt, i) => (
                        <tr key={pmt.id || i} style={{ borderBottom: '1px solid #1a0a2e' }}>
                          <td style={{ padding: '7px 12px', color: '#9ca3af', whiteSpace: 'nowrap' }}>{pmt.date}</td>
                          <td style={{ padding: '7px 12px', color: '#fff' }}>{pmt.description}</td>
                          <td style={{ padding: '7px 12px', textAlign: 'right', color: '#4ade80', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            ${pmt.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>

      {/* GHL pipeline */}
      {(profile.ghlContactId || profile.ghlPipelineStage) && (
        <div>
          <SectionTitle>GHL Pipeline</SectionTitle>
          <Card>
            <div className="space-y-2">
              <InfoRow label="Stage" value={profile.ghlPipelineStage} />
              {profile.ghlContactId && (
                <InfoRow
                  label="GHL Contact"
                  value="Open in GHL ↗"
                  href={`https://app.gohighlevel.com/contacts/${profile.ghlContactId}`}
                />
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

// ── Tab 3: Website (always visible) ──────────────────────────────────────────

const WEBSITE_AUDIT_STATUS_STYLES = {
  healthy: 'border-emerald-400/40 bg-emerald-400/15 text-emerald-100 shadow-[0_0_20px_rgba(52,211,153,0.16)]',
  warning: 'border-amber-400/45 bg-amber-400/15 text-amber-100 shadow-[0_0_20px_rgba(251,191,36,0.16)]',
  critical: 'border-rose-400/45 bg-rose-400/15 text-rose-100 shadow-[0_0_20px_rgba(251,113,133,0.16)]',
  unknown: 'border-slate-400/30 bg-slate-400/10 text-slate-100/90',
}

const WEBSITE_AUDIT_ISSUE_STYLES = {
  high: 'border-rose-400/40 bg-gradient-to-br from-rose-400/18 via-rose-400/10 to-black/35 text-rose-50 shadow-[0_0_24px_rgba(251,113,133,0.16)]',
  medium: 'border-amber-400/40 bg-gradient-to-br from-amber-400/16 via-amber-400/10 to-black/35 text-amber-50 shadow-[0_0_24px_rgba(251,191,36,0.14)]',
  low: 'border-slate-300/20 bg-gradient-to-br from-slate-300/12 via-slate-300/6 to-black/35 text-slate-100',
}

const WEBSITE_AUDIT_CARD_TONES = {
  healthy: {
    ring: '#34D399',
    shell: 'border-emerald-400/25 bg-gradient-to-br from-emerald-400/14 via-[#140E20] to-black/45',
    panel: 'border-emerald-400/15 bg-black/35',
    label: 'text-emerald-100',
    accent: 'bg-emerald-300',
  },
  warning: {
    ring: '#FBBF24',
    shell: 'border-amber-400/25 bg-gradient-to-br from-amber-400/14 via-[#140E20] to-black/45',
    panel: 'border-amber-400/15 bg-black/35',
    label: 'text-amber-100',
    accent: 'bg-amber-300',
  },
  critical: {
    ring: '#FB7185',
    shell: 'border-rose-400/25 bg-gradient-to-br from-rose-400/14 via-[#140E20] to-black/45',
    panel: 'border-rose-400/15 bg-black/35',
    label: 'text-rose-100',
    accent: 'bg-rose-300',
  },
  unknown: {
    ring: '#94A3B8',
    shell: 'border-slate-300/15 bg-gradient-to-br from-slate-300/12 via-[#140E20] to-black/45',
    panel: 'border-slate-300/10 bg-black/35',
    label: 'text-slate-100',
    accent: 'bg-slate-300',
  },
}

function getWebsiteAuditCardTone(status) {
  return WEBSITE_AUDIT_CARD_TONES[status] || WEBSITE_AUDIT_CARD_TONES.unknown
}

function getWebsiteIssueSeverityLabel(severity) {
  if (severity === 'high') return 'Priority fix'
  if (severity === 'medium') return 'Needs attention'
  return 'Optimization'
}

function fmtAuditSeconds(v) {
  const n = toFiniteNumber(v)
  return n == null ? '—' : `${n.toFixed(1)}s`
}

function fmtAuditMs(v) {
  const n = toFiniteNumber(v)
  return n == null ? '—' : `${Math.round(n)} ms`
}

function fmtAuditCls(v) {
  const n = toFiniteNumber(v)
  return n == null ? '—' : n.toFixed(2)
}

function fmtAuditScoreOutOf100(v) {
  const n = toFiniteNumber(v)
  return n == null ? '—' : `${Math.round(n)}/100`
}

function getWebsiteAuditStatusClass(status) {
  return WEBSITE_AUDIT_STATUS_STYLES[status] || WEBSITE_AUDIT_STATUS_STYLES.unknown
}

function WebsiteAuditBadge({ status, label }) {
  return <Badge label={label || 'Unavailable'} className={getWebsiteAuditStatusClass(status)} />
}

function WebsiteAuditMetric({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400">{label}</div>
      <div className="mt-1.5 text-sm font-semibold text-white">{value ?? '—'}</div>
    </div>
  )
}

function WebsiteAuditCheckList({ items = [] }) {
  if (!items.length) return <div className="text-xs text-slate-400">No checks available yet.</div>

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/30 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <span className="flex items-center gap-2 text-sm text-slate-100">
            <span className={`h-2 w-2 rounded-full ${item.passed ? 'bg-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.6)]' : 'bg-rose-300 shadow-[0_0_12px_rgba(251,113,133,0.55)]'}`} />
            <span>{item.label}</span>
          </span>
          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${item.passed ? 'border-emerald-400/35 bg-emerald-400/14 text-emerald-50' : 'border-rose-400/35 bg-rose-400/14 text-rose-50'}`}>
            {item.passed ? 'Pass' : 'Needs work'}
          </span>
        </div>
      ))}
    </div>
  )
}

function WebsiteAuditIssueList({ items = [], emptyText = 'No major mobile-specific issues surfaced in this snapshot.' }) {
  if (!items.length) {
    return <div className="text-xs text-slate-400">{emptyText}</div>
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item} className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          {item}
        </div>
      ))}
    </div>
  )
}

function normalizeWebsiteAuditIssue(item) {
  if (!item) return null

  if (typeof item === 'string') {
    const label = item.trim()
    if (!label) return null
    return {
      label,
      area: 'Website',
      severity: 'medium',
      summary: label,
      whyItMatters: 'This surfaced as one of the biggest issues in the current website snapshot and is worth review.',
      likelyCause: 'Inspect the related page template, technical setup, or front-end assets.',
      recommendedFix: 'Review the issue and ship the smallest web-team fix that removes the friction.',
      talkingPoint: 'We found a meaningful website issue that is worth tightening up to improve the parent experience.',
    }
  }

  const label = String(item.label || '').trim()
  if (!label) return null

  const severity = ['high', 'medium', 'low'].includes(item.severity) ? item.severity : 'medium'
  return {
    label,
    area: String(item.area || 'Website').trim() || 'Website',
    severity,
    summary: String(item.summary || label).trim(),
    whyItMatters: String(item.whyItMatters || 'This surfaced as one of the biggest issues in the current website snapshot and is worth review.').trim(),
    likelyCause: String(item.likelyCause || 'Inspect the related page template, technical setup, or front-end assets.').trim(),
    recommendedFix: String(item.recommendedFix || 'Review the issue and ship the smallest web-team fix that removes the friction.').trim(),
    talkingPoint: String(item.talkingPoint || 'We found a meaningful website issue that is worth tightening up to improve the parent experience.').trim(),
  }
}

function WebsiteIssueBriefField({ label, value, className = '' }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-black/20 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${className}`}>
      <div className="text-[10px] uppercase tracking-[0.22em] text-white/60">{label}</div>
      <div className="mt-1.5 text-sm leading-6 text-white/95">{value || '—'}</div>
    </div>
  )
}

function WebsiteAuditScoreDial({ score, max = 100, status, scoreSuffix = '' }) {
  const tone = getWebsiteAuditCardTone(status)
  const numericScore = toFiniteNumber(score)
  const progress = numericScore == null || !max ? 0 : Math.max(0, Math.min((numericScore / Number(max)) * 100, 100))

  return (
    <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div
        className="absolute inset-1 rounded-full"
        style={{
          background: `conic-gradient(${tone.ring} ${progress}%, rgba(255,255,255,0.08) ${progress}% 100%)`,
          boxShadow: `0 0 28px ${tone.ring}22`,
        }}
      />
      <div className="absolute inset-[10px] rounded-full bg-[#120D1D]" />
      <div className="relative text-center">
        <div className="text-2xl font-black text-white">{numericScore ?? '—'}</div>
        {numericScore != null && scoreSuffix ? <div className="-mt-0.5 text-[11px] font-semibold text-slate-300">{scoreSuffix}</div> : null}
      </div>
    </div>
  )
}

function WebsiteAuditCard({ icon, title, status, label, score, scoreMax = 100, scoreSuffix = '', children, footer }) {
  const tone = getWebsiteAuditCardTone(status)

  return (
    <Card className={`relative h-full overflow-hidden ${tone.shell}`}>
      <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.28em] text-slate-400">Performance module</div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-lg">{icon}</span>
            <div className="text-base font-semibold text-white">{title}</div>
          </div>
          <div className="mt-3">
            <WebsiteAuditBadge status={status} label={label} />
          </div>
        </div>
        <WebsiteAuditScoreDial score={score} max={scoreMax} status={status} scoreSuffix={scoreSuffix} />
      </div>

      <div className={`mt-4 rounded-[22px] border p-3 ${tone.panel}`}>
        {children}
      </div>

      {footer ? (
        <div className="mt-4 flex items-start gap-2 text-xs text-slate-300">
          <span className={`mt-1 h-2 w-2 rounded-full ${tone.accent}`} />
          <span>{footer}</span>
        </div>
      ) : null}
    </Card>
  )
}

function WebsiteAuditSkeletonCard({ title }) {
  return (
    <Card className="h-full animate-pulse border-white/10 bg-gradient-to-br from-[#171127] via-[#0F0B19] to-black/40">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="h-3 w-28 rounded bg-white/10" />
          <div className="h-8 w-16 rounded bg-white/10" />
        </div>
        <div className="h-6 w-24 rounded-full bg-white/10" />
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-10 rounded-xl bg-white/10" />
        <div className="h-10 rounded-xl bg-white/10" />
        <div className="h-10 rounded-xl bg-white/10" />
      </div>
      <div className="sr-only">Loading {title}</div>
    </Card>
  )
}

function WebsiteMiniStatSkeleton() {
  return (
    <div className="rounded-xl border border-[var(--brand-border)] bg-black/20 px-3 py-3 animate-pulse">
      <div className="h-3 w-20 rounded bg-white/10" />
      <div className="mt-3 h-7 w-16 rounded bg-white/10" />
      <div className="mt-2 h-3 w-24 rounded bg-white/10" />
    </div>
  )
}

function getWebsiteScoreTone(value, max = 100) {
  if (value == null) return WEBSITE_AUDIT_STATUS_STYLES.unknown
  const pct = max ? (Number(value) / Number(max)) * 100 : Number(value)
  if (pct >= 90) return WEBSITE_AUDIT_STATUS_STYLES.healthy
  if (pct >= 60) return WEBSITE_AUDIT_STATUS_STYLES.warning
  return WEBSITE_AUDIT_STATUS_STYLES.critical
}

function WebsiteHistoryScore({ value, max = 100, text = null }) {
  if (value == null) return <span className="text-xs text-slate-400">—</span>

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold shadow-[0_0_18px_rgba(255,255,255,0.04)] ${getWebsiteScoreTone(value, max)}`}>
      {text || (max !== 100 ? `${value}/${max}` : value)}
    </span>
  )
}

function fmtCompactNum(v) {
  if (v == null) return '—'
  return new Intl.NumberFormat('en-US', {
    notation: Math.abs(Number(v)) >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(Number(v))
}

function fmtSignedPct(v) {
  if (v == null) return '—'
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}%`
}

function fmtSharePct(v) {
  if (v == null) return '—'
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  const pct = n * 100
  return `${pct >= 10 ? pct.toFixed(0) : pct.toFixed(1)}%`
}

function WebsiteTrafficComparisonPill({ label, value }) {
  if (value == null) {
    return (
      <span className="inline-flex items-center rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-xs text-slate-300">
        {label}: —
      </span>
    )
  }

  const tone = value > 0
    ? 'border-emerald-400/35 bg-emerald-400/14 text-emerald-50 shadow-[0_0_18px_rgba(52,211,153,0.14)]'
    : value < 0
      ? 'border-rose-400/35 bg-rose-400/14 text-rose-50 shadow-[0_0_18px_rgba(251,113,133,0.14)]'
      : 'border-white/10 bg-black/35 text-slate-100'

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold ${tone}`}>
      {label}: {fmtSignedPct(value)}
    </span>
  )
}

const WEBSITE_TRAFFIC_SOURCE_COLORS = {
  organic: '#34D399',
  direct: '#60A5FA',
  paid: '#A78BFA',
  social: '#F472B6',
  'referral-other': '#F59E0B',
}

function WebsiteTrafficDelta({ label, comparison, isRate = false }) {
  const rawValue = isRate ? comparison?.vsLastMonthDelta : comparison?.vsLastMonthPct
  if (label === 'vs 3-mo avg') {
    if (isRate) {
      if (comparison?.vsThreeMonthAvgDelta == null) {
        return <div className="flex items-center justify-between gap-3 text-xs text-slate-300"><span className="text-slate-400">{label}</span><span>Building history</span></div>
      }
    } else if (comparison?.vsThreeMonthAvgPct == null) {
      return <div className="flex items-center justify-between gap-3 text-xs text-slate-300"><span className="text-slate-400">{label}</span><span>Building history</span></div>
    }
  } else if (rawValue == null) {
    return <div className="flex items-center justify-between gap-3 text-xs text-slate-300"><span className="text-slate-400">{label}</span><span>Building history</span></div>
  }

  const value = label === 'vs 3-mo avg'
    ? (isRate ? comparison?.vsThreeMonthAvgDelta : comparison?.vsThreeMonthAvgPct)
    : rawValue

  const tone = value > 0
    ? 'text-emerald-200'
    : value < 0
      ? 'text-rose-200'
      : 'text-slate-100'

  const displayValue = isRate
    ? `${value > 0 ? '+' : ''}${Number(value).toFixed(1)} pts`
    : fmtSignedPct(value)

  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-slate-400">{label}</span>
      <span className={`font-semibold ${tone}`}>{displayValue}</span>
    </div>
  )
}

function WebsiteTrafficKpiCard({ label, value, comparison, isRate = false, dotClassName = 'bg-violet-400' }) {
  return (
    <Card className="relative h-full overflow-hidden border-white/10 bg-gradient-to-br from-[#1A132B] via-[#100B19] to-black/45 shadow-[0_18px_40px_rgba(0,0,0,0.22)]">
      <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      <div className="flex items-start justify-between gap-3">
        <div className="text-[11px] uppercase tracking-[0.24em] text-slate-300">{label}</div>
        <span className={`mt-1 h-2.5 w-2.5 rounded-full shadow-[0_0_18px_currentColor] ${dotClassName}`} />
      </div>
      <div className="mt-2 text-[10px] uppercase tracking-[0.26em] text-slate-400">Performance signal</div>
      <div className="mt-3 text-3xl font-black text-white">{value ?? '—'}</div>
      <div className="mt-1 text-xs text-slate-300">Latest 30d snapshot</div>

      <div className="mt-5 space-y-2 rounded-2xl border border-white/10 bg-black/35 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <WebsiteTrafficDelta label="vs last month" comparison={comparison} isRate={isRate} />
        <WebsiteTrafficDelta label="vs 3-mo avg" comparison={comparison} isRate={isRate} />
      </div>
    </Card>
  )
}

function WebsiteTrafficSourceTooltip({ active, payload }) {
  if (!active || !payload?.length) return null

  const source = payload[0]?.payload
  if (!source) return null

  return (
    <div className="rounded-2xl border border-[var(--brand-border)] bg-[#120E1F]/95 px-3 py-2 text-xs shadow-2xl">
      <div className="font-semibold text-white">{source.label}</div>
      <div className="mt-1 space-y-1 text-slate-200">
        <div>{fmtNum(source.value)} tracked sessions</div>
        <div>{fmtSharePct(source.share)} of channel mix</div>
      </div>
    </div>
  )
}

function WebsiteTrafficSourceDonut({ sourceDistribution }) {
  const items = Array.isArray(sourceDistribution?.items) ? sourceDistribution.items : []
  if (!items.length) return null

  return (
    <Card className="overflow-hidden border-white/10 bg-gradient-to-br from-[#171125] via-[#100B19] to-black/35 shadow-[0_18px_40px_rgba(0,0,0,0.2)]">
      <div className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr] xl:items-center">
        <div>
          <div className="text-[11px] uppercase tracking-[0.24em] text-slate-300">Hero source mix</div>
          <div className="mt-1 text-sm text-slate-100">{sourceDistribution?.honestLabel || 'Latest traffic source mix'}</div>

          <div className="relative mt-4 h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip content={<WebsiteTrafficSourceTooltip />} />
                <Pie
                  data={items}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={72}
                  outerRadius={102}
                  paddingAngle={3}
                  stroke="rgba(9, 7, 16, 0.95)"
                  strokeWidth={4}
                >
                  {items.map((item) => (
                    <Cell key={item.key} fill={WEBSITE_TRAFFIC_SOURCE_COLORS[item.key] || '#A855F7'} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-3xl font-black text-white">{fmtCompactNum(sourceDistribution?.total)}</div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.2em] text-slate-300">Tracked sessions</div>
            </div>
          </div>
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-[0.24em] text-slate-300">Ranked channels</div>
          <div className="mt-3 space-y-3">
            {items.map((item, index) => (
              <div key={item.key} className="rounded-2xl border border-white/10 bg-black/35 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-slate-400">#{index + 1}</span>
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: WEBSITE_TRAFFIC_SOURCE_COLORS[item.key] || '#A855F7' }}
                    />
                    <span className="text-sm font-semibold text-white">{item.label}</span>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-semibold text-white">{fmtCompactNum(item.value)}</div>
                    <div className="text-[11px] text-slate-300">{fmtSharePct(item.share)}</div>
                  </div>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(item.share * 100, 6)}%`,
                      backgroundColor: WEBSITE_TRAFFIC_SOURCE_COLORS[item.key] || '#A855F7',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}

function WebsiteTrafficInsightBox({ insights = [], note = '' }) {
  if (!insights.length && !note) return null

  return (
    <Card className="border-violet-400/25 bg-gradient-to-br from-violet-400/12 via-[#151022] to-black/35 shadow-[0_16px_36px_rgba(76,29,149,0.2)]">
      <div className="text-[11px] uppercase tracking-[0.24em] text-violet-100">Traffic insight summary</div>
      {insights.length > 0 && (
        <div className="mt-3 space-y-2">
          {insights.map((insight) => (
            <div key={insight} className="flex gap-2 text-sm text-violet-50">
              <span className="text-violet-200">•</span>
              <span>{insight}</span>
            </div>
          ))}
        </div>
      )}
      {note ? <div className="mt-3 text-xs text-violet-100/80">{note}</div> : null}
    </Card>
  )
}

function WebsiteTrafficHistoryTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null

  const point = payload[0]?.payload || {}

  return (
    <div className="rounded-xl border border-[var(--brand-border)] bg-[#120E1F]/95 px-3 py-2 text-xs shadow-2xl">
      <div className="font-semibold text-white">{fmtPeriodLong(label || point.periodMonth)}</div>
      <div className="mt-2 space-y-1 text-slate-200">
        <div>Sessions: {fmtNum(point.sessions)}</div>
        <div>Active users: {fmtNum(point.activeUsers)}</div>
        {point.source && <div className="text-slate-300">Source: {point.source === 'GAMetricsDaily' ? 'Backfilled from GA daily history' : 'Monthly GA snapshot'}</div>}
        {point.checkedAt && <div className="text-slate-400">Captured {fmtDate(point.checkedAt)}</div>}
      </div>
    </div>
  )
}

function WebsiteTrafficHistoryChart({ history }) {
  const points = Array.isArray(history?.points) ? history.points : []
  if (!points.length) return null

  const latest = points[points.length - 1] || null
  const backfilledMonths = Number(history?.backfilledMonths || 0)
  const coverageLabel = `${points.length} month${points.length === 1 ? '' : 's'} available`

  return (
    <Card className="overflow-hidden border-white/10 bg-gradient-to-br from-[#140F22] via-[#0E0917] to-black/35 shadow-[0_18px_40px_rgba(0,0,0,0.22)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.24em] text-slate-300">12-month traffic trend</div>
          <div className="mt-1 text-sm text-slate-100">
            {backfilledMonths > 0
              ? 'Real GA history backfilled from daily records where monthly snapshots were missing'
              : 'Showing real stored GA history currently available for this client'}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-slate-100">
            <span className="h-2 w-2 rounded-full bg-violet-400" /> Sessions
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-slate-100">
            <span className="h-2 w-2 rounded-full bg-cyan-400" /> Active users
          </span>
          <span className="inline-flex items-center rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-slate-100">
            {coverageLabel}
          </span>
          {backfilledMonths > 0 ? (
            <span className="inline-flex items-center rounded-full border border-violet-400/30 bg-violet-400/12 px-3 py-1.5 text-violet-100">
              {backfilledMonths} backfilled
            </span>
          ) : null}
          {latest?.periodMonth ? (
            <span className="inline-flex items-center rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-slate-300">
              Latest {fmtMonth(latest.periodMonth)}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-5 h-72 rounded-2xl border border-white/8 bg-black/20 p-3">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="trafficSessionsStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#C084FC" />
                <stop offset="100%" stopColor="#8B5CF6" />
              </linearGradient>
              <linearGradient id="trafficUsersStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#67E8F9" />
                <stop offset="100%" stopColor="#22D3EE" />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="periodMonth"
              tick={{ fill: '#CBD5E1', fontSize: 11 }}
              tickFormatter={fmtMonth}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#CBD5E1', fontSize: 11 }}
              tickFormatter={fmtCompactNum}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <Tooltip content={<WebsiteTrafficHistoryTooltip />} />
            <Line
              type="monotone"
              dataKey="sessions"
              name="Sessions"
              stroke="url(#trafficSessionsStroke)"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, fill: '#8B5CF6', stroke: '#1F1631' }}
            />
            <Line
              type="monotone"
              dataKey="activeUsers"
              name="Active users"
              stroke="url(#trafficUsersStroke)"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, fill: '#22D3EE', stroke: '#0F172A' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

function WebsiteAuditHistoryTable({ items = [], loading = false, error = '' }) {
  if (loading) {
    return (
      <Card>
        <div className="space-y-2 animate-pulse">
          <div className="h-4 w-40 rounded bg-white/10" />
          <div className="h-10 rounded-xl bg-white/10" />
          <div className="h-10 rounded-xl bg-white/10" />
          <div className="h-10 rounded-xl bg-white/10" />
        </div>
      </Card>
    )
  }

  if (error) {
    return <Empty>{error}</Empty>
  }

  if (!items.length) {
    return <Empty>No monthly audit history yet. Refresh Audit to create the first cached snapshot.</Empty>
  }

  return (
    <Card className="border-white/10 bg-gradient-to-br from-[#151021] via-[#0E0A16] to-black/35">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-[0.24em] text-slate-300">
              <th className="px-1 py-2 font-medium">Month</th>
              <th className="px-1 py-2 font-medium">Page Speed</th>
              <th className="px-1 py-2 font-medium">Mobile</th>
              <th className="px-1 py-2 font-medium">Technical SEO</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.periodMonth} className="border-b border-white/10 last:border-0">
                <td className="px-1 py-3 text-slate-100">{fmtMonth(item.periodMonth)}</td>
                <td className="px-1 py-3">
                  <WebsiteHistoryScore value={item.pageSpeed?.score} />
                </td>
                <td className="px-1 py-3">
                  <WebsiteHistoryScore
                    value={item.mobile?.score}
                    max={item.mobile?.maxScore || 100}
                    text={item.mobile?.score == null ? null : `${item.mobile.score}/${item.mobile?.maxScore || 100}`}
                  />
                </td>
                <td className="px-1 py-3">
                  <WebsiteHistoryScore value={item.technicalSeo?.score} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function WebsiteTab({ profile, acronym }) {
  const isGYCWebsite = !!profile.hasWebsite
  const websiteUrl   = profile.website || null
  const [audit, setAudit] = useState(null)
  const [auditLoading, setAuditLoading] = useState(true)
  const [auditError, setAuditError] = useState('')
  const [refreshingAudit, setRefreshingAudit] = useState(false)
  const [auditHistory, setAuditHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState('')
  const [traffic, setTraffic] = useState(null)
  const [trafficLoading, setTrafficLoading] = useState(true)
  const [trafficError, setTrafficError] = useState('')

  const loadWebsiteData = useCallback(async () => {
    setAuditLoading(true)
    setAuditError('')
    setHistoryLoading(true)
    setHistoryError('')
    setTrafficLoading(true)
    setTrafficError('')

    const fetchJson = async (url, fallbackMessage) => {
      const res = await fetch(url, { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || fallbackMessage)
      return json
    }

    const [auditResult, trafficResult, historyResult] = await Promise.allSettled([
      fetchJson(`/api/clients/${acronym}/website-audit`, 'Failed to load website audit.'),
      fetchJson(`/api/clients/${acronym}/website-traffic`, 'Failed to load website traffic.'),
      fetchJson(`/api/clients/${acronym}/website-audit/history?limit=12`, 'Failed to load website audit history.'),
    ])

    if (auditResult.status === 'fulfilled') {
      setAudit(auditResult.value)
      setAuditError('')
    } else {
      setAudit(null)
      setAuditError(auditResult.reason?.message || 'Failed to load website audit.')
    }
    setAuditLoading(false)

    if (trafficResult.status === 'fulfilled') {
      setTraffic(trafficResult.value)
      setTrafficError('')
    } else {
      setTraffic(null)
      setTrafficError(trafficResult.reason?.message || 'Failed to load website traffic.')
    }
    setTrafficLoading(false)

    if (historyResult.status === 'fulfilled') {
      setAuditHistory(Array.isArray(historyResult.value.items) ? historyResult.value.items : [])
      setHistoryError('')
    } else {
      setAuditHistory([])
      setHistoryError(historyResult.reason?.message || 'Failed to load website audit history.')
    }
    setHistoryLoading(false)
  }, [acronym])

  const refreshAudit = useCallback(async () => {
    setRefreshingAudit(true)

    try {
      const res = await fetch(`/api/clients/${acronym}/website-audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Failed to refresh website audit.')

      setAudit(json)
      setAuditError('')

      const historyRes = await fetch(`/api/clients/${acronym}/website-audit/history?limit=12`, { cache: 'no-store' })
      const historyJson = await historyRes.json().catch(() => ({}))
      if (!historyRes.ok) throw new Error(historyJson.error || 'Failed to load website audit history.')

      setAuditHistory(Array.isArray(historyJson.items) ? historyJson.items : [])
      setHistoryError('')
    } catch (error) {
      setAuditError(error.message || 'Failed to refresh website audit.')
    } finally {
      setRefreshingAudit(false)
    }
  }, [acronym])

  useEffect(() => {
    loadWebsiteData()
  }, [loadWebsiteData])

  const pageSpeed = audit?.pageSpeed || null
  const mobile = audit?.mobile || null
  const technicalSeo = audit?.technicalSeo || null
  const topIssues = Array.isArray(audit?.topIssues)
    ? audit.topIssues.map(normalizeWebsiteAuditIssue).filter(Boolean)
    : []
  const mobileSubscores = Array.isArray(mobile?.subscores) ? mobile.subscores : []
  const mobileBreakdown = Array.isArray(mobile?.breakdown) ? mobile.breakdown : []
  const readabilitySubscore = mobileSubscores.find((item) => item.label === 'Readability')?.score ?? null
  const tapUsabilitySubscore = mobileSubscores.find((item) => item.label === 'Tap usability')?.score ?? null
  const mobilePerformanceSubscore = mobileSubscores.find((item) => item.label === 'Mobile performance')?.score ?? null
  const auditMessage = auditError || audit?.message || ''
  const trafficMetrics = traffic?.metrics || null
  const trafficHistory = Array.isArray(traffic?.history?.points) ? traffic.history.points : []
  const trafficComparisons = traffic?.history?.comparisons || null
  const trafficSourceDistribution = traffic?.sourceDistribution || null
  const trafficInsights = Array.isArray(traffic?.insights) ? traffic.insights : []
  const trafficMessage = trafficError || traffic?.history?.message || ((!traffic?.connected || trafficHistory.length === 0) ? (traffic?.message || '') : '')
  const trafficInsightNote = [trafficSourceDistribution?.note, trafficMessage].filter(Boolean).join(' ')
  const trafficKpis = [
    {
      label: 'Users / Active Users',
      value: fmtNum(trafficMetrics?.activeUsers),
      comparison: trafficComparisons?.activeUsers,
      dotClassName: 'bg-cyan-400 text-cyan-400',
    },
    {
      label: 'Sessions',
      value: fmtNum(trafficMetrics?.sessions),
      comparison: trafficComparisons?.sessions,
      dotClassName: 'bg-violet-400 text-violet-400',
    },
    {
      label: 'New users',
      value: fmtNum(trafficMetrics?.newUsers),
      comparison: trafficComparisons?.newUsers,
      dotClassName: 'bg-emerald-400 text-emerald-400',
    },
    {
      label: 'Engagement rate',
      value: trafficMetrics?.engagementRate == null ? '—' : `${trafficMetrics.engagementRate}%`,
      comparison: trafficComparisons?.engagementRate,
      isRate: true,
      dotClassName: 'bg-amber-400 text-amber-400',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Badge row */}
      <div className="flex flex-wrap gap-2">
        {isGYCWebsite ? (
          <Badge label="🌐 GYC Website" className="border-violet-500/40 bg-violet-500/15 text-violet-200" />
        ) : (
          <Badge label="🌐 Client's Own Website" className="border-gray-500/30 bg-gray-500/10 text-gray-300" />
        )}
        {profile.status && <StatusBadge status={profile.status} />}
      </div>

      {/* URL */}
      <div>
        <SectionTitle>Website URL</SectionTitle>
        <Card>
          {websiteUrl ? (
            <a
              href={websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`}
              target="_blank"
              rel="noreferrer"
              className="text-violet-400 hover:underline break-all"
            >
              {websiteUrl}
            </a>
          ) : (
            <span className="text-gray-500 text-sm">No website URL on record</span>
          )}
        </Card>
      </div>

      {/* GYC-built section */}
      {isGYCWebsite ? (
        <div>
          <SectionTitle>GYC Website Details</SectionTitle>
          <Card>
            <div className="space-y-2.5">
              <InfoRow label="Service tier" value={profile.crmType ? `Website (${profile.crmType})` : 'GYC Website'} />
              <InfoRow label="Launch date"  value={profile.startDate ? fmtDate(profile.startDate) : null} />
              {profile.clientFolderUrl && (
                <InfoRow label="Client folder" value="Open folder ↗" href={profile.clientFolderUrl} />
              )}
            </div>
          </Card>
        </div>
      ) : (
        <div>
          <SectionTitle>Client Website Info</SectionTitle>
          <Card>
            <div className="text-sm text-gray-400">
              This client manages their own website — GYC is not the web provider.
            </div>
            {profile.timeZone && (
              <div className="mt-2.5">
                <InfoRow label="Time zone" value={profile.timeZone} />
              </div>
            )}
          </Card>
        </div>
      )}

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <SectionTitle>Website Traffic</SectionTitle>
          {traffic?.checkedAt && (
            <Badge label={`GA synced ${fmtDateTime(traffic.checkedAt)}`} className="border-white/10 bg-black/35 text-slate-100" />
          )}
          {traffic?.history?.coverageMonths > 0 && (
            <Badge label={`${traffic.history.coverageMonths} month${traffic.history.coverageMonths === 1 ? '' : 's'} available`} className="border-white/10 bg-black/35 text-slate-100" />
          )}
          {traffic?.history?.backfilledMonths > 0 && (
            <Badge label={`${traffic.history.backfilledMonths} backfilled from daily GA`} className="border-violet-400/30 bg-violet-400/12 text-violet-100" />
          )}
          {traffic?.propertyId && (
            <Badge label={`Property ${traffic.propertyId}`} className="border-violet-500/30 bg-violet-500/10 text-violet-200" />
          )}
        </div>

        {trafficLoading ? (
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, idx) => <WebsiteMiniStatSkeleton key={idx} />)}
          </div>
        ) : trafficMetrics ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {trafficKpis.map((metric) => (
                <WebsiteTrafficKpiCard
                  key={metric.label}
                  label={metric.label}
                  value={metric.value}
                  comparison={metric.comparison}
                  isRate={metric.isRate}
                  dotClassName={metric.dotClassName}
                />
              ))}
            </div>

            {(trafficComparisons?.sessions || trafficComparisons?.activeUsers) && (
              <div className="flex flex-wrap gap-2">
                <WebsiteTrafficComparisonPill label="Sessions vs last month" value={trafficComparisons?.sessions?.vsLastMonthPct} />
                <WebsiteTrafficComparisonPill label="Users vs last month" value={trafficComparisons?.activeUsers?.vsLastMonthPct} />
                <WebsiteTrafficComparisonPill label="New users vs 3-mo avg" value={trafficComparisons?.newUsers?.vsThreeMonthAvgPct} />
                <WebsiteTrafficComparisonPill label="Engagement vs 3-mo avg" value={trafficComparisons?.engagementRate?.vsThreeMonthAvgPct} />
              </div>
            )}

            <WebsiteTrafficSourceDonut sourceDistribution={trafficSourceDistribution} />

            <WebsiteTrafficHistoryChart history={traffic?.history} />

            <WebsiteTrafficInsightBox
              insights={trafficInsights}
              note={trafficInsightNote || 'Top-line metrics use the latest GA 30-day snapshot, and the trend chart shows monthly snapshots captured in the database.'}
            />
          </div>
        ) : trafficMessage ? (
          <PlaceholderBanner icon={trafficError ? '⚠️' : '📊'} message={trafficMessage} />
        ) : (
          <Empty>No traffic metrics available for this client yet.</Empty>
        )}
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <SectionTitle>Quality Audit</SectionTitle>
          {audit?.checkedAt && (
            <Badge label={`Last checked ${fmtDateTime(audit.checkedAt)}`} className="border-white/10 bg-black/35 text-slate-100" />
          )}
          {audit?.cached && (
            <Badge label="DB-cached snapshot" className="border-violet-400/30 bg-violet-400/12 text-violet-100" />
          )}
          {audit?.stale && (
            <Badge label="Stale" className="border-amber-400/35 bg-amber-400/14 text-amber-100" />
          )}
          <button
            type="button"
            onClick={refreshAudit}
            disabled={refreshingAudit || auditLoading || !websiteUrl}
            className="inline-flex items-center rounded-full border border-violet-400/35 bg-violet-400/14 px-3 py-1.5 text-xs font-semibold text-violet-100 shadow-[0_0_20px_rgba(167,139,250,0.12)] transition hover:bg-violet-400/22 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {refreshingAudit ? 'Refreshing…' : 'Refresh audit'}
          </button>
        </div>

        {auditMessage && !auditLoading && (
          <div className="mb-3">
            <PlaceholderBanner icon={audit?.reason === 'fetch_failed' || auditError ? '⚠️' : 'ℹ️'} message={auditMessage} />
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          {auditLoading ? (
            <>
              <WebsiteAuditSkeletonCard title="Page Speed" />
              <WebsiteAuditSkeletonCard title="Mobile Friendliness" />
              <WebsiteAuditSkeletonCard title="Technical SEO" />
            </>
          ) : (
            <>
              <WebsiteAuditCard
                icon="⚡"
                title="Page Speed"
                status={pageSpeed?.status}
                label={pageSpeed?.label || (audit?.configured ? 'Awaiting snapshot' : 'Not configured')}
                score={pageSpeed?.score}
                scoreSuffix={pageSpeed?.score != null ? '/100' : ''}
                footer={pageSpeed?.topIssues?.[0] ? `Watch: ${pageSpeed.topIssues[0]}` : 'Mobile Lighthouse snapshot'}
              >
                <div className="grid grid-cols-3 gap-2">
                  <WebsiteAuditMetric label="LCP" value={fmtAuditSeconds(pageSpeed?.lcp)} />
                  <WebsiteAuditMetric label="TBT" value={fmtAuditMs(pageSpeed?.tbt)} />
                  <WebsiteAuditMetric label="CLS" value={fmtAuditCls(pageSpeed?.cls)} />
                </div>
              </WebsiteAuditCard>

              <WebsiteAuditCard
                icon="📱"
                title="Mobile Friendliness"
                status={mobile?.status}
                label={mobile?.label || (audit?.configured ? 'Awaiting snapshot' : 'Not configured')}
                score={mobile?.score}
                scoreMax={mobile?.maxScore || 100}
                scoreSuffix={mobile?.score != null ? '/100' : ''}
                footer={mobile?.coverage?.note || 'V1 mobile score using currently available technical signals'}
              >
                <div className="space-y-3">
                  <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <div className="text-sm font-semibold text-white">{mobile?.interpretation || 'A clearer mobile scorecard will show here after the audit runs.'}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-300">{mobile?.explanation || 'Can a parent on their phone easily read, trust, and take the next step?'}</div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <WebsiteAuditMetric label="Readability" value={fmtAuditScoreOutOf100(readabilitySubscore)} />
                    <WebsiteAuditMetric label="Tap usability" value={fmtAuditScoreOutOf100(tapUsabilitySubscore)} />
                    <WebsiteAuditMetric label="Mobile speed" value={fmtAuditScoreOutOf100(mobilePerformanceSubscore)} />
                  </div>

                  <div>
                    <div className="mb-2 text-[10px] uppercase tracking-[0.22em] text-slate-400">Key checks</div>
                    <WebsiteAuditCheckList items={mobile?.checks || []} />
                  </div>

                  {mobileBreakdown.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {mobileBreakdown.map((item) => (
                        <WebsiteAuditMetric
                          key={item.label}
                          label={item.label}
                          value={item.score == null ? '—' : `${item.score}/${item.maxScore}`}
                        />
                      ))}
                    </div>
                  )}

                  <div>
                    <div className="mb-2 text-[10px] uppercase tracking-[0.22em] text-slate-400">Top mobile issues</div>
                    <WebsiteAuditIssueList items={mobile?.topIssues || []} />
                  </div>

                  {mobile?.methodologyNote && (
                    <div className="text-xs leading-5 text-slate-400">{mobile.methodologyNote}</div>
                  )}
                </div>
              </WebsiteAuditCard>

              <WebsiteAuditCard
                icon="🔍"
                title="Technical SEO"
                status={technicalSeo?.status}
                label={technicalSeo?.label || (audit?.configured ? 'Awaiting snapshot' : 'Not configured')}
                score={technicalSeo?.score}
                scoreSuffix={technicalSeo?.score != null ? '/100' : ''}
                footer={technicalSeo?.topIssues?.[0] ? `Watch: ${technicalSeo.topIssues[0]}` : 'Homepage crawl and technical health snapshot'}
              >
                <div className="grid grid-cols-3 gap-2">
                  <WebsiteAuditMetric label="Non-indexable" value={fmtNum(technicalSeo?.nonIndexable)} />
                  <WebsiteAuditMetric label="Broken" value={fmtNum(technicalSeo?.brokenIssues)} />
                  <WebsiteAuditMetric label="Dup meta" value={fmtNum(technicalSeo?.duplicateMeta)} />
                </div>
                <div className="mt-3">
                  <WebsiteAuditCheckList items={technicalSeo?.healthChecks || []} />
                </div>
              </WebsiteAuditCard>
            </>
          )}
        </div>

        <div className="mt-3">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="text-[11px] uppercase tracking-[0.24em] text-slate-300">Audit History</div>
            {!historyLoading && auditHistory.length > 0 && (
              <Badge label={`Last ${auditHistory.length} months`} className="border-white/10 bg-black/35 text-slate-100" />
            )}
          </div>
          <WebsiteAuditHistoryTable items={auditHistory} loading={historyLoading} error={historyError} />
        </div>

        {!auditLoading && !auditError && audit?.reason === 'no_website' && (
          <div className="mt-3">
            <Empty>Add a website URL to this client profile to run the quality audit.</Empty>
          </div>
        )}

        {!auditLoading && topIssues.length > 0 && (
          <div className="mt-3">
            <Card className="overflow-hidden border-white/10 bg-gradient-to-br from-[#171126] via-[#0F0B18] to-black/40 shadow-[0_18px_40px_rgba(0,0,0,0.2)]">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-300">Top Issues</div>
                {audit?.websiteUrl && (
                  <a href={audit.websiteUrl} target="_blank" rel="noreferrer" className="text-xs text-violet-200 hover:underline">
                    Open site ↗
                  </a>
                )}
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {topIssues.slice(0, 5).map((issue, index) => (
                  <div
                    key={`${issue.label}-${index}`}
                    className={`rounded-2xl border px-3 py-3 ${WEBSITE_AUDIT_ISSUE_STYLES[issue.severity] || WEBSITE_AUDIT_ISSUE_STYLES.low}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold leading-5 text-white">{issue.label}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="rounded-full border border-white/15 bg-black/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/90">
                            {issue.area}
                          </span>
                          <span className="rounded-full border border-white/15 bg-black/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/90">
                            {getWebsiteIssueSeverityLabel(issue.severity)}
                          </span>
                        </div>
                        <div className="mt-3">
                          <WebsiteIssueBriefField label="Summary" value={issue.summary} />
                        </div>
                      </div>
                      <span className="rounded-full border border-white/15 bg-black/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/90">
                        {issue.severity || 'low'}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <WebsiteIssueBriefField label="Why it matters" value={issue.whyItMatters} />
                      <WebsiteIssueBriefField label="Likely cause / inspection area" value={issue.likelyCause} />
                      <WebsiteIssueBriefField label="Recommended fix" value={issue.recommendedFix} className="md:col-span-2" />
                      <WebsiteIssueBriefField label="GA / client talking point" value={issue.talkingPoint} className="md:col-span-2" />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {!auditLoading && !auditError && audit?.configured && topIssues.length === 0 && audit?.reason == null && (
          <div className="mt-3">
            <Empty>No major issues surfaced in this snapshot.</Empty>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tab 4: SEO ────────────────────────────────────────────────────────────────

// ── InfoTip — hover tooltip for metric definitions ──────────────────────────
function InfoTip({ text }) {
  return (
    <span
      title={text}
      style={{ cursor: 'help', color: '#4b5563', fontSize: 12, marginLeft: 4, userSelect: 'none', flexShrink: 0 }}
      aria-label={text}
    >ⓘ</span>
  )
}

// ── SEO helpers ──────────────────────────────────────────────────────────────

const SOLV_TIP = 'Share of Local Voice — the % of Local Falcon grid points where this business appears in the Google Maps top 20 results. Higher % = stronger local visibility. 0% = not visible from any scanned point. 100% = visible everywhere in the coverage area.'
const ARP_TIP  = 'Average Rank Position — the average position this business holds across all Local Falcon grid points where it appeared. Lower number = better. #1 is the top result. 20+ means the business was not found in the top 20.'

function SolvGauge({ label, value }) {
  const pct = value != null ? Math.min(Math.max(Number(value), 0), 100) : null
  const color = pct == null ? '#6b7280'
    : pct >= 25 ? '#22c55e'
    : pct >= 10 ? '#f59e0b'
    : '#ef4444'
  return (
    <div style={{ textAlign: 'center', minWidth: 90 }}>
      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        {label}<InfoTip text={SOLV_TIP} />
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: pct != null ? color : '#4b5563' }}>
        {pct != null ? `${pct.toFixed(1)}%` : '—'}
      </div>
      {pct != null && (
        <div style={{ marginTop: 5, height: 4, borderRadius: 2, background: '#1f2937', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.4s ease' }} />
        </div>
      )}
    </div>
  )
}

function ArpBadge({ label, value }) {
  const isNum = value != null && value !== '—' && value !== 'N/A' && !isNaN(parseFloat(value))
  const num = isNum ? parseFloat(value) : null
  const color = num == null ? '#6b7280'
    : num <= 5 ? '#22c55e'
    : num <= 10 ? '#f59e0b'
    : '#ef4444'
  return (
    <div style={{ textAlign: 'center', minWidth: 80 }}>
      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        {label}<InfoTip text={ARP_TIP} />
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color }}>
        {value || '—'}
      </div>
      <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>rank pos.</div>
    </div>
  )
}

function SEOLocationBlock({ acronym, loc, snapshots, gbpRows, isMultiLoc, heatmaps = [], gbpInfo = null, isOnProgram = true }) {
  const [open,     setOpen]     = useState(false)
  const [hmRadius, setHmRadius] = useState(3)
  const [hmKw,     setHmKw]     = useState('daycare')

  // Group heatmaps by radius → keyword → [sorted by scanDate DESC = latest first]
  const hmByRadius = useMemo(() => {
    const map = {}
    for (const hm of heatmaps) {
      const r = Number(hm.radiusMiles) || 3
      if (!map[r]) map[r] = {}
      if (!map[r][hm.keyword]) map[r][hm.keyword] = []
      map[r][hm.keyword].push(hm)
    }
    // Sort each group by scanDate DESC
    for (const r of Object.keys(map))
      for (const kw of Object.keys(map[r]))
        map[r][kw].sort((a, b) => new Date(b.scanDate) - new Date(a.scanDate))
    return map
  }, [heatmaps])
  const hmRadii    = Object.keys(hmByRadius).map(Number).sort((a, b) => a - b)
  const hmKeywords = [...new Set(heatmaps.map(h => h.keyword))].sort()
  // Latest scan for current selection
  const activeHmList = hmByRadius[hmRadius]?.[hmKw] || []
  const activeHm     = activeHmList[0] || null

  // Historical trend: avgRank per scan date for active radius+keyword
  const hmTrendData = useMemo(() => {
    return activeHmList.map(hm => {
      const pts    = hm.points || []
      const ranked = pts.filter(p => p.rank != null)
      return {
        date:    new Date(hm.scanDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        avgRank: ranked.length ? +(ranked.reduce((s, p) => s + p.rank, 0) / ranked.length).toFixed(1) : null,
        ranked:  ranked.length,
      }
    }).reverse() // chronological for chart
  }, [activeHmList])
  const primary = snapshots.find(s => s.locationName === loc && s.keywordGroup === 'primary') || null
  const best    = snapshots.find(s => s.locationName === loc && s.keywordGroup === 'best') || null

  // Chart data: SOLV over time for this location (primary group, chronological)
  const chartData = useMemo(() => {
    const rows = snapshots
      .filter(s => s.locationName === loc && s.keywordGroup === 'primary' && (s.solvDaycare != null || s.solvPreschool != null))
      .slice()  // copy
      .sort((a, b) => new Date(a.scanDate) - new Date(b.scanDate))
    return rows.map(s => ({
      date: new Date(s.scanDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      daycare: s.solvDaycare,
      preschool: s.solvPreschool,
    }))
  }, [snapshots, loc])

  const fmtScanDate = (snap) => {
    if (!snap?.scanDate) return null
    return new Date(snap.scanDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const fmtMonthLabel = (dateStr) => {
    if (!dateStr) return ''
    try { return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) }
    catch { return '' }
  }

  const gbpDelta = (curr, prev, field) => {
    if (curr == null || prev == null) return null
    const c = curr[field]
    const p = prev[field]
    if (c == null || p == null) return null
    const d = c - p
    if (d === 0) return null
    return d
  }

  return (
    <div style={{
        marginBottom: 32,
        // Prospect sections get a subtle amber tint to distinguish from program locations
        background: !isOnProgram ? 'rgba(251,191,36,0.03)' : 'transparent',
        borderLeft: !isOnProgram ? '2px solid rgba(251,191,36,0.2)' : '2px solid transparent',
        paddingLeft: !isOnProgram ? 10 : 0,
        borderRadius: !isOnProgram ? 4 : 0,
      }}>
      {/* Collapsible location header — always shown */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: open ? 16 : 0,
          width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          textAlign: 'left', flexWrap: 'wrap',
        }}
      >
        <div style={{ width: 3, height: 20, borderRadius: 2, background: isOnProgram ? '#731494' : '#d97706', flexShrink: 0 }} />
        <h3 style={{ fontSize: 15, fontWeight: 700, color: isOnProgram ? '#c4b5fd' : '#fcd34d', margin: 0 }}>
          {loc || 'Location'}
        </h3>
        {gbpInfo?.rating != null && (
          <span style={{ fontSize: 12, color: '#fbbf24', fontWeight: 600 }}>⭐ {gbpInfo.rating.toFixed(1)}</span>
        )}
        {gbpInfo?.reviewCount != null && (
          <span style={{ fontSize: 12, color: '#9ca3af' }}>({gbpInfo.reviewCount.toLocaleString()} reviews)</span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#6b7280', paddingRight: 4 }}>
          {open ? '▾' : '▸'}
        </span>
      </button>

      {open && <>

      {/* Prospect-only banner — inside expanded content */}
      {!isOnProgram && (
        <div style={{
          background: 'rgba(251,191,36,0.06)',
          border: '1px solid rgba(251,191,36,0.25)',
          borderRadius: 8,
          padding: '8px 14px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
        }}>
          <div style={{ fontSize: 16, lineHeight: 1 }}>⚠️</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24' }}>Not on SEO Program — Prospect Intel Only</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>This location is not enrolled in GYC’s SEO service. Heatmaps are refreshed monthly to keep GAs prepared for conversations. No ranking data is tracked.</div>
          </div>
        </div>
      )}

      {/* GBP live snapshot for non-program locations */}
      {!isOnProgram && gbpInfo && (gbpInfo.rating != null || gbpInfo.reviewCount != null || gbpInfo.address) && (
        <div style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {gbpInfo.address && (
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 14px', fontSize: 12, color: '#9ca3af' }}>
              📍 {gbpInfo.address}
            </div>
          )}
          {gbpInfo.rating != null && (
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 14px', fontSize: 12, color: '#fbbf24', fontWeight: 600 }}>
              ⭐ {gbpInfo.rating.toFixed(1)} Google Rating
            </div>
          )}
          {gbpInfo.reviewCount != null && (
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 14px', fontSize: 12, color: '#9ca3af' }}>
              {gbpInfo.reviewCount.toLocaleString()} Reviews
            </div>
          )}
        </div>
      )}

      {/* Heatmap — map + grid above Primary Keywords */}
      {heatmaps.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Local Rank Heatmap</span>
            <InfoTip text="A grid showing how this business ranks in Google Maps for the selected keyword, as if someone were standing at each geographic point and searching. Each cell = one search point in the coverage area. Green = ranked high (visible). Red / 20+ = not in top 20 results from that location." />
          </div>
          {/* Controls */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Radius
              <InfoTip text="The geographic area covered by the heatmap grid. 3 mi = the grid extends 3 miles from the business in every direction. Use 3 mi for urban/dense markets, 5 mi for suburban." />
            </span>
            {hmRadii.length > 1 && hmRadii.map(r => (
              <button key={r} onClick={() => setHmRadius(r)} style={{
                padding: '3px 10px', borderRadius: 16, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                border: hmRadius === r ? '1px solid #a78bfa' : '1px solid rgba(255,255,255,0.1)',
                background: hmRadius === r ? 'rgba(167,139,250,0.15)' : 'rgba(0,0,0,0.3)',
                color: hmRadius === r ? '#c4b5fd' : '#9ca3af',
              }}>{r} mi</button>
            ))}
            {hmKeywords.length > 1 && <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em', marginLeft: 4 }}>Keyword <InfoTip text="The search term used to test how this business ranks in Google Maps. Daycare and Preschool are the most common terms parents use when searching for childcare." /></span>}
            {hmKeywords.length > 1 && hmKeywords.map(kw => (
              <button key={kw} onClick={() => setHmKw(kw)} style={{
                padding: '3px 10px', borderRadius: 16, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                textTransform: 'capitalize',
                border: hmKw === kw ? '1px solid #a78bfa' : '1px solid rgba(255,255,255,0.1)',
                background: hmKw === kw ? 'rgba(167,139,250,0.15)' : 'rgba(0,0,0,0.3)',
                color: hmKw === kw ? '#c4b5fd' : '#9ca3af',
              }}>{kw}</button>
            ))}
            {activeHm && (() => {
              const pts     = activeHm.points || []
              const ranked  = pts.filter(p => p.rank != null).length
              const avg     = ranked ? (pts.filter(p=>p.rank!=null).reduce((s,p)=>s+p.rank,0)/ranked).toFixed(1) : null
              const prevHm  = activeHmList[1]
              const prevRk  = prevHm?.points?.filter(p => p.rank != null) || []
              const prevAvg = prevRk.length ? prevRk.reduce((s,p)=>s+p.rank,0)/prevRk.length : null
              const delta   = (avg && prevAvg) ? (parseFloat(avg) - prevAvg).toFixed(1) : null
              return (
                <span style={{ fontSize: 11, color: '#9ca3af', display:'flex', alignItems:'center', gap: 8, flexWrap:'wrap' }}>
                  {avg && <span>Avg rank <strong style={{color:'#e5e7eb'}}>{avg}</strong><InfoTip text="Average position across all 25 grid points where this business appeared in Google Maps results. Lower number = better. #1 means top result." /></span>}
                  {delta !== null && (
                    <span style={{ fontWeight: 700, color: parseFloat(delta) < 0 ? '#22c55e' : parseFloat(delta) > 0 ? '#ef4444' : '#9ca3af' }}>
                      {parseFloat(delta) < 0 ? '↑' : parseFloat(delta) > 0 ? '↓' : '→'} {Math.abs(parseFloat(delta)).toFixed(1)} vs prev
                    </span>
                  )}
                  <span>{ranked}/{pts.length} ranked<InfoTip text="Number of grid points (out of 25) where this business appeared in the top 20 Google Maps results. 25/25 = visible across the full coverage area." /></span>
                  {activeHm.scanDate && <span>{new Date(activeHm.scanDate).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>}
                  {activeHmList.length > 1 && <span style={{color:'#6b7280'}}>{activeHmList.length} scans stored</span>}
                </span>
              )
            })()}
          </div>
          {/* Map + grid row */}
          {!activeHm ? (
            <div style={{color:'#6b7280',fontSize:12}}>No {hmRadius}-mile scan available yet</div>
          ) : (
            <>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {/* Map — fixed square matching grid dimensions, with radius badge overlay */}
              <div style={{ position: 'relative', width: 236, height: 236, flexShrink: 0 }}>
                <iframe
                  title={`${loc || 'Location'} map`}
                  src={`https://maps.google.com/maps?q=${activeHm.centerLat},${activeHm.centerLng}&z=${hmRadius >= 5 ? 10 : 11}&output=embed`}
                  style={{ width: 236, height: 236, border: 'none', borderRadius: 10, opacity: 0.9, display: 'block' }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
                {/* Radius badge overlay */}
                <div style={{
                  position: 'absolute', top: 8, left: 8,
                  background: 'rgba(20,4,40,0.85)',
                  backdropFilter: 'blur(4px)',
                  border: '1px solid rgba(174,43,207,0.5)',
                  borderRadius: 8,
                  padding: '3px 9px',
                  fontSize: 11, fontWeight: 700,
                  color: '#c4b5fd',
                  pointerEvents: 'none',
                  userSelect: 'none',
                  letterSpacing: '0.05em',
                }}>
                  {hmRadius} mi radius
                </div>
              </div>
              <HeatmapGrid points={activeHm.points || []} gridSize={activeHm.gridSize || 5} />
            </div>

            {/* Historical trend chart — only shows when 2+ scans exist */}
            {hmTrendData.length >= 2 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                  Avg Rank Trend · {hmTrendData.length} scans <InfoTip text="Weekly average rank over time. Y-axis is inverted — a line moving UP means the rank number got LOWER (better). Consistent improvement here means the SEO program is expanding this location’s visibility." />
                </div>
                <ResponsiveContainer width="100%" height={100}>
                  <LineChart data={hmTrendData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis reversed tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false}
                           domain={['auto','auto']} label={{ value: 'rank', angle: -90, position: 'insideLeft', fill: '#4b5563', fontSize: 9, dx: 10 }} />
                    <Tooltip
                      contentStyle={{ background: '#1a0a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
                      labelStyle={{ color: '#c4b5fd' }}
                      formatter={(v) => [v != null ? `#${v}` : '—', 'Avg Rank']}
                    />
                    <Line type="monotone" dataKey="avgRank" stroke="#AE2BCF" strokeWidth={2}
                          dot={{ fill: '#AE2BCF', r: 3 }} activeDot={{ r: 5 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            </>)
          }
        </div>
      )}

      {/* Primary Keywords */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
          <span>Primary Keywords</span>
          <InfoTip text={'Ranking data for “daycare” and “preschool” — the most common searches parents use when looking for childcare. Source: Local Falcon grid scans.'} />
          {primary?.scanDate && <span style={{ fontWeight: 400, color: '#6b7280', marginLeft: 4, textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>· as of {fmtScanDate(primary)}</span>}
        </div>
        {primary ? (
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '16px 20px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'space-around', marginBottom: 14 }}>
              <SolvGauge label="SOLV Daycare" value={primary.solvDaycare} />
              <SolvGauge label="SOLV Preschool" value={primary.solvPreschool} />
              <ArpBadge label="ARP Daycare" value={primary.arpDaycare} />
              <ArpBadge label="ARP Preschool" value={primary.arpPreschool} />
            </div>
            {(primary.reportUrlDaycare || primary.reportUrlPreschool) && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {primary.reportUrlDaycare && (
                  <a href={primary.reportUrlDaycare} target="_blank" rel="noreferrer"
                    style={{ fontSize: 12, color: '#a78bfa', textDecoration: 'none', padding: '4px 10px', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 8, background: 'rgba(167,139,250,0.08)' }}>
                    🔗 Daycare Report
                  </a>
                )}
                {primary.reportUrlPreschool && (
                  <a href={primary.reportUrlPreschool} target="_blank" rel="noreferrer"
                    style={{ fontSize: 12, color: '#a78bfa', textDecoration: 'none', padding: '4px 10px', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 8, background: 'rgba(167,139,250,0.08)' }}>
                    🔗 Preschool Report
                  </a>
                )}
              </div>
            )}
          </div>
        ) : (
          <div style={{ color: '#6b7280', fontSize: 13, padding: '12px 0' }}>No ranking data yet</div>
        )}
      </div>

      {/* Trend Chart */}
      {chartData.length >= 2 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 3 }}>SOLV Trend<InfoTip text="Share of Local Voice over time, from Local Falcon grid scans. Purple line = Daycare keyword. Violet line = Preschool. Higher % = more of the scanned area where this business is visible in Google Maps results." /></div>
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '16px 20px' }}>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                <Tooltip
                  contentStyle={{ background: '#1a0a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontSize: 12 }}
                  labelStyle={{ color: '#c4b5fd' }}
                  formatter={(v, name) => [v != null ? `${v.toFixed(1)}%` : '—', name]}
                />
                <Line type="monotone" dataKey="daycare" name="Daycare" stroke="#731494" strokeWidth={2} dot={{ fill: '#731494', r: 4 }} activeDot={{ r: 6 }} connectNulls />
                <Line type="monotone" dataKey="preschool" name="Preschool" stroke="#AE2BCF" strokeWidth={2} dot={{ fill: '#AE2BCF', r: 4 }} activeDot={{ r: 6 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Best Keywords */}
      {best && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Best Keywords<InfoTip text={'Rankings for “best daycare” and “best preschool” — higher-intent searches where parents are actively comparing options. Harder to rank for than primary keywords but more valuable — these searches have stronger intent to enroll.'} /></span>
            {best?.scanDate && <span style={{ fontWeight: 400, color: '#6b7280', marginLeft: 8, textTransform: 'none', letterSpacing: 0 }}>· as of {fmtScanDate(best)}</span>}
          </div>
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '16px 20px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'space-around', marginBottom: best.reportUrlDaycare || best.reportUrlPreschool ? 14 : 0 }}>
              <SolvGauge label="SOLV Best Daycare" value={best.solvDaycare} />
              <SolvGauge label="SOLV Best Preschool" value={best.solvPreschool} />
              <ArpBadge label="ARP Best Daycare" value={best.arpDaycare} />
              <ArpBadge label="ARP Best Preschool" value={best.arpPreschool} />
            </div>
            {(best.reportUrlDaycare || best.reportUrlPreschool) && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {best.reportUrlDaycare && (
                  <a href={best.reportUrlDaycare} target="_blank" rel="noreferrer"
                    style={{ fontSize: 12, color: '#a78bfa', textDecoration: 'none', padding: '4px 10px', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 8, background: 'rgba(167,139,250,0.08)' }}>
                    🔗 Best Daycare Report
                  </a>
                )}
                {best.reportUrlPreschool && (
                  <a href={best.reportUrlPreschool} target="_blank" rel="noreferrer"
                    style={{ fontSize: 12, color: '#a78bfa', textDecoration: 'none', padding: '4px 10px', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 8, background: 'rgba(167,139,250,0.08)' }}>
                    🔗 Best Preschool Report
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* GBP Performance */}
      {gbpRows.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
            GBP Performance
            <InfoTip text="Monthly activity on this location's Google Business Profile. Source: Google Business Profile (pulled manually until live API access is granted). MoM changes shown as +/- in each cell." />
          </div>
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {[
                    { h: 'Month',        tip: null },
                    { h: 'Interactions', tip: 'Total actions taken on the profile — calls, direction requests, website clicks, and photo views combined.' },
                    { h: 'Views',        tip: 'How many times this Google Business Profile appeared in Google Search or Maps results.' },
                    { h: 'Searches',     tip: 'Searches that surfaced this profile — includes direct brand searches and discovery searches for related keywords.' },
                    { h: 'Calls',        tip: 'Phone calls made directly from the Google Business Profile listing.' },
                    { h: 'Directions',   tip: 'Direction requests made from the listing. A strong signal of intent to visit.' },
                    { h: 'Web Clicks',   tip: 'Clicks to the business website from the Google Business Profile.' },
                  ].map(({ h, tip }) => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: h === 'Month' ? 'left' : 'right', color: '#9ca3af', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>{h}{tip && <InfoTip text={tip} />}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gbpRows.map((row, i) => {
                  const prev = gbpRows[i + 1]
                  const fields = ['profileInteractions','profileViews','searches','calls','directionRequests','websiteClicks']
                  return (
                    <tr key={i} style={{ borderBottom: i < gbpRows.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                      <td style={{ padding: '10px 12px', color: '#e5e7eb', fontWeight: 500 }}>{fmtMonthLabel(row.month)}</td>
                      {fields.map(f => {
                        const val = row[f]
                        const delta = prev ? (val != null && prev[f] != null ? val - prev[f] : null) : null
                        return (
                          <td key={f} style={{ padding: '10px 12px', textAlign: 'right', color: '#d1d5db' }}>
                            {val != null ? val.toLocaleString() : '—'}
                            {delta != null && delta !== 0 && (
                              <span style={{ marginLeft: 4, fontSize: 10, color: delta > 0 ? '#22c55e' : '#ef4444' }}>
                                {delta > 0 ? `+${delta}` : delta}
                              </span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      </> /* end open */}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Demographics Tab
// ─────────────────────────────────────────────────────────────────────────

function incomeTierLabel(income) {
  if (income >= 110000) return { label: 'Premium', color: '#22c55e', pct: 100 }
  if (income >= 90000)  return { label: 'Upper Mid-Market', color: '#84cc16', pct: 80 }
  if (income >= 70000)  return { label: 'Mid-Market', color: '#eab308', pct: 60 }
  if (income >= 50000)  return { label: 'Value Market', color: '#f97316', pct: 40 }
  return { label: 'Subsidy-Eligible', color: '#ef4444', pct: 20 }
}

function DemographicsLocationBlock({ loc, incomeHeatmap }) {
  const score = loc.opportunityScore || 0
  const scoreColor = score >= 70 ? '#22c55e' : score >= 40 ? '#F59E0B' : '#ef4444'
  const incomeTier = incomeTierLabel(loc.medianHouseholdIncome || 0)
  const ts = loc.timeSeries || null

  return (
    <div style={{ background: 'rgba(26,10,46,0.5)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '20px 24px', marginBottom: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{loc.locationName}</div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>{loc.address}</div>
          {loc.zip && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>ZIP: {loc.zip}{loc.countyName ? ` · ${loc.countyName}` : ''}</div>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#9ca3af' }}>Opportunity Score</span>
            <span style={{
              background: scoreColor + '22',
              border: `1px solid ${scoreColor}55`,
              color: scoreColor,
              borderRadius: 8,
              padding: '4px 12px',
              fontSize: 18,
              fontWeight: 800,
              lineHeight: 1,
            }}>{score}</span>
          </div>
          <span style={{ fontSize: 10, color: '#6b7280' }}>/100</span>
        </div>
      </div>

      {/* Error state */}
      {loc.error && (
        <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 12 }}>⚠️ {loc.error}</div>
      )}

      {!loc.error && (
        <>
          {/* Signals */}
          {loc.signals && loc.signals.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {loc.signals.map((sig, i) => {
                const sigColor = sig.type === 'positive' ? '#4ade80' : sig.type === 'warning' ? '#fbbf24' : '#60a5fa'
                const sigBg = sig.type === 'positive' ? 'rgba(74,222,128,0.08)' : sig.type === 'warning' ? 'rgba(251,191,36,0.08)' : 'rgba(96,165,250,0.08)'
                const sigBorder = sig.type === 'positive' ? 'rgba(74,222,128,0.25)' : sig.type === 'warning' ? 'rgba(251,191,36,0.25)' : 'rgba(96,165,250,0.25)'
                return (
                  <span key={i} style={{
                    background: sigBg,
                    border: `1px solid ${sigBorder}`,
                    color: sigColor,
                    borderRadius: 20,
                    padding: '4px 12px',
                    fontSize: 12,
                    lineHeight: 1.4,
                  }}>{sig.text}</span>
                )
              })}
            </div>
          )}

          {/* 4 Key metric cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
            {[
              { icon: '🧒', label: 'Children Under 5', value: (loc.childrenUnder5 || 0).toLocaleString() },
              { icon: '💼', label: 'Working Parents (kids <6)', value: (loc.workingParentsUnder6 || 0).toLocaleString() },
              { icon: '💰', label: 'Median Household Income', value: `$${((loc.medianHouseholdIncome || 0) / 1000).toFixed(0)}K` },
              { icon: '🏫', label: 'Childcare Centers in County', value: (loc.childcareCenterCount || 0).toLocaleString() },
            ].map(({ icon, label, value }) => (
              <div key={label} style={{
                background: '#111111',
                border: '1px solid #2a1a3e',
                borderRadius: 12,
                padding: '14px 16px',
              }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4, lineHeight: 1.3 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Births & Demand section */}
          <div style={{ background: '#111111', border: '1px solid #2a1a3e', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Births &amp; Demand Signals</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
              {[
                { label: 'Births Last Year', value: (loc.birthsLastYear || 0).toLocaleString(), note: 'future demand proxy' },
                { label: 'Births per Center', value: loc.birthsPerCenter != null ? loc.birthsPerCenter.toFixed(1) : '—', note: 'demand/supply ratio' },
                { label: 'Children 5–9', value: (loc.children5to9 || 0).toLocaleString(), note: 'K–3 pipeline' },
                { label: 'Children 10–14', value: (loc.children10to14 || 0).toLocaleString(), note: 'after-school pipeline' },
              ].map(({ label, value, note }) => (
                <div key={label}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>{value}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{label}</div>
                  <div style={{ fontSize: 10, color: '#4b5563', marginTop: 1 }}>{note}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Income tier bar (summary) */}
          <div style={{ background: '#111111', border: '1px solid #2a1a3e', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Income Tier</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: incomeTier.color }}>{incomeTier.label}</span>
            </div>
            <div style={{ background: '#1f1f1f', borderRadius: 6, height: 8, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${incomeTier.pct}%`,
                background: `linear-gradient(90deg, #ef4444 0%, #f97316 25%, #eab308 50%, #84cc16 75%, #22c55e 100%)`,
                borderRadius: 6,
                transition: 'width 0.6s ease',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ fontSize: 9, color: '#4b5563' }}>&lt;$50K</span>
              <span style={{ fontSize: 9, color: '#4b5563' }}>$70K</span>
              <span style={{ fontSize: 9, color: '#4b5563' }}>$90K</span>
              <span style={{ fontSize: 9, color: '#4b5563' }}>$110K+</span>
            </div>
          </div>

          {/* Income Heatmap — 3mi radius grid */}
          <div style={{ marginBottom: 16 }}>
            <SectionTitle>Household Income Distribution — 3mi Radius</SectionTitle>
            {incomeHeatmap ? (
              <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '16px 20px' }}>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 12 }}>
                  Avg: <strong style={{ color: '#e5e7eb' }}>${incomeHeatmap.avgIncome != null ? Math.round(incomeHeatmap.avgIncome / 1000) : '—'}K</strong>
                  {' · Range: '}
                  <strong style={{ color: '#e5e7eb' }}>
                    ${incomeHeatmap.minIncome != null ? Math.round(incomeHeatmap.minIncome / 1000) : '—'}K
                    {' – '}
                    ${incomeHeatmap.maxIncome != null ? Math.round(incomeHeatmap.maxIncome / 1000) : '—'}K
                  </strong>
                  {' · 3mi radius · ACS 2023'}
                </div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <iframe
                    title={`${loc.locationName} income map`}
                    src={`https://maps.google.com/maps?q=${loc.lat},${loc.lng}&z=13&output=embed`}
                    style={{ width: 332, height: 332, flexShrink: 0, border: 'none', borderRadius: 10, opacity: 0.9 }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                  <IncomeHeatmapGrid points={incomeHeatmap.points} gridSize={incomeHeatmap.gridSize || 7} />
                </div>
              </div>
            ) : (
              <div style={{ color: '#6b7280', fontSize: 12, padding: '12px 0' }}>
                Loading income heatmap… (may take 60–90s on first load)
              </div>
            )}
          </div>

          {/* Time-series charts */}
          {ts && (
            <div style={{ marginBottom: 16 }}>

              {/* Chart 1: Annual Births */}
              {ts.births && ts.births.length > 1 && (
                <div style={{ marginBottom: 20 }}>
                  <SectionTitle>Annual Births in County — Trend</SectionTitle>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={ts.births} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => v.toLocaleString()} />
                      <Tooltip
                        contentStyle={{ background: '#111', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                        formatter={v => [v.toLocaleString(), 'Births']}
                        labelStyle={{ color: '#9ca3af' }}
                      />
                      <Bar dataKey="births" fill="#6366f1" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Chart 2: Children Under 5 */}
              {ts.childrenUnder5 && ts.childrenUnder5.length > 1 && (
                <div style={{ marginBottom: 20 }}>
                  <SectionTitle>Children Under 5 in ZIP — Trend</SectionTitle>
                  <div style={{ fontSize: 10, color: '#4b5563', marginBottom: 6 }}>ACS 5-year rolling estimates — each point is a 5-year average</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={ts.childrenUnder5} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => v.toLocaleString()} />
                      <Tooltip
                        contentStyle={{ background: '#111', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                        formatter={v => [v.toLocaleString(), 'Children Under 5']}
                        labelStyle={{ color: '#9ca3af' }}
                      />
                      <Line type="monotone" dataKey="count" stroke="#22c55e" strokeWidth={2} dot={{ r: 3, fill: '#22c55e' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Chart 3: Childcare Centers */}
              {ts.childcareCenters && ts.childcareCenters.length > 1 && (
                <div style={{ marginBottom: 20 }}>
                  <SectionTitle>Childcare Centers in County — Trend</SectionTitle>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={ts.childcareCenters} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ background: '#111', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                        formatter={v => [v, 'Centers']}
                        labelStyle={{ color: '#9ca3af' }}
                      />
                      <Line type="monotone" dataKey="count" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: '#f59e0b' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Chart 4: Children Per Center Ratio */}
              {ts.childrenPerCenter && ts.childrenPerCenter.length > 1 && (() => {
                const first = ts.childrenPerCenter[0]?.ratio || 0
                const last  = ts.childrenPerCenter[ts.childrenPerCenter.length - 1]?.ratio || 0
                const trendColor = last >= first ? '#22c55e' : '#ef4444'
                return (
                  <div style={{ marginBottom: 20 }}>
                    <SectionTitle>Children per Childcare Center — Demand/Supply Ratio</SectionTitle>
                    <div style={{ fontSize: 10, color: '#4b5563', marginBottom: 6 }}>Higher = underserved market. Lower = increasing competition.</div>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={ts.childrenPerCenter} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                        <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{ background: '#111', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                          formatter={v => [`${v}x`, 'Children / Center']}
                          labelStyle={{ color: '#9ca3af' }}
                        />
                        <Line type="monotone" dataKey="ratio" stroke={trendColor} strokeWidth={2} dot={{ r: 3, fill: trendColor }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )
              })()}

            </div>
          )}

          {/* Data note */}
          <div style={{ fontSize: 10, color: '#4b5563', textAlign: 'right', marginTop: 4 }}>
            ACS 2023 5-Year Estimates · US Census Bureau · County Business Patterns 2022
          </div>
        </>
      )}
    </div>
  )
}

function DemographicsTab({ acronym }) {
  const [data,          setData]          = useState(null)
  const [incomeData,    setIncomeData]    = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [incomeLoading, setIncomeLoading] = useState(true)
  const [error,         setError]         = useState(null)

  useEffect(() => {
    if (!acronym) return
    setLoading(true)
    setIncomeLoading(true)

    // Fetch demographics + income heatmap in parallel
    Promise.all([
      fetch(`/api/clients/${acronym}/demographics`).then(r => r.json()),
      fetch(`/api/clients/${acronym}/income-heatmap`).then(r => r.json()).catch(() => null),
    ]).then(([demData, incData]) => {
      setData(demData)
      setIncomeData(incData)
      setLoading(false)
      setIncomeLoading(false)
    }).catch(e => {
      setError(e.message)
      setLoading(false)
      setIncomeLoading(false)
    })
  }, [acronym])

  // Build a map of locationName -> heatmap for easy lookup
  const incomeByLocation = useMemo(() => {
    const map = {}
    for (const loc of (incomeData?.locations || [])) {
      if (loc.locationName) map[loc.locationName] = loc
    }
    return map
  }, [incomeData])

  if (loading) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
        <div style={{ marginBottom: 8, fontSize: 20 }}>📊</div>
        Loading market intelligence… (may take a moment on first load)
        <div style={{ fontSize: 11, color: '#4b5563', marginTop: 6 }}>Income heatmap may take 60–90s on first run</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '20px 0', color: '#ef4444', fontSize: 13 }}>
        Error loading demographics data: {error}
      </div>
    )
  }

  const locations = data?.locations || []

  if (locations.length === 0) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
        <div style={{ marginBottom: 8, fontSize: 20 }}>📊</div>
        No GBP locations found for this client.
      </div>
    )
  }

  return (
    <div style={{ paddingTop: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 4 }}>📊 Market Intelligence</div>
        <div style={{ fontSize: 12, color: '#6b7280' }}>
          US Census demographic &amp; competitive data by location · {locations.length} location{locations.length !== 1 ? 's' : ''}
          {data?.updatedAt && (
            <span style={{ marginLeft: 8 }}>· Last synced {new Date(data.updatedAt).toLocaleDateString()}</span>
          )}
          {incomeLoading && (
            <span style={{ marginLeft: 8, color: '#6366f1' }}>· Loading income heatmap…</span>
          )}
        </div>
      </div>
      {locations.map(loc => (
        <DemographicsLocationBlock
          key={loc.locationName}
          loc={loc}
          incomeHeatmap={incomeByLocation[loc.locationName] || null}
        />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Competitive Intelligence Tab
// ─────────────────────────────────────────────────────────────────────────

function CompetitiveIntelTab({ acronym }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [expandedLocs, setExpandedLocs] = useState({})

  function load(force = false) {
    if (force) setRefreshing(true)
    else setLoading(true)
    const method = force ? 'POST' : 'GET'
    fetch(`/api/clients/${acronym}/competitive-intel`, { method })
      .then(r => r.json())
      .then(d => {
        setData(d)
        setLoading(false)
        setRefreshing(false)
        // Auto-expand all locations
        if (d.locations) {
          const expanded = {}
          d.locations.forEach(l => { expanded[l.locationId] = true })
          setExpandedLocs(expanded)
        }
      })
      .catch(e => { setError(e.message); setLoading(false); setRefreshing(false) })
  }

  useEffect(() => { if (acronym) load() }, [acronym])

  if (loading) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
        <div style={{ marginBottom: 8, fontSize: 20 }}>🔍</div>
        Scanning nearby competitors…
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '20px 0', color: '#ef4444', fontSize: 13 }}>
        Error: {error}
      </div>
    )
  }

  const locations = data?.locations || []

  // Market-wide summary
  const allCompetitors = locations.flatMap(l => l.competitors || [])
  const uniqueIds = new Set(allCompetitors.map(c => c.placeId))
  const ratedCompetitors = allCompetitors.filter(c => c.rating)
  const avgCompetitorRating = ratedCompetitors.length
    ? (ratedCompetitors.reduce((s, c) => s + c.rating, 0) / ratedCompetitors.length).toFixed(1)
    : null
  const totalAreaReviews = allCompetitors.reduce((s, c) => s + (c.reviewCount || 0), 0)
  const latestScan = locations.reduce((latest, l) => {
    if (!l.scannedAt) return latest
    return !latest || new Date(l.scannedAt) > new Date(latest) ? l.scannedAt : latest
  }, null)

  function fmtScanTime(ts) {
    if (!ts) return '—'
    const d = new Date(ts)
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  function photoColor(count) {
    if (count >= 50) return '#10b981' // green
    if (count >= 20) return '#f59e0b' // yellow
    return '#ef4444' // red
  }

  function statusStyle(status, isOpen) {
    if (status === 'CLOSED_PERMANENTLY') return { bg: '#450a0a', color: '#fca5a5', label: 'PERM. CLOSED' }
    if (status === 'CLOSED_TEMPORARILY') return { bg: '#422006', color: '#fed7aa', label: 'TEMP. CLOSED' }
    if (isOpen) return { bg: '#052e16', color: '#86efac', label: 'OPEN' }
    return { bg: '#1c1917', color: '#a8a29e', label: 'CLOSED' }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SectionTitle>Competitive Intelligence</SectionTitle>
            <InfoTip text="Childcare centers within 5 miles of each location, sourced from Google Places. Results are cached for 24 hours. Click Refresh Scan to force a fresh pull." />
          </div>
          {latestScan && (
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: -8 }}>Last scanned: {fmtScanTime(latestScan)}</div>
          )}
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          style={{
            padding: '6px 14px',
            borderRadius: 8,
            border: '1px solid rgba(139,92,246,0.3)',
            background: refreshing ? 'rgba(139,92,246,0.05)' : 'rgba(139,92,246,0.15)',
            color: refreshing ? '#6b7280' : '#c4b5fd',
            fontSize: 13,
            cursor: refreshing ? 'not-allowed' : 'pointer',
          }}
        >
          {refreshing ? '⏳ Scanning…' : '🔄 Refresh Scan'}
        </button>
      </div>

      {/* Market Summary */}
      {locations.length > 1 && (
        <div>
          <SectionTitle>Service Area Overview</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <Card>
              <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Unique Competitors</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginTop: 4 }}>{uniqueIds.size}</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>across {locations.length} locations</div>
            </Card>
            <Card>
              <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg Competitor Rating</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: avgCompetitorRating >= 4.5 ? '#f59e0b' : '#fff', marginTop: 4 }}>
                {avgCompetitorRating ? `${avgCompetitorRating} ★` : '—'}
              </div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>area average</div>
            </Card>
            <Card>
              <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Area Reviews</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginTop: 4 }}>{totalAreaReviews.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>all competitors combined</div>
            </Card>
          </div>
        </div>
      )}

      {/* Per-location sections */}
      {locations.length === 0 && (
        <PlaceholderBanner icon="🔍" message="No GBP locations found for this client. Add locations in the GBP tab first." />
      )}

      {locations.map(loc => {
        const isExpanded = expandedLocs[loc.locationId] !== false
        const competitors = loc.competitors || []
        const topCompetitors = competitors.slice(0, 10)
        const ratedHere = competitors.filter(c => c.rating)
        const avgRatingHere = ratedHere.length
          ? (ratedHere.reduce((s, c) => s + c.rating, 0) / ratedHere.length).toFixed(1)
          : null
        const totalReviewsHere = competitors.reduce((s, c) => s + (c.reviewCount || 0), 0)

        return (
          <div key={loc.locationId} style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden' }}>
            {/* Location header */}
            <div
              onClick={() => setExpandedLocs(prev => ({ ...prev, [loc.locationId]: !isExpanded }))}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 18px', cursor: 'pointer',
                background: 'rgba(26,10,46,0.5)',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, color: '#e5e7eb', fontSize: 14 }}>📍 {loc.locationName}</div>
                {loc.address && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{loc.address}</div>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, color: '#9ca3af' }}>{competitors.length} competitors found</span>
                {avgRatingHere && (
                  <span style={{
                    fontSize: 12, padding: '2px 8px', borderRadius: 6,
                    background: 'rgba(245,158,11,0.1)', color: '#fcd34d', border: '1px solid rgba(245,158,11,0.2)'
                  }}>avg ★{avgRatingHere}</span>
                )}
                <span style={{ color: '#6b7280', fontSize: 16 }}>{isExpanded ? '▲' : '▼'}</span>
              </div>
            </div>

            {/* Competitor Map */}
            {isExpanded && competitors.length > 0 && (
              <div style={{ padding: '12px 16px 0 16px' }}>
                <CompetitorMap
                  clientLocation={{ name: loc.locationName, address: loc.address, lat: loc.lat, lng: loc.lng }}
                  competitors={competitors}
                  radiusMiles={5}
                  height="360px"
                />
              </div>
            )}

            {/* Location summary bar */}
            {isExpanded && competitors.length > 0 && (
              <div style={{
                display: 'flex', gap: 20, padding: '10px 18px',
                background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.04)',
                fontSize: 12, color: '#9ca3af', flexWrap: 'wrap'
              }}>
                <span>🏆 Area avg rating: <strong style={{ color: '#fcd34d' }}>{avgRatingHere || '—'} ★</strong></span>
                <span>💬 Total reviews in area: <strong style={{ color: '#e5e7eb' }}>{totalReviewsHere.toLocaleString()}</strong></span>
                {loc.error && <span style={{ color: '#f87171' }}>⚠️ {loc.error}</span>}
              </div>
            )}

            {/* Competitor cards */}
            {isExpanded && (
              <div style={{ padding: 16 }}>
                {competitors.length === 0 ? (
                  <div style={{ color: '#6b7280', fontSize: 13, padding: '8px 0' }}>No competitors found within 5 miles.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
                    {topCompetitors.map(comp => {
                      const ss = statusStyle(comp.businessStatus, comp.isOpen)
                      const rankColor = comp.rank === 1 ? '#ef4444' : comp.rank <= 3 ? '#f97316' : comp.rank <= 5 ? '#f59e0b' : '#6b7280'
                      return (
                        <div key={comp.placeId} style={{
                          background: 'rgba(0,0,0,0.35)',
                          border: `1px solid ${comp.rank <= 3 ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.07)'}`,
                          borderRadius: 12, padding: '12px 14px',
                        }}>
                          {/* Name + distance + status */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6, marginBottom: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                              <span style={{ fontSize: 11, fontWeight: 800, color: rankColor, background: 'rgba(0,0,0,0.4)', borderRadius: 6, padding: '2px 6px', whiteSpace: 'nowrap', flexShrink: 0, marginTop: 1 }}>#{comp.rank}</span>
                              <div style={{ fontWeight: 600, color: '#f3f4f6', fontSize: 13, lineHeight: '1.3' }}>{comp.name}</div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                              {comp.distanceMiles != null && (
                                <span style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap' }}>📍 {comp.distanceMiles} mi</span>
                              )}
                              <span style={{
                                fontSize: 10, padding: '1px 6px', borderRadius: 4,
                                background: ss.bg, color: ss.color, fontWeight: 600,
                              }}>{ss.label}</span>
                            </div>
                          </div>

                          {/* Rating */}
                          {comp.rating ? (
                            <div style={{ fontSize: 12, color: '#fcd34d', marginBottom: 4 }}>
                              ⭐ {comp.rating} <span style={{ color: '#9ca3af' }}>({comp.reviewCount?.toLocaleString()} reviews)</span>
                            </div>
                          ) : (
                            <div style={{ fontSize: 12, color: '#4b5563', marginBottom: 4 }}>⭐ No rating</div>
                          )}

                          {/* Type + address */}
                          {comp.primaryType && (
                            <div style={{ fontSize: 11, color: '#8b5cf6', marginBottom: 3 }}>📁 {comp.primaryType}</div>
                          )}
                          {comp.address && (
                            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 5 }}>{comp.address}</div>
                          )}

                          {/* Hours */}
                          {comp.hours && (
                            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 5 }}>
                              🕐 {Object.entries(comp.hours).slice(0, 2).map(([d, h]) => `${d}: ${h}`).join(' · ')}
                              {Object.keys(comp.hours).length > 2 ? ` +${Object.keys(comp.hours).length - 2} more` : ''}
                            </div>
                          )}

                          {/* Photos */}
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, marginBottom: 5 }}>
                            <span style={{ color: photoColor(comp.photoCount) }}>📸 {comp.photoCount} photos</span>
                          </div>

                          {/* Links */}
                          <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                            {comp.phone && (
                              <a href={`tel:${comp.phone}`} style={{ fontSize: 11, color: '#60a5fa', textDecoration: 'none' }}>📞 {comp.phone}</a>
                            )}
                            {comp.website && (
                              <a href={comp.website} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#34d399', textDecoration: 'none' }}>🌐 Website ↗</a>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                {competitors.length > 10 && (
                  <div style={{ marginTop: 10, fontSize: 12, color: '#6b7280', textAlign: 'center' }}>
                    + {competitors.length - 10} more competitors (showing top 10 by distance)
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// SEO Tab
// ─────────────────────────────────────────────────────────────────────────

function SEOTab({ profile, acronym }) {
  const [seoData, setSeoData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!acronym) return
    setLoading(true)
    fetch(`/api/clients/${acronym}/seo`)
      .then(r => r.json())
      .then(data => { setSeoData(data); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [acronym])

  if (loading) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
        <div style={{ marginBottom: 8, fontSize: 20 }}>📈</div>
        Loading SEO data…
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '20px 0', color: '#ef4444', fontSize: 13 }}>
        Error loading SEO data: {error}
      </div>
    )
  }

  const hasData = seoData?.snapshots?.length > 0
  const locations = seoData?.locations || []
  const isMultiLoc = locations.length > 1 || (locations.length === 1 && locations[0] !== '')

  const seoLocNames = new Set(locations)
  const gbpLocations = seoData?.gbpLocations || []
  const gbpOnlyLocations = gbpLocations.filter(g => {
    const name = g.locationName || ''
    const seoName = g.seoLocationName
    // If seoLocationName is explicitly set (even empty string), it's already on the SEO program path
    if (seoName !== null && seoName !== undefined) return false
    // If it matches an SEO snapshot location name, skip it
    if ([...seoLocNames].some(sl => sl && name.toLowerCase().includes(sl.toLowerCase()))) return false
    return true
  })

  return (
    <div className="space-y-6">
      {/* Service Details */}
      <div>
        <SectionTitle>SEO Service Details</SectionTitle>
        <Card>
          <div className="space-y-2.5">
            <InfoRow label="Service level" value={
              profile.serviceList?.find(s => s.toLowerCase().includes('seo')) ||
              (profile.hasSEO ? 'SEO Active' : null)
            } />
            <InfoRow label="Start date"  value={profile.startDate ? fmtDate(profile.startDate) : null} />
            <InfoRow label="Assigned GA" value={profile.assignedGA} />
          </div>
        </Card>
      </div>

      {/* Rankings */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <SectionTitle>Rankings & Performance</SectionTitle>
          <InfoTip text="How visible this location is in Google local search results. Each location can be expanded or collapsed. Data sources: Local Falcon (SOLV/ARP grid scans), GBP (Google Business Profile performance), and DataForSEO (organic domain metrics)." />
        </div>
        {locations.length === 0 && gbpOnlyLocations.length === 0 ? (
          <PlaceholderBanner icon="📈" message="No ranking data synced yet. Data populates automatically from the SEO report sheets." />
        ) : (
          <div style={{ background: 'rgba(26,10,46,0.5)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: '20px 24px' }}>
            {/* SEO program locations */}
            {locations.map(loc => (
              <SEOLocationBlock
                key={`seo-${loc}`}
                acronym={acronym}
                loc={loc}
                snapshots={seoData.snapshots.filter(s => s.locationName === loc)}
                gbpRows={(seoData.gbpByLocation?.[loc]) || []}
                isMultiLoc={isMultiLoc}
                isOnProgram={!!profile.hasSEO}
                heatmaps={(seoData.heatmaps || []).filter(h => h.locationName === loc)}
                gbpInfo={(seoData.gbpLocations || []).find(g =>
                  g.locationName?.toLowerCase().includes(loc.toLowerCase()) ||
                  loc.toLowerCase().split(' ').some(word => word.length > 3 && g.locationName?.toLowerCase().includes(word))
                ) || null}
              />
            ))}
            {/* GBP-only locations (heatmapEnabled=true but not on SEO program) */}
            {gbpOnlyLocations.map(g => (
              <SEOLocationBlock
                key={`gbp-${g.id}`}
                acronym={acronym}
                loc={g.locationName || 'Location'}
                snapshots={[]}
                gbpRows={(seoData.gbpByLocation?.[g.locationName]) || []}
                isMultiLoc={gbpOnlyLocations.length > 1}
                isOnProgram={false}
                heatmaps={(seoData.heatmaps || []).filter(h => h.locationName === g.locationName)}
                gbpInfo={g}
              />
            ))}
          </div>
        )}
      </div>


      {/* DataForSEO — Organic Domain Health */}
      {seoData?.dfseoHistory?.length > 0 && (
        <DFSEOSection history={seoData.dfseoHistory} latest={seoData.dfseoLatest} prev={seoData.dfseoPrev} keywords={seoData.dfseoKeywords} />
      )}

      {/* Resources */}
      {profile.clientFolderUrl && (
        <div>
          <SectionTitle>Resources</SectionTitle>
          <Card>
            <InfoRow label="Client folder" value="Open folder ↗" href={profile.clientFolderUrl} />
          </Card>
        </div>
      )}
    </div>
  )
}

// ── SEO Heatmap Section ──────────────────────────────────────────────

const HEATMAP_COLORS = [
  { max: 1,  bg: '#14532d', text: '#86efac', label: '#1' },
  { max: 3,  bg: '#166534', text: '#4ade80', label: 'Top 3' },
  { max: 7,  bg: '#365314', text: '#a3e635', label: 'Top 7' },
  { max: 10, bg: '#713f12', text: '#fde047', label: 'Top 10' },
  { max: 15, bg: '#7c2d12', text: '#fb923c', label: 'Top 15' },
  { max: 20, bg: '#7f1d1d', text: '#fca5a5', label: 'Top 20' },
]

function heatColor(rank) {
  if (rank == null) return { bg: '#7f1d1d', text: '#fca5a5' }  // 20+ = dark red, same as top-20 tier
  for (const tier of HEATMAP_COLORS) {
    if (rank <= tier.max) return tier
  }
  return { bg: '#1f2937', text: '#6b7280' }
}

function HeatmapGrid({ points, gridSize = 5 }) {
  const half = Math.floor(gridSize / 2)
  const rows = []
  for (let r = -half; r <= half; r++) {
    const cells = []
    for (let c = -half; c <= half; c++) {
      const pt    = points.find(p => p.row === r && p.col === c)
      const rank  = pt?.rank ?? null
      const color = heatColor(rank)
      const isCenter = r === 0 && c === 0
      cells.push(
        <div
          key={c}
          title={rank != null ? `Rank #${rank}` : 'Not in top 20 — ranked 20+'}
          style={{
            width: 44, height: 44,
            background: color.bg,
            border: isCenter ? '2px solid #c4b5fd' : '1px solid rgba(255,255,255,0.06)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column',
            cursor: 'default',
            transition: 'transform 0.1s',
            position: 'relative',
          }}
        >
          <span style={{ fontSize: rank != null ? 13 : 11, fontWeight: 800, color: color.text, lineHeight: 1 }}>
            {rank != null ? rank : '20+'}
          </span>
          {isCenter && (
            <span style={{ fontSize: 8, color: '#c4b5fd', marginTop: 2, fontWeight: 600 }}>HERE</span>
          )}
        </div>
      )
    }
    rows.push(
      <div key={r} style={{ display: 'flex', gap: 4 }}>{cells}</div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
        {rows}
      </div>
      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, justifyContent: 'center' }}>
        {HEATMAP_COLORS.map(t => (
          <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: t.bg, border: '1px solid rgba(255,255,255,0.1)' }} />
            <span style={{ fontSize: 10, color: '#9ca3af' }}>{t.label}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: '#7f1d1d', border: '1px solid rgba(255,255,255,0.1)' }} />
          <span style={{ fontSize: 10, color: '#9ca3af' }}>20+</span>
        </div>
      </div>
    </div>
  )
}

// ── Income Heatmap helpers ────────────────────────────────────────────────

const INCOME_COLORS = [
  { min: 0,      max: 40000,   bg: '#7f1d1d', text: '#fca5a5', label: '<$40K' },
  { min: 40000,  max: 60000,   bg: '#9a3412', text: '#fdba74', label: '$40-60K' },
  { min: 60000,  max: 80000,   bg: '#92400e', text: '#fcd34d', label: '$60-80K' },
  { min: 80000,  max: 100000,  bg: '#3f6212', text: '#bef264', label: '$80-100K' },
  { min: 100000, max: 130000,  bg: '#166534', text: '#86efac', label: '$100-130K' },
  { min: 130000, max: Infinity, bg: '#14532d', text: '#4ade80', label: '$130K+' },
]

function incomeColor(income) {
  if (income == null || income <= 0) return { bg: '#1f2937', text: '#6b7280' }
  const tier = INCOME_COLORS.find(t => income >= t.min && income < t.max) || INCOME_COLORS[INCOME_COLORS.length - 1]
  return { bg: tier.bg, text: tier.text }
}

function IncomeHeatmapGrid({ points, gridSize = 7 }) {
  const half = Math.floor(gridSize / 2)
  const rows = []
  for (let r = -half; r <= half; r++) {
    const cells = []
    for (let c = -half; c <= half; c++) {
      const pt       = points.find(p => p.row === r && p.col === c)
      const income   = pt?.medianIncome ?? null
      const color    = incomeColor(income)
      const isCenter = r === 0 && c === 0
      const label    = income != null ? `$${Math.round(income / 1000)}K` : '—'
      cells.push(
        <div
          key={c}
          title={income != null ? `Median income: $${income.toLocaleString()}` : 'No data'}
          style={{
            width: 44, height: 44,
            background: color.bg,
            border: isCenter ? '2px solid #c4b5fd' : '1px solid rgba(255,255,255,0.06)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', cursor: 'default',
          }}
        >
          <span style={{ fontSize: 10, fontWeight: 700, color: color.text }}>{label}</span>
          {isCenter && <span style={{ fontSize: 7, color: '#c4b5fd', marginTop: 1 }}>HERE</span>}
        </div>
      )
    }
    rows.push(<div key={r} style={{ display: 'flex', gap: 4 }}>{cells}</div>)
  }
  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>{rows}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, justifyContent: 'center' }}>
        {INCOME_COLORS.map(t => (
          <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: t.bg, border: '1px solid rgba(255,255,255,0.1)' }} />
            <span style={{ fontSize: 10, color: '#9ca3af' }}>{t.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SEOHeatmapSection({ heatmaps }) {
  const [activeKw,     setActiveKw]     = useState('daycare')
  const [activeRadius, setActiveRadius] = useState(3)

  // Group by locationName → radiusMiles → keyword
  const byLocation = useMemo(() => {
    const map = {}
    for (const hm of heatmaps) {
      const loc = hm.locationName || ''
      const r   = Number(hm.radiusMiles) || 3
      if (!map[loc]) map[loc] = {}
      if (!map[loc][r]) map[loc][r] = {}
      map[loc][r][hm.keyword] = hm
    }
    return map
  }, [heatmaps])

  const locations     = Object.keys(byLocation).sort()
  const radiiAvail    = [...new Set(heatmaps.map(h => Number(h.radiusMiles) || 3))].sort((a, b) => a - b)
  const keywords      = [...new Set(heatmaps.map(h => h.keyword))].sort()

  if (locations.length === 0) return null

  const toggleStyle = (active) => ({
    padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
    border: active ? '1px solid #a78bfa' : '1px solid rgba(255,255,255,0.1)',
    background: active ? 'rgba(167,139,250,0.15)' : 'rgba(0,0,0,0.3)',
    color: active ? '#c4b5fd' : '#9ca3af',
    textTransform: 'capitalize',
  })

  return (
    <div>
      <SectionTitle>Local Rank Heatmap</SectionTitle>

      {/* Controls row */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Radius selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Radius</span>
          {radiiAvail.length > 0
            ? radiiAvail.map(r => (
                <button key={r} onClick={() => setActiveRadius(r)} style={toggleStyle(activeRadius === r)}>
                  {r} mi
                </button>
              ))
            : [3, 5].map(r => (
                <button key={r} onClick={() => setActiveRadius(r)} style={toggleStyle(activeRadius === r)}>
                  {r} mi
                </button>
              ))
          }
        </div>

        {/* Keyword toggle */}
        {keywords.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Keyword</span>
            {keywords.map(kw => (
              <button key={kw} onClick={() => setActiveKw(kw)} style={toggleStyle(activeKw === kw)}>{kw}</button>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {locations.map(loc => {
          const hm = byLocation[loc]?.[activeRadius]?.[activeKw]
          const pts = hm?.points || []
          const ranked  = pts.filter(p => p.rank != null).length
          const avgRank = ranked > 0
            ? (pts.filter(p => p.rank != null).reduce((s, p) => s + p.rank, 0) / ranked).toFixed(1)
            : null
          const scanDate = hm?.scanDate ? new Date(hm.scanDate).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : null

          return (
            <div key={loc} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '16px 20px' }}>
              {loc && (
                <div style={{ fontSize: 13, fontWeight: 700, color: '#c4b5fd', marginBottom: 4 }}>{loc}</div>
              )}
              {!hm ? (
                <div style={{ color: '#6b7280', fontSize: 12, padding: '20px 0', textAlign: 'center' }}>
                  No {activeRadius}-mile scan available yet
                </div>
              ) : (
                <>
                  {/* Stats row — includes coverage info */}
                  <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 11, color: '#9ca3af', flexWrap: 'wrap', alignItems: 'center' }}>
                    {avgRank && <span>Avg rank: <strong style={{ color: '#e5e7eb' }}>{avgRank}</strong></span>}
                    <span>Ranked: <strong style={{ color: '#e5e7eb' }}>{ranked}/{pts.length}</strong></span>
                    {scanDate && <span>Scanned: <strong style={{ color: '#e5e7eb' }}>{scanDate}</strong></span>}
                    <span style={{ color: '#6b7280' }}>{activeRadius}mi radius · covers {activeRadius * 2}mi × {activeRadius * 2}mi</span>
                  </div>
                  {/* Map (left, no text below it) + Grid/legend (right) — map bottom aligns with grid bottom */}
                  <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <iframe
                      title={`${loc || 'Location'} map`}
                      src={`https://maps.google.com/maps?q=${hm.centerLat},${hm.centerLng}&z=${activeRadius >= 5 ? 12 : 13}&output=embed`}
                      style={{ width: 236, height: 236, flexShrink: 0, border: 'none', borderRadius: 10, opacity: 0.9 }}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                    <HeatmapGrid points={pts} gridSize={hm.gridSize || 5} />
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── DataForSEO Organic Section ─────────────────────────────────────────────

function DFSEOStatTile({ label, value, sub, delta, deltaLabel, tip }) {
  const deltaColor = delta == null ? null : delta > 0 ? '#22c55e' : delta < 0 ? '#ef4444' : '#9ca3af'
  const deltaSign  = delta > 0 ? '+' : ''
  return (
    <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '14px 18px', minWidth: 120, flex: 1 }}>
      <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 3 }}>{label}{tip && <InfoTip text={tip} />}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: '#f3f4f6', lineHeight: 1.1 }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>{sub}</div>}
      {delta != null && (
        <div style={{ fontSize: 11, color: deltaColor, marginTop: 4 }}>
          {deltaSign}{deltaLabel ?? delta}
        </div>
      )}
    </div>
  )
}

function DFSEOSection({ history, latest, prev, keywords }) {
  const fmtMonth = (row) => {
    if (!row?.snapshotDate) return ''
    const d = new Date(row.snapshotDate)
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }

  const kwDelta = latest && prev ? latest.organicCount - prev.organicCount : null
  const trafDelta = latest && prev ? Math.round(latest.organicEtv - prev.organicEtv) : null

  // Chart: keywords + traffic over time
  const chartData = history.map(row => ({
    month: fmtMonth(row),
    keywords: row.organicCount,
    traffic: Math.round(row.organicEtv || 0),
    top3: (row.pos1 || 0) + (row.pos2_3 || 0),
    top10: (row.pos4_10 || 0),
  }))

  // Position distribution for latest
  const posData = latest ? [
    { label: 'Pos 1',    count: latest.pos1    || 0, color: '#22c55e' },
    { label: 'Pos 2–3',  count: latest.pos2_3  || 0, color: '#84cc16' },
    { label: 'Pos 4–10', count: latest.pos4_10 || 0, color: '#eab308' },
    { label: 'Pos 11–20',count: latest.pos11_20|| 0, color: '#f97316' },
    { label: 'Pos 21+',  count: latest.pos21_100||0, color: '#6b7280' },
  ] : []

  const topKw = (keywords || []).slice(0, 15)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <SectionTitle>Organic Domain Health</SectionTitle>
        <InfoTip text="Overall visibility of this website in Google's regular (non-Maps) search results. Data sourced from DataForSEO and refreshed monthly. This measures how the website itself ranks, separate from the Google Maps local pack rankings above." />
      </div>

      {/* Summary tiles */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        <DFSEOStatTile
          label="Organic Keywords"
          tip="Total number of unique search terms this website currently ranks for anywhere in Google's top 100 results. Higher = broader visibility."
          value={latest?.organicCount?.toLocaleString()}
          sub={latest ? `as of ${fmtMonth(latest)}` : null}
          delta={kwDelta}
          deltaLabel={kwDelta != null ? `${kwDelta > 0 ? '+' : ''}${kwDelta} vs prev month` : null}
        />
        <DFSEOStatTile
          label="Est. Monthly Traffic"
          tip="Estimated monthly visitors from organic Google search, based on current keyword rankings and typical click-through rates for each position. Not exact — a directional measure of organic reach."
          value={latest ? Math.round(latest.organicEtv).toLocaleString() : null}
          sub="from organic search"
          delta={trafDelta}
          deltaLabel={trafDelta != null ? `${trafDelta > 0 ? '+' : ''}${trafDelta} visits` : null}
        />
        <DFSEOStatTile
          label="Est. Traffic Value"
          tip="What it would cost to buy this volume of traffic through Google Ads pay-per-click, based on typical CPC rates for the ranked keywords. A measure of the SEO equity built up over time."
          value={latest ? `$${Math.round(latest.organicValue).toLocaleString()}` : null}
          sub="if paid per click"
        />
        <DFSEOStatTile
          label="Top 3 Positions"
          tip="Keywords where this website ranks #1, #2, or #3 in Google. These positions capture roughly 60% of all clicks for a given search term — the most valuable real estate in organic search."
          value={latest ? ((latest.pos1 || 0) + (latest.pos2_3 || 0)).toString() : null}
          sub="keywords ranked #1–3"
        />
      </div>

      {/* Charts side by side */}
      {chartData.length >= 2 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
          {/* Keywords over time */}
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '16px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 3 }}>Organic Keywords<InfoTip text="Number of unique keywords this website ranks for in Google (any position 1-100), tracked monthly. An increasing trend means the website is growing its search presence." /></div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#1a0a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontSize: 12 }} labelStyle={{ color: '#c4b5fd' }} />
                <Bar dataKey="keywords" name="Keywords" fill="#731494" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Est. traffic over time */}
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '16px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 3 }}>Est. Organic Traffic<InfoTip text="Estimated monthly organic visitors from Google, calculated from keyword rankings × typical click rates for each position. An upward trend means more parents are finding the website through search." /></div>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#1a0a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontSize: 12 }} labelStyle={{ color: '#c4b5fd' }} />
                <Line type="monotone" dataKey="traffic" name="Est. Visits" stroke="#AE2BCF" strokeWidth={2.5} dot={{ fill: '#AE2BCF', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Position distribution + Top Keywords side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 14 }}>
        {/* Position breakdown */}
        {posData.length > 0 && (
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '16px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 3 }}>Position Breakdown<InfoTip text="Distribution of keyword rankings by position range. Pos 1 = #1 in Google (best). More keywords in green zones = stronger organic authority. 21+ = ranking but unlikely to get clicks." /></div>
            {posData.map(p => (
              <div key={p.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: '#d1d5db' }}>{p.label}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: Math.max(4, Math.min(80, p.count)), height: 6, borderRadius: 3, background: p.color, transition: 'width 0.3s' }} />
                  <div style={{ fontSize: 12, fontWeight: 600, color: p.color, minWidth: 28, textAlign: 'right' }}>{p.count}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Top keywords */}
        {topKw.length > 0 && (
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px 10px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'flex', alignItems: 'center', gap: 3 }}>Top Ranking Keywords<InfoTip text="The highest-ranking keywords this website is currently indexed for. Pos = current Google position (1 = top result). Vol/mo = average monthly searches for that keyword. Green = top 3, amber = 4-10, gray = 11+." /></div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <th style={{ padding: '6px 16px', textAlign: 'left', color: '#6b7280', fontWeight: 500 }}>Keyword</th>
                  <th style={{ padding: '6px 12px', textAlign: 'center', color: '#6b7280', fontWeight: 500 }}>Pos</th>
                  <th style={{ padding: '6px 12px', textAlign: 'right', color: '#6b7280', fontWeight: 500 }}>Vol/mo</th>
                </tr>
              </thead>
              <tbody>
                {topKw.map((kw, i) => (
                  <tr key={kw.keyword} style={{ borderBottom: i < topKw.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <td style={{ padding: '7px 16px', color: '#e5e7eb' }}>{kw.keyword}</td>
                    <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block', minWidth: 28, padding: '1px 6px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                        background: kw.position <= 3 ? 'rgba(34,197,94,0.15)' : kw.position <= 10 ? 'rgba(234,179,8,0.15)' : 'rgba(107,114,128,0.15)',
                        color: kw.position <= 3 ? '#22c55e' : kw.position <= 10 ? '#eab308' : '#9ca3af',
                      }}>{kw.position}</span>
                    </td>
                    <td style={{ padding: '7px 12px', textAlign: 'right', color: '#9ca3af' }}>{kw.searchVolume?.toLocaleString() || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tab 5: GBP ────────────────────────────────────────────────────────────────

const GBP_CHECKLIST = [
  { field: 'isClaimed',              label: 'GBP claimed & verified' },
  { field: 'primaryCategoryCorrect', label: 'Primary category correct' },
  { field: 'secondaryCategoriesSet', label: 'Secondary categories set' },
  { field: 'descriptionComplete',    label: 'Description complete (750 chars)' },
  { field: 'websiteLinked',          label: 'Website linked' },
  { field: 'phoneListened',          label: 'Phone number listed' },
  { field: 'hoursComplete',          label: 'Hours complete (all 7 days)' },
  { field: 'has50Reviews',           label: '50+ reviews' },
  { field: 'ratingAbove4',           label: '4.0+ star rating' },
  { field: 'respondedToReviews',     label: 'Responded to last 5 reviews' },
  { field: 'photoRecentMonth',       label: 'Photo posted in last 30 days' },
  { field: 'postRecentWeek',         label: 'Post in last 7 days' },
  { field: 'qaActive',               label: 'Q&A section active' },
  { field: 'servicesListed',         label: 'Services listed' },
  { field: 'serviceAreaConfigured',  label: 'Service area configured' },
]

const CHECKLIST_FIELDS = GBP_CHECKLIST.map(c => c.field)

const AUTO_CHECK_FIELDS = ['isClaimed', 'websiteLinked', 'phoneListened', 'hoursComplete', 'secondaryCategoriesSet', 'has50Reviews', 'ratingAbove4']
const HUMAN_CHECK_FIELDS = ['respondedToReviews', 'photoRecentMonth', 'postRecentWeek', 'qaActive', 'servicesListed', 'serviceAreaConfigured', 'specialHoursUpdated', 'primaryCategoryCorrect', 'descriptionComplete']

const GBP_FIELD_LABELS = {
  isClaimed:              'Profile Claimed',
  websiteLinked:          'Website Linked',
  phoneListened:          'Phone Listed',
  hoursComplete:          'Hours Complete (M–F)',
  secondaryCategoriesSet: 'Secondary Categories Set',
  has50Reviews:           '50+ Reviews',
  ratingAbove4:           'Rating 4.0+',
  respondedToReviews:     'Responded to Reviews',
  photoRecentMonth:       'Photo Added This Month',
  postRecentWeek:         'Post This Week',
  qaActive:               'Q&A Active',
  servicesListed:         'Services Listed',
  serviceAreaConfigured:  'Service Area Set',
  specialHoursUpdated:    'Special Hours Updated',
  primaryCategoryCorrect: 'Primary Category Correct',
  descriptionComplete:    'Description Complete',
}

const GBP_FIELD_DESCRIPTIONS = {
  isClaimed:              'The business owner has verified ownership of this GBP listing with Google.',
  websiteLinked:          'A website URL is connected to this profile so visitors can click through.',
  phoneListened:          'A phone number is published on the profile so customers can call directly.',
  hoursComplete:          'Business hours are set for all weekdays (Mon–Fri). Missing hours hurt search visibility.',
  secondaryCategoriesSet: 'Additional relevant categories are selected beyond the primary (e.g. Preschool + Day care center). More categories = more search surfaces.',
  has50Reviews:           'Profiles with 50+ reviews rank significantly higher in local search. Below 50 is a growth opportunity.',
  ratingAbove4:           'Average star rating is 4.0 or higher. Ratings below 4.0 reduce click-through rates substantially.',
  respondedToReviews:     'The business has replied to recent customer reviews — signals engagement to Google and prospective parents.',
  photoRecentMonth:       'At least one new photo was uploaded in the past 30 days. Regular photo activity improves ranking.',
  postRecentWeek:         'A Google Post was published within the last 7 days. Posts keep the profile active and can surface in search.',
  qaActive:               'The Q&A section has been populated with common questions and answers. Unanswered Q&As look neglected.',
  servicesListed:         'Services offered (e.g. Infant care, After-school) are listed in the profile. Helps match search intent.',
  serviceAreaConfigured:  'Service area radius is configured if the business serves customers at their location.',
  specialHoursUpdated:    'Holiday or closure hours are set and kept current. Inaccurate hours damage trust.',
  primaryCategoryCorrect: 'The primary business category (e.g. Preschool) accurately reflects the main service offered.',
  descriptionComplete:    'The business description is written, published, and uses relevant keywords for the service area.',
}

function computeChecklistDelta(audit, prevAudit) {
  const ALL_FIELDS = [...AUTO_CHECK_FIELDS, ...HUMAN_CHECK_FIELDS]
  let improved = 0, regressed = 0, maintained = 0, pending = 0
  for (const f of ALL_FIELDS) {
    const cur = audit?.[f]
    const prev = prevAudit?.[f]
    if (cur === null || cur === undefined) { pending++; continue }
    if (cur === true && (prev === null || prev === undefined || prev === false)) improved++
    else if (cur === false && prev === true) regressed++
    else maintained++
  }
  return { improved, regressed, maintained, pending }
}

function getFieldDelta(field, lastAudit, prevAudit) {
  const cur = lastAudit?.[field]
  const prev = prevAudit?.[field]
  if (cur === null || cur === undefined) return null
  if (cur === true && (prev === null || prev === undefined || prev === false)) return 'improved'
  if (cur === false && prev === true) return 'regressed'
  return 'unchanged'
}

function calcGbpScore(form) {
  const answered = CHECKLIST_FIELDS.filter(f => form[f] !== null && form[f] !== undefined)
  const passed   = CHECKLIST_FIELDS.filter(f => form[f] === true)
  return answered.length > 0 ? Math.round((passed.length / answered.length) * 100) : 0
}

function GbpScoreBadge({ score }) {
  if (score == null) return <span className="text-gray-500 text-xs">—</span>
  const color = score >= 80 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              : score >= 50 ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${color}`}>
      {score}/100
    </span>
  )
}

function fmtRelativeDate(date) {
  if (!date) return null
  try {
    const diffMs   = Date.now() - new Date(date).getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays === 0)  return 'today'
    if (diffDays === 1)  return 'yesterday'
    if (diffDays < 30)  return `${diffDays} days ago`
    const diffMonths = Math.floor(diffDays / 30)
    if (diffMonths === 1) return '1 month ago'
    if (diffMonths < 12)  return `${diffMonths} months ago`
    const diffYears = Math.floor(diffDays / 365)
    return diffYears === 1 ? '1 year ago' : `${diffYears} years ago`
  } catch { return null }
}

const INPUT_CLS = 'w-full rounded-lg border border-[var(--brand-border)] bg-black/40 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-violet-500/50 focus:outline-none'
const BTN_CLS   = 'rounded-xl border border-violet-500/40 bg-violet-500/15 px-4 py-2 text-sm font-medium text-violet-300 hover:bg-violet-500/25 disabled:opacity-50 transition'
const BTN_SM    = 'rounded-lg border border-[var(--brand-border)] bg-black/30 px-3 py-1.5 text-xs font-medium text-gray-300 hover:border-violet-500/40 hover:text-violet-300 transition'

function calcPhotoScore(photoCount, photoRecentMonth) {
  if (!photoCount || photoCount < 5) return { score: 1, text: 'Very few photos. Add at least 10 to make a strong first impression.' }
  if (photoCount < 10) return { score: 2, text: `${photoCount} photos — getting started. Aim for 25+ and post monthly.` }
  if (photoCount < 25 && !photoRecentMonth) return { score: 2, text: `${photoCount} photos but nothing recent. Fresh photos signal activity to Google.` }
  if (photoCount < 25) return { score: 3, text: `Good start with ${photoCount} photos. Reach 25+ for a stronger score.` }
  if (photoCount < 50 && !photoRecentMonth) return { score: 3, text: `${photoCount} photos is solid, but you haven\'t posted recently. Monthly photos boost ranking.` }
  if (photoCount < 50) return { score: 4, text: `Strong — ${photoCount} photos with recent activity. Push to 50+ for a 5/5.` }
  if (!photoRecentMonth) return { score: 4, text: `Excellent count (${photoCount} photos). Post one new photo this month to hit 5/5.` }
  return { score: 5, text: `Outstanding! ${photoCount} photos with recent updates — listing looks actively maintained.` }
}

// ── GBP Checklist Panel ─────────────────────────────────────────────────────

function GBPChecklistPanel({ loc, autoChecks, prevAudit, acronym, onSaved }) {
  const lastAudit = loc.lastAudit
  const [pending, setPending] = useState({})
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState('')
  const [autoOpen, setAutoOpen] = useState(false)
  const [humanOpen, setHumanOpen] = useState(false)
  const hasPending = Object.keys(pending).length > 0

  // Merge: pending overrides lastAudit
  function getHumanVal(f) {
    if (Object.prototype.hasOwnProperty.call(pending, f)) return pending[f]
    return lastAudit?.[f] ?? null
  }

  function toggleField(f, val) {
    // Cycle: null → true → false → null
    const cur = getHumanVal(f)
    const next = val !== undefined ? val : (cur === null ? true : cur === true ? false : null)
    setPending(prev => ({ ...prev, [f]: next }))
  }

  async function saveHumanFields() {
    setSaving(true)
    try {
      // Build full payload: auto-checks from live data + current human values + pending changes
      const humanValues = {}
      for (const f of HUMAN_CHECK_FIELDS) {
        humanValues[f] = getHumanVal(f)
      }
      const payload = {
        locationId: loc.id,
        triggerType: 'manual',
        reviewCount: lastAudit?.reviewCount ?? null,
        avgRating:   lastAudit?.avgRating   ?? null,
        photoCount:  lastAudit?.photoCount  ?? null,
        // carry forward auto-checks from last audit
        isClaimed:              lastAudit?.isClaimed              ?? autoChecks?.isClaimed              ?? null,
        websiteLinked:          lastAudit?.websiteLinked          ?? autoChecks?.websiteLinked          ?? null,
        phoneListened:          lastAudit?.phoneListened          ?? autoChecks?.phoneListened          ?? null,
        hoursComplete:          lastAudit?.hoursComplete          ?? autoChecks?.hoursComplete          ?? null,
        secondaryCategoriesSet: lastAudit?.secondaryCategoriesSet ?? autoChecks?.secondaryCategoriesSet ?? null,
        has50Reviews:           lastAudit?.has50Reviews           ?? autoChecks?.has50Reviews           ?? null,
        ratingAbove4:           lastAudit?.ratingAbove4           ?? autoChecks?.ratingAbove4           ?? null,
        ...humanValues,
      }
      const res = await fetch(`/api/clients/${acronym}/gbp/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Save failed') }
      setPending({})
      setFlash('Saved!')
      setTimeout(() => setFlash(''), 3000)
      onSaved?.()
    } catch (e) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  // Stagnation: 3+ audits with any human field always null
  const stagnantFields = []
  if (loc.auditHistory && loc.auditHistory.length >= 3) {
    for (const f of HUMAN_CHECK_FIELDS) {
      if (loc.auditHistory.every(a => a[f] === null || a[f] === undefined)) {
        stagnantFields.push(f)
      }
    }
  }
  const lastAuditDate = lastAudit ? (lastAudit.auditDate || lastAudit.createdAt) : null

  function AutoStatusBadge({ val }) {
    if (val === true)  return <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300">Yes</span>
    if (val === false) return <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/15 px-2 py-0.5 text-[11px] font-medium text-rose-300">No</span>
    return <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-gray-500">—</span>
  }

  function FieldDelta({ f }) {
    const delta = prevAudit ? getFieldDelta(f, lastAudit, prevAudit) : null
    if (delta === 'improved')  return <span className="text-emerald-400 text-[10px] ml-1">▲</span>
    if (delta === 'regressed') return <span className="text-rose-400 text-[10px] ml-1">▼</span>
    if (delta === 'unchanged') return <span className="text-gray-600 text-[10px] ml-1">→</span>
    return null
  }

  return (
    <div className="px-4 py-3 border-b border-[var(--brand-border)] space-y-4">

      {/* ── Auto-Verified ── */}
      <div>
        {/* Collapsible header */}
        <button
          type="button"
          onClick={() => setAutoOpen(v => !v)}
          className="flex items-center gap-2 w-full text-left mb-2 group"
        >
          <span className={`text-[10px] transition-transform ${autoOpen ? 'rotate-90' : ''} text-gray-500`}>›</span>
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide group-hover:text-gray-300 transition">Auto-Verified</span>
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] text-emerald-400">live</span>
          {/* Summary when collapsed */}
          {!autoOpen && autoChecks && (
            <span className="ml-auto text-[10px] text-gray-500">
              {Object.values(autoChecks).filter(v => v === true).length}/{AUTO_CHECK_FIELDS.length} passing
            </span>
          )}
        </button>
        {autoOpen && (
          <div className="grid grid-cols-1 gap-1.5">
            {AUTO_CHECK_FIELDS.map(f => (
              <div key={f} className="rounded-lg border border-white/[0.07] bg-black/20 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-gray-200">{GBP_FIELD_LABELS[f]}</span>
                  <AutoStatusBadge val={autoChecks?.[f] ?? null} />
                </div>
                <p className="mt-0.5 text-[11px] text-gray-500 leading-snug">{GBP_FIELD_DESCRIPTIONS[f]}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Needs Human Review ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={() => setHumanOpen(v => !v)}
            className="flex items-center gap-2 group"
          >
            <span className={`text-[10px] transition-transform ${humanOpen ? 'rotate-90' : ''} text-gray-500`}>›</span>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide group-hover:text-gray-300 transition">Needs Human Review</span>
            {/* Summary when collapsed */}
            {!humanOpen && (
              <span className="text-[10px] text-gray-500">
                {HUMAN_CHECK_FIELDS.filter(f => getHumanVal(f) === true).length}/{HUMAN_CHECK_FIELDS.length} reviewed
              </span>
            )}
          </button>
          {hasPending && (
            <button
              onClick={saveHumanFields}
              disabled={saving}
              className="rounded-full border border-violet-500/40 bg-violet-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-violet-300 hover:bg-violet-500/25 transition disabled:opacity-50"
            >
              {saving ? 'Saving…' : flash ? flash : 'Save changes'}
            </button>
          )}
          {!hasPending && flash && <span className="text-[10px] text-emerald-400">{flash}</span>}
        </div>
        {humanOpen && (
        <div className="grid grid-cols-1 gap-1.5">
          {HUMAN_CHECK_FIELDS.map(f => {
            const val = getHumanVal(f)
            const isPending = Object.prototype.hasOwnProperty.call(pending, f)
            return (
              <div key={f} className={`rounded-lg border px-3 py-2 transition ${
                isPending ? 'border-violet-500/40 bg-violet-500/5' : 'border-white/[0.07] bg-black/20'
              }`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="text-xs font-medium text-gray-200 truncate">{GBP_FIELD_LABELS[f]}</span>
                    <FieldDelta f={f} />
                  </div>
                  {/* Yes / No / — toggle */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggleField(f, true)}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium border transition ${
                        val === true
                          ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-300'
                          : 'border-white/10 bg-white/5 text-gray-500 hover:border-emerald-500/40 hover:text-emerald-400'
                      }`}
                    >Yes</button>
                    <button
                      onClick={() => toggleField(f, false)}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium border transition ${
                        val === false
                          ? 'border-rose-500/60 bg-rose-500/20 text-rose-300'
                          : 'border-white/10 bg-white/5 text-gray-500 hover:border-rose-500/40 hover:text-rose-400'
                      }`}
                    >No</button>
                    <button
                      onClick={() => toggleField(f, null)}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium border transition ${
                        val === null
                          ? 'border-amber-500/50 bg-amber-500/15 text-amber-300'
                          : 'border-white/10 bg-white/5 text-gray-500 hover:border-amber-500/30 hover:text-amber-400'
                      }`}
                    >?</button>
                  </div>
                </div>
                <p className="mt-0.5 text-[11px] text-gray-500 leading-snug">{GBP_FIELD_DESCRIPTIONS[f]}</p>
              </div>
            )
          })}
        </div>
        )}
      </div>

      {/* Stagnation warning */}
      {stagnantFields.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
          <div className="text-xs font-semibold text-amber-300 mb-1">
            ⚠️ {stagnantFields.length} field{stagnantFields.length !== 1 ? 's' : ''} have never been filled in across {loc.auditHistory.length} audits.
            {lastAuditDate && <span className="text-amber-400/70 ml-1.5 font-normal">Last audit: {fmtDate(lastAuditDate)}</span>}
          </div>
          <div className="text-xs text-amber-200/70">
            {stagnantFields.map(f => GBP_FIELD_LABELS[f]).join(' · ')}
          </div>
        </div>
      )}
    </div>
  )
}

function HealthArcGauge({ score, passed, total }) {
  const pct = Math.min(Math.max(score / 100, 0), 1)
  const r = 36, cx = 50, cy = 52
  const toAngle = a => ({ x: cx + r * Math.cos((a - 90) * Math.PI / 180), y: cy + r * Math.sin((a - 90) * Math.PI / 180) })
  const startDeg = 210, totalDeg = 240
  const start = toAngle(startDeg)
  const end = toAngle(startDeg + totalDeg)
  const activeDeg = startDeg + totalDeg * pct
  const activeEnd = toAngle(activeDeg)
  const largeArc = (activeDeg - startDeg) > 180 ? 1 : 0
  const trackD = `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 1 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`
  const activeD = pct > 0 ? `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${activeEnd.x.toFixed(2)} ${activeEnd.y.toFixed(2)}` : ''
  const color = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#f43f5e'
  const glow = score >= 80 ? 'drop-shadow(0 0 5px rgba(16,185,129,0.55))' : score >= 50 ? 'drop-shadow(0 0 5px rgba(245,158,11,0.55))' : 'drop-shadow(0 0 5px rgba(244,63,94,0.55))'
  return (
    <div className="flex items-center gap-3">
      <svg width={96} height={70} viewBox="0 0 100 70" style={{ overflow: 'visible', flexShrink: 0 }}>
        <path d={trackD} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5" strokeLinecap="round" />
        {activeD && <path d={activeD} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" style={{ filter: glow, transition: 'all 0.4s ease' }} />}
        <text x={cx} y={cy - 2} textAnchor="middle" fill="white" fontSize="19" fontWeight="700" fontFamily="system-ui,sans-serif">{score}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="rgba(156,163,175,0.8)" fontSize="8" fontFamily="system-ui,sans-serif" letterSpacing="0.14em">HEALTH</text>
      </svg>
      <div className="text-xs">
        <div className="text-white font-semibold text-sm">{passed}/{total}</div>
        <div className="text-gray-500">checks passing</div>
      </div>
    </div>
  )
}

function GBPTab({ profile, acronym, user }) {
  const isAdmin = ['admin', 'superadmin'].includes(user?.role)

  // GBP-specific state
  const [gbpData,              setGbpData]              = useState(null)
  const [gbpLoading,           setGbpLoading]           = useState(true)
  const [gbpErr,               setGbpErr]               = useState('')
  const [showAddLocation,      setShowAddLocation]      = useState(false)
  const [activeAuditLocationId,setActiveAuditLocationId]= useState(null)
  const [expandedHistory,      setExpandedHistory]      = useState(null)
  const [saving,               setSaving]               = useState(false)
  const [autoAuditing,         setAutoAuditing]         = useState(new Set())
  const [autoAuditFlash,       setAutoAuditFlash]       = useState(new Set())

  // Inline editing state
  const [editingNickname, setEditingNickname] = useState(null)  // locationId or null
  const [editingAddress,  setEditingAddress]  = useState(null)  // locationId or null
  const [nicknameDraft,   setNicknameDraft]   = useState('')
  const [addressDraft,    setAddressDraft]    = useState({ address: '', city: '', state: '' })

  // Location verification panel state
  const [verifyingLocId,  setVerifyingLocId]  = useState(null)  // locationId being verified
  const [verifyUrl,       setVerifyUrl]       = useState('')
  const [verifyPreview,   setVerifyPreview]   = useState(null)  // { name, address } or null
  const [verifyError,     setVerifyError]     = useState('')
  const [verifyLoading,   setVerifyLoading]   = useState(false)

  // Live data (rating/reviews from DataForSEO) keyed by locationId
  const [liveData,        setLiveData]        = useState({})   // { [locId]: { rating, reviewCount, resolvedAt } | 'loading' | 'error' }

  // Audit form state
  const emptyAudit = () => ({
    triggerType: 'manual',
    reviewCount: '',
    avgRating: '',
    photoCount: '',
    notes: '',
    ...Object.fromEntries(CHECKLIST_FIELDS.map(f => [f, null])),
    ...Object.fromEntries(CHECKLIST_FIELDS.map(f => [f + '_notes', ''])),
  })
  const [auditForm, setAuditForm] = useState(emptyAudit())

  // Add-location form state
  const emptyLoc = () => ({ name: '', gbpUrl: '', gbpPlaceId: '', address: '', city: '', state: '' })
  const [locForm,  setLocForm]  = useState(emptyLoc())
  const [locErr,   setLocErr]   = useState('')

  async function loadGbp() {
    setGbpLoading(true)
    setGbpErr('')
    try {
      const res = await fetch(`/api/clients/${acronym}/gbp`)
      if (!res.ok) throw new Error('Failed to load GBP data')
      const j = await res.json()
      setGbpData(j)
    } catch (e) {
      setGbpErr(e.message)
    } finally {
      setGbpLoading(false)
    }
  }

  useEffect(() => { loadGbp() }, [acronym])

  // Fetch live rating/reviews from DataForSEO for a single location
  async function fetchLiveData(locId) {
    setLiveData(prev => ({ ...prev, [locId]: 'loading' }))
    try {
      const res = await fetch(`/api/clients/${acronym}/gbp/${locId}/live-data`)
      const j = await res.json()
      // status:unverified means no Place ID set — don’t show wrong data
      if (j.status === 'unverified') {
        setLiveData(prev => ({ ...prev, [locId]: 'unverified' }))
        return
      }
      if (!res.ok) throw new Error(j.error || 'Failed')
      setLiveData(prev => ({ ...prev, [locId]: j }))
    } catch (e) {
      setLiveData(prev => ({ ...prev, [locId]: 'error' }))
    }
  }

  // Auto-fetch live data for all locations once loaded
  useEffect(() => {
    if (!gbpData?.locations?.length) return
    for (const loc of gbpData.locations) {
      if (!liveData[loc.id]) fetchLiveData(loc.id)
    }
  }, [gbpData])

  function openAuditForm(loc) {
    setActiveAuditLocationId(loc.id)
    setAuditForm({
      ...emptyAudit(),
      reviewCount: loc.lastAudit?.reviewCount ?? '',
      avgRating:   loc.lastAudit?.avgRating   ?? '',
      photoCount:  loc.lastAudit?.photoCount  ?? '',
    })
  }

  async function saveAudit() {
    setSaving(true)
    try {
      const payload = {
        locationId: activeAuditLocationId,
        triggerType: auditForm.triggerType,
        reviewCount: auditForm.reviewCount !== '' ? Number(auditForm.reviewCount) : null,
        avgRating:   auditForm.avgRating   !== '' ? Number(auditForm.avgRating)   : null,
        photoCount:  auditForm.photoCount  !== '' ? Number(auditForm.photoCount)  : null,
        notes: auditForm.notes || null,
        ...Object.fromEntries(CHECKLIST_FIELDS.map(f => [f, auditForm[f]])),
        ...Object.fromEntries(CHECKLIST_FIELDS.map(f => [f + '_notes', auditForm[f + '_notes'] || null])),
      }
      const res = await fetch(`/api/clients/${acronym}/gbp/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Save failed') }
      setActiveAuditLocationId(null)
      setAuditForm(emptyAudit())
      await loadGbp()
    } catch (e) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function saveLocation() {
    setLocErr('')
    setSaving(true)
    try {
      if (!locForm.name.trim()) throw new Error('Location name is required')
      const res = await fetch(`/api/clients/${acronym}/gbp/locations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(locForm),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Save failed') }
      setShowAddLocation(false)
      setLocForm(emptyLoc())
      await loadGbp()
    } catch (e) {
      setLocErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function saveNickname(locId) {
    setSaving(true)
    try {
      const res = await fetch(`/api/clients/${acronym}/gbp/locations`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId: locId, nickname: nicknameDraft }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Save failed') }
      setEditingNickname(null)
      await loadGbp()
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  async function saveAddress(locId) {
    setSaving(true)
    try {
      const res = await fetch(`/api/clients/${acronym}/gbp/locations`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId: locId, ...addressDraft }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Save failed') }
      setEditingAddress(null)
      await loadGbp()
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  async function runAutoAudit(locId) {
    setAutoAuditing(prev => new Set([...prev, locId]))
    try {
      const res = await fetch(`/api/clients/${acronym}/gbp/${locId}/auto-audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Auto-audit failed') }
      await loadGbp()
      setAutoAuditFlash(prev => new Set([...prev, locId]))
      setTimeout(() => setAutoAuditFlash(prev => { const n = new Set(prev); n.delete(locId); return n }), 3000)
    } catch (e) {
      alert(e.message || 'Auto-audit failed')
    } finally {
      setAutoAuditing(prev => { const n = new Set(prev); n.delete(locId); return n })
    }
  }

  function setAuditField(field, value) {
    setAuditForm(prev => ({ ...prev, [field]: value }))
  }

  // Extract Place ID or CID from a Google Maps URL
  function extractPlaceId(url) {
    if (!url) return null
    // Format: maps?cid=1234567890
    const cidMatch = url.match(/[?&]cid=(\d+)/)
    if (cidMatch) return { type: 'cid', value: cidMatch[1] }
    // Format: /maps/place/...!1sChIJ...
    const placeMatch = url.match(/!1s(ChIJ[A-Za-z0-9_-]+)/)
    if (placeMatch) return { type: 'place_id', value: placeMatch[1] }
    // Format: place_id=ChIJ...
    const qMatch = url.match(/place_id=(ChIJ[A-Za-z0-9_-]+)/)
    if (qMatch) return { type: 'place_id', value: qMatch[1] }
    return null
  }

  async function handleVerifyUrl(locId) {
    if (!verifyUrl.trim()) return
    setVerifyLoading(true)
    setVerifyError('')
    setVerifyPreview(null)
    try {
      await saveMapsUrl(locId, verifyUrl.trim())
      // Fetch live data to get the preview
      const res = await fetch(`/api/clients/${acronym}/gbp/${locId}/live-data`)
      const j = await res.json()
      if (j.status === 'unverified') {
        setVerifyError('Could not resolve this URL. Make sure it\'s a Google Maps URL (maps.google.com or google.com/maps)')
      } else if (j.title) {
        setVerifyPreview({ name: j.title, address: j.address })
        setLiveData(prev => ({ ...prev, [locId]: j }))
        setVerifyingLocId(null)
        setVerifyUrl('')
      } else {
        setVerifyError('URL saved but could not confirm the business. Try a different Maps URL.')
      }
    } catch (e) {
      setVerifyError(e.message || 'Failed to verify')
    } finally {
      setVerifyLoading(false)
    }
  }

  async function saveMapsUrl(locId, mapsUrl) {
    const extracted = extractPlaceId(mapsUrl)
    const payload = { locationId: locId, gbpUrl: mapsUrl.trim() }
    if (extracted?.type === 'place_id') payload.nickname = undefined  // don't overwrite nickname
    if (extracted?.type === 'place_id') {
      // Store place_id directly via DB update through the route
      payload.gbpUrl = mapsUrl.trim()
    }
    setSaving(true)
    try {
      // Save the Maps URL as gbpUrl
      const res = await fetch(`/api/clients/${acronym}/gbp/locations`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId: locId, gbpUrl: mapsUrl.trim() }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Save failed') }
      // If we extracted a place ID, store it too
      if (extracted?.type === 'place_id') {
        await fetch(`/api/clients/${acronym}/gbp/${locId}/live-data`)
      }
      await loadGbp()
      // Trigger live data refresh
      setLiveData(prev => { const n = { ...prev }; delete n[locId]; return n })
      setTimeout(() => fetchLiveData(locId), 500)
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  const liveScore = calcGbpScore(auditForm)

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-white">Google Business Profile</h2>
        {isAdmin && (
          <button onClick={() => setShowAddLocation(v => !v)} className={BTN_CLS}>
            {showAddLocation ? 'Cancel' : '+ Add Location'}
          </button>
        )}
      </div>

      {/* Loading / error */}
      {gbpLoading && <div className="text-sm text-gray-500">Loading GBP data…</div>}
      {gbpErr && <div className="text-sm text-rose-400">{gbpErr}</div>}

      {/* No locations */}
      {!gbpLoading && !gbpErr && gbpData && gbpData.locations?.length === 0 && (
        <Empty>
          No GBP locations set up yet.
          {isAdmin && (
            <button
              onClick={() => setShowAddLocation(true)}
              className="ml-3 text-violet-400 underline hover:no-underline"
            >
              Add one now
            </button>
          )}
        </Empty>
      )}

      {/* Multi-location summary table (2+ locations only) */}
      {!gbpLoading && !gbpErr && gbpData?.locations?.length >= 2 && (
        <div className="rounded-2xl border border-[var(--brand-border)] bg-black/20 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[var(--brand-border)]">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Location Summary</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--brand-border)]">
                  <th className="px-4 py-2 text-left text-gray-500 font-medium">Location</th>
                  <th className="px-3 py-2 text-center text-gray-500 font-medium">⭐ Rating</th>
                  <th className="px-3 py-2 text-center text-gray-500 font-medium">Reviews</th>
                  <th className="px-3 py-2 text-center text-gray-500 font-medium">📸 Photos</th>
                  <th className="px-3 py-2 text-center text-gray-500 font-medium">Health Score</th>
                  <th className="px-3 py-2 text-center text-gray-500 font-medium">Last Audited</th>
                </tr>
              </thead>
              <tbody>
                {gbpData.locations.map(loc => {
                  const la = loc.latestAudit || loc.lastAudit
                  const rel = la ? fmtRelativeDate(la.auditDate || la.createdAt) : null
                  return (
                    <tr key={loc.id} className="border-b border-[var(--brand-border)] last:border-0 hover:bg-white/5 transition">
                      <td className="px-4 py-2">
                        <a href={`#gbp-loc-${loc.id}`}
                           onClick={e => { e.preventDefault(); document.getElementById(`gbp-loc-${loc.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}
                           className="font-semibold text-white hover:text-violet-300 transition cursor-pointer">
                          {loc.locationName}
                        </a>
                        {loc.city && <div className="text-gray-600 text-xs">{[loc.city, loc.state].filter(Boolean).join(', ')}</div>}
                      </td>
                      <td className="px-3 py-2 text-center text-gray-300">
                        {(() => { const ld = liveData[loc.id]; const r = (ld && ld !== 'loading' && ld !== 'error') ? ld.rating : null; const v = r ?? la?.avgRating; return v != null ? <span>{Number(v).toFixed(1)} ⭐{r != null && <span className="text-[9px] text-emerald-500 ml-1">live</span>}</span> : <span className="text-gray-600">—</span> })()}
                      </td>
                      <td className="px-3 py-2 text-center text-gray-300">
                        {(() => { const ld = liveData[loc.id]; const r = (ld && ld !== 'loading' && ld !== 'error') ? ld.reviewCount : null; const v = r ?? la?.reviewCount; return v != null ? <span>{Number(v).toLocaleString()}{r != null && <span className="text-[9px] text-emerald-500 ml-1">live</span>}</span> : <span className="text-gray-600">—</span> })()}
                      </td>
                      <td className="px-3 py-2 text-center text-gray-300">
                        {(() => {
                          const ld = liveData[loc.id]
                          const livePhotos = (ld && ld !== 'loading' && ld !== 'error' && ld !== 'unverified') ? ld.totalPhotos : null
                          const count = la?.photoCount ?? livePhotos ?? loc.liveDataSnapshot?.totalPhotos ?? null
                          const isLive = count != null && la?.photoCount == null
                          return count != null
                            ? <span>{count}{isLive && <span className="text-[9px] text-emerald-500 ml-1">live</span>}</span>
                            : <span className="text-gray-600">—</span>
                        })()}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {(() => {
                          const auditScore = la?.compositeScore ?? la?.score ?? null
                          if (auditScore != null) return <GbpScoreBadge score={auditScore} />
                          // Derive partial score from live autoChecks when no audit exists
                          const ld = liveData[loc.id]
                          const ac = (ld && ld !== 'loading' && ld !== 'error' && ld !== 'unverified')
                            ? ld.autoChecks
                            : loc.liveDataSnapshot?.autoChecks
                          if (!ac) return <GbpScoreBadge score={null} />
                          const vals = Object.values(ac).filter(v => v !== null && v !== undefined)
                          if (!vals.length) return <GbpScoreBadge score={null} />
                          const derived = Math.round((vals.filter(v => v === true).length / vals.length) * 100)
                          return <span className="inline-flex flex-col items-center gap-0.5"><GbpScoreBadge score={derived} /><span className="text-[9px] text-gray-600">partial</span></span>
                        })()}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {rel
                          ? <span className={parseInt(rel) > 30 ? 'text-amber-400' : 'text-gray-400'}>{rel}</span>
                          : <span className="text-rose-400">Never</span>
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Locations — tiled grid */}
      {!gbpLoading && !gbpErr && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {gbpData?.locations?.map(loc => {
        const isAuditing = activeAuditLocationId === loc.id
        const histOpen   = expandedHistory === loc.id
        const lastAudit  = loc.lastAudit

        return (
          <div key={loc.id} id={`gbp-loc-${loc.id}`} className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-black/60 overflow-hidden shadow-lg">

            {/* ── Section A: Header (nickname + last audited) ── */}
            <div className="px-4 pt-4 pb-2 flex items-start justify-between gap-2">
              {/* Editable nickname */}
              <div className="flex-1 min-w-0">
                {isAdmin && editingNickname === loc.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={nicknameDraft}
                      onChange={e => setNicknameDraft(e.target.value)}
                      onBlur={() => saveNickname(loc.id)}
                      onKeyDown={e => { if (e.key === 'Enter') saveNickname(loc.id); if (e.key === 'Escape') setEditingNickname(null) }}
                      placeholder="Add nickname…"
                      className="rounded-lg border border-violet-500/50 bg-black/40 px-2.5 py-1 text-sm text-white placeholder-gray-600 focus:border-violet-400 focus:outline-none"
                    />
                    {saving && <span className="text-xs text-gray-500">Saving…</span>}
                  </div>
                ) : (
                  <div
                    className={`font-semibold text-white truncate ${isAdmin ? 'cursor-pointer hover:text-violet-300 transition' : ''}`}
                    onClick={() => { if (isAdmin) { setNicknameDraft(loc.locationName || ''); setEditingNickname(loc.id) } }}
                    title={isAdmin ? 'Click to edit nickname' : undefined}
                  >
                    {loc.locationName || <span className="text-gray-600 font-normal italic">Add nickname…</span>}
                  </div>
                )}
              </div>
              {/* Last audited badge */}
              <div className="shrink-0 text-right">
                {(() => {
                const auditTs = lastAudit ? (lastAudit.auditDate || lastAudit.createdAt) : null
                const days    = auditTs ? Math.floor((Date.now() - new Date(auditTs).getTime()) / (1000 * 60 * 60 * 24)) : null
                const rel     = fmtRelativeDate(auditTs)
                if (!lastAudit) return (
                  <span className="shrink-0 rounded-full bg-rose-500/15 border border-rose-500/30 px-2.5 py-0.5 text-xs text-rose-400">Never audited</span>
                )
                return (
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs border ${
                    days != null && days > 30
                      ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                      : 'bg-white/5 border-[var(--brand-border)] text-gray-500'
                  }`}>
                    Audited {rel}{days != null && days > 30 ? ' ⚠️' : ''}
                  </span>
                )
                })()}
              </div>
            </div>

            {/* ── Section B: Address + GBP link (compact) ── */}
            <div className="px-4 pb-3 text-xs text-gray-500">
              {isAdmin && editingAddress === loc.id ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <input
                      autoFocus
                      value={addressDraft.address}
                      onChange={e => setAddressDraft(p => ({ ...p, address: e.target.value }))}
                      placeholder="Street address"
                      className="flex-1 min-w-[180px] rounded-lg border border-violet-500/50 bg-black/40 px-2.5 py-1 text-sm text-white placeholder-gray-600 focus:border-violet-400 focus:outline-none"
                    />
                    <input
                      value={addressDraft.city}
                      onChange={e => setAddressDraft(p => ({ ...p, city: e.target.value }))}
                      placeholder="City"
                      className="w-32 rounded-lg border border-violet-500/50 bg-black/40 px-2.5 py-1 text-sm text-white placeholder-gray-600 focus:border-violet-400 focus:outline-none"
                    />
                    <input
                      value={addressDraft.state}
                      onChange={e => setAddressDraft(p => ({ ...p, state: e.target.value }))}
                      placeholder="State"
                      className="w-20 rounded-lg border border-violet-500/50 bg-black/40 px-2.5 py-1 text-sm text-white placeholder-gray-600 focus:border-violet-400 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => saveAddress(loc.id)} disabled={saving} className={BTN_SM}>{saving ? 'Saving…' : 'Save'}</button>
                    <button onClick={() => setEditingAddress(null)} className={BTN_SM}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div
                    className={`flex items-center gap-1.5 text-sm text-gray-400 ${isAdmin ? 'cursor-pointer hover:text-gray-200 transition' : ''}`}
                    onClick={() => { if (isAdmin) { setAddressDraft({ address: loc.address || '', city: loc.city || '', state: loc.state || '' }); setEditingAddress(loc.id) } }}
                    title={isAdmin ? 'Click to edit address' : undefined}
                  >
                    <span className="text-gray-600">📍</span>
                    {[loc.address, loc.city, loc.state].filter(Boolean).join(', ') || (
                      <span className="italic text-gray-600">Add address…</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {loc.gbpUrl && (
                      <a href={loc.gbpUrl} target="_blank" rel="noreferrer"
                         className="text-xs text-violet-400 hover:underline">
                        View on Google ↗
                      </a>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => {
                          setVerifyingLocId(verifyingLocId === loc.id ? null : loc.id)
                          setVerifyUrl(loc.gbpUrl && !loc.gbpUrl.includes('share.google') ? loc.gbpUrl : '')
                          setVerifyError('')
                          setVerifyPreview(null)
                        }}
                        className="text-xs text-gray-600 hover:text-violet-400 transition underline"
                      >
                        {loc.gbpPlaceId ? '✓ Verified' : (loc.gbpUrl && !loc.gbpUrl.includes('share.google')) ? '⚠️ Verify URL' : '+ Verify Location'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Location Verification Panel ── */}
            {isAdmin && verifyingLocId === loc.id && (
              <div className="px-4 py-4 border-b border-amber-500/20 bg-amber-500/5 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="text-xs font-semibold text-amber-300">🗺️ Verify Google Business Profile Location</div>
                  <button onClick={() => setVerifyingLocId(null)} className="text-gray-600 hover:text-gray-400 text-xs">✕</button>
                </div>

                {/* Instructions */}
                <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-3 space-y-1.5 text-xs text-gray-400">
                  <div className="text-gray-300 font-medium mb-2">How to get the Maps URL:</div>
                  <div className="flex gap-2"><span className="text-amber-400 font-bold shrink-0">1.</span><span>Go to <span className="text-violet-400">maps.google.com</span> and search for <span className="text-white font-medium">{loc.locationName || 'this location'}</span></span></div>
                  <div className="flex gap-2"><span className="text-amber-400 font-bold shrink-0">2.</span><span>Click the business in the results to open its listing</span></div>
                  <div className="flex gap-2"><span className="text-amber-400 font-bold shrink-0">3.</span><span>Copy the URL from your browser&apos;s address bar — it should look like:<br/><span className="font-mono text-[10px] text-gray-500 block mt-1">https://www.google.com/maps/place/Business+Name/...</span><span className="font-mono text-[10px] text-gray-500 block">https://maps.google.com/maps?cid=...</span></span></div>
                  <div className="flex gap-2"><span className="text-amber-400 font-bold shrink-0">4.</span><span>Paste it below — we&apos;ll verify the match and lock in live data</span></div>
                </div>

                {/* URL input */}
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={verifyUrl}
                    onChange={e => { setVerifyUrl(e.target.value); setVerifyError('') }}
                    placeholder="https://www.google.com/maps/place/..."
                    className="flex-1 rounded-lg border border-[var(--brand-border)] bg-black/40 px-3 py-2 text-xs text-white placeholder-gray-600 focus:border-amber-500/50 focus:outline-none font-mono"
                    onKeyDown={e => e.key === 'Enter' && handleVerifyUrl(loc.id)}
                  />
                  <button
                    onClick={() => handleVerifyUrl(loc.id)}
                    disabled={verifyLoading || !verifyUrl.trim()}
                    className="rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-2 text-xs font-medium text-amber-300 hover:bg-amber-500/25 disabled:opacity-50 transition whitespace-nowrap"
                  >
                    {verifyLoading ? 'Verifying…' : 'Verify & Save'}
                  </button>
                </div>

                {/* Error */}
                {verifyError && (
                  <div className="text-xs text-rose-400">{verifyError}</div>
                )}

                {/* Success preview */}
                {verifyPreview && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs">
                    <span className="text-emerald-400 font-medium">✓ Verified: </span>
                    <span className="text-white">{verifyPreview.name}</span>
                    {verifyPreview.address && <span className="text-gray-400"> — {verifyPreview.address}</span>}
                  </div>
                )}
              </div>
            )}

            {/* ── Section 3: Instrument dials ── */}
            {(() => {
              const live = liveData[loc.id]
              const isUnverified = live === 'unverified'
              const hasLive = live && live !== 'loading' && live !== 'error' && live !== 'unverified'
              const isLiveLoading = live === 'loading'
              // Only use audit data for rating/reviews — never show fuzzy-matched live data as truth
              const displayRating  = hasLive ? live.rating  : (lastAudit?.avgRating  != null ? Number(lastAudit.avgRating)  : null)
              const displayReviews = hasLive ? live.reviewCount : (lastAudit?.reviewCount != null ? lastAudit.reviewCount : null)
              const livePhotoCount = hasLive ? live.totalPhotos : null
              const photoCount     = livePhotoCount ?? lastAudit?.photoCount ?? null
              const photoInfo      = photoCount != null ? calcPhotoScore(photoCount, lastAudit?.photoRecentMonth) : null
              const health         = lastAudit?.compositeScore ?? null
              const passed         = CHECKLIST_FIELDS.filter(f => lastAudit?.[f] === true).length
              const ttl            = CHECKLIST_FIELDS.length
              return (
                <>
                  {/* Three instrument dials */}
                  <div className="grid grid-cols-3 gap-px border-y border-white/[0.06]">
                    <div className="flex flex-col items-center justify-center py-4 bg-black/25">
                      <div className="text-2xl font-bold tracking-tight text-white leading-none">
                        {isLiveLoading ? <span className="text-gray-600 text-lg">···</span>
                          : displayRating != null ? Number(displayRating).toFixed(1)
                          : <span className="text-gray-600 text-lg">—</span>}
                      </div>
                      <div className="text-[10px] uppercase tracking-[0.15em] text-gray-500 mt-1">⭐ Rating</div>
                      {hasLive && <div className="text-[9px] text-emerald-500 mt-0.5">live</div>}
                      {isUnverified && <div className="text-[9px] text-amber-500 mt-0.5">verify ↗</div>}
                    </div>
                    <div className="flex flex-col items-center justify-center py-4 bg-black/25 border-x border-white/[0.06]">
                      <div className="text-2xl font-bold tracking-tight text-white leading-none">
                        {isLiveLoading ? <span className="text-gray-600 text-lg">···</span>
                          : displayReviews != null ? Number(displayReviews).toLocaleString()
                          : <span className="text-gray-600 text-lg">—</span>}
                      </div>
                      <div className="text-[10px] uppercase tracking-[0.15em] text-gray-500 mt-1">💬 Reviews</div>
                      {hasLive && <div className="text-[9px] text-emerald-500 mt-0.5">live</div>}
                      {isUnverified && <div className="text-[9px] text-amber-500 mt-0.5">verify ↗</div>}
                    </div>
                    <div className="flex flex-col items-center justify-center py-4 bg-black/25">
                      {photoInfo ? (
                        <>
                          <div className={`text-2xl font-bold tracking-tight leading-none ${photoInfo.score <= 2 ? 'text-rose-400' : photoInfo.score === 3 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {photoInfo.score}<span className="text-sm text-gray-600">/5</span>
                          </div>
                          <div className="text-[10px] uppercase tracking-[0.15em] text-gray-500 mt-1">📷 Photos</div>
                          {livePhotoCount != null && <div className="text-[9px] text-emerald-500 mt-0.5">{livePhotoCount} live</div>}
                        </>
                      ) : (
                        <>
                          <div className="text-2xl font-bold tracking-tight text-gray-600 leading-none">—</div>
                          <div className="text-[10px] uppercase tracking-[0.15em] text-gray-500 mt-1">📷 Photos</div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Unverified location banner */}
                  {isUnverified && isAdmin && (
                    <div className="px-4 py-2 border-b border-white/[0.06] flex items-center gap-2">
                      <span className="text-[11px] text-amber-400">⚠️ Paste a Google Maps URL to enable live ratings & reviews</span>
                    </div>
                  )}

                  {/* Health arc gauge */}
                  {health != null && (
                    <div className="px-4 py-3 border-b border-white/[0.06]">
                      <HealthArcGauge score={health} passed={passed} total={ttl} />
                    </div>
                  )}

                  {/* Star distribution */}
                  {hasLive && live.ratingDistribution && (
                    <div className="px-4 py-3 border-b border-white/[0.06] space-y-1.5">
                      {[5, 4, 3, 2, 1].map(star => {
                        const cnt = live.ratingDistribution[star] ?? 0
                        const tot2 = Object.values(live.ratingDistribution).reduce((a, b) => a + b, 0)
                        const pct2 = tot2 > 0 ? Math.round((cnt / tot2) * 100) : 0
                        const barColor = star >= 4 ? 'bg-emerald-500' : star === 3 ? 'bg-amber-500' : 'bg-rose-500'
                        return (
                          <div key={star} className="flex items-center gap-2 text-xs">
                            <span className="w-5 text-right text-gray-600">{star}★</span>
                            <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
                              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct2}%` }} />
                            </div>
                            <span className="w-5 text-right text-gray-600">{cnt}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Photo improvement text */}
                  {photoInfo && (
                    <div className="px-4 py-2 border-b border-white/[0.06]">
                      <p className="text-[11px] italic text-gray-500">{photoInfo.text}</p>
                    </div>
                  )}
                </>
              )
            })()}

            {/* ── GBP Details Panel ── */}
            {(() => {
              const live = liveData[loc.id]
              const hasLive = live && live !== 'loading' && live !== 'error'
              if (!hasLive) return null
              return (
                <div className="px-4 py-3 border-b border-[var(--brand-border)] space-y-3">

                  {/* Category row */}
                  {live.primaryCategory && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-gray-500">Categories:</span>
                      <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-xs text-violet-300">
                        {live.primaryCategory}
                      </span>
                      {(live.additionalCategories || []).map(cat => (
                        <span key={cat} className="rounded-full border border-[var(--brand-border)] bg-white/5 px-2 py-0.5 text-xs text-gray-400">
                          {cat.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Hours row */}
                  {live.hours && (
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs text-gray-500">Hours:</span>
                        {live.currentStatus === 'open'
                          ? <span className="text-xs text-emerald-400 font-medium">● Open now</span>
                          : live.currentStatus === 'closed'
                          ? <span className="text-xs text-rose-400 font-medium">● Closed</span>
                          : null
                        }
                      </div>
                      <div className="grid grid-cols-4 gap-x-3 gap-y-0.5">
                        {Object.entries(live.hours).map(([day, hrs]) => (
                          <div key={day} className="flex items-center gap-1 text-xs">
                            <span className="text-gray-600 w-7">{day}</span>
                            <span className={hrs === 'Closed' ? 'text-gray-600' : 'text-gray-300'}>{hrs}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Review snippet */}
                  {live.reviewSnippet && (
                    <div className="rounded-xl border border-[var(--brand-border)] bg-black/20 px-3 py-2">
                      <span className="text-xs italic text-gray-400">💬 {live.reviewSnippet}</span>
                    </div>
                  )}

                  {/* Auto-resolved checklist items */}
                  {live.autoChecks && (
                    <div>
                      <div className="text-xs text-gray-500 mb-1.5">Auto-verified from Google:</div>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(live.autoChecks).map(([key, val]) => {
                          if (val === null) return null
                          const labels = {
                            isClaimed: 'Claimed & verified',
                            websiteLinked: 'Website linked',
                            phoneListened: 'Phone listed',
                            hoursComplete: 'Hours complete',
                            secondaryCategoriesSet: 'Categories set',
                            has50Reviews: '50+ reviews',
                            ratingAbove4: '4.0+ rating',
                          }
                          const color = val
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                            : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                          const icon = val ? '✓' : '✗'
                          return (
                            <span key={key} className={`rounded-full border px-2.5 py-0.5 text-xs ${color}`}>
                              {icon} {labels[key] || key}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  )}

                </div>
              )
            })()}

            {/* ── Section 4: Health score bar ── */}
            {lastAudit && (() => {
              const score   = lastAudit.compositeScore ?? 0
              const total   = CHECKLIST_FIELDS.length
              const passed  = CHECKLIST_FIELDS.filter(f => lastAudit[f] === true).length
              const barColor  = score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-rose-500'
              const textColor = score >= 80 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-rose-400'
              return (
                <div className="px-4 py-2.5 border-b border-[var(--brand-border)]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">Health Score</span>
                    <span className={`text-xs font-medium ${textColor}`}>{score}/100 · {passed} of {total} checks passing</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-white/10">
                    <div className={`h-1.5 rounded-full transition-all ${barColor}`} style={{ width: `${score}%` }} />
                  </div>
                </div>
              )
            })()}

            {/* ── Failing Checks Panel ── */}
            {lastAudit && (() => {
              const failingChecks = GBP_CHECKLIST.filter(({ field }) => lastAudit[field] === false)
              const allPassing = CHECKLIST_FIELDS.every(f => lastAudit[f] !== false)
              if (allPassing) {
                return (
                  <div className="px-4 py-2.5 border-b border-[var(--brand-border)]">
                    <span className="text-xs text-emerald-400">✅ All checks passing</span>
                  </div>
                )
              }
              const visible = failingChecks.slice(0, 8)
              const overflow = failingChecks.length - 8
              return (
                <div className="px-4 py-3 border-b border-[var(--brand-border)]">
                  <div className="text-xs font-medium text-amber-400 mb-2">⚠️ Needs Attention</div>
                  <div className="flex flex-wrap gap-1.5">
                    {visible.map(({ field, label }) => (
                      <span key={field} className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-xs text-rose-300">
                        {label}
                      </span>
                    ))}
                    {overflow > 0 && (
                      <span className="rounded-full border border-gray-600 bg-white/5 px-2.5 py-0.5 text-xs text-gray-400">
                        +{overflow} more
                      </span>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* ── Always-Visible Checklist Panel ── */}
            {(() => {
              const live = liveData[loc.id]
              const hasLive = live && live !== 'loading' && live !== 'error' && live !== 'unverified'
              const autoChecks = hasLive ? live.autoChecks : (loc.liveDataSnapshot?.autoChecks ?? null)
              const prevAudit = loc.auditHistory?.[1] ?? null
              return (
                <GBPChecklistPanel
                  loc={loc}
                  autoChecks={autoChecks}
                  prevAudit={prevAudit}
                  acronym={acronym}
                  onSaved={loadGbp}
                />
              )
            })()}

            {/* ── Section 5: Action buttons ── */}
            <div className="flex items-center gap-2 flex-wrap px-4 py-2.5 border-b border-[var(--brand-border)]">
              <button
                onClick={() => runAutoAudit(loc.id)}
                disabled={autoAuditing.has(loc.id)}
                className="rounded-lg border border-violet-500/40 bg-violet-500/15 px-3 py-1.5 text-xs font-medium text-violet-300 hover:bg-violet-500/25 disabled:opacity-50 transition"
              >
                {autoAuditing.has(loc.id) ? '🤖 Running…' : '🤖 Auto-Audit'}
              </button>
              <button
                onClick={() => isAuditing ? setActiveAuditLocationId(null) : openAuditForm(loc)}
                className={BTN_SM}
              >
                {isAuditing ? 'Cancel Audit' : 'Log Audit'}
              </button>
              {lastAudit && (
                <button
                  onClick={() => setExpandedHistory(histOpen ? null : loc.id)}
                  className={BTN_SM}
                >
                  View History{loc.auditHistory?.length > 0 ? ` (${loc.auditHistory.length})` : ''}
                </button>
              )}
              {autoAuditFlash.has(loc.id) && (
                <span className="text-xs text-emerald-400 font-medium">✓ Auto-audit saved!</span>
              )}
            </div>

            {/* Audit form */}
            {isAuditing && (
              <div className="border-t border-[var(--brand-border)] bg-black/30 px-4 py-4 space-y-4">
                <SectionTitle>Audit — {loc.name}</SectionTitle>

                {/* Trigger + metrics */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="mb-1 block text-xs text-gray-400">Trigger</label>
                    <select
                      value={auditForm.triggerType}
                      onChange={e => setAuditField('triggerType', e.target.value)}
                      className={INPUT_CLS}
                    >
                      <option value="manual">Manual</option>
                      <option value="recon">Recon</option>
                      <option value="monthly-report">Monthly Report</option>
                      <option value="quarterly-meeting">Quarterly Meeting</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-400">Review Count</label>
                    <input
                      type="number" value={auditForm.reviewCount}
                      onChange={e => setAuditField('reviewCount', e.target.value)}
                      placeholder="e.g. 37" className={INPUT_CLS}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-400">Avg Rating</label>
                    <input
                      type="number" step="0.1" min="1" max="5" value={auditForm.avgRating}
                      onChange={e => setAuditField('avgRating', e.target.value)}
                      placeholder="e.g. 4.8" className={INPUT_CLS}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-400">Photo Count</label>
                    <input
                      type="number" value={auditForm.photoCount}
                      onChange={e => setAuditField('photoCount', e.target.value)}
                      placeholder="e.g. 24" className={INPUT_CLS}
                    />
                  </div>
                </div>

                {/* Checklist */}
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Checklist</div>
                  <div className="space-y-2">
                    {GBP_CHECKLIST.map(({ field, label }) => (
                      <div key={field} className="flex items-start gap-3 rounded-xl border border-[var(--brand-border)] bg-black/20 px-3 py-2">
                        {/* tri-state: null → unchecked → true → false */}
                        <div className="flex gap-2 items-center shrink-0 pt-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              const cur = auditForm[field]
                              setAuditField(field, cur === null ? true : cur === true ? false : null)
                            }}
                            className={`w-5 h-5 rounded border flex items-center justify-center text-xs font-bold transition ${
                              auditForm[field] === true  ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                            : auditForm[field] === false ? 'border-rose-500 bg-rose-500/20 text-rose-400'
                            : 'border-gray-600 bg-black/40 text-gray-600'
                            }`}
                          >
                            {auditForm[field] === true ? '✓' : auditForm[field] === false ? '✗' : '—'}
                          </button>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-gray-200">{label}</div>
                          <input
                            type="text"
                            value={auditForm[field + '_notes']}
                            onChange={e => setAuditField(field + '_notes', e.target.value)}
                            placeholder="Notes…"
                            className="mt-1 w-full rounded border border-[var(--brand-border)] bg-black/30 px-2 py-1 text-xs text-gray-300 placeholder-gray-600 focus:border-violet-500/50 focus:outline-none"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Audit notes + score + save */}
                <div>
                  <label className="mb-1 block text-xs text-gray-400">Audit Notes</label>
                  <textarea
                    value={auditForm.notes}
                    onChange={e => setAuditField('notes', e.target.value)}
                    rows={3}
                    placeholder="Overall observations, recommendations…"
                    className={INPUT_CLS + ' resize-none'}
                  />
                </div>

                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400">Score preview:</span>
                    <GbpScoreBadge score={liveScore} />
                  </div>
                  <button
                    onClick={saveAudit}
                    disabled={saving}
                    className={BTN_CLS}
                  >
                    {saving ? 'Saving…' : 'Save Audit'}
                  </button>
                </div>
              </div>
            )}

            {/* Audit history toggle */}
            <div className="border-t border-[var(--brand-border)]">
              <button
                onClick={() => setExpandedHistory(histOpen ? null : loc.id)}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-gray-500 hover:text-gray-300 transition"
              >
                <span className={`transition-transform ${histOpen ? 'rotate-90' : ''}`}>›</span>
                {histOpen ? 'Hide' : 'Show'} audit history
                {loc.auditHistory?.length > 0 && (
                  <span className="ml-1 rounded-full bg-white/10 px-1.5 py-0.5">{loc.auditHistory.length}</span>
                )}
              </button>

              {histOpen && (
                <div className="px-4 pb-4 space-y-4">
                  {!loc.auditHistory?.length ? (
                    <div className="text-xs text-gray-600">No audit history yet.</div>
                  ) : (
                    <>
                      {/* Rating Trend Mini Chart */}
                      {(() => {
                        const trendData = [...(loc.auditHistory || [])].reverse().map(a => ({
                          date: new Date(a.auditDate || a.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                          rating: a.avgRating != null ? Number(a.avgRating) : null,
                          score: a.compositeScore ?? null,
                        })).filter(d => d.rating != null || d.score != null)
                        if (trendData.length < 2 || trendData.every(d => d.rating == null)) return null
                        return (
                          <div>
                            <div className="text-xs font-medium text-gray-400 mb-1">Rating Trend</div>
                            <div className="w-full">
                              <LineChart width={320} height={120} data={trendData} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                                <YAxis domain={[0, 5]} tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false} width={24} />
                                <Tooltip
                                  contentStyle={{ background: '#0f0f0f', border: '1px solid #333', borderRadius: 8, fontSize: 11 }}
                                  labelStyle={{ color: '#9ca3af' }}
                                  itemStyle={{ color: '#a78bfa' }}
                                  formatter={(v) => v != null ? v.toFixed(1) : '—'}
                                />
                                <Line type="monotone" dataKey="rating" stroke="#a78bfa" strokeWidth={2} dot={{ r: 3, fill: '#a78bfa' }} activeDot={{ r: 4 }} connectNulls />
                              </LineChart>
                            </div>
                          </div>
                        )
                      })()}

                      {/* Enhanced History Table */}
                      <div className="overflow-x-auto rounded-xl border border-[var(--brand-border)]">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-[var(--brand-border)] text-gray-500">
                              <th className="px-3 py-2 text-left font-medium">Date</th>
                              <th className="px-3 py-2 text-left font-medium">⭐ Rating</th>
                              <th className="px-3 py-2 text-left font-medium">💬 Reviews</th>
                              <th className="px-3 py-2 text-left font-medium">📸 Photos</th>
                              <th className="px-3 py-2 text-left font-medium">Health</th>
                              <th className="px-3 py-2 text-left font-medium">Δ Rating</th>
                              <th className="px-3 py-2 text-left font-medium">Δ Checklist</th>
                              <th className="px-3 py-2 text-left font-medium">Trigger</th>
                              <th className="px-3 py-2 text-left font-medium">Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {loc.auditHistory.map((audit, idx) => {
                              const prev = loc.auditHistory[idx + 1]
                              const ratingDelta = (audit.avgRating != null && prev?.avgRating != null)
                                ? (Number(audit.avgRating) - Number(prev.avgRating)).toFixed(1)
                                : null
                              const checkDelta = computeChecklistDelta(audit, prev)
                              return (
                                <tr key={audit.id} className="border-b border-[var(--brand-border)]/50 hover:bg-white/5">
                                  <td className="px-3 py-2 text-gray-300 whitespace-nowrap">{fmtDate(audit.auditDate || audit.createdAt)}</td>
                                  <td className="px-3 py-2 text-gray-300">{audit.avgRating != null ? Number(audit.avgRating).toFixed(1) : '—'}</td>
                                  <td className="px-3 py-2 text-gray-400">{audit.reviewCount ?? '—'}</td>
                                  <td className="px-3 py-2 text-gray-400">{audit.photoCount ?? '—'}</td>
                                  <td className="px-3 py-2"><GbpScoreBadge score={audit.compositeScore ?? audit.score} /></td>
                                  <td className="px-3 py-2 whitespace-nowrap">
                                    {ratingDelta === null ? <span className="text-gray-600">—</span> : (
                                      <span className={Number(ratingDelta) > 0 ? 'text-emerald-400' : Number(ratingDelta) < 0 ? 'text-rose-400' : 'text-gray-500'}>
                                        {Number(ratingDelta) > 0 ? '▲ +' : Number(ratingDelta) < 0 ? '▼ ' : ''}{ratingDelta}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap">
                                    {prev == null ? <span className="text-gray-600">—</span> : (
                                      <span className="flex flex-col gap-0.5 text-[10px]">
                                        {checkDelta.improved  > 0 && <span className="text-emerald-400">▲ {checkDelta.improved} improved</span>}
                                        {checkDelta.regressed > 0 && <span className="text-rose-400">▼ {checkDelta.regressed} regressed</span>}
                                        {checkDelta.pending   > 0 && <span className="text-gray-500">⬜ {checkDelta.pending} pending</span>}
                                        {checkDelta.improved === 0 && checkDelta.regressed === 0 && checkDelta.pending === 0 && <span className="text-gray-500">→ no change</span>}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-gray-400 capitalize">{(audit.triggerType || '').replace(/-/g, ' ') || '—'}</td>
                                  <td className="px-3 py-2 text-gray-500 max-w-[180px] truncate">{audit.notes || '—'}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}
        </div>
      )}

      {/* Add Location Form */}
      {isAdmin && showAddLocation && (
        <div className="rounded-2xl border border-violet-500/30 bg-violet-500/5 px-4 py-4 space-y-4">
          <SectionTitle>Add GBP Location</SectionTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-gray-400">Location Name *</label>
              <input
                value={locForm.name}
                onChange={e => setLocForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Sunshine Daycare — Downtown"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">GBP URL</label>
              <input
                value={locForm.gbpUrl}
                onChange={e => setLocForm(p => ({ ...p, gbpUrl: e.target.value }))}
                placeholder="https://maps.google.com/…"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">GBP Place ID</label>
              <input
                value={locForm.gbpPlaceId}
                onChange={e => setLocForm(p => ({ ...p, gbpPlaceId: e.target.value }))}
                placeholder="ChIJ…"
                className={INPUT_CLS}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-gray-400">Address</label>
              <input
                value={locForm.address}
                onChange={e => setLocForm(p => ({ ...p, address: e.target.value }))}
                placeholder="123 Main St"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">City</label>
              <input
                value={locForm.city}
                onChange={e => setLocForm(p => ({ ...p, city: e.target.value }))}
                placeholder="Toronto"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">State / Province</label>
              <input
                value={locForm.state}
                onChange={e => setLocForm(p => ({ ...p, state: e.target.value }))}
                placeholder="ON"
                className={INPUT_CLS}
              />
            </div>
          </div>
          {locErr && <div className="text-sm text-rose-400">{locErr}</div>}
          <div className="flex gap-3">
            <button onClick={saveLocation} disabled={saving} className={BTN_CLS}>
              {saving ? 'Saving…' : 'Save Location'}
            </button>
            <button onClick={() => { setShowAddLocation(false); setLocForm(emptyLoc()); setLocErr('') }} className={BTN_SM}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab 6: CRM ────────────────────────────────────────────────────────────────

function CRMTab({ profile, acronym, funnelByLocation = [], locations = [], gbpLocations = [], funnelAggregate = [], onRefresh }) {
  const locationNames = useMemo(() => {
    const ordered = []
    const seen = new Set()

    // Step 1: funnel names first — these are the canonical names with actual data
    for (const name of funnelByLocation.map((row) => row.locationName)) {
      const key = normalizeLocationKey(name)
      if (!key || seen.has(key)) continue
      seen.add(key)
      ordered.push(name)
    }

    // Step 2: GBP location names — skip if the GBP name CONTAINS an already-added funnel name
    // (e.g. "The Eastside Preschool by Child Time" is suppressed when "Eastside Preschool" is already listed)
    // One-directional check only: GBP long names absorb into funnel short names, never the reverse.
    for (const location of gbpLocations) {
      const name = location.locationName
      const key = normalizeLocationKey(name)
      if (!key || seen.has(key)) continue
      const coveredByFunnel = ordered.some(existing => {
        const ekey = normalizeLocationKey(existing)
        return ekey.length > 4 && key.includes(ekey)
      })
      if (coveredByFunnel) continue
      seen.add(key)
      ordered.push(name)
    }

    return ordered
  }, [funnelByLocation, gbpLocations])

  const [openLocs, setOpenLocs] = useState([])
  const [locationForms, setLocationForms] = useState({})
  const [savingLocationKey, setSavingLocationKey] = useState('')
  const [savedLocationKey, setSavedLocationKey] = useState('')
  const [locationErrors, setLocationErrors] = useState({})
  const saveTimer = useRef(null)

  useEffect(() => {
    if (locationNames.length === 0) {
      setOpenLocs([])
      return
    }

    setOpenLocs((prev) => {
      const next = prev.filter((loc) => locationNames.some((name) => normalizeLocationKey(name) === normalizeLocationKey(loc)))
      return next.length > 0 ? next : [locationNames[0]]
    })
  }, [locationNames])

  useEffect(() => {
    const nextForms = {}
    for (const name of locationNames) {
      const nameKey = normalizeLocationKey(name)
      const match = gbpLocations.find((location) => {
        const lkey = normalizeLocationKey(location.locationName)
        return lkey === nameKey || (lkey.length > 4 && lkey.includes(nameKey))
      })
      nextForms[normalizeLocationKey(name)] = {
        capacity: match?.capacity ?? '',
        currentEnrollment: match?.currentEnrollment ?? '',
        avgTuition: match?.avgTuition ?? '',
      }
    }
    setLocationForms(nextForms)
  }, [locationNames, gbpLocations])

  useEffect(() => () => clearTimeout(saveTimer.current), [])

  function toggleLoc(loc) {
    setOpenLocs(prev => prev.includes(loc) ? prev.filter(l => l !== loc) : [...prev, loc])
  }

  const byLoc = {}
  for (const row of funnelByLocation) {
    if (!byLoc[row.locationName]) byLoc[row.locationName] = []
    byLoc[row.locationName].push(row)
  }

  const gbpByKey = useMemo(() => {
    const map = {}
    for (const location of gbpLocations) {
      map[normalizeLocationKey(location.locationName)] = location
    }
    return map
  }, [gbpLocations])

  function getLatest(loc) { return (byLoc[loc] || [])[0] || null }
  function getLast12(loc)  { return (byLoc[loc] || []).slice(0, 12).reverse() }
  function getLocationRecord(loc) {
    const key = normalizeLocationKey(loc)
    if (gbpByKey[key]) return gbpByKey[key]
    // Substring fallback: GBP long name contains the funnel short name (one direction only)
    return gbpLocations.find(g => {
      const gkey = normalizeLocationKey(g.locationName)
      return gkey.length > 4 && gkey.includes(key)
    }) || null
  }
  function getLocationForm(loc) {
    return locationForms[normalizeLocationKey(loc)] || {
      capacity: '',
      currentEnrollment: '',
      avgTuition: '',
    }
  }

  function updateLocationForm(loc, field, value) {
    const key = normalizeLocationKey(loc)
    setLocationErrors((prev) => ({ ...prev, [key]: '' }))
    setLocationForms((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || { capacity: '', currentEnrollment: '', avgTuition: '' }),
        [field]: value,
      },
    }))
  }

  function getLocationValidationError(form) {
    if (form.currentEnrollment !== '' && (!Number.isFinite(Number(form.currentEnrollment)) || !Number.isInteger(Number(form.currentEnrollment)))) {
      return 'Registrations must be a whole number.'
    }
    if (form.capacity !== '' && (!Number.isFinite(Number(form.capacity)) || !Number.isInteger(Number(form.capacity)))) {
      return 'Capacity must be a whole number.'
    }
    if (form.avgTuition !== '' && !Number.isFinite(Number(form.avgTuition))) {
      return 'Ave Tuition must be a valid number.'
    }
    return ''
  }

  function isLocationDirty(loc) {
    const form = getLocationForm(loc)
    const record = getLocationRecord(loc)
    return (
      String(form.capacity) !== String(record?.capacity ?? '') ||
      String(form.currentEnrollment) !== String(record?.currentEnrollment ?? '') ||
      String(form.avgTuition) !== String(record?.avgTuition ?? '')
    )
  }

  async function saveLocationMetrics(loc) {
    const key = normalizeLocationKey(loc)
    const form = getLocationForm(loc)
    const validationError = getLocationValidationError(form)

    if (validationError) {
      setLocationErrors((prev) => ({ ...prev, [key]: validationError }))
      return
    }

    setSavingLocationKey(key)
    setSavedLocationKey('')
    setLocationErrors((prev) => ({ ...prev, [key]: '' }))

    try {
      const record = getLocationRecord(loc)
      const res = await fetch(`/api/clients/${acronym}/gbp/locations`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: record?.id ?? null,
          locationName: record?.locationName || loc,
          capacity: form.capacity === '' ? null : Number(form.capacity),
          currentEnrollment: form.currentEnrollment === '' ? null : Number(form.currentEnrollment),
          avgTuition: form.avgTuition === '' ? null : Number(form.avgTuition),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Failed to save location metrics')

      setSavedLocationKey(key)
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => setSavedLocationKey(''), 2500)
      await onRefresh?.()
    } catch (error) {
      setLocationErrors((prev) => ({ ...prev, [key]: error.message || 'Failed to save location metrics' }))
    } finally {
      setSavingLocationKey('')
    }
  }

  return (
    <div className="space-y-6">

      <EnrollmentSnapshotSection
        title="Enrollment & Revenue Opportunity"
        profile={profile}
        acronym={acronym}
        onRefresh={onRefresh}
      />

      {/* ── Section 1: CRM Platform ── */}
      <div>
        <SectionTitle>CRM Platform</SectionTitle>
        <Card>
          <div className="space-y-2.5">
            <InfoRow label="Platform"      value={profile.crmType || 'Not specified'} />
            <InfoRow label="Access status" value="See Notion for access details" />
            <InfoRow label="Locations"     value={profile.locationCount ? `${profile.locationCount} location${profile.locationCount !== 1 ? 's' : ''}` : null} />
          </div>
        </Card>
      </div>

      {/* ── Section 2 + 3: Location Data (unified collapsible per location) ── */}
      {locationNames.length === 0 ? (
        <div>
          <SectionTitle>Location Data</SectionTitle>
          <Empty>No location data available yet.</Empty>
        </div>
      ) : (
        <div>
          <SectionTitle>
            Locations{funnelByLocation[0] ? (() => {
              const [y, m] = funnelByLocation[0].month.split('-')
              return ' — ' + new Date(parseInt(y), parseInt(m)-1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
            })() : ''}
          </SectionTitle>
          <div className="space-y-2">
            {locationNames.map((loc) => {
              const isOpen = openLocs.includes(loc)
              const r = getLatest(loc)
              const data12 = getLast12(loc)
              const locationRecord = getLocationRecord(loc)
              const savedMetrics = getLocationEnrollmentMetrics(locationRecord)
              const form = getLocationForm(loc)
              const editMetrics = getLocationEnrollmentMetrics({
                capacity: form.capacity,
                currentEnrollment: form.currentEnrollment,
                avgTuition: form.avgTuition,
              })
              const key = normalizeLocationKey(loc)
              const validationError = getLocationValidationError(form)
              const isSaving = savingLocationKey === key
              const isSaved = savedLocationKey === key
              const error = locationErrors[key]
              const dirty = isLocationDirty(loc)
              return (
                <div key={loc} className="overflow-hidden rounded-2xl border border-[var(--brand-border)] bg-black/20">
                  {/* Collapsible header */}
                  <button
                    onClick={() => toggleLoc(loc)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-white/5"
                  >
                    <div className="flex flex-wrap items-center gap-4">
                      <span className="font-semibold text-white">{loc}</span>
                      {r ? (
                        <div className="flex gap-3 text-xs">
                          <span style={{ color: '#6366f1' }}>Leads {r.leads}</span>
                          <span style={{ color: '#C19C46' }}>Tours {r.tours}</span>
                          <span style={{ color: '#10b981' }}>Enrolled {r.registered}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-600">No funnel data</span>
                      )}
                      {savedMetrics.hasAllSourceNumbers && savedMetrics.enrollmentGap > 0 && (
                        <span className="text-xs text-amber-300">MLoT {fmtMoney(savedMetrics.monthlyOpportunity)}</span>
                      )}
                    </div>
                    <span className={`text-lg text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}>›</span>
                  </button>

                  {/* Expanded content */}
                  {isOpen && (
                    <div className="border-t border-[var(--brand-border)] px-4 pb-4 pt-3 space-y-4">

                      {/* Latest month metrics */}
                      {r && (
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                          <StatBox label="Leads"      value={r.leads} />
                          <StatBox label="Tours"      value={r.tours} />
                          <StatBox label="Enrolled"   value={r.registered} />
                          <StatBox label="Tour Rate"  value={r.tourRate  != null ? `${r.tourRate}%`  : '—'} />
                          <StatBox label="Close Rate" value={r.closeRate != null ? `${r.closeRate}%` : '—'} />
                          <StatBox label="Conv Rate"  value={r.convRate  != null ? `${r.convRate}%`  : '—'} />
                        </div>
                      )}

                      {/* Enrollment inputs + opportunity */}
                      <div className="rounded-2xl border border-[var(--brand-border)] bg-black/30 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-white">Location Enrollment Inputs</div>
                            <div className="mt-1 text-xs text-gray-400">Registrations means current live enrollment at this center.</div>
                          </div>
                          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-right">
                            <div className="text-[11px] uppercase tracking-wide text-amber-200/70">MLoT</div>
                            <div className="text-sm font-semibold text-amber-300">
                              {editMetrics.hasAllSourceNumbers ? fmtMoney(editMetrics.monthlyOpportunity) : '—'}
                            </div>
                            <div className="text-[11px] text-amber-200/60">Monthly Left on the Table</div>
                          </div>
                        </div>
                        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                          <div>
                            <label className="mb-1 block text-xs text-gray-400">Capacity</label>
                            <input type="number" step="1" value={form.capacity} onChange={e => updateLocationForm(loc, 'capacity', e.target.value)} placeholder="e.g. 126" className={INPUT_CLS} />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-gray-400">Registrations</label>
                            <input type="number" step="1" value={form.currentEnrollment} onChange={e => updateLocationForm(loc, 'currentEnrollment', e.target.value)} placeholder="e.g. 97" className={INPUT_CLS} />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-gray-400">Ave Tuition</label>
                            <input type="number" step="0.01" value={form.avgTuition} onChange={e => updateLocationForm(loc, 'avgTuition', e.target.value)} placeholder="e.g. 1450" className={INPUT_CLS} />
                          </div>
                        </div>
                        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                          <StatBox label="Open Seats" value={!editMetrics.hasAllSourceNumbers ? '—' : editMetrics.isFull ? 'Full' : fmtNum(editMetrics.enrollmentGap)} sub={!editMetrics.hasAllSourceNumbers ? 'Add all 3 inputs to calculate' : editMetrics.isFull ? 'At capacity' : 'Capacity - registrations'} />
                          <StatBox label="MLoT" value={editMetrics.hasAllSourceNumbers ? fmtMoney(editMetrics.monthlyOpportunity) : '—'} sub="Open Seats × Ave Tuition" valueClassName={editMetrics.hasAllSourceNumbers && editMetrics.enrollmentGap > 0 ? 'text-amber-300' : ''} />
                          <StatBox label="Annual Opportunity" value={editMetrics.hasAllSourceNumbers ? fmtMoney(editMetrics.annualOpportunity) : '—'} sub="MLoT × 12" valueClassName={editMetrics.hasAllSourceNumbers && editMetrics.enrollmentGap > 0 ? 'text-emerald-300' : ''} />
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <button onClick={() => saveLocationMetrics(loc)} disabled={isSaving || !dirty} className="rounded-xl border border-violet-500/40 bg-violet-500/15 px-4 py-2 text-sm font-medium text-violet-300 hover:bg-violet-500/25 disabled:opacity-50 transition">
                            {isSaving ? 'Saving…' : 'Save'}
                          </button>
                          {isSaved && <span className="text-sm text-emerald-400">✓ Saved</span>}
                          {(error || validationError) && <span className="text-sm text-rose-400">{error || validationError}</span>}
                        </div>
                      </div>

                      {/* Trendline charts */}
                      {data12.length === 0 ? (
                        <Empty>No trend data for this location.</Empty>
                      ) : (
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                          <div>
                              <div className="mb-2 text-xs font-medium text-gray-400">Volume — Leads / Tours / Enrolled</div>
                              <div style={{ height: 200 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={data12} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                    <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 9 }} tickFormatter={fmtMonth} />
                                    <YAxis tick={{ fill: '#6b7280', fontSize: 9 }} width={24} />
                                    <Tooltip contentStyle={{ background: '#0a0a0a', border: '1px solid #2a1a3e', borderRadius: 12 }} labelStyle={{ color: '#9ca3af' }} labelFormatter={fmtMonth} />
                                    <Bar dataKey="leads" fill="#6366f1" name="Leads" radius={[2,2,0,0]} />
                                    <Bar dataKey="tours" fill="#C19C46" name="Tours" radius={[2,2,0,0]} />
                                    <Bar dataKey="registered" fill="#10b981" name="Enrolled" radius={[2,2,0,0]} />
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                            <div>
                              <div className="mb-2 text-xs font-medium text-gray-400">Rates — Tour / Close / Conversion</div>
                              <div style={{ height: 200 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                  <LineChart data={data12} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                    <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 9 }} tickFormatter={fmtMonth} />
                                    <YAxis tick={{ fill: '#6b7280', fontSize: 9 }} width={32} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                                    <Tooltip contentStyle={{ background: '#0a0a0a', border: '1px solid #2a1a3e', borderRadius: 12 }} labelStyle={{ color: '#9ca3af' }} labelFormatter={fmtMonth} formatter={(val) => val != null ? `${val}%` : '—'} />
                                    <Line type="monotone" dataKey="tourRate" stroke="#06b6d4" strokeWidth={2} dot={false} name="Tour Rate" connectNulls />
                                    <Line type="monotone" dataKey="closeRate" stroke="#731494" strokeWidth={2} dot={false} name="Close Rate" connectNulls />
                                    <Line type="monotone" dataKey="convRate" stroke="#C19C46" strokeWidth={2} dot={false} name="Conv Rate" connectNulls />
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                          </div>
                        )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Section 4: Aggregate Summary ── */}
      {funnelAggregate.length > 0 && (
        <div>
          <SectionTitle>Aggregate Summary — All Locations</SectionTitle>
          <Card className="pt-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <div className="mb-2 text-xs font-medium text-gray-400">Combined Volume (12 months)</div>
                <div style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={funnelAggregate} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 9 }} tickFormatter={fmtMonth} />
                      <YAxis tick={{ fill: '#6b7280', fontSize: 9 }} width={24} />
                      <Tooltip
                        contentStyle={{ background: '#0a0a0a', border: '1px solid #2a1a3e', borderRadius: 12 }}
                        labelStyle={{ color: '#9ca3af' }}
                        labelFormatter={fmtMonth}
                      />
                      <Bar dataKey="leads"      fill="#6366f1" name="Leads"    radius={[2,2,0,0]} />
                      <Bar dataKey="tours"      fill="#C19C46" name="Tours"    radius={[2,2,0,0]} />
                      <Bar dataKey="registered" fill="#10b981" name="Enrolled" radius={[2,2,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <div className="mb-2 text-xs font-medium text-gray-400">Overall Rates (12 months)</div>
                <div style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={funnelAggregate} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 9 }} tickFormatter={fmtMonth} />
                      <YAxis tick={{ fill: '#6b7280', fontSize: 9 }} width={32} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                      <Tooltip
                        contentStyle={{ background: '#0a0a0a', border: '1px solid #2a1a3e', borderRadius: 12 }}
                        labelStyle={{ color: '#9ca3af' }}
                        labelFormatter={fmtMonth}
                        formatter={(val) => val != null ? `${val}%` : '—'}
                      />
                      <Line type="monotone" dataKey="tourRate"  stroke="#06b6d4" strokeWidth={2} dot={false} name="Tour Rate"  connectNulls />
                      <Line type="monotone" dataKey="closeRate" stroke="#731494" strokeWidth={2} dot={false} name="Close Rate" connectNulls />
                      <Line type="monotone" dataKey="convRate"  stroke="#C19C46" strokeWidth={2} dot={false} name="Conv Rate"  connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ── Section 5: CRM Notes ── */}
      <EditableNotes
        label="CRM Notes"
        value={profile.crmNotes}
        field="crmNotes"
        acronym={acronym}
        placeholder="CRM platform notes, access details, integration info…"
      />
    </div>
  )
}

// ── Tab 7: Blueprint ──────────────────────────────────────────────────────────

function BlueprintTab({ profile }) {
  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Blueprint Enrollment</SectionTitle>
        <Card>
          <div className="space-y-2.5">
            <InfoRow label="Enrolled"      value={profile.startDate ? fmtDate(profile.startDate) : null} />
            <InfoRow label="Skool access"  value="Check with Zu's team" />
            <InfoRow label="Blueprint sheet" value={profile.clientFolderUrl ? 'Open folder ↗' : null} href={profile.clientFolderUrl || null} />
            <InfoRow label="M3 workspace"  value="Not configured" />
          </div>
        </Card>
      </div>

      <div>
        <SectionTitle>Client Details</SectionTitle>
        <Card>
          <div className="space-y-2.5">
            <InfoRow label="Company"       value={profile.companyName} />
            <InfoRow label="Owner"         value={profile.ownerName} />
            <InfoRow label="Locations"     value={profile.locationCount ? `${profile.locationCount}` : null} />
            <InfoRow label="Enrollment"    value={profile.currentEnrollment} />
            <InfoRow label="Avg tuition"   value={profile.avgTuition ? fmtMoney(profile.avgTuition) : null} />
          </div>
        </Card>
      </div>

      <PlaceholderBanner icon="📊" message="M3 workspace status — integration coming" />
    </div>
  )
}

// ── Tab 8: Paid Media ─────────────────────────────────────────────────────────

function PaidMediaTab({ profile }) {
  const services = []
  if (profile.hasGoogleAds) services.push('Google Ads')
  if (profile.hasPaidMedia) services.push('Paid Media')

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Paid Media Services</SectionTitle>
        <Card>
          <div className="space-y-2.5">
            <InfoRow label="Active services" value={services.join(', ') || 'Unspecified'} />
            <InfoRow label="Assigned GA"     value={profile.assignedGA} />
            <InfoRow label="Start date"      value={profile.startDate ? fmtDate(profile.startDate) : null} />
          </div>
        </Card>
      </div>

      <div>
        <SectionTitle>Account Links</SectionTitle>
        <Card>
          <div className="space-y-2.5">
            <InfoRow label="Google Ads"    value="Add account ID" />
            <InfoRow label="FB Ads Mgr"   value="Add account ID" />
            <InfoRow label="Client folder" value={profile.clientFolderUrl ? 'Open folder ↗' : null} href={profile.clientFolderUrl || null} />
          </div>
        </Card>
      </div>

      <div>
        <SectionTitle>Performance</SectionTitle>
        <PlaceholderBanner icon="📢" message="Google Ads performance data — API integration pending" />
        <div className="mt-2">
          <PlaceholderBanner icon="📘" message="Meta Ads performance data — API integration pending" />
        </div>
      </div>
    </div>
  )
}

// ── Editable notes widget ────────────────────────────────────────────────────

function EditableNotes({ label, value, field, acronym, placeholder }) {
  const [text, setText] = useState(value || '')
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [err,    setErr]    = useState('')
  const timer = useRef(null)

  async function save() {
    setSaving(true)
    setErr('')
    try {
      const res = await fetch(`/api/clients/${acronym}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: text }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Save failed') }
      setSaved(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <SectionTitle>{label}</SectionTitle>
      <Card>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          rows={5}
          className="w-full rounded-xl border border-[var(--brand-border)] bg-black/40 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-violet-500/50 focus:outline-none resize-y"
        />
        <div className="mt-2 flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="rounded-xl border border-violet-500/40 bg-violet-500/15 px-4 py-2 text-sm font-medium text-violet-300 hover:bg-violet-500/25 disabled:opacity-50 transition"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          {saved && <span className="text-sm text-emerald-400">✓ Saved</span>}
          {err   && <span className="text-sm text-rose-400">{err}</span>}
        </div>
      </Card>
    </div>
  )
}

function EnrollmentSnapshotSection({ title, note, profile, acronym, onRefresh, editable = true, verification = null, showVerificationControls = false }) {
  const [form, setForm] = useState({
    currentEnrollment: profile.currentEnrollment ?? '',
    centerCapacity: profile.centerCapacity ?? '',
    avgTuition: profile.avgTuition ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState('')
  const [checking, setChecking] = useState(false)
  const [checkedSaved, setCheckedSaved] = useState(false)
  const [checkErr, setCheckErr] = useState('')
  const saveTimer = useRef(null)
  const checkTimer = useRef(null)

  const rollupActive = !!profile.enrollmentRollupActive
  const allowDirectEnrollmentEdit = editable && !rollupActive
  const currentPeriodMonth = verification?.currentPeriodMonth || ''
  const latestVerification = verification?.latest || null

  useEffect(() => {
    setForm({
      currentEnrollment: profile.currentEnrollment ?? '',
      centerCapacity: profile.centerCapacity ?? '',
      avgTuition: profile.avgTuition ?? '',
    })
  }, [profile.currentEnrollment, profile.centerCapacity, profile.avgTuition])

  useEffect(() => () => {
    clearTimeout(saveTimer.current)
    clearTimeout(checkTimer.current)
  }, [])

  const metrics = getEnrollmentMetrics({
    currentEnrollment: allowDirectEnrollmentEdit ? form.currentEnrollment : profile.currentEnrollment,
    centerCapacity: allowDirectEnrollmentEdit ? form.centerCapacity : profile.centerCapacity,
    avgTuition: form.avgTuition,
  })

  const currentEnrollmentInvalid = allowDirectEnrollmentEdit && form.currentEnrollment !== '' && (!Number.isFinite(Number(form.currentEnrollment)) || !Number.isInteger(Number(form.currentEnrollment)))
  const centerCapacityInvalid = allowDirectEnrollmentEdit && form.centerCapacity !== '' && (!Number.isFinite(Number(form.centerCapacity)) || !Number.isInteger(Number(form.centerCapacity)))
  const avgTuitionInvalid = form.avgTuition !== '' && !Number.isFinite(Number(form.avgTuition))

  const validationError = currentEnrollmentInvalid
    ? 'Current Enrollment must be a whole number.'
    : centerCapacityInvalid
      ? 'Capacity must be a whole number.'
      : avgTuitionInvalid
        ? 'Avg Tuition must be a valid number.'
        : ''

  const dirty =
    String(form.avgTuition) !== String(profile.avgTuition ?? '') ||
    (allowDirectEnrollmentEdit && (
      String(form.currentEnrollment) !== String(profile.currentEnrollment ?? '') ||
      String(form.centerCapacity) !== String(profile.centerCapacity ?? '')
    ))

  const hasOpportunity = metrics.hasAllSourceNumbers && metrics.enrollmentGap > 0

  async function save() {
    if (!editable || !dirty) return
    if (validationError) {
      setErr(validationError)
      return
    }

    setSaving(true)
    setErr('')
    try {
      const payload = {
        avgTuition: form.avgTuition === '' ? null : Number(form.avgTuition),
      }

      if (allowDirectEnrollmentEdit) {
        payload.currentEnrollment = form.currentEnrollment === '' ? null : Number(form.currentEnrollment)
        payload.centerCapacity = form.centerCapacity === '' ? null : Number(form.centerCapacity)
      }

      const res = await fetch(`/api/clients/${acronym}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Failed to save enrollment snapshot')
      setSaved(true)
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => setSaved(false), 2500)
      await onRefresh?.()
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function markCheckedNoChange() {
    setChecking(true)
    setCheckErr('')
    try {
      const res = await fetch(`/api/clients/${acronym}/enrollment-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Failed to mark period checked')
      setCheckedSaved(true)
      clearTimeout(checkTimer.current)
      checkTimer.current = setTimeout(() => setCheckedSaved(false), 2500)
      await onRefresh?.()
    } catch (e) {
      setCheckErr(e.message)
    } finally {
      setChecking(false)
    }
  }

  function updateField(field, value) {
    setErr('')
    setCheckErr('')
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function EditableMetricCard({ label, field, sub, type = 'number', step = '1', placeholder }) {
    return (
      <Card>
        <div className="text-[11px] uppercase tracking-wider text-gray-400">{label}</div>
        <input
          type={type}
          step={step}
          value={form[field]}
          onChange={(e) => updateField(field, e.target.value)}
          placeholder={placeholder}
          className="mt-2 w-full rounded-xl border border-[var(--brand-border)] bg-black/40 px-3 py-2 text-lg font-semibold text-white placeholder-gray-600 focus:border-violet-500/50 focus:outline-none"
        />
        <div className="mt-1 text-xs text-gray-500">{sub}</div>
      </Card>
    )
  }

  return (
    <div>
      <SectionTitle>{title}</SectionTitle>
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {editable ? (
            <>
              {allowDirectEnrollmentEdit ? (
                <>
                  <EditableMetricCard
                    label="Capacity"
                    field="centerCapacity"
                    sub="Licensed capacity"
                    placeholder="e.g. 126"
                  />
                  <EditableMetricCard
                    label="Current Enrollment"
                    field="currentEnrollment"
                    sub="Currently enrolled children"
                    placeholder="e.g. 97"
                  />
                </>
              ) : (
                <>
                  <StatBox label="Capacity" value={fmtNum(profile.centerCapacity)} sub="Rolled up from active location values" />
                  <StatBox label="Current Enrollment" value={fmtNum(profile.currentEnrollment)} sub="Rolled up from active location values" />
                </>
              )}
              <EditableMetricCard
                label="Avg Tuition"
                field="avgTuition"
                sub="Average monthly tuition"
                step="0.01"
                placeholder="e.g. 1450"
              />
            </>
          ) : (
            <>
              <StatBox label="Capacity" value={fmtNum(profile.centerCapacity)} sub="Licensed capacity" />
              <StatBox label="Current Enrollment" value={fmtNum(profile.currentEnrollment)} sub="Currently enrolled children" />
              <StatBox label="Avg Tuition" value={fmtMoney(profile.avgTuition)} sub="Average monthly tuition" />
            </>
          )}

          <StatBox
            label="Enrollment Gap"
            value={!metrics.hasAllSourceNumbers ? '—' : metrics.isFull ? 'Full' : fmtNum(metrics.enrollmentGap)}
            sub={!metrics.hasAllSourceNumbers ? 'Add all 3 inputs to calculate' : metrics.isFull ? 'At capacity' : 'Open seats available'}
            cardClassName={metrics.hasAllSourceNumbers && metrics.isFull ? 'border-white/10 bg-black/20' : ''}
            valueClassName={metrics.hasAllSourceNumbers && metrics.isFull ? 'text-gray-200' : metrics.hasAllSourceNumbers ? 'text-amber-300' : ''}
          />
          <StatBox
            label="Monthly Opportunity"
            value={metrics.hasAllSourceNumbers ? fmtMoney(metrics.monthlyOpportunity) : '—'}
            sub="Enrollment Gap × Avg Tuition"
            cardClassName={hasOpportunity ? 'border-amber-500/30 bg-amber-500/10' : ''}
            valueClassName={hasOpportunity ? 'text-amber-300' : ''}
          />
          <StatBox
            label="Annual Opportunity"
            value={metrics.hasAllSourceNumbers ? fmtMoney(metrics.annualOpportunity) : '—'}
            sub="Monthly Opportunity × 12"
            cardClassName={hasOpportunity ? 'border-emerald-500/30 bg-emerald-500/10' : ''}
            valueClassName={hasOpportunity ? 'text-emerald-300' : ''}
          />
        </div>

        {editable && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={save}
              disabled={saving || !dirty}
              className="rounded-xl border border-violet-500/40 bg-violet-500/15 px-4 py-2 text-sm font-medium text-violet-300 hover:bg-violet-500/25 disabled:opacity-50 transition"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            {saved && <span className="text-sm text-emerald-400">✓ Saved</span>}
            {(err || validationError) && <span className="text-sm text-rose-400">{err || validationError}</span>}
          </div>
        )}

        {showVerificationControls && (
          <Card className="bg-black/20">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-gray-400">Monthly verification</div>
                <div className="mt-1 text-sm font-medium text-gray-200">{currentPeriodMonth || '—'}</div>
                <div className="mt-1 text-xs text-gray-500">
                  {latestVerification
                    ? `${fmtPeriodLong(latestVerification.periodMonth)}: ${fmtVerificationStatus(latestVerification.status)}`
                    : 'No monthly verification logged yet.'}
                </div>
              </div>
              <button
                onClick={markCheckedNoChange}
                disabled={checking}
                className="rounded-xl border border-[var(--brand-border)] bg-black/30 px-4 py-2 text-sm font-medium text-gray-200 hover:border-violet-500/40 hover:text-violet-300 disabled:opacity-50 transition"
              >
                {checking ? 'Saving…' : 'Mark checked (no change)'}
              </button>
            </div>
            {(checkedSaved || checkErr) && (
              <div className={`mt-3 text-sm ${checkErr ? 'text-rose-400' : 'text-emerald-400'}`}>
                {checkErr || '✓ Monthly verification saved'}
              </div>
            )}
          </Card>
        )}

        {rollupActive && editable && (
          <div className="text-xs text-gray-500">
            Capacity and current enrollment now roll up automatically from the location rows in CRM.
          </div>
        )}

        {note && <div className="text-xs text-gray-500">{note}</div>}
      </div>
    </div>
  )
}

// ── Tab 9: Contacts ───────────────────────────────────────────────────────────

function ContactsTab({ profile, gbpLocations = [] }) {
  const ghlUrl = profile.ghlContactId
    ? `https://app.gohighlevel.com/contacts/${profile.ghlContactId}`
    : null

  const contactRows = [
    { label: 'Owner', value: profile.ownerName },
    { label: 'Main Email', value: profile.email, href: profile.email ? `mailto:${profile.email}` : null },
    { label: 'Main Phone', value: profile.phone, href: profile.phone ? `tel:${profile.phone}` : null },
    { label: 'Director', value: profile.directorName },
    { label: 'Director Email', value: profile.directorEmail, href: profile.directorEmail ? `mailto:${profile.directorEmail}` : null },
    { label: 'Director Phone', value: profile.directorPhone, href: profile.directorPhone ? `tel:${profile.directorPhone}` : null },
    { label: 'Assigned GA', value: profile.assignedGA },
    { label: 'Assigned GA Email', value: profile.assignedGAEmail, href: profile.assignedGAEmail ? `mailto:${profile.assignedGAEmail}` : null },
    { label: 'GHL Contact', value: profile.ghlContactId, href: ghlUrl, mono: true },
  ]

  const noteSections = [
    { label: 'Team Notes', value: profile.teamNotes },
    { label: 'General Notes', value: profile.notes },
    { label: 'Website Notes', value: profile.websiteNotes },
    { label: 'SEO Notes', value: profile.seoNotes },
    { label: 'CRM Notes', value: profile.crmNotes },
  ].filter((note) => note.value && String(note.value).trim())

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Primary Contacts</SectionTitle>
        <Card>
          <div className="space-y-2.5">
            {contactRows.map((row) => (
              <InfoRow
                key={row.label}
                label={row.label}
                value={row.value}
                href={row.href}
                mono={row.mono}
              />
            ))}
          </div>
        </Card>
      </div>

      <div>
        <SectionTitle>Locations &amp; Addresses</SectionTitle>
        {gbpLocations.length > 0 ? (
          <div className="space-y-3">
            {gbpLocations.map((location) => {
              const fullAddress = [location.address, location.city, location.state].filter(Boolean).join(', ')
              const cityState = [location.city, location.state].filter(Boolean).join(', ')

              return (
                <Card key={location.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-white">{location.locationName || 'Unnamed location'}</div>
                      <div className="mt-2 space-y-2.5">
                        <InfoRow label="Address" value={fullAddress} />
                        <InfoRow label="City / State" value={cityState} />
                        <InfoRow label="GBP Link" value={location.gbpUrl ? 'View GBP ↗' : null} href={location.gbpUrl || null} />
                      </div>
                    </div>
                    <Badge
                      label={location.isActive ? 'Active' : 'Inactive'}
                      className={location.isActive
                        ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                        : 'border-gray-500/30 bg-gray-500/10 text-gray-300'}
                    />
                  </div>
                </Card>
              )
            })}
          </div>
        ) : (
          <Card>
            <div className="space-y-2.5">
              <InfoRow label="City / State" value={[profile.city, profile.state].filter(Boolean).join(', ')} />
              <InfoRow
                label="Locations"
                value={profile.locationCount != null ? `${profile.locationCount} location${profile.locationCount === 1 ? '' : 's'}` : null}
              />
              <div className="pt-1 text-sm text-gray-400">Detailed location records not yet connected</div>
            </div>
          </Card>
        )}
      </div>

      <div>
        <SectionTitle>Links &amp; Systems</SectionTitle>
        <Card>
          <div className="space-y-2.5">
            <InfoRow label="Website" value={profile.website} href={profile.website ? (profile.website.startsWith('http') ? profile.website : `https://${profile.website}`) : null} />
            <InfoRow label="Client Folder" value={profile.clientFolderUrl ? 'Open folder ↗' : null} href={profile.clientFolderUrl || null} />
            <InfoRow label="Lead Data Sheet" value={profile.leadDataUrl ? 'Open sheet ↗' : null} href={profile.leadDataUrl || null} />
            <InfoRow label="GHL Contact" value={profile.ghlContactId ? 'Open contact ↗' : null} href={ghlUrl} />
          </div>
        </Card>
      </div>

      <div>
        <SectionTitle>Special Notes</SectionTitle>
        {noteSections.length === 0 ? (
          <Empty>No notes on record yet.</Empty>
        ) : (
          <div className="space-y-3">
            {noteSections.map((note) => (
              <Card key={note.label}>
                <div className="text-[11px] uppercase tracking-wider text-gray-400">{note.label}</div>
                <pre className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-200 font-sans">
                  {note.value}
                </pre>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tab 10: Notes ─────────────────────────────────────────────────────────────

// A single collapsible meeting note entry (top-level heading_3 with children)
function MeetingNoteEntry({ text, children }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--brand-border)] bg-black/20">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-white/5"
      >
        <span className="text-sm font-semibold text-gray-200">{text || 'Meeting Note'}</span>
        <span className={`text-lg text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
      </button>
      {open && (
        <div className="border-t border-[var(--brand-border)] px-4 pb-4 pt-3">
          <NotionBlockRenderer blocks={children} depth={1} />
        </div>
      )}
    </div>
  )
}

function NotionBlockRenderer({ blocks, depth = 0 }) {
  return (
    <div className={depth > 0 ? 'space-y-1 ml-3' : 'space-y-2'}>
      {blocks.map((block, i) => {
        const { type, text, children = [] } = block

        // Top-level heading_3 with children = a collapsible meeting entry
        if (depth === 0 && type === 'heading_3' && children.length > 0) {
          return <MeetingNoteEntry key={i} text={text} children={children} />
        }

        let el
        if (type === 'heading_1') el = <div className="text-base font-bold text-white mt-3 mb-1">{text}</div>
        else if (type === 'heading_2') el = <div className="text-sm font-bold text-gray-200 mt-2 mb-1">{text}</div>
        else if (type === 'heading_3') el = <div className="text-sm font-semibold text-gray-300 mt-2">{text}</div>
        else if (type === 'bulleted_list_item') el = <div className="text-sm text-gray-300 flex gap-2"><span className="text-gray-500 shrink-0">•</span><span>{text}</span></div>
        else if (type === 'numbered_list_item') el = <div className="text-sm text-gray-300 flex gap-2"><span className="text-gray-500 shrink-0">{i+1}.</span><span>{text}</span></div>
        else if (type === 'callout') el = <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 my-2">{text}</div>
        else if (type === 'divider') el = <hr className="border-white/10 my-2" />
        else if (type === 'child_page') el = <div className="text-sm font-semibold text-violet-400 mt-3">📄 {text}</div>
        else if (type === 'toggle') el = <div className="text-sm font-medium text-gray-200">{text}</div>
        else if (text) el = <div className="text-sm text-gray-300 leading-relaxed">{text}</div>
        else el = null

        return (
          <div key={i}>
            {el}
            {children.length > 0 && <NotionBlockRenderer blocks={children} depth={depth + 1} />}
          </div>
        )
      })}
    </div>
  )
}

function NotesTab({ profile, acronym }) {
  const [notesData, setNotesData] = useState(null)
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    fetch(`/api/clients/${acronym}/notes`)
      .then(r => r.json())
      .then(d => { setNotesData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [acronym])

  return (
    <div className="space-y-6">
      {/* Editable team notes */}
      <EditableNotes
        label="Team Notes"
        value={profile.teamNotes}
        field="teamNotes"
        acronym={acronym}
        placeholder="Add internal notes for the team — strategy decisions, known issues, context…"
      />

      {/* GHL Notes — only show when there are actual human-written notes (payment auto-notes are filtered out) */}
      {!loading && notesData?.ghlNotes?.notes?.length > 0 && (
        <div>
          <SectionTitle>GHL Notes</SectionTitle>
          <Card>
            <div className="divide-y divide-white/5 space-y-0">
              {notesData.ghlNotes.notes.map((note, i) => (
                <div key={i} className="py-3 first:pt-0 last:pb-0">
                  <div className="text-xs text-gray-500 mb-1">{new Date(note.dateAdded).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}{note.user?.name ? ` · ${note.user.name}` : ''}</div>
                  <pre className="whitespace-pre-wrap text-sm text-gray-300 leading-relaxed font-sans">{note.body}</pre>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Notion Notes */}
      <div>
        <SectionTitle>Meeting Notes <span className="normal-case font-normal text-gray-600 text-xs">(from Notion, read-only)</span></SectionTitle>
        {loading ? (
          <Card><div className="text-sm text-gray-500 py-2">Loading…</div></Card>
        ) : notesData?.notionNotes?.error === 'not_shared' ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
            <div className="font-semibold text-amber-300 mb-1">Notes page not shared with Wall-E</div>
            <div className="text-amber-200/70 text-xs">{notesData.notionNotes.message}</div>
          </div>
        ) : notesData?.notionNotes?.blocks?.length > 0 ? (
          <Card>
            <NotionBlockRenderer blocks={notesData.notionNotes.blocks} />
          </Card>
        ) : profile.notes ? (
          <Card>
            <pre className="whitespace-pre-wrap text-sm text-gray-300 leading-relaxed">{profile.notes}</pre>
          </Card>
        ) : (
          <Card><div className="text-sm text-gray-500">No Notion notes available.</div></Card>
        )}
      </div>

      {/* Timestamps */}
      <div className="text-xs text-gray-600 space-y-1">
        {profile.lastEnrichedAt && <div>Last synced: {fmtDate(profile.lastEnrichedAt)}</div>}
        {profile.updatedAt      && <div>Profile updated: {fmtDate(profile.updatedAt)}</div>}
        {profile.notionPageId   && <div>Notion page ID: <span className="font-mono">{profile.notionPageId}</span></div>}
      </div>
    </div>
  )
}

// ── Tab 11: Calls ─────────────────────────────────────────────────────────────

function CallsTab({ profile, allCalls, pendingCalls, potentialUnlinkedCount }) {
  const [view, setView] = useState('all')
  const displayed       = view === 'pending' ? pendingCalls : allCalls
  const withTranscript  = allCalls.filter((c) => c.transcriptText).length
  const withAI          = allCalls.filter((c) => c.aiSummary).length
  const classifiedCount = allCalls.length - pendingCalls.length

  return (
    <div className="space-y-5">
      {/* Potential unlinked calls banner */}
      {potentialUnlinkedCount > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <span className="text-lg">🔎</span>
          <div>
            <div className="text-sm font-semibold text-amber-300">
              {potentialUnlinkedCount} potential call{potentialUnlinkedCount !== 1 ? 's' : ''} found via email match
            </div>
            <div className="mt-0.5 text-xs text-amber-200/70">
              These calls have participant emails matching this client but aren&apos;t linked yet.{' '}
              <Link href="/team/classify" className="underline hover:text-amber-300">
                Review in Call Intelligence →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBox label="Total calls"    value={allCalls.length} />
        <StatBox label="Classified"     value={classifiedCount} />
        <StatBox label="With transcript" value={withTranscript} sub="Permanent record" />
        <StatBox label="AI summaries"   value={withAI} />
      </div>

      {/* View toggle */}
      {pendingCalls.length > 0 && (
        <div className="flex gap-2">
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

      {view === 'pending' && pendingCalls.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 text-xs text-amber-300">
          These calls are linked to this client but haven&apos;t been classified yet.
          Click <strong>&quot;Classify this call →&quot;</strong> on any row to open Call Intelligence.
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
    </div>
  )
}

// ── Meetings Tab ──────────────────────────────────────────────────────────────
function MeetingsTab({ acronym, profile }) {
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [submitting, setSubmitting] = useState(null)
  const [filter, setFilter] = useState('all') // 'all' | 'pending_review' | 'submitted'

  useEffect(() => {
    fetch(`/api/clients/${acronym}/meetings`)
      .then(r => r.json())
      .then(d => { setMeetings(d.meetings || []); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [acronym])

  async function handleAction(id, action) {
    setSubmitting(id)
    try {
      await fetch(`/api/clients/${acronym}/meetings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      })
      setMeetings(prev => prev.map(m => m.id === id
        ? { ...m, status: action === 'approve' ? 'approved' : 'submitted' }
        : m
      ))
    } finally {
      setSubmitting(null)
    }
  }

  const filtered = filter === 'all' ? meetings : meetings.filter(m => m.status === filter)

  const statusBadge = (status) => {
    const map = {
      pending_review: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
      approved:       'border-violet-500/40 bg-violet-500/10 text-violet-300',
      submitted:      'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    }
    const label = { pending_review: 'Pending Review', approved: 'Approved', submitted: 'Submitted' }
    return (
      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${map[status] || ''}`}>
        {label[status] || status}
      </span>
    )
  }

  const sourceLabel = (src) => ({
    zoom_scribe: '🤖 Scribe',
    notion_import: '📥 Notion',
    manual: '✏️ Manual',
  }[src] || src)

  const pending = meetings.filter(m => m.status === 'pending_review').length

  if (loading) return <div className="py-8 text-center text-sm text-gray-500">Loading meetings…</div>
  if (error) return <div className="py-8 text-center text-sm text-rose-400">Error: {error}</div>

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">Meeting Records</div>
          <div className="text-xs text-gray-400 mt-0.5">
            {meetings.length} total
            {pending > 0 && <span className="ml-2 text-amber-300 font-semibold">· {pending} pending review</span>}
          </div>
        </div>
        <div className="flex gap-1.5">
          {['all', 'pending_review', 'submitted'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition ${
                filter === f
                  ? 'border-violet-500/50 bg-violet-500/15 text-violet-200'
                  : 'border-white/10 bg-black/20 text-gray-400 hover:text-white'
              }`}
            >
              {f === 'all' ? 'All' : f === 'pending_review' ? 'Pending' : 'Submitted'}
            </button>
          ))}
        </div>
      </div>

      {/* Meeting list */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/8 bg-black/20 py-10 text-center">
          <div className="text-sm text-gray-500">
            {filter === 'pending_review' ? 'No meetings pending review.' : 'No meeting records yet.'}
          </div>
          <div className="mt-1 text-xs text-gray-600">
            Meeting summaries will appear here after calls are processed by Scribe.
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(m => {
            const isOpen = expanded === m.id
            const date = new Date(m.meetingDate).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'America/Toronto' })
            const tasks = Array.isArray(m.tasks) ? m.tasks : (m.tasks ? JSON.parse(m.tasks) : [])
            const decisions = Array.isArray(m.decisions) ? m.decisions : (m.decisions ? JSON.parse(m.decisions) : [])
            const topics = Array.isArray(m.topics) ? m.topics : (m.topics ? JSON.parse(m.topics) : [])
            const issues = Array.isArray(m.outstandingIssues) ? m.outstandingIssues : (m.outstandingIssues ? JSON.parse(m.outstandingIssues) : [])

            return (
              <div key={m.id} className="rounded-2xl border border-white/8 bg-black/20 overflow-hidden">
                {/* Card header — always visible */}
                <button
                  className="w-full flex items-start justify-between gap-3 px-4 py-3.5 text-left hover:bg-white/3 transition"
                  onClick={() => setExpanded(isOpen ? null : m.id)}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="mt-0.5 shrink-0">
                      <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{date}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{sourceLabel(m.source)}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{m.title || m.meetingType?.replace('_', ' ') || 'Meeting'}</div>
                      {m.execSummary && (
                        <div className="mt-1 text-xs leading-5 text-gray-400 line-clamp-2">{m.execSummary}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {statusBadge(m.status)}
                    <span className={`text-gray-400 transition-transform text-sm ${isOpen ? 'rotate-90' : ''}`}>›</span>
                  </div>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="border-t border-white/8 px-5 py-4 space-y-4">
                    {/* Exec summary */}
                    {m.execSummary && (
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-violet-300 mb-1.5">Executive Summary</div>
                        <p className="text-sm leading-6 text-gray-300">{m.execSummary}</p>
                      </div>
                    )}

                    {/* 4-column grid: topics, decisions, tasks, issues */}
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      {topics.length > 0 && (
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-cyan-300 mb-2">Topics</div>
                          <ul className="space-y-1">{topics.map((t, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400/60" />{t}
                            </li>
                          ))}</ul>
                        </div>
                      )}
                      {decisions.length > 0 && (
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300 mb-2">Decisions</div>
                          <ul className="space-y-1">{decisions.map((d, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/60" />{d}
                            </li>
                          ))}</ul>
                        </div>
                      )}
                      {tasks.length > 0 && (
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-300 mb-2">Tasks</div>
                          <ul className="space-y-1.5">{tasks.map((t, i) => (
                            <li key={i} className="text-xs text-gray-300">
                              <span className="font-medium text-amber-200">{t.owner || 'TBD'}:</span> {typeof t === 'string' ? t : t.task}
                            </li>
                          ))}</ul>
                        </div>
                      )}
                      {issues.length > 0 && (
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-rose-300 mb-2">Outstanding</div>
                          <ul className="space-y-1">{issues.map((issue, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400/60" />{issue}
                            </li>
                          ))}</ul>
                        </div>
                      )}
                    </div>

                    {/* Meta + actions */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/8">
                      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                        {m.hostName && <span>Host: {m.hostName}</span>}
                        {m.durationSecs && <span>Duration: {Math.round(m.durationSecs / 60)}m</span>}
                        {m.transcriptUrl && (
                          <a href={m.transcriptUrl} target="_blank" rel="noreferrer" className="text-violet-400 hover:text-violet-300 transition">
                            View transcript ↗
                          </a>
                        )}
                        {m.notionUrl && (
                          <a href={m.notionUrl} target="_blank" rel="noreferrer" className="text-cyan-400 hover:text-cyan-300 transition">
                            Notion entry ↗
                          </a>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {m.status === 'pending_review' && (
                          <>
                            <button
                              disabled={submitting === m.id}
                              onClick={() => handleAction(m.id, 'approve')}
                              className="rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-200 hover:bg-violet-500/20 disabled:opacity-40 transition"
                            >
                              {submitting === m.id ? '…' : 'Approve'}
                            </button>
                            <button
                              disabled={submitting === m.id}
                              onClick={() => handleAction(m.id, 'submit')}
                              className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-40 transition"
                            >
                              {submitting === m.id ? '…' : 'Approve + Submit'}
                            </button>
                          </>
                        )}
                        {m.status === 'approved' && (
                          <button
                            disabled={submitting === m.id}
                            onClick={() => handleAction(m.id, 'submit')}
                            className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-40 transition"
                          >
                            {submitting === m.id ? '…' : 'Submit to Notion'}
                          </button>
                        )}
                        {m.status === 'submitted' && (
                          <span className="text-xs text-emerald-400">✓ Submitted{m.submittedAt ? ' · ' + new Date(m.submittedAt).toLocaleDateString() : ''}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
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

// ── Tab nav ───────────────────────────────────────────────────────────────────

function TabNav({ tabs, activeTab, onChange }) {
  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-max gap-1 rounded-2xl border border-[var(--brand-border)] bg-black/30 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`relative whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold transition ${
              activeTab === tab.key
                ? 'bg-violet-600 text-white shadow'
                : tab.alert
                  ? 'border border-rose-500/50 text-rose-300 hover:text-white'
                  : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab.alert && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-400" />}
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Main ClientCard ───────────────────────────────────────────────────────────

export default function ClientCard({ acronym, user }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [activeTab, setActiveTab] = useState('overview')

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

  const {
    profile,
    allCalls = [],
    pendingCalls = [],
    funnelHistory = [],
    funnelByLocation = [],
    funnelAggregate = [],
    locations = [],
    gbpLocations = [],
    enrollmentVerification = null,
    potentialUnlinkedCount = 0,
    recentPayments = [],
  } = data

  // ── Build visible tabs ───────────────────────────────────────────────────
  const ALL_TABS = [
    { key: 'overview',     label: 'Overview',                  show: true },
    { key: 'financial',    label: 'Financial',                 show: true, alert: !!profile.isOverdue },
    { key: 'gbp',          label: 'GBP',                       show: true },
    { key: 'website',      label: 'Website',                   show: true },
    { key: 'seo',          label: 'SEO',                       show: true },
    { key: 'crm',          label: 'CRM',                       show: true },
    { key: 'paidmedia',    label: 'Paid Media',                show: true },
    { key: 'demographics', label: 'Demographics',              show: true },
    { key: 'market-intel', label: 'Market Intel',              show: true },
    { key: 'overlay-test', label: '🧪 Overlay Test',           show: acronym === 'CTI' },
    { key: 'contacts',     label: 'Contacts',                  show: true },
    { key: 'notes',        label: 'Notes',                     show: true },
    { key: 'meetings',     label: 'Meetings',                  show: true },
    { key: 'blueprint',    label: 'Blueprint',                 show: !!profile.hasBlueprint },
  ]
  const visibleTabs = ALL_TABS.filter((t) => t.show)

  // Ensure activeTab is still valid after data loads
  const currentTab =
    visibleTabs.find((t) => t.key === activeTab) ? activeTab : visibleTabs[0]?.key

  const ghlUrl = profile.ghlContactId
    ? `https://app.gohighlevel.com/contacts/${profile.ghlContactId}`
    : null

  return (
    <div className="mx-auto max-w-[1200px] space-y-5">

      {/* Back nav */}
      <Link
        href="/clients"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-violet-300 transition"
      >
        ← All Clients
      </Link>

      {/* ── Hero header ───────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-3xl border border-[var(--brand-border)] bg-[radial-gradient(circle_at_top_left,#1a1024,transparent_60%),var(--brand-bg-card)] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div style={{ color: '#AE2BCF' }} className="text-5xl font-black tracking-tight leading-none">
              {profile.acronym}
            </div>
            <div className="mt-1 text-xl font-semibold text-white">{profile.companyName || '—'}</div>
            <div className="mt-0.5 text-sm text-gray-400">{profile.ownerName || '—'}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusBadge status={profile.status} />
              {profile.assignedGA && (
                <Badge
                  label={`👤 ${profile.assignedGA}`}
                  className="border-violet-500/30 bg-violet-500/10 text-violet-200"
                />
              )}
              {profile.crmType && (
                <Badge
                  label={`🔗 ${profile.crmType}`}
                  className="border-[var(--brand-border)] bg-black/30 text-gray-300"
                />
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
              {ghlUrl && (
                <a
                  href={ghlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-full border border-[var(--brand-border)] bg-black/30 px-2.5 py-0.5 text-xs text-gray-300 hover:text-violet-300 transition"
                >
                  GHL ↗
                </a>
              )}
            </div>
          </div>

          {/* Quick stats */}
          <div className={`grid gap-3 text-center ${currentTab === 'overview' ? 'grid-cols-2 lg:w-48' : 'grid-cols-3 lg:w-72'}`}>
            {currentTab !== 'overview' && (
              <div className="rounded-2xl border border-[var(--brand-border)] bg-black/30 px-3 py-3">
                <div className="text-[11px] text-gray-400 uppercase tracking-wide">MRR</div>
                <div className="mt-1 text-lg font-bold text-white">{profile.mrr ? fmt$(profile.mrr) : '—'}</div>
              </div>
            )}
            <div className="rounded-2xl border border-[var(--brand-border)] bg-black/30 px-3 py-3">
              <div className="text-[11px] text-gray-400 uppercase tracking-wide">Locations</div>
              <div className="mt-1 text-lg font-bold text-white">{profile.locationCount || '—'}</div>
            </div>
            <div className="rounded-2xl border border-[var(--brand-border)] bg-black/30 px-3 py-3">
              <div className="text-[11px] text-gray-400 uppercase tracking-wide">Health</div>
              <div className={`mt-1 text-lg font-bold ${
                profile.healthScore >= 8 ? 'text-emerald-400' :
                profile.healthScore >= 5 ? 'text-amber-400' : 'text-rose-400'
              }`}>
                {profile.healthScore}/10
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab navigation ─────────────────────────────────────────────── */}
      <TabNav tabs={visibleTabs} activeTab={currentTab} onChange={setActiveTab} />

      {/* ── Tab content ────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-3xl border border-[var(--brand-border)] bg-[radial-gradient(circle_at_top,#1a1024,transparent_45%),var(--brand-bg-card)] p-6">
        {currentTab === 'overview' && (
          <OverviewTab
            profile={profile}
            funnelHistory={funnelHistory}
            allCalls={allCalls}
            potentialUnlinkedCount={potentialUnlinkedCount}
            acronym={acronym}
            enrollmentVerification={enrollmentVerification}
            onJumpTab={setActiveTab}
            onRefresh={load}
          />
        )}
        {currentTab === 'financial' && (
          <FinancialTab profile={profile} recentPayments={recentPayments} user={user} />
        )}
        {currentTab === 'website' && (
          <WebsiteTab profile={profile} acronym={acronym} user={user} />
        )}
        {currentTab === 'seo' && (
          <SEOTab profile={profile} acronym={acronym} />
        )}
        {currentTab === 'market-intel' && (
          <CompetitiveIntelTab acronym={acronym} />
        )}
        {currentTab === 'demographics' && (
          <DemographicsTab acronym={acronym} />
        )}
        {currentTab === 'overlay-test' && (
          <div style={{ height: '700px' }}>
            <OverlayTestTab acronym={acronym} />
          </div>
        )}
        {currentTab === 'gbp' && (
          <GBPTab profile={profile} acronym={acronym} user={user} />
        )}
        {currentTab === 'crm' && (
          <CRMTab
            profile={profile}
            acronym={acronym}
            funnelByLocation={funnelByLocation}
            funnelAggregate={funnelAggregate}
            locations={locations}
            gbpLocations={gbpLocations}
            onRefresh={load}
          />
        )}
        {currentTab === 'blueprint' && (
          <BlueprintTab profile={profile} />
        )}
        {currentTab === 'paidmedia' && (
          <PaidMediaTab profile={profile} />
        )}
        {currentTab === 'contacts' && (
          <ContactsTab profile={profile} gbpLocations={gbpLocations} />
        )}
        {currentTab === 'notes' && (
          <NotesTab profile={profile} acronym={acronym} />
        )}
        {currentTab === 'meetings' && (
          <MeetingsTab acronym={acronym} profile={profile} />
        )}
      </div>

      {/* ── Admin: raw data ─────────────────────────────────────────────── */}
      <RawDataSection profile={profile} user={user} />
    </div>
  )
}
