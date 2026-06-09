import { NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { requireApiUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const DATA_PATH = path.join(process.cwd(), 'data/presentation-library.json')

export async function GET() {
  const auth = await requireApiUser(['sales', 'ga', 'cx', 'recon', 'manager', 'admin', 'superadmin'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const raw = await fs.readFile(DATA_PATH, 'utf8')
    return NextResponse.json(JSON.parse(raw))
  } catch {
    return NextResponse.json({ presentations: [], resources: [], updatedAt: null })
  }
}
