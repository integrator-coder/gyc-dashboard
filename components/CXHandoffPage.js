'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

const GA_OPTIONS = [
  { name: 'Zu Vuong', email: 'zu@growyourcenter.com' },
  { name: 'Sebastian Estrada', email: 'sebastian@growyourcenter.com' },
  { name: 'JC Flores', email: 'jc@growyourcenter.com' },
  { name: 'Stefen Anderson', email: 'stefen@growyourcenter.com' },
  { name: 'Briana Stewart', email: 'briana@growyourcenter.com' },
]

const REVIEW_OPTIONS = [
  { value: 'Confirmed', label: 'Confirmed ✅' },
  { value: 'Clarify', label: 'Clarify ⚠️' },
  { value: 'Incorrect', label: 'Incorrect ❌' },
]

function formatDate(value, includeTime = false) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(includeTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  }).format(new Date(value))
}

function formatDuration(seconds) {
  if (!seconds || Number.isNaN(Number(seconds))) return '—'
  const mins = Math.round(Number(seconds) / 60)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  const remainingMins = mins % 60
  return remainingMins ? `${hours}h ${remainingMins}m` : `${hours}h`
}

function badgeClass(type, value) {
  const normalized = String(value || '').toLowerCase()

  if (type === 'review') {
    if (normalized === 'confirmed') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
    if (normalized === 'clarify') return 'border-amber-500/30 bg-amber-500/10 text-amber-300'
    if (normalized === 'incorrect') return 'border-rose-500/30 bg-rose-500/10 text-rose-300'
  }

  if (type === 'risk') {
    if (normalized === 'none') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
    if (normalized === 'clarify') return 'border-amber-500/30 bg-amber-500/10 text-amber-300'
    return 'border-rose-500/30 bg-rose-500/10 text-rose-300'
  }

  if (type === 'confidence') {
    if (normalized === 'high') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
    if (normalized === 'medium') return 'border-amber-500/30 bg-amber-500/10 text-amber-300'
    if (normalized === 'low') return 'border-rose-500/30 bg-rose-500/10 text-rose-300'
  }

  if (type === 'source') {
    if (normalized === 'ghl') return 'border-sky-500/30 bg-sky-500/10 text-sky-300'
    if (normalized === 'pandadoc') return 'border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300'
    if (normalized === 'zoom') return 'border-violet-500/30 bg-violet-500/10 text-violet-200'
    if (normalized === 'tracker') return 'border-amber-500/30 bg-amber-500/10 text-amber-300'
  }

  return 'border-[var(--brand-border)] bg-black/20 text-gray-300'
}

function groupGapsBySource(gaps) {
  return gaps.reduce((acc, gap) => {
    const key = gap.source || 'Other'
    if (!acc[key]) acc[key] = []
    acc[key].push(gap)
    return acc
  }, {})
}

function hasRole(user, allowedRoles = []) {
  const roles = new Set([...(user?.roles || []), ...(user?.teams || []), user?.role].filter(Boolean).map((value) => String(value).toLowerCase()))
  return allowedRoles.some((role) => roles.has(String(role).toLowerCase()))
}

function tabButtonClass(active) {
  return `rounded-2xl border px-3.5 py-2 text-sm font-medium transition ${active
    ? 'border-violet-400 bg-violet-500/20 text-white'
    : 'border-[var(--brand-border)] bg-black/20 text-gray-300 hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-white'
  }`
}

