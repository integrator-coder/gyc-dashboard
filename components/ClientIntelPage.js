'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatDuration, formatTimestamp } from '@/lib/team'

function formatDate(value, includeTime = false) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(includeTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  }).format(new Date(value))
}

function toneForConfidence(value) {
  const normalized = String(value || '').toLowerCase()
  if (normalized === 'high') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
  if (normalized === 'medium') return 'border-amber-500/30 bg-amber-500/10 text-amber-300'
  if (normalized === 'low') return 'border-rose-500/30 bg-rose-500/10 text-rose-300'
  return 'border-violet-500/30 bg-violet-500/10 text-violet-200'
}

function toneForRisk(value) {
  const normalized = String(value || '').toLowerCase()
  if (normalized === 'none') return 'border-gray-600/40 bg-gray-500/10 text-gray-300'
  if (normalized === 'clarify') return 'border-amber-500/30 bg-amber-500/10 text-amber-300'
  if (normalized === 'high') return 'border-rose-500/30 bg-rose-500/10 text-rose-300'
  return 'border-violet-500/30 bg-violet-500/10 text-violet-200'
}

function EmptyState({ children }) {
  return <div className="rounded-2xl border border-dashed border-[var(--brand-border)] bg-black/10 px-4 py-5 text-sm text-gray-500">{children}</div>
}

function SectionCard({ eyebrow, title, children, action }) {
  return (
    <section className="overflow-hidden rounded-3xl border border-[var(--brand-border)] bg-[radial-gradient(circle_at_top,#1a1024,transparent_45%),var(--brand-bg-card)]">
      <div className="border-b border-[var(--brand-border)] px-6 py-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-gray-400">{eyebrow}</div>
            <h2 className="mt-1 text-2xl font-bold text-white">{title}</h2>
          </div>
          {action}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </section>
  )
}

