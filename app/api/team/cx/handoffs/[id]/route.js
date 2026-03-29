export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/auth'
import { pool } from '@/lib/pg'

export async function GET(_request, { params }) {
  try {
    const auth = await requireApiUser(['cx', 'admin', 'superadmin'])
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const handoffId = Number(params.id)
    if (!Number.isFinite(handoffId)) {
      return NextResponse.json({ error: 'Invalid handoff id.' }, { status: 400 })
    }

    const handoffResult = await pool.query(
      `
        SELECT id, "clientName", "repName", "closedAt", "rawOutputJson"
        FROM "CXHandoff"
        WHERE id = $1
        LIMIT 1
      `,
      [handoffId]
    )

    const handoff = handoffResult.rows[0]
    if (!handoff) {
      return NextResponse.json({ error: 'Handoff not found.' }, { status: 404 })
    }

    const [promiseResult, callsResult] = await Promise.all([
      pool.query(
        `
          SELECT
            id,
            "promiseText",
            category,
            owner,
            confidence,
            "riskFlag",
            "reviewStatus",
            "reviewComment",
            "evidenceSource",
            "evidenceLink",
            "createdAt"
          FROM "PromiseLedgerItem"
          WHERE "handoffId" = $1
          ORDER BY id ASC
        `,
        [handoffId]
      ),
      pool.query(
        `
          SELECT
            zc.id,
            zc."meetingTopic",
            zc."callDate",
            zc."startedAt",
            zc."durationSecs",
            zc."callLink",
            zc."repName",
            zc."clientName",
            zc.acronym,
            zc."matchMethod",
            zc."matchConfidence",
            zts.speaker AS "transcriptSpeaker",
            zts.text AS "transcriptText",
            zts."startMs" AS "transcriptStartMs"
          FROM "CXHandoffCall" hc
          JOIN "ZoomCall" zc ON zc.id = hc."zoomCallId"
          LEFT JOIN LATERAL (
            SELECT speaker, text, "startMs"
            FROM "ZoomTranscriptSegment" seg
            JOIN "ZoomTranscript" zt ON zt.id = seg."transcriptId"
            WHERE zt."zoomCallId" = zc.id
              AND length(trim(seg.text)) > 15
            ORDER BY seg."startMs" ASC
            LIMIT 1
          ) zts ON TRUE
          WHERE hc."handoffId" = $1
          ORDER BY COALESCE(zc."callDate", zc."startedAt") DESC NULLS LAST
        `,
        [handoffId]
      ),
    ])

    const rawOutputJson = handoff.rawOutputJson || {}

    return NextResponse.json({
      handoff: {
        id: handoff.id,
        clientName: handoff.clientName,
        repName: handoff.repName,
        closedAt: handoff.closedAt,
        promiseLedgerItems: promiseResult.rows,
        cxQuestions: rawOutputJson.cxQuestions || [],
        dataGaps: rawOutputJson.dataGaps || [],
        zoomCalls: callsResult.rows.map((call) => ({
          ...call,
          transcriptSnippet: call.transcriptText
            ? {
                speaker: call.transcriptSpeaker,
                text: call.transcriptText,
                startMs: call.transcriptStartMs,
              }
            : null,
        })),
      },
    })
  } catch (error) {
    console.error('Team CX handoff detail error:', error)
    return NextResponse.json({ error: error.message || 'Failed to load handoff detail.' }, { status: 500 })
  }
}
