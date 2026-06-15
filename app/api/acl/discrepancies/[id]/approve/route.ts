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
    const discrepancy = await prisma.aclDiscrepancy.findUnique({
      where: { id }
    });

    if (!discrepancy) {
      return NextResponse.json({ error: 'Discrepancy not found' }, { status: 404 });
    }

    if (discrepancy.status !== 'pending') {
      return NextResponse.json({ error: 'Discrepancy already processed' }, { status: 400 });
    }

    // Apply the change to ClientProfile
    if (discrepancy.clientId) {
      const clientProfile = await prisma.clientProfile.findUnique({
        where: { id: parseInt(discrepancy.clientId) }
      });

      if (clientProfile) {
        const updateData: any = {};

        switch (discrepancy.changeType) {
          case 'cancellation':
            updateData.stripeStatus = 'cancelled';
            break;
          case 'status_change':
            updateData.stripeStatus = discrepancy.stripeValue;
            break;
          case 'mrr_mismatch':
          case 'evergreen_transition':
            updateData.mrr = parseFloat(discrepancy.stripeValue);
            break;
          case 'pif_activation':
            // Handle PIF activation logic if needed
            break;
        }

        if (Object.keys(updateData).length > 0) {
          await prisma.clientProfile.update({
            where: { id: parseInt(discrepancy.clientId) },
            data: updateData
          });
        }
      }
    }

    // Mark discrepancy as approved
    const updated = await prisma.aclDiscrepancy.update({
      where: { id },
      data: {
        status: 'approved',
        reviewedBy: user.email,
        reviewedAt: new Date()
      }
    });

    return NextResponse.json({ success: true, discrepancy: updated });
  } catch (error: any) {
    console.error('Error approving discrepancy:', error);
    return NextResponse.json(
      { error: 'Failed to approve discrepancy', message: error.message },
      { status: 500 }
    );
  }
}
