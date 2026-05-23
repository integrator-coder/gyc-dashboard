export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { syncStripeData } from '@/lib/stripe'

export async function POST() {
  try {
    const result = await syncStripeData(prisma)
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('Stripe sync error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
