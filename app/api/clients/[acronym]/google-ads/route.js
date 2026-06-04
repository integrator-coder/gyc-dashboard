import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/clients/[acronym]/google-ads
 * Returns Google Ads performance data for a client
 * Query params:
 *   - months: number of months to return (default 6)
 */
export async function GET(request, { params }) {
  try {
    const { acronym } = params;
    const searchParams = request.nextUrl.searchParams;
    const monthsParam = searchParams.get('months');
    const months = monthsParam ? parseInt(monthsParam, 10) : 6;

    // Get last N months of data
    const snapshots = await prisma.clientGoogleAdsSnapshot.findMany({
      where: {
        companyAcronym: acronym,
        tenantId: 'gyc'
      },
      orderBy: {
        periodMonth: 'desc'
      },
      take: months
    });

    // If no data, return empty state
    if (!snapshots || snapshots.length === 0) {
      return NextResponse.json({
        acronym,
        hasData: false,
        message: 'No Google Ads data available yet',
        monthlyData: [],
        summary: null
      });
    }

    // Calculate summary from most recent snapshot
    const latest = snapshots[0];
    const summary = {
      periodMonth: latest.periodMonth,
      impressions: latest.impressions || 0,
      clicks: latest.clicks || 0,
      spend: parseFloat(latest.spend || 0),
      conversions: parseFloat(latest.conversions || 0),
      costPerConversion: parseFloat(latest.costPerConversion || 0),
      conversionRate: parseFloat(latest.conversionRate || 0),
      impressionShare: parseFloat(latest.impressionShare || 0),
      activeCampaigns: latest.activeCampaigns || 0,
      campaignNames: latest.campaignNames || [],
      topKeywords: latest.topKeywords || [],
      budgetUtilization: parseFloat(latest.budgetUtilization || 0),
      syncedAt: latest.syncedAt
    };

    // Convert snapshots for response
    const monthlyData = snapshots.map(snap => ({
      periodMonth: snap.periodMonth,
      impressions: snap.impressions || 0,
      clicks: snap.clicks || 0,
      spend: parseFloat(snap.spend || 0),
      conversions: parseFloat(snap.conversions || 0),
      costPerConversion: parseFloat(snap.costPerConversion || 0),
      conversionRate: parseFloat(snap.conversionRate || 0),
      impressionShare: parseFloat(snap.impressionShare || 0),
      activeCampaigns: snap.activeCampaigns || 0,
      budgetUtilization: parseFloat(snap.budgetUtilization || 0)
    }));

    return NextResponse.json({
      acronym,
      hasData: true,
      monthlyData,
      summary
    });

  } catch (error) {
    console.error('[Google Ads API] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch Google Ads data',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
