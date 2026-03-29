export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireApiUser } from '@/lib/auth'
import { getReconDraftWithLocations, normalizeDraftStatus, serializeReconDraft } from '@/lib/recon'

export async function GET(_request, { params }) {
  const auth = await requireApiUser(['admin', 'recon', 'superadmin'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const { id } = await params
    const draft = await getReconDraftWithLocations(id)
    if (!draft) {
      return NextResponse.json({ error: 'Recon draft not found.' }, { status: 404 })
    }
    return NextResponse.json({ draft: serializeReconDraft(draft) })
  } catch (error) {
    console.error('Recon draft GET error:', error)
    return NextResponse.json({ error: error.message || 'Failed to load recon draft.' }, { status: 500 })
  }
}

export async function PATCH(request, { params }) {
  const auth = await requireApiUser(['admin', 'recon', 'superadmin'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const { id } = await params
    const body = await request.json()
    const existing = await prisma.reconDraft.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Recon draft not found.' }, { status: 404 })
    }

    const nextStatus = body?.status ? normalizeDraftStatus(body.status, existing.status) : existing.status
    const reviewedBy = Object.prototype.hasOwnProperty.call(body || {}, 'reviewedBy')
      ? String(body.reviewedBy || '').trim() || null
      : nextStatus === 'validated' || nextStatus === 'rejected'
        ? auth.user.email
        : existing.reviewedBy

    const draft = await prisma.reconDraft.update({
      where: { id },
      data: {
        status: nextStatus,
        prospectName: Object.prototype.hasOwnProperty.call(body || {}, 'prospectName') ? String(body.prospectName || '').trim() : undefined,
        websiteUrl: Object.prototype.hasOwnProperty.call(body || {}, 'websiteUrl') ? String(body.websiteUrl || '').trim() : undefined,
        validatedData: Object.prototype.hasOwnProperty.call(body || {}, 'validatedData')
          ? (body.validatedData && typeof body.validatedData === 'object' ? body.validatedData : null)
          : undefined,
        reviewedBy,
        reviewedAt: nextStatus === 'validated' || nextStatus === 'rejected' ? new Date() : null,
        notes: Object.prototype.hasOwnProperty.call(body || {}, 'notes') ? String(body.notes || '').trim() || null : undefined,
      },
      include: {
        ReconLocation: {
          orderBy: [{ locationIndex: 'asc' }, { createdAt: 'asc' }],
        },
      },
    })

    return NextResponse.json({ draft: serializeReconDraft(draft) })
  } catch (error) {
    console.error('Recon draft PATCH error:', error)
    return NextResponse.json({ error: error.message || 'Failed to update recon draft.' }, { status: 500 })
  }
}
