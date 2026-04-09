import { NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { requireApiUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const WORKSPACE = process.env.OPENCLAW_WORKSPACE || `${process.env.HOME || require('os').homedir()}/.openclaw/workspace`
const TASKBOARD_PATH = path.join(WORKSPACE, 'memory/mission-control-taskboard.json')
const TASK_UPDATES_PATH = path.join(WORKSPACE, 'memory/task-updates.md')

async function readTaskboard() {
  try {
    const raw = await fs.readFile(TASKBOARD_PATH, 'utf8')
    return JSON.parse(raw)
  } catch {
    return { columns: { backlog: [], inProgress: [], review: [], done: [] }, updatedAt: null }
  }
}

async function writeTaskboard(data) {
  data.updatedAt = new Date().toISOString()
  await fs.writeFile(TASKBOARD_PATH, JSON.stringify(data, null, 2), 'utf8')
}

async function appendTaskUpdate(message) {
  const timestamp = new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto' })
  const line = `\n- [${timestamp}] ${message}`
  try {
    await fs.appendFile(TASK_UPDATES_PATH, line, 'utf8')
  } catch {
    // If file doesn't exist, create it with a header
    await fs.writeFile(TASK_UPDATES_PATH, `# Task Updates\n${line}`, 'utf8')
  }
}

function generateId(columns) {
  const allIds = Object.values(columns).flat().map((t) => t.id || '')
  const nums = allIds.map((id) => parseInt(id.replace('mc-', ''), 10)).filter((n) => !isNaN(n))
  const max = nums.length ? Math.max(...nums) : 60
  return `mc-${max + 1}`
}

// PATCH /api/mission-control/tasks  — mark a task as done
export async function PATCH(req) {
  const auth = await requireApiUser(['sales', 'ga', 'cx', 'recon', 'admin', 'superadmin'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { taskId } = await req.json()
  if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 })

  const board = await readTaskboard()
  const cols = board.columns || {}

  // Find the task across all columns
  let found = null
  let fromCol = null
  for (const [col, items] of Object.entries(cols)) {
    const idx = (items || []).findIndex((t) => t.id === taskId)
    if (idx !== -1) {
      found = items[idx]
      fromCol = col
      cols[col] = items.filter((_, i) => i !== idx)
      break
    }
  }

  if (!found) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  if (fromCol === 'done') return NextResponse.json({ message: 'Already done', board }, { status: 200 })

  // Move to done
  if (!cols.done) cols.done = []
  cols.done.unshift({ ...found, nextSteps: [] })
  board.columns = cols

  await writeTaskboard(board)
  await appendTaskUpdate(`✅ Task marked complete: "${found.title}" (was: ${fromCol})`)

  return NextResponse.json({ message: 'Task marked done', board })
}

// POST /api/mission-control/tasks  — add a new task
export async function POST(req) {
  const auth = await requireApiUser(['sales', 'ga', 'cx', 'recon', 'admin', 'superadmin'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { title, description, status, priority } = await req.json()
  if (!title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 })

  const board = await readTaskboard()
  const cols = board.columns || {}

  // Map status label → column key
  const colMap = {
    'To Do': 'backlog',
    'In Progress': 'inProgress',
    'Blocked': 'backlog',
    backlog: 'backlog',
    inProgress: 'inProgress',
    review: 'review',
    done: 'done',
  }
  const colKey = colMap[status] || 'backlog'
  if (!cols[colKey]) cols[colKey] = []

  const newTask = {
    id: generateId(cols),
    title: title.trim(),
    description: description?.trim() || '',
    owner: 'Todd',
    priority: priority || 'medium',
    project: 'Manual',
    nextSteps: [],
    status: status || 'To Do',
    createdAt: new Date().toISOString(),
  }

  cols[colKey].unshift(newTask)
  board.columns = cols

  await writeTaskboard(board)
  await appendTaskUpdate(`📝 New task added: "${newTask.title}" — Status: ${status || 'To Do'}, Priority: ${priority || 'medium'}`)

  return NextResponse.json({ message: 'Task created', task: newTask, board })
}
