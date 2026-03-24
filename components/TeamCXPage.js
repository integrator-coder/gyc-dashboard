'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatTimestamp } from '@/lib/team'

const REVIEW_STATUSES = ['Confirmed', 'Clarify', 'Incorrect']

function formatDate(value, includeTime = false) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(includeTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  }).format(new Date(value))
}

function badgeTone(kind, value) {
  const normalized = String(value || '').toLowerCase()
  if (kind === 'confidence') {
    if (normalized === 'high') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
    if (normalized === 'medium') return 'border-amber-500/30 bg-amber-500/10 text-amber-300'
    if (normalized === 'low') return 'border-rose-500/30 bg-rose-500/10 text-rose-300'
  }
  if (kind === 'risk') {
    if (normalized === 'none') return 'border-gray-600/40 bg-gray-500/10 text-gray-300'
    if (normalized === 'clarify') return 'border-amber-500/30 bg-amber-500/10 text-amber-300'
    return 'border-rose-500/30 bg-rose-500/10 text-rose-300'
  }
  if (kind === 'review') {
    if (normalized === 'confirmed') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
    if (normalized === 'clarify') return 'border-amber-500/30 bg-amber-500/10 text-amber-300'
    if (normalized === 'incorrect') return 'border-rose-500/30 bg-rose-500/10 text-rose-300'
  }
  return 'border-violet-500/30 bg-violet-500/10 text-violet-200'
}

