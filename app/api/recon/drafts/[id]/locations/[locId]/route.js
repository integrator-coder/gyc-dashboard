export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireApiUser } from '@/lib/auth'
import { normalizeGbpClaimed, normalizeGbpStatus, serializeReconLocation } from '@/lib/recon'

export async function PATCH(request, { params }) {
  const auth = await requireApiUser(['admin', 'recon', 'superadmin'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const { id, locId } = await params
    const body = await request.json()
    const location = await prisma.reconLocation.findFirst({
      where: {
        id: locId,
        reconDraftId: id,
      },
    })

    if (!location) {
      return NextResponse.json({ error: 'Recon location not found.' }, { status: 404 })
    }

    const updated = await prisma.reconLocation.update({
      where: { id: locId },
      data: {
        locationName: Object.prototype.hasOwnProperty.call(body || {}, 'locationName') ? String(body.locationName || '').trim() : undefined,
        address: Object.prototype.hasOwnProperty.call(body || {}, 'address') ? String(body.address || '').trim() || null : undefined,
        city: Object.prototype.hasOwnProperty.call(body || {}, 'city') ? String(body.city || '').trim() || null : undefined,
        state: Object.prototype.hasOwnProperty.call(body || {}, 'state') ? String(body.state || '').trim() || null : undefined,
        googleMapsUrl: Object.prototype.hasOwnProperty.call(body || {}, 'googleMapsUrl') ? String(body.googleMapsUrl || '').trim() || null : undefined,
        gbpClaimed: Object.prototype.hasOwnProperty.call(body || {}, 'gbpClaimed') ? normalizeGbpClaimed(body.gbpClaimed, location.gbpClaimed) : undefined,
        gbpStatus: Object.prototype.hasOwnProperty.call(body || {}, 'gbpStatus') ? normalizeGbpStatus(body.gbpStatus, location.gbpStatus) : undefined,
        reviewNotes: Object.prototype.hasOwnProperty.call(body || {}, 'reviewNotes') ? String(body.reviewNotes || '').trim() || null : undefined,
        manualData: Object.prototype.hasOwnProperty.call(body || {}, 'manualData') ? (body.manualData && typeof body.manualData === 'object' ? body.manualData : null) : undefined,
      },
    })

    return NextResponse.json({ location: serializeReconLocation(updated) })
  } catch (error) {
    console.error('Recon location PATCH error:', error)
    return NextResponse.json({ error: error.message || 'Failed to update location.' }, { status: 500 })
  }
}
