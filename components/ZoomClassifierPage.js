'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ─── Constants ────────────────────────────────────────────────────────────────
const CLASSIFICATION_OPTIONS = [
  { value: 'sales', label: 'Sales' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'client_meeting', label: 'Client Meeting' },
  { value: 'internal', label: 'Internal' },
  { value: 'one_on_one', label: '1:1' },
  { value: 'blueprint', label: 'Blueprint' },
  { value: 'other', label: 'Other' },
]

const SALES_REPS = [
  { name: 'Jesse', email: 'jesse@growyourcenter.com' },
  { name: 'Briana', email: 'briana@growyourcenter.com' },
  { name: 'Pia', email: 'pia@growyourcenter.com' },
]

const GROWTH_ADVISORS = [
  { name: 'Sebastian', email: 'sebastian@growyourcenter.com' },
  { name: 'Stefen', email: 'stefen@growyourcenter.com' },
  { name: 'JC', email: 'jc@growyourcenter.com' },
  { name: 'Zu', email: 'zu@growyourcenter.com' },
]

const ONBOARDING_AGENTS = [
  { name: 'Briana', email: 'briana@growyourcenter.com' },
  { name: 'Zu', email: 'zu@growyourcenter.com' },
]

const ALL_GYC_STAFF = [
  { name: 'Todd', email: 'todd@growyourcenter.com' },
  { name: 'Bruce', email: 'bruce@growyourcenter.com' },
  { name: 'Zac', email: 'zac@growyourcenter.com' },
  { name: 'Carmella', email: 'carmella@growyourcenter.com' },
  { name: 'Lex', email: 'lex@growyourcenter.com' },
  { name: 'Travis', email: 'travis@growyourcenter.com' },
  { name: 'Kaci', email: 'kaci@growyourcenter.com' },
  { name: 'Jesse', email: 'jesse@growyourcenter.com' },
  { name: 'Briana', email: 'briana@growyourcenter.com' },
  { name: 'Pia', email: 'pia@growyourcenter.com' },
  { name: 'Sebastian', email: 'sebastian@growyourcenter.com' },
  { name: 'Stefen', email: 'stefen@growyourcenter.com' },
  { name: 'JC', email: 'jc@growyourcenter.com' },
  { name: 'Zu', email: 'zu@growyourcenter.com' },
]

const TYPE_COLORS = {
  sales: '#22c55e',
  onboarding: '#3b82f6',
  client_meeting: '#8b5cf6',
  internal: '#f59e0b',
  one_on_one: '#ec4899',
  blueprint: '#06b6d4',
  unknown: '#6b7280',
  other: '#6b7280',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(date) {
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  }).format(new Date(date))
}

