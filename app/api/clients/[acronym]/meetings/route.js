import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { requireApiUser } from '@/lib/auth'

const prisma = new PrismaClient()

export async function GET(request, { params }) {
  const authResult = await requireApiUser(request, ['ga', 'cx', 'admin', 'superadmin', 'manager'])
  if (authResult.error) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const { acronym } = await params

  if (!acronym) {
    return NextResponse.json({ error: 'Missing acronym' }, { status: 400 })
  }

  try {
    const calls = await prisma.zoomCall.findMany({
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
        durationSecs: true,
        aiClassification: true,
        aiSummary: true,
        meetingRecap: true,
        followUpEmailDraft: true,
        recapGeneratedAt: true,
        recordingUrl: true,
        transcriptUrl: true,
        gaName: true,
        gaEmail: true,
        repName: true,
        hostEmail: true,
        hostName: true,
      },
      orderBy: { startTime: 'desc' },
      take: 30
    })

    // Map ZoomCall fields to ClientMeeting schema the component expects
    const meetings = calls.map(c => ({
      id: c.id,
      title: c.topic || 'Marketing Review',
      meetingDate: c.startTime,
      meetingType: c.aiClassification,
      source: 'zoom',
      status: 'reviewed',
      execSummary: c.aiSummary || c.meetingRecap || null,
      transcriptUrl: c.transcriptUrl || c.recordingUrl,
      recordingUrl: c.recordingUrl,
      gaName: c.gaName || c.repName || c.hostName,
      gaEmail: c.gaEmail || c.hostEmail,
      tasks: [],
      decisions: [],
      topics: [],
      outstandingIssues: [],
      recapGeneratedAt: c.recapGeneratedAt,
    }))

    return NextResponse.json({ acronym, meetings, count: meetings.length })
  } catch (err) {
    console.error('[API] /api/clients/[acronym]/meetings error:', err)
    return NextResponse.json({ error: 'Failed to fetch meetings', details: err.message }, { status: 500 })
  }
}
