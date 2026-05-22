'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import LeadIntelPanel from './LeadIntelPanel'

const STATUS_OPTIONS = ['verified', 'manually-entered', 'not-claimed', 'not-found', 'skip']
const CLAIM_OPTIONS = ['yes', 'no', 'unknown']

function formatDate(value, includeTime = true) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(includeTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  }).format(new Date(value))
}

function statusTone(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'validated') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
  if (normalized === 'rejected') return 'border-rose-500/30 bg-rose-500/10 text-rose-300'
  if (normalized === 'pending-review') return 'border-amber-500/30 bg-amber-500/10 text-amber-300'
  return 'border-violet-500/30 bg-violet-500/10 text-violet-200'
}

function locationStatusTone(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'verified') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
  if (normalized === 'manually-entered') return 'border-sky-500/30 bg-sky-500/10 text-sky-300'
  if (normalized === 'not-claimed') return 'border-rose-500/30 bg-rose-500/10 text-rose-300'
  if (normalized === 'skip') return 'border-gray-500/30 bg-gray-500/10 text-gray-300'
  return 'border-amber-500/30 bg-amber-500/10 text-amber-300'
}

function emptyManualLocation() {
  return {
    locationName: '',
    address: '',
    city: '',
    state: '',
    googleMapsUrl: '',
    reviewNotes: '',
    gbpClaimed: 'unknown',
    gbpStatus: 'manually-entered',
  }
}

