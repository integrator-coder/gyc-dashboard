import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/auth'
import { pool } from '@/lib/pg'

export const dynamic = 'force-dynamic'

export async function GET(_req, { params }) {
  const auth = await requireApiUser(['ga', 'cx', 'admin', 'superadmin', 'manager'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { acronym } = await params
  const acr = acronym?.toUpperCase()
  if (!acr) return NextResponse.json({ error: 'Missing acronym' }, { status: 400 })

  try {
    const { rows } = await pool.query(
      `SELECT id, topic, "startTime", "aiSummary", "meetingRecap", "recordingUrl",
              "transcriptUrl", "gaName", "gaEmail", "repName", "hostEmail", "hostName",
              "durationSecs", "aiClassification"
       FROM "ZoomCall"
       WHERE acronym = $1
         AND "tenantId" = 'gyc'
         AND "aiClassification" = ANY($2)
       ORDER BY "startTime" DESC
       LIMIT 50`,
      [acr, ['client_meeting', 'onboarding', 'blueprint']]
    )

    const meetings = rows.map(c => ({
      id: c.id,
      title: c.topic || 'Marketing Review',
      meetingDate: c.startTime,
      meetingType: c.aiClassification,
      source: 'zoom',
      status: 'reviewed',
      execSummary: c.aiSummary || c.meetingRecap || null,
      transcriptUrl: c.transcriptUrl || c.recordingUrl || null,
      recordingUrl: c.recordingUrl || null,
      gaName: c.gaName || c.repName || c.hostName || null,
      gaEmail: c.gaEmail || c.hostEmail || null,
      tasks: [],
      decisions: [],
      topics: [],
      outstandingIssues: [],
      recapGeneratedAt: null,
    }))

    return NextResponse.json({ acronym: acr, meetings, count: meetings.length })
  } catch (err) {
    console.error('[meetings API]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