export default function TeamCXPage() {
  const [handoffs, setHandoffs] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [drafts, setDrafts] = useState({})
  const [loadingList, setLoadingList] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('pricing')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')

  const loadHandoffs = useCallback(async () => {
    setLoadingList(true)
    try {
      const res = await fetch('/api/team/cx/handoffs', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load handoffs.')
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
      const res = await fetch(`/api/team/cx/handoffs/${id}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load handoff detail.')
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

  const runSearch = useCallback(async () => {
    setSearching(true)
    try {
      const params = new URLSearchParams({ q: searchQuery })
      if (detail?.clientName) params.set('clientName', detail.clientName)
      const res = await fetch(`/api/team/cx/search?${params.toString()}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Transcript search failed.')
      setSearchResults(json.results || [])
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSearching(false)
    }
  }, [detail?.clientName, searchQuery])

  useEffect(() => {
    loadHandoffs()
  }, [loadHandoffs])

  useEffect(() => {
    if (selectedId) loadDetail(selectedId)
  }, [selectedId, loadDetail])

  useEffect(() => {
    if (searchQuery.trim()) runSearch()
  }, [runSearch])

  function updateDraft(id, patch) {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...(current[id] || {}),
        ...patch,
      },
    }))
  }

  async function saveReviews() {
    if (!detail) return
    setSaving(true)
    try {
      const res = await fetch(`/api/team/cx/handoffs/${detail.id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: (detail.promiseLedgerItems || []).map((item) => ({
            promiseId: item.id,
            reviewStatus: drafts[item.id]?.reviewStatus || item.reviewStatus || 'Pending Review',
            reviewComment: drafts[item.id]?.reviewComment || '',
          })),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to save review.')
      await Promise.all([loadHandoffs(), loadDetail(detail.id)])
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const promiseItems = detail?.promiseLedgerItems || []
  const cxQuestions = detail?.cxQuestions || []
  const dataGaps = detail?.dataGaps || []
  const zoomCalls = detail?.zoomCalls || []
  const selectedSummary = useMemo(() => handoffs.find((item) => item.id === selectedId), [handoffs, selectedId])

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-violet-300">Team Portal</div>
          <h1 className="mt-2 text-3xl font-bold text-white">CX Review & Transcript Q&A</h1>
          <p className="mt-1 text-sm text-gray-400">Review handoffs on top, ask transcript questions on the bottom.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={loadHandoffs} className="rounded-xl border border-[var(--brand-border)] px-4 py-2 text-sm font-medium text-gray-300 transition hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-white">Refresh</button>
          <button onClick={saveReviews} disabled={!detail || saving} className="rounded-xl bg-[var(--brand-primary-2)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-primary-3)] disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Saving…' : 'Save review'}</button>
        </div>
      </div>

      {error ? <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-bg-card)] overflow-hidden">
          <div className="border-b border-[var(--brand-border)] px-5 py-4">
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-gray-400">Clients</div>
            <div className="mt-1 text-sm text-gray-500">{loadingList ? 'Loading handoffs…' : `${handoffs.length} handoffs in queue`}</div>
          </div>
          <div className="max-h-[calc(100vh-240px)] overflow-y-auto">
            {loadingList ? (
              <div className="p-5 text-sm text-gray-500">Loading handoffs…</div>
            ) : handoffs.length === 0 ? (
              <div className="p-5 text-sm text-gray-500">No handoffs found.</div>
            ) : (
              <div className="divide-y divide-[var(--brand-border)]">
                {handoffs.map((item) => {
                  const active = item.id === selectedId
                  return (
                    <button key={item.id} onClick={() => setSelectedId(item.id)} className={`w-full px-5 py-4 text-left transition ${active ? 'bg-violet-500/10' : 'hover:bg-white/3'}`}>
                      <div className="text-base font-semibold text-white">{item.clientName}</div>
                      <div className="mt-1 text-sm text-gray-400">{item.repName || 'Unknown rep'} · Closed {formatDate(item.closedAt)}</div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-gray-400">
                        <div className="rounded-xl border border-[var(--brand-border)] bg-black/20 px-3 py-2"><div>Promises</div><div className="mt-1 text-sm font-semibold text-white">{item.promiseCount}</div></div>
                        <div className="rounded-xl border border-[var(--brand-border)] bg-black/20 px-3 py-2"><div>Gaps</div><div className="mt-1 text-sm font-semibold text-white">{item.dataGapCount}</div></div>
                        <div className="rounded-xl border border-[var(--brand-border)] bg-black/20 px-3 py-2"><div>Evidence</div><div className="mt-1 text-sm font-semibold text-white">{item.evidenceCount}</div></div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-bg-card)] p-6">
            {loadingDetail && !detail ? (
              <div className="text-sm text-gray-500">Loading handoff detail…</div>
            ) : detail ? (
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-300">Review packet</div>
                  <h2 className="mt-2 text-2xl font-bold text-white">{detail.clientName}</h2>
                  <p className="mt-2 text-sm text-gray-400">{detail.repName || 'Unknown rep'} · Closed {formatDate(detail.closedAt, true)}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ['Promises', promiseItems.length],
                    ['Questions', cxQuestions.length],
                    ['Data gaps', dataGaps.length],
                    ['Zoom calls', zoomCalls.length],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-[var(--brand-border)] bg-black/20 px-4 py-3">
                      <div className="text-xs uppercase tracking-wider text-gray-500">{label}</div>
                      <div className="mt-1 text-2xl font-bold text-white">{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500">Select a handoff.</div>
            )}
          </div>

          <div className="rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-bg-card)] overflow-hidden">
            <div className="border-b border-[var(--brand-border)] px-6 py-4">
              <div className="text-sm font-semibold uppercase tracking-[0.24em] text-gray-400">Promise ledger</div>
              <div className="mt-1 text-sm text-gray-500">Confirm, clarify, or mark incorrect before kickoff.</div>
            </div>
            <div className="space-y-4 p-6">
              {!detail ? (
                <div className="text-sm text-gray-500">No handoff selected.</div>
              ) : promiseItems.length === 0 ? (
                <div className="text-sm text-gray-500">No promise ledger items attached.</div>
              ) : promiseItems.map((item) => {
                const draft = drafts[item.id] || {}
                const reviewStatus = draft.reviewStatus || item.reviewStatus || 'Pending Review'
                return (
                  <div key={item.id} className="rounded-2xl border border-[var(--brand-border)] bg-black/20 p-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-200">{item.category}</span>
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${badgeTone('confidence', item.confidence)}`}>{item.confidence || 'unknown'} confidence</span>
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${badgeTone('risk', item.riskFlag)}`}>risk: {item.riskFlag || 'unknown'}</span>
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${badgeTone('review', reviewStatus)}`}>{reviewStatus}</span>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-white">{item.promiseText}</h3>
                          <p className="mt-1 text-sm text-gray-400">Owner: {item.owner || '—'}{item.evidenceSource ? ` · Source: ${item.evidenceSource}` : ''}</p>
                        </div>
                        {item.evidenceLink ? <a href={item.evidenceLink} target="_blank" rel="noreferrer" className="inline-flex text-sm font-medium text-violet-300 hover:text-violet-200">Open evidence ↗</a> : <div className="text-sm text-gray-500">No evidence link attached.</div>}
                      </div>
                      <div className="w-full max-w-xl space-y-3">
                        <div className="flex flex-wrap gap-2">
                          {REVIEW_STATUSES.map((status) => {
                            const active = reviewStatus === status
                            return <button key={status} onClick={() => updateDraft(item.id, { reviewStatus: status })} className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${active ? 'border-violet-400 bg-violet-500/20 text-white' : 'border-[var(--brand-border)] text-gray-300 hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-white'}`}>{status}</button>
                          })}
                        </div>
                        <textarea value={draft.reviewComment ?? ''} onChange={(event) => updateDraft(item.id, { reviewComment: event.target.value })} rows={3} placeholder="Optional review comment…" className="w-full rounded-xl border border-[var(--brand-border)] bg-[var(--brand-bg)] px-3 py-2 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-violet-500/50" />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="grid gap-6 2xl:grid-cols-2">
            <div className="rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-bg-card)] p-6">
              <div className="text-sm font-semibold uppercase tracking-[0.24em] text-gray-400">CX questions</div>
              <div className="mt-4 space-y-3">
                {cxQuestions.length === 0 ? <div className="text-sm text-gray-500">No CX questions.</div> : cxQuestions.map((item, index) => (
                  <div key={`${item.question}-${index}`} className="rounded-xl border border-[var(--brand-border)] bg-black/20 p-4">
                    <div className="text-sm font-medium text-white">{item.question}</div>
                    {item.reason ? <div className="mt-2 text-sm text-gray-400">{item.reason}</div> : null}
                    {item.evidence_link ? <a href={item.evidence_link} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm text-violet-300 hover:text-violet-200">Open evidence ↗</a> : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-bg-card)] p-6">
              <div className="text-sm font-semibold uppercase tracking-[0.24em] text-gray-400">Data gaps</div>
              <div className="mt-4 space-y-3">
                {dataGaps.length === 0 ? <div className="text-sm text-gray-500">No data gaps flagged.</div> : dataGaps.map((item, index) => (
                  <div key={`${item.code}-${index}`} className="rounded-xl border border-[var(--brand-border)] bg-black/20 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300">{item.source || 'Unknown source'}</span>
                      <span className="text-xs uppercase tracking-wider text-gray-500">{item.code || 'UNCODED'}</span>
                    </div>
                    <div className="mt-2 text-sm text-gray-300">{item.detail || 'No detail provided.'}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-bg-card)] overflow-hidden">
            <div className="border-b border-[var(--brand-border)] px-6 py-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <div className="text-sm font-semibold uppercase tracking-[0.24em] text-gray-400">Transcript Q&A</div>
                  <div className="mt-1 text-sm text-gray-500">{selectedSummary?.clientName ? `Searching within ${selectedSummary.clientName}` : 'Searching across all calls'}</div>
                </div>
                <div className="flex w-full max-w-2xl gap-3">
                  <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="What was said about pricing?" className="w-full rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-violet-500/50" />
                  <button onClick={runSearch} disabled={searching || !searchQuery.trim()} className="rounded-2xl bg-[var(--brand-primary-2)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-primary-3)] disabled:cursor-not-allowed disabled:opacity-50">{searching ? 'Searching…' : 'Search'}</button>
                </div>
              </div>
            </div>
            <div className="space-y-4 p-6">
              {searchResults.length === 0 ? <div className="text-sm text-gray-500">No transcript matches yet.</div> : searchResults.map((item) => (
                <div key={item.id} className="rounded-2xl border border-[var(--brand-border)] bg-black/20 p-5">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-violet-200">{item.clientName || item.acronym || 'Unknown client'}</span>
                    <span className="rounded-full border border-[var(--brand-border)] bg-black/30 px-2.5 py-1 text-gray-300">{item.repName || 'Unknown rep'}</span>
                    <span className="rounded-full border border-[var(--brand-border)] bg-black/30 px-2.5 py-1 text-gray-300">{formatDate(item.callDate)}</span>
                    <span className="rounded-full border border-[var(--brand-border)] bg-black/30 px-2.5 py-1 text-gray-300">{formatTimestamp(item.startMs)}</span>
                  </div>
                  <div className="mt-3 text-sm font-medium text-violet-200">{item.speaker || 'Unknown speaker'}</div>
                  <div className="mt-2 text-sm leading-7 text-gray-300">{item.text}</div>
                  {item.zoomLink ? <a href={item.zoomLink} target="_blank" rel="noreferrer" className="mt-4 inline-flex text-sm font-medium text-violet-300 hover:text-violet-200">Open Zoom recording ↗</a> : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
