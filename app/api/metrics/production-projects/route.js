import { NextResponse } from 'next/server'
import { asanaFetch, mapAsanaCustomFields } from '@/lib/asana'

export const dynamic = 'force-dynamic'

const PORTFOLIO_ID = '1205807037864307'

const STAGE_SEQUENCES = {
  WEB: ['Copy', 'Image Selection', 'Design', 'FL Build', 'QC', 'Client Approval'],
  SEO: ['Set Up', 'Delivery'],
  CRM: ['Set Up', 'Copy', 'Delivery', 'QC', 'Client Approval'],
  BLUEPRINT: ['Kickoff', 'Strategy', 'Build', 'Review', 'Active'],
}

function normalizeDept(rawDept) {
  const d = String(rawDept || '').trim().toUpperCase()
  if (d === 'WEB') return 'WEB'
  if (d === 'SEO') return 'SEO'
  if (d.startsWith('CRM')) return 'CRM'
  if (d.startsWith('BLUEPRINT')) return 'BLUEPRINT'
  return 'OTHER'
}

function getDepartment(fieldMap) {
  const raw = fieldMap.Department || fieldMap['Service Line'] || fieldMap['Team'] || ''
  return normalizeDept(raw)
}

function getStageInfo(currentStage, department) {
  const sequence = STAGE_SEQUENCES[department] || []
  const totalStages = sequence.length

  if (!currentStage || totalStages === 0) {
    return {
      stageIndex: 0,
      totalStages,
      nextStage: sequence[0] || null,
    }
  }

  const normalizedCurrent = String(currentStage).toLowerCase()
  let matchedIndex = sequence.findIndex(s =>
    normalizedCurrent.includes(s.toLowerCase())
  )

  // Special case: "HP Build" and other non-FL-Build build stages (e.g. "HP Build ")
  // that contain "build" but don't match "FL Build" substring — map to FL Build index
  if (matchedIndex === -1 && department === 'WEB' && normalizedCurrent.includes('build')) {
    matchedIndex = sequence.findIndex(s => s === 'FL Build')
  }

  if (matchedIndex === -1) {
    return {
      stageIndex: 0,
      totalStages,
      nextStage: sequence[0] || null,
    }
  }

  return {
    stageIndex: matchedIndex,
    totalStages,
    nextStage: matchedIndex + 1 < totalStages ? sequence[matchedIndex + 1] : null,
  }
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length)
  let index = 0
  async function worker() {
    while (true) {
      const i = index++
      if (i >= items.length) return
      results[i] = await mapper(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

async function getCurrentTask(projectGid) {
  try {
    const data = await asanaFetch(
      `/tasks?project=${projectGid}&opt_fields=name,completed,assignee.name,due_on&limit=50`
    )
    const tasks = (data.data || []).filter(t => !t.completed)

    // 1. Prefer first incomplete task that has an assignee
    const withAssignee = tasks.find(t => t.assignee?.name)
    if (withAssignee) {
      return {
        taskName: withAssignee.name,
        taskAssignee: withAssignee.assignee.name,
      }
    }

    // 2. Fallback: first incomplete task regardless of assignee
    if (tasks[0]) {
      return {
        taskName: tasks[0].name,
        taskAssignee: null,
      }
    }

    return null
  } catch {
    return null
  }
}

function diffDays(start, end) {
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
}

function getDateValue(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export async function GET() {
  try {
    const data = await asanaFetch(
      `/portfolios/${PORTFOLIO_ID}/items?opt_fields=name,gid,completed,completed_at,created_at,start_on,due_on,custom_fields.name,custom_fields.display_value,custom_fields.text_value,custom_fields.number_value,custom_fields.date_value.date,custom_fields.enum_value.name,owner.name,members.name`
    )

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const rawProjects = data.data || []

    const projects = rawProjects
      .map(item => {
        const fieldMap = mapAsanaCustomFields(item)
        const stage = fieldMap.Stage || fieldMap['Project Stage'] || fieldMap['Status'] || ''
        const department = getDepartment(fieldMap)

        // Filter: skip completed projects and completed-like stages
        if (item.completed === true) return null
        if (/(approved|complete|completed|launched)/i.test(String(stage))) return null

        // Filter: skip CRM projects with no stage (e.g. "CRM Work Requests" catchall)
        if (department === 'CRM' && (!stage || stage === 'undefined')) return null

        const { stageIndex, totalStages, nextStage } = getStageInfo(stage, department)

        const startDate = item.start_on || null
        const dueDate = item.due_on || null

        const startDateObj = getDateValue(startDate) || getDateValue(item.created_at)
        const dueDateObj = getDateValue(dueDate)

        const daysInProgress = startDateObj ? diffDays(startDateObj, today) : null
        const isBlocked = /blocked/i.test(String(stage))
        const isOverdue = dueDateObj ? dueDateObj < today && !isBlocked : false
        const daysPastDue = isOverdue && dueDateObj ? diffDays(dueDateObj, today) : null

        const type = fieldMap['Website type'] || fieldMap['Type'] || fieldMap['Service type'] || null

        const owner = item.owner?.name || null
        const firstMember = item.members?.[0]?.name || null
        const assignee = owner || firstMember || null

        return {
          gid: item.gid,
          name: item.name,
          department,
          stage: stage || null,
          stageIndex,
          totalStages,
          nextStage,
          type,
          startDate,
          dueDate,
          daysInProgress,
          isOverdue,
          daysPastDue,
          isBlocked,
          assignee,
          currentTaskName: null,
          currentTaskAssignee: null,
        }
      })
      .filter(Boolean)

    // Fetch current task for each active project
    await mapWithConcurrency(projects, 5, async project => {
      const currentTask = await getCurrentTask(project.gid)
      project.currentTaskName = currentTask?.taskName || null
      project.currentTaskAssignee = currentTask?.taskAssignee || null
    })

    // Group by department
    const grouped = {}
    for (const project of projects) {
      const dept = project.department
      if (!grouped[dept]) grouped[dept] = []
      grouped[dept].push(project)
    }

    // Sort within each group: blocked first, then overdue, then by name
    for (const dept of Object.keys(grouped)) {
      grouped[dept].sort((a, b) => {
        if (a.isBlocked !== b.isBlocked) return a.isBlocked ? -1 : 1
        if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1
        return a.name.localeCompare(b.name)
      })
    }

    return NextResponse.json({
      projects,
      grouped,
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
