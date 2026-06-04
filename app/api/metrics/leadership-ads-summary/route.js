import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/metrics/leadership-ads-summary
 * Aggregates Google Ads performance across all clients
 * Query params:
 *   - month: YYYY-MM (defaults to current month)
 */
export async function GET(request) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const monthParam = searchParams.get('month');
    
    // Default to current month if not specified
    const targetMonth = monthParam || new Date().toISOString().slice(0, 7);

    // Get all client snapshots for the target month
    const snapshots = await prisma.clientGoogleAdsSnapshot.findMany({
      where: {
        periodMonth: targetMonth,
        tenantId: 'gyc'
      },
      include: {
        ClientProfile: {
          select: {
            acronym: true,
            companyName: true
          }
        }
      }
    });

    // If no data, return empty state
    if (!snapshots || snapshots.length === 0) {
      return NextResponse.json({
        month: targetMonth,
        hasData: false,
        totalClients: 0,
        totalSpend: 0,
        totalConversions: 0,
        avgCostPerConversion: 0,
        clientsAboveBenchmark: 0,
        clientsBelowBenchmark: 0,
        topPerformer: null,
        needsAttention: []
      });
    }

    // Calculate aggregates
    const totalClients = snapshots.length;
    const totalSpend = snapshots.reduce((sum, s) => sum + parseFloat(s.spend || 0), 0);
    const totalConversions = snapshots.reduce((sum, s) => sum + parseFloat(s.conversions || 0), 0);
    const avgCostPerConversion = totalConversions > 0 ? totalSpend / totalConversions : 0;

    // Benchmark: 3% conversion rate
    const BENCHMARK_CONV_RATE = 0.03;
    const clientsAboveBenchmark = snapshots.filter(s => 
      parseFloat(s.conversionRate || 0) > BENCHMARK_CONV_RATE
    ).length;
    const clientsBelowBenchmark = totalClients - clientsAboveBenchmark;

    // Find top performer (highest conversions with lowest cost per conversion)
    let topPerformer = null;
    if (snapshots.length > 0) {
      const sorted = [...snapshots]
        .filter(s => parseFloat(s.conversions || 0) > 0)
        .sort((a, b) => {
          // Primary: highest conversions
          const convDiff = parseFloat(b.conversions || 0) - parseFloat(a.conversions || 0);
          if (Math.abs(convDiff) > 1) return convDiff;
          // Secondary: lowest cost per conversion
          return parseFloat(a.costPerConversion || 0) - parseFloat(b.costPerConversion || 0);
        });
      
      if (sorted.length > 0) {
        const best = sorted[0];
        topPerformer = {
          acronym: best.companyAcronym,
          conversions: parseFloat(best.conversions || 0),
          costPerConversion: parseFloat(best.costPerConversion || 0),
          spend: parseFloat(best.spend || 0)
        };
      }
    }

    // Find clients needing attention: high spend, low conversions
    const needsAttention = snapshots
      .filter(s => {
        const spend = parseFloat(s.spend || 0);
        const conversions = parseFloat(s.conversions || 0);
        const convRate = parseFloat(s.conversionRate || 0);
        // High spend (>$500) but low conversion rate (<2%)
        return spend > 500 && convRate < 0.02;
      })
      .map(s => ({
        acronym: s.companyAcronym,
        spend: parseFloat(s.spend || 0),
        conversions: parseFloat(s.conversions || 0),
        conversionRate: parseFloat(s.conversionRate || 0)
      }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 10); // Top 10 needing attention

    return NextResponse.json({
      month: targetMonth,
      hasData: true,
      totalClients,
      totalSpend: Math.round(totalSpend * 100) / 100,
      totalConversions: Math.round(totalConversions * 100) / 100,
      avgCostPerConversion: Math.round(avgCostPerConversion * 100) / 100,
      clientsAboveBenchmark,
      clientsBelowBenchmark,
      topPerformer,
      needsAttention
    });

  } catch (error) {
    console.error('[Leadership Ads Summary] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch leadership ads summary',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
