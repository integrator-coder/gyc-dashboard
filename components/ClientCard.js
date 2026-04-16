'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ResponsiveContainer,
  LineChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'

// ── Formatters ────────────────────────────────────────────────────────────────

function fmt$(v) {
  if (v == null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(Number(v))
}

function fmtDate(v) {
  if (!v) return '—'
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
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

function fmtMonth(v) {
  if (!v) return '—'
  const [y, m] = String(v).split('-')
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(
      new Date(Number(y), Number(m) - 1, 1)
    )
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

function StatBox({ label, value, sub, warn, big }) {
  return (
    <Card>
      <div className="text-[11px] uppercase tracking-wider text-gray-400">{label}</div>
      <div className={`mt-1 font-bold ${big ? 'text-3xl' : 'text-xl'} ${warn ? 'text-rose-300' : 'text-white'}`}>
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

function ServiceTile({ icon, label, active }) {
  return (
    <div
      className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center ${
        active
          ? 'border-violet-500/40 bg-violet-500/15 text-violet-200'
          : 'border-[var(--brand-border)] bg-black/20 text-gray-600'
      }`}
    >
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

function OverviewTab({ profile, funnelHistory, allCalls, potentialUnlinkedCount }) {
  // API returns DESC order (latest first) — index 0 is most recent month
  const latestMonth  = funnelHistory.length > 0 ? funnelHistory[0] : null
  // For charts, reverse to chronological order
  const funnelHistoryAsc = [...funnelHistory].reverse()
  const hasFunnel    = funnelHistory.length > 0 || profile.funnelDataMonths > 0

  const alerts = []
  if (profile.isOverdue)           alerts.push({ icon: '⚠️', msg: 'Overdue balance outstanding', color: 'border-rose-500/30 bg-rose-500/10 text-rose-300' })
  if (profile.funnelTrend === 'down') alerts.push({ icon: '📉', msg: 'Funnel trending down (leads or tours decreasing)', color: 'border-amber-500/30 bg-amber-500/10 text-amber-300' })
  if (potentialUnlinkedCount > 0)  alerts.push({ icon: '🔎', msg: `${potentialUnlinkedCount} potential unlinked call${potentialUnlinkedCount !== 1 ? 's' : ''} — review in Call Intelligence`, color: 'border-amber-500/30 bg-amber-500/10 text-amber-300' })

  return (
    <div className="space-y-6">
      {/* Alerts strip */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div key={i} className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm ${a.color}`}>
              <span>{a.icon}</span> {a.msg}
            </div>
          ))}
        </div>
      )}

      {/* Health score */}
      <div>
        <SectionTitle>Client Health</SectionTitle>
        <Card>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-300">Health Score</span>
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
            <StatBox label="Leads" value={latestMonth ? fmtNum(latestMonth.leads) : '—'} big />
            <StatBox label="Tours" value={latestMonth ? fmtNum(latestMonth.tours) : '—'} big />
            <StatBox label="Registrations" value={latestMonth ? fmtNum(latestMonth.registered) : '—'} big />
          </div>
        )}
      </div>

      {/* Conversion Rate Cards — Current Month */}
      {hasFunnel && latestMonth && (() => {
        const leads      = Number(latestMonth.leads)      || 0
        const tours      = Number(latestMonth.tours)      || 0
        const registered = Number(latestMonth.registered) || 0
        const tourRate  = leads > 0 ? `${(tours      / leads * 100).toFixed(1)}%` : '—'
        const closeRate = tours > 0 ? `${(registered / tours * 100).toFixed(1)}%` : '—'
        const convRate  = leads > 0 ? `${(registered / leads * 100).toFixed(1)}%` : '—'
        return (
          <div>
            <SectionTitle>
              Conversion Rates
              <span className="ml-2 normal-case text-[10px] font-normal text-gray-500">({fmtMonth(latestMonth.month)})</span>
            </SectionTitle>
            <div className="grid grid-cols-3 gap-3">
              <Card>
                <div className="text-[11px] uppercase tracking-wider text-gray-400">Tour Rate</div>
                <div className="mt-1 font-bold text-xl" style={{ color: '#06b6d4' }}>{tourRate}</div>
                <div className="mt-0.5 text-xs text-gray-400">Leads that booked a tour</div>
              </Card>
              <Card>
                <div className="text-[11px] uppercase tracking-wider text-gray-400">Closing Rate</div>
                <div className="mt-1 font-bold text-xl" style={{ color: '#8b5cf6' }}>{closeRate}</div>
                <div className="mt-0.5 text-xs text-gray-400">Tours that enrolled</div>
              </Card>
              <Card>
                <div className="text-[11px] uppercase tracking-wider text-gray-400">Conversion Rate</div>
                <div className="mt-1 font-bold text-xl" style={{ color: '#C19C46' }}>{convRate}</div>
                <div className="mt-0.5 text-xs text-gray-400">Lead to enrollment</div>
              </Card>
            </div>
          </div>
        )
      })()}

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

      {/* Avg conversion rates */}
      {hasFunnel && (
        <div>
          <SectionTitle>Conversion Rates (12-mo avg)</SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatBox label="Avg Leads/mo"    value={fmtNum(profile.avgMonthlyLeads)} />
            <StatBox label="Avg Tours/mo"    value={fmtNum(profile.avgMonthlyTours)} />
            <StatBox label="Avg Enrollments" value={fmtNum(profile.avgMonthlyRegistered)} />
            <StatBox label="Lead→Tour"        value={profile.leadToTourRate != null ? fmtPct(Number(profile.leadToTourRate)) : '—'} />
          </div>
        </div>
      )}

      {/* Services */}
      <div>
        <SectionTitle>Active Services</SectionTitle>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          <ServiceTile icon="🌐" label="Website"    active={!!profile.hasWebsite} />
          <ServiceTile icon="📈" label="SEO"        active={!!profile.hasSEO} />
          <ServiceTile icon="🤝" label="CRM"        active={!!profile.hasCRM} />
          <ServiceTile icon="📊" label="Blueprint"  active={!!profile.hasBlueprint} />
          <ServiceTile icon="📢" label="Google Ads" active={!!profile.hasGoogleAds} />
          <ServiceTile icon="💰" label="Paid Media" active={!!profile.hasPaidMedia} />
        </div>
        {profile.serviceList?.length > 0 && (
          <div className="mt-2 text-xs text-gray-500">Services: {profile.serviceList.join(' · ')}</div>
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

function FinancialTab({ profile, recentPayments = [] }) {
  const isPIF = profile.lifetimeValue && profile.mrr && Number(profile.lifetimeValue) > Number(profile.mrr) * 10

  return (
    <div className="space-y-6">
      {/* Primary metrics */}
      <div>
        <SectionTitle>Revenue</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatBox label="MRR" value={profile.mrr ? fmt$(profile.mrr) : '—'} big />
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

      {/* Recent Payments */}
      {recentPayments.length > 0 && (
        <div>
          <SectionTitle>Recent Payments</SectionTitle>
          <Card>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #2a1a3e' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: '#9ca3af' }}>Date</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: '#9ca3af' }}>Description</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', color: '#9ca3af' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {recentPayments.map((pmt, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #1a0a2e' }}>
                    <td style={{ padding: '8px 12px', color: '#9ca3af' }}>{pmt.date}</td>
                    <td style={{ padding: '8px 12px', color: '#fff' }}>{pmt.description}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: '#4ade80', fontWeight: 600 }}>
                      ${pmt.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

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

function WebsiteTab({ profile, acronym, user }) {
  const isGYCWebsite = !!profile.hasWebsite
  const websiteUrl   = profile.website || null

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
          <div className="mt-3">
            <PlaceholderBanner icon="📊" message="Google Analytics traffic data — integration pending" />
          </div>
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

      {/* Audit placeholders — always shown */}
      <div>
        <SectionTitle>Quality Audit</SectionTitle>
        <div className="space-y-2">
          <PlaceholderBanner icon="⚡" message="Page speed score — DataForSEO integration pending" />
          <PlaceholderBanner icon="📱" message="Mobile-friendliness check — coming soon" />
          <PlaceholderBanner icon="🔍" message="Technical SEO audit — coming soon" />
        </div>
      </div>
    </div>
  )
}

// ── Tab 4: SEO ────────────────────────────────────────────────────────────────

function SEOTab({ profile }) {
  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>SEO Service Details</SectionTitle>
        <Card>
          <div className="space-y-2.5">
            <InfoRow label="Service level" value={
              profile.serviceList?.find(s => s.toLowerCase().includes('seo')) ||
              (profile.hasSEO ? 'SEO Active' : null)
            } />
            <InfoRow label="Start date"    value={profile.startDate ? fmtDate(profile.startDate) : null} />
            <InfoRow label="Assigned GA"   value={profile.assignedGA} />
          </div>
        </Card>
      </div>

      <div>
        <SectionTitle>Baseline (Before GYC)</SectionTitle>
        <Card>
          <div className="mb-2 text-xs text-gray-500">Captured at onboarding — pre-GYC performance</div>
          <div className="space-y-2.5">
            <InfoRow label="Avg rank"       value="Not captured yet" />
            <InfoRow label="Share of voice" value="Not captured yet" />
            <InfoRow label="Baseline date"  value="Not captured yet" />
          </div>
        </Card>
      </div>

      <div>
        <SectionTitle>Current Performance</SectionTitle>
        <PlaceholderBanner icon="📈" message="Rank tracking data via DataForSEO — integration pending" />
      </div>

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

const INPUT_CLS = 'w-full rounded-lg border border-[var(--brand-border)] bg-black/40 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-violet-500/50 focus:outline-none'
const BTN_CLS   = 'rounded-xl border border-violet-500/40 bg-violet-500/15 px-4 py-2 text-sm font-medium text-violet-300 hover:bg-violet-500/25 disabled:opacity-50 transition'
const BTN_SM    = 'rounded-lg border border-[var(--brand-border)] bg-black/30 px-3 py-1.5 text-xs font-medium text-gray-300 hover:border-violet-500/40 hover:text-violet-300 transition'

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

  function setAuditField(field, value) {
    setAuditForm(prev => ({ ...prev, [field]: value }))
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

      {/* Locations */}
      {!gbpLoading && !gbpErr && gbpData?.locations?.map(loc => {
        const isAuditing = activeAuditLocationId === loc.id
        const histOpen   = expandedHistory === loc.id
        const lastAudit  = loc.lastAudit

        return (
          <div key={loc.id} className="rounded-2xl border border-[var(--brand-border)] bg-black/20 overflow-hidden">

            {/* Location header row */}
            <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-[var(--brand-border)]">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-white truncate">{loc.name}</div>
                {loc.address && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    {[loc.address, loc.city, loc.state].filter(Boolean).join(', ')}
                  </div>
                )}
                {loc.gbpUrl && (
                  <a href={loc.gbpUrl} target="_blank" rel="noreferrer"
                     className="text-xs text-violet-400 hover:underline mt-0.5 block">
                    View on Google ↗
                  </a>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => isAuditing ? setActiveAuditLocationId(null) : openAuditForm(loc)}
                  className={BTN_SM}
                >
                  {isAuditing ? 'Cancel Audit' : 'Run Audit'}
                </button>
                {isAdmin && (
                  <button className={BTN_SM} disabled title="Edit — coming soon">Edit</button>
                )}
              </div>
            </div>

            {/* Last audit summary */}
            <div className="px-4 py-2.5 text-xs text-gray-400 flex flex-wrap gap-x-4 gap-y-1">
              {lastAudit ? (
                <>
                  <span>
                    Last audit: <GbpScoreBadge score={lastAudit.score} />{' '}
                    <span className="text-gray-500">— {fmtDate(lastAudit.createdAt)}</span>
                  </span>
                  {lastAudit.avgRating != null && (
                    <span>⭐ {Number(lastAudit.avgRating).toFixed(1)}{lastAudit.reviewCount != null ? ` (${lastAudit.reviewCount} reviews)` : ''}</span>
                  )}
                  {lastAudit.photoCount != null && (
                    <span>📸 {lastAudit.photoCount} photos</span>
                  )}
                </>
              ) : (
                <span className="text-gray-600">No audits yet</span>
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
                <div className="px-4 pb-4">
                  {!loc.auditHistory?.length ? (
                    <div className="text-xs text-gray-600">No audit history yet.</div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-[var(--brand-border)]">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-[var(--brand-border)] text-gray-500">
                            <th className="px-3 py-2 text-left font-medium">Date</th>
                            <th className="px-3 py-2 text-left font-medium">Trigger</th>
                            <th className="px-3 py-2 text-left font-medium">Score</th>
                            <th className="px-3 py-2 text-left font-medium">Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loc.auditHistory.slice(0, 5).map(audit => (
                            <tr key={audit.id} className="border-b border-[var(--brand-border)]/50 hover:bg-white/5">
                              <td className="px-3 py-2 text-gray-300 whitespace-nowrap">{fmtDate(audit.createdAt)}</td>
                              <td className="px-3 py-2 text-gray-400 capitalize">{(audit.triggerType || '').replace(/-/g, ' ')}</td>
                              <td className="px-3 py-2"><GbpScoreBadge score={audit.score} /></td>
                              <td className="px-3 py-2 text-gray-500 max-w-[200px] truncate">{audit.notes || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}

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

function CRMTab({ profile, acronym, funnelByLocation = [], locations = [], funnelAggregate = [] }) {
  const [openLocs, setOpenLocs] = useState(locations.length > 0 ? [locations[0]] : [])

  function toggleLoc(loc) {
    setOpenLocs(prev => prev.includes(loc) ? prev.filter(l => l !== loc) : [...prev, loc])
  }

  // Group rows by locationName (already DESC by month → index 0 = latest)
  const byLoc = {}
  for (const row of funnelByLocation) {
    if (!byLoc[row.locationName]) byLoc[row.locationName] = []
    byLoc[row.locationName].push(row)
  }

  function getLatest(loc) { return (byLoc[loc] || [])[0] || null }
  function getLast12(loc)  { return (byLoc[loc] || []).slice(0, 12).reverse() }

  return (
    <div className="space-y-6">

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

      {/* ── Section 2 + 3: Location Data ── */}
      {locations.length === 0 ? (
        <div>
          <SectionTitle>Location Data</SectionTitle>
          <Empty>No location data available yet.</Empty>
        </div>
      ) : (
        <>
          {/* Section 2: Locations Summary */}
          <div>
            <SectionTitle>
              Locations — {funnelByLocation[0] ? (() => {
                const [y, m] = funnelByLocation[0].month.split('-')
                return new Date(parseInt(y), parseInt(m)-1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
              })() : 'Latest Month'}
            </SectionTitle>
            <div className="overflow-x-auto rounded-2xl border border-[var(--brand-border)] bg-black/20">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-left text-[11px] uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-2.5">Location</th>
                    <th className="px-3 py-2.5 text-center" style={{ color: '#6366f1' }}>Leads</th>
                    <th className="px-3 py-2.5 text-center" style={{ color: '#C19C46' }}>Tours</th>
                    <th className="px-3 py-2.5 text-center" style={{ color: '#10b981' }}>Enrolled</th>
                    <th className="px-3 py-2.5 text-center" style={{ color: '#06b6d4' }}>Tour Rate</th>
                    <th className="px-3 py-2.5 text-center" style={{ color: '#731494' }}>Close Rate</th>
                    <th className="px-3 py-2.5 text-center" style={{ color: '#C19C46' }}>Conv Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {locations.map(loc => {
                    const r = getLatest(loc)
                    return (
                      <tr key={loc} className="hover:bg-white/[0.02] transition">
                        <td className="px-4 py-2.5 font-semibold text-white">{loc}</td>
                        <td className="px-3 py-2.5 text-center" style={{ color: '#6366f1' }}>{r ? r.leads : '—'}</td>
                        <td className="px-3 py-2.5 text-center" style={{ color: '#C19C46' }}>{r ? r.tours : '—'}</td>
                        <td className="px-3 py-2.5 text-center" style={{ color: '#10b981' }}>{r ? r.registered : '—'}</td>
                        <td className="px-3 py-2.5 text-center" style={{ color: '#06b6d4' }}>{r ? `${r.tourRate}%` : '—'}</td>
                        <td className="px-3 py-2.5 text-center" style={{ color: '#731494' }}>{r ? `${r.closeRate}%` : '—'}</td>
                        <td className="px-3 py-2.5 text-center" style={{ color: '#C19C46' }}>{r ? `${r.convRate}%` : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Trendlines per Location */}
          <div>
            <SectionTitle>Location Trendlines</SectionTitle>
            <div className="space-y-3">
              {locations.map((loc) => {
                const isOpen = openLocs.includes(loc)
                const data12 = getLast12(loc)
                return (
                  <div key={loc} className="overflow-hidden rounded-2xl border border-[var(--brand-border)] bg-black/20">
                    <button
                      onClick={() => toggleLoc(loc)}
                      className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-white/5"
                    >
                      <span className="font-semibold text-white">{loc}</span>
                      <span className={`text-lg text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}>›</span>
                    </button>
                    {isOpen && (
                      <div className="border-t border-[var(--brand-border)] px-4 pb-4 pt-3">
                        {data12.length === 0 ? (
                          <Empty>No trend data for this location.</Empty>
                        ) : (
                          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                            {/* Volume bar chart */}
                            <div>
                              <div className="mb-2 text-xs font-medium text-gray-400">Volume — Leads / Tours / Enrolled</div>
                              <div style={{ height: 200 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={data12} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
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
                            {/* Rate line chart */}
                            <div>
                              <div className="mb-2 text-xs font-medium text-gray-400">Rates — Tour / Close / Conversion</div>
                              <div style={{ height: 200 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                  <LineChart data={data12} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
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
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
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
            <InfoRow label="Avg tuition"   value={profile.avgTuition ? fmt$(profile.avgTuition) : null} />
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

// ── Tab 9: Notes ──────────────────────────────────────────────────────────────

function NotesTab({ profile, acronym }) {
  return (
    <div className="space-y-6">
      <EditableNotes
        label="Team Notes"
        value={profile.teamNotes}
        field="teamNotes"
        acronym={acronym}
        placeholder="Add internal notes for the team — strategy decisions, known issues, context…"
      />

      {/* Notion contact notes (read-only) */}
      {profile.notes && (
        <div>
          <SectionTitle>Notion Contact Notes <span className="normal-case font-normal text-gray-600">(read-only, from Notion)</span></SectionTitle>
          <Card>
            <pre className="whitespace-pre-wrap text-sm text-gray-300 leading-relaxed">{profile.notes}</pre>
          </Card>
        </div>
      )}

      {/* Timestamps */}
      <div className="text-xs text-gray-600 space-y-1">
        {profile.lastEnrichedAt && <div>Last synced: {fmtDate(profile.lastEnrichedAt)}</div>}
        {profile.updatedAt      && <div>Profile updated: {fmtDate(profile.updatedAt)}</div>}
        {profile.notionPageId   && <div>Notion page ID: <span className="font-mono">{profile.notionPageId}</span></div>}
      </div>
    </div>
  )
}

// ── Tab 10: Calls ─────────────────────────────────────────────────────────────

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
              These calls have participant emails matching this client but aren't linked yet.{' '}
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
            className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold transition ${
              activeTab === tab.key
                ? 'bg-violet-600 text-white shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
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
    potentialUnlinkedCount = 0,
    recentPayments = [],
  } = data

  // ── Build visible tabs ───────────────────────────────────────────────────
  const ALL_TABS = [
    { key: 'overview',   label: 'Overview',              show: true },
    { key: 'financial',  label: 'Financial',             show: true },
    { key: 'gbp',        label: 'GBP',                   show: !!profile.hasSEO },
    { key: 'website',    label: 'Website',               show: true },                             // always visible
    { key: 'seo',        label: 'SEO',                   show: !!profile.hasSEO },
    { key: 'crm',        label: 'CRM',                   show: !!profile.hasCRM },
    { key: 'blueprint',  label: 'Blueprint',             show: !!profile.hasBlueprint },
    { key: 'paidmedia',  label: 'Paid Media',            show: !!(profile.hasGoogleAds || profile.hasPaidMedia) },
    { key: 'notes',      label: 'Notes',                 show: true },
    { key: 'calls',      label: `Calls (${allCalls.length})`, show: true },
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
          />
        )}
        {currentTab === 'financial' && (
          <FinancialTab profile={profile} recentPayments={recentPayments} />
        )}
        {currentTab === 'website' && (
          <WebsiteTab profile={profile} acronym={acronym} user={user} />
        )}
        {currentTab === 'seo' && (
          <SEOTab profile={profile} />
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
          />
        )}
        {currentTab === 'blueprint' && (
          <BlueprintTab profile={profile} />
        )}
        {currentTab === 'paidmedia' && (
          <PaidMediaTab profile={profile} />
        )}
        {currentTab === 'notes' && (
          <NotesTab profile={profile} acronym={acronym} />
        )}
        {currentTab === 'calls' && (
          <CallsTab
            profile={profile}
            allCalls={allCalls}
            pendingCalls={pendingCalls}
            potentialUnlinkedCount={potentialUnlinkedCount}
          />
        )}
      </div>

      {/* ── Admin: raw data ─────────────────────────────────────────────── */}
      <RawDataSection profile={profile} user={user} />
    </div>
  )
}
