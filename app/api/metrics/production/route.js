import { NextResponse } from 'next/server'
import { asanaFetch, mapAsanaCustomFields } from '@/lib/asana'

const ASANA_BASE = 'https://app.asana.com/api/1.0'

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

function getProjectStartDate(project) {
  return getDateValue(project.start_on || project.fieldMap['Start date'] || project.created_at)
}

function getProjectCompletedDate(project) {
  return getDateValue(project.completed_at)
}

function getEffectiveCompletedDate(project) {
  return getDateValue(project.effectiveCompletionDate)
}

function getCompletionMetrics(project) {
  const startDate = getProjectStartDate(project)
  const completedAt = getEffectiveCompletedDate(project)
  const dueDate = getProjectDueDate(project)

  if (!completedAt) return null

  const buildDays = startDate ? diffDays(startDate, completedAt) : null
  const onTime = dueDate ? completedAt.getTime() <= dueDate.getTime() : null

  return {
    buildDays,
    onTime,
    completedAt,
  }
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
  return { ...project, fieldMap: mapAsanaCustomFields(project), effectiveCompletionDate: null }
}

function getAsanaHeaders() {
  const token = process.env.ASANA_TOKEN || process.env.ASANA_PAT
  return {
    Authorization: `Bearer ${token}`,
  }
}

function getCompletionSignalNames(project) {
  const department = String(project.fieldMap.Department || '').toUpperCase()

  if (department === 'SEO') {
    return ['seo setup complete', 'delivery', 'go live', 'launched', 'onboarding complete']
  }

  if (department === 'WEB') {
    return ['website is completed', 'full website launch', 'homepage launch', 'a landing page has been launched', 'go live']
  }

  return []
}

async function getEffectiveCompletionDate(projectGid, asanaHeaders, signalNames) {
  if (!signalNames.length) return null

  const url = `${ASANA_BASE}/tasks?project=${projectGid}&opt_fields=name,completed,completed_at&limit=50`
  const res = await fetch(url, {
    headers: asanaHeaders,
    cache: 'no-store',
  })

  if (res.status === 429) {
    await new Promise(resolve => setTimeout(resolve, 1500))
    return getEffectiveCompletionDate(projectGid, asanaHeaders, signalNames)
  }

  const payload = await res.json()

  if (!res.ok) {
    throw new Error(payload?.errors?.[0]?.message || `Asana ${res.status}`)
  }

  const matchingDates = (payload.data || [])
    .filter(task => task?.completed && task?.completed_at)
    .filter(task => {
      const name = String(task.name || '').toLowerCase()
      return signalNames.some(signal => name.includes(signal))
    })
    .map(task => getDateValue(task.completed_at))
    .filter(Boolean)
    .sort((a, b) => b.getTime() - a.getTime())

  return matchingDates[0] || null
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length)
  let index = 0

  async function worker() {
    while (true) {
      const currentIndex = index
      index += 1
      if (currentIndex >= items.length) return
      results[currentIndex] = await mapper(items[currentIndex], currentIndex)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  )

  return results
}

function addDays(date, days) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1)
}

function getMonthKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function getMonthLabel(date) {
  return date.toLocaleString('en-US', { month: 'short', year: 'numeric' })
}

function getQuarterInfo(date) {
  const quarterNumber = Math.floor(date.getMonth() / 3) + 1
  const year = date.getFullYear()
  return {
    key: `${year}-Q${quarterNumber}`,
    label: `Q${quarterNumber} ${year}`,
    year,
    quarterNumber,
  }
}

function createHistoryStat() {
  return {
    completed: 0,
    buildDaysSum: 0,
    buildDaysCount: 0,
    onTimeCount: 0,
    onTimeDenominator: 0,
  }
}

