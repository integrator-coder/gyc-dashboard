import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { requireApiUser } from '@/lib/auth'

const prisma = new PrismaClient()

/**
 * GET /api/clients/[acronym]/meetings
 * Returns meeting history for a specific client
 * 
 * Auth: ga, cx, admin, superadmin
 */
export async function GET(request, { params }) {
  // Check auth
  const authResult = await requireApiUser(request, ['ga', 'cx', 'admin', 'superadmin', 'manager'])
  if (authResult.error) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const { acronym } = params

  if (!acronym) {
    return NextResponse.json({ error: 'Missing acronym' }, { status: 400 })
  }

  try {
    // Fetch meetings for this client
    const meetings = await prisma.zoomCall.findMany({
      where: {
        acronym: acronym,
        tenantId: 'gyc',
        aiClassification: {
          in: ['client_meeting', 'onboarding', 'blueprint']
        }
      },
      select: {
        id: true,
        topic: true,
        startTime: true,
        duration: true,
        aiClassification: true,
        aiSummary: true,
        meetingRecap: true,
        followUpEmailDraft: true,
        recapGeneratedAt: true,
        recordingUrl: true,
        transcriptUrl: true,
        gaName: true,
        gaEmail: true
      },
      orderBy: {
        startTime: 'desc'
      },
      take: 20
    })

    // Transform to API format
    const formattedMeetings = meetings.map(m => ({
      id: m.id,
      topic: m.topic,
      date: m.startTime ? m.startTime.toISOString().split('T')[0] : null,
      duration: m.duration,
      callType: m.aiClassification,
      aiSummary: m.aiSummary,
      meetingRecap: m.meetingRecap,
      followUpEmailDraft: m.followUpEmailDraft,
      recapGeneratedAt: m.recapGeneratedAt ? m.recapGeneratedAt.toISOString() : null,
      recordingUrl: m.recordingUrl,
      transcriptUrl: m.transcriptUrl,
      gaName: m.gaName,
      gaEmail: m.gaEmail
    }))

    return NextResponse.json({
      acronym,
      meetings: formattedMeetings,
      count: formattedMeetings.length
    })
  } catch (err) {
    console.error('[API] /api/clients/[acronym]/meetings error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch meetings', details: err.message },
      { status: 500 }
    )
  }
}
