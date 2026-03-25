'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

const REVIEW_STATUSES = ['Confirmed', 'Clarify', 'Incorrect']

function formatDate(value, options = {}) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...options,
  }).format(new Date(value))
}

function formatDateTime(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function confidenceClasses(confidence) {
  switch ((confidence || '').toLowerCase()) {
    case 'high':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
    case 'medium':
      return 'bg-amber-500/15 text-amber-300 border-amber-500/30'
    case 'low':
      return 'bg-rose-500/15 text-rose-300 border-rose-500/30'
    default:
      return 'bg-gray-500/10 text-gray-300 border-gray-600/40'
  }
}

function statusClasses(status) {
  switch (status) {
    case 'Confirmed':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
    case 'Clarify':
      return 'bg-amber-500/15 text-amber-300 border-amber-500/30'
    case 'Incorrect':
      return 'bg-rose-500/15 text-rose-300 border-rose-500/30'
    default:
      return 'bg-violet-500/15 text-violet-200 border-violet-500/30'
  }
}

function riskClasses(riskFlag) {
  switch ((riskFlag || '').toLowerCase()) {
    case 'none':
      return 'bg-gray-500/10 text-gray-300 border-gray-600/40'
    case 'clarify':
      return 'bg-amber-500/15 text-amber-300 border-amber-500/30'
    default:
      return 'bg-rose-500/15 text-rose-300 border-rose-500/30'
  }
}

function Card({ children, className = '' }) {
  return (
    <div className={`rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-bg-card)] ${className}`}>
      {children}
    </div>
  )
}

function SectionHeader({ title, meta, actions }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-gray-400">{title}</h2>
        {meta ? <p className="mt-1 text-sm text-gray-500">{meta}</p> : null}
      </div>
      {actions}
    </div>
  )
}

