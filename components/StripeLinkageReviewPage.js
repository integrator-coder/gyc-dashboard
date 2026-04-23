'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'

const FILTERS = [
  { key: 'open', label: 'Open queue' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'all', label: 'All cases' },
]

const REASON_LABELS = {
  shared_legacy: 'Shared legacy Stripe customer',
  ambiguous_candidate: 'Ambiguous candidate',
  email_only_candidate: 'Email-only match',
  multi_live_profile: 'Multi-live normalized links',
}

const REVIEW_LABELS = {
  pending: 'Open',
  resolved: 'Resolved',
  primary: 'Primary set',
  shared: 'Marked shared',
  'legacy-needs-review': 'Needs Lex',
  'not-a-match': 'No match',
  reopen: 'Reopened',
}

function fmtMoney(value) {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(Number(value))
}

function fmtDateTime(value) {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value))
  } catch {
    return '—'
  }
}

function compactStripeLabel(stripe) {
  return stripe?.companyName || stripe?.name || stripe?.email || stripe?.id || 'Unknown Stripe customer'
}

function reviewTone(review) {
  if (!review) return 'border-amber-500/30 bg-amber-500/10 text-amber-200'
  if (review.reviewStatus === 'resolved') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
  return 'border-amber-500/30 bg-amber-500/10 text-amber-200'
}

function severityTone(severity) {
  if (severity === 'high') return 'border-rose-500/35 bg-rose-500/10 text-rose-200'
  if (severity === 'medium') return 'border-amber-500/35 bg-amber-500/10 text-amber-200'
  return 'border-slate-500/30 bg-slate-500/10 text-slate-200'
}

function signalTone(signal) {
  if (signal === 'ghl' || signal === 'legacy') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200'
  if (signal === 'company' || signal === 'acronym') return 'border-violet-500/25 bg-violet-500/10 text-violet-200'
  if (signal === 'email') return 'border-sky-500/25 bg-sky-500/10 text-sky-200'
  return 'border-slate-500/25 bg-slate-500/10 text-slate-200'
}

function StatusPill({ children, className = '' }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${className}`}>{children}</span>
}

function ActionButton({ children, className = '', busy = false, ...props }) {
  return (
    <button
      {...props}
      disabled={busy || props.disabled}
      className={`rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {busy ? 'Saving…' : children}
    </button>
  )
}

