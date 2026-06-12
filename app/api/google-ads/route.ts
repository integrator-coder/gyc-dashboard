import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Fetch all Google Ads accounts
    const accounts = await prisma.googleAdsAccount.findMany({
      orderBy: [
        { flagged: 'desc' }, // Flagged accounts first
        { currSpend: 'desc' } // Then by spend
      ]
    });

    // Calculate aggregates
    const totalSpend = accounts.reduce((sum, acc) => sum + acc.currSpend, 0);
    const totalClicks = accounts.reduce((sum, acc) => sum + acc.currClicks, 0);
    const totalImpressions = accounts.reduce((sum, acc) => sum + acc.currImpressions, 0);
    const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const flaggedCount = accounts.filter(acc => acc.flagged).length;

    // Top performers: top 10 by clicks with positive trends
    const topPerformers = accounts
      .filter(acc => 
        !acc.flagged && 
        (acc.clicksChange || 0) > 0 && 
        (acc.cpcChange || 0) < 20
      )
      .sort((a, b) => b.currClicks - a.currClicks)
      .slice(0, 10);

    // Get most recent sync time
    const lastSynced = accounts.length > 0 
      ? accounts.reduce((latest, acc) => acc.lastSynced > latest ? acc.lastSynced : latest, accounts[0].lastSynced)
      : null;

    // Get monthly snapshot last update
    const latestMonthly = await prisma.googleAdsMonthlySnapshot.findFirst({
      orderBy: { updatedAt: 'desc' }
    });

    return NextResponse.json({
      accounts,
      aggregates: {
        totalSpend,
        totalClicks,
        totalImpressions,
        avgCpc,
        flaggedCount,
        totalAccounts: accounts.length,
        topPerformers
      },
      lastSynced,
      monthlyLastUpdated: latestMonthly?.updatedAt || null,
    });
  } catch (error: any) {
    console.error('Error fetching Google Ads data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Google Ads data', message: error.message },
      { status: 500 }
    );
  }
}
