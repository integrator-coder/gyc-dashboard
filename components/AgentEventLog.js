'use client'
import { useState, useEffect, useCallback } from 'react'

function formatTs(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  return d.toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

export default function AgentEventLog() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterAgent, setFilterAgent] = useState('all')
  const [lastRefresh, setLastRefresh] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/mission-control/agent-log?limit=100', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load agent log')
      setLogs(json.logs || [])
      setLastRefresh(new Date())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [load])

  const agentNames = ['all', ...Array.from(new Set(logs.map(l => l.agentName).filter(Boolean))).sort()]

  const filtered = filterAgent === 'all' ? logs : logs.filter(l => l.agentName === filterAgent)

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-bold text-white">📋 Agent Event Log</h2>
        <select
          value={filterAgent}
          onChange={e => setFilterAgent(e.target.value)}
          className="rounded-lg border border-[var(--brand-border)] bg-black/30 px-3 py-1.5 text-sm text-gray-200 focus:border-violet-500/50 focus:outline-none"
        >
          {agentNames.map(name => (
            <option key={name} value={name}>{name === 'all' ? 'All agents' : name}</option>
          ))}
        </select>
        <button
          onClick={load}
          disabled={loading}
          className="ml-auto rounded-xl border border-[var(--brand-border)] px-4 py-1.5 text-sm font-medium text-gray-300 transition hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-white disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
        {lastRefresh && (
          <span className="text-xs text-gray-500">Last updated {lastRefresh.toLocaleTimeString()}</span>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-[var(--brand-border)] bg-black/30">
        {filtered.length === 0 && !loading ? (
          <div className="px-6 py-10 text-center text-sm text-gray-500">
            {error ? 'Error loading logs.' : 'No agent events recorded yet.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--brand-border)] text-xs uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3 text-left">Timestamp</th>
                <th className="px-4 py-3 text-left">Agent</th>
                <th className="px-4 py-3 text-left">Action</th>
                <th className="px-4 py-3 text-left">Target</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Records</th>
                <th className="px-4 py-3 text-right">Duration</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log, i) => {
                const isOk = log.status === 'ok' || log.status === 'success'
                const isError = log.status === 'error' || log.status === 'failed'
                return (
                  <tr
                    key={log.id || i}
                    className="border-b border-[var(--brand-border)]/40 transition hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-400">{formatTs(log.createdAt)}</td>
                    <td className="px-4 py-2.5 font-medium text-violet-300">{log.agentName || log.agentId || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-200">{log.action || '—'}</td>
                    <td className="px-4 py-2.5 max-w-[200px] truncate text-gray-400" title={log.target}>{log.target || '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                        isOk ? 'bg-green-500/15 text-green-300' :
                        isError ? 'bg-red-500/15 text-red-300' :
                        'bg-gray-500/15 text-gray-400'
                      }`}>
                        {log.status || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-gray-400">
                      {log.recordsAffected != null ? log.recordsAffected.toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-gray-400">
                      {log.durationMs != null ? `${log.durationMs}ms` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-xs text-gray-600">Showing {filtered.length} of {logs.length} entries · auto-refreshes every 30s</p>
    </div>
  )
}
