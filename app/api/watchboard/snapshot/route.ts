import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const snapshot = await prisma.aIWatchSnapshot.findFirst({
      where: {
        tenantId: 'gyc'
      },
      orderBy: {
        snapshotAt: 'desc'
      }
    });

    if (!snapshot) {
      return NextResponse.json({
        success: false,
        error: 'No snapshot found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: snapshot
    });
  } catch (error: any) {
    console.error('WatchBoard Snapshot API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