export default function CXHandoffPage({ user }) {
  const canAccessHandoffs = hasRole(user, ['cx', 'admin'])
  const defaultTab = canAccessHandoffs ? 'handoffs' : 'classify'

  const [activeTab, setActiveTab] = useState(defaultTab)
  const [handoffs, setHandoffs] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [loadingList, setLoadingList] = useState(canAccessHandoffs)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [classifyCalls, setClassifyCalls] = useState([])
  const [selectedCallId, setSelectedCallId] = useState(null)
  const [classifyDrafts, setClassifyDrafts] = useState({})
  const [clientSuggestions, setClientSuggestions] = useState([])
  const [loadingClassify, setLoadingClassify] = useState(true)
  const [loadingClients, setLoadingClients] = useState(true)
  const [assignmentDraft, setAssignmentDraft] = useState('')
  const [promiseDrafts, setPromiseDrafts] = useState({})
  const [gapDrafts, setGapDrafts] = useState({})
  const [savingAssignment, setSavingAssignment] = useState(false)
  const [savingPromises, setSavingPromises] = useState({})
  const [savingGaps, setSavingGaps] = useState({})
  const [savingClassifyId, setSavingClassifyId] = useState('')
  const [qaQuery, setQaQuery] = useState('')
  const [qaResults, setQaResults] = useState([])
  const [qaLoading, setQaLoading] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const loadHandoffs = useCallback(async () => {
    if (!canAccessHandoffs) {
      setHandoffs([])
      setSelectedId(null)
      setDetail(null)
      setLoadingList(false)
      return
    }

    setLoadingList(true)
    try {
      const res = await fetch('/api/cx-handoff', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load handoffs.')
      const next = json.handoffs || []
      setHandoffs(next)
      setSelectedId((current) => (next.some((item) => item.id === current) ? current : next[0]?.id ?? null))
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingList(false)
    }
  }, [canAccessHandoffs])

  const loadClassifyQueue = useCallback(async () => {
    setLoadingClassify(true)
    try {
      const res = await fetch('/api/team/classify', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load classification queue.')
      const calls = json.calls || []
      setClassifyCalls(calls)
      setClassifyDrafts((current) => {
        const next = { ...current }
        for (const call of calls) {
          next[call.id] = {
            clientName: current[call.id]?.clientName ?? call.clientName ?? '',
            acronym: current[call.id]?.acronym ?? call.acronym ?? '',
          }
        }
        return next
      })
      setSelectedCallId((current) => (calls.some((item) => item.id === current) ? current : calls[0]?.id ?? null))
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingClassify(false)
    }
  }, [])

  const loadClientSuggestions = useCallback(async () => {
    setLoadingClients(true)
    try {
      const res = await fetch('/api/team/classify/clients', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load client suggestions.')
      setClientSuggestions(json.clients || [])
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingClients(false)
    }
  }, [])

  const loadDetail = useCallback(async (id) => {
    if (!id || !canAccessHandoffs) return
    setLoadingDetail(true)
    try {
      const res = await fetch(`/api/cx-handoff/${id}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load handoff detail.')
      const handoff = json.handoff
      setDetail(handoff)
      setAssignmentDraft(handoff.assignedGA || '')
      setQaResults([])
      setPromiseDrafts(
        Object.fromEntries(
          (handoff.promiseLedgerItems || []).map((item) => [
            item.id,
            {
              reviewStatus: item.reviewStatus || 'Pending Review',
              reviewComment: item.reviewComment || '',
            },
          ])
        )
      )
      setGapDrafts(
        Object.fromEntries(
          (handoff.dataGaps || []).map((gap) => [
            gap.id,
            {
              resolvedValue: gap.resolvedValue || '',
              filledBy: gap.filledBy || '',
              status: gap.status || 'open',
            },
          ])
        )
      )
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingDetail(false)
    }
  }, [canAccessHandoffs])

  useEffect(() => {
    loadHandoffs()
  }, [loadHandoffs])

  useEffect(() => {
    loadClassifyQueue()
    loadClientSuggestions()
  }, [loadClassifyQueue, loadClientSuggestions])

  useEffect(() => {
    if (selectedId && canAccessHandoffs) loadDetail(selectedId)
    else setDetail(null)
  }, [selectedId, loadDetail, canAccessHandoffs])

  useEffect(() => {
    if (!toast) return undefined
    const timeout = window.setTimeout(() => setToast(''), 2500)
    return () => window.clearTimeout(timeout)
  }, [toast])

  function updatePromiseDraft(promiseId, patch) {
    setPromiseDrafts((current) => ({
      ...current,
      [promiseId]: {
        ...(current[promiseId] || {}),
        ...patch,
      },
    }))
  }

  function updateGapDraft(gapId, patch) {
    setGapDrafts((current) => ({
      ...current,
      [gapId]: {
        ...(current[gapId] || {}),
        ...patch,
      },
    }))
  }

  function updateClassifyDraft(callId, patch) {
    setClassifyDrafts((current) => ({
      ...current,
      [callId]: {
        ...(current[callId] || {}),
        ...patch,
      },
    }))
  }

  function handleSuggestionPick(callId, value) {
    const matched = clientSuggestions.find((item) => `${item.value} (${item.acronym})` === value)
    if (matched) {
      updateClassifyDraft(callId, { clientName: matched.value, acronym: matched.acronym })
    } else {
      updateClassifyDraft(callId, { clientName: value })
    }
  }

  async function runTranscriptSearch(event) {
    event?.preventDefault?.()
    if (!detail) return

    const trimmedQuery = qaQuery.trim()
    if (!trimmedQuery) {
      setQaResults([])
      return
    }

    setQaLoading(true)
    try {
      const res = await fetch(`/api/cx-handoff/${detail.id}/search?q=${encodeURIComponent(trimmedQuery)}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to search transcript.')
      setQaResults(json.results || [])
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setQaLoading(false)
    }
  }

  async function saveAssignment() {
    if (!detail) return
    setSavingAssignment(true)
    try {
      const selected = GA_OPTIONS.find((option) => option.name === assignmentDraft)
      const res = await fetch(`/api/cx-handoff/${detail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedGA: assignmentDraft || null,
          assignedGAEmail: assignmentDraft ? selected?.email || null : null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to save assignment.')
      await Promise.all([loadHandoffs(), loadDetail(detail.id)])
      setToast('GA assignment saved.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingAssignment(false)
    }
  }

  async function savePromiseReview(promiseId) {
    if (!detail) return
    const draft = promiseDrafts[promiseId] || {}
    setSavingPromises((current) => ({ ...current, [promiseId]: true }))
    try {
      const res = await fetch(`/api/cx-handoff/${detail.id}/promises/${promiseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewStatus: draft.reviewStatus,
          reviewComment: draft.reviewComment,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to save promise review.')
      await Promise.all([loadHandoffs(), loadDetail(detail.id)])
      setToast('Promise review saved.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingPromises((current) => ({ ...current, [promiseId]: false }))
    }
  }

  async function saveGap(gapId) {
    if (!detail) return
    const draft = gapDrafts[gapId] || {}
    setSavingGaps((current) => ({ ...current, [gapId]: true }))
    try {
      const res = await fetch(`/api/cx-handoff/${detail.id}/gaps/${gapId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolvedValue: draft.resolvedValue,
          filledBy: draft.filledBy,
          status: draft.status || 'filled',
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to update gap.')
      await Promise.all([loadHandoffs(), loadDetail(detail.id)])
      setToast('Data gap updated.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingGaps((current) => ({ ...current, [gapId]: false }))
    }
  }

  async function saveClassifyCall(callId) {
    const draft = classifyDrafts[callId] || {}
    setSavingClassifyId(callId)
    try {
      const res = await fetch(`/api/team/classify/${callId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: draft.clientName,
          acronym: draft.acronym,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to save classification.')
      await loadClassifyQueue()
      setToast('Call classification saved.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingClassifyId('')
    }
  }

  const selectedSummary = useMemo(() => handoffs.find((item) => item.id === selectedId), [handoffs, selectedId])
  const selectedClassifyCall = useMemo(() => classifyCalls.find((item) => item.id === selectedCallId), [classifyCalls, selectedCallId])
  const groupedGaps = useMemo(() => groupGapsBySource(detail?.dataGaps || []), [detail?.dataGaps])
  const transcriptMap = useMemo(() => new Map((detail?.transcripts || []).map((item) => [item.zoomCallId, item])), [detail?.transcripts])
  const openGapCount = (detail?.dataGaps || []).filter((gap) => gap.status === 'open').length
  const dataListOptions = useMemo(() => clientSuggestions.map((item) => `${item.value} (${item.acronym})`), [clientSuggestions])
  const selectedClassifyDraft = selectedClassifyCall ? (classifyDrafts[selectedClassifyCall.id] || { clientName: '', acronym: '' }) : null

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-violet-300">Team Portal</div>
          <h1 className="mt-2 text-3xl font-bold text-white">CX Handoffs</h1>
          <p className="mt-1 text-sm text-gray-400">Assign the right GA, review sales-call promises, close data gaps, and classify calls from one place.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canAccessHandoffs ? (
            <button onClick={loadHandoffs} className="rounded-2xl border border-[var(--brand-border)] px-4 py-2.5 text-sm font-medium text-gray-300 transition hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-white">
              Refresh handoffs
            </button>
          ) : null}
          <button onClick={loadClassifyQueue} className="rounded-2xl border border-[var(--brand-border)] px-4 py-2.5 text-sm font-medium text-gray-300 transition hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-white">
            Refresh classify queue
          </button>
        </div>
      </div>

      {error ? <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}
      {toast ? <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{toast}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-bg-card)]">
          <div className="border-b border-[var(--brand-border)] px-5 py-4">
            <div className="flex flex-wrap gap-2">
              {canAccessHandoffs ? (
                <button onClick={() => setActiveTab('handoffs')} className={tabButtonClass(activeTab === 'handoffs')}>
                  Handoffs
                </button>
              ) : null}
              <button onClick={() => setActiveTab('classify')} className={tabButtonClass(activeTab === 'classify')}>
                Classify Queue
              </button>
            </div>
            <div className="mt-3 text-sm text-gray-300">
              {activeTab === 'handoffs'
                ? (loadingList ? 'Loading handoffs…' : `${handoffs.length} handoffs ready for CX`)
                : (loadingClassify ? 'Loading classify queue…' : `${classifyCalls.length} calls awaiting confirmation`)}
            </div>
          </div>
          <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
            {activeTab === 'handoffs' ? (
              !canAccessHandoffs ? (
                <div className="p-5 text-sm text-gray-300">Your role only has access to the classify queue.</div>
              ) : loadingList ? (
                <div className="p-5 text-sm text-gray-300">Loading handoffs…</div>
              ) : handoffs.length === 0 ? (
                <div className="p-5 text-sm text-gray-300">No CX handoffs are available right now.</div>
              ) : (
                <div className="divide-y divide-[var(--brand-border)]">
                  {handoffs.map((item) => {
                    const active = item.id === selectedId
                    return (
                      <button
                        key={item.id}
                        onClick={() => setSelectedId(item.id)}
                        className={`w-full px-5 py-4 text-left transition ${active ? 'bg-violet-500/10' : 'hover:bg-white/3'}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-base font-semibold text-white">{item.clientName}</div>
                            <div className="mt-1 text-sm text-gray-400">{item.repName || 'Unknown rep'}</div>
                          </div>
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${item.openGapCount > 0 ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'}`}>
                            {item.openGapCount} open gap{item.openGapCount === 1 ? '' : 's'}
                          </span>
                        </div>
                        <div className="mt-3 grid gap-2 text-xs text-gray-400 sm:grid-cols-2">
                          <div className="rounded-xl border border-[var(--brand-border)] bg-black/20 px-3 py-2">
                            <div>Assigned GA</div>
                            <div className="mt-1 text-sm font-semibold text-white">{item.assignedGA || 'Unassigned'}</div>
                          </div>
                          <div className="rounded-xl border border-[var(--brand-border)] bg-black/20 px-3 py-2">
                            <div>Closed</div>
                            <div className="mt-1 text-sm font-semibold text-white">{formatDate(item.closedAt)}</div>
                          </div>
                          <div className="rounded-xl border border-[var(--brand-border)] bg-black/20 px-3 py-2 sm:col-span-2">
                            <div>Promise ledger items</div>
                            <div className="mt-1 text-sm font-semibold text-white">{item.promiseCount}</div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )
            ) : loadingClassify ? (
              <div className="p-5 text-sm text-gray-300">Loading classify queue…</div>
            ) : classifyCalls.length === 0 ? (
              <div className="p-5">
                <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-6 text-center">
                  <div className="text-xl font-bold text-white">All your calls are classified ✅</div>
                  <div className="mt-2 text-sm text-emerald-100/80">Nothing pending in your queue right now.</div>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-[var(--brand-border)]">
                {classifyCalls.map((call) => {
                  const active = call.id === selectedCallId
                  return (
                    <button
                      key={call.id}
                      onClick={() => setSelectedCallId(call.id)}
                      className={`w-full px-5 py-4 text-left transition ${active ? 'bg-violet-500/10' : 'hover:bg-white/3'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-white">{call.repName || call.hostName || 'Unknown rep'}</div>
                          <div className="mt-1 truncate text-sm text-gray-400">{call.meetingTopic || 'Untitled Zoom call'}</div>
                        </div>
                        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-200">Needs confirm</span>
                      </div>
                      <div className="mt-3 space-y-2 text-xs text-gray-400">
                        <div className="rounded-xl border border-[var(--brand-border)] bg-black/20 px-3 py-2">
                          <div>Call date</div>
                          <div className="mt-1 text-sm font-semibold text-white">{formatDate(call.callDate || call.startedAt, true)}</div>
                        </div>
                        <div className="rounded-xl border border-[var(--brand-border)] bg-black/20 px-3 py-2">
                          <div>Zoom link</div>
                          <div className="mt-1 truncate text-sm font-semibold text-white">{call.callLink || 'Not saved'}</div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        <div className="space-y-6">
          {activeTab === 'classify' ? (
            <>
              <section className="rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-bg-card)] p-6">
                {!selectedClassifyCall ? (
                  <div className="text-sm text-gray-300">Pick a call from the left to classify it.</div>
                ) : (
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-300">Classify call</div>
                      <h2 className="mt-2 text-2xl font-bold text-white">{selectedClassifyCall.meetingTopic || 'Untitled Zoom call'}</h2>
                      <div className="mt-2 flex flex-wrap gap-2 text-sm text-gray-400">
                        <span>{selectedClassifyCall.repName || selectedClassifyCall.hostName || 'Unknown rep'}</span>
                        <span>•</span>
                        <span>{formatDate(selectedClassifyCall.callDate || selectedClassifyCall.startedAt, true)}</span>
                        <span>•</span>
                        <span>Duration {formatDuration(selectedClassifyCall.durationSecs)}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {[
                        ['Status', 'Needs confirmation'],
                        ['Current client', selectedClassifyCall.clientName || 'Unclassified'],
                        ['Acronym', selectedClassifyCall.acronym || '—'],
                        ['Suggestions', loadingClients ? 'Loading…' : clientSuggestions.length],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-xl border border-[var(--brand-border)] bg-black/20 px-4 py-3">
                          <div className="text-xs uppercase tracking-wider text-gray-300">{label}</div>
                          <div className="mt-1 break-all text-xl font-bold text-white">{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              <section className="rounded-3xl border border-[var(--brand-border)] bg-[linear-gradient(180deg,rgba(115,20,148,0.16),rgba(17,17,17,1))] p-6">
                {!selectedClassifyCall || !selectedClassifyDraft ? (
                  <div className="text-sm text-gray-300">No classify item selected.</div>
                ) : (
                  <div className="space-y-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-violet-200">{formatDate(selectedClassifyCall.callDate || selectedClassifyCall.startedAt)}</span>
                          <span className="rounded-full border border-[var(--brand-border)] bg-black/20 px-2.5 py-1 text-gray-300">{formatDuration(selectedClassifyCall.durationSecs)}</span>
                          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-amber-200">{selectedClassifyCall.repName || selectedClassifyCall.hostName || 'Unknown rep'}</span>
                        </div>
                        <div className="text-sm text-gray-300">Confirm the client match for this call, then submit it to move the call out of the queue.</div>
                        {selectedClassifyCall.callLink ? (
                          <a href={selectedClassifyCall.callLink} target="_blank" rel="noreferrer" className="inline-flex text-sm font-medium text-violet-300 hover:text-violet-200">
                            Open Zoom recording ↗
                          </a>
                        ) : (
                          <div className="text-sm text-gray-300">No recording link attached.</div>
                        )}
                      </div>

                      <div className="grid w-full max-w-3xl gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]">
                        <div>
                          <div className="mb-2 text-sm font-medium text-gray-300">Client name</div>
                          <input
                            list="cx-handoff-client-options"
                            value={selectedClassifyDraft.clientName}
                            onChange={(event) => handleSuggestionPick(selectedClassifyCall.id, event.target.value)}
                            placeholder="Start typing a known client…"
                            className="w-full rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-300 focus:border-violet-500/50"
                          />
                        </div>
                        <div>
                          <div className="mb-2 text-sm font-medium text-gray-300">Acronym</div>
                          <input
                            value={selectedClassifyDraft.acronym}
                            onChange={(event) => updateClassifyDraft(selectedClassifyCall.id, { acronym: event.target.value.toUpperCase() })}
                            placeholder="CLAC"
                            className="w-full rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-3 text-sm uppercase text-white outline-none transition placeholder:text-gray-300 focus:border-violet-500/50"
                          />
                        </div>
                        <div className="flex items-end">
                          <button
                            onClick={() => saveClassifyCall(selectedClassifyCall.id)}
                            disabled={savingClassifyId === selectedClassifyCall.id || !selectedClassifyDraft.clientName.trim() || !selectedClassifyDraft.acronym.trim()}
                            className="w-full rounded-2xl bg-[var(--brand-primary-2)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-primary-3)] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {savingClassifyId === selectedClassifyCall.id ? 'Saving…' : 'Submit'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            </>
          ) : (
            <>
              <section className="rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-bg-card)] p-6">
                {loadingDetail && !detail ? (
                  <div className="text-sm text-gray-300">Loading handoff detail…</div>
                ) : !detail ? (
                  <div className="text-sm text-gray-300">Pick a handoff from the left to start reviewing it.</div>
                ) : (
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-300">Client handoff</div>
                      <h2 className="mt-2 text-2xl font-bold text-white">{detail.clientName}</h2>
                      <div className="mt-2 flex flex-wrap gap-2 text-sm text-gray-400">
                        <span>{detail.repName || 'Unknown rep'}</span>
                        <span>•</span>
                        <span>Closed {formatDate(detail.closedAt, true)}</span>
                        <span>•</span>
                        <span>{detail.pipelinePhase || 'phase1-mvp'}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {[
                        ['Promises', detail.promiseLedgerItems?.length || 0],
                        ['Open gaps', openGapCount],
                        ['Calls', detail.salesCalls?.length || 0],
                        ['Transcript segments', detail.transcriptCount || 0],
                        ['Client ID', detail.clientId || '—'],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-xl border border-[var(--brand-border)] bg-black/20 px-4 py-3">
                          <div className="text-xs uppercase tracking-wider text-gray-300">{label}</div>
                          <div className="mt-1 break-all text-xl font-bold text-white">{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              {detail ? (
                <section className="rounded-3xl border border-[var(--brand-border)] bg-[linear-gradient(180deg,rgba(115,20,148,0.16),rgba(17,17,17,1))] p-6">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <div className="text-sm font-semibold uppercase tracking-[0.24em] text-violet-200">Assignment</div>
                      <div className="mt-2 text-lg font-semibold text-white">{detail.assignedGA || 'No GA assigned yet'}</div>
                      <div className="mt-1 text-sm text-gray-300">
                        {detail.assignedGAEmail || 'Select a Growth Advisor below.'}
                        {detail.assignedGAAt ? ` · Saved ${formatDate(detail.assignedGAAt, true)}` : ''}
                      </div>
                    </div>
                    <div className="flex w-full max-w-2xl flex-col gap-3 sm:flex-row">
                      <select
                        value={assignmentDraft}
                        onChange={(event) => setAssignmentDraft(event.target.value)}
                        className="w-full rounded-2xl border border-violet-500/30 bg-[var(--brand-bg)] px-4 py-3 text-sm text-white outline-none transition focus:border-violet-400"
                      >
                        <option value="">Unassigned</option>
                        {GA_OPTIONS.map((option) => (
                          <option key={option.name} value={option.name}>
                            {option.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={saveAssignment}
                        disabled={savingAssignment || loadingDetail}
                        className="rounded-2xl bg-[var(--brand-primary-2)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-primary-3)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {savingAssignment ? 'Saving…' : 'Save assignment'}
                      </button>
                    </div>
                  </div>
                </section>
              ) : null}

              <section className="overflow-hidden rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-bg-card)]">
                <div className="border-b border-[var(--brand-border)] px-6 py-4">
                  <div className="text-sm font-semibold uppercase tracking-[0.24em] text-gray-400">Sales calls</div>
                  <div className="mt-1 text-sm text-gray-300">Linked Zoom calls used to support the handoff packet.</div>
                </div>
                <div className="space-y-4 p-6">
                  {!detail ? (
                    <div className="text-sm text-gray-300">No handoff selected.</div>
                  ) : (detail.salesCalls || []).length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[var(--brand-border)] bg-black/10 px-5 py-6 text-sm text-gray-300">
                      No linked Zoom calls yet for {selectedSummary?.clientName || 'this handoff'}.
                    </div>
                  ) : (
                    detail.salesCalls.map((call) => {
                      const transcript = transcriptMap.get(call.id)
                      return (
                        <div key={call.id} className="rounded-2xl border border-[var(--brand-border)] bg-black/20 p-5">
                          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                            <div className="max-w-4xl">
                              <div className="text-lg font-semibold text-white">{call.meetingTopic || 'Untitled sales call'}</div>
                              <div className="mt-1 text-sm text-gray-400">
                                {formatDate(call.callDate || call.startedAt, true)} · {call.repName || detail.repName || 'Unknown rep'} · Duration {formatDuration(call.durationSecs)}
                              </div>
                              <div className="mt-2 text-xs text-gray-300">Match: {call.matchMethod || '—'} · Confidence {call.matchConfidence ?? '—'}</div>

                              <div className="mt-4 rounded-2xl border border-[var(--brand-border)] bg-black/20 p-4">
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">Transcript</div>
                                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${transcript ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-[var(--brand-border)] bg-black/20 text-gray-400'}`}>
                                    {transcript ? `${transcript.segmentCount || 0} segments` : 'Not available'}
                                  </span>
                                </div>
                                {transcript ? (
                                  <>
                                    <div className="mt-3 text-sm leading-6 text-gray-300">{transcript.snippet || 'Transcript attached, but no preview segments were parsed.'}</div>
                                    {(transcript.previewSegments || []).length > 0 ? (
                                      <div className="mt-4 space-y-2">
                                        {transcript.previewSegments.map((segment) => (
                                          <div key={segment.id || `${segment.startMs}-${segment.speaker || 'speaker'}`} className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-bg)] px-3 py-2.5 text-sm text-gray-300">
                                            <div className="text-xs uppercase tracking-[0.16em] text-gray-300">{segment.speaker || 'Unknown speaker'} · {segment.startMs != null ? `${Math.round(Number(segment.startMs) / 1000)}s` : '—'}</div>
                                            <div className="mt-1 leading-6">{segment.text}</div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : null}
                                  </>
                                ) : (
                                  <div className="mt-3 text-sm text-gray-300">No transcript is linked to this sales call yet.</div>
                                )}
                              </div>
                            </div>
                            {call.callLink ? (
                              <a href={call.callLink} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-2xl border border-violet-500/30 bg-violet-500/10 px-4 py-2.5 text-sm font-medium text-violet-200 transition hover:bg-violet-500/20 hover:text-white">
                                Open recording ↗
                              </a>
                            ) : (
                              <div className="text-sm text-gray-300">No recording link saved.</div>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </section>

              <section className="overflow-hidden rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-bg-card)]">
                <div className="border-b border-[var(--brand-border)] px-6 py-4">
                  <div className="text-sm font-semibold uppercase tracking-[0.24em] text-gray-400">Promise ledger</div>
                  <div className="mt-1 text-sm text-gray-300">Review each commitment before kickoff. Save one row at a time.</div>
                </div>
                <div className="space-y-4 p-6">
                  {!detail ? (
                    <div className="text-sm text-gray-300">No handoff selected.</div>
                  ) : (detail.promiseLedgerItems || []).length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[var(--brand-border)] bg-black/10 px-5 py-6 text-sm text-gray-300">
                      No promise ledger items were extracted for this handoff.
                    </div>
                  ) : (
                    detail.promiseLedgerItems.map((item) => {
                      const draft = promiseDrafts[item.id] || {}
                      const reviewValue = draft.reviewStatus || item.reviewStatus || 'Pending Review'
                      return (
                        <div key={item.id} className="rounded-2xl border border-[var(--brand-border)] bg-black/20 p-5">
                          <div className="flex flex-col gap-4 2xl:flex-row 2xl:justify-between">
                            <div className="max-w-4xl space-y-3">
                              <div className="flex flex-wrap gap-2">
                                <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-200">{item.category || 'General'}</span>
                                <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${badgeClass('confidence', item.confidence)}`}>{item.confidence || 'Unknown'} confidence</span>
                                <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${badgeClass('risk', item.riskFlag)}`}>Risk: {item.riskFlag || 'Unknown'}</span>
                                <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${badgeClass('review', reviewValue)}`}>{reviewValue}</span>
                              </div>
                              <div>
                                <div className="text-lg font-semibold text-white">{item.promiseText}</div>
                                <div className="mt-1 text-sm text-gray-400">Owner: {item.owner || '—'}{item.evidenceSource ? ` · Evidence: ${item.evidenceSource}` : ''}</div>
                              </div>
                              {item.evidenceLink ? (
                                <a href={item.evidenceLink} target="_blank" rel="noreferrer" className="inline-flex text-sm font-medium text-violet-300 hover:text-violet-200">
                                  Open evidence ↗
                                </a>
                              ) : (
                                <div className="text-sm text-gray-300">No evidence link attached.</div>
                              )}
                            </div>

                            <div className="w-full max-w-xl space-y-3">
                              <div className="flex flex-wrap gap-2">
                                {REVIEW_OPTIONS.map((option) => {
                                  const active = reviewValue === option.value
                                  return (
                                    <button
                                      key={option.value}
                                      onClick={() => updatePromiseDraft(item.id, { reviewStatus: option.value })}
                                      className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${active ? 'border-violet-400 bg-violet-500/20 text-white' : 'border-[var(--brand-border)] text-gray-300 hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-white'}`}
                                    >
                                      {option.label}
                                    </button>
                                  )
                                })}
                              </div>
                              <textarea
                                value={draft.reviewComment ?? ''}
                                onChange={(event) => updatePromiseDraft(item.id, { reviewComment: event.target.value })}
                                rows={3}
                                placeholder="Add review notes or context for CX…"
                                className="w-full rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-bg)] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-gray-300 focus:border-violet-500/50"
                              />
                              <button
                                onClick={() => savePromiseReview(item.id)}
                                disabled={savingPromises[item.id]}
                                className="rounded-2xl border border-violet-500/30 bg-violet-500/10 px-4 py-2.5 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {savingPromises[item.id] ? 'Saving…' : 'Save review'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </section>

              <section className="overflow-hidden rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-bg-card)]">
                <div className="border-b border-[var(--brand-border)] px-6 py-4">
                  <div className="text-sm font-semibold uppercase tracking-[0.24em] text-gray-400">Data gaps</div>
                  <div className="mt-1 text-sm text-gray-300">Critical missing info is grouped by source so CX can close every gap before handoff.</div>
                </div>
                <div className="space-y-6 p-6">
                  {!detail ? (
                    <div className="text-sm text-gray-300">No handoff selected.</div>
                  ) : Object.keys(groupedGaps).length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[var(--brand-border)] bg-black/10 px-5 py-6 text-sm text-gray-300">
                      No data gaps were flagged for this handoff.
                    </div>
                  ) : (
                    Object.entries(groupedGaps).map(([source, gaps]) => (
                      <div key={source} className="space-y-3">
                        <div className="flex items-center gap-3">
                          <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${badgeClass('source', source)}`}>{source}</span>
                          <div className="text-sm text-gray-300">{gaps.filter((gap) => gap.status === 'open').length} open · {gaps.length} total</div>
                        </div>
                        <div className="space-y-3">
                          {gaps.map((gap) => {
                            const draft = gapDrafts[gap.id] || {}
                            const isFilled = gap.status !== 'open'
                            return (
                              <div key={gap.id} className={`rounded-2xl border p-5 ${isFilled ? 'border-[var(--brand-border)] bg-white/5 opacity-75' : 'border-[var(--brand-border)] bg-black/20'}`}>
                                <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-start 2xl:justify-between">
                                  <div className="max-w-3xl">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="rounded-full border border-[var(--brand-border)] bg-black/30 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-gray-300">{gap.gapCode}</span>
                                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${gap.status === 'filled' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : gap.status === 'not-applicable' ? 'border-gray-500/30 bg-gray-500/10 text-gray-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-300'}`}>{gap.status}</span>
                                    </div>
                                    <div className="mt-3 text-sm leading-6 text-gray-200">{gap.description}</div>
                                    {gap.resolvedValue ? <div className="mt-3 text-sm text-gray-400"><span className="font-medium text-gray-300">Resolved value:</span> {gap.resolvedValue}</div> : null}
                                    {gap.filledBy || gap.filledAt ? <div className="mt-1 text-xs text-gray-300">{gap.filledBy ? `Filled by ${gap.filledBy}` : 'Updated'}{gap.filledAt ? ` · ${formatDate(gap.filledAt, true)}` : ''}</div> : null}
                                  </div>

                                  <div className="w-full max-w-xl space-y-3">
                                    <input
                                      value={draft.resolvedValue ?? ''}
                                      onChange={(event) => updateGapDraft(gap.id, { resolvedValue: event.target.value })}
                                      placeholder="Enter the missing info or fallback notes…"
                                      className="w-full rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-300 focus:border-violet-500/50"
                                    />
                                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                                      <input
                                        value={draft.filledBy ?? ''}
                                        onChange={(event) => updateGapDraft(gap.id, { filledBy: event.target.value })}
                                        placeholder="Who filled this?"
                                        className="w-full rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-300 focus:border-violet-500/50"
                                      />
                                      <select
                                        value={draft.status || gap.status || 'open'}
                                        onChange={(event) => updateGapDraft(gap.id, { status: event.target.value })}
                                        className="w-full rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-3 text-sm text-white outline-none transition focus:border-violet-500/50"
                                      >
                                        <option value="open">Open</option>
                                        <option value="filled">Filled</option>
                                        <option value="not-applicable">Not applicable</option>
                                      </select>
                                    </div>
                                    <button
                                      onClick={() => saveGap(gap.id)}
                                      disabled={savingGaps[gap.id]}
                                      className="rounded-2xl border border-violet-500/30 bg-violet-500/10 px-4 py-2.5 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {savingGaps[gap.id] ? 'Saving…' : draft.status === 'not-applicable' ? 'Save status' : 'Mark filled'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="overflow-hidden rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-bg-card)]">
                <div className="border-b border-[var(--brand-border)] px-6 py-4">
                  <div className="text-sm font-semibold uppercase tracking-[0.24em] text-gray-400">Transcript Q&amp;A</div>
                  <div className="mt-1 text-sm text-gray-300">Search exact transcript quotes across this client&apos;s linked sales calls.</div>
                </div>
                <div className="space-y-4 p-6">
                  {!detail ? (
                    <div className="text-sm text-gray-300">No handoff selected.</div>
                  ) : (
                    <>
                      <form onSubmit={runTranscriptSearch} className="flex flex-col gap-3 lg:flex-row">
                        <input
                          value={qaQuery}
                          onChange={(event) => setQaQuery(event.target.value)}
                          placeholder="Ask anything about this client's calls..."
                          className="w-full rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-300 focus:border-violet-500/50"
                        />
                        <button
                          type="submit"
                          disabled={qaLoading || !qaQuery.trim()}
                          className="rounded-2xl border border-violet-500/30 bg-violet-500/10 px-5 py-3 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {qaLoading ? 'Searching…' : 'Search transcript'}
                        </button>
                      </form>

                      {qaQuery.trim() && !qaLoading && qaResults.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-[var(--brand-border)] bg-black/10 px-5 py-6 text-sm text-gray-300">
                          No matching transcript quotes found yet.
                        </div>
                      ) : null}

                      {qaResults.length > 0 ? (
                        <div className="space-y-3">
                          {qaResults.map((result) => (
                            <div key={result.id} className="rounded-2xl border border-[var(--brand-border)] bg-black/20 p-4">
                              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                                <div className="text-sm text-gray-400">{result.speaker || 'Unknown speaker'} · {formatDate(result.callDate, true)}</div>
                                {result.zoomLink ? (
                                  <a href={result.zoomLink} target="_blank" rel="noreferrer" className="text-sm font-medium text-violet-300 hover:text-violet-200">
                                    Open Zoom ↗
                                  </a>
                                ) : null}
                              </div>
                              <div className="mt-2 text-xs uppercase tracking-[0.16em] text-gray-300">{result.repName || 'Unknown rep'}{result.startMs != null ? ` · ${Math.round(Number(result.startMs) / 1000)}s` : ''}</div>
                              <blockquote className="mt-3 border-l border-violet-500/30 pl-4 text-sm leading-6 text-gray-200">“{result.snippet || result.text}”</blockquote>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      <datalist id="cx-handoff-client-options">
        {dataListOptions.map((value) => (
          <option key={value} value={value} />
        ))}
      </datalist>
    </div>
  )
}
