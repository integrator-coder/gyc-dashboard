export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireApiUser } from '@/lib/auth'
import { deriveLocationsFromAutoData, serializeReconDraft } from '@/lib/recon'

export async function GET() {
  const auth = await requireApiUser(['admin', 'recon', 'superadmin'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const drafts = await prisma.reconDraft.findMany({
      where: { status: 'pending-review' },
      include: {
        ReconLocation: {
          orderBy: [{ locationIndex: 'asc' }, { createdAt: 'asc' }],
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ drafts: drafts.map(serializeReconDraft) })
  } catch (error) {
    console.error('Recon drafts GET error:', error)
    return NextResponse.json({ error: error.message || 'Failed to load recon drafts.' }, { status: 500 })
  }
}

export async function POST(request) {
  const auth = await requireApiUser(['admin', 'recon', 'superadmin'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await request.json()
    const prospectName = String(body?.prospectName || '').trim()
    const websiteUrl = String(body?.websiteUrl || '').trim()
    const autoData = body?.autoData && typeof body.autoData === 'object' ? body.autoData : {}
    const requestedBy = String(body?.requestedBy || auth.user.email || '').trim() || auth.user.email

    if (!prospectName || !websiteUrl) {
      return NextResponse.json({ error: 'prospectName and websiteUrl are required.' }, { status: 400 })
    }

    const derivedLocations = deriveLocationsFromAutoData(autoData)

    const draft = await prisma.reconDraft.create({
      data: {
        prospectName,
        websiteUrl,
        requestedBy,
        status: 'pending-review',
        rawAutoData: autoData,
        ReconLocation: derivedLocations.length
          ? {
              create: derivedLocations,
            }
          : undefined,
      },
      include: {
        ReconLocation: {
          orderBy: [{ locationIndex: 'asc' }, { createdAt: 'asc' }],
        },
      },
    })

    return NextResponse.json({ draft: serializeReconDraft(draft) }, { status: 201 })
  } catch (error) {
    console.error('Recon drafts POST error:', error)
    return NextResponse.json({ error: error.message || 'Failed to create recon draft.' }, { status: 500 })
  }
}
