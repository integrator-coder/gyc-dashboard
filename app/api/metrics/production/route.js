import { NextResponse } from 'next/server'
import { asanaFetch, mapAsanaCustomFields } from '@/lib/asana'

export const dynamic = 'force-dynamic'

const PORTFOLIO_ID = '1205807037864307'

function getDateValue(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function diffDays(start, end) {
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
}

function getNormalizedStage(project) {
  return String(project.fieldMap.Stage || '').toLowerCase()
}

function isCompletedStage(stage) {
  return /(approved|complete|completed|launched)/i.test(stage)
}

function isBlockedStage(stage) {
  return /blocked/i.test(stage)
}

function isClientApprovalStage(stage) {
  return /client approval/i.test(stage)
}

function getProjectDueDate(project) {
  return getDateValue(project.due_on || project.fieldMap['Due due'] || project.fieldMap['QL due'])
}

function getStageBucket(stage) {
  if (stage.includes('blocked')) return 'blocked'
  if (stage.includes('client approval')) return 'clientApproval'
  if (stage.includes('design')) return 'design'
  if (stage.includes('copy')) return 'copy'
  if (stage.includes('fl build') || stage.includes('build')) return 'flBuild'
  return 'other'
}

function getSeoStageBucket(stage) {
  if (stage.includes('blocked')) return 'blocked'
  if (stage.includes('set up') || stage.includes('setup')) return 'setUp'
  if (stage.includes('delivery')) return 'delivery'
  return 'other'
}

function getTypeBucket(type) {
  const normalized = String(type || '').toLowerCase()
  if (normalized === 'website') return 'website'
  if (normalized === 'redesign') return 'redesign'
  if (normalized === 'mobile-rich website') return 'mobileRich'
  return 'other'
}

function createProjectRecord(project) {
  return { ...project, fieldMap: mapAsanaCustomFields(project) }
}

export async function GET() {
  try {
    const data = await asanaFetch(
      `/portfolios/${PORTFOLIO_ID}/items?opt_fields=name,gid,completed,completed_at,created_at,start_on,due_on,current_status.text,custom_fields.name,custom_fields.display_value,custom_fields.text_value,custom_fields.number_value,custom_fields.date_value.date,custom_fields.enum_value.name`
    )

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const ninetyDaysAgo = new Date(today)
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const allProjects = (data.data || []).map(createProjectRecord)

    const webProjects = allProjects.filter(project =>
      String(project.fieldMap.Department || '').toUpperCase() === 'WEB'
    )

    const seoProjects = allProjects.filter(project =>
      String(project.fieldMap.Department || '').toUpperCase() === 'SEO'
    )

    const activeWebProjects = webProjects.filter(project => {
      const stage = getNormalizedStage(project)
      return !isCompletedStage(stage) && !project.completed
    })

    const stageBreakdown = activeWebProjects.reduce(
      (acc, project) => {
        acc[getStageBucket(getNormalizedStage(project))] += 1
        return acc
      },
      { design: 0, copy: 0, flBuild: 0, clientApproval: 0, blocked: 0, other: 0 }
    )

    const typeBreakdown = activeWebProjects.reduce(
      (acc, project) => {
        acc[getTypeBucket(project.fieldMap['Website type'])] += 1
        return acc
      },
      { website: 0, redesign: 0, mobileRich: 0, other: 0 }
    )

    const projectsInProduction = activeWebProjects.length

    const clientApprovalProjects = activeWebProjects.filter(project =>
      isClientApprovalStage(getNormalizedStage(project))
    )

    const onTimeCount = clientApprovalProjects.filter(project => {
      const dueDate = getProjectDueDate(project)
      return dueDate && dueDate >= today
    }).length

    const lateCount = clientApprovalProjects.filter(project => {
      const dueDate = getProjectDueDate(project)
      return dueDate && dueDate < today
    }).length

    const overdueCount = activeWebProjects.filter(project => {
      const stage = getNormalizedStage(project)
      const dueDate = getProjectDueDate(project)
      return dueDate && dueDate < today && !isClientApprovalStage(stage)
    }).length

    const completedBuilds = webProjects.filter(project => {
      const completedAt = getDateValue(project.completed_at)
      return project.completed && completedAt && completedAt >= ninetyDaysAgo
    })

    const buildTimes = completedBuilds
      .map(project => {
        const startDate = getDateValue(project.start_on || project.fieldMap['Start date'] || project.created_at)
        const clientApprovalDate = getDateValue(project.completed_at)
        if (!startDate || !clientApprovalDate) return null
        return diffDays(startDate, clientApprovalDate)
      })
      .filter(value => value !== null)

    const avgBuildTimeDays = buildTimes.length
      ? Number((buildTimes.reduce((sum, days) => sum + days, 0) / buildTimes.length).toFixed(1))
      : 0

    const denominator = onTimeCount + lateCount
    const onTimePct = denominator ? Number(((onTimeCount / denominator) * 100).toFixed(1)) : 0

    const activeSeoProjects = seoProjects.filter(project => {
      const stage = getNormalizedStage(project)
      return !isCompletedStage(stage) && !project.completed
    })

    const seoInProduction = activeSeoProjects.length

    const seoStageBreakdown = activeSeoProjects.reduce(
      (acc, project) => {
        acc[getSeoStageBucket(getNormalizedStage(project))] += 1
        return acc
      },
      { setUp: 0, delivery: 0, blocked: 0, other: 0 }
    )

    const seoOverdueCount = activeSeoProjects.filter(project => {
      const dueDate = getProjectDueDate(project)
      return dueDate && dueDate < today
    }).length

    const blockedProjects = allProjects
      .filter(project => {
        const department = String(project.fieldMap.Department || '').toUpperCase()
        return (department === 'WEB' || department === 'SEO') && isBlockedStage(getNormalizedStage(project)) && !project.completed
      })
      .map(project => {
        const dueDate = getProjectDueDate(project)
        return {
          name: project.name,
          department: String(project.fieldMap.Department || '').toUpperCase() || 'OTHER',
          dueDate: dueDate ? dueDate.toISOString().slice(0, 10) : null,
          daysPastDue: dueDate && dueDate < today ? diffDays(dueDate, today) : null,
        }
      })
      .sort((a, b) => {
        if (a.daysPastDue === null && b.daysPastDue === null) return a.name.localeCompare(b.name)
        if (a.daysPastDue === null) return 1
        if (b.daysPastDue === null) return -1
        return b.daysPastDue - a.daysPastDue
      })

    return NextResponse.json({
      projectsInProduction,
      stageBreakdown,
      overdueCount,
      typeBreakdown,
      onTimeCount,
      lateCount,
      onTimePct,
      avgBuildTimeDays,
      seoInProduction,
      seoStageBreakdown,
      seoOverdueCount,
      blockedProjects,
      totalWebProjects: webProjects.length,
      completedWebProjectsLast90d: completedBuilds.length,
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
