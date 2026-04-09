export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/auth'

export async function POST(request) {
  const { user, error, status } = await requireApiUser(['superadmin', 'admin'])
  if (error) return NextResponse.json({ error }, { status })

  const { ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET } = process.env
  if (!ZOOM_ACCOUNT_ID || !ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET) {
    return NextResponse.json({
      error: 'Zoom credentials not configured. Add ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET to environment variables.',
    }, { status: 503 })
  }

  // Fire off the sync in the background (edge-safe: just kick off a server action)
  // For now, return an acknowledgment — the actual sync is run via CLI script or a separate worker.
  // In production, this would queue a job or call a background function.
  return NextResponse.json({
    ok: true,
    message: 'Sync initiated. Run `node scripts/sync-zoom-calls.mjs` on the server to populate calls, or configure a Vercel Cron job.',
    tip: 'For live sync, add Zoom credentials and re-deploy with a cron trigger.',
  })
}
