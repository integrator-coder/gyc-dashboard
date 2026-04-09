export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/auth'
import { ghlFetch, getLocationId } from '@/lib/ghl'

/**
 * GET /api/ghl/contacts/search?q={query}
 * Searches GHL contacts by name or email.
 * Returns up to 20 matching contacts with name, email, pipeline, stage.
 */
export async function GET(request) {
  const { user, error, status } = await requireApiUser(['superadmin', 'admin'])
  if (error) return NextResponse.json({ error }, { status })

  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') || '').trim()

  if (!q || q.length < 2) {
    return NextResponse.json({ contacts: [] })
  }

  const locationId = getLocationId()

  try {
    // GHL supports `query` param for name/email search
    const data = await ghlFetch('/contacts/', {
      searchParams: {
        locationId,
        query: q,
        limit: 20,
      },
    })

    const raw = data.contacts || []
    const contacts = raw.map(c => ({
      id: c.id,
      name: [c.firstName, c.lastName].filter(Boolean).join(' ') || c.name || '(No name)',
      email: c.email || '',
      phone: c.phone || '',
      pipeline: c.pipeline || null,
      stage: c.stage || null,
      tags: c.tags || [],
    }))

    return NextResponse.json({ contacts })
  } catch (err) {
    console.error('[ghl/contacts/search] error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
