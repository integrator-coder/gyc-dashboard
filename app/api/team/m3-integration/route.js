import { NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { requireApiUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const WORKSPACE = process.env.OPENCLAW_WORKSPACE || `${process.env.HOME || require('os').homedir()}/.openclaw/workspace`
const DATA_PATH = path.join(WORKSPACE, 'memory/m3-integration-board.json')

const DEFAULT_DATA = {
  updatedAt: null,
  tasks: [
    { id: 'm3-1', title: 'Build overlap audit from M3 docs and GYC dashboard inventory', done: false, lane: 'mission', priority: 'high' },
    { id: 'm3-2', title: 'Label each dashboard/module surface as internal-only or client-facing', done: false, lane: 'mission', priority: 'high' },
    { id: 'm3-3', title: 'Define stable vs placeholder vs broken surfaces before deeper M3 handoff', done: false, lane: 'mission', priority: 'medium' },
    { id: 'm3-4', title: 'Stand up recurring short alignment meeting with Todd, Zac, Hakeem, and Kaci', done: false, lane: 'ops', priority: 'high' },
    { id: 'm3-5', title: 'Pilot Pencil on one M3-facing module or dashboard polish task', done: false, lane: 'design', priority: 'medium' },
    { id: 'm3-6', title: 'Turn current dashboard work into explicit modules/use cases', done: false, lane: 'mission', priority: 'high' }
  ],
  audit: {}
}

async function readData() {
  try {
    const raw = await fs.readFile(DATA_PATH, 'utf8')
    return JSON.parse(raw)
  } catch {
    return DEFAULT_DATA
  }
}

async function writeData(data) {
  data.updatedAt = new Date().toISOString()
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true })
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), 'utf8')
}

function generateId(tasks = []) {
  const nums = tasks
    .map((t) => parseInt(String(t.id || '').replace('m3-', ''), 10))
    .filter((n) => !Number.isNaN(n))
  const max = nums.length ? Math.max(...nums) : 0
  return `m3-${max + 1}`
}

export async function GET() {
  const auth = await requireApiUser(['sales', 'ga', 'cx', 'recon', 'admin', 'superadmin'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const data = await readData()
  return NextResponse.json(data)
}

export async function POST(req) {
  const auth = await requireApiUser(['sales', 'ga', 'cx', 'recon', 'admin', 'superadmin'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json()
  const action = body?.action || 'add'
  const data = await readData()

  if (action === 'toggle') {
    const { taskId, done } = body
    if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 })
    data.tasks = (data.tasks || []).map((task) => task.id === taskId ? { ...task, done: !!done } : task)
    await writeData(data)
    return NextResponse.json({ ok: true, data })
  }

  if (action === 'add') {
    const { title, lane = 'mission', priority = 'medium' } = body
    if (!title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 })

    const task = {
      id: generateId(data.tasks || []),
      title: title.trim(),
      done: false,
      lane,
      priority,
    }

    data.tasks = [task, ...(data.tasks || [])]
    await writeData(data)
    return NextResponse.json({ ok: true, task, data })
  }

  if (action === 'updateAudit') {
    const { featureKey, patch } = body
    if (!featureKey) return NextResponse.json({ error: 'featureKey required' }, { status: 400 })
    data.audit = data.audit || {}
    data.audit[featureKey] = {
      ...(data.audit[featureKey] || {}),
      ...(patch || {}),
      lastReviewedAt: new Date().toISOString(),
    }
    await writeData(data)
    return NextResponse.json({ ok: true, data })
  }

  return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
}
