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

    const [promiseResult, zoomCallResult] = await Promise.all([
      pool.query(
        `SELECT id, "handoffId", "promiseText", category, owner, confidence, "riskFlag", "reviewStatus", "reviewComment", "evidenceSource", "evidenceLink", "createdAt"
         FROM "PromiseLedgerItem"
         WHERE "handoffId" = $1
         ORDER BY id ASC`,
        [id]
      ),
      pool.query(
        `SELECT
           zc.id,
           zc."meetingId",
           zc."meetingUuid",
           zc."meetingTopic",
           zc."startedAt",
           zc."durationSecs",
           zc."repName",
           zc."clientName",
           zc."callDate",
           zc."callLink",
           zc."matchMethod",
           zc."matchConfidence",
           zc."matchReasonCode",
           zc."sourceRef",
           zc.purposes,
           zc."createdAt",
           COALESCE(
             json_build_object(
               'id', zt.id,
               'zoomCallId', zt."zoomCallId",
               'vttRaw', zt."vttRaw",
               'parsedAt', zt."parsedAt",
               'createdAt', zt."createdAt",
               'segments', COALESCE(seg.segments, '[]'::json)
             ),
             NULL
           ) AS transcript,
           COALESCE(ca.analysis, '[]'::json) AS analysis
         FROM "CXHandoffCall" hc
         JOIN "ZoomCall" zc ON zc.id = hc."zoomCallId"
         LEFT JOIN "ZoomTranscript" zt ON zt."zoomCallId" = zc.id
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
                 'tags', s.tags,
                 'purposes', s.purposes,
                 'createdAt', s."createdAt"
               )
               ORDER BY s."startMs" ASC
             ),
             '[]'::json
           ) AS segments
           FROM "ZoomTranscriptSegment" s
           WHERE s."transcriptId" = zt.id
         ) seg ON TRUE
         LEFT JOIN LATERAL (
           SELECT COALESCE(
             json_agg(
               json_build_object(
                 'id', c.id,
                 'purpose', c.purpose,
                 'analysisJson', c."analysisJson",
                 'createdAt', c."createdAt",
                 'updatedAt', c."updatedAt"
               )
               ORDER BY c.purpose ASC
             ),
             '[]'::json
           ) AS analysis
           FROM "CallAnalysis" c
           WHERE c."zoomCallId" = zc.id
         ) ca ON TRUE
         WHERE hc."handoffId" = $1
         ORDER BY zc."callDate" DESC NULLS LAST, zc."startedAt" DESC NULLS LAST, zc."createdAt" DESC`,
        [id]
      ),
    ])

    const rawOutput = handoff.rawOutputJson || {}
    const cxQuestions = coerceArray(rawOutput.cxQuestions)
    const dataGaps = coerceArray(rawOutput.dataGaps)
    const salesCalls = rawOutput.salesCalls || {}
    const salesCallRows = coerceArray(salesCalls.calls)

    const zoomCalls = zoomCallResult.rows.map((item) => {
      const rowMatch = String(item.sourceRef || '').match(/activity-log:row:(\d+)/)
      const sourceRowNumber = rowMatch ? Number(rowMatch[1]) : null
      const matchingCall = sourceRowNumber
        ? salesCallRows.find((call) => Number(call.rowNumber) === sourceRowNumber) || null
        : null
      const transcript = item.transcript && item.transcript.id ? item.transcript : null
      const segments = coerceArray(transcript?.segments)
      const bestSegment = segments.find((segment) => coerceArray(segment.tags).length) || segments[0] || null
      const transcriptSnippet = bestSegment
        ? {
            speaker: bestSegment.speaker,
            text: bestSegment.text,
            startMs: bestSegment.startMs,
            endMs: bestSegment.endMs,
            tags: bestSegment.tags || [],
          }
        : null

      return {
        ...item,
        sourceRowNumber,
        salesCall: matchingCall,
        transcripts: transcript ? [transcript] : [],
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
        handoffEvidence: zoomCalls,
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
