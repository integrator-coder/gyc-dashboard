'use client'

import { useEffect, useState, useCallback } from 'react'

const DEPT_CONFIG = {
  WEB:       { label: 'WEB Builds',      color: '#AE2BCF', bg: 'rgba(174,43,207,0.08)' },
  SEO:       { label: 'SEO',             color: '#22c55e', bg: 'rgba(34,197,94,0.08)'  },
  CRM:       { label: 'CRM Builds',      color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
  BLUEPRINT: { label: 'Blueprint',       color: '#3B82F6', bg: 'rgba(59,130,246,0.08)' },
  OTHER:     { label: 'Other',           color: '#6B7280', bg: 'rgba(107,114,128,0.08)'},
}

const DEPT_ORDER = ['WEB', 'SEO', 'CRM', 'BLUEPRINT', 'OTHER']

const STAGE_SEQUENCES = {
  WEB:       ['Copy', 'Image Selection', 'Design', 'FL Build', 'QC', 'Client Approval'],
  SEO:       ['Set Up', 'Delivery'],
  CRM:       ['Set Up', 'Copy', 'Delivery', 'QC', 'Client Approval'],
  BLUEPRINT: ['Kickoff', 'Strategy', 'Build', 'Review', 'Active'],
  OTHER:     ['In Progress'],
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function TimelineSegment({ stageIdx, currentIdx, totalStages, accent, isBlocked, label }) {
  const isPast    = stageIdx < currentIdx
  const isCurrent = stageIdx === currentIdx

  let bg, shadow
  if (isBlocked && isCurrent) {
    bg     = '#7f1d1d'
    shadow = 'inset 0 0 20px rgba(239,68,68,0.4)'
  } else if (isCurrent) {
    bg     = accent
    shadow = 'inset 0 0 20px rgba(174,43,207,0.4)'
  } else if (isPast) {
    bg     = '#4B1273'
    shadow = 'none'
  } else {
    bg     = '#111827'
    shadow = 'none'
  }

  return (
    <div
      className="flex-1 flex items-center justify-center relative overflow-hidden"
      style={{
        backgroundColor: bg,
        boxShadow: shadow,
        height: 36,
        borderRight: stageIdx < totalStages - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
      }}
    >
      {isCurrent && (
        <span
          className="text-xs font-semibold px-1 truncate select-none"
          style={{ color: isBlocked ? '#fca5a5' : 'rgba(255,255,255,0.9)' }}
        >
          {isBlocked ? '🔴 ' : ''}{label}
        </span>
      )}
    </div>
  )
}

function DueBadge({ dueDate, isOverdue, daysPastDue }) {
  if (!dueDate) return <span className="text-xs text-gray-600">No due date</span>

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  const daysLeft = Math.round((due - today) / (1000 * 60 * 60 * 24))

  let color = '#22c55e'
  if (isOverdue)       color = '#ef4444'
  else if (daysLeft <= 7)  color = '#ef4444'
  else if (daysLeft <= 14) color = '#F59E0B'

  // Format date nicely: "May 15"
  const formatted = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <span className="text-xs font-medium whitespace-nowrap" style={{ color }}>
      📅 {formatted}
      {isOverdue && daysPastDue != null && (
        <span className="ml-1 text-red-400">{daysPastDue}d OVERDUE</span>
      )}
    </span>
  )
}

function DaysBadge({ daysInProgress }) {
  if (daysInProgress == null) return null
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ backgroundColor: '#1a1a2e', color: '#9ca3af', border: '1px solid #2a1a3e' }}
    >
      {daysInProgress}d
    </span>
  )
}

