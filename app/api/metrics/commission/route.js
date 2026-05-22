
import { NextResponse } from 'next/server'

const GHL_BASE = 'https://services.leadconnectorhq.com'

const GHL_USER_IDS = {
  'Jesse':     'veHn1vMej8ag3oRNSMF7',
  'Briana':    'Ipb94f9KRyRNdYIJg9qj',
  'Pia':       'jhz6BcMXfwsEBVCnQ3vE',
  'Sebastian': 'aLNgIwcEWCJdhNm5JnIe',
  'Stefen':    'fx0YBhilsXDaK4O3ng5R',
  'JC':        'hlGC7GYOch0y2ErjmJF1',
  'Zu':        'UUMCvAlAtwakqEkse8Rl',
}

// Commission tier tables: each tier is { min, rate } — max is inferred by next tier's min
const TIERS = {
  website: [
    { min: 1,  rate: 0.06  },
    { min: 10, rate: 0.065 },
    { min: 15, rate: 0.075 },
    { min: 20, rate: 0.085 },
    { min: 25, rate: 0.095 },
  ],
  blueprint: [
    { min: 1,  rate: 0.04  },
    { min: 10, rate: 0.045 },
    { min: 15, rate: 0.055 },
    { min: 20, rate: 0.065 },
  ],
  seoCore: [
    { min: 1,  rate: 0.04  },
    { min: 10, rate: 0.045 },
    { min: 15, rate: 0.055 },
    { min: 20, rate: 0.065 },
  ],
  seoAdvanced: [
    { min: 1, rate: 0.04 },
    { min: 5, rate: 0.05 },
    { min: 10, rate: 0.07 },
  ],
}

function getTierInfo(count, tiers, totalValue) {
  if (count === 0) {
    return {
      tier: 0,
      rate: 0,
      nextTier: 1,
      dealsToNext: tiers[0].min,
      nextRate: tiers[0].rate,
      retroactiveGain: 0,
    }
  }

  // Find which tier the count falls into (search from highest to lowest)
  let currentTierIdx = -1
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (count >= tiers[i].min) {
      currentTierIdx = i
      break
    }
  }

  if (currentTierIdx === -1) {
    // Shouldn't happen, but handle gracefully
    return { tier: 0, rate: 0, nextTier: 1, dealsToNext: tiers[0].min - count, nextRate: tiers[0].rate, retroactiveGain: 0 }
  }

  const currentRate = tiers[currentTierIdx].rate
  const isMaxTier = currentTierIdx === tiers.length - 1

  if (isMaxTier) {
    return {
      tier: currentTierIdx + 1,
      rate: currentRate,
      nextTier: null,
      dealsToNext: null,
      nextRate: null,
      retroactiveGain: 0,
    }
  }

  const nextTierData = tiers[currentTierIdx + 1]
  const nextRate = nextTierData.rate
  const dealsToNext = nextTierData.min - count

  // Retroactive gain: if they hit next tier, ALL deals this month earn the higher rate
  // retroactiveGain = totalProductValueThisMonth * (nextRate - currentRate)
  const retroactiveGain = totalValue * (nextRate - currentRate)

  return {
    tier: currentTierIdx + 1,
    rate: currentRate,
    nextTier: currentTierIdx + 2,
    dealsToNext,
    nextRate,
    retroactiveGain,
  }
}

/**
 * Parse product types from a GHL deal name.
 * Format: "Client Name | Product, Product2"
 * Returns an array of product keys: 'website', 'blueprint', 'seoCore', 'seoAdvanced'
 */
function parseProducts(dealName) {
  if (!dealName) return []
  const products = []

  // Check for Website
  if (dealName.includes('Website')) products.push('website')

  // Check for Blueprint
  if (dealName.includes('Blueprint')) products.push('blueprint')

  // Check for SEO subtypes — must check specific before generic
  if (dealName.includes('SEO Core')) {
    products.push('seoCore')
  } else if (dealName.includes('SEO Advanced')) {
    products.push('seoAdvanced')
  } else if (dealName.includes('SEO')) {
    // Plain "SEO" with no modifier = SEO Advanced
    products.push('seoAdvanced')
  }

  return products
}

async function fetchAllWonDeals() {
  const headers = {
    'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
    'Version': '2021-07-28',
  }

  const allDeals = []
  let cursor = null
  const seen = new Set()

  do {
    const params = new URLSearchParams({
      location_id: process.env.GHL_LOCATION_ID,
      status: 'won',
      limit: '100',
      ...(cursor ? { startAfter: cursor } : {}),
    })

    const res = await fetch(`${GHL_BASE}/opportunities/search?${params}`, { headers })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`GHL API error ${res.status}: ${text}`)
    }

    const data = await res.json()
    const opps = data.opportunities || []
    if (!opps.length) break

    let newCount = 0
    for (const opp of opps) {
      if (!seen.has(opp.id)) {
        seen.add(opp.id)
        allDeals.push(opp)
        newCount++
      }
    }
    if (newCount === 0) break

    cursor = data.meta?.nextPageUrl ? opps[opps.length - 1]?.id : null
  } while (cursor)

  return allDeals
}

