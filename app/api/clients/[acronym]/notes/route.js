import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/auth'
import { pool } from '@/lib/pg'

export const dynamic = 'force-dynamic'

export async function GET(_req, { params }) {
  try {
    const auth = await requireApiUser(['ga', 'cx', 'admin', 'superadmin', 'manager'])
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const { user } = auth

    const { acronym } = await params
    const acr = acronym.toUpperCase()

    // Get client's GHL contact ID and Notion page ID
    const clientRes = await pool.query(
      `SELECT "ghlContactId", "notionPageId", notes FROM "ClientProfile" WHERE acronym = $1`,
      [acr]
    )
    const client = clientRes.rows[0]
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

    const [ghlNotes, notionNotes] = await Promise.allSettled([
      fetchGHLNotes(client.ghlContactId),
      fetchNotionNotes(client.notionPageId),
    ])

    return NextResponse.json({
      ghlNotes:    ghlNotes.status === 'fulfilled' ? ghlNotes.value : { error: ghlNotes.reason?.message },
      notionNotes: notionNotes.status === 'fulfilled' ? notionNotes.value : { error: notionNotes.reason?.message },
      dbNotes: client.notes || null,
    })
  } catch (e) {
    console.error('[Notes API]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

async function fetchGHLNotes(contactId) {
  if (!contactId) return { notes: [], error: 'No GHL contact linked' }
  const res = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}/notes`, {
    headers: { 'Authorization': `Bearer ${process.env.GHL_API_KEY}`, 'Version': '2021-07-28' }
  })
  if (!res.ok) return { notes: [], error: `GHL API error: ${res.status}` }
  const data = await res.json()
  const filtered = (data.notes || [])
    .filter(n => {
      const body = (n.body || '').trim()
      // Skip auto-generated payment notes from GHL
      if (/^payment received:/i.test(body)) return false
      if (/^payment (failed|refunded|voided):/i.test(body)) return false
      return body.length > 0
    })
    .sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded))
  return { notes: filtered }
}

async function fetchNotionNotes(notionPageId) {
  if (!notionPageId) return { blocks: [], error: 'No Notion page linked' }

  // First, get the main Notion page to find the "Client Notes" sub-page URL
  const NOTION_KEY = process.env.NOTION_API_KEY
  const headers = { 'Authorization': `Bearer ${NOTION_KEY}`, 'Notion-Version': '2022-06-28' }

  // Try to fetch the main page properties to get Client Notes URL
  const pageRes = await fetch(`https://api.notion.com/v1/pages/${notionPageId}`, { headers })
  const pageData = await pageRes.json()

  let notesPageId = null
  if (pageData.properties) {
    const clientNotesProp = pageData.properties['Client Notes']
    const clientNotesUrl = clientNotesProp?.url
    if (clientNotesUrl) {
      // Extract page ID from Notion URL
      // Format: https://www.notion.so/workspace/Page-Title-PAGEID or https://www.notion.so/PAGEID
      const match = clientNotesUrl.match(/([a-f0-9]{32})(?:\?|$)/)
      if (match) notesPageId = match[1]
    }
  }

  // If no notes sub-page found, try the main page itself
  const targetId = notesPageId || notionPageId

  // Fetch blocks from the notes page
  const blocksRes = await fetch(`https://api.notion.com/v1/blocks/${targetId}/children?page_size=100`, { headers })

  if (!blocksRes.ok) {
    const err = await blocksRes.json()
    if (err.code === 'object_not_found') {
      return {
        blocks: [],
        error: 'not_shared',
        notesPageId: targetId,
        message: 'This notes page is not shared with the Wall-E integration. Open the page in Notion, click Share, and invite Wall-E.'
      }
    }
    return { blocks: [], error: err.message }
  }

  const blocksData = await blocksRes.json()
  const blocks = await extractTextBlocks(blocksData.results || [], headers)
  return { blocks, notesPageId: targetId }
}

// Block types we skip entirely — template scaffolding, checklists, noisy structure
const SKIP_TYPES = new Set(['to_do', 'link_preview', 'table_of_contents', 'breadcrumb', 'template'])

// Structural heading labels that are part of the call template — skip if empty
const TEMPLATE_LABELS = new Set([
  'rapport-building open:', 'outstanding issues', 'review data', 'performance update',
  'performance update roadmap', 'discuss changes', 'upsell', 'summarize', 'closing',
  'close call', 'key talking points', 'call prep:', 'discussion recap',
  'pre-call prep:', 'call notes:', 'client call instructions start here',
  'google my business*', 'facebook manager (where applicable or notable):',
  'google ads', 'website analytics', 'lead funnel tracking',
  'order of presentation of the monthly results',
  'were there upsell opportunities? note those here.',
  'were there upsell opportunities? note those here',
])

function isTemplateLabel(text) {
  return TEMPLATE_LABELS.has((text || '').trim().toLowerCase())
}

// Recursively extract CLEAN readable text — skip empty blocks and template boilerplate
async function extractTextBlocks(blocks, headers, depth = 0) {
  const result = []
  for (const block of blocks) {
    const type = block.type

    // Skip known-noisy types entirely
    if (SKIP_TYPES.has(type)) continue

    const richText = block[type]?.rich_text || []
    const text = richText.map(t => t.plain_text).join('').trim()

    const item = { type, text, depth }

    if (type === 'child_page') {
      item.text = (block.child_page?.title || '').trim()
    }

    // Fetch children if present
    let children = []
    if (block.has_children && depth < 3) {
      try {
        const childRes = await fetch(`https://api.notion.com/v1/blocks/${block.id}/children?page_size=50`, { headers })
        const childData = await childRes.json()
        children = await extractTextBlocks(childData.results || [], headers, depth + 1)
      } catch (e) { /* ignore */ }
    }
    item.children = children

    // Skip empty paragraphs
    if (type === 'paragraph' && !text && children.length === 0) continue

    // Skip template heading labels that have no real content beneath them
    if ((type === 'heading_1' || type === 'heading_2' || type === 'heading_3') && isTemplateLabel(text) && children.length === 0) continue

    // Skip blank headings
    if ((type === 'heading_1' || type === 'heading_2' || type === 'heading_3') && !text && children.length === 0) continue

    // Skip toggle blocks that are entirely template labels with no real child content
    if (type === 'toggle' && isTemplateLabel(text) && children.length === 0) continue

    // Only include the block if it has actual text or non-empty children
    if (text || children.length > 0 || type === 'divider') {
      result.push(item)
    }
  }
  return result
}