export default function TeamReconPage({ user }) {
  const [drafts, setDrafts] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [loadingList, setLoadingList] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [error, setError] = useState('')
  const [savingDraft, setSavingDraft] = useState(false)
  const [savingLocationId, setSavingLocationId] = useState('')
  const [addingLocation, setAddingLocation] = useState(false)
  const [draftForm, setDraftForm] = useState({ prospectName: '', websiteUrl: '', notes: '' })
  const [locationDrafts, setLocationDrafts] = useState({})
  const [manualLocation, setManualLocation] = useState(emptyManualLocation())

  const loadDrafts = useCallback(async () => {
    setLoadingList(true)
    try {
      const res = await fetch('/api/recon/drafts', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load recon drafts.')
      const nextDrafts = json.drafts || []
      setDrafts(nextDrafts)
      setSelectedId((current) => current ?? nextDrafts[0]?.id ?? null)
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
      const res = await fetch(`/api/recon/drafts/${id}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load recon draft detail.')
      const draft = json.draft
      setDetail(draft)
      setDraftForm({
        prospectName: draft.prospectName || '',
        websiteUrl: draft.websiteUrl || '',
        notes: draft.notes || '',
      })
      setLocationDrafts(
        Object.fromEntries(
          (draft.locations || []).map((location) => [
            location.id,
            {
              locationName: location.locationName || '',
              address: location.address || '',
              city: location.city || '',
              state: location.state || '',
              googleMapsUrl: location.googleMapsUrl || '',
              reviewNotes: location.reviewNotes || '',
              gbpClaimed: location.gbpClaimed || 'unknown',
              gbpStatus: location.gbpStatus || 'not-found',
              manualData: location.manualData || {},
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
    loadDrafts()
  }, [loadDrafts])

  useEffect(() => {
    if (selectedId) loadDetail(selectedId)
  }, [selectedId, loadDetail])

  const selectedSummary = useMemo(() => drafts.find((item) => item.id === selectedId), [drafts, selectedId])

  function updateDraftForm(patch) {
    setDraftForm((current) => ({ ...current, ...patch }))
  }

  function updateLocationDraft(locationId, patch) {
    setLocationDrafts((current) => ({
      ...current,
      [locationId]: {
        ...(current[locationId] || {}),
        ...patch,
      },
    }))
  }

  async function saveDraft(status = detail?.status || 'pending-review') {
    if (!detail) return
    setSavingDraft(true)
    try {
      const locations = (detail.locations || []).map((location) => {
        const locDraft = locationDrafts[location.id] || {}
        return {
          id: location.id,
          locationName: locDraft.locationName || location.locationName,
          address: locDraft.address || null,
          city: locDraft.city || null,
          state: locDraft.state || null,
          googleMapsUrl: locDraft.googleMapsUrl || null,
          gbpClaimed: locDraft.gbpClaimed || location.gbpClaimed,
          gbpStatus: locDraft.gbpStatus || location.gbpStatus,
          reviewNotes: locDraft.reviewNotes || null,
          manualData: {
            ...(location.manualData || {}),
            address: locDraft.address || null,
            city: locDraft.city || null,
            state: locDraft.state || null,
            googleMapsUrl: locDraft.googleMapsUrl || null,
            reviewNotes: locDraft.reviewNotes || null,
          },
        }
      })

      const res = await fetch(`/api/recon/drafts/${detail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospectName: draftForm.prospectName,
          websiteUrl: draftForm.websiteUrl,
          notes: draftForm.notes,
          status,
          reviewedBy: status === 'validated' ? user?.email : null,
          validatedData: {
            prospectName: draftForm.prospectName,
            websiteUrl: draftForm.websiteUrl,
            notes: draftForm.notes,
            locations,
          },
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to save recon draft.')
      await Promise.all([loadDrafts(), loadDetail(detail.id)])
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingDraft(false)
    }
  }

  async function saveLocation(locationId) {
    const locDraft = locationDrafts[locationId]
    if (!locDraft) return
    setSavingLocationId(locationId)
    try {
      const res = await fetch(`/api/recon/drafts/${detail.id}/locations/${locationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationName: locDraft.locationName,
          address: locDraft.address,
          city: locDraft.city,
          state: locDraft.state,
          googleMapsUrl: locDraft.googleMapsUrl,
          gbpClaimed: locDraft.gbpClaimed,
          gbpStatus: locDraft.gbpStatus,
          reviewNotes: locDraft.reviewNotes,
          manualData: {
            address: locDraft.address || null,
            city: locDraft.city || null,
            state: locDraft.state || null,
            googleMapsUrl: locDraft.googleMapsUrl || null,
            reviewNotes: locDraft.reviewNotes || null,
          },
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to save location.')
      await Promise.all([loadDrafts(), loadDetail(detail.id)])
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingLocationId('')
    }
  }

  async function addManualLocation() {
    if (!detail) return
    if (!manualLocation.locationName.trim()) {
      setError('Manual locations need a location name.')
      return
    }

    setAddingLocation(true)
    try {
      const res = await fetch(`/api/recon/drafts/${detail.id}/locations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manualLocation),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to add manual location.')
      setManualLocation(emptyManualLocation())
      await Promise.all([loadDrafts(), loadDetail(detail.id)])
    } catch (err) {
      setError(err.message)
    } finally {
      setAddingLocation(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      {/* Lead Intel Panel */}
      <LeadIntelPanel />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-violet-300">Team Portal</div>
          <h1 className="mt-2 text-3xl font-bold text-white">Recon Review Queue</h1>
          <p className="mt-1 text-sm text-gray-400">Validate GBP/location inputs before a brief gets generated.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={loadDrafts} className="rounded-xl border border-[var(--brand-border)] px-4 py-2 text-sm font-medium text-gray-300 transition hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-white">Refresh</button>
          <button onClick={() => saveDraft('pending-review')} disabled={!detail || savingDraft} className="rounded-xl border border-[var(--brand-border)] px-4 py-2 text-sm font-medium text-gray-300 transition hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50">{savingDraft ? 'Saving…' : 'Save draft'}</button>
          <button onClick={() => saveDraft('validated')} disabled={!detail || savingDraft} className="rounded-xl bg-[var(--brand-primary-2)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-primary-3)] disabled:cursor-not-allowed disabled:opacity-50">Submit for Brief Generation</button>
        </div>
      </div>

      {error ? <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-bg-card)] overflow-hidden">
          <div className="border-b border-[var(--brand-border)] px-5 py-4">
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-gray-400">Pending queue</div>
            <div className="mt-1 text-sm text-gray-300">{loadingList ? 'Loading drafts…' : `${drafts.length} drafts waiting for review`}</div>
          </div>
          <div className="max-h-[calc(100vh-240px)] overflow-y-auto">
            {loadingList ? (
              <div className="p-5 text-sm text-gray-300">Loading drafts…</div>
            ) : drafts.length === 0 ? (
              <div className="p-5 text-sm text-gray-300">No pending recon drafts.</div>
            ) : (
              <div className="divide-y divide-[var(--brand-border)]">
                {drafts.map((draft) => {
                  const active = draft.id === selectedId
                  return (
                    <button key={draft.id} onClick={() => setSelectedId(draft.id)} className={`w-full px-5 py-4 text-left transition ${active ? 'bg-violet-500/10' : 'hover:bg-white/3'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-base font-semibold text-white">{draft.prospectName}</div>
                          <div className="mt-1 text-sm text-gray-400">{draft.websiteUrl}</div>
                        </div>
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${statusTone(draft.status)}`}>{draft.status}</span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-gray-400">
                        <div className="rounded-xl border border-[var(--brand-border)] bg-black/20 px-3 py-2"><div>Locations</div><div className="mt-1 text-sm font-semibold text-white">{draft.locationCount}</div></div>
                        <div className="rounded-xl border border-[var(--brand-border)] bg-black/20 px-3 py-2"><div>Verified</div><div className="mt-1 text-sm font-semibold text-white">{draft.verifiedCount}</div></div>
                        <div className="rounded-xl border border-[var(--brand-border)] bg-black/20 px-3 py-2"><div>Created</div><div className="mt-1 text-sm font-semibold text-white">{formatDate(draft.createdAt, false)}</div></div>
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
              <div className="text-sm text-gray-300">Loading draft detail…</div>
            ) : detail ? (
              <div className="space-y-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-300">Recon draft</div>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <h2 className="text-2xl font-bold text-white">{selectedSummary?.prospectName || detail.prospectName}</h2>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wider ${statusTone(detail.status)}`}>{detail.status}</span>
                    </div>
                    <div className="mt-2 text-sm text-gray-400">Requested by {detail.requestedBy || 'unknown'} · Created {formatDate(detail.createdAt)}</div>
                    <div className="mt-1 text-sm text-gray-300">Last reviewed {formatDate(detail.reviewedAt)}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      ['Locations found', detail.locationCount || detail.locations?.length || 0],
                      ['Verified', detail.verifiedCount || 0],
                      ['Reviewer', detail.reviewedBy || '—'],
                      ['You', user?.email || '—'],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-[var(--brand-border)] bg-black/20 px-4 py-3">
                        <div className="text-xs uppercase tracking-wider text-gray-300">{label}</div>
                        <div className="mt-1 text-sm font-semibold text-white">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <div className="mb-2 text-sm font-medium text-gray-300">Prospect name</div>
                    <input value={draftForm.prospectName} onChange={(event) => updateDraftForm({ prospectName: event.target.value })} className="w-full rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-3 text-sm text-white outline-none transition focus:border-violet-500/50" />
                  </div>
                  <div>
                    <div className="mb-2 text-sm font-medium text-gray-300">Website</div>
                    <input value={draftForm.websiteUrl} onChange={(event) => updateDraftForm({ websiteUrl: event.target.value })} className="w-full rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-3 text-sm text-white outline-none transition focus:border-violet-500/50" />
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-sm font-medium text-gray-300">Reviewer notes</div>
                  <textarea rows={3} value={draftForm.notes} onChange={(event) => updateDraftForm({ notes: event.target.value })} placeholder="Anything the brief generator should know…" className="w-full rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-300 focus:border-violet-500/50" />
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-300">Select a recon draft.</div>
            )}
          </div>

          <div className="rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-bg-card)] overflow-hidden">
            <div className="border-b border-[var(--brand-border)] px-6 py-4">
              <div className="text-sm font-semibold uppercase tracking-[0.24em] text-gray-400">Location review</div>
              <div className="mt-1 text-sm text-gray-300">Confirm the real GBP footprint before brief generation.</div>
            </div>
            <div className="space-y-4 p-6">
              {!detail ? (
                <div className="text-sm text-gray-300">No draft selected.</div>
              ) : (detail.locations || []).length === 0 ? (
                <div className="text-sm text-gray-300">No locations found yet. Add one manually below.</div>
              ) : (
                (detail.locations || []).map((location, index) => {
                  const locDraft = locationDrafts[location.id] || {}
                  const isSaving = savingLocationId === location.id
                  return (
                    <div key={location.id} className="rounded-2xl border border-[var(--brand-border)] bg-black/20 p-5">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="space-y-3">
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-200">Location #{index + 1}</span>
                            <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${locationStatusTone(locDraft.gbpStatus || location.gbpStatus)}`}>{locDraft.gbpStatus || location.gbpStatus}</span>
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-white">{location.locationName}</h3>
                            <p className="mt-1 text-sm text-gray-400">{location.address || 'No street address'}{location.city || location.state ? ` · ${[location.city, location.state].filter(Boolean).join(', ')}` : ''}</p>
                          </div>
                          {location.autoData ? <pre className="max-w-2xl overflow-x-auto rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-bg)] p-3 text-xs text-gray-400">{JSON.stringify(location.autoData, null, 2)}</pre> : null}
                        </div>

                        <div className="w-full max-w-3xl space-y-4">
                          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <div className="xl:col-span-2">
                              <div className="mb-2 text-sm font-medium text-gray-300">Location name</div>
                              <input value={locDraft.locationName || ''} onChange={(event) => updateLocationDraft(location.id, { locationName: event.target.value })} className="w-full rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-3 text-sm text-white outline-none transition focus:border-violet-500/50" />
                            </div>
                            <div>
                              <div className="mb-2 text-sm font-medium text-gray-300">City</div>
                              <input value={locDraft.city || ''} onChange={(event) => updateLocationDraft(location.id, { city: event.target.value })} className="w-full rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-3 text-sm text-white outline-none transition focus:border-violet-500/50" />
                            </div>
                            <div>
                              <div className="mb-2 text-sm font-medium text-gray-300">State</div>
                              <input value={locDraft.state || ''} onChange={(event) => updateLocationDraft(location.id, { state: event.target.value })} className="w-full rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-3 text-sm text-white outline-none transition focus:border-violet-500/50" />
                            </div>
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <div className="mb-2 text-sm font-medium text-gray-300">Address</div>
                              <input value={locDraft.address || ''} onChange={(event) => updateLocationDraft(location.id, { address: event.target.value })} className="w-full rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-3 text-sm text-white outline-none transition focus:border-violet-500/50" />
                            </div>
                            <div>
                              <div className="mb-2 text-sm font-medium text-gray-300">Google Maps URL</div>
                              <input value={locDraft.googleMapsUrl || ''} onChange={(event) => updateLocationDraft(location.id, { googleMapsUrl: event.target.value })} className="w-full rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-3 text-sm text-white outline-none transition focus:border-violet-500/50" />
                            </div>
                          </div>

                          <div>
                            <div className="mb-2 text-sm font-medium text-gray-300">GBP claimed</div>
                            <div className="flex flex-wrap gap-2">
                              {CLAIM_OPTIONS.map((option) => {
                                const active = (locDraft.gbpClaimed || location.gbpClaimed) === option
                                return <button key={option} onClick={() => updateLocationDraft(location.id, { gbpClaimed: option })} className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${active ? 'border-violet-400 bg-violet-500/20 text-white' : 'border-[var(--brand-border)] text-gray-300 hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-white'}`}>{option.toUpperCase()}</button>
                              })}
                            </div>
                          </div>

                          <div>
                            <div className="mb-2 text-sm font-medium text-gray-300">GBP status</div>
                            <div className="flex flex-wrap gap-2">
                              {STATUS_OPTIONS.map((option) => {
                                const active = (locDraft.gbpStatus || location.gbpStatus) === option
                                const label = option === 'verified' ? 'Verified ✅' : option === 'manually-entered' ? 'Manually entered ✏️' : option === 'not-claimed' ? 'Not claimed 🚫' : option === 'not-found' ? 'Not found ❓' : 'Skip ⏭️'
                                return <button key={option} onClick={() => updateLocationDraft(location.id, { gbpStatus: option })} className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${active ? 'border-violet-400 bg-violet-500/20 text-white' : 'border-[var(--brand-border)] text-gray-300 hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-white'}`}>{label}</button>
                              })}
                            </div>
                          </div>

                          <div>
                            <div className="mb-2 text-sm font-medium text-gray-300">Review notes</div>
                            <textarea rows={3} value={locDraft.reviewNotes || ''} onChange={(event) => updateLocationDraft(location.id, { reviewNotes: event.target.value })} placeholder="What changed? What did you verify manually?" className="w-full rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-300 focus:border-violet-500/50" />
                          </div>

                          <div className="flex justify-end">
                            <button onClick={() => saveLocation(location.id)} disabled={isSaving} className="rounded-2xl bg-[var(--brand-primary-2)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-primary-3)] disabled:cursor-not-allowed disabled:opacity-50">{isSaving ? 'Saving…' : 'Save location'}</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {detail ? (
            <div className="rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-bg-card)] p-6">
              <div className="text-sm font-semibold uppercase tracking-[0.24em] text-gray-400">Add location manually</div>
              <div className="mt-1 text-sm text-gray-300">Use this when the auto pull missed a location completely.</div>
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <input value={manualLocation.locationName} onChange={(event) => setManualLocation((current) => ({ ...current, locationName: event.target.value }))} placeholder="Location name" className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-300 focus:border-violet-500/50 xl:col-span-2" />
                <input value={manualLocation.city} onChange={(event) => setManualLocation((current) => ({ ...current, city: event.target.value }))} placeholder="City" className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-300 focus:border-violet-500/50" />
                <input value={manualLocation.state} onChange={(event) => setManualLocation((current) => ({ ...current, state: event.target.value }))} placeholder="State" className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-300 focus:border-violet-500/50" />
                <input value={manualLocation.address} onChange={(event) => setManualLocation((current) => ({ ...current, address: event.target.value }))} placeholder="Address" className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-300 focus:border-violet-500/50 xl:col-span-2" />
                <input value={manualLocation.googleMapsUrl} onChange={(event) => setManualLocation((current) => ({ ...current, googleMapsUrl: event.target.value }))} placeholder="Google Maps URL" className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-300 focus:border-violet-500/50 xl:col-span-2" />
              </div>
              <textarea rows={3} value={manualLocation.reviewNotes} onChange={(event) => setManualLocation((current) => ({ ...current, reviewNotes: event.target.value }))} placeholder="Why this location was added manually…" className="mt-4 w-full rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-300 focus:border-violet-500/50" />
              <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-2">
                  {CLAIM_OPTIONS.map((option) => {
                    const active = manualLocation.gbpClaimed === option
                    return <button key={option} onClick={() => setManualLocation((current) => ({ ...current, gbpClaimed: option }))} className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${active ? 'border-violet-400 bg-violet-500/20 text-white' : 'border-[var(--brand-border)] text-gray-300 hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-white'}`}>Claimed: {option}</button>
                  })}
                </div>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((option) => {
                    const active = manualLocation.gbpStatus === option
                    return <button key={option} onClick={() => setManualLocation((current) => ({ ...current, gbpStatus: option }))} className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${active ? 'border-violet-400 bg-violet-500/20 text-white' : 'border-[var(--brand-border)] text-gray-300 hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-white'}`}>{option}</button>
                  })}
                </div>
                <button onClick={addManualLocation} disabled={addingLocation} className="rounded-2xl bg-[var(--brand-primary-2)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-primary-3)] disabled:cursor-not-allowed disabled:opacity-50">{addingLocation ? 'Adding…' : 'Add location manually'}</button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
