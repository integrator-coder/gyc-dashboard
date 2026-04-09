'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatDuration } from '@/lib/team'

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

export default function TeamClassifyPage({ user }) {
  const [calls, setCalls] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingId, setSavingId] = useState('')
  const [drafts, setDrafts] = useState({})

  const loadQueue = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/team/classify', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load queue.')
      setCalls(json.calls || [])
      setSuggestions(json.clientSuggestions || [])
      setDrafts((current) => {
        const next = { ...current }
        for (const call of json.calls || []) {
          next[call.id] = next[call.id] || {
            clientName: call.clientName || '',
            acronym: call.acronym || '',
          }
        }
        return next
      })
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadQueue()
  }, [loadQueue])

  const dataListOptions = useMemo(
    () => suggestions.map((item) => `${item.value} (${item.acronym})`),
    [suggestions]
  )

  function updateDraft(id, patch) {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...(current[id] || {}),
        ...patch,
      },
    }))
  }

  function handleSuggestionPick(id, value) {
    const matched = suggestions.find((item) => `${item.value} (${item.acronym})` === value)
    if (matched) {
      updateDraft(id, { clientName: matched.value, acronym: matched.acronym })
    } else {
      updateDraft(id, { clientName: value })
    }
  }

  async function saveCall(callId) {
    const draft = drafts[callId] || {}
    setSavingId(callId)
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
      await loadQueue()
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingId('')
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-violet-300">Team Portal</div>
          <h1 className="mt-2 text-3xl font-bold text-white">Call Classification Queue</h1>
          <p className="mt-1 text-sm text-gray-400">
            {user?.name || 'Rep'} — review the calls that still need client confirmation.
          </p>
        </div>
        <button
          onClick={loadQueue}
          className="rounded-xl border border-[var(--brand-border)] px-4 py-2 text-sm font-medium text-gray-300 transition hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-white"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
      ) : null}

      {loading ? (
        <div className="rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-bg-card)] p-6 text-sm text-gray-400">Loading calls…</div>
      ) : calls.length === 0 ? (
        <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-8 text-center">
          <div className="text-2xl font-bold text-white">All your calls are classified ✅</div>
          <div className="mt-2 text-sm text-emerald-100/80">Nothing pending in your queue right now.</div>
        </div>
      ) : (
        <div className="grid gap-4">
          {calls.map((call) => {
            const draft = drafts[call.id] || { clientName: '', acronym: '' }
            return (
              <div key={call.id} className="rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-bg-card)] p-6">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-violet-200">{formatDate(call.callDate || call.startedAt)}</span>
                      <span className="rounded-full border border-[var(--brand-border)] bg-black/20 px-2.5 py-1 text-gray-300">{formatDuration(call.durationSecs)}</span>
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-amber-200">{call.repName || call.hostName || 'Unknown rep'}</span>
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-white">{call.meetingTopic || 'Untitled Zoom call'}</h2>
                      <div className="mt-2 text-sm text-gray-400">
                        Current match: {call.clientName || 'Unclassified'}
                        {call.acronym ? ` (${call.acronym})` : ''}
                      </div>
                    </div>
                    {call.callLink ? (
                      <a href={call.callLink} target="_blank" rel="noreferrer" className="inline-flex text-sm font-medium text-violet-300 hover:text-violet-200">
                        Open Zoom recording ↗
                      </a>
                    ) : (
                      <div className="text-sm text-gray-300">No recording link attached.</div>
                    )}
                  </div>

                  <div className="grid w-full max-w-2xl gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]">
                    <div>
                      <div className="mb-2 text-sm font-medium text-gray-300">Client name</div>
                      <input
                        list="team-classify-client-options"
                        value={draft.clientName}
                        onChange={(event) => handleSuggestionPick(call.id, event.target.value)}
                        placeholder="Start typing a known client…"
                        className="w-full rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-300 focus:border-violet-500/50"
                      />
                    </div>
                    <div>
                      <div className="mb-2 text-sm font-medium text-gray-300">Acronym</div>
                      <input
                        value={draft.acronym}
                        onChange={(event) => updateDraft(call.id, { acronym: event.target.value.toUpperCase() })}
                        placeholder="CLAC"
                        className="w-full rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-3 text-sm uppercase text-white outline-none transition placeholder:text-gray-300 focus:border-violet-500/50"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={() => saveCall(call.id)}
                        disabled={savingId === call.id || !draft.clientName.trim() || !draft.acronym.trim()}
                        className="w-full rounded-2xl bg-[var(--brand-primary-2)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-primary-3)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {savingId === call.id ? 'Saving…' : 'Submit'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <datalist id="team-classify-client-options">
        {dataListOptions.map((value) => (
          <option key={value} value={value} />
        ))}
      </datalist>
    </div>
  )
}
