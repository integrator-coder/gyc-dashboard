import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getSessionUser } from '@/lib/auth';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all pending discrepancies
    const discrepancies = await prisma.aclDiscrepancy.findMany({
      where: { status: 'pending' }
    });

    let successCount = 0;
    let errorCount = 0;

    for (const discrepancy of discrepancies) {
      try {
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
        await prisma.aclDiscrepancy.update({
          where: { id: discrepancy.id },
          data: {
            status: 'approved',
            reviewedBy: user.email,
            reviewedAt: new Date()
          }
        });

        successCount++;
      } catch (err) {
        console.error(`Error processing discrepancy ${discrepancy.id}:`, err);
        errorCount++;
      }
    }

    return NextResponse.json({
      success: true,
      processed: successCount,
      errors: errorCount,
      total: discrepancies.length
    });
  } catch (error: any) {
    console.error('Error batch approving discrepancies:', error);
    return NextResponse.json(
      { error: 'Failed to batch approve discrepancies', message: error.message },
      { status: 500 }
    );
  }
}