export async function GET() {
  try {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

    // New commission structure begins March 2026
    const COMMISSION_START_DATE = new Date('2026-03-01T00:00:00-05:00')

    // If requested before commission start month, return empty with a note
    if (monthStart < COMMISSION_START_DATE) {
      const currentMonthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      const emptyRep = {
        website: { count: 0, totalValue: 0, ...getTierInfo(0, TIERS.website, 0) },
        blueprint: { count: 0, totalValue: 0, ...getTierInfo(0, TIERS.blueprint, 0) },
        seoCore: { count: 0, totalValue: 0, ...getTierInfo(0, TIERS.seoCore, 0) },
        seoAdvanced: { count: 0, totalValue: 0, ...getTierInfo(0, TIERS.seoAdvanced, 0) },
      }
      const reps = Object.fromEntries(Object.keys(GHL_USER_IDS).map(rep => [rep, emptyRep]))

      return NextResponse.json({
        reps,
        currentMonth: currentMonthLabel,
        totalDealsThisMonth: 0,
        note: 'New commission structure starts March 2026',
        updatedAt: new Date().toISOString(),
      })
    }

    const allDeals = await fetchAllWonDeals()

    // Filter to this month only: BOTH createdAt AND lastStatusChangeAt must be in current month
    // and only count deals from commission start date onward.
    const thisMonthDeals = allDeals.filter(deal => {
      const created = new Date(deal.createdAt)
      const won = new Date(deal.lastStatusChangeAt)
      return created >= COMMISSION_START_DATE && won >= COMMISSION_START_DATE &&
             created >= monthStart && created <= monthEnd &&
             won >= monthStart && won <= monthEnd
    })

    // Initialize rep data structure
    const repData = {}
    for (const repName of Object.keys(GHL_USER_IDS)) {
      repData[repName] = {
        website:     { count: 0, totalValue: 0 },
        blueprint:   { count: 0, totalValue: 0 },
        seoCore:     { count: 0, totalValue: 0 },
        seoAdvanced: { count: 0, totalValue: 0 },
      }
    }

    // Tally deals by rep and product type
    for (const deal of thisMonthDeals) {
      // Find which rep this belongs to
      const repName = Object.entries(GHL_USER_IDS).find(([, id]) => id === deal.assignedTo)?.[0]
      if (!repName) continue

      const products = parseProducts(deal.name)
      const dealValue = deal.monetaryValue || 0

      for (const product of products) {
        repData[repName][product].count++
        // For multi-product deals, split value equally (approximation)
        repData[repName][product].totalValue += products.length > 1 ? dealValue / products.length : dealValue
      }
    }

    // Calculate TEAM totals per product (tiers are cumulative by team, not per rep)
    const SALES_REPS = ['Jesse']  // Jesse is the only active sales rep with targets. Briana: now GA. Pia: starting, no targets yet.
    const teamTotals = {
      website:     { count: 0, totalValue: 0 },
      blueprint:   { count: 0, totalValue: 0 },
      seoCore:     { count: 0, totalValue: 0 },
      seoAdvanced: { count: 0, totalValue: 0 },
    }
    for (const repName of SALES_REPS) {
      for (const productKey of Object.keys(teamTotals)) {
        teamTotals[productKey].count      += repData[repName]?.[productKey]?.count      || 0
        teamTotals[productKey].totalValue += repData[repName]?.[productKey]?.totalValue || 0
      }
    }

    // Team tier info (based on combined count)
    const teamTierInfo = {}
    for (const [productKey, { count, totalValue }] of Object.entries(teamTotals)) {
      teamTierInfo[productKey] = {
        count,
        totalValue,
        ...getTierInfo(count, TIERS[productKey], totalValue),
      }
    }

    // Per-rep breakdown — each rep's individual deal count + their commission at the TEAM tier rate
    const result = {}
    for (const [repName, products] of Object.entries(repData)) {
      result[repName] = {}
      for (const [productKey, { count, totalValue }] of Object.entries(products)) {
        const teamTier = teamTierInfo[productKey]
        const currentRate = teamTier.rate || 0
        const estimatedCommission = totalValue * currentRate
        result[repName][productKey] = {
          count,
          totalValue,
          estimatedCommission,
        }
      }
    }

    const currentMonthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

    return NextResponse.json({
      team: teamTierInfo,   // tier progress lives here — based on combined team count
      reps: result,         // per-rep deal counts + estimated commission at team rate
      currentMonth: currentMonthLabel,
      totalDealsThisMonth: thisMonthDeals.length,
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
