import { NextResponse } from 'next/server'

const ASANA_PAT = process.env.ASANA_PAT
const ASANA_BASE = 'https://app.asana.com/api/1.0'

const PROJECTS = [
  { gid: '1201619092827904', name: 'Client Onboarding' },
  { gid: '1201619092827910', name: 'Client Offboarding' },
  { gid: '1203802857733729', name: 'Production L10' },
  { gid: '1203932276376287', name: 'CX Forward' },
  { gid: '931091889858221', name: 'GYC Management' },
]

function extractClientAcronym(taskName) {
  const match = taskName.match(/\[([A-Z]{2,6})\]/)
  return match ? match[1] : null
}

function evaluateStallCriteria(task) {
  const issues = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Already completed → skip
  if (task.completed) return null

  const taskName = (task.name || '').toLowerCase()
  const tags = (task.tags || []).map(t => (t.name || '').toLowerCase())

  // 🔴 BLOCKED
  if (taskName.includes('blocked') || tags.includes('blocked')) {
    issues.push({ type: 'BLOCKED', severity: 'critical' })
  }

  // Check due date issues
  if (task.due_on) {
    const dueDate = new Date(task.due_on + 'T00:00:00')
    const daysPastDue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24))

    // 🔴 OVERDUE
    if (daysPastDue > 0) {
      issues.push({
        type: 'OVERDUE',
        severity: daysPastDue > 7 ? 'critical' : 'high',
        daysPastDue,
      })
    }

    // 🟡 STALE (not modified in 7+ days)
    if (task.modified_at) {
      const modifiedDate = new Date(task.modified_at)
      const daysSinceModified = Math.floor((today - modifiedDate) / (1000 * 60 * 60 * 24))

      if (daysSinceModified > 7) {
        issues.push({
          type: 'STALE',
          severity: 'medium',
          daysSinceModified,
        })
      }
    }

    // 🟠 UNOWNED
    if (!task.assignee) {
      issues.push({
        type: 'UNOWNED',
        severity: 'high',
      })
    }
  }

  if (issues.length === 0) return null

  // Determine overall severity (highest issue)
  const severityRank = { critical: 0, high: 1, medium: 2 }
  const highestSeverity = issues.reduce((highest, issue) => {
    return severityRank[issue.severity] < severityRank[highest] ? issue.severity : highest
  }, 'medium')

  return {
    task,
    issues,
    severity: highestSeverity,
  }
}

async function fetchAsanaData() {
  if (!ASANA_PAT) {
    throw new Error('ASANA_PAT not configured')
  }

  const headers = {
    'Authorization': `Bearer ${ASANA_PAT}`,
    'Accept': 'application/json',
  }

  const allStalledTasks = []

  for (const project of PROJECTS) {
    try {
      const url = `${ASANA_BASE}/projects/${project.gid}/tasks?opt_fields=name,due_on,assignee,assignee.name,completed,modified_at,tags,tags.name,memberships.section.name`
      
      const response = await fetch(url, { headers })
      
      if (response.status === 429) {
        // Rate limited - wait and retry once
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10)
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
        const retryResponse = await fetch(url, { headers })
        if (!retryResponse.ok) {
          console.error(`Failed to fetch ${project.name} after retry:`, retryResponse.status)
          continue
        }
        const retryData = await retryResponse.json()
        const tasks = retryData.data || []
        
        for (const task of tasks) {
          const stalled = evaluateStallCriteria(task)
          if (stalled) {
            allStalledTasks.push({
              ...stalled,
              projectName: project.name,
              projectGid: project.gid,
              clientAcronym: extractClientAcronym(task.name),
            })
          }
        }
        continue
      }

      if (!response.ok) {
        console.error(`Failed to fetch ${project.name}:`, response.status)
        continue
      }

      const data = await response.json()
      const tasks = data.data || []

      for (const task of tasks) {
        const stalled = evaluateStallCriteria(task)
        if (stalled) {
          allStalledTasks.push({
            ...stalled,
            projectName: project.name,
            projectGid: project.gid,
            clientAcronym: extractClientAcronym(task.name),
          })
        }
      }
    } catch (error) {
      console.error(`Error fetching ${project.name}:`, error)
    }
  }

  // Group by severity
  const critical = allStalledTasks.filter(t => t.severity === 'critical')
  const high = allStalledTasks.filter(t => t.severity === 'high')
  const medium = allStalledTasks.filter(t => t.severity === 'medium')

  return {
    critical,
    high,
    medium,
    summary: {
      critical: critical.length,
      high: high.length,
      medium: medium.length,
      total: allStalledTasks.length,
    },
    lastFetched: new Date().toISOString(),
  }
}

export async function GET() {
  try {
    const data = await fetchAsanaData()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Workflow Health API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch workflow health data' },
      { status: 500 }
    )
  }
}
