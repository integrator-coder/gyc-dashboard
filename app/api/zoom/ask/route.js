export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/auth'
import { pool } from '@/lib/pg'

export async function POST(request) {
  const { user, error, status } = await requireApiUser(['superadmin', 'admin'])
  if (error) return NextResponse.json({ error }, { status })

  const { callId, question } = await request.json()
  if (!callId || !question) {
    return NextResponse.json({ error: 'callId and question required' }, { status: 400 })
  }

  const { rows } = await pool.query(
    `SELECT topic, "transcriptText", "aiSummary", participants, "hostEmail", "startTime", duration FROM "ZoomCall" WHERE id = $1`,
    [callId]
  )
  if (!rows[0]) return NextResponse.json({ error: 'Call not found' }, { status: 404 })

  const call = rows[0]
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_BILLING_API_KEY || process.env.ANTHROPIC_API_KEY

  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ answer: 'AI not configured (no Anthropic API key found).' })
  }

  const context = [
    `Meeting: ${call.topic || 'Unknown'}`,
    `Date: ${call.startTime ? new Date(call.startTime).toLocaleDateString() : 'Unknown'}`,
    `Duration: ${call.duration ? call.duration + ' minutes' : 'Unknown'}`,
    `Host: ${call.hostEmail || 'Unknown'}`,
    call.aiSummary ? `Summary: ${call.aiSummary}` : '',
    call.transcriptText
      ? `\nTranscript (excerpt):\n${call.transcriptText.slice(0, 3000)}`
      : '(No transcript available)',
  ].filter(Boolean).join('\n')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: `You are Wall·E, GYC's AI assistant. Answer the question about this Zoom call concisely.\n\n${context}\n\nQuestion: ${question}`,
        },
      ],
    }),
  })

  const data = await res.json()
  const answer = data.content?.[0]?.text || 'No response from AI.'
  return NextResponse.json({ answer })
}
