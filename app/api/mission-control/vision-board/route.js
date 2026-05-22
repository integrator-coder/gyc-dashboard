import { NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { requireApiUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const WORKSPACE = process.env.OPENCLAW_WORKSPACE || `${process.env.HOME}/.openclaw/workspace`
const PATH = path.join(WORKSPACE, 'memory/vision-board.json')

export async function GET(req) {
  const auth = await requireApiUser(['superadmin'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const raw = await fs.readFile(PATH, 'utf8')
    return NextResponse.json(JSON.parse(raw))
  } catch {
    return NextResponse.json({ sections: {} })
  }
}
