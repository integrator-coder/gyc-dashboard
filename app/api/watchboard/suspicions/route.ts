import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const suspicions = await prisma.aIWatchSuspicion.findMany({
      where: {
        tenantId: 'gyc',
        isActive: true
      },
      orderBy: [
        { severity: 'desc' }, // alert > suspicion > watch
        { detectedAt: 'desc' }
      ]
    });

    return NextResponse.json({
      success: true,
      data: suspicions,
      count: suspicions.length
    });
  } catch (error: any) {
    console.error('WatchBoard Suspicions API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
