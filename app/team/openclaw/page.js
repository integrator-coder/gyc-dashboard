import { requireUser } from '@/lib/auth'
import { promises as fs } from 'node:fs'
import path from 'node:path'

export const dynamic = 'force-dynamic'

const WORKSPACE = process.env.OPENCLAW_WORKSPACE || `${process.env.HOME || require('os').homedir()}/.openclaw/workspace`

async function readDoc(relativePath) {
  try {
    return await fs.readFile(path.join(WORKSPACE, relativePath), 'utf8')
  } catch {
    return `Missing: ${relativePath}`
  }
}

function DocCard({ title, content }) {
  return (
    <section className="rounded-2xl border border-[var(--brand-border)] bg-black/20 p-5">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <pre className="mt-3 whitespace-pre-wrap break-words rounded-xl border border-[var(--brand-border)] bg-black/30 p-4 text-sm leading-6 text-gray-200">
        {content}
      </pre>
    </section>
  )
}

export default async function OpenClawWikiPage() {
  await requireUser(['sales', 'ga', 'cx', 'recon', 'admin', 'superadmin'])

  const [overview, agents, workflows, rules, watchlist] = await Promise.all([
    readDoc('wiki/openclaw/overview.md'),
    readDoc('wiki/openclaw/agents-and-nodes.md'),
    readDoc('wiki/openclaw/workflows.md'),
    readDoc('wiki/openclaw/rules-of-use.md'),
    readDoc('wiki/openclaw/feature-watchlist.md'),
  ])

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <div className="rounded-[28px] border border-[var(--brand-border)] bg-[radial-gradient(circle_at_top,#12304a,transparent_38%),linear-gradient(180deg,rgba(14,18,28,0.98),rgba(10,10,10,1))] p-8 shadow-[0_0_60px_rgba(8,145,178,0.18)]">
        <div className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">OpenClaw Wiki</div>
        <h1 className="mt-2 text-3xl font-bold text-white">🧠 OpenClaw Operating System</h1>
        <p className="mt-2 text-sm text-gray-300">Architecture, workflows, rules of use, and feature-learning capture — all tied back to how GYC actually operates.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href="/team/mission-control" className="rounded-xl border border-[var(--brand-border)] px-4 py-2 text-sm font-medium text-gray-300 transition hover:border-cyan-400/40 hover:bg-cyan-400/10 hover:text-white">Mission Control</a>
          <a href="/team/m3-integration" className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/20">M3 Integration</a>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DocCard title="Overview" content={overview} />
        <DocCard title="Agents and Nodes" content={agents} />
        <DocCard title="Workflows" content={workflows} />
        <DocCard title="Rules of Use" content={rules} />
      </div>

      <DocCard title="Feature Watchlist" content={watchlist} />
    </div>
  )
}
