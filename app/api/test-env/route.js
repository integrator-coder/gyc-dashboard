import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    anthropic: process.env.ANTHROPIC_BILLING_API_KEY ? 'present' : 'missing',
    openai: process.env.OPENAI_API_KEY ? 'present' : 'missing',
    render: process.env.RENDER_API_KEY ? 'present' : 'missing',
  })
}
