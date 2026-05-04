import { NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { requireApiUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const WORKSPACE = process.env.OPENCLAW_WORKSPACE || `${process.env.HOME || require('os').homedir()}/.openclaw/workspace`
const DATA_PATH = path.join(WORKSPACE, 'memory/toolkit-board.json')

const DEFAULT_DATA = {
  updatedAt: null,
  tools: [
    {
      id: 'tool-1',
      name: 'Pencil.dev',
      category: 'design',
      status: 'pilot',
      source: 'M3 alignment meeting / Hakeem demo',
      summary: 'Repo-aware design environment for AI-assisted UI mockups with multi-agent refinement.',
      howItWorks: 'Point Pencil at the real code root, optionally include Figma/context docs, generate and refine UI concepts, then export mockups or code for build handoff.',
      workflowIdeas: [
        'Use before major dashboard or client-card redesigns',
        'Use for M3-aligned UI concepting before code commits',
        'Use multi-agent refinement to catch spacing/alignment issues before build'
      ],
      projectIdeas: [
        'Team Portal refinement',
        'M3 client-safe overview module',
        'Website production template system'
      ],
      unlocks: [
        'Faster UI iteration',
        'Closer design alignment with M3 speed',
        'Reduced hallucinated mockups'
      ],
      linkedIdeas: ['M3 Integration Project', 'Team Portal polish'],
      linkedTasks: ['Pilot Pencil on one M3-facing module or dashboard polish task'],
      notes: 'Best used as a design acceleration layer, not a replacement for actual build work.',
      researchStatus: 'needs_fulcrum_playbook'
    },
    {
      id: 'tool-2',
      name: 'Claude photo / image workflow tool',
      category: 'creative',
      status: 'research',
      source: 'Courtney-presented Claude photo workflow referenced by Todd',
      summary: 'Claude-adjacent or Claude-driven image assistance workflow that may help with photo prep, selection, or creative asset handling.',
      howItWorks: 'Needs concrete Fulcrum research to document the actual steps, supported outputs, strengths, and limits.',
      workflowIdeas: [
        'Use to speed up creative review and image iteration workflows',
        'Potentially support ad creative exploration or asset cleanup',
        'Could become part of Casey/Courtney creative ops pipeline'
      ],
      projectIdeas: [
        'AI-assisted image workflows for ads',
        'Client creative concept boards',
        'Photo prep for website or campaign assets'
      ],
      unlocks: [
        'Potential faster creative iteration',
        'Potential support for visual production workflows'
      ],
      linkedIdeas: ['Creative ops acceleration'],
      linkedTasks: [],
      notes: 'Current entry is intentionally provisional until Fulcrum documents the exact tool and workflow.',
      researchStatus: 'needs_fulcrum_playbook'
    },
    {
      id: 'tool-3',
      name: 'OpenClaw video_generate',
      category: 'media',
      status: 'available',
      source: 'Local OpenClaw capability review + April 6 memo',
      summary: 'Built-in video generation tool for AI-assisted content creation and prototype creative production.',
      howItWorks: 'Use the native video_generate tool with prompt + optional image/video references to generate short clips.',
      workflowIdeas: [
        'Prototype ad concepts before full production',
        'Generate storyboard-style motion drafts',
        'Create rough creative concepts for review with Zac/Bruce'
      ],
      projectIdeas: [
        'Childcare ad concept exploration',
        'Mission Control explainer visuals',
        'Creative testing backlog'
      ],
      unlocks: [
        'Rapid content prototyping',
        'Faster concept exploration without external tooling'
      ],
      linkedIdeas: ['Creative testing backlog'],
      linkedTasks: [],
      notes: 'Already available in-tool; more useful when tied to clear briefs and QA loops.',
      researchStatus: 'usable_now'
    }
  ]
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

function generateId(tools = []) {
  const nums = tools.map((t) => parseInt(String(t.id || '').replace('tool-', ''), 10)).filter((n) => !Number.isNaN(n))
  const max = nums.length ? Math.max(...nums) : 0
  return `tool-${max + 1}`
}

export async function GET() {
  const auth = await requireApiUser(['sales', 'ga', 'cx', 'recon', 'admin', 'superadmin'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  return NextResponse.json(await readData())
}

export async function POST(req) {
  const auth = await requireApiUser(['sales', 'ga', 'cx', 'recon', 'admin', 'superadmin'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json()
  const action = body?.action || 'add'
  const data = await readData()

  if (action === 'add') {
    const { tool } = body
    if (!tool?.name?.trim()) return NextResponse.json({ error: 'tool.name required' }, { status: 400 })
    const newTool = {
      id: generateId(data.tools || []),
      category: 'other',
      status: 'research',
      source: 'manual',
      summary: '',
      howItWorks: '',
      workflowIdeas: [],
      projectIdeas: [],
      unlocks: [],
      linkedIdeas: [],
      linkedTasks: [],
      notes: '',
      researchStatus: 'needs_fulcrum_playbook',
      ...tool,
      name: tool.name.trim(),
    }
    data.tools = [newTool, ...(data.tools || [])]
    await writeData(data)
    return NextResponse.json({ ok: true, tool: newTool, data })
  }

  if (action === 'update') {
    const { toolId, patch } = body
    if (!toolId) return NextResponse.json({ error: 'toolId required' }, { status: 400 })
    data.tools = (data.tools || []).map((tool) => tool.id === toolId ? { ...tool, ...(patch || {}) } : tool)
    await writeData(data)
    return NextResponse.json({ ok: true, data })
  }

  return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
}
