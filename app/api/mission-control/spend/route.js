import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/auth'
import { promises as fs } from 'node:fs'
import path from 'node:path'

export const dynamic = 'force-dynamic'

const HOME_DIR = process.env.HOME || require('os').homedir()

async function getSecret(name) {
  try {
    // Try ~/.openclaw/secrets.json first
    const secretsPath = path.join(HOME_DIR, '.openclaw', 'secrets.json')
    const raw = await fs.readFile(secretsPath, 'utf8')
    const secrets = JSON.parse(raw)
    return secrets[name] || null
  } catch {
    return null
  }
}

// Fixed monthly subscriptions (hardcoded for now - Todd can update these as needed)
const FIXED_SUBSCRIPTIONS = [
  { service: 'GHL', category: 'CRM', amount: 497.00 },
  { service: 'Zendesk', category: 'Support', amount: 300.00 },
  { service: 'Notion', category: 'Productivity', amount: 50.00 },
  { service: 'PandaDoc', category: 'Sales', amount: 50.00 },
  { service: 'Asana', category: 'Productivity', amount: 25.00 },
  { service: 'Zoom', category: 'Communication', amount: 50.00 },
  { service: 'DataForSEO', category: 'Data', amount: 0.00 }, // Variable - placeholder
]

async function fetchAnthropicSpend(apiKey) {
  if (!apiKey) {
    console.log('[Spend] Anthropic: no API key')
    return null
  }
  
  try {
    console.log('[Spend] Fetching Anthropic spend...')
    const now = new Date()
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0))
    
    const params = new URLSearchParams({
      starting_at: monthStart.toISOString().replace('.000', ''),
      ending_at: now.toISOString().replace('.000', ''),
      bucket_width: '1d',
    })

    // Fetch with pagination support
    const allBuckets = []
    let page = null
    let hasMore = true

    while (hasMore) {
      const pageParams = new URLSearchParams(params)
      if (page) pageParams.set('page', page)

      const res = await fetch(`https://api.anthropic.com/v1/organizations/cost_report?${pageParams.toString()}`, {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        cache: 'no-store',
      })

      if (!res.ok) {
        console.error(`[Spend] Anthropic API error: ${res.status}`)
        return null
      }
      
      const data = await res.json()
      allBuckets.push(...(data.data || []))
      hasMore = Boolean(data.has_more)
      page = data.next_page || null
    }

    // Sum up all costs (values are in cents, convert to dollars)
    const rawTotal = allBuckets.reduce((sum, bucket) => {
      const bucketTotal = (bucket.results || []).reduce((s, r) => s + Number(r.amount || 0), 0)
      return sum + bucketTotal
    }, 0)
    
    const totalCost = rawTotal * 0.01 // Convert cents to dollars
    console.log(`[Spend] Anthropic: $${totalCost.toFixed(2)}`)
    return totalCost
  } catch (err) {
    console.error('[Spend] Anthropic API error:', err.message)
    return null
  }
}

async function fetchOpenAISpend(apiKey) {
  if (!apiKey) return null
  
  try {
    // OpenAI billing endpoint - this may need adjustment based on actual API
    // Using usage endpoint as a fallback
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    
    const startDate = monthStart.toISOString().split('T')[0]
    const endDate = now.toISOString().split('T')[0]
    
    // Note: OpenAI's billing API may require different authentication or endpoint
    // This is a placeholder - may need to use dashboard scraping or different approach
    const res = await fetch(`https://api.openai.com/v1/usage?start_date=${startDate}&end_date=${endDate}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      cache: 'no-store',
    })

    if (!res.ok) return null
    
    const data = await res.json()
    // Extract cost from usage data - structure may vary
    const totalCost = data.total_usage || 0
    
    return totalCost / 100 // Convert cents to dollars if needed
  } catch (err) {
    console.error('OpenAI API error:', err)
    return null
  }
}

async function fetchRenderSpend(apiKey) {
  if (!apiKey) {
    console.log('[Spend] Render: no API key')
    return null
  }
  
  try {
    console.log('[Spend] Fetching Render spend...')
    // Get current month's invoices
    const res = await fetch('https://api.render.com/v1/invoices', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
      cache: 'no-store',
    })

    if (!res.ok) return null
    
    const invoices = await res.json()
    
    // Find current month invoice
    const now = new Date()
    const currentMonthInvoice = invoices.find(invoice => {
      const invoiceDate = new Date(invoice.createdAt)
      return invoiceDate.getMonth() === now.getMonth() && 
             invoiceDate.getFullYear() === now.getFullYear()
    })
    
    const amount = currentMonthInvoice?.total || 0
    console.log(`[Spend] Render: $${amount}`)
    return amount
  } catch (err) {
    console.error('[Spend] Render API error:', err.message)
    return null
  }
}

async function fetchGCPSpend() {
  // GCP billing requires Cloud Billing API access
  // This is complex and may require service account with billing permissions
  // Placeholder for now
  return null
}

export async function GET(request) {
  try {
    await requireApiUser(['sales', 'ga', 'cx', 'recon', 'admin', 'superadmin'])
    
    const now = new Date()
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    
    // Read secrets from env and secrets.json
    const anthropicKey = process.env.ANTHROPIC_BILLING_API_KEY
    const openaiKey = process.env.OPENAI_API_KEY
    const renderKey = await getSecret('RENDER_API_KEY') || process.env.RENDER_API_KEY
    
    // Fetch all live data in parallel
    const [anthropicSpend, openaiSpend, renderSpend, gcpSpend] = await Promise.all([
      fetchAnthropicSpend(anthropicKey),
      fetchOpenAISpend(openaiKey),
      fetchRenderSpend(renderKey),
      fetchGCPSpend(),
    ])
    
    // Build breakdown
    const breakdown = []
    
    // Add live API services
    if (anthropicSpend !== null) {
      breakdown.push({
        service: 'Anthropic',
        category: 'AI',
        amount: anthropicSpend,
        source: 'live',
      })
    }
    
    if (openaiSpend !== null) {
      breakdown.push({
        service: 'OpenAI',
        category: 'AI',
        amount: openaiSpend,
        source: 'live',
      })
    }
    
    if (renderSpend !== null) {
      breakdown.push({
        service: 'Render',
        category: 'Infrastructure',
        amount: renderSpend,
        source: 'live',
      })
    }
    
    if (gcpSpend !== null) {
      breakdown.push({
        service: 'Google Cloud',
        category: 'Infrastructure',
        amount: gcpSpend,
        source: 'live',
      })
    }
    
    // Add fixed subscriptions
    FIXED_SUBSCRIPTIONS.forEach(sub => {
      breakdown.push({
        ...sub,
        source: 'fixed',
      })
    })
    
    // Calculate totals
    const totalMonthly = breakdown.reduce((sum, item) => sum + item.amount, 0)
    
    // Group by category
    const byCategory = breakdown.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + item.amount
      return acc
    }, {})
    
    return NextResponse.json({
      totalMonthly,
      month,
      breakdown,
      byCategory,
      lastUpdated: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Mission Control Spend API error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
