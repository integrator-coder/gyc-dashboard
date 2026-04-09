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

// ─── ClassificationForm ───────────────────────────────────────────────────────
function ClassificationForm({ call, onSaved }) {
  const [form, setForm] = useState({
    classifiedAs: call.classifiedAs || call.aiClassification || '',
    assignedRepEmail: call.assignedRepEmail || '',
    assignedRepName: call.assignedRepName || '',
    notes: call.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [askQ, setAskQ] = useState('')
  const [askAnswer, setAskAnswer] = useState('')
  const [asking, setAsking] = useState(false)

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
    setSaved(false)
  }, [call.id])

  const reps = REPS_BY_TYPE[form.classifiedAs] || REPS_BY_TYPE.internal

  function handleRepChange(email) {
    const rep = reps.find(r => r.email === email)
    setForm(f => ({ ...f, assignedRepEmail: email, assignedRepName: rep?.name || '' }))
  }

  async function handleSave() {
    if (!form.classifiedAs) { setError('Select a classification first'); return }
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

  const participants = Array.isArray(call.participants) ? call.participants : []
  const badge = confidenceBadge(call.aiConfidence, call.aiClassification)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Call header */}
      <div style={{ borderBottom: '1px solid #2a1a3e', paddingBottom: 12 }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, marginBottom: 3 }}>
          {call.topic || '(No topic)'}
        </div>
        <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 6 }}>
          {fmt(call.startTime)} · {fmtDuration(call.duration)} · {call.hostEmail || '—'}
        </div>
        {badge && (
          <span style={{
            display: 'inline-block',
            background: badge.color + '22', color: badge.color,
            border: `1px solid ${badge.color}44`,
            borderRadius: 6, padding: '2px 9px', fontSize: 11, fontWeight: 600,
          }}>🤖 {badge.label} — {badge.pct}% confident</span>
        )}
        {call.ghlContactName && (
          <div style={{ marginTop: 5, color: '#22c55e', fontSize: 11 }}>
            🔗 GHL: {call.ghlContactName}{call.ghlPipelineStage ? ` · ${call.ghlPipelineStage}` : ''}
          </div>
        )}
        {participants.length > 0 && (
          <div style={{ marginTop: 5, color: '#9ca3af', fontSize: 11 }}>
            👥 {participants.map(p => p.name || p.email).filter(Boolean).join(', ')}
          </div>
        )}
        {saved && (
          <div style={{ marginTop: 6, color: '#22c55e', fontSize: 12, fontWeight: 600 }}>
            ✅ Classified — activity logged
          </div>
        )}
      </div>

      {/* Classification */}
      <div>
        <label style={{ color: '#d1d5db', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Classification
        </label>
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

      {/* Assigned To */}
      {form.classifiedAs && (
        <div>
          <label style={{ color: '#d1d5db', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Assigned To
          </label>
          <select
            value={form.assignedRepEmail}
            onChange={e => handleRepChange(e.target.value)}
            style={{ width: '100%', background: '#1a0a2e', color: '#fff', border: '1px solid #2a1a3e', borderRadius: 8, padding: '7px 10px', fontSize: 13 }}
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
        <label style={{ color: '#d1d5db', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Notes
        </label>
        <textarea
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          placeholder="Add notes about this call..."
          rows={3}
          style={{ width: '100%', background: '#1a0a2e', color: '#fff', border: '1px solid #2a1a3e', borderRadius: 8, padding: '7px 10px', fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }}
        />
      </div>

      {/* Ask Wall·E */}
      <div style={{ background: '#0d0d1a', borderRadius: 8, padding: 12, border: '1px solid #2a1a3e' }}>
        <div style={{ color: '#ae2bcf', fontSize: 11, fontWeight: 600, marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.08em' }}>🤖 Ask Wall·E</div>
        <div style={{ display: 'flex', gap: 7 }}>
          <input
            value={askQ}
            onChange={e => setAskQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAsk()}
            placeholder="Ask about this call..."
            style={{ flex: 1, background: '#1a0a2e', color: '#fff', border: '1px solid #2a1a3e', borderRadius: 6, padding: '6px 9px', fontSize: 12 }}
          />
          <button
            onClick={handleAsk}
            disabled={asking || !askQ.trim()}
            style={{
              background: asking ? '#2a1a3e' : '#7c3aed',
              color: '#fff', border: 'none', borderRadius: 6,
              padding: '6px 12px', fontSize: 12, cursor: asking ? 'not-allowed' : 'pointer',
              opacity: !askQ.trim() ? 0.5 : 1,
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

      {error && (
        <div style={{ color: '#f87171', fontSize: 12, background: '#1f0505', border: '1px solid #dc262644', borderRadius: 6, padding: '6px 10px' }}>{error}</div>
      )}

      <button
        onClick={handleSave}
        disabled={saving || !form.classifiedAs}
        style={{
          width: '100%',
          background: saving || !form.classifiedAs ? '#2a1a3e' : 'linear-gradient(135deg, #731494, #AE2BCF)',
          color: saving || !form.classifiedAs ? '#6b7280' : '#fff',
          border: 'none', borderRadius: 8, padding: '10px 0',
          fontSize: 13, fontWeight: 700, cursor: saving || !form.classifiedAs ? 'not-allowed' : 'pointer',
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16, alignItems: 'start' }}>
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
