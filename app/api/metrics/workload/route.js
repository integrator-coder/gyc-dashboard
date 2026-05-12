export const dynamic = 'force-dynamic'

import { asanaFetch } from '@/lib/asana'

const SUPPORT_PROJECT_ID = '1209274556202440'
const TC_WORK_PROJECT_ID = '1208412771400615'
const WORKSPACE_ID = '931093392134374'

// Section name → key mapping for T&C Work Requests
const STAGE_MAP = {
  '⏰ Queued': { key: 'queued', stage: 'Queued' },
  '📢 Paid Social - In-Progress': { key: 'paidSocial', stage: 'Paid Social' },
  '🖱️ Google Ads - In-Progress': { key: 'googleAds', stage: 'Google Ads' },
  '📖 Hubspot': { key: 'hubspot', stage: 'Hubspot' },
  '🤔 Issues / Follow-up': { key: 'issues', stage: 'Issues / Follow-up' },
  '🧪 In Split-Testing': { key: 'splitTesting', stage: 'In Split-Testing' },
  '🤓 In Learning Phase': { key: 'learningPhase', stage: 'In Learning Phase' },
  '🤝 Production Tasks': { key: 'productionTasks', stage: 'Production Tasks' },
}

async function fetchWebsiteSupport() {
  const data = await asanaFetch(
    `/tasks?project=${SUPPORT_PROJECT_ID}&opt_fields=name,completed,assignee.name,memberships.section.name&limit=100`
  )

  const tasks = (data.data || []).filter((t) => !t.completed)

  const unassignedQueue = []
  const byPersonMap = {}

  for (const task of tasks) {
    const sectionName = task.memberships?.[0]?.section?.name || 'OTHERS'
    const sectionUpper = sectionName.toUpperCase().trim()

    if (sectionUpper === 'REQUESTS') {
      unassignedQueue.push(task.name)
    } else {
      // Normalize section name to title case for display
      const personKey = sectionUpper
      if (!byPersonMap[personKey]) {
        byPersonMap[personKey] = {
          person: sectionName
            .split(' ')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(' '),
          count: 0,
          tasks: [],
        }
      }
      byPersonMap[personKey].count++
      if (byPersonMap[personKey].tasks.length < 10) {
        byPersonMap[personKey].tasks.push(task.name)
      }
    }
  }

  const byPerson = Object.values(byPersonMap).sort((a, b) => b.count - a.count)

  return {
    totalOpen: tasks.length,
    unassignedQueue: unassignedQueue.length,
    byPerson,
  }
}

async function fetchPaidMedia() {
  const data = await asanaFetch(
    `/tasks?project=${TC_WORK_PROJECT_ID}&opt_fields=name,completed,assignee.name,memberships.section.name&limit=100`
  )

  const tasks = (data.data || []).filter((t) => {
    if (t.completed) return false
    const sectionName = t.memberships?.[0]?.section?.name || ''
    if (/(completed|✅)/i.test(sectionName)) return false
    return true
  })

  const stageGroups = {}

  for (const task of tasks) {
    const sectionName = task.memberships?.[0]?.section?.name || ''
    const mapped = STAGE_MAP[sectionName]
    const key = mapped ? mapped.key : 'other'
    const stage = mapped ? mapped.stage : 'Other'

    if (!stageGroups[key]) {
      stageGroups[key] = { stage, key, count: 0, tasks: [] }
    }
    stageGroups[key].count++
    if (stageGroups[key].tasks.length < 10) {
      stageGroups[key].tasks.push(task.name)
    }
  }

  const byStage = Object.values(stageGroups)
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count)

  return {
    totalOpen: tasks.length,
    byStage,
  }
}

async function fetchOrphanedTasks() {
  const data = await asanaFetch(
    `/workspaces/${WORKSPACE_ID}/tasks/search?completed=false&opt_fields=name,assignee.name,projects.name&limit=100`
  )

  const tasks = (data.data || []).filter((t) => !t.projects || t.projects.length === 0)

  return {
    count: tasks.length,
    tasks: tasks.map((t) => ({
      name: t.name,
      assignee: t.assignee?.name || null,
    })),
    note: 'Sample of up to 100 results — actual count may be higher',
  }
}

export async function GET() {
  try {
    const [websiteSupport, paidMedia, orphanedTasks] = await Promise.all([
      fetchWebsiteSupport(),
      fetchPaidMedia(),
      fetchOrphanedTasks(),
    ])

    return Response.json({
      websiteSupport,
      paidMedia,
      orphanedTasks,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[workload] error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
