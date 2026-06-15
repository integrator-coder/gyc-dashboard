'use client'

import { useEffect, useState } from 'react'

function SeverityBadge({ type }) {
  const styles = {
    BLOCKED: 'bg-red-900/40 text-red-300 border-red-700/50',
    OVERDUE: 'bg-red-900/40 text-red-300 border-red-700/50',
    STALE: 'bg-yellow-900/40 text-yellow-300 border-yellow-700/50',
    UNOWNED: 'bg-orange-900/40 text-orange-300 border-orange-700/50',
  }

  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${styles[type] || 'bg-gray-800 text-gray-300'}`}>
      {type}
    </span>
  )
}

function ClientBadge({ acronym }) {
  if (!acronym) return null
  return (
    <span className="inline-flex items-center rounded-md bg-cyan-950/50 border border-cyan-800/50 px-2 py-0.5 text-xs font-semibold text-cyan-300">
      {acronym}
    </span>
  )
}

function TaskRow({ item }) {
  const task = item.task
  const asanaUrl = `https://app.asana.com/0/${item.projectGid}/${task.gid}`
  
  // Calculate days metric
  const overdueIssue = item.issues.find(i => i.type === 'OVERDUE')
  const staleIssue = item.issues.find(i => i.type === 'STALE')
  const daysMetric = overdueIssue?.daysPastDue || staleIssue?.daysSinceModified || 0
  const daysLabel = overdueIssue ? 'past due' : 'since update'

  // Format due date
  const dueDate = task.due_on ? new Date(task.due_on + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
  const isDueSoon = task.due_on && new Date(task.due_on + 'T00:00:00') - new Date() < 3 * 24 * 60 * 60 * 1000
  const isPastDue = overdueIssue !== undefined

  const taskNameTruncated = task.name.length > 60 ? task.name.substring(0, 60) + '…' : task.name

  return (
    <tr className="border-b border-gray-800/50 hover:bg-gray-900/30">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <ClientBadge acronym={item.clientAcronym} />
          <span className="text-sm text-gray-200">{taskNameTruncated}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-400">{item.projectName}</td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {item.issues.map((issue, idx) => (
            <SeverityBadge key={idx} type={issue.type} />
          ))}
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-300">
        {daysMetric > 0 ? `${daysMetric}d ${daysLabel}` : '—'}
      </td>
      <td className="px-4 py-3 text-sm">
        {task.assignee ? (
          <span className="text-gray-300">{task.assignee.name}</span>
        ) : (
          <span className="text-red-400 font-medium">Unassigned</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm">
        <span className={isPastDue ? 'text-red-400 font-medium' : isDueSoon ? 'text-orange-400' : 'text-gray-400'}>
          {dueDate}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        <a
          href={asanaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-400 hover:text-cyan-300 transition-colors"
          title="Open in Asana"
        >
          <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </td>
    </tr>
  )
}

function SeveritySection({ title, severity, items, colorClass }) {
  if (!items || items.length === 0) return null

  return (
    <div className="mb-8">
      <h2 className={`text-lg font-semibold mb-4 ${colorClass}`}>
        {title} ({items.length})
      </h2>
      <div className="overflow-x-auto rounded-lg border border-gray-800/50">
        <table className="w-full">
          <thead className="bg-gray-900/50 border-b border-gray-800">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Client/Task</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Project</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Issue</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Days Stalled</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Owner</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Due Date</th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-400">Link</th>
            </tr>
          </thead>
          <tbody className="bg-gray-950/30">
            {items.map((item, idx) => (
              <TaskRow key={`${item.task.gid}-${idx}`} item={item} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatCard({ label, value, emoji, colorClass }) {
  return (
    <div className="rounded-xl border border-gray-800/50 bg-gray-950/50 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400">{label}</p>
          <p className={`text-3xl font-bold mt-1 ${colorClass}`}>{value}</p>
        </div>
        <div className="text-4xl">{emoji}</div>
      </div>
    </div>
  )
}

export default function WorkflowHealthPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastFetched, setLastFetched] = useState(null)

  async function fetchData() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/asana/workflow-health', { cache: 'no-store' })
      if (!response.ok) {
        throw new Error('Failed to fetch workflow health data')
      }
      const json = await response.json()
      if (json.error) {
        throw new Error(json.error)
      }
      setData(json)
      setLastFetched(new Date(json.lastFetched))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()

    // Auto-refresh every 10 minutes
    const interval = setInterval(() => {
      fetchData()
    }, 10 * 60 * 1000)

    return () => clearInterval(interval)
  }, [])

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-gray-400">Loading workflow health data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-4xl mb-4 text-red-400">⚠️</div>
          <p className="text-red-400 font-semibold mb-2">Error loading data</p>
          <p className="text-gray-400 text-sm">{error}</p>
          <button
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const { critical, high, medium, summary } = data || { critical: [], high: [], medium: [], summary: {} }
  const hasIssues = summary.total > 0

  return (
    <div className="max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <span>⚠️</span>
            <span>Workflow Health</span>
          </h1>
          {lastFetched && (
            <p className="text-sm text-gray-400 mt-1">
              Last checked: {lastFetched.toLocaleString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                hour: 'numeric', 
                minute: '2-digit',
                hour12: true 
              })}
            </p>
          )}
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Critical"
          value={summary.critical || 0}
          emoji="🔴"
          colorClass="text-red-400"
        />
        <StatCard
          label="High"
          value={summary.high || 0}
          emoji="🟠"
          colorClass="text-orange-400"
        />
        <StatCard
          label="Medium"
          value={summary.medium || 0}
          emoji="🟡"
          colorClass="text-yellow-400"
        />
        <StatCard
          label={hasIssues ? 'Total Issues' : 'Clear'}
          value={hasIssues ? summary.total || 0 : '✓'}
          emoji={hasIssues ? '⚠️' : '✅'}
          colorClass={hasIssues ? 'text-white' : 'text-green-400'}
        />
      </div>

      {/* Issue Sections */}
      {hasIssues ? (
        <>
          <SeveritySection
            title="🔴 Critical — Needs Immediate Action"
            severity="critical"
            items={critical}
            colorClass="text-red-400"
          />
          <SeveritySection
            title="🟠 High — Action Required Today"
            severity="high"
            items={high}
            colorClass="text-orange-400"
          />
          <SeveritySection
            title="🟡 Medium — At Risk"
            severity="medium"
            items={medium}
            colorClass="text-yellow-400"
          />
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-green-800/50 bg-green-950/20">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-semibold text-green-400 mb-2">All Clear</h2>
          <p className="text-gray-400">No stalled projects detected</p>
          {lastFetched && (
            <p className="text-sm text-gray-500 mt-2">
              as of {lastFetched.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
