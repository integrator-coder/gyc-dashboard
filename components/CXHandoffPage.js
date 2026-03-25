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

export default function CXHandoffPage() {
  const [handoffs, setHandoffs] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [loadingList, setLoadingList] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [assignmentDraft, setAssignmentDraft] = useState('')
  const [promiseDrafts, setPromiseDrafts] = useState({})
  const [gapDrafts, setGapDrafts] = useState({})
  const [savingAssignment, setSavingAssignment] = useState(false)
  const [savingPromises, setSavingPromises] = useState({})
  const [savingGaps, setSavingGaps] = useState({})
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const loadHandoffs = useCallback(async () => {
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
  }, [])

  const loadDetail = useCallback(async (id) => {
    if (!id) return
    setLoadingDetail(true)
    try {
      const res = await fetch(`/api/cx-handoff/${id}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load handoff detail.')
      const handoff = json.handoff
      setDetail(handoff)
      setAssignmentDraft(handoff.assignedGA || '')
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
  }, [])

  useEffect(() => {
    loadHandoffs()
  }, [loadHandoffs])

  useEffect(() => {
    if (selectedId) loadDetail(selectedId)
    else setDetail(null)
  }, [selectedId, loadDetail])

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

  const selectedSummary = useMemo(() => handoffs.find((item) => item.id === selectedId), [handoffs, selectedId])
  const groupedGaps = useMemo(() => groupGapsBySource(detail?.dataGaps || []), [detail?.dataGaps])
  const openGapCount = (detail?.dataGaps || []).filter((gap) => gap.status === 'open').length

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-violet-300">Team Portal</div>
          <h1 className="mt-2 text-3xl font-bold text-white">CX Handoffs</h1>
          <p className="mt-1 text-sm text-gray-400">Assign the right GA, review sales-call promises, and close the data gaps before kickoff.</p>
        </div>
        <button onClick={loadHandoffs} className="rounded-2xl border border-[var(--brand-border)] px-4 py-2.5 text-sm font-medium text-gray-300 transition hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-white">
          Refresh queue
        </button>
      </div>

      {error ? <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}
      {toast ? <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{toast}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-bg-card)]">
          <div className="border-b border-[var(--brand-border)] px-5 py-4">
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-gray-400">Handoff queue</div>
            <div className="mt-1 text-sm text-gray-500">{loadingList ? 'Loading handoffs…' : `${handoffs.length} handoffs ready for CX`}</div>
          </div>
          <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
            {loadingList ? (
              <div className="p-5 text-sm text-gray-500">Loading handoffs…</div>
            ) : handoffs.length === 0 ? (
              <div className="p-5 text-sm text-gray-500">No CX handoffs are available right now.</div>
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
            )}
          </div>
        </section>

        <div className="space-y-6">
          <section className="rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-bg-card)] p-6">
            {loadingDetail && !detail ? (
              <div className="text-sm text-gray-500">Loading handoff detail…</div>
            ) : !detail ? (
              <div className="text-sm text-gray-500">Pick a handoff from the left to start reviewing it.</div>
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
                    ['Client ID', detail.clientId || '—'],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-[var(--brand-border)] bg-black/20 px-4 py-3">
                      <div className="text-xs uppercase tracking-wider text-gray-500">{label}</div>
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
              <div className="mt-1 text-sm text-gray-500">Linked Zoom calls used to support the handoff packet.</div>
            </div>
            <div className="space-y-4 p-6">
              {!detail ? (
                <div className="text-sm text-gray-500">No handoff selected.</div>
              ) : (detail.salesCalls || []).length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--brand-border)] bg-black/10 px-5 py-6 text-sm text-gray-500">
                  No linked Zoom calls yet for {selectedSummary?.clientName || 'this handoff'}.
                </div>
              ) : (
                detail.salesCalls.map((call) => (
                  <div key={call.id} className="rounded-2xl border border-[var(--brand-border)] bg-black/20 p-5">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                      <div>
                        <div className="text-lg font-semibold text-white">{call.meetingTopic || 'Untitled sales call'}</div>
                        <div className="mt-1 text-sm text-gray-400">
                          {formatDate(call.callDate || call.startedAt, true)} · {call.repName || detail.repName || 'Unknown rep'} · Duration {formatDuration(call.durationSecs)}
                        </div>
                        <div className="mt-2 text-xs text-gray-500">Match: {call.matchMethod || '—'} · Confidence {call.matchConfidence ?? '—'}</div>
                      </div>
                      {call.callLink ? (
                        <a href={call.callLink} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-2xl border border-violet-500/30 bg-violet-500/10 px-4 py-2.5 text-sm font-medium text-violet-200 transition hover:bg-violet-500/20 hover:text-white">
                          Open recording ↗
                        </a>
                      ) : (
                        <div className="text-sm text-gray-500">No recording link saved.</div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-bg-card)]">
            <div className="border-b border-[var(--brand-border)] px-6 py-4">
              <div className="text-sm font-semibold uppercase tracking-[0.24em] text-gray-400">Promise ledger</div>
              <div className="mt-1 text-sm text-gray-500">Review each commitment before kickoff. Save one row at a time.</div>
            </div>
            <div className="space-y-4 p-6">
              {!detail ? (
                <div className="text-sm text-gray-500">No handoff selected.</div>
              ) : (detail.promiseLedgerItems || []).length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--brand-border)] bg-black/10 px-5 py-6 text-sm text-gray-500">
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
                            <div className="text-sm text-gray-500">No evidence link attached.</div>
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
                            className="w-full rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-bg)] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-violet-500/50"
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
              <div className="mt-1 text-sm text-gray-500">Critical missing info is grouped by source so CX can close every gap before handoff.</div>
            </div>
            <div className="space-y-6 p-6">
              {!detail ? (
                <div className="text-sm text-gray-500">No handoff selected.</div>
              ) : Object.keys(groupedGaps).length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--brand-border)] bg-black/10 px-5 py-6 text-sm text-gray-500">
                  No data gaps were flagged for this handoff.
                </div>
              ) : (
                Object.entries(groupedGaps).map(([source, gaps]) => (
                  <div key={source} className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${badgeClass('source', source)}`}>{source}</span>
                      <div className="text-sm text-gray-500">{gaps.filter((gap) => gap.status === 'open').length} open · {gaps.length} total</div>
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
                                {gap.filledBy || gap.filledAt ? <div className="mt-1 text-xs text-gray-500">{gap.filledBy ? `Filled by ${gap.filledBy}` : 'Updated'}{gap.filledAt ? ` · ${formatDate(gap.filledAt, true)}` : ''}</div> : null}
                              </div>

                              <div className="w-full max-w-xl space-y-3">
                                <input
                                  value={draft.resolvedValue ?? ''}
                                  onChange={(event) => updateGapDraft(gap.id, { resolvedValue: event.target.value })}
                                  placeholder="Enter the missing info or fallback notes…"
                                  className="w-full rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-violet-500/50"
                                />
                                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                                  <input
                                    value={draft.filledBy ?? ''}
                                    onChange={(event) => updateGapDraft(gap.id, { filledBy: event.target.value })}
                                    placeholder="Who filled this?"
                                    className="w-full rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-violet-500/50"
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
        </div>
      </div>
    </div>
  )
}
