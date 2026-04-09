'use client'

import { useCallback, useEffect, useState } from 'react'

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

const REPS_BY_TYPE = {
  sales: [
    { name: 'Jesse', email: 'jesse@growyourcenter.com' },
    { name: 'Briana', email: 'briana@growyourcenter.com' },
    { name: 'Pia', email: 'pia@growyourcenter.com' },
  ],
  onboarding: [
    { name: 'Briana', email: 'briana@growyourcenter.com' },
    { name: 'Zu', email: 'zu@growyourcenter.com' },
  ],
  client_meeting: [
    { name: 'JC', email: 'jc@growyourcenter.com' },
    { name: 'Stefen', email: 'stefen@growyourcenter.com' },
    { name: 'Sebastian', email: 'sebastian@growyourcenter.com' },
    { name: 'Zu', email: 'zu@growyourcenter.com' },
  ],
  blueprint: [
    { name: 'Zu', email: 'zu@growyourcenter.com' },
    { name: 'Briana', email: 'briana@growyourcenter.com' },
  ],
  internal: [
    { name: 'Todd', email: 'todd@growyourcenter.com' },
    { name: 'Bruce', email: 'bruce@growyourcenter.com' },
    { name: 'Zac', email: 'zac@growyourcenter.com' },
    { name: 'Carmella', email: 'carmella@growyourcenter.com' },
    { name: 'Lex', email: 'lex@growyourcenter.com' },
    { name: 'Travis', email: 'travis@growyourcenter.com' },
    { name: 'Kaci', email: 'kaci@growyourcenter.com' },
  ],
  one_on_one: [
    { name: 'Todd', email: 'todd@growyourcenter.com' },
    { name: 'Bruce', email: 'bruce@growyourcenter.com' },
    { name: 'Jesse', email: 'jesse@growyourcenter.com' },
    { name: 'Briana', email: 'briana@growyourcenter.com' },
    { name: 'Pia', email: 'pia@growyourcenter.com' },
    { name: 'Lex', email: 'lex@growyourcenter.com' },
    { name: 'Travis', email: 'travis@growyourcenter.com' },
    { name: 'Zu', email: 'zu@growyourcenter.com' },
    { name: 'JC', email: 'jc@growyourcenter.com' },
    { name: 'Stefen', email: 'stefen@growyourcenter.com' },
    { name: 'Kaci', email: 'kaci@growyourcenter.com' },
    { name: 'Zac', email: 'zac@growyourcenter.com' },
  ],
}

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
  return { label: type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), pct, color }
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
        padding: '14px 16px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        marginBottom: 8,
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#fff', fontWeight: 600, fontSize: 14, marginBottom: 2 }} className="truncate">
            {call.topic || call.meetingId || '(No topic)'}
          </div>
          <div style={{ color: '#6b7280', fontSize: 12 }}>
            {fmt(call.startTime)} · {fmtDuration(call.duration)}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {/* GHL indicator */}
          <div title={ghlMatched ? `GHL: ${call.ghlContactName}` : 'No GHL match'} style={{
            width: 8, height: 8, borderRadius: '50%',
            background: ghlMatched ? '#22c55e' : '#f59e0b',
          }} />
          {/* Recording link */}
          {call.recordingUrl && (
            <a
              href={call.recordingUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              title="Open recording"
              style={{ color: '#7c3aed', fontSize: 16, textDecoration: 'none' }}
            >🎥</a>
          )}
        </div>
      </div>

      {/* Participants */}
      {participants.length > 0 && (
        <div style={{ marginTop: 6, color: '#9ca3af', fontSize: 11 }}>
          👥 {participants.slice(0, 4).map(p => p.name || p.email).filter(Boolean).join(', ')}
          {participants.length > 4 && ` +${participants.length - 4} more`}
        </div>
      )}

      {/* AI badge */}
      {badge && (
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11 }}>🤖</span>
          <span style={{
            background: badge.color + '22',
            color: badge.color,
            border: `1px solid ${badge.color}44`,
            borderRadius: 6,
            padding: '2px 8px',
            fontSize: 11,
            fontWeight: 600,
          }}>
            {badge.label} — {badge.pct}%
          </span>
          {call.classifiedAs && (
            <span style={{ color: '#22c55e', fontSize: 11 }}>✓ Classified</span>
          )}
        </div>
      )}

      {/* Expand toggles */}
      <div style={{ marginTop: 8, display: 'flex', gap: 12 }}>
        {call.aiSummary && (
          <button
            onClick={e => { e.stopPropagation(); setShowSummary(s => !s) }}
            style={{ color: '#7c3aed', fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            {showSummary ? '▲ Hide summary' : '▼ AI summary'}
          </button>
        )}
        {call.transcriptUrl && (
          <button
            onClick={e => { e.stopPropagation(); setShowTranscript(s => !s) }}
            style={{ color: '#6b7280', fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            {showTranscript ? '▲ Hide transcript' : '▼ Transcript'}
          </button>
        )}
      </div>

      {showSummary && call.aiSummary && (
        <div style={{ marginTop: 8, color: '#d1d5db', fontSize: 12, lineHeight: 1.5, background: '#0a0a0a', borderRadius: 6, padding: '8px 12px' }}>
          {call.aiSummary}
        </div>
      )}

      {showTranscript && (
        <div style={{ marginTop: 8, color: '#9ca3af', fontSize: 11, lineHeight: 1.5, background: '#0a0a0a', borderRadius: 6, padding: '8px 12px', maxHeight: 200, overflowY: 'auto', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
          {call.transcriptText ? call.transcriptText.slice(0, 2000) : '(No transcript text — open recording link to view)'}
        </div>
      )}
    </div>
  )
}

// ─── ClassificationForm ───────────────────────────────────────────────────────
function ClassificationForm({ call, onSaved }) {
  const [form, setForm] = useState({
    classifiedAs: call.classifiedAs || call.aiClassification || '',
    assignedRepEmail: call.assignedRepEmail || '',
    assignedRepName: call.assignedRepName || '',
    notes: call.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [askQ, setAskQ] = useState('')
  const [askAnswer, setAskAnswer] = useState('')
  const [asking, setAsking] = useState(false)

  // Reset when call changes
  useEffect(() => {
    setForm({
      classifiedAs: call.classifiedAs || call.aiClassification || '',
      assignedRepEmail: call.assignedRepEmail || '',
      assignedRepName: call.assignedRepName || '',
      notes: call.notes || '',
    })
    setAskAnswer('')
    setAskQ('')
    setError('')
  }, [call.id])

  const reps = REPS_BY_TYPE[form.classifiedAs] || REPS_BY_TYPE.internal

  function handleRepChange(email) {
    const rep = reps.find(r => r.email === email)
    setForm(f => ({ ...f, assignedRepEmail: email, assignedRepName: rep?.name || '' }))
  }

  async function handleSave() {
    if (!form.classifiedAs) { setError('Select a classification'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/zoom/calls/${call.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Save failed')
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

  const participants = Array.isArray(call.participants) ? call.participants : []
  const badge = confidenceBadge(call.aiConfidence, call.aiClassification)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Call header */}
      <div>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
          {call.topic || '(No topic)'}
        </div>
        <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 6 }}>
          {fmt(call.startTime)} · {fmtDuration(call.duration)} · {call.hostEmail || '—'}
        </div>
        {badge && (
          <span style={{
            background: badge.color + '22', color: badge.color,
            border: `1px solid ${badge.color}44`,
            borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 600,
          }}>🤖 {badge.label} — {badge.pct}% confident</span>
        )}
        {call.ghlContactName && (
          <div style={{ marginTop: 6, color: '#22c55e', fontSize: 12 }}>
            🔗 GHL: {call.ghlContactName}{call.ghlPipelineStage ? ` · ${call.ghlPipelineStage}` : ''}
          </div>
        )}
        {participants.length > 0 && (
          <div style={{ marginTop: 6, color: '#9ca3af', fontSize: 12 }}>
            👥 {participants.map(p => p.name || p.email).filter(Boolean).join(', ')}
          </div>
        )}
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid #2a1a3e' }} />

      {/* Classification */}
      <div>
        <label style={{ color: '#d1d5db', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>
          Classification
        </label>
        <select
          value={form.classifiedAs}
          onChange={e => setForm(f => ({ ...f, classifiedAs: e.target.value, assignedRepEmail: '', assignedRepName: '' }))}
          style={{ width: '100%', background: '#1a0a2e', color: '#fff', border: '1px solid #2a1a3e', borderRadius: 8, padding: '8px 12px', fontSize: 14 }}
        >
          <option value="">— Select —</option>
          {CLASSIFICATION_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Assigned To */}
      {form.classifiedAs && (
        <div>
          <label style={{ color: '#d1d5db', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>
            Assigned To
          </label>
          <select
            value={form.assignedRepEmail}
            onChange={e => handleRepChange(e.target.value)}
            style={{ width: '100%', background: '#1a0a2e', color: '#fff', border: '1px solid #2a1a3e', borderRadius: 8, padding: '8px 12px', fontSize: 14 }}
          >
            <option value="">— Select rep —</option>
            {reps.map(r => (
              <option key={r.email} value={r.email}>{r.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Notes */}
      <div>
        <label style={{ color: '#d1d5db', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>
          Notes
        </label>
        <textarea
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          placeholder="Add notes about this call..."
          rows={3}
          style={{ width: '100%', background: '#1a0a2e', color: '#fff', border: '1px solid #2a1a3e', borderRadius: 8, padding: '8px 12px', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
        />
      </div>

      {/* Ask Wall·E */}
      <div style={{ background: '#0d0d1a', borderRadius: 8, padding: 12, border: '1px solid #2a1a3e' }}>
        <div style={{ color: '#ae2bcf', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>🤖 Ask Wall·E</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={askQ}
            onChange={e => setAskQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAsk()}
            placeholder="Ask about this call..."
            style={{ flex: 1, background: '#1a0a2e', color: '#fff', border: '1px solid #2a1a3e', borderRadius: 6, padding: '7px 10px', fontSize: 13 }}
          />
          <button
            onClick={handleAsk}
            disabled={asking || !askQ.trim()}
            style={{
              background: asking ? '#2a1a3e' : '#7c3aed',
              color: '#fff', border: 'none', borderRadius: 6,
              padding: '7px 14px', fontSize: 13, cursor: asking ? 'not-allowed' : 'pointer',
            }}
          >
            {asking ? '…' : 'Ask'}
          </button>
        </div>
        {askAnswer && (
          <div style={{ marginTop: 10, color: '#d1d5db', fontSize: 12, lineHeight: 1.6, background: '#111', borderRadius: 6, padding: '8px 12px' }}>
            {askAnswer}
          </div>
        )}
      </div>

      {error && (
        <div style={{ color: '#f87171', fontSize: 12 }}>{error}</div>
      )}

      {/* Confirm button */}
      <button
        onClick={handleSave}
        disabled={saving || !form.classifiedAs}
        style={{
          width: '100%',
          background: saving || !form.classifiedAs ? '#2a1a3e' : 'linear-gradient(135deg, #731494, #AE2BCF)',
          color: saving || !form.classifiedAs ? '#6b7280' : '#fff',
          border: 'none', borderRadius: 8, padding: '10px 0',
          fontSize: 14, fontWeight: 700, cursor: saving || !form.classifiedAs ? 'not-allowed' : 'pointer',
        }}
      >
        {saving ? 'Saving…' : '✅ Confirm Classification'}
      </button>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ZoomClassifierPage() {
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
    setCalls(prev => prev.map(c => c.id === updatedCall.id ? updatedCall : c))
    setSelected(updatedCall)
    if (tab === 'pending') {
      // Remove from pending list after classification
      setTimeout(() => {
        setCalls(prev => prev.filter(c => c.id !== updatedCall.id || c.status !== 'classified'))
        load()
      }, 1500)
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
    background: active ? '#7c3aed' : 'transparent',
    color: active ? '#fff' : '#9ca3af',
    border: 'none', borderRadius: 6, padding: '6px 14px',
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 6,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0, minHeight: 0 }}>
      {/* Header */}
      <div style={{ padding: '20px 24px 0', borderBottom: '1px solid #2a1a3e', paddingBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 700, margin: 0 }}>📞 Call Intelligence</h1>
            <p style={{ color: '#6b7280', fontSize: 13, margin: '4px 0 0' }}>
              Classify Zoom calls and trigger workflows
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {syncMsg && <span style={{ color: '#9ca3af', fontSize: 12, maxWidth: 280 }}>{syncMsg}</span>}
            <button
              onClick={handleSync}
              disabled={syncing}
              style={{
                background: '#1a0a2e', color: '#ae2bcf', border: '1px solid #7c3aed',
                borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 600,
                cursor: syncing ? 'not-allowed' : 'pointer',
              }}
            >
              {syncing ? '⏳ Syncing…' : '🔄 Sync Zoom'}
            </button>
          </div>
        </div>

        {/* Tabs + Search */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <button style={TAB_STYLE(tab === 'pending')} onClick={() => setTab('pending')}>
              Pending
              {pendingCount > 0 && (
                <span style={{ background: '#ef4444', color: '#fff', borderRadius: 12, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>
                  {pendingCount}
                </span>
              )}
            </button>
            <button style={TAB_STYLE(tab === 'classified')} onClick={() => setTab('classified')}>
              Classified
            </button>
            <button style={TAB_STYLE(tab === 'all')} onClick={() => setTab('all')}>
              All Calls
            </button>
          </div>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search topic, host, contact…"
              style={{ background: '#1a0a2e', color: '#fff', border: '1px solid #2a1a3e', borderRadius: 8, padding: '6px 12px', fontSize: 13, width: 220 }}
            />
            <button type="submit" style={{ background: '#2a1a3e', color: '#fff', border: '1px solid #2a1a3e', borderRadius: 8, padding: '6px 14px', fontSize: 13, cursor: 'pointer' }}>
              Search
            </button>
          </form>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Left — Call list */}
        <div style={{ width: '60%', borderRight: '1px solid #2a1a3e', overflowY: 'auto', padding: '16px 20px' }}>
          {error && (
            <div style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>⚠️ {error}</div>
          )}
          {loading ? (
            <div style={{ color: '#6b7280', fontSize: 14, paddingTop: 40, textAlign: 'center' }}>Loading calls…</div>
          ) : calls.length === 0 ? (
            <div style={{ color: '#6b7280', fontSize: 14, paddingTop: 40, textAlign: 'center' }}>
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
        <div style={{ width: '40%', overflowY: 'auto', padding: '20px 24px' }}>
          {selected ? (
            <ClassificationForm
              key={selected.id}
              call={selected}
              onSaved={handleSaved}
            />
          ) : (
            <div style={{ color: '#4a3060', fontSize: 14, paddingTop: 60, textAlign: 'center' }}>
              ← Select a call to classify
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
