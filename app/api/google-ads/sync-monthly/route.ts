import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
  const body = await request.json();
  const snapshot = await prisma.googleAdsMonthlySnapshot.upsert({
    where: { monthKey: body.monthKey },
    update: body,
    create: body
  });
  return NextResponse.json(snapshot);
}