function ProjectRow({ project, stages, accent }) {
  const rowBg = project.isBlocked
    ? 'rgba(239,68,68,0.04)'
    : 'transparent'

  return (
    <div
      className="flex items-center w-full"
      style={{ minHeight: 44, backgroundColor: rowBg, borderRadius: 6 }}
    >
      {/* Name column — 220px fixed */}
      <div style={{ width: 220, flexShrink: 0 }} className="pr-4 pl-1">
        <span className="text-sm text-white truncate block" title={project.name}>
          {project.name}
        </span>
        {project.type && (
          <span className="text-xs text-gray-600 truncate block">{project.type}</span>
        )}
        {project.assignee && (
          <span className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
            <span style={{ color: accent }}>●</span>
            {project.assignee}
          </span>
        )}
        {(project.currentTaskAssignee || project.currentTaskName) ? (
          <span className="text-xs mt-0.5 flex items-center gap-1 text-gray-500">
            <span>⚡</span>
            <span className="truncate">
              {project.currentTaskAssignee
                ? `${project.currentTaskAssignee}${project.currentTaskName ? ` — ${project.currentTaskName}` : ''}`
                : project.currentTaskName}
            </span>
          </span>
        ) : null}
      </div>

      {/* Timeline bar — flex-1 */}
      <div className="flex flex-1 overflow-hidden rounded" style={{ height: 36 }}>
        {stages.map((stage, i) => (
          <TimelineSegment
            key={stage}
            stageIdx={i}
            currentIdx={project.stageIndex}
            totalStages={stages.length}
            accent={accent}
            isBlocked={project.isBlocked}
            label={stage}
          />
        ))}
      </div>

      {/* Info column — 200px fixed */}
      <div
        style={{ width: 200, flexShrink: 0 }}
        className="pl-4 flex items-center gap-2 justify-end"
      >
        <DueBadge
          dueDate={project.dueDate}
          isOverdue={project.isOverdue}
          daysPastDue={project.daysPastDue}
        />
        <DaysBadge daysInProgress={project.daysInProgress} />
      </div>
    </div>
  )
}

function StageGroupDivider({ stageName, count, color }) {
  return (
    <div className="flex items-center gap-3 py-2 mt-4 mb-1">
      <div className="h-px flex-1" style={{ backgroundColor: '#2a1a3e' }} />
      <span
        className="text-xs font-semibold uppercase tracking-widest whitespace-nowrap"
        style={{ color }}
      >
        {stageName} ({count})
      </span>
      <div className="h-px flex-1" style={{ backgroundColor: '#2a1a3e' }} />
    </div>
  )
}

function StageHeaderBar({ stages, color }) {
  return (
    <div
      className="flex w-full"
      style={{ borderBottom: '1px solid #2a1a3e', borderTop: `3px solid ${color}` }}
    >
      {stages.map((stage, i) => (
        <div
          key={stage}
          className="flex-1 text-center py-2 text-xs text-gray-500 uppercase tracking-widest select-none"
          style={{
            borderRight: i < stages.length - 1 ? '1px solid #2a1a3e' : 'none',
          }}
        >
          {stage}
        </div>
      ))}
    </div>
  )
}

