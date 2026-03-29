export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireApiUser } from '@/lib/auth'
import { pickManualLocationFields, serializeReconLocation } from '@/lib/recon'

export async function GET(_request, { params }) {
  const auth = await requireApiUser(['admin', 'recon', 'superadmin'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const { id } = await params
    const draft = await prisma.reconDraft.findUnique({ where: { id } })
    if (!draft) return NextResponse.json({ error: 'Recon draft not found.' }, { status: 404 })

    const locations = await prisma.reconLocation.findMany({
      where: { reconDraftId: id },
      orderBy: [{ locationIndex: 'asc' }, { createdAt: 'asc' }],
    })

    return NextResponse.json({ locations: locations.map(serializeReconLocation) })
  } catch (error) {
    console.error('Recon locations GET error:', error)
    return NextResponse.json({ error: error.message || 'Failed to load locations.' }, { status: 500 })
  }
}

export async function POST(request, { params }) {
  const auth = await requireApiUser(['admin', 'recon', 'superadmin'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const { id } = await params
    const draft = await prisma.reconDraft.findUnique({ where: { id } })
    if (!draft) return NextResponse.json({ error: 'Recon draft not found.' }, { status: 404 })

    const body = await request.json()
    const nextIndex = await prisma.reconLocation.count({ where: { reconDraftId: id } })
    const fields = pickManualLocationFields(body)
    if (!fields.locationName) {
      return NextResponse.json({ error: 'locationName is required.' }, { status: 400 })
    }

    const location = await prisma.reconLocation.create({
      data: {
        reconDraftId: id,
        locationName: fields.locationName,
        address: fields.address,
        city: fields.city,
        state: fields.state,
        googleMapsUrl: fields.googleMapsUrl,
        gbpClaimed: fields.gbpClaimed,
        gbpStatus: fields.gbpStatus,
        reviewNotes: fields.reviewNotes,
        autoData: {},
        manualData: fields.manualData,
        locationIndex: nextIndex,
      },
    })

    return NextResponse.json({ location: serializeReconLocation(location) }, { status: 201 })
  } catch (error) {
    console.error('Recon locations POST error:', error)
    return NextResponse.json({ error: error.message || 'Failed to add location.' }, { status: 500 })
  }
}
