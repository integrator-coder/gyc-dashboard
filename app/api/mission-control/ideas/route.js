import { NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'

export const dynamic = 'force-dynamic'

const IDEAS_PATH = path.join(process.cwd(), 'data', 'ideas.json')

async function readIdeas() {
  try {
    const raw = await fs.readFile(IDEAS_PATH, 'utf8')
    return JSON.parse(raw)
  } catch {
    return []
  }
}

async function writeIdeas(ideas) {
  await fs.mkdir(path.dirname(IDEAS_PATH), { recursive: true })
  await fs.writeFile(IDEAS_PATH, JSON.stringify(ideas, null, 2), 'utf8')
}

export async function GET() {
  const ideas = await readIdeas()
  return NextResponse.json({ ideas })
}

export async function POST(req) {

  const body = await req.json()
  const { action, idea, id, field, value } = body

  const ideas = await readIdeas()

  if (action === 'add') {
    const newIdea = {
      id: `idea-${Date.now()}`,
      title: idea.title || 'Untitled',
      description: idea.description || '',
      category: idea.category || 'other',
      status: idea.status || 'backlog',
      priority: idea.priority || 'medium',
      votes: 0,
      addedBy: idea.addedBy || 'Todd',
      addedAt: new Date().toISOString(),
      tags: idea.tags || [],
      blockedBy: idea.blockedBy || null,
    }
    ideas.unshift(newIdea)
    await writeIdeas(ideas)
    return NextResponse.json({ ok: true, idea: newIdea })
  }

  if (action === 'vote') {
    const idx = ideas.findIndex((i) => i.id === id)
    if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    ideas[idx].votes = (ideas[idx].votes || 0) + 1
    await writeIdeas(ideas)
    return NextResponse.json({ ok: true, votes: ideas[idx].votes })
  }

  if (action === 'update_status') {
    const idx = ideas.findIndex((i) => i.id === id)
    if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    ideas[idx].status = value
    await writeIdeas(ideas)
    return NextResponse.json({ ok: true })
  }

  if (action === 'update_priority') {
    const idx = ideas.findIndex((i) => i.id === id)
    if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    ideas[idx].priority = value
    await writeIdeas(ideas)
    return NextResponse.json({ ok: true })
  }

  if (action === 'archive') {
    const idx = ideas.findIndex((i) => i.id === id)
    if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    ideas[idx].status = 'archived'
    await writeIdeas(ideas)
    return NextResponse.json({ ok: true })
  }

  if (action === 'delete') {
    const filtered = ideas.filter((i) => i.id !== id)
    await writeIdeas(filtered)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
