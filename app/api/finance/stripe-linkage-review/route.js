export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/auth'
import { applyStripeLinkageDecision, getStripeLinkageReviewQueue } from '@/lib/stripe-linkage-review'

export async function GET(request) {
  try {
    const auth = await requireApiUser(['admin', 'superadmin'])
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { searchParams } = new URL(request.url)
    const acronym = searchParams.get('acronym') || null
    const includeResolved = searchParams.get('includeResolved') === '1'

    const result = await getStripeLinkageReviewQueue({ acronym, includeResolved })
    return NextResponse.json(result)
  } catch (error) {
    console.error('[GET /api/finance/stripe-linkage-review]', error)
    return NextResponse.json({ error: error.message || 'Failed to load linkage review queue.' }, { status: error.status || 500 })
  }
}

export async function POST(request) {
  try {
    const auth = await requireApiUser(['admin', 'superadmin'])
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json()
    const result = await applyStripeLinkageDecision({
      caseKey: body.caseKey,
      reason: body.reason,
      clientProfileId: body.clientProfileId == null ? null : Number(body.clientProfileId),
      stripeCustomerId: body.stripeCustomerId || null,
      resolution: body.resolution,
      notes: body.notes || '',
      userEmail: auth.user?.email || null,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[POST /api/finance/stripe-linkage-review]', error)
    return NextResponse.json({ error: error.message || 'Failed to apply linkage review decision.' }, { status: error.status || 500 })
  }
}
