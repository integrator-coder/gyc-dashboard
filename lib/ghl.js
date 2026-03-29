const GHL_BASE = 'https://services.leadconnectorhq.com'

function getHeaders() {
  return {
    Authorization: `Bearer ${process.env.GHL_API_KEY}`,
    Version: '2021-07-28',
    'Content-Type': 'application/json',
  }
}

export function getLocationId() {
  return process.env.GHL_LOCATION_ID || 'hmTIYUexYXIXgmJzbx3s'
}

async function parseJsonSafe(res) {
  const text = await res.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return { raw: text }
  }
}

export async function ghlFetch(path, { searchParams, timeoutMs = 30000 } = {}) {
  const url = new URL(path.startsWith('http') ? path : `${GHL_BASE}${path}`)

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value))
      }
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, {
      headers: getHeaders(),
      signal: controller.signal,
      cache: 'no-store',
    })

    const data = await parseJsonSafe(res)

    if (!res.ok) {
      throw new Error(data?.message || data?.error || `GHL ${res.status}`)
    }

    return data
  } finally {
    clearTimeout(timeout)
  }
}

export async function getClosedWonDeals(startDate, endDate) {
  const allDeals = []
  let startAfterId = null
  let startAfter = null

  do {
    const params = {
      location_id: getLocationId(),
      status: 'won',
      limit: 100,
      ...(startAfterId ? { startAfterId } : {}),
      ...(startAfter ? { startAfter } : {}),
    }

    const data = await ghlFetch('/opportunities/search', { searchParams: params })

    if (!data.opportunities?.length) break

    let hitPast = false
    for (const opp of data.opportunities) {
      const wonAt = new Date(opp.lastStatusChangeAt || opp.createdAt)
      if (startDate && wonAt < startDate) {
        hitPast = true
        break
      }
      if (endDate && wonAt > endDate) continue
      allDeals.push(opp)
    }

    if (hitPast) break

    startAfterId = data.meta?.startAfterId || data.opportunities[data.opportunities.length - 1]?.id || null
    startAfter = data.meta?.startAfter || null

    if (!data.meta?.nextPageUrl) break
  } while (startAfterId)

  return allDeals
}

export async function getGHLUsers() {
  const data = await ghlFetch('/users/', {
    searchParams: { locationId: getLocationId() },
  })
  return data.users || []
}

export async function getPipelines() {
  const data = await ghlFetch('/opportunities/pipelines', {
    searchParams: { locationId: getLocationId() },
  })
  return data.pipelines || []
}

export async function getCustomFields() {
  const data = await ghlFetch(`/locations/${getLocationId()}/customFields`)
  return data.customFields || []
}

export async function getContactsPage({ limit = 100, startAfter, startAfterId, query } = {}) {
  const data = await ghlFetch('/contacts/', {
    searchParams: {
      locationId: getLocationId(),
      limit,
      startAfter,
      startAfterId,
      query,
    },
  })

  return {
    contacts: data.contacts || [],
    meta: data.meta || {},
  }
}

export async function getAllOpportunities({ status, limit = 100, pipelineId } = {}) {
  const items = []
  let startAfterId = null
  let startAfter = null

  do {
    const data = await ghlFetch('/opportunities/search', {
      searchParams: {
        location_id: getLocationId(),
        status,
        pipeline_id: pipelineId,
        limit,
        ...(startAfterId ? { startAfterId } : {}),
        ...(startAfter ? { startAfter } : {}),
      },
    })

    const opportunities = data.opportunities || []
    if (!opportunities.length) break

    items.push(...opportunities)

    if (!data.meta?.nextPageUrl) break
    startAfterId = data.meta?.startAfterId || opportunities[opportunities.length - 1]?.id || null
    startAfter = data.meta?.startAfter || null
  } while (startAfterId)

  return items
}
