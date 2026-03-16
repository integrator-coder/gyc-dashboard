// scripts/sync-asana.js — pulls Asana data per-assignee and stores a snapshot in SQLite
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const PAT = process.env.ASANA_PAT
const WS = '931093392134374'
const BASE = 'https://app.asana.com/api/1.0'

async function aFetch(path) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${PAT}` } })
  if (res.status === 429) {
    // Rate limited — wait 2 seconds and retry once
    await sleep(2000)
    const retry = await fetch(url, { headers: { Authorization: `Bearer ${PAT}` } })
    if (!retry.ok) throw new Error(`Asana ${retry.status} (after retry): ${path}`)
    return retry.json()
  }
  if (!res.ok) throw new Error(`Asana ${res.status}: ${path}`)
  return res.json()
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function getToday() {
  return new Date().toISOString().split('T')[0]
}

function getDaysFromToday(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function getStartOfMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function getDaysAgo(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0]
}

async function getStaffUsers() {
  const d = await aFetch(`/workspaces/${WS}/users?opt_fields=gid,name,email`)
  return d.data.filter(u => u.email && u.email.endsWith('@growyourcenter.com'))
}

async function getOpenTasksForUser(userGid) {
  // Use assignee.any param — the correct Asana search filter
  const params = new URLSearchParams({
    'assignee.any': userGid,
    'completed': 'false',
    'limit': '100',
    'opt_fields': 'gid,due_on'
  })
  const d = await aFetch(`/workspaces/${WS}/tasks/search?${params}`)
  return d.data || []
}

async function getCompletedTasksForUser(userGid, since) {
  const params = new URLSearchParams({
    'assignee.any': userGid,
    'completed': 'true',
    'completed_on.after': since,
    'limit': '100',
    'opt_fields': 'gid'
  })
  const d = await aFetch(`/workspaces/${WS}/tasks/search?${params}`)
  return d.data || []
}

async function main() {
  console.log('🔄 Syncing Asana data...')

  const today = getToday()
  const sevenDaysOut = getDaysFromToday(7)
  const weekAgo = getDaysAgo(7)
  const monthStart = getStartOfMonth()

  // Get all GYC staff
  console.log('  Fetching GYC staff users...')
  const staff = await getStaffUsers()
  console.log(`  Found ${staff.length} staff members`)

  // Fetch tasks per assignee — sequential to avoid rate limits
  console.log('  Fetching tasks per assignee (sequential)...')
  const assigneeRows = []
  let completedThisMonth = 0

  for (const user of staff) {
    try {
      await sleep(300) // 300ms between users to stay under rate limit

      const [openTasks, completedWeek, completedMonth] = await Promise.all([
        getOpenTasksForUser(user.gid),
        getCompletedTasksForUser(user.gid, weekAgo),
        getCompletedTasksForUser(user.gid, monthStart),
      ])

      const overdue = openTasks.filter(t => t.due_on && t.due_on < today).length
      const dueSoon = openTasks.filter(t => t.due_on && t.due_on >= today && t.due_on <= sevenDaysOut).length
      const atCap = openTasks.length === 100

      assigneeRows.push({
        name: user.name,
        email: user.email,
        totalOpen: openTasks.length,
        overdue,
        dueSoon,
        atCap,
        completedThisWeek: completedWeek.length,
      })
      completedThisMonth += completedMonth.length

      const capFlag = atCap ? '+' : ''
      console.log(`  ✓ ${user.name}: open=${openTasks.length}${capFlag} overdue=${overdue} dueSoon=${dueSoon} doneWeek=${completedWeek.length}`)
    } catch (err) {
      console.warn(`  ⚠ Skipping ${user.name}: ${err.message}`)
    }
  }

  // Aggregate totals
  const totalOpen = assigneeRows.reduce((s, r) => s + r.totalOpen, 0)
  const totalOverdue = assigneeRows.reduce((s, r) => s + r.overdue, 0)
  const dueSoon = assigneeRows.reduce((s, r) => s + r.dueSoon, 0)

  // completedThisWeek — re-fetch separately to avoid stale parallel results
  let completedThisWeek = 0
  for (const user of staff) {
    try {
      await sleep(300)
      const tasks = await getCompletedTasksForUser(user.gid, weekAgo)
      completedThisWeek += tasks.length
    } catch { /* skip */ }
  }

  console.log(`\n  Summary: open=${totalOpen} overdue=${totalOverdue} dueSoon=${dueSoon} doneWeek=${completedThisWeek} doneMonth=${completedThisMonth}`)

  // Write to DB
  console.log('  Writing to database...')
  const snapshot = await prisma.asanaSnapshot.create({
    data: {
      totalOpen,
      totalOverdue,
      dueSoon,
      completedThisWeek,
      completedThisMonth,
      assignees: {
        create: assigneeRows.map(({ atCap, ...r }) => r)  // atCap is a runtime flag, not stored
      }
    }
  })

  await prisma.syncLog.create({
    data: {
      source: 'asana',
      status: 'success',
      message: `Snapshot ID ${snapshot.id}, ${staff.length} staff, open=${totalOpen} overdue=${totalOverdue}`
    }
  })

  const atCapUsers = assigneeRows.filter(r => r.atCap).map(r => r.name)
  if (atCapUsers.length > 0) {
    console.log(`\n  ⚠ At 100-task cap (may have more): ${atCapUsers.join(', ')}`)
  }

  console.log(`\n✅ Done! Snapshot ID: ${snapshot.id}`)
}

main()
  .catch(async (e) => {
    console.error('❌ Sync failed:', e.message)
    await prisma.syncLog.create({
      data: { source: 'asana', status: 'error', message: e.message }
    }).catch(() => {})
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
