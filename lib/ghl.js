const GHL_BASE = 'https://services.leadconnectorhq.com'

function getHeaders() {
  return {
    'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
    'Version': '2021-07-28',
    'Content-Type': 'application/json'
  }
}

function getLocationId() {
  return process.env.GHL_LOCATION_ID
}

export async function getClosedWonDeals(startDate, endDate) {
  const allDeals = []
  let cursor = null

  do {
    const params = new URLSearchParams({
      location_id: getLocationId(),
      status: 'won',
      limit: '100',
      ...(cursor ? { startAfter: cursor } : {})
    })

    const res = await fetch(`${GHL_BASE}/opportunities/search?${params}`, {
      headers: getHeaders()
    })
    const data = await res.json()

    if (!data.opportunities) break

    let hitPast = false
    for (const opp of data.opportunities) {
      const wonAt = new Date(opp.lastStatusChangeAt)
      if (startDate && wonAt < startDate) {
        hitPast = true
        break
      }
      if (endDate && wonAt > endDate) continue
      allDeals.push(opp)
    }

    if (hitPast) break

    cursor = data.meta?.nextPageUrl
      ? data.opportunities[data.opportunities.length - 1]?.id
      : null
  } while (cursor)

  return allDeals
}

export async function getGHLUsers() {
  const res = await fetch(`${GHL_BASE}/users/?locationId=${getLocationId()}`, {
    headers: getHeaders()
  })
  const data = await res.json()
  return data.users || []
}
