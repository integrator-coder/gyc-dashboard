import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const syncHistory = await prisma.aclSyncLog.findMany({
      take: 10,
      orderBy: { runAt: 'desc' }
    });

    return NextResponse.json({ syncHistory });
  } catch (error: any) {
    console.error('Error fetching sync history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sync history', message: error.message },
      { status: 500 }
    );
  }
}
