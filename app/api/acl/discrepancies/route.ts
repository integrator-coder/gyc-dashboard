import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Fetch pending discrepancies
    const discrepancies = await prisma.aclDiscrepancy.findMany({
      where: { status: 'pending' },
      orderBy: [
        { syncRunAt: 'desc' },
        { changeType: 'asc' }
      ]
    });

    // Get last sync log
    const lastSync = await prisma.aclSyncLog.findFirst({
      orderBy: { runAt: 'desc' }
    });

    // Count by change type
    const typeCounts = {
      cancellation: discrepancies.filter(d => d.changeType === 'cancellation').length,
      status_change: discrepancies.filter(d => d.changeType === 'status_change').length,
      mrr_mismatch: discrepancies.filter(d => d.changeType === 'mrr_mismatch').length,
      evergreen_transition: discrepancies.filter(d => d.changeType === 'evergreen_transition').length,
      pif_activation: discrepancies.filter(d => d.changeType === 'pif_activation').length,
    };

    return NextResponse.json({
      discrepancies,
      lastSync: lastSync ? {
        runAt: lastSync.runAt,
        clientsChecked: lastSync.clientsChecked,
        discrepanciesFound: lastSync.discrepanciesFound,
        syncType: lastSync.syncType
      } : null,
      summary: {
        total: discrepancies.length,
        typeCounts
      }
    });
  } catch (error: any) {
    console.error('Error fetching ACL discrepancies:', error);
    return NextResponse.json(
      { error: 'Failed to fetch discrepancies', message: error.message },
      { status: 500 }
    );
  }
}
