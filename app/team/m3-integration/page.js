import { requireUser } from '@/lib/auth'
import Link from 'next/link'
import fs from 'node:fs/promises'
import path from 'node:path'
import M3IntegrationBoard from '@/components/M3IntegrationBoard'

export const dynamic = 'force-dynamic'

const WORKSPACE = process.env.OPENCLAW_WORKSPACE || '/Users/toddthejedigmail.com/.openclaw/workspace'
const REPORT_PATH = path.join(WORKSPACE, 'reports/m3-alignment-outline-2026-04-24.md')

async function readReport() {
  try {
    return await fs.readFile(REPORT_PATH, 'utf8')
  } catch {
    return null
  }
}

export default async function M3IntegrationPage() {
  await requireUser(['sales', 'ga', 'cx', 'recon', 'admin', 'superadmin', 'manager'])
  const report = await readReport()

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1a1030_0%,#09090c_42%,#040405_100%)] px-6 py-8 text-white">
      <div className="mx-auto mb-6 flex max-w-[1550px] justify-end">
        <Link
          href="/team/mission-control"
          className="rounded-xl border border-violet-500/40 bg-violet-500/15 px-4 py-2 text-sm font-medium text-violet-100 transition hover:bg-violet-500/25"
        >
          ← Back to Mission Control
        </Link>
      </div>
      <div className="mx-auto max-w-[1550px]">
        <M3IntegrationBoard report={report} />
      </div>
    </div>
  )
}
