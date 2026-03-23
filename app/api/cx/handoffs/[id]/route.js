export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { pool } from '@/lib/pg'

function coerceArray(value) {
  return Array.isArray(value) ? value : []
}

export async function GET(_request, { params }) {
  try {
    const id = Number((await params).id)

    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: 'Invalid handoff id' }, { status: 400 })
    }

    const handoffResult = await pool.query(
      `SELECT id, "clientName", "clientId", "repName", "closedAt", "createdAt", "pipelinePhase", "rawOutputJson"
       FROM "CXHandoff"
       WHERE id = $1
       LIMIT 1`,
      [id]
    )

    const handoff = handoffResult.rows[0]
    if (!handoff) {
      return NextResponse.json({ error: 'Handoff not found' }, { status: 404 })
    }

    const [promiseResult, evidenceResult] = await Promise.all([
      pool.query(
        `SELECT id, "handoffId", "promiseText", category, owner, confidence, "riskFlag", "reviewStatus", "reviewComment", "evidenceSource", "evidenceLink", "createdAt"
         FROM "PromiseLedgerItem"
         WHERE "handoffId" = $1
         ORDER BY id ASC`,
        [id]
      ),
      pool.query(
        `SELECT
           e.id,
           e."handoffId",
           e.source,
           e."sourceRef",
           e."callDate",
           e."callLink",
           e."matchMethod",
           e."matchConfidence",
           e."createdAt",
           COALESCE(
             json_agg(
               json_build_object(
                 'id', z.id,
                 'handoffEvidenceId', z."handoffEvidenceId",
                 'meetingId', z."meetingId",
                 'meetingTopic', z."meetingTopic",
                 'startedAt', z."startedAt",
                 'durationSecs', z."durationSecs",
                 'vttRaw', z."vttRaw",
                 'createdAt', z."createdAt",
                 'segments', COALESCE(seg.segments, '[]'::json)
               )
               ORDER BY z."startedAt" NULLS LAST, z.id ASC
             ) FILTER (WHERE z.id IS NOT NULL),
             '[]'::json
           ) AS transcripts
         FROM "HandoffEvidence" e
         LEFT JOIN "ZoomTranscript" z ON z."handoffEvidenceId" = e.id
         LEFT JOIN LATERAL (
           SELECT COALESCE(
             json_agg(
               json_build_object(
                 'id', s.id,
                 'transcriptId', s."transcriptId",
                 'startMs', s."startMs",
                 'endMs', s."endMs",
                 'speaker', s.speaker,
                 'text', s.text,
                 'tag', s.tag
               )
               ORDER BY s."startMs" ASC, s.id ASC
             ),
             '[]'::json
           ) AS segments
           FROM "ZoomTranscriptSegment" s
           WHERE s."transcriptId" = z.id
         ) seg ON TRUE
         WHERE e."handoffId" = $1
         GROUP BY e.id
         ORDER BY e."callDate" DESC NULLS LAST, e.id ASC`,
        [id]
      ),
    ])

    const rawOutput = handoff.rawOutputJson || {}
    const cxQuestions = coerceArray(rawOutput.cxQuestions)
    const dataGaps = coerceArray(rawOutput.dataGaps)
    const salesCalls = rawOutput.salesCalls || {}
    const salesCallRows = coerceArray(salesCalls.calls)

    const zoomCalls = evidenceResult.rows
      .filter((item) => item.source === 'Zoom')
      .map((item) => {
        const matchingCall = salesCallRows.find((call) => String(call.rowNumber) === String(item.sourceRef)) || null
        const transcriptObjects = coerceArray(item.transcripts)
        const bestTranscript = transcriptObjects[0] || null
        const bestSegment = bestTranscript?.segments?.[0] || null
        const transcriptSnippet = bestSegment
          ? {
              speaker: bestSegment.speaker,
              text: bestSegment.text,
              startMs: bestSegment.startMs,
              endMs: bestSegment.endMs,
            }
          : null

        return {
          ...item,
          salesCall: matchingCall,
          transcripts: transcriptObjects,
          transcriptSnippet,
        }
      })

    return NextResponse.json({
      handoff: {
        id: handoff.id,
        clientName: handoff.clientName,
        clientId: handoff.clientId,
        repName: handoff.repName,
        closedAt: handoff.closedAt,
        createdAt: handoff.createdAt,
        pipelinePhase: handoff.pipelinePhase,
        promiseLedgerItems: promiseResult.rows,
        handoffEvidence: evidenceResult.rows.map((item) => ({
          ...item,
          transcripts: coerceArray(item.transcripts),
        })),
        zoomCalls,
        zoomTranscripts: zoomCalls.flatMap((item) => item.transcripts),
        cxQuestions,
        dataGaps,
        rawOutputJson: rawOutput,
      },
    })
  } catch (error) {
    console.error('CX handoff detail error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