export default function CXHandoffPage() {
  const [handoffs, setHandoffs] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [drafts, setDrafts] = useState({})
  const [loadingList, setLoadingList] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const selectedSummary = useMemo(
    () => handoffs.find((item) => item.id === selectedId) || null,
    [handoffs, selectedId]
  )

  const loadList = useCallback(async () => {
    setLoadingList(true)
    try {
      const res = await fetch('/api/cx/handoffs', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load handoffs')
      const next = json.handoffs || []
      setHandoffs(next)
      setSelectedId((current) => current ?? next[0]?.id ?? null)
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
      const res = await fetch(`/api/cx/handoffs/${id}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load handoff detail')
      const handoff = json.handoff
      setDetail(handoff)
      setDrafts(
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
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  useEffect(() => {
    loadList()
  }, [loadList])

  useEffect(() => {
    if (selectedId) loadDetail(selectedId)
  }, [selectedId, loadDetail])

  const updateDraft = (promiseId, patch) => {
    setDrafts((current) => ({
      ...current,
      [promiseId]: {
        ...(current[promiseId] || {}),
        ...patch,
      },
    }))
  }

  const saveReviews = async () => {
    if (!detail?.promiseLedgerItems?.length) return
    setSaving(true)
    try {
      const payload = {
        items: detail.promiseLedgerItems.map((item) => ({
          promiseId: item.id,
          reviewStatus: drafts[item.id]?.reviewStatus || item.reviewStatus || 'Pending Review',
          reviewComment: drafts[item.id]?.reviewComment ?? '',
        })),
      }

      const res = await fetch(`/api/cx/handoffs/${detail.id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to save review')
      await Promise.all([loadList(), loadDetail(detail.id)])
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const cxQuestions = detail?.cxQuestions || []
  const dataGaps = detail?.dataGaps || []
  const zoomCalls = detail?.zoomCalls || []
  const promiseLedgerItems = detail?.promiseLedgerItems || []

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">CX Handoffs</h1>
          <p className="mt-1 text-sm text-gray-400">
            Internal ops review for closed deals before onboarding handoff.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={loadList}
            className="rounded-xl border border-[var(--brand-border)] px-4 py-2 text-sm font-medium text-gray-300 transition hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-white"
          >
            Refresh
          </button>
          <button
            onClick={saveReviews}
            disabled={!detail || saving || !promiseLedgerItems.length}
            className="rounded-xl bg-[var(--brand-primary-2)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-primary-3)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save review'}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[440px_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <div className="border-b border-[var(--brand-border)] px-5 py-4">
            <SectionHeader
              title="Closed deals"
              meta={loadingList ? 'Loading handoffs…' : `${handoffs.length} deals ready for review`}
            />
          </div>

          <div className="max-h-[calc(100vh-240px)] overflow-y-auto">
            {loadingList ? (
              <div className="p-5 text-sm text-gray-500">Loading handoffs…</div>
            ) : handoffs.length === 0 ? (
              <div className="p-5 text-sm text-gray-500">No CX handoffs found in Neon.</div>
            ) : (
              <div className="divide-y divide-[var(--brand-border)]">
                {handoffs.map((item) => {
                  const active = item.id === selectedId
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      className={`w-full px-5 py-4 text-left transition ${
                        active ? 'bg-violet-500/10' : 'hover:bg-white/3'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-base font-semibold text-white">{item.clientName}</div>
                          <div className="mt-1 text-sm text-gray-400">
                            {item.repName || 'Unknown rep'} · Closed {formatDate(item.closedAt)}
                          </div>
                        </div>
                        <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-200">
                          #{item.id}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                        <div className="rounded-lg border border-[var(--brand-border)] bg-black/20 px-3 py-2">
                          <div className="text-gray-500">Promises</div>
                          <div className="mt-1 text-sm font-semibold text-white">{item.promiseCount}</div>
                        </div>
                        <div className="rounded-lg border border-[var(--brand-border)] bg-black/20 px-3 py-2">
                          <div className="text-gray-500">Data gaps</div>
                          <div className="mt-1 text-sm font-semibold text-white">{item.dataGapCount}</div>
                        </div>
                        <div className="rounded-lg border border-[var(--brand-border)] bg-black/20 px-3 py-2">
                          <div className="text-gray-500">Evidence</div>
                          <div className="mt-1 text-sm font-semibold text-white">{item.evidenceCount}</div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="px-6 py-5">
            {loadingDetail && !detail ? (
              <div className="text-sm text-gray-500">Loading handoff detail…</div>
            ) : detail ? (
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-300">Review packet</div>
                  <h2 className="mt-2 text-2xl font-bold text-white">{detail.clientName}</h2>
                  <p className="mt-2 text-sm text-gray-400">
                    {detail.repName || 'Unknown rep'} · Closed {formatDateTime(detail.closedAt)}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-[var(--brand-border)] bg-black/20 px-4 py-3">
                    <div className="text-xs uppercase tracking-wider text-gray-500">Promises</div>
                    <div className="mt-1 text-2xl font-bold text-white">{promiseLedgerItems.length}</div>
                  </div>
                  <div className="rounded-xl border border-[var(--brand-border)] bg-black/20 px-4 py-3">
                    <div className="text-xs uppercase tracking-wider text-gray-500">Questions</div>
                    <div className="mt-1 text-2xl font-bold text-white">{cxQuestions.length}</div>
                  </div>
                  <div className="rounded-xl border border-[var(--brand-border)] bg-black/20 px-4 py-3">
                    <div className="text-xs uppercase tracking-wider text-gray-500">Data gaps</div>
                    <div className="mt-1 text-2xl font-bold text-white">{dataGaps.length}</div>
                  </div>
                  <div className="rounded-xl border border-[var(--brand-border)] bg-black/20 px-4 py-3">
                    <div className="text-xs uppercase tracking-wider text-gray-500">Zoom calls</div>
                    <div className="mt-1 text-2xl font-bold text-white">{zoomCalls.length}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500">Select a handoff to review.</div>
            )}
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-[var(--brand-border)] px-6 py-4">
              <SectionHeader title="Promise ledger" meta="Review each commitment before onboarding kickoff." />
            </div>
            <div className="space-y-4 p-6">
              {!detail ? (
                <div className="text-sm text-gray-500">No handoff selected.</div>
              ) : promiseLedgerItems.length === 0 ? (
                <div className="text-sm text-gray-500">No promise ledger items on this handoff.</div>
              ) : (
                promiseLedgerItems.map((item) => {
                  const draft = drafts[item.id] || {}
                  const currentStatus = draft.reviewStatus || item.reviewStatus || 'Pending Review'
                  return (
                    <div key={item.id} className="rounded-2xl border border-[var(--brand-border)] bg-black/20 p-5">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="space-y-3">
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-200">
                              {item.category}
                            </span>
                            <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${confidenceClasses(item.confidence)}`}>
                              {item.confidence || 'unknown'} confidence
                            </span>
                            <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${riskClasses(item.riskFlag)}`}>
                              risk: {item.riskFlag || 'unknown'}
                            </span>
                            <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClasses(currentStatus)}`}>
                              {currentStatus}
                            </span>
                          </div>

                          <div>
                            <h3 className="text-lg font-semibold text-white">{item.promiseText}</h3>
                            <p className="mt-1 text-sm text-gray-400">
                              Owner: {item.owner || '—'}
                              {item.evidenceSource ? ` · Source: ${item.evidenceSource}` : ''}
                            </p>
                          </div>

                          {item.evidenceLink ? (
                            <a
                              href={item.evidenceLink}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 text-sm font-medium text-violet-300 transition hover:text-violet-200"
                            >
                              Open evidence ↗
                            </a>
                          ) : (
                            <div className="text-sm text-gray-500">No evidence link attached.</div>
                          )}
                        </div>

                        <div className="w-full max-w-xl space-y-3">
                          <div className="flex flex-wrap gap-2">
                            {REVIEW_STATUSES.map((status) => {
                              const active = currentStatus === status
                              return (
                                <button
                                  key={status}
                                  onClick={() => updateDraft(item.id, { reviewStatus: status })}
                                  className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                                    active
                                      ? 'border-violet-400 bg-violet-500/20 text-white'
                                      : 'border-[var(--brand-border)] bg-transparent text-gray-300 hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-white'
                                  }`}
                                >
                                  {status}
                                </button>
                              )
                            })}
                          </div>

                          <textarea
                            value={draft.reviewComment ?? ''}
                            onChange={(event) => updateDraft(item.id, { reviewComment: event.target.value })}
                            rows={3}
                            placeholder="Optional review comment…"
                            className="w-full rounded-xl border border-[var(--brand-border)] bg-[var(--brand-bg)] px-3 py-2 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-violet-500/50"
                          />
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </Card>

          <div className="grid gap-6 2xl:grid-cols-2">
            <Card className="px-6 py-5">
              <SectionHeader title="CX questions" meta="Outstanding questions to resolve before kickoff." />
              <div className="mt-4 space-y-3">
                {!detail ? (
                  <div className="text-sm text-gray-500">No handoff selected.</div>
                ) : cxQuestions.length === 0 ? (
                  <div className="text-sm text-gray-500">No CX questions on this handoff.</div>
                ) : (
                  cxQuestions.map((item, index) => (
                    <div key={`${item.question}-${index}`} className="rounded-xl border border-[var(--brand-border)] bg-black/20 p-4">
                      <div className="text-sm font-medium text-white">{item.question}</div>
                      {item.reason ? <div className="mt-2 text-sm text-gray-400">{item.reason}</div> : null}
                      {item.evidence_link ? (
                        <a href={item.evidence_link} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm text-violet-300 hover:text-violet-200">
                          Open evidence ↗
                        </a>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card className="px-6 py-5">
              <SectionHeader title="Data gaps" meta="Missing source coverage that may block a clean handoff." />
              <div className="mt-4 space-y-3">
                {!detail ? (
                  <div className="text-sm text-gray-500">No handoff selected.</div>
                ) : dataGaps.length === 0 ? (
                  <div className="text-sm text-gray-500">No data gaps flagged.</div>
                ) : (
                  dataGaps.map((item, index) => (
                    <div key={`${item.code}-${index}`} className="rounded-xl border border-[var(--brand-border)] bg-black/20 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300">
                          {item.source || 'Unknown source'}
                        </span>
                        <span className="text-xs uppercase tracking-wider text-gray-500">{item.code || 'UNCODED'}</span>
                      </div>
                      <div className="mt-2 text-sm text-gray-300">{item.detail || 'No detail provided.'}</div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>

          <Card className="px-6 py-5">
            <SectionHeader title="Zoom calls" meta="Matched recordings and transcript snippets tied to the handoff." />
            <div className="mt-4 space-y-4">
              {!detail ? (
                <div className="text-sm text-gray-500">No handoff selected.</div>
              ) : zoomCalls.length === 0 ? (
                <div className="text-sm text-gray-500">No Zoom evidence attached to this handoff.</div>
              ) : (
                zoomCalls.map((call) => (
                  <div key={call.id} className="rounded-2xl border border-[var(--brand-border)] bg-black/20 p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full border border-[var(--brand-border)] bg-white/5 px-2.5 py-1 text-xs font-medium text-gray-300">
                            {formatDate(call.callDate)}
                          </span>
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${confidenceClasses(call.matchConfidence >= 0.85 ? 'high' : call.matchConfidence >= 0.6 ? 'medium' : 'low')}`}>
                            match {call.matchMethod || 'unknown'}
                            {typeof call.matchConfidence === 'number' ? ` · ${(call.matchConfidence * 100).toFixed(0)}%` : ''}
                          </span>
                        </div>
                        <div className="mt-3 text-lg font-semibold text-white">
                          {call.salesCall?.summary || call.meetingTopic || 'Zoom call'}
                        </div>
                        <div className="mt-2 text-sm text-gray-400">
                          {call.salesCall?.callStage || 'Call stage unknown'}
                          {call.salesCall?.result ? ` · ${call.salesCall.result}` : ''}
                          {call.salesCall?.salesAdvisor ? ` · ${call.salesCall.salesAdvisor}` : ''}
                        </div>
                        {call.callLink ? (
                          <a href={call.callLink} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-medium text-violet-300 hover:text-violet-200">
                            Open recording ↗
                          </a>
                        ) : null}
                      </div>

                      <div className="w-full max-w-xl rounded-xl border border-[var(--brand-border)] bg-[var(--brand-bg)] p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">Transcript snippet</div>
                        {call.transcriptSnippet ? (
                          <div className="mt-3 space-y-2">
                            <div className="text-sm text-violet-200">{call.transcriptSnippet.speaker || 'Unknown speaker'}</div>
                            <div className="text-sm leading-6 text-gray-300">{call.transcriptSnippet.text}</div>
                          </div>
                        ) : (
                          <div className="mt-3 text-sm text-gray-500">No transcript snippet available.</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
