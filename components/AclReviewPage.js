'use client'

import { useEffect, useState } from 'react'

const B = {
  card: 'var(--brand-bg-card)',
  panel: 'var(--brand-surface-2)',
  inset: 'var(--brand-surface-3)',
  border: 'var(--brand-border)',
  borderStrong: 'var(--brand-border-strong)',
  p2: 'var(--brand-primary-2)',
  p3: 'var(--brand-primary-3)',
  p4: 'var(--brand-primary-4)',
  accent: 'var(--brand-accent)',
  muted: 'var(--brand-text-muted)',
  faint: 'var(--brand-text-faint)',
}

const CHANGE_TYPE_CONFIG = {
  cancellation: { label: 'Cancellation', emoji: '🔴', color: '#ef4444' },
  status_change: { label: 'Status Change', emoji: '🟡', color: '#f59e0b' },
  mrr_mismatch: { label: 'MRR Mismatch', emoji: '💰', color: '#8b5cf6' },
  evergreen_transition: { label: 'Evergreen', emoji: '🔵', color: '#3b82f6' },
  pif_activation: { label: 'PIF Activation', emoji: '✅', color: '#10b981' },
}

function formatCurrency(value) {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function AclReviewPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showHistory, setShowHistory] = useState(false)
  const [historyData, setHistoryData] = useState(null)
  const [dismissModalId, setDismissModalId] = useState(null)
  const [dismissNote, setDismissNote] = useState('')
  const [processing, setProcessing] = useState(false)

  const fetchData = async () => {
    try {
      const res = await fetch('/api/acl/discrepancies')
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/acl/sync-history')
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setHistoryData(json.syncHistory)
    } catch (err) {
      console.error('Error fetching history:', err)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (showHistory && !historyData) {
      fetchHistory()
    }
  }, [showHistory, historyData])

  const handleApprove = async (id) => {
    if (!confirm('Apply this change to the database?')) return
    
    setProcessing(true)
    try {
      const res = await fetch(`/api/acl/discrepancies/${id}/approve`, {
        method: 'POST',
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      await fetchData()
    } catch (err) {
      alert(`Error: ${err.message}`)
    } finally {
      setProcessing(false)
    }
  }

  const handleDismiss = async () => {
    if (!dismissNote.trim()) {
      alert('Please enter a reason for dismissing')
      return
    }

    setProcessing(true)
    try {
      const res = await fetch(`/api/acl/discrepancies/${dismissModalId}/dismiss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: dismissNote }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      await fetchData()
      setDismissModalId(null)
      setDismissNote('')
    } catch (err) {
      alert(`Error: ${err.message}`)
    } finally {
      setProcessing(false)
    }
  }

  const handleBatchApprove = async () => {
    if (!confirm('Apply ALL pending changes at once? This cannot be undone.')) return
    
    setProcessing(true)
    try {
      const res = await fetch('/api/acl/discrepancies/batch-approve', {
        method: 'POST',
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      alert(`Applied ${json.processed} changes successfully.${json.errors > 0 ? ` ${json.errors} failed.` : ''}`)
      await fetchData()
    } catch (err) {
      alert(`Error: ${err.message}`)
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div
            className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: B.p4, borderTopColor: 'transparent' }}
          />
          <p className="executive-muted">Loading…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl mt-12 text-center">
        <div className="rounded-xl border p-6" style={{ borderColor: '#ef4444', background: 'rgba(239, 68, 68, 0.1)' }}>
          <p className="font-semibold text-red-400">Error loading discrepancies</p>
          <p className="mt-2 text-sm text-red-300">{error}</p>
        </div>
      </div>
    )
  }

  const { discrepancies = [], lastSync, summary = { total: 0, typeCounts: {} } } = data || {}
  const pendingCount = summary.total

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div>
        <div className="executive-kicker">ACL Reconciliation</div>
        <h1
          className="mt-2 border-l-[3px] pl-3 text-3xl font-semibold text-white"
          style={{ borderColor: B.p4 }}
        >
          ACL Review
        </h1>
        <p className="mt-1 pl-3 text-sm executive-muted">
          {lastSync ? (
            <>
              Last sync: {formatDateTime(lastSync.runAt)} · {lastSync.clientsChecked} clients checked · {pendingCount} pending
            </>
          ) : (
            'No sync run yet'
          )}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Object.entries(CHANGE_TYPE_CONFIG).map(([type, config]) => (
          <div
            key={type}
            className="rounded-xl border p-4"
            style={{ background: B.card, borderColor: B.border }}
          >
            <div className="flex items-center gap-2">
              <span className="text-2xl">{config.emoji}</span>
              <div>
                <p className="text-xs executive-muted">{config.label}</p>
                <p className="text-2xl font-semibold text-white">{summary.typeCounts[type] || 0}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* All Clear or Discrepancy Table */}
      {pendingCount === 0 ? (
        <div
          className="rounded-xl border p-8 text-center"
          style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: '#10b981' }}
        >
          <p className="text-xl font-semibold text-green-400">✅ All clear</p>
          <p className="mt-2 text-sm text-green-300">No discrepancies pending review</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Batch Actions */}
          <div className="flex justify-end">
            <button
              onClick={handleBatchApprove}
              disabled={processing}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: 'white',
                opacity: processing ? 0.6 : 1,
              }}
            >
              {processing ? 'Processing...' : `Apply All (${pendingCount})`}
            </button>
          </div>

          {/* Table */}
          <div
            className="rounded-xl border overflow-hidden"
            style={{ background: B.card, borderColor: B.border }}
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ background: B.inset, borderBottom: `1px solid ${B.border}` }}>
                    <th className="px-4 py-3 text-left text-xs font-medium executive-muted">Client</th>
                    <th className="px-4 py-3 text-left text-xs font-medium executive-muted">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium executive-muted">DB Value</th>
                    <th className="px-4 py-3 text-left text-xs font-medium executive-muted">Stripe Value</th>
                    <th className="px-4 py-3 text-left text-xs font-medium executive-muted">MRR Impact</th>
                    <th className="px-4 py-3 text-right text-xs font-medium executive-muted">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {discrepancies.map((item, idx) => {
                    const config = CHANGE_TYPE_CONFIG[item.changeType] || {}
                    return (
                      <tr
                        key={item.id}
                        style={{
                          borderBottom: idx < discrepancies.length - 1 ? `1px solid ${B.border}` : 'none',
                        }}
                        className="hover:bg-white/5 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-white">{item.clientName}</p>
                          {item.acronym && (
                            <p className="text-xs executive-muted">{item.acronym}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                            style={{ background: `${config.color}22`, color: config.color }}
                          >
                            <span>{config.emoji}</span>
                            <span>{config.label}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-white">{item.dbValue}</td>
                        <td className="px-4 py-3 text-sm text-white">{item.stripeValue}</td>
                        <td className="px-4 py-3 text-sm text-white">
                          {item.mrrImpact != null ? formatCurrency(item.mrrImpact) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleApprove(item.id)}
                              disabled={processing}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                              style={{
                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                color: 'white',
                                opacity: processing ? 0.6 : 1,
                              }}
                            >
                              Apply
                            </button>
                            <button
                              onClick={() => setDismissModalId(item.id)}
                              disabled={processing}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                              style={{
                                background: B.panel,
                                color: B.muted,
                                border: `1px solid ${B.border}`,
                                opacity: processing ? 0.6 : 1,
                              }}
                            >
                              Dismiss
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* History Section */}
      <div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="text-sm font-medium executive-muted hover:text-white transition-colors"
        >
          {showHistory ? '▼' : '▶'} Sync History
        </button>

        {showHistory && (
          <div className="mt-4">
            {!historyData ? (
              <p className="text-sm executive-muted">Loading history...</p>
            ) : historyData.length === 0 ? (
              <p className="text-sm executive-muted">No sync history yet</p>
            ) : (
              <div
                className="rounded-xl border overflow-hidden"
                style={{ background: B.card, borderColor: B.border }}
              >
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: B.inset, borderBottom: `1px solid ${B.border}` }}>
                      <th className="px-4 py-2 text-left text-xs font-medium executive-muted">Date</th>
                      <th className="px-4 py-2 text-left text-xs font-medium executive-muted">Type</th>
                      <th className="px-4 py-2 text-right text-xs font-medium executive-muted">Clients Checked</th>
                      <th className="px-4 py-2 text-right text-xs font-medium executive-muted">Issues Found</th>
                      <th className="px-4 py-2 text-left text-xs font-medium executive-muted">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.map((log, idx) => (
                      <tr
                        key={log.id}
                        style={{
                          borderBottom: idx < historyData.length - 1 ? `1px solid ${B.border}` : 'none',
                        }}
                      >
                        <td className="px-4 py-2 text-white">{formatDateTime(log.runAt)}</td>
                        <td className="px-4 py-2 executive-muted capitalize">{log.syncType}</td>
                        <td className="px-4 py-2 text-right text-white">{log.clientsChecked}</td>
                        <td className="px-4 py-2 text-right text-white">{log.discrepanciesFound}</td>
                        <td className="px-4 py-2 executive-muted capitalize">{log.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dismiss Modal */}
      {dismissModalId && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => setDismissModalId(null)}
        >
          <div
            className="rounded-xl border p-6 max-w-md w-full mx-4"
            style={{ background: B.card, borderColor: B.borderStrong }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white mb-4">Dismiss Discrepancy</h3>
            <p className="text-sm executive-muted mb-4">Why are you dismissing this?</p>
            <textarea
              value={dismissNote}
              onChange={(e) => setDismissNote(e.target.value)}
              placeholder="Enter reason..."
              rows={4}
              className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2"
              style={{
                background: B.inset,
                borderColor: B.border,
                color: 'white',
              }}
            />
            <div className="mt-4 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setDismissModalId(null)
                  setDismissNote('')
                }}
                disabled={processing}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: B.panel,
                  color: B.muted,
                  border: `1px solid ${B.border}`,
                  opacity: processing ? 0.6 : 1,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDismiss}
                disabled={processing || !dismissNote.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  color: 'white',
                  opacity: processing || !dismissNote.trim() ? 0.6 : 1,
                }}
              >
                {processing ? 'Dismissing...' : 'Dismiss'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
