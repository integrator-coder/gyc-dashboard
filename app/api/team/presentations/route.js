import { NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { requireApiUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const WORKSPACE = process.env.OPENCLAW_WORKSPACE ||
  `${process.env.HOME || require('os').homedir()}/.openclaw/workspace`
const DATA_PATH = path.join(WORKSPACE, 'memory/presentation-library.json')

export async function GET() {
  const auth = await requireApiUser(['sales', 'ga', 'cx', 'recon', 'admin', 'superadmin'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const raw = await fs.readFile(DATA_PATH, 'utf8')
    return NextResponse.json(JSON.parse(raw))
  } catch {
    return NextResponse.json({ presentations: [], resources: [], updatedAt: null })
  }
}