function CallList({ calls, emptyText }) {
  if (!calls.length) return <EmptyState>{emptyText}</EmptyState>

  return (
    <div className="space-y-3">
      {calls.map((call) => (
        <div key={call.id} className="rounded-2xl border border-[var(--brand-border)] bg-black/20 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-violet-200">{formatDate(call.callDate || call.startedAt)}</span>
                <span className="rounded-full border border-[var(--brand-border)] bg-black/30 px-2.5 py-1 text-gray-300">{formatDuration(call.durationSecs)}</span>
                <span className="rounded-full border border-[var(--brand-border)] bg-black/30 px-2.5 py-1 text-gray-300">{call.repName || call.hostName || 'Unknown rep'}</span>
              </div>
              <h3 className="mt-3 text-lg font-semibold text-white">{call.meetingTopic || 'Untitled Zoom call'}</h3>
            </div>
            {call.callLink ? <a href={call.callLink} target="_blank" rel="noreferrer" className="inline-flex rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-sm font-medium text-violet-200 transition hover:border-violet-400/50 hover:text-white">Open recording ↗</a> : null}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function ClientIntelPage({ acronym, user }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)

  const loadClient = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(acronym)}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load client intel.')
      setData(json)
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [acronym])

  useEffect(() => {
    loadClient()
  }, [loadClient])

  const runSearch = useCallback(async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const params = new URLSearchParams({ q: searchQuery.trim() })
      const res = await fetch(`/api/clients/${encodeURIComponent(acronym)}/search?${params.toString()}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to search transcripts.')
      setSearchResults(json.results || [])
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSearching(false)
    }
  }, [acronym, searchQuery])

  const leadFlowRows = useMemo(() => (data?.leadFlow || []).slice().reverse(), [data?.leadFlow])
  const clientName = data?.clientInfo?.name || acronym

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-violet-300">Team Portal</div>
          <h1 className="mt-2 text-3xl font-bold text-white">Client Intel Card</h1>
          <p className="mt-1 text-sm text-gray-400">Full lifecycle view for GA, CX, and leadership. {user?.role === 'ga' ? 'Scoped to your client book.' : 'Shared internal view.'}</p>
        </div>
        <button onClick={loadClient} className="rounded-xl border border-[var(--brand-border)] px-4 py-2 text-sm font-medium text-gray-300 transition hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-white">Refresh</button>
      </div>

      {error ? <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}

      <div className="rounded-[32px] border border-[var(--brand-border)] bg-[radial-gradient(circle_at_top,#35104d,transparent_38%),linear-gradient(180deg,rgba(20,12,26,0.98),rgba(10,10,10,1))] p-8 text-center shadow-[0_0_60px_rgba(52,11,103,0.25)]">
        {loading && !data ? (
          <div className="text-sm text-gray-400">Loading client intel…</div>
        ) : (
          <>
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-300">Client Intel</div>
            <h2 className="mt-4 text-4xl font-bold text-white">{clientName}</h2>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-sm text-gray-300">
              <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-2 font-semibold uppercase tracking-wider text-violet-100">{data?.clientInfo?.acronym || acronym}</span>
              <span>Rep: {data?.clientInfo?.repName || 'Unknown'}</span>
              <span>Assigned GA: {data?.assignedGA || 'TBD'}</span>
              <span>Health: <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-amber-200">TBD</span></span>
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {[
                ['Sales Calls', data?.salesCalls?.length || 0],
                ['Transcript Segments', data?.transcriptCount || 0],
                ['Promise Items', data?.promiseLedger?.length || 0],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-[var(--brand-border)] bg-black/25 px-4 py-4">
                  <div className="text-xs uppercase tracking-wider text-gray-500">{label}</div>
                  <div className="mt-2 text-3xl font-bold text-white">{value}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-6">
          <SectionCard eyebrow="Sales History" title="Sales calls & promise ledger">
            <div className="space-y-6">
              <div>
                <div className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-violet-300">Sales Calls</div>
                <CallList calls={data?.salesCalls || []} emptyText="No sales review calls found for this client yet." />
              </div>

              <div>
                <div className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-violet-300">Promise Ledger</div>
                {!(data?.promiseLedger || []).length ? (
                  <EmptyState>No promises extracted yet.</EmptyState>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-[var(--brand-border)]">
                    <table className="min-w-full divide-y divide-[var(--brand-border)] text-left text-sm">
                      <thead className="bg-black/30 text-gray-400">
                        <tr>
                          <th className="px-4 py-3 font-medium">Promise</th>
                          <th className="px-4 py-3 font-medium">Category</th>
                          <th className="px-4 py-3 font-medium">Confidence</th>
                          <th className="px-4 py-3 font-medium">Risk</th>
                          <th className="px-4 py-3 font-medium">Evidence</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--brand-border)] bg-black/10">
                        {(data?.promiseLedger || []).map((item) => (
                          <tr key={item.id}>
                            <td className="px-4 py-4 align-top text-gray-200">{item.promiseText}</td>
                            <td className="px-4 py-4 align-top text-gray-300">{item.category}</td>
                            <td className="px-4 py-4 align-top"><span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${toneForConfidence(item.confidence)}`}>{item.confidence || 'unknown'}</span></td>
                            <td className="px-4 py-4 align-top"><span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${toneForRisk(item.riskFlag)}`}>{item.riskFlag || 'unknown'}</span></td>
                            <td className="px-4 py-4 align-top">{item.evidenceLink ? <a href={item.evidenceLink} target="_blank" rel="noreferrer" className="text-violet-300 hover:text-violet-200">Open evidence ↗</a> : <span className="text-gray-500">No link</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard eyebrow="Onboarding" title="Vision calls">
            <CallList calls={data?.onboardingCalls || []} emptyText="No vision calls found yet." />
          </SectionCard>

          <SectionCard eyebrow="GA Reviews" title="Ongoing review cadence">
            <CallList calls={data?.gaCalls || []} emptyText="No GA review calls found yet." />
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard eyebrow="Lead Flow" title="Lead / Tour / Registration trend">
            {!leadFlowRows.length ? (
              <EmptyState>No lead flow data yet.</EmptyState>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-[var(--brand-border)]">
                <table className="min-w-full divide-y divide-[var(--brand-border)] text-left text-sm">
                  <thead className="bg-black/30 text-gray-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">Month</th>
                      <th className="px-4 py-3 font-medium">Leads</th>
                      <th className="px-4 py-3 font-medium">Tours</th>
                      <th className="px-4 py-3 font-medium">Registrations</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--brand-border)] bg-black/10">
                    {leadFlowRows.map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-4 text-white">{row.month}</td>
                        <td className="px-4 py-4 text-violet-200">{row.leads}</td>
                        <td className="px-4 py-4 text-indigo-200">{row.tours}</td>
                        <td className="px-4 py-4 text-fuchsia-200">{row.registered}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <SectionCard
            eyebrow="Transcript Q&A"
            title="Ask anything about this client"
            action={
              <div className="flex w-full max-w-2xl gap-3">
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') runSearch()
                  }}
                  placeholder="Ask anything about this client…"
                  className="w-full rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-violet-500/50"
                />
                <button onClick={runSearch} disabled={searching || !searchQuery.trim()} className="rounded-2xl bg-[var(--brand-primary-2)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-primary-3)] disabled:cursor-not-allowed disabled:opacity-50">{searching ? 'Searching…' : 'Search'}</button>
              </div>
            }
          >
            {!searchResults.length ? (
              <EmptyState>Search the client transcript history to pull exact quotes, timestamps, and call links.</EmptyState>
            ) : (
              <div className="space-y-4">
                {searchResults.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-[var(--brand-border)] bg-black/20 p-5">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-violet-200">{item.speaker || 'Unknown speaker'}</span>
                      <span className="rounded-full border border-[var(--brand-border)] bg-black/30 px-2.5 py-1 text-gray-300">{formatDate(item.callDate)}</span>
                      <span className="rounded-full border border-[var(--brand-border)] bg-black/30 px-2.5 py-1 text-gray-300">{item.repName || 'Unknown rep'}</span>
                      <span className="rounded-full border border-[var(--brand-border)] bg-black/30 px-2.5 py-1 text-gray-300">{formatTimestamp(item.startMs)}</span>
                    </div>
                    <div className="mt-3 text-sm leading-7 text-gray-200">“{item.text}”</div>
                    <div className="mt-4 flex flex-wrap gap-4 text-sm">
                      {item.callLink ? <a href={item.callLink} target="_blank" rel="noreferrer" className="font-medium text-violet-300 hover:text-violet-200">Open recording ↗</a> : null}
                      {item.meetingTopic ? <span className="text-gray-500">{item.meetingTopic}</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
