import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { requireApiUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * Parse the text table output from `openclaw cron list`.
 * Columns (space-separated, variable width):
 *   ID  Name  Schedule  Next  Last  Status  Target  Agent ID  Model
 *
 * Strategy: split on 2+ spaces to handle column boundaries, then
 * map positionally — ID is always a UUID, so we anchor on that.
 */
function parseCronTable(raw, nodeName) {
  const lines = raw.split('\n').filter(Boolean)
  const jobs = []

  for (const line of lines) {
    // Skip header row
    if (line.startsWith('ID') || line.trim() === '') continue

    // Split on 2+ consecutive spaces
    const parts = line.trim().split(/\s{2,}/)
    if (parts.length < 6) continue

    const id = parts[0]?.trim()
    // Validate UUID-like ID
    if (!/^[0-9a-f-]{36}$/.test(id)) continue

    const name = parts[1]?.trim() || '—'

    // Schedule: strip "cron " prefix and " @ timezone..." suffix
    let schedule = parts[2]?.trim() || '—'
    schedule = schedule.replace(/^cron\s+/, '')
    schedule = schedule.replace(/\s+@\s+.*$/, '')
    schedule = schedule.replace(/\s+\(exact\)$/, '')

    // Extract timezone from schedule field if present
    let tz = 'America/Toronto'
    const tzMatch = parts[2]?.match(/@\s+([\w/]+)/)
    if (tzMatch) tz = tzMatch[1]

    const next = parts[3]?.trim() || '—'
    const last = parts[4]?.trim() || '—'
    const status = parts[5]?.trim()?.toLowerCase() || 'idle'
    // Target is parts[6], Agent ID is parts[7], Model is parts[8]
    const agentId = parts[7]?.trim() || (parts[6]?.trim() !== 'isolated' ? parts[6]?.trim() : '—') || '—'
    const model = parts[8]?.trim() === '-' || !parts[8] ? '—' : parts[8]?.trim()

    jobs.push({ id, name, schedule, tz, next, last, status, agentId, model, node: nodeName })
  }

  return jobs
}

/**
 * Sort jobs by next run time.
 * "in Xm" < "in Xh" < "in Xd" < "—"
 */
function sortByNext(jobs) {
  const score = (next) => {
    if (!next || next === '—') return Infinity
    const mMatch = next.match(/in\s+(\d+)m/)
    const hMatch = next.match(/in\s+(\d+)h/)
    const dMatch = next.match(/in\s+(\d+)d/)
    if (mMatch) return parseInt(mMatch[1])
    if (hMatch) return parseInt(hMatch[1]) * 60
    if (dMatch) return parseInt(dMatch[1]) * 1440
    return Infinity
  }
  return [...jobs].sort((a, b) => score(a.next) - score(b.next))
}

export async function GET() {
  const auth = await requireApiUser(['sales', 'ga', 'cx', 'recon', 'admin', 'superadmin'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  // ── Mac Mini (Wall·E) ─────────────────────────────────────────────────────
  let miniJobs = []
  try {
    const raw = execSync(
      'openclaw cron list 2>/dev/null',
      { encoding: 'utf8', timeout: 10000 }
    )
    miniJobs = parseCronTable(raw, 'Mac Mini')
  } catch (err) {
    console.error('[crons] Mac Mini error:', err.message)
  }

  // ── Eve (Mac Studio) ──────────────────────────────────────────────────────
  let eveJobs = []
  try {
    const raw = execSync(
      'ssh -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=5 toddlavictoire@10.0.0.19 "/opt/homebrew/opt/node@22/bin/node /opt/homebrew/lib/node_modules/openclaw/dist/index.js cron list" 2>/dev/null',
      { encoding: 'utf8', timeout: 15000 }
    )
    eveJobs = parseCronTable(raw, 'Mac Studio')
  } catch (err) {
    console.error('[crons] Eve error:', err.message)
  }

  const all = sortByNext([...miniJobs, ...eveJobs])

  const summary = {
    total: all.length,
    ok: all.filter((j) => j.status === 'ok').length,
    error: all.filter((j) => j.status === 'error').length,
    idle: all.filter((j) => j.status === 'idle').length,
  }

  return NextResponse.json({ mini: miniJobs, eve: eveJobs, all, summary })
}
