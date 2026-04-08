export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/auth'
import { pool } from '@/lib/pg'
import { tokenizeSearchQuery } from '@/lib/team'

export async function GET(request) {
  try {
    const auth = await requireApiUser(['sales', 'ga', 'cx', 'admin', 'superadmin'])
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { searchParams } = new URL(request.url)
    const q = String(searchParams.get('q') || '').trim()
    const clientName = String(searchParams.get('clientName') || '').trim()

    if (!q) {
      return NextResponse.json({ results: [] })
    }

    const tokens = tokenizeSearchQuery(q)
    const likeClauses = []
    const scoreParts = []
    const params = []

    tokens.forEach((token) => {
      params.push(`%${token}%`)
      likeClauses.push(`lower(seg.text) LIKE $${params.length}`)
      scoreParts.push(`CASE WHEN lower(seg.text) LIKE $${params.length} THEN 1 ELSE 0 END`)
    })

    let clientClause = ''
    if (clientName) {
      params.push(clientName.toLowerCase(), clientName.toLowerCase())
      clientClause = ` AND (lower(COALESCE(zc."clientName", '')) = $${params.length - 1} OR lower(COALESCE(zc.acronym, '')) = $${params.length})`
    }

    const whereText = likeClauses.length ? `(${likeClauses.join(' OR ')})` : 'TRUE'
    const relevance = scoreParts.length ? scoreParts.join(' + ') : '0'

    const { rows } = await pool.query(
      `
        SELECT
          seg.id,
          seg.speaker,
          seg."startMs",
          seg.text,
          zc."callDate",
          zc."repName",
          zc."callLink" AS "zoomLink",
          zc."clientName",
          zc.acronym,
          (${relevance})::int AS relevance
        FROM "ZoomTranscriptSegment" seg
        JOIN "ZoomTranscript" zt ON zt.id = seg."transcriptId"
        JOIN "ZoomCall" zc ON zc.id = zt."zoomCallId"
        WHERE length(trim(seg.text)) > 2
          AND ${whereText}
          ${clientClause}
        ORDER BY relevance DESC, COALESCE(zc."callDate", zc."startedAt") DESC NULLS LAST, seg."startMs" ASC
        LIMIT 10
      `,
      params
    )

    return NextResponse.json({ results: rows, q, clientName: clientName || null })
  } catch (error) {
    console.error('Team CX search error:', error)
    return NextResponse.json({ error: error.message || 'Failed to search transcripts.' }, { status: 500 })
  }
}