function accumulateHistoryStat(stat, project) {
  const metrics = getCompletionMetrics(project)
  if (!metrics?.completedAt) return

  stat.completed += 1

  if (metrics.buildDays !== null) {
    stat.buildDaysSum += metrics.buildDays
    stat.buildDaysCount += 1
  }

  if (metrics.onTime !== null) {
    stat.onTimeDenominator += 1
    if (metrics.onTime) stat.onTimeCount += 1
  }
}

function finalizeHistoryStat(stat) {
  return {
    completed: stat.completed,
    avgBuildDays: stat.buildDaysCount
      ? Number((stat.buildDaysSum / stat.buildDaysCount).toFixed(1))
      : null,
    onTimePct: stat.onTimeDenominator
      ? Number(((stat.onTimeCount / stat.onTimeDenominator) * 100).toFixed(1))
      : null,
  }
}

function buildRangeStats(projects, rangeStart, rangeEnd) {
  const webStat = createHistoryStat()
  const seoStat = createHistoryStat()

  projects.forEach(project => {
    const completedAt = getEffectiveCompletedDate(project)
    if (!completedAt) return
    if (completedAt < rangeStart || completedAt >= rangeEnd) return

    const department = String(project.fieldMap.Department || '').toUpperCase()
    if (department === 'WEB') accumulateHistoryStat(webStat, project)
    if (department === 'SEO') accumulateHistoryStat(seoStat, project)
  })

  return {
    web: finalizeHistoryStat(webStat),
    seo: finalizeHistoryStat(seoStat),
  }
}

function deltaValue(current, previous) {
  if (current === null || previous === null) return null
  return Number((current - previous).toFixed(1))
}

