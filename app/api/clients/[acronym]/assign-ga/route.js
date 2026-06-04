export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

const GA_EMAILS = {
  'Stefen': 'stefen@growyourcenter.com',
  'Sebastian': 'sebastian@growyourcenter.com',
  'JC': 'jc@growyourcenter.com',
  'Briana': 'briana@growyourcenter.com',
  'Zu': 'zu@growyourcenter.com',
}

export async function PATCH(request, { params }) {
  try {
    // Auth check: admin or superadmin only
    const auth = await requireApiUser(['admin', 'superadmin'])
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { acronym } = await params
    if (!acronym) {
      return NextResponse.json({ error: 'Missing acronym.' }, { status: 400 })
    }

    const body = await request.json()
    const { assignedGA } = body

    if (!assignedGA || typeof assignedGA !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid assignedGA.' }, { status: 400 })
    }

    // Get the email for this GA
    const assignedGAEmail = GA_EMAILS[assignedGA] || null

    // Update the ClientProfile record
    const updated = await prisma.clientProfile.update({
      where: { acronym: acronym.toUpperCase() },
      data: { assignedGA, assignedGAEmail },
    }).catch(() => null)

    if (!updated) {
      return NextResponse.json({ error: 'Client not found.' }, { status: 404 })
    }
    return NextResponse.json({
      success: true,
      client: {
        id: updated.id,
        acronym: updated.acronym,
        companyName: updated.companyName,
        assignedGA: updated.assignedGA,
        assignedGAEmail: updated.assignedGAEmail,
      },
    })
  } catch (error) {
    console.error('GA reassignment error:', error)
    return NextResponse.json({ error: error.message || 'Failed to reassign GA.' }, { status: 500 })
  }
}
