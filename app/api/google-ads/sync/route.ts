import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * POST /api/google-ads/sync
 * Upserts Google Ads account data
 * Body: { accounts: [...] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accounts } = body;

    if (!Array.isArray(accounts)) {
      return NextResponse.json(
        { error: 'Expected accounts array in request body' },
        { status: 400 }
      );
    }

    let upserted = 0;
    const errors: string[] = [];

    for (const account of accounts) {
      try {
        await prisma.googleAdsAccount.upsert({
          where: { accountId: account.accountId },
          create: {
            accountId: account.accountId,
            accountName: account.accountName,
            currSpend: account.currSpend || 0,
            currClicks: account.currClicks || 0,
            currImpressions: account.currImpressions || 0,
            currCpc: account.currCpc || 0,
            currCtr: account.currCtr || 0,
            prevSpend: account.prevSpend || 0,
            prevClicks: account.prevClicks || 0,
            prevImpressions: account.prevImpressions || 0,
            prevCpc: account.prevCpc || 0,
            cpcChange: account.cpcChange || null,
            clicksChange: account.clicksChange || null,
            impressionsChange: account.impressionsChange || null,
            flagged: account.flagged || false,
            flags: account.flags || [],
            lastSynced: new Date(),
          },
          update: {
            accountName: account.accountName,
            currSpend: account.currSpend || 0,
            currClicks: account.currClicks || 0,
            currImpressions: account.currImpressions || 0,
            currCpc: account.currCpc || 0,
            currCtr: account.currCtr || 0,
            prevSpend: account.prevSpend || 0,
            prevClicks: account.prevClicks || 0,
            prevImpressions: account.prevImpressions || 0,
            prevCpc: account.prevCpc || 0,
            cpcChange: account.cpcChange || null,
            clicksChange: account.clicksChange || null,
            impressionsChange: account.impressionsChange || null,
            flagged: account.flagged || false,
            flags: account.flags || [],
            lastSynced: new Date(),
          },
        });
        upserted++;
      } catch (err: any) {
        errors.push(`${account.accountName}: ${err.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      upserted,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('Error syncing Google Ads data:', error);
    return NextResponse.json(
      { error: 'Failed to sync Google Ads data', message: error.message },
      { status: 500 }
    );
  }
}