function getHistory(allProjects, today) {
  const completedProjects = allProjects.filter(project => getEffectiveCompletedDate(project))

  const trailing30Start = addDays(today, -30)
  const previous30Start = addDays(today, -60)

  const trailing30 = buildRangeStats(completedProjects, trailing30Start, today)
  const previous30 = buildRangeStats(completedProjects, previous30Start, trailing30Start)

  const sixMonthStart = startOfMonth(addMonths(today, -5))
  const monthBuckets = new Map()
  for (let i = 0; i < 6; i += 1) {
    const monthDate = addMonths(sixMonthStart, i)
    monthBuckets.set(getMonthKey(monthDate), {
      month: getMonthKey(monthDate),
      label: getMonthLabel(monthDate),
      web: createHistoryStat(),
      seo: createHistoryStat(),
    })
  }

  const currentQuarter = getQuarterInfo(today)
  const quarterBuckets = new Map()
  for (let i = 3; i >= 0; i -= 1) {
    const quarterDate = new Date(currentQuarter.year, (currentQuarter.quarterNumber - 1) * 3, 1)
    quarterDate.setMonth(quarterDate.getMonth() - (i * 3))
    const quarterInfo = getQuarterInfo(quarterDate)
    quarterBuckets.set(quarterInfo.key, {
      quarter: quarterInfo.label,
      web: createHistoryStat(),
      seo: createHistoryStat(),
    })
  }

  completedProjects.forEach(project => {
    const completedAt = getEffectiveCompletedDate(project)
    if (!completedAt) return

    const department = String(project.fieldMap.Department || '').toUpperCase()
    const monthKey = getMonthKey(completedAt)
    const quarterKey = getQuarterInfo(completedAt).key

    if (monthBuckets.has(monthKey)) {
      const bucket = monthBuckets.get(monthKey)
      if (department === 'WEB') accumulateHistoryStat(bucket.web, project)
      if (department === 'SEO') accumulateHistoryStat(bucket.seo, project)
    }

    if (quarterBuckets.has(quarterKey)) {
      const bucket = quarterBuckets.get(quarterKey)
      if (department === 'WEB') accumulateHistoryStat(bucket.web, project)
      if (department === 'SEO') accumulateHistoryStat(bucket.seo, project)
    }
  })

  const monthlyHistory = Array.from(monthBuckets.values()).map(bucket => ({
    month: bucket.month,
    label: bucket.label,
    web: finalizeHistoryStat(bucket.web),
    seo: finalizeHistoryStat(bucket.seo),
  }))

  const quarterlyHistory = Array.from(quarterBuckets.values()).map(bucket => ({
    quarter: bucket.quarter,
    web: finalizeHistoryStat(bucket.web),
    seo: finalizeHistoryStat(bucket.seo),
  }))

  return {
    trailing30,
    trailing30vs30: {
      web: {
        completedDelta: trailing30.web.completed - previous30.web.completed,
        avgBuildDaysDelta: deltaValue(trailing30.web.avgBuildDays, previous30.web.avgBuildDays),
      },
      seo: {
        completedDelta: trailing30.seo.completed - previous30.seo.completed,
        avgBuildDaysDelta: deltaValue(trailing30.seo.avgBuildDays, previous30.seo.avgBuildDays),
      },
    },
    monthlyHistory,
    quarterlyHistory,
  }
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

    const historyProjects = [...webProjects, ...seoProjects]
    const asanaHeaders = getAsanaHeaders()

    await mapWithConcurrency(historyProjects, 5, async project => {
      const effectiveCompletionDate = await getEffectiveCompletionDate(
        project.gid,
        asanaHeaders,
        getCompletionSignalNames(project)
      )

      project.effectiveCompletionDate = effectiveCompletionDate?.toISOString() || null
      return project
    })

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

    const buildTimes = webProjects
      .filter(project => {
        const completedAt = getEffectiveCompletedDate(project)
        return completedAt && completedAt >= ninetyDaysAgo
      })
      .map(project => getCompletionMetrics(project)?.buildDays)
      .filter(value => value !== null)

    const avgBuildTimeDays = buildTimes.length
      ? Number((buildTimes.reduce((sum, days) => sum + days, 0) / buildTimes.length).toFixed(1))
      : 0

    const denominator = onTimeCount + lateCount
    const onTimePct = denominator ? Number(((onTimeCount / denominator) * 100).toFixed(1)) : 0

    const clientApprovalWaitTimes = clientApprovalProjects.map(project => {
      const startDate = getProjectStartDate(project)
      if (!startDate) return null
      return diffDays(startDate, today)
    }).filter(v => v !== null)

    const avgClientApprovalDays = clientApprovalWaitTimes.length
      ? Number((clientApprovalWaitTimes.reduce((s, d) => s + d, 0) / clientApprovalWaitTimes.length).toFixed(1))
      : 0

    const clientApprovalProjects_ = clientApprovalProjects.map(project => {
      const startDate = getProjectStartDate(project)
      const daysWaiting = startDate ? diffDays(startDate, today) : null
      return {
        name: project.name,
        daysWaiting,
        dueDate: getProjectDueDate(project)?.toISOString().split('T')[0] || null,
      }
    }).sort((a, b) => (b.daysWaiting || 0) - (a.daysWaiting || 0))

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

    const effectiveCompletionMatches = historyProjects
      .filter(project => project.effectiveCompletionDate)
      .map(project => ({
        name: project.name,
        department: String(project.fieldMap.Department || '').toUpperCase() || 'OTHER',
        effectiveCompletionDate: project.effectiveCompletionDate,
      }))

    console.log('[production-metrics] effective completion dates found', effectiveCompletionMatches)

    const history = getHistory(allProjects, today)

    return NextResponse.json({
      projectsInProduction,
      stageBreakdown,
      overdueCount,
      typeBreakdown,
      onTimeCount,
      lateCount,
      onTimePct,
      avgBuildTimeDays,
      avgClientApprovalDays,
      clientApprovalQueue: clientApprovalProjects_,
      seoInProduction,
      seoStageBreakdown,
      seoOverdueCount,
      blockedProjects,
      totalWebProjects: webProjects.length,
      completedWebProjectsLast90d: completedBuilds.length,
      history,
      trailing30: history.trailing30,
      trailing30vs30: history.trailing30vs30,
      monthlyHistory: history.monthlyHistory,
      quarterlyHistory: history.quarterlyHistory,
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
