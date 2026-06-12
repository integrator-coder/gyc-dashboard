import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const snapshots = await prisma.googleAdsMonthlySnapshot.findMany({
    orderBy: { monthKey: 'asc' },
    take: 24  // last 24 months max
  });
  
  // Ensure only the CURRENT month is marked partial
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  const normalized = snapshots.map(s => ({
    ...s,
    isPartial: s.monthKey === currentMonthKey,
    monthLabel: s.monthKey === currentMonthKey ? `${s.monthLabel.split(' ')[0]} ⚠` : s.monthLabel
  }));
  
  return NextResponse.json({ snapshots: normalized });
}

export async function POST(request: Request) {
  const body = await request.json();
  const snapshot = await prisma.googleAdsMonthlySnapshot.upsert({
    where: { monthKey: body.monthKey },
    update: body,
    create: body
  });
  return NextResponse.json(snapshot);
}