function InvoiceList({ invoices = [] }) {
  if (!invoices.length) return null

  return (
    <div className="space-y-2 rounded-2xl border border-white/10 bg-black/25 p-3">
      <div className="text-[10px] uppercase tracking-[0.22em] text-gray-400">Recent invoices</div>
      {invoices.map((invoice) => (
        <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-300">
          <div className="min-w-0">
            <div className="font-medium text-white">{invoice.description || invoice.id}</div>
            <div className="text-gray-400">{fmtDateTime(invoice.invoiceCreatedAt)}</div>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill className={invoice.paid ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200' : 'border-amber-500/25 bg-amber-500/10 text-amber-200'}>
              {invoice.status || (invoice.paid ? 'paid' : 'open')}
            </StatusPill>
            <span className="font-semibold text-white">{fmtMoney(invoice.amountPaid || invoice.amountDue || 0)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function CandidateStripeCard({ stripe, signals = [], score = null, confidence = null, isPrimary = false, linkMeta = null, onDecision, busy }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold text-white">{compactStripeLabel(stripe)}</div>
            <StatusPill className={isPrimary ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-slate-500/25 bg-slate-500/10 text-slate-200'}>
              {isPrimary ? 'Primary link' : 'Candidate'}
            </StatusPill>
            {linkMeta?.linkSource ? <StatusPill className="border-violet-500/25 bg-violet-500/10 text-violet-200">{linkMeta.linkSource}</StatusPill> : null}
          </div>
          <div className="mt-1 text-xs text-gray-400">{stripe.id}</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-white">{fmtMoney(stripe.mrr)}</div>
          <div className="text-xs text-gray-400">{stripe.status || 'unknown'}</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {signals.map((signal) => (
          <StatusPill key={signal} className={signalTone(signal)}>{signal}</StatusPill>
        ))}
        {score != null ? <StatusPill className="border-white/10 bg-white/5 text-gray-200">score {score}</StatusPill> : null}
        {confidence ? <StatusPill className="border-white/10 bg-white/5 text-gray-200">{confidence}</StatusPill> : null}
      </div>

      {stripe.email ? <div className="mt-3 text-xs text-gray-300">Email: <span className="text-white">{stripe.email}</span></div> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <ActionButton busy={busy} onClick={() => onDecision('primary', stripe.id)} className="border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20">
          Set primary link
        </ActionButton>
        <ActionButton busy={busy} onClick={() => onDecision('shared', stripe.id)} className="border-sky-500/30 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20">
          Mark shared
        </ActionButton>
        <a href={`https://dashboard.stripe.com/customers/${stripe.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-gray-200 transition hover:border-violet-400/30 hover:text-white">
          Open in Stripe ↗
        </a>
      </div>

      <div className="mt-4">
        <InvoiceList invoices={stripe.recentInvoices || []} />
      </div>
    </div>
  )
}

function SharedLegacyClientRow({ profile, stripe, onDecision, busy }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold text-white">{profile.companyName || profile.acronym || `Client ${profile.id}`}</div>
            {profile.acronym ? <StatusPill className="border-violet-500/25 bg-violet-500/10 text-violet-200">{profile.acronym}</StatusPill> : null}
          </div>
          <div className="mt-1 text-xs text-gray-400">{profile.email || 'No profile email on file'}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton busy={busy} onClick={() => onDecision('primary', stripe.id, profile.id)} className="border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20">
            Make primary
          </ActionButton>
          <ActionButton busy={busy} onClick={() => onDecision('shared', stripe.id, profile.id)} className="border-sky-500/30 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20">
            Keep shared
          </ActionButton>
          {profile.clientHref ? (
            <Link href={profile.clientHref} className="inline-flex items-center rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-gray-200 transition hover:border-violet-400/30 hover:text-white">
              Open client ↗
            </Link>
          ) : null}
        </div>
      </div>

      {profile.linksToSharedStripe?.length ? (
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {profile.linksToSharedStripe.map((link, index) => (
            <StatusPill key={`${profile.id}-${index}`} className={link.isPrimary ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-white/10 bg-white/5 text-gray-200'}>
              {link.isPrimary ? 'Currently primary' : 'Currently linked'}
              {link.matchScore != null ? ` · ${link.matchScore}` : ''}
            </StatusPill>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function ReviewCaseCard({ item, onDecision }) {
  const [notes, setNotes] = useState(item.review?.notes || '')
  const [busyKey, setBusyKey] = useState('')

  useEffect(() => {
    setNotes(item.review?.notes || '')
  }, [item.caseKey, item.review?.notes])

  const handleDecision = async ({ resolution, stripeCustomerId = null, clientProfileId = null }) => {
    const label = resolution === 'primary'
      ? 'set this as the primary normalized Stripe link'
      : resolution === 'shared'
        ? 'mark this as a shared Stripe relationship'
        : resolution === 'legacy-needs-review'
          ? 'mark this case as needing Lex review'
          : resolution === 'not-a-match'
            ? 'mark this case as not a match'
            : resolution === 'reopen'
              ? 'reopen this case'
              : 'resolve this case'

    if (typeof window !== 'undefined' && !window.confirm(`Confirm: ${label}?`)) return

    setBusyKey(`${resolution}:${stripeCustomerId || clientProfileId || 'case'}`)
    try {
      await onDecision({
        caseKey: item.caseKey,
        reason: item.reason,
        clientProfileId: clientProfileId ?? item.subjectClient?.id ?? item.review?.clientProfileId ?? null,
        stripeCustomerId,
        resolution,
        notes,
      })
    } finally {
      setBusyKey('')
    }
  }

  const reviewLabel = item.review?.resolution
    ? REVIEW_LABELS[item.review.resolution] || item.review.resolution
    : REVIEW_LABELS[item.review?.reviewStatus] || 'Open'

  return (
    <div className="rounded-3xl border border-[var(--brand-border)] bg-[radial-gradient(circle_at_top_left,#1a1024,transparent_55%),var(--brand-bg-card)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill className={severityTone(item.severity)}>{item.reasonLabel || REASON_LABELS[item.reason] || item.reason}</StatusPill>
            <StatusPill className={reviewTone(item.review)}>{reviewLabel}</StatusPill>
            {item.review?.updatedAt ? <StatusPill className="border-white/10 bg-white/5 text-gray-200">Updated {fmtDateTime(item.review.updatedAt)}</StatusPill> : null}
          </div>
          <h3 className="mt-3 text-xl font-bold text-white">{item.title}</h3>
          <p className="mt-2 max-w-3xl text-sm text-gray-300">{item.recommendedAction}</p>
        </div>
        <div className="grid min-w-[220px] gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.22em] text-gray-400">Candidate MRR</div>
            <div className="mt-2 text-lg font-bold text-white">{fmtMoney(item.candidateMrr || 0)}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.22em] text-gray-400">Status</div>
            <div className="mt-2 text-sm font-semibold text-white">{item.review?.updatedBy || 'Unreviewed'}</div>
          </div>
        </div>
      </div>

      {item.subjectClient ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-gray-300">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-white">{item.subjectClient.companyName || item.subjectClient.acronym || `Client ${item.subjectClient.id}`}</span>
            {item.subjectClient.acronym ? <StatusPill className="border-violet-500/25 bg-violet-500/10 text-violet-200">{item.subjectClient.acronym}</StatusPill> : null}
            <StatusPill className="border-white/10 bg-white/5 text-gray-200">Profile MRR {fmtMoney(item.subjectClient.mrr || 0)}</StatusPill>
            {item.subjectClient.stripeCustomerId ? <StatusPill className="border-white/10 bg-white/5 text-gray-200">Legacy {item.subjectClient.stripeCustomerId}</StatusPill> : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-xs text-gray-400">
            <span>{item.subjectClient.email || 'No profile email'}</span>
            {item.subjectClient.clientHref ? <Link href={item.subjectClient.clientHref} className="text-violet-300 hover:text-violet-200">Open client card ↗</Link> : null}
          </div>
        </div>
      ) : null}

      {item.reason === 'shared_legacy' ? (
        <div className="mt-5 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Shared Stripe customer</div>
                <div className="mt-1 text-xs text-gray-400">{item.stripe?.id}</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-white">{fmtMoney(item.stripe?.mrr || 0)}</div>
                <div className="text-xs text-gray-400">{item.stripe?.status || 'unknown'}</div>
              </div>
            </div>
            <div className="mt-2 text-sm text-gray-300">{compactStripeLabel(item.stripe)}</div>
            <div className="mt-4">
              <InvoiceList invoices={item.stripe?.recentInvoices || []} />
            </div>
          </div>

          <div className="space-y-3">
            {item.clients?.map((profile) => (
              <SharedLegacyClientRow
                key={profile.id}
                profile={profile}
                stripe={item.stripe}
                busy={busyKey.includes(item.stripe?.id || '')}
                onDecision={(resolution, stripeCustomerId, clientProfileId) => handleDecision({ resolution, stripeCustomerId, clientProfileId })}
              />
            ))}
          </div>
        </div>
      ) : null}

      {item.reason === 'multi_live_profile' ? (
        <div className="mt-5 space-y-3">
          {item.links?.map((link) => (
            <CandidateStripeCard
              key={link.stripeCustomerId}
              stripe={link.stripe}
              signals={link.matchSignals || []}
              score={link.matchScore}
              confidence={link.matchConfidence}
              isPrimary={link.isPrimary}
              linkMeta={link}
              busy={busyKey.includes(link.stripeCustomerId)}
              onDecision={(resolution, stripeCustomerId) => handleDecision({ resolution, stripeCustomerId, clientProfileId: item.subjectClient?.id })}
            />
          ))}
        </div>
      ) : null}

      {(item.reason === 'ambiguous_candidate' || item.reason === 'email_only_candidate') ? (
        <div className="mt-5 space-y-3">
          {item.candidates?.map((candidate) => (
            <CandidateStripeCard
              key={candidate.stripe.id}
              stripe={candidate.stripe}
              signals={candidate.signals || candidate.reasons || []}
              score={candidate.score}
              confidence={candidate.confidence}
              busy={busyKey.includes(candidate.stripe.id)}
              onDecision={(resolution, stripeCustomerId) => handleDecision({ resolution, stripeCustomerId, clientProfileId: item.subjectClient?.id })}
            />
          ))}
        </div>
      ) : null}

      <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
        <div className="text-[10px] uppercase tracking-[0.22em] text-gray-400">Review notes</div>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          className="mt-3 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-500 focus:border-violet-400/40"
          placeholder="What did Todd / Lex decide here?"
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <ActionButton busy={busyKey.includes('legacy-needs-review')} onClick={() => handleDecision({ resolution: 'legacy-needs-review', stripeCustomerId: item.stripe?.id || item.review?.stripeCustomerId || null })} className="border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20">
            Needs Lex review
          </ActionButton>
          <ActionButton busy={busyKey.includes('not-a-match')} onClick={() => handleDecision({ resolution: 'not-a-match', stripeCustomerId: item.review?.stripeCustomerId || null })} className="border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20">
            No match
          </ActionButton>
          <ActionButton busy={busyKey.includes('reopen')} onClick={() => handleDecision({ resolution: 'reopen', stripeCustomerId: item.review?.stripeCustomerId || null })} className="border-white/10 bg-white/5 text-gray-200 hover:border-violet-400/30 hover:text-white">
            Reopen
          </ActionButton>
        </div>
      </div>
    </div>
  )
}

function StripeLinkageReviewQueue({ acronym = null, compact = false, title = 'Stripe linkage review queue', intro = '', emptyCopy = 'No finance linkage review cases are open right now.' }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState(acronym ? 'all' : 'open')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('includeResolved', '1')
      if (acronym) params.set('acronym', acronym)
      const res = await fetch(`/api/finance/stripe-linkage-review?${params.toString()}`, { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Failed to load linkage review queue.')
      setData(json)
      setError('')
    } catch (err) {
      setError(err.message || 'Failed to load linkage review queue.')
    } finally {
      setLoading(false)
    }
  }, [acronym])

  useEffect(() => {
    load()
  }, [load])

  const handleDecision = useCallback(async (payload) => {
    const res = await fetch('/api/finance/stripe-linkage-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json.error || 'Failed to save review decision.')
    await load()
  }, [load])

  const cases = useMemo(() => {
    const items = data?.cases || []
    const needle = query.trim().toLowerCase()

    return items.filter((item) => {
      const isResolved = item.review?.reviewStatus === 'resolved'
      if (filter === 'open' && isResolved) return false
      if (filter === 'resolved' && !isResolved) return false
      if (!needle) return true

      const haystack = [
        item.title,
        item.reasonLabel,
        item.subjectClient?.companyName,
        item.subjectClient?.acronym,
        item.subjectClient?.email,
        item.stripe?.id,
        item.stripe?.companyName,
        ...(item.clients || []).flatMap((client) => [client.companyName, client.acronym, client.email]),
        ...(item.candidates || []).flatMap((candidate) => [candidate.stripe?.companyName, candidate.stripe?.email, candidate.stripe?.id]),
        ...(item.links || []).flatMap((link) => [link.stripe?.companyName, link.stripe?.email, link.stripe?.id]),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(needle)
    })
  }, [data?.cases, filter, query])

  if (loading) {
    return <div className="rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-bg-card)] p-6 text-sm text-gray-400">Loading linkage review queue…</div>
  }

  if (error) {
    return <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
  }

  const summary = data?.summary || { open: 0, resolved: 0, total: 0, openByReason: {} }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-violet-300">Finance operations</div>
          <h1 className={`${compact ? 'text-xl' : 'text-3xl'} mt-2 font-bold text-white`}>{title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-400">{intro || 'Review unresolved Stripe linkage cases, inspect evidence, and stage decisions before tomorrow’s finance walkthrough.'}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={load} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-gray-200 transition hover:border-violet-400/30 hover:text-white">Refresh</button>
          {!acronym ? (
            <Link href="/finance" className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-gray-200 transition hover:border-violet-400/30 hover:text-white">Back to Finance</Link>
          ) : null}
        </div>
      </div>

      <div className={`grid gap-4 ${compact ? 'md:grid-cols-2 xl:grid-cols-4' : 'md:grid-cols-2 xl:grid-cols-5'}`}>
        <div className="rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-bg-card)] p-4">
          <div className="text-[11px] uppercase tracking-[0.22em] text-gray-400">Open queue</div>
          <div className="mt-2 text-3xl font-black text-white">{summary.open || 0}</div>
        </div>
        <div className="rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-bg-card)] p-4">
          <div className="text-[11px] uppercase tracking-[0.22em] text-gray-400">Resolved</div>
          <div className="mt-2 text-3xl font-black text-white">{summary.resolved || 0}</div>
        </div>
        <div className="rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-bg-card)] p-4">
          <div className="text-[11px] uppercase tracking-[0.22em] text-gray-400">Shared legacy</div>
          <div className="mt-2 text-3xl font-black text-white">{summary.openByReason?.shared_legacy || summary.byReason?.shared_legacy || 0}</div>
        </div>
        <div className="rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-bg-card)] p-4">
          <div className="text-[11px] uppercase tracking-[0.22em] text-gray-400">Ambiguous</div>
          <div className="mt-2 text-3xl font-black text-white">{summary.openByReason?.ambiguous_candidate || summary.byReason?.ambiguous_candidate || 0}</div>
        </div>
        <div className="rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-bg-card)] p-4">
          <div className="text-[11px] uppercase tracking-[0.22em] text-gray-400">Email-only</div>
          <div className="mt-2 text-3xl font-black text-white">{summary.openByReason?.email_only_candidate || summary.byReason?.email_only_candidate || 0}</div>
        </div>
      </div>

      <div className="rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-bg-card)] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((item) => (
              <button
                key={item.key}
                onClick={() => setFilter(item.key)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${filter === item.key ? 'border-violet-500/40 bg-violet-500/15 text-violet-100' : 'border-white/10 bg-black/25 text-gray-300 hover:text-white'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search client, acronym, Stripe customer…"
            className="w-full max-w-xl rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-500 focus:border-violet-400/40"
          />
        </div>
      </div>

      {cases.length === 0 ? (
        <div className="rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-bg-card)] p-8 text-center text-sm text-gray-400">{emptyCopy}</div>
      ) : (
        <div className="space-y-5">
          {cases.map((item) => (
            <ReviewCaseCard key={item.caseKey} item={item} onDecision={handleDecision} />
          ))}
        </div>
      )}
    </div>
  )
}

export function ClientFinanceReviewPanel({ acronym }) {
  return (
    <StripeLinkageReviewQueue
      acronym={acronym}
      compact
      title="Finance linkage review"
      intro="This client has finance-linkage review context tied to the normalized Stripe mapping layer."
      emptyCopy="No unresolved linkage review flags are attached to this client right now."
    />
  )
}

export default function StripeLinkageReviewPage() {
  return <StripeLinkageReviewQueue />
}
