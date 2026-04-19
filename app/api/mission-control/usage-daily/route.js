import { NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { requireApiUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const WORKSPACE = process.env.OPENCLAW_WORKSPACE || `${process.env.HOME || require('os').homedir()}/.openclaw/workspace`

// Anthropic claude-sonnet-4-6 pricing (per 1M tokens, in USD)
// Used to back-calculate estimated token counts from cost
const PRICE_INPUT_PER_M   = 3.00   // $3.00 / 1M input tokens
const PRICE_OUTPUT_PER_M  = 15.00  // $15.00 / 1M output tokens
const PRICE_CACHE_PER_M   = 0.30   // $0.30 / 1M cache-read tokens
// Assumed cost distribution (percentages of total cost): must sum to 1.0
const FRAC_INPUT_COST  = 0.35
const FRAC_OUTPUT_COST = 0.55
const FRAC_CACHE_COST  = 0.10

async function getSecret(name) {
  try {
    const raw = await fs.readFile(path.join(WORKSPACE, '.secrets'), 'utf8')
    const line = raw.split('\n').find((l) => l.startsWith(`${name}=`))
    if (!line) return null
    return line.split('=', 2)[1]?.trim() || null
  } catch {
    return null
  }
}

/**
 * Fetch last N days of daily cost buckets from the Anthropic cost_report API.
 * Returns an array of { date, amountUsd } sorted by date ascending.
 */
async function fetchDailyCost(apiKey, days = 30) {
  if (!apiKey) return { ok: false, error: 'ANTHROPIC_BILLING_API_KEY missing', data: [] }

  const now = new Date()
  // Go back `days` full days; include today as a partial bucket
  const startMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - (days - 1) * 86400_000
  const startDate = new Date(startMs)
  const startIso = startDate.toISOString().replace('.000', '')
  const endIso = now.toISOString().replace('.000', '')

  const allBuckets = []
  let page = null
  let hasMore = true
  let iterations = 0

  while (hasMore && iterations < 10) {
    iterations++
    const params = new URLSearchParams({
      starting_at: startIso,
      ending_at: endIso,
      bucket_width: '1d',
    })
    if (page) params.set('page', page)

    const res = await fetch(`https://api.anthropic.com/v1/organizations/cost_report?${params}`, {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      const text = await res.text()
      return { ok: false, error: `Anthropic API ${res.status}`, details: text.slice(0, 240), data: [] }
    }

    const json = await res.json()
    allBuckets.push(...(json.data || []))
    hasMore = Boolean(json.has_more)
    page = json.next_page || null
  }

  // The API returns costs in CENTS — divide by 100 to get dollars
  const UNIT_SCALE = 0.01

  const daily = allBuckets
    .map((bucket) => {
      const rawTotal = (bucket.results || []).reduce((sum, r) => sum + Number(r.amount || 0), 0)
      const amountUsd = rawTotal * UNIT_SCALE
      // Estimate token breakdown from cost fractions + per-token pricing
      const inputCost   = amountUsd * FRAC_INPUT_COST
      const outputCost  = amountUsd * FRAC_OUTPUT_COST
      const cacheCost   = amountUsd * FRAC_CACHE_COST
      const inputTokens  = Math.round((inputCost  / PRICE_INPUT_PER_M)  * 1_000_000)
      const outputTokens = Math.round((outputCost / PRICE_OUTPUT_PER_M) * 1_000_000)
      const cacheTokens  = Math.round((cacheCost  / PRICE_CACHE_PER_M)  * 1_000_000)
      const totalTokens  = inputTokens + outputTokens + cacheTokens
      return {
        date:          bucket.starting_at.slice(0, 10), // YYYY-MM-DD
        estimatedCost: Number(amountUsd.toFixed(4)),
        inputTokens,
        outputTokens,
        cacheTokens,
        totalTokens,
      }
    })
    .sort((a, b) => a.date.localeCompare(b.date))

  return { ok: true, data: daily }
}

export async function GET() {
  const auth = await requireApiUser(['sales', 'ga', 'cx', 'recon', 'admin', 'superadmin'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const apiKey = await getSecret('ANTHROPIC_BILLING_API_KEY')
  const result = await fetchDailyCost(apiKey, 30)

  if (!result.ok) {
    return NextResponse.json({ error: result.error, details: result.details, data: [] }, { status: 200 })
  }

  return NextResponse.json({
    data: result.data,
    note: 'Token counts are estimated from daily cost using Claude Sonnet pricing ratios. Actual token breakdown not available via billing API.',
    generatedAt: new Date().toISOString(),
  })
}
