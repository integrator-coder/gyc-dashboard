import { NextResponse } from 'next/server'

const SCORECARD_DB_ID = '176ca865-e197-81f8-b79b-f8836089790e'
const NOTION_VERSION = '2022-06-28'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const QUARTERS = {
  Q1: ['January', 'February', 'March'],
  Q2: ['April', 'May', 'June'],
  Q3: ['July', 'August', 'September'],
  Q4: ['October', 'November', 'December'],
}

function getCurrentQuarter(monthIdx) {
  if (monthIdx <= 2) return 'Q1'
  if (monthIdx <= 5) return 'Q2'
  if (monthIdx <= 8) return 'Q3'
  return 'Q4'
}

function metInQuarter(monthStatus, quarter) {
  return QUARTERS[quarter].some(m => monthStatus[m])
}

function notionHeaders() {
  return {
    'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json'
  }
}

async function queryDatabase(databaseId, startCursor) {
  const body = { page_size: 100 }
  if (startCursor) body.start_cursor = startCursor
  const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: 'POST',
    headers: notionHeaders(),
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`Notion API error ${res.status}`)
  return res.json()
}

export async function GET() {
  try {
    // Paginate through all clients
    const allResults = []
    let cursor = undefined
    do {
      const data = await queryDatabase(SCORECARD_DB_ID, cursor)
      allResults.push(...data.results)
      cursor = data.has_more ? data.next_cursor : undefined
    } while (cursor)

    const now = new Date()
    const currentQuarter = getCurrentQuarter(now.getMonth())
    const currentMonth = MONTHS[now.getMonth()]

    // Parse each client
    const parsed = allResults.map(r => {
      const props = r.properties

      const nameArr = props["Center's Name"]?.rollup?.array || []
      const name = nameArr[0]?.title?.map(t => t.plain_text).join('') || ''

      const acronymArr = props["Acronym"]?.rollup?.array || []
      const acronym = acronymArr[0]?.title?.map(t => t.plain_text).join('') || ''

      const mcArr = props["MC"]?.rollup?.array || []
      const mc = mcArr[0]?.select?.name || ''

      const monthStatus = {}
      for (const m of MONTHS) {
        monthStatus[m] = !!(props[m]?.select?.name)
      }

      return { name, acronym, mc, months: monthStatus }
    })

    // Exclude clients with no MC/Growth Advisor assigned — they skew the numbers
    const active = parsed.filter(c => c.mc && c.mc.trim() !== '')
    const total = active.length

    // Quarterly stats
    const quarterStats = {}
    for (const [q, months] of Object.entries(QUARTERS)) {
      const met = active.filter(c => metInQuarter(c.months, q)).length
      quarterStats[q] = { met, total, pct: total > 0 ? (met / total * 100) : 0, months }
    }

    // Month breakdown for current quarter
    const currentQuarterMonthBreakdown = {}
    for (const m of QUARTERS[currentQuarter]) {
      const done = active.filter(c => c.months[m]).length
      currentQuarterMonthBreakdown[m] = { done, total, pct: total > 0 ? (done / total * 100) : 0 }
    }

    // By MC for current quarter
    const byMc = {}
    for (const c of active) {
      const mc = c.mc
      if (!byMc[mc]) byMc[mc] = { met: 0, total: 0, notMet: [] }
      byMc[mc].total++
      if (metInQuarter(c.months, currentQuarter)) {
        byMc[mc].met++
      } else {
        byMc[mc].notMet.push({ name: c.name, acronym: c.acronym })
      }
    }

    // Unassigned clients (excluded from calculations but still tracked)
    const unassigned = parsed
      .filter(c => !c.mc || c.mc.trim() === '')
      .map(c => ({ name: c.name, acronym: c.acronym }))

    return NextResponse.json({
      totalClients: total,
      currentQuarter,
      currentMonth,
      quarterStats,
      currentQuarterMonthBreakdown,
      byMc,
      unassigned,
      updatedAt: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
