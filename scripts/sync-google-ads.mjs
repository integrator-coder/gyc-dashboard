#!/usr/bin/env node
/**
 * Google Ads Sync Script
 * Fetches Google Ads data from MCC account and populates ClientGoogleAdsSnapshot
 * 
 * Prerequisites:
 *   - GOOGLE_ADS_DEVELOPER_TOKEN in .env.local
 *   - GOOGLE_ADS_REFRESH_TOKEN in .env.local
 *   - GOOGLE_ADS_CLIENT_ID in .env.local
 *   - GOOGLE_ADS_CLIENT_SECRET in .env.local
 *   - GOOGLE_ADS_MCC_CUSTOMER_ID in .env.local (optional, if using MCC)
 * 
 * Usage:
 *   node scripts/sync-google-ads.mjs [--month YYYY-MM] [--customer-id 1234567890]
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const prisma = new PrismaClient();

// ============================================================================
// CONFIGURATION
// ============================================================================

const GOOGLE_ADS_DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
const GOOGLE_ADS_REFRESH_TOKEN = process.env.GOOGLE_ADS_REFRESH_TOKEN;
const GOOGLE_ADS_CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID;
const GOOGLE_ADS_CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;
const GOOGLE_ADS_MCC_CUSTOMER_ID = process.env.GOOGLE_ADS_MCC_CUSTOMER_ID;

// ============================================================================
// GOOGLE ADS API CLIENT PLACEHOLDER
// ============================================================================

/**
 * Fetch Google Ads data for a customer account
 * @param {string} customerId - Google Ads customer ID (no dashes)
 * @param {object} dateRange - { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
 * @returns {Promise<object>} Ads data object
 * 
 * TODO: Implement actual Google Ads API call using google-ads-api npm package
 * This is a placeholder that returns null until OAuth token is available
 */
async function fetchAdsData(customerId, dateRange) {
  // Verify credentials exist
  if (!GOOGLE_ADS_DEVELOPER_TOKEN || !GOOGLE_ADS_REFRESH_TOKEN) {
    console.warn(`⚠️  Missing Google Ads credentials for customer ${customerId}`);
    return null;
  }

  // TODO: Implement Google Ads API call
  // Example implementation:
  /*
  const { GoogleAdsApi } = await import('google-ads-api');
  
  const client = new GoogleAdsApi({
    client_id: GOOGLE_ADS_CLIENT_ID,
    client_secret: GOOGLE_ADS_CLIENT_SECRET,
    developer_token: GOOGLE_ADS_DEVELOPER_TOKEN,
  });

  const customer = client.Customer({
    customer_id: customerId,
    refresh_token: GOOGLE_ADS_REFRESH_TOKEN,
  });

  const query = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value,
      metrics.search_impression_share,
      segments.date
    FROM campaign
    WHERE segments.date BETWEEN '${dateRange.start}' AND '${dateRange.end}'
      AND campaign.status = 'ENABLED'
  `;

  const campaigns = await customer.query(query);
  
  // Aggregate metrics
  let totalImpressions = 0;
  let totalClicks = 0;
  let totalSpendMicros = 0;
  let totalConversions = 0;
  let impressionShareSum = 0;
  let impressionShareCount = 0;
  const activeCampaignNames = new Set();
  const keywords = new Set(); // Would need separate query for keywords

  for (const row of campaigns) {
    totalImpressions += row.metrics.impressions || 0;
    totalClicks += row.metrics.clicks || 0;
    totalSpendMicros += row.metrics.cost_micros || 0;
    totalConversions += row.metrics.conversions || 0;
    
    if (row.metrics.search_impression_share) {
      impressionShareSum += row.metrics.search_impression_share;
      impressionShareCount++;
    }
    
    if (row.campaign.status === 'ENABLED') {
      activeCampaignNames.add(row.campaign.name);
    }
  }

  const totalSpend = totalSpendMicros / 1000000; // Convert micros to dollars
  const costPerConversion = totalConversions > 0 ? totalSpend / totalConversions : 0;
  const conversionRate = totalClicks > 0 ? totalConversions / totalClicks : 0;
  const avgImpressionShare = impressionShareCount > 0 ? impressionShareSum / impressionShareCount : 0;

  return {
    impressions: totalImpressions,
    clicks: totalClicks,
    spend: totalSpend,
    conversions: totalConversions,
    costPerConversion,
    conversionRate,
    impressionShare: avgImpressionShare,
    activeCampaigns: activeCampaignNames.size,
    campaignNames: Array.from(activeCampaignNames),
    topKeywords: [], // Would populate from separate query
    budgetUtilization: 0 // Would calculate if budget data available
  };
  */

  console.log(`📊 [PLACEHOLDER] Would fetch ads data for customer ${customerId} (${dateRange.start} to ${dateRange.end})`);
  return null;
}