function fmtDuration(mins) {
  if (!mins) return '—'
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

function confidenceBadge(confidence, type) {
  if (!type || type === 'unknown') return null
  const pct = Math.round((confidence || 0) * 100)
  const color = TYPE_COLORS[type] || '#6b7280'
  const label = type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  return { label, pct, color }
}

// ─── CallCard ─────────────────────────────────────────────────────────────────
function CallCard({ call, isSelected, onClick }) {
  const [showTranscript, setShowTranscript] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const badge = confidenceBadge(call.aiConfidence, call.aiClassification)
  const participants = Array.isArray(call.participants) ? call.participants : []
  const ghlMatched = Boolean(call.ghlContactId)

  return (
    <div
      onClick={onClick}
      style={{
        background: isSelected ? '#1a0a2e' : '#111',
        border: isSelected ? '1px solid #7c3aed' : '1px solid #2a1a3e',
        borderRadius: 10,
        padding: '12px 14px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        marginBottom: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#fff', fontWeight: 600, fontSize: 13, marginBottom: 2 }} className="truncate">
            {call.topic || call.meetingId || '(No topic)'}
          </div>
          <div style={{ color: '#6b7280', fontSize: 11 }}>
            {fmt(call.startTime)} · {fmtDuration(call.duration)}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <div
            title={ghlMatched ? `GHL: ${call.ghlContactName}` : 'No GHL match'}
            style={{ width: 7, height: 7, borderRadius: '50%', background: ghlMatched ? '#22c55e' : '#f59e0b' }}
          />
          {call.recordingUrl && (
            <a
              href={call.recordingUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              title="Open recording"
              style={{ color: '#7c3aed', fontSize: 14, textDecoration: 'none' }}
            >🎥</a>
          )}
        </div>
      </div>

      {participants.length > 0 && (
        <div style={{ marginTop: 5, color: '#9ca3af', fontSize: 11 }}>
          👥 {participants.slice(0, 4).map(p => p.name || p.email).filter(Boolean).join(', ')}
          {participants.length > 4 && ` +${participants.length - 4}`}
        </div>
      )}

      {badge && (
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10 }}>🤖</span>
          <span style={{
            background: badge.color + '22',
            color: badge.color,
            border: `1px solid ${badge.color}44`,
            borderRadius: 6,
            padding: '1px 7px',
            fontSize: 10,
            fontWeight: 600,
          }}>
            {badge.label} — {badge.pct}%
          </span>
          {call.classifiedAs && (
            <span style={{ color: '#22c55e', fontSize: 10 }}>✓ Classified</span>
          )}
        </div>
      )}

      <div style={{ marginTop: 6, display: 'flex', gap: 10 }}>
        {call.aiSummary && (
          <button
            onClick={e => { e.stopPropagation(); setShowSummary(s => !s) }}
            style={{ color: '#7c3aed', fontSize: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            {showSummary ? '▲ Hide summary' : '▼ AI summary'}
          </button>
        )}
        {call.transcriptUrl && (
          <button
            onClick={e => { e.stopPropagation(); setShowTranscript(s => !s) }}
            style={{ color: '#6b7280', fontSize: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            {showTranscript ? '▲ Hide transcript' : '▼ Transcript'}
          </button>
        )}
      </div>

      {showSummary && call.aiSummary && (
        <div style={{ marginTop: 6, color: '#d1d5db', fontSize: 11, lineHeight: 1.5, background: '#0a0a0a', borderRadius: 6, padding: '7px 10px' }}>
          {call.aiSummary}
        </div>
      )}

      {showTranscript && (
        <div style={{ marginTop: 6, color: '#9ca3af', fontSize: 10, lineHeight: 1.5, background: '#0a0a0a', borderRadius: 6, padding: '7px 10px', maxHeight: 160, overflowY: 'auto', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
          {call.transcriptText ? call.transcriptText.slice(0, 2000) : '(No transcript — open recording to view)'}
        </div>
      )}
    </div>
  )
}

// ─── GHL Contact constants ────────────────────────────────────────────────────
const GYC_DOMAINS = ['@growyourcenter.com', '@gyc.', 'brucewspurr']
function isGycStaff(email = '') {
  return GYC_DOMAINS.some(d => email.toLowerCase().includes(d))
}

// ─── GHL Contact Linker ───────────────────────────────────────────────────────
function GhlContactLinker({ callId, onLinked }) {
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState([])
  const [searching, setSearching] = useState(false)
  const [linking, setLinking]   = useState(false)
  const [searchErr, setSearchErr] = useState('')
  const debounceRef = useRef(null)

  async function doSearch(q) {
    if (!q || q.length < 2) { setResults([]); return }
    setSearching(true)
    setSearchErr('')
    try {
      const res = await fetch(`/api/ghl/contacts/search?q=${encodeURIComponent(q)}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Search failed')
      setResults(json.contacts || [])
    } catch (err) {
      setSearchErr(err.message)
    } finally {
      setSearching(false)
    }
  }

  function handleQueryChange(e) {
    const val = e.target.value
    setQuery(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(val), 400)
  }

  async function handleSelect(contact) {
    setLinking(true)
    try {
      const res = await fetch(`/api/zoom/calls/${callId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ghlContactId: contact.id,
          ghlContactName: contact.name,
          ghlPipelineStage: contact.stage || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Link failed')
      onLinked(json.call)
    } catch (err) {
      setSearchErr(err.message)
    } finally {
      setLinking(false)
    }
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ color: '#9ca3af', fontSize: 11, marginBottom: 5 }}>Link to GHL Contact</div>
      <div style={{ position: 'relative' }}>
        <input
          value={query}
          onChange={handleQueryChange}
          placeholder="Search by name or email…"
          style={{
            width: '100%', boxSizing: 'border-box',
            background: '#1a0a2e', color: '#fff',
            border: '1px solid #3d1f6e', borderRadius: 7,
            padding: '6px 10px', fontSize: 12,
          }}
        />
        {searching && (
          <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: '#6b7280', fontSize: 10 }}>searching…</span>
        )}
      </div>
      {searchErr && <div style={{ color: '#f87171', fontSize: 11, marginTop: 4 }}>{searchErr}</div>}
      {results.length > 0 && (
        <div style={{ marginTop: 4, background: '#0d0d1a', border: '1px solid #3d1f6e', borderRadius: 7, overflow: 'hidden' }}>
          {results.map(c => (
            <button
              key={c.id}
              onClick={() => handleSelect(c)}
              disabled={linking}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                background: 'none', border: 'none', borderBottom: '1px solid #2a1a3e',
                padding: '7px 10px', cursor: 'pointer',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#1a0a2e'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <div style={{ color: '#e2d9f3', fontSize: 12, fontWeight: 600 }}>{c.name}</div>
              <div style={{ color: '#6b7280', fontSize: 10, marginTop: 1 }}>
                {c.email}{c.stage ? ` · ${c.stage}` : ''}{c.pipeline ? ` · ${c.pipeline}` : ''}
              </div>
            </button>
          ))}
        </div>
      )}
      {query.length >= 2 && !searching && results.length === 0 && !searchErr && (
        <div style={{ color: '#6b7280', fontSize: 11, marginTop: 5, textAlign: 'center' }}>No contacts found for "{query}"</div>
      )}
    </div>
  )
}

// ─── ClassificationForm ───────────────────────────────────────────────────────
function ClassificationForm({ call: initialCall, onSaved }) {
  const [call, setCall] = useState(initialCall)
  const [form, setForm] = useState({
    classifiedAs: initialCall.classifiedAs || initialCall.aiClassification || '',
    assignedRepEmail: initialCall.assignedRepEmail || '',
    assignedRepName: initialCall.assignedRepName || '',
    notes: initialCall.notes || '',
  })
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [error, setError]     = useState('')
  const [askQ, setAskQ]       = useState('')
  const [askAnswer, setAskAnswer] = useState('')
  const [asking, setAsking]   = useState(false)

  // ── Smart form state ──────────────────────────────────────────────────────
  const [dealClosed, setDealClosed]         = useState(false)
  const [gaEmail, setGaEmail]               = useState('')
  const [gaName, setGaName]                 = useState('')
  const [onboardingEmail, setOnboardingEmail] = useState('')
  const [onboardingName, setOnboardingName] = useState('')
  const [staffTags, setStaffTags]           = useState([])
  const [groupSession, setGroupSession]     = useState(false)

  // ── Client Lookup state ───────────────────────────────────────────────────
  const [clientSearch, setClientSearch]       = useState('')
  const [clientResults, setClientResults]     = useState([])
  const [clientSearching, setClientSearching] = useState(false)
  const [selectedClient, setSelectedClient]   = useState(null)
  const [clientErr, setClientErr]             = useState('')
  const clientDebounceRef = useRef(null)

  // ── Shared styles (defined early so inner functions can reference) ─────────
  const sectionLabel = {
    color: '#9ca3af', fontSize: 10, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.1em',
    marginBottom: 6, display: 'block',
  }
  const divider = { borderTop: '1px solid #2a1a3e', margin: '10px 0' }
  const selectStyle = {
    width: '100%', background: '#1a0a2e', color: '#fff',
    border: '1px solid #2a1a3e', borderRadius: 8, padding: '7px 10px', fontSize: 13,
  }

  // ── Auto-populate + reset on call change ─────────────────────────────────
  useEffect(() => {
    const host         = (initialCall.hostEmail || '').toLowerCase()
    const participants = Array.isArray(initialCall.participants) ? initialCall.participants : []

    const matchedRep = SALES_REPS.find(r => r.email.toLowerCase() === host)
    const matchedGA  = GROWTH_ADVISORS.find(r => r.email.toLowerCase() === host)

    const gycParticipants = participants.filter(p => {
      const email = (p.email || '').toLowerCase()
      return GYC_DOMAINS.some(d => email.includes(d.toLowerCase()))
    })

    setCall(initialCall)
    setForm({
      classifiedAs: initialCall.classifiedAs || initialCall.aiClassification || '',
      assignedRepEmail: matchedRep?.email || initialCall.assignedRepEmail || '',
      assignedRepName:  matchedRep?.name  || initialCall.assignedRepName  || '',
      notes: initialCall.notes || '',
    })
    setGaEmail(matchedGA?.email || '')
    setGaName(matchedGA?.name  || '')
    setOnboardingEmail('')
    setOnboardingName('')
    setDealClosed(false)
    setGroupSession(false)
    setStaffTags(gycParticipants.map(p => ({ name: p.name || p.email || '', email: p.email || '' })))
    setAskAnswer('')
    setAskQ('')
    setError('')
    setSaved(false)
    setClientSearch('')
    setClientResults([])
    setSelectedClient(null)
    setClientErr('')
  }, [initialCall.id])

  // ── Client lookup handlers ────────────────────────────────────────────────
  function handleClientSearch(e) {
    const val = e.target.value
    setClientSearch(val)
    setSelectedClient(null)
    clearTimeout(clientDebounceRef.current)
    if (!val || val.length < 1) { setClientResults([]); return }
    clientDebounceRef.current = setTimeout(async () => {
      setClientSearching(true)
      setClientErr('')
      try {
        const res = await fetch(`/api/clients/search?q=${encodeURIComponent(val)}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Search failed')
        setClientResults(json.results || [])
      } catch (err) {
        setClientErr(err.message)
      } finally {
        setClientSearching(false)
      }
    }, 350)
  }

  function selectClient(c) {
    setSelectedClient(c)
    setClientSearch('')
    setClientResults([])
    setClientErr('')
  }

  function clearClient() {
    setSelectedClient(null)
    setClientSearch('')
    setClientResults([])
  }

  function handleRepChange(email) {
    const rep = SALES_REPS.find(r => r.email === email)
    setForm(f => ({ ...f, assignedRepEmail: email, assignedRepName: rep?.name || '' }))
  }

  function handleGaChange(email) {
    const ga = GROWTH_ADVISORS.find(r => r.email === email)
    setGaEmail(email)
    setGaName(ga?.name || '')
  }

  function handleOnboardingChange(email) {
    const agent = ONBOARDING_AGENTS.find(r => r.email === email)
    setOnboardingEmail(email)
    setOnboardingName(agent?.name || '')
  }

  function removeStaffTag(email) {
    setStaffTags(prev => prev.filter(t => t.email !== email))
  }

  async function handleSave() {
    if (!form.classifiedAs) { setError('Select a classification first'); return }
    setSaving(true)
    setError('')
    try {
      const patchBody = {
        classifiedAs: form.classifiedAs,
        notes: form.notes,
        ...(form.assignedRepEmail ? { assignedRepEmail: form.assignedRepEmail, assignedRepName: form.assignedRepName } : {}),
        ...(gaEmail ? { gaEmail, gaName } : {}),
        ...(onboardingEmail ? { onboardingAgentEmail: onboardingEmail, onboardingAgentName: onboardingName } : {}),
        dealClosed,
        ...(selectedClient ? { clientProfileId: selectedClient.id, acronym: selectedClient.acronym } : {}),
      }
      const res = await fetch(`/api/zoom/calls/${call.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patchBody),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Save failed')
      setSaved(true)
      onSaved(json.call)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleAsk() {
    if (!askQ.trim()) return
    setAsking(true)
    setAskAnswer('')
    try {
      const res = await fetch('/api/zoom/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ callId: call.id, question: askQ }),
      })
      const json = await res.json()
      setAskAnswer(json.answer || json.error || 'No response')
    } catch {
      setAskAnswer('Request failed.')
    } finally {
      setAsking(false)
    }
  }

  function handleGhlLinked(updatedCall) {
    setCall(prev => ({ ...prev, ...updatedCall }))
    onSaved(updatedCall)
  }

  // ── Client lookup field (reusable inside renderTypeFields) ───────────────
  function ClientLookupField({ required = false }) {
    return (
      <div style={{ marginBottom: 10 }}>
        <label style={{ ...sectionLabel, marginBottom: 5 }}>
          Client (Acronym or Name){required && <span style={{ color: '#ef4444' }}> *</span>}
        </label>
        {selectedClient ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0a1a0d', border: '1px solid #22c55e44', borderRadius: 8, padding: '7px 12px', fontSize: 12 }}>
            <div>
              <span style={{ color: '#4ade80', fontWeight: 700 }}>{selectedClient.acronym}</span>
              <span style={{ color: '#9ca3af' }}> — {selectedClient.companyName}</span>
              <div style={{ color: '#6b7280', fontSize: 10, marginTop: 2 }}>
                {selectedClient.assignedGA && <span>{selectedClient.assignedGA}</span>}
                {selectedClient.status && <span> · {selectedClient.status}</span>}
              </div>
            </div>
            <button onClick={clearClient} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 2px' }} title="Clear client">✕</button>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            <input
              value={clientSearch}
              onChange={handleClientSearch}
              placeholder="Search by acronym or company name…"
              style={{ width: '100%', boxSizing: 'border-box', background: '#1a0a2e', color: '#fff', border: '1px solid #2a1a3e', borderRadius: 8, padding: '7px 10px', fontSize: 12 }}
            />
            {clientSearching && (
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#6b7280', fontSize: 10 }}>searching…</span>
            )}
          </div>
        )}
        {clientErr && <div style={{ color: '#f87171', fontSize: 11, marginTop: 4 }}>{clientErr}</div>}
        {!selectedClient && clientResults.length > 0 && (
          <div style={{ marginTop: 4, background: '#0d0d1a', border: '1px solid #3d1f6e', borderRadius: 8, overflow: 'hidden' }}>
            {clientResults.map(c => (
              <button
                key={c.id}
                onClick={() => selectClient(c)}
                style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid #2a1a3e', padding: '7px 10px', cursor: 'pointer', transition: 'background 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#1a0a2e'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <span style={{ color: '#c4b5fd', fontWeight: 700, fontSize: 12 }}>{c.acronym}</span>
                <span style={{ color: '#9ca3af', fontSize: 12 }}> — {c.companyName}</span>
                <div style={{ color: '#6b7280', fontSize: 10, marginTop: 2 }}>
                  {c.assignedGA && <span>{c.assignedGA}</span>}
                  {c.status && <span> · {c.status}</span>}
                </div>
              </button>
            ))}
          </div>
        )}
        {!selectedClient && clientSearch.length >= 1 && !clientSearching && clientResults.length === 0 && !clientErr && (
          <div style={{ color: '#6b7280', fontSize: 11, marginTop: 5, textAlign: 'center' }}>No clients found for "{clientSearch}"</div>
        )}
      </div>
    )
  }

  // ── Toggle button helper ───────────────────────────────────────────────────
  function ToggleBtn({ value, label, active, activeColor, activeBg, activeBorder, onClick }) {
    return (
      <button
        onClick={onClick}
        style={{
          padding: '5px 16px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          background: active ? activeBg : '#1a0a2e',
          color: active ? activeColor : '#9ca3af',
          border: `1px solid ${active ? activeBorder : '#2a1a3e'}`,
        }}
      >{label}</button>
    )
  }

  // ── Type-specific fields ──────────────────────────────────────────────────
  function renderTypeFields() {
    const t = form.classifiedAs
    if (!t) return null

    if (t === 'sales') {
      return (
        <>
          {/* Sales Rep */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ ...sectionLabel, marginBottom: 5 }}>Sales Rep <span style={{ color: '#ef4444' }}>*</span></label>
            <select value={form.assignedRepEmail} onChange={e => handleRepChange(e.target.value)} style={selectStyle}>
              <option value="">— Select rep —</option>
              {SALES_REPS.map(r => <option key={r.email} value={r.email}>{r.name}</option>)}
            </select>
          </div>
          {/* Deal closed toggle */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ ...sectionLabel, marginBottom: 5 }}>Did this call close the deal?</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <ToggleBtn label="No"  active={!dealClosed} onClick={() => setDealClosed(false)} activeColor="#9ca3af" activeBg="#2a1a3e" activeBorder="#4a3060" />
              <ToggleBtn label="Yes" active={dealClosed}  onClick={() => setDealClosed(true)}  activeColor="#4ade80" activeBg="#22c55e22" activeBorder="#22c55e44" />
            </div>
          </div>
          {/* If closed: Onboarding Agent + Growth Advisor */}
          {dealClosed && (
            <>
              <div style={{ marginBottom: 10 }}>
                <label style={{ ...sectionLabel, marginBottom: 5 }}>Onboarding Agent</label>
                <select value={onboardingEmail} onChange={e => handleOnboardingChange(e.target.value)} style={selectStyle}>
                  <option value="">— Select agent —</option>
                  {ONBOARDING_AGENTS.map(r => <option key={r.email} value={r.email}>{r.name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ ...sectionLabel, marginBottom: 5 }}>Growth Advisor</label>
                <select value={gaEmail} onChange={e => handleGaChange(e.target.value)} style={selectStyle}>
                  <option value="">— Select GA —</option>
                  {GROWTH_ADVISORS.map(r => <option key={r.email} value={r.email}>{r.name}</option>)}
                </select>
              </div>
            </>
          )}
        </>
      )
    }

    if (t === 'client_meeting') {
      return (
        <>
          <div style={{ marginBottom: 10 }}>
            <label style={{ ...sectionLabel, marginBottom: 5 }}>Growth Advisor</label>
            <select value={gaEmail} onChange={e => handleGaChange(e.target.value)} style={selectStyle}>
              <option value="">— Select GA —</option>
              {GROWTH_ADVISORS.map(r => <option key={r.email} value={r.email}>{r.name}</option>)}
            </select>
          </div>
          <ClientLookupField required />
        </>
      )
    }

    if (t === 'onboarding') {
      return (
        <>
          <div style={{ marginBottom: 10 }}>
            <label style={{ ...sectionLabel, marginBottom: 5 }}>Onboarding Agent</label>
            <select value={onboardingEmail} onChange={e => handleOnboardingChange(e.target.value)} style={selectStyle}>
              <option value="">— Select agent —</option>
              {ONBOARDING_AGENTS.map(r => <option key={r.email} value={r.email}>{r.name}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ ...sectionLabel, marginBottom: 5 }}>Growth Advisor</label>
            <select value={gaEmail} onChange={e => handleGaChange(e.target.value)} style={selectStyle}>
              <option value="">— Select GA —</option>
              {GROWTH_ADVISORS.map(r => <option key={r.email} value={r.email}>{r.name}</option>)}
            </select>
          </div>
          <ClientLookupField />
        </>
      )
    }

    if (t === 'blueprint') {
      return (
        <>
          <div style={{ marginBottom: 10 }}>
            <label style={{ ...sectionLabel, marginBottom: 5 }}>Growth Advisor</label>
            <select value={gaEmail} onChange={e => handleGaChange(e.target.value)} style={selectStyle}>
              <option value="">— Select GA —</option>
              {GROWTH_ADVISORS.map(r => <option key={r.email} value={r.email}>{r.name}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ ...sectionLabel, marginBottom: 5 }}>Group session?</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <ToggleBtn label="No"  active={!groupSession} onClick={() => setGroupSession(false)} activeColor="#9ca3af" activeBg="#2a1a3e" activeBorder="#4a3060" />
              <ToggleBtn label="Yes" active={groupSession}  onClick={() => setGroupSession(true)}  activeColor="#93c5fd" activeBg="#3b82f622" activeBorder="#3b82f644" />
            </div>
          </div>
          {!groupSession && <ClientLookupField />}
        </>
      )
    }

    if (t === 'internal' || t === 'one_on_one') {
      return (
        <div style={{ marginBottom: 10 }}>
          <label style={{ ...sectionLabel, marginBottom: 5 }}>Staff</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {staffTags.map(tag => (
              <span key={tag.email} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: '#2a1a3e', color: '#c4b5fd', border: '1px solid #7c3aed44',
                borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 500,
              }}>
                {tag.name}
                <button onClick={() => removeStaffTag(tag.email)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1 }}>✕</button>
              </span>
            ))}
            {staffTags.length === 0 && (
              <span style={{ color: '#4a3060', fontSize: 11, fontStyle: 'italic' }}>No GYC staff detected in participants</span>
            )}
          </div>
        </div>
      )
    }

    return null
  }

  const participants = Array.isArray(call.participants) ? call.participants : []
  const gycStaff = participants.filter(p => isGycStaff(p.email || ''))
  const external  = participants.filter(p => !isGycStaff(p.email || ''))
  const badge = confidenceBadge(call.aiConfidence, call.aiClassification)
  const hasGhl = Boolean(call.ghlContactId)

  const isConfirmDisabled = saving || !form.classifiedAs ||
    (form.classifiedAs === 'client_meeting' && !selectedClient) ||
    (form.classifiedAs === 'sales' && !form.assignedRepEmail)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── CALL HEADER ─────────────────────────────────────────── */}
      <div style={{ paddingBottom: 12, marginBottom: 12, borderBottom: '1px solid #2a1a3e' }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, marginBottom: 4, lineHeight: 1.3 }}>
          {call.topic || 'Untitled Meeting'}
        </div>

        {/* Date · Duration · Recording link */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
          <span style={{ color: '#6b7280', fontSize: 11 }}>
            📅 {fmt(call.startTime)}
          </span>
          <span style={{ color: '#6b7280', fontSize: 11 }}>
            ⏱ {fmtDuration(call.duration)}
          </span>
          {call.recordingUrl && (
            <a
              href={call.recordingUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: '#3d1f6e', color: '#c4b5fd',
                border: '1px solid #7c3aed44', borderRadius: 6,
                padding: '2px 8px', fontSize: 11, fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              🎥 Recording
            </a>
          )}
        </div>

        {/* AI Classification badge */}
        {badge && (
          <span style={{
            display: 'inline-block',
            background: badge.color + '22', color: badge.color,
            border: `1px solid ${badge.color}44`,
            borderRadius: 6, padding: '2px 9px', fontSize: 11, fontWeight: 600,
          }}>🤖 {badge.label} — {badge.pct}% confident</span>
        )}

        {saved && (
          <div style={{ marginTop: 8, color: '#22c55e', fontSize: 12, fontWeight: 600 }}>
            ✅ Classified — activity logged
          </div>
        )}
      </div>

      {/* ── PARTICIPANTS ─────────────────────────────────────────── */}
      {participants.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <span style={sectionLabel}>👥 Participants</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {/* GYC Staff column */}
            <div style={{ background: '#0d0d1a', borderRadius: 7, padding: '8px 10px', border: '1px solid #2a1a3e' }}>
              <div style={{ color: '#c4b5fd', fontSize: 10, fontWeight: 700, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>GYC Staff</div>
              {gycStaff.length > 0 ? gycStaff.map((p, i) => (
                <div key={i} style={{ marginBottom: 3 }}>
                  <div style={{ color: '#e2d9f3', fontSize: 11, fontWeight: 500 }}>{p.name || '—'}</div>
                  {p.email && <div style={{ color: '#6b7280', fontSize: 10 }}>{p.email}</div>}
                </div>
              )) : (
                <div style={{ color: '#4a3060', fontSize: 11 }}>None detected</div>
              )}
            </div>
            {/* External column */}
            <div style={{ background: '#0d0d1a', borderRadius: 7, padding: '8px 10px', border: '1px solid #2a1a3e' }}>
              <div style={{ color: '#fbbf24', fontSize: 10, fontWeight: 700, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>External</div>
              {external.length > 0 ? external.map((p, i) => (
                <div key={i} style={{ marginBottom: 3 }}>
                  <div style={{ color: '#e2d9f3', fontSize: 11, fontWeight: 500 }}>{p.name || '—'}</div>
                  {p.email && <div style={{ color: '#6b7280', fontSize: 10 }}>{p.email}</div>}
                </div>
              )) : (
                <div style={{ color: '#4a3060', fontSize: 11 }}>None detected</div>
              )}
            </div>
          </div>
        </div>
      )}
      {participants.length === 0 && (
        <div style={{ marginBottom: 12, color: '#4a3060', fontSize: 12, fontStyle: 'italic' }}>
          👥 No participant data — transcript required for participant detection
        </div>
      )}

      {/* ── GHL PIPELINE STATUS ──────────────────────────────────── */}
      <div style={{ marginBottom: 12 }}>
        <span style={sectionLabel}>🔗 GHL Pipeline Status</span>
        {hasGhl ? (
          <div style={{ background: '#0a1a0d', border: '1px solid #22c55e44', borderRadius: 8, padding: '8px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ color: '#22c55e', fontSize: 13, fontWeight: 700 }}>{call.ghlContactName}</span>
              {call.ghlPipelineStage && (
                <span style={{
                  background: '#22c55e22', color: '#4ade80',
                  border: '1px solid #22c55e44',
                  borderRadius: 6, padding: '1px 8px', fontSize: 10, fontWeight: 600,
                }}>
                  {call.ghlPipelineStage}
                </span>
              )}
            </div>
            {call.ghlContactId && (
              <div style={{ color: '#6b7280', fontSize: 10, marginTop: 3 }}>ID: {call.ghlContactId}</div>
            )}
          </div>
        ) : (
          <div style={{ background: '#0d0d1a', border: '1px solid #2a1a3e', borderRadius: 8, padding: '8px 12px' }}>
            <div style={{ color: '#f59e0b', fontSize: 11, marginBottom: 6 }}>
              ⚠️ No GHL contact found — may be internal or auto-match failed
            </div>
            <GhlContactLinker callId={call.id} onLinked={handleGhlLinked} />
          </div>
        )}
      </div>

      {/* ── AI SUMMARY ───────────────────────────────────────────── */}
      <div style={{ marginBottom: 12 }}>
        <span style={sectionLabel}>🧠 AI Summary</span>
        {call.aiSummary ? (
          <div style={{
            background: '#0d0d1a', border: '1px solid #3d1f6e',
            borderRadius: 8, padding: '8px 12px',
            color: '#d1d5db', fontSize: 12, lineHeight: 1.6,
          }}>
            {call.aiSummary}
          </div>
        ) : (
          <div style={{
            background: '#0d0d1a', border: '1px solid #2a1a3e',
            borderRadius: 8, padding: '8px 12px',
            color: '#6b7280', fontSize: 12, fontStyle: 'italic',
          }}>
            Summary not available — transcript required
          </div>
        )}

        {/* Ask Wall·E */}
        <div style={{ background: '#0d0d1a', borderRadius: 8, padding: 10, border: '1px solid #2a1a3e', marginTop: 8 }}>
          <div style={{ color: '#ae2bcf', fontSize: 10, fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>🤖 Ask Wall·E about this call</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={askQ}
              onChange={e => setAskQ(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAsk()}
              placeholder="e.g. What objections came up?"
              style={{ flex: 1, background: '#1a0a2e', color: '#fff', border: '1px solid #2a1a3e', borderRadius: 6, padding: '6px 9px', fontSize: 12 }}
            />
            <button
              onClick={handleAsk}
              disabled={asking || !askQ.trim()}
              style={{
                background: asking ? '#2a1a3e' : '#7c3aed',
                color: '#fff', border: 'none', borderRadius: 6,
                padding: '6px 12px', fontSize: 12, cursor: asking ? 'not-allowed' : 'pointer',
                opacity: !askQ.trim() ? 0.5 : 1, whiteSpace: 'nowrap',
              }}
            >
              {asking ? '…' : 'Ask'}
            </button>
          </div>
          {askAnswer && (
            <div style={{ marginTop: 8, color: '#d1d5db', fontSize: 11, lineHeight: 1.6, background: '#111', borderRadius: 6, padding: '7px 10px' }}>
              {askAnswer}
            </div>
          )}
        </div>
      </div>

      {/* ── CLASSIFICATION ───────────────────────────────────────── */}
      <div style={divider} />
      <div style={{ marginBottom: 10 }}>
        <label style={{ ...sectionLabel, marginBottom: 5 }}>Classification</label>
        <select
          value={form.classifiedAs}
          onChange={e => setForm(f => ({ ...f, classifiedAs: e.target.value, assignedRepEmail: '', assignedRepName: '' }))}
          style={{ width: '100%', background: '#1a0a2e', color: '#fff', border: '1px solid #2a1a3e', borderRadius: 8, padding: '7px 10px', fontSize: 13 }}
        >
          <option value="">— Select classification —</option>
          {CLASSIFICATION_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* ── SMART TYPE-SPECIFIC FIELDS ────────────────────────────── */}
      {renderTypeFields()}

      {/* Notes */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ ...sectionLabel, marginBottom: 5 }}>Notes</label>
        <textarea
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          placeholder="Add notes about this call..."
          rows={2}
          style={{ width: '100%', background: '#1a0a2e', color: '#fff', border: '1px solid #2a1a3e', borderRadius: 8, padding: '7px 10px', fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }}
        />
      </div>

      {error && (
        <div style={{ color: '#f87171', fontSize: 12, background: '#1f0505', border: '1px solid #dc262644', borderRadius: 6, padding: '6px 10px', marginBottom: 8 }}>{error}</div>
      )}

      <button
        onClick={handleSave}
        disabled={isConfirmDisabled}
        style={{
          width: '100%',
          background: isConfirmDisabled ? '#2a1a3e' : 'linear-gradient(135deg, #731494, #AE2BCF)',
          color: isConfirmDisabled ? '#6b7280' : '#fff',
          border: 'none', borderRadius: 8, padding: '10px 0',
          fontSize: 13, fontWeight: 700, cursor: isConfirmDisabled ? 'not-allowed' : 'pointer',
          transition: 'all 0.15s',
        }}
      >
        {saving ? 'Saving…' : saved ? '✅ Classified!' : '✅ Confirm Classification'}
      </button>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
// embedded=true → renders as a panel inside Mission Control (no fixed viewport height)
export default function ZoomClassifierPage({ embedded = false }) {
  const [tab, setTab] = useState('pending')
  const [calls, setCalls] = useState([])
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      let statusParam = 'pending'
      if (tab === 'classified') statusParam = 'classified'
      else if (tab === 'all') statusParam = 'all'
      const qs = new URLSearchParams({ status: statusParam })
      if (search) qs.set('search', search)
      const res = await fetch(`/api/zoom/calls?${qs}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load calls')
      setCalls(json.calls || [])
      setPendingCount(json.pendingCount || 0)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [tab, search])

  useEffect(() => { load() }, [load])

  function handleSaved(updatedCall) {
    setCalls(prev => prev.map(c => c.id === updatedCall.id ? { ...c, ...updatedCall } : c))
    setSelected(prev => prev?.id === updatedCall.id ? { ...prev, ...updatedCall } : prev)
    if (tab === 'pending') {
      setTimeout(() => load(), 1200)
    }
  }

  async function handleSync() {
    setSyncing(true)
    setSyncMsg('')
    try {
      const res = await fetch('/api/zoom/sync', { method: 'POST' })
      const json = await res.json()
      setSyncMsg(json.message || json.error || 'Sync triggered')
    } catch {
      setSyncMsg('Sync request failed')
    } finally {
      setSyncing(false)
    }
  }

  function handleSearch(e) {
    e.preventDefault()
    setSearch(searchInput)
  }

  const TAB_STYLE = (active) => ({
    background: active ? '#7c3aed22' : 'transparent',
    color: active ? '#c4b5fd' : '#9ca3af',
    border: active ? '1px solid #7c3aed44' : '1px solid transparent',
    borderRadius: 6, padding: '5px 12px',
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 5,
    transition: 'all 0.15s',
  })

  // Height config: full-screen vs embedded panel
  const listMaxH = embedded ? 'calc(100vh - 360px)' : 'calc(100vh - 200px)'
  const formMaxH = embedded ? 'calc(100vh - 360px)' : 'calc(100vh - 200px)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 10, marginBottom: 14,
      }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4 }}>
          <button style={TAB_STYLE(tab === 'pending')} onClick={() => { setTab('pending'); setSelected(null) }}>
            Pending
            {pendingCount > 0 && (
              <span style={{ background: '#ef4444', color: '#fff', borderRadius: 10, padding: '0px 6px', fontSize: 10, fontWeight: 700 }}>
                {pendingCount}
              </span>
            )}
          </button>
          <button style={TAB_STYLE(tab === 'classified')} onClick={() => { setTab('classified'); setSelected(null) }}>Classified</button>
          <button style={TAB_STYLE(tab === 'all')} onClick={() => { setTab('all'); setSelected(null) }}>All Calls</button>
        </div>

        {/* Search + Sync */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {syncMsg && <span style={{ color: '#9ca3af', fontSize: 11, maxWidth: 260 }}>{syncMsg}</span>}
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 6 }}>
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search topic, host, contact…"
              style={{ background: '#1a0a2e', color: '#fff', border: '1px solid #2a1a3e', borderRadius: 7, padding: '5px 10px', fontSize: 12, width: 200 }}
            />
            <button type="submit" style={{ background: '#2a1a3e', color: '#9ca3af', border: '1px solid #2a1a3e', borderRadius: 7, padding: '5px 10px', fontSize: 12, cursor: 'pointer' }}>
              Search
            </button>
          </form>
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{
              background: '#1a0a2e', color: '#ae2bcf', border: '1px solid #7c3aed44',
              borderRadius: 7, padding: '5px 12px', fontSize: 12, fontWeight: 600,
              cursor: syncing ? 'not-allowed' : 'pointer',
            }}
          >
            {syncing ? '⏳ Syncing…' : '🔄 Sync Zoom'}
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '35% 65%', gap: 16, alignItems: 'start' }}>
        {/* Left — Call list */}
        <div style={{ overflowY: 'auto', maxHeight: listMaxH, paddingRight: 4 }}>
          {error && (
            <div style={{ color: '#f87171', fontSize: 12, marginBottom: 10, background: '#1f0505', border: '1px solid #dc262644', borderRadius: 6, padding: '6px 10px' }}>⚠️ {error}</div>
          )}
          {loading ? (
            <div style={{ color: '#6b7280', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>Loading calls…</div>
          ) : calls.length === 0 ? (
            <div style={{ color: '#6b7280', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>
              {tab === 'pending' ? '🎉 No pending calls to classify!' : 'No calls found.'}
            </div>
          ) : (
            calls.map(call => (
              <CallCard
                key={call.id}
                call={call}
                isSelected={selected?.id === call.id}
                onClick={() => setSelected(call)}
              />
            ))
          )}
        </div>

        {/* Right — Classification form */}
        <div style={{
          overflowY: 'auto', maxHeight: formMaxH,
          background: '#111', border: '1px solid #2a1a3e', borderRadius: 12,
          padding: selected ? '16px' : '0',
          position: 'sticky', top: 0,
        }}>
          {selected ? (
            <ClassificationForm
              key={selected.id}
              call={selected}
              onSaved={handleSaved}
            />
          ) : (
            <div style={{ color: '#4a3060', fontSize: 13, padding: '60px 20px', textAlign: 'center' }}>
              ← Select a call to classify
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