function DeptSection({ dept, projects }) {
  const [collapsed, setCollapsed] = useState(false)
  const config = DEPT_CONFIG[dept] || DEPT_CONFIG.OTHER
  const stages = STAGE_SEQUENCES[dept] || STAGE_SEQUENCES.OTHER

  const blockedCount = projects.filter(p => p.isBlocked).length
  const overdueCount = projects.filter(p => p.isOverdue && !p.isBlocked).length

  // Sort by stageIndex DESCENDING (furthest along first), blocked/overdue bump within group
  const sorted = [...projects].sort((a, b) => {
    if (a.stageIndex !== b.stageIndex) return b.stageIndex - a.stageIndex
    if (a.isBlocked !== b.isBlocked) return a.isBlocked ? -1 : 1
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  // Build stage groups (descending stage order)
  const stageGroups = []
  const seen = new Set()
  for (const p of sorted) {
    if (!seen.has(p.stageIndex)) {
      seen.add(p.stageIndex)
      stageGroups.push({
        stageIndex: p.stageIndex,
        stageName: stages[p.stageIndex] || p.stage || 'Unknown',
        items: sorted.filter(x => x.stageIndex === p.stageIndex),
      })
    }
  }

  return (
    <div
      className="w-full rounded-xl overflow-hidden"
      style={{ border: '1px solid #2a1a3e', backgroundColor: '#111111' }}
    >
      {/* Section header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors hover:bg-white/5"
        style={{ borderTop: `3px solid ${config.color}` }}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-semibold text-white text-sm tracking-wide">{config.label}</span>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ backgroundColor: config.bg, color: config.color, border: `1px solid ${config.color}40` }}
          >
            {projects.length} project{projects.length !== 1 ? 's' : ''}
          </span>
          {blockedCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-950 text-red-400 border border-red-800">
              {blockedCount} blocked
            </span>
          )}
          {overdueCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-950/50 text-orange-400 border border-orange-800/50">
              {overdueCount} overdue
            </span>
          )}
        </div>
        <span className="text-gray-500 text-sm ml-2 shrink-0">{collapsed ? '▸' : '▾'}</span>
      </button>

      {/* Expanded content */}
      {!collapsed && (
        <div>
          {/* Stage header bar */}
          <StageHeaderBar stages={stages} color={config.color} />

          {/* Project rows grouped by stage */}
          <div className="px-4 pb-4">
            {stageGroups.map(group => (
              <div key={group.stageIndex}>
                <StageGroupDivider
                  stageName={group.stageName}
                  count={group.items.length}
                  color={config.color}
                />
                <div className="space-y-1">
                  {group.items.map(project => (
                    <ProjectRow
                      key={project.gid}
                      project={project}
                      stages={stages}
                      accent={config.color}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Loading shimmer ──────────────────────────────────────────────────────────

function ShimmerStageBar() {
  return (
    <div className="flex w-full" style={{ borderBottom: '1px solid #2a1a3e', borderTop: '3px solid #2a1a3e' }}>
      {[1, 2, 3, 4].map(i => (
        <div
          key={i}
          className="flex-1 py-2 mx-2 my-1.5 rounded animate-pulse"
          style={{ backgroundColor: '#1a1a2e', height: 16 }}
        />
      ))}
    </div>
  )
}

function ShimmerProjectRow() {
  return (
    <div className="flex items-center w-full gap-0" style={{ minHeight: 44 }}>
      <div style={{ width: 220, flexShrink: 0 }} className="pr-4">
        <div className="h-4 rounded animate-pulse" style={{ backgroundColor: '#1a1a2e', width: '80%' }} />
      </div>
      <div className="flex-1 rounded animate-pulse" style={{ height: 36, backgroundColor: '#1a1a2e' }} />
      <div style={{ width: 200, flexShrink: 0 }} className="pl-4 flex justify-end gap-2">
        <div className="h-4 w-16 rounded animate-pulse" style={{ backgroundColor: '#1a1a2e' }} />
        <div className="h-4 w-10 rounded animate-pulse" style={{ backgroundColor: '#1a1a2e' }} />
      </div>
    </div>
  )
}

function ShimmerSection() {
  return (
    <div
      className="w-full rounded-xl overflow-hidden"
      style={{ border: '1px solid #2a1a3e', backgroundColor: '#111111', borderTop: '3px solid #2a1a3e' }}
    >
      {/* Fake header */}
      <div className="flex items-center gap-3 px-5 py-4">
        <div className="h-4 w-24 rounded animate-pulse" style={{ backgroundColor: '#1a1a2e' }} />
        <div className="h-5 w-16 rounded-full animate-pulse" style={{ backgroundColor: '#1a1a2e' }} />
      </div>
      {/* Fake stage bar */}
      <ShimmerStageBar />
      {/* Fake rows */}
      <div className="px-4 pb-4 pt-2 space-y-1">
        {[1, 2, 3, 4, 5].map(i => <ShimmerProjectRow key={i} />)}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProductionPipeline({ dept = null }) {
  const [data, setData]               = useState(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [lastRefresh, setLastRefresh] = useState(null)

  const fetchData = useCallback(async () => {
    try {
      const res  = await fetch('/api/metrics/production-projects')
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || 'Failed to load project pipeline')
      setData(json)
      setLastRefresh(new Date())
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchData])

  const grouped = data?.grouped || {}

  const deptsPresent = DEPT_ORDER.filter(d => grouped[d]?.length > 0)
  const extraDepts   = Object.keys(grouped).filter(d => !DEPT_ORDER.includes(d) && grouped[d]?.length > 0)
  const allDepts     = [...deptsPresent, ...extraDepts]
  const visibleDepts = dept ? allDepts.filter(d => d === dept) : allDepts

  const totalProjects = dept
    ? (data?.projects || []).filter(p => p.department === dept).length
    : (data?.projects?.length || 0)

  return (
    <div className="w-full space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {!loading && !error && (
            <span className="text-xs text-gray-500">
              {totalProjects} active project{totalProjects !== 1 ? 's' : ''}
              {lastRefresh && ` · refreshed ${lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
            </span>
          )}
        </div>
        <button
          onClick={() => { setLoading(true); fetchData() }}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium rounded-lg transition-colors border border-gray-700"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="w-full space-y-4">
          <ShimmerSection />
          <ShimmerSection />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-red-300 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && allDepts.length === 0 && (
        <div className="rounded-lg border border-gray-800 bg-gray-900/30 px-4 py-6 text-center text-gray-500 text-sm">
          No active projects found.
        </div>
      )}

      {/* Department sections */}
      {!loading && !error && visibleDepts.map(d => (
        <DeptSection
          key={d}
          dept={d}
          projects={grouped[d]}
        />
      ))}
    </div>
  )
}