/**
 * Fetch list of all customer accounts under MCC
 * @returns {Promise<string[]>} Array of customer IDs
 * 
 * TODO: Implement MCC customer list fetch
 */
async function fetchMCCCustomerList() {
  if (!GOOGLE_ADS_MCC_CUSTOMER_ID) {
    console.warn('⚠️  No MCC customer ID configured, skipping MCC fetch');
    return [];
  }

  // TODO: Implement MCC account fetch
  /*
  const { GoogleAdsApi } = await import('google-ads-api');
  
  const client = new GoogleAdsApi({
    client_id: GOOGLE_ADS_CLIENT_ID,
    client_secret: GOOGLE_ADS_CLIENT_SECRET,
    developer_token: GOOGLE_ADS_DEVELOPER_TOKEN,
  });

  const mcc = client.Customer({
    customer_id: GOOGLE_ADS_MCC_CUSTOMER_ID,
    refresh_token: GOOGLE_ADS_REFRESH_TOKEN,
  });

  const query = `
    SELECT
      customer_client.id,
      customer_client.descriptive_name,
      customer_client.manager
    FROM customer_client
    WHERE customer_client.status = 'ENABLED'
      AND customer_client.manager = FALSE
  `;

  const customers = await mcc.query(query);
  return customers.map(c => c.customer_client.id.toString());
  */

  console.log('📋 [PLACEHOLDER] Would fetch MCC customer list');
  return [];
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

/**
 * Map Google Ads customer ID to ClientProfile by acronym
 * @param {string} customerId - Google Ads customer ID
 * @returns {Promise<object|null>} ClientProfile or null
 */
async function findClientByCustomerId(customerId) {
  // First try exact match on googleAdsCustomerId
  let client = await prisma.clientProfile.findFirst({
    where: {
      googleAdsCustomerId: customerId,
      tenantId: 'gyc'
    }
  });

  if (client) return client;

  // TODO: Implement fuzzy matching logic
  // Could match by company name from Google Ads account name
  
  return null;
}

/**
 * Upsert Google Ads snapshot for a client
 */
async function upsertAdsSnapshot(data) {
  const {
    clientId,
    companyAcronym,
    customerId,
    periodMonth,
    adsData
  } = data;

  if (!adsData) {
    console.log(`  ⏭️  Skipping ${companyAcronym} - no ads data available`);
    return null;
  }

  try {
    const snapshot = await prisma.clientGoogleAdsSnapshot.upsert({
      where: {
        tenantId_companyAcronym_periodMonth: {
          tenantId: 'gyc',
          companyAcronym,
          periodMonth
        }
      },
      update: {
        customerId,
        impressions: adsData.impressions,
        clicks: adsData.clicks,
        spend: adsData.spend,
        conversions: adsData.conversions,
        costPerConversion: adsData.costPerConversion,
        conversionRate: adsData.conversionRate,
        impressionShare: adsData.impressionShare,
        activeCampaigns: adsData.activeCampaigns,
        campaignNames: adsData.campaignNames,
        topKeywords: adsData.topKeywords || [],
        budgetUtilization: adsData.budgetUtilization || 0,
        syncedAt: new Date(),
        dataSource: 'google-ads-api'
      },
      create: {
        tenantId: 'gyc',
        clientId,
        companyAcronym,
        customerId,
        periodMonth,
        impressions: adsData.impressions,
        clicks: adsData.clicks,
        spend: adsData.spend,
        conversions: adsData.conversions,
        costPerConversion: adsData.costPerConversion,
        conversionRate: adsData.conversionRate,
        impressionShare: adsData.impressionShare,
        activeCampaigns: adsData.activeCampaigns,
        campaignNames: adsData.campaignNames,
        topKeywords: adsData.topKeywords || [],
        budgetUtilization: adsData.budgetUtilization || 0,
        dataSource: 'google-ads-api'
      }
    });

    console.log(`  ✅ Upserted ${companyAcronym} for ${periodMonth}`);
    return snapshot;
  } catch (error) {
    console.error(`  ❌ Failed to upsert ${companyAcronym}:`, error.message);
    return null;
  }
}

// ============================================================================
// SYNC LOGIC
// ============================================================================

async function syncGoogleAds(options = {}) {
  const {
    month = new Date().toISOString().slice(0, 7), // Default to current month
    customerId = null // Optional: sync specific customer only
  } = options;

  console.log('🚀 Starting Google Ads sync...');
  console.log(`   Month: ${month}`);
  if (customerId) console.log(`   Customer ID: ${customerId}`);

  // Verify credentials
  if (!GOOGLE_ADS_DEVELOPER_TOKEN || !GOOGLE_ADS_REFRESH_TOKEN) {
    console.error('❌ Missing Google Ads credentials. Set environment variables:');
    console.error('   - GOOGLE_ADS_DEVELOPER_TOKEN');
    console.error('   - GOOGLE_ADS_REFRESH_TOKEN');
    console.error('   - GOOGLE_ADS_CLIENT_ID');
    console.error('   - GOOGLE_ADS_CLIENT_SECRET');
    process.exit(1);
  }

  // Calculate date range for the month
  const [year, monthNum] = month.split('-');
  const startDate = `${year}-${monthNum}-01`;
  const lastDay = new Date(year, monthNum, 0).getDate();
  const endDate = `${year}-${monthNum}-${lastDay}`;
  const dateRange = { start: startDate, end: endDate };

  console.log(`   Date range: ${startDate} to ${endDate}`);

  let customerIds = [];

  if (customerId) {
    // Sync specific customer
    customerIds = [customerId];
  } else {
    // Fetch all customers from MCC or database
    console.log('\n📋 Fetching customer list...');
    
    // Try MCC first
    const mccCustomers = await fetchMCCCustomerList();
    
    if (mccCustomers.length > 0) {
      customerIds = mccCustomers;
      console.log(`   Found ${customerIds.length} customers in MCC`);
    } else {
      // Fallback: use customers already in database
      const clients = await prisma.clientProfile.findMany({
        where: {
          googleAdsCustomerId: { not: null },
          tenantId: 'gyc'
        },
        select: {
          googleAdsCustomerId: true
        }
      });
      customerIds = clients.map(c => c.googleAdsCustomerId).filter(Boolean);
      console.log(`   Found ${customerIds.length} customers in database`);
    }
  }

  if (customerIds.length === 0) {
    console.log('\n⚠️  No customers to sync');
    return { synced: 0, failed: 0 };
  }

  // Sync each customer
  console.log(`\n📊 Syncing ${customerIds.length} customer(s)...`);
  
  let synced = 0;
  let failed = 0;

  for (const custId of customerIds) {
    console.log(`\n🔄 Processing customer ${custId}...`);

    // Find matching ClientProfile
    const client = await findClientByCustomerId(custId);
    
    if (!client) {
      console.log(`  ⚠️  No matching ClientProfile found for customer ${custId}`);
      failed++;
      continue;
    }

    console.log(`  📌 Matched to: ${client.acronym} (${client.companyName})`);

    // Fetch ads data
    const adsData = await fetchAdsData(custId, dateRange);

    // Upsert snapshot
    const result = await upsertAdsSnapshot({
      clientId: client.id,
      companyAcronym: client.acronym,
      customerId: custId,
      periodMonth: month,
      adsData
    });

    if (result) {
      synced++;
    } else {
      failed++;
    }
  }

  console.log('\n✅ Sync complete!');
  console.log(`   Synced: ${synced}`);
  console.log(`   Failed: ${failed}`);

  return { synced, failed };
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--month' && args[i + 1]) {
      options.month = args[i + 1];
      i++;
    } else if (args[i] === '--customer-id' && args[i + 1]) {
      options.customerId = args[i + 1];
      i++;
    }
  }

  try {
    await syncGoogleAds(options);
  } catch (error) {
    console.error('\n❌ Sync failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then(() => {
      console.log('\n👋 Done');
      process.exit(0);
    })
    .catch(err => {
      console.error('\n💥 Fatal error:', err);
      process.exit(1);
    });
}

export { syncGoogleAds, fetchAdsData, findClientByCustomerId };
