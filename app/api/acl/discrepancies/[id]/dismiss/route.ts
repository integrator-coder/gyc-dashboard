import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getSessionUser } from '@/lib/auth';

const prisma = new PrismaClient();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { note } = body;

    if (!note || note.trim() === '') {
      return NextResponse.json({ error: 'Dismiss note is required' }, { status: 400 });
    }

    const discrepancy = await prisma.aclDiscrepancy.findUnique({
      where: { id }
    });

    if (!discrepancy) {
      return NextResponse.json({ error: 'Discrepancy not found' }, { status: 404 });
    }

    if (discrepancy.status !== 'pending') {
      return NextResponse.json({ error: 'Discrepancy already processed' }, { status: 400 });
    }

    // Mark discrepancy as dismissed
    const updated = await prisma.aclDiscrepancy.update({
      where: { id },
      data: {
        status: 'dismissed',
        dismissNote: note,
        reviewedBy: user.email,
        reviewedAt: new Date()
      }
    });

    return NextResponse.json({ success: true, discrepancy: updated });
  } catch (error: any) {
    console.error('Error dismissing discrepancy:', error);
    return NextResponse.json(
      { error: 'Failed to dismiss discrepancy', message: error.message },
      { status: 500 }
    );
  }
}
