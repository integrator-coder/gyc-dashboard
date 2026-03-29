import { NextResponse } from 'next/server'
import { getAllOpportunities, getPipelines, getContactsPage } from '@/lib/ghl'

export const dynamic = 'force-dynamic'

function ageDays(iso) {
  if (!iso) return Number.POSITIVE_INFINITY
  return (Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000)
}

function summarizeByWindow(items, getIso) {
  return {
    today: items.filter(item => ageDays(getIso(item)) <= 1).length,
    week: items.filter(item => ageDays(getIso(item)) <= 7).length,
    month: items.filter(item => ageDays(getIso(item)) <= 30).length,
  }
}

async function getRecentContacts(days = 30) {
  const contacts = []
  let startAfter = null
  let startAfterId = null

  do {
    const page = await getContactsPage({
      limit: 100,
      startAfter,
      startAfterId,
    })

    if (!page.contacts.length) break

    let hitOlder = false

    for (const contact of page.contacts) {
      if (ageDays(contact.dateAdded) > days) {
        hitOlder = true
        break
      }
      contacts.push(contact)
    }

    if (hitOlder || !page.meta?.nextPageUrl) break
    startAfter = page.meta?.startAfter || null
    startAfterId = page.meta?.startAfterId || null
  } while (startAfterId)

  return contacts
}

export async function GET() {
  try {
    const [pipelines, openOpps, wonOpps, recentContacts] = await Promise.all([
      getPipelines(),
      getAllOpportunities({ status: 'open' }),
      getAllOpportunities({ status: 'won' }),
      getRecentContacts(30),
    ])

    const salesPipeline = pipelines.find(p => /sales/i.test(p.name))
    const excludedStageIds = new Set(
      (salesPipeline?.stages || [])
        .filter(stage => /(disqualified|closed lost|lost|cancelled)/i.test(stage.name))
        .map(stage => stage.id)
    )

    const qualifiedByContact = new Map()

    for (const opp of [...openOpps, ...wonOpps]) {
      if (salesPipeline?.id && opp.pipelineId !== salesPipeline.id) continue
      if (excludedStageIds.has(opp.pipelineStageId)) continue
      const key = opp.contactId || opp.id
      if (!qualifiedByContact.has(key)) qualifiedByContact.set(key, opp)
    }

    const qualifiedLeads = Array.from(qualifiedByContact.values())

    return NextResponse.json({
      newLeads: summarizeByWindow(recentContacts, item => item.dateAdded),
      qualifiedLeads: summarizeByWindow(qualifiedLeads, item => item.createdAt),
      metadata: {
        salesPipeline: salesPipeline?.name || null,
        excludedStages: (salesPipeline?.stages || [])
          .filter(stage => excludedStageIds.has(stage.id))
          .map(stage => stage.name),
        recentContactsSampled: recentContacts.length,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
