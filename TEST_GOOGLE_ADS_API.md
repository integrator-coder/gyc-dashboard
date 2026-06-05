# Google Ads API Testing Guide

## What Was Built

### 1. Database Schema ✅
- **New Table:** `ClientGoogleAdsSnapshot`
  - Stores monthly Google Ads performance data per client
  - Fields: impressions, clicks, spend, conversions, cost per conversion, conversion rate, impression share, active campaigns, campaign names, top keywords, budget utilization
  - Unique constraint on (tenantId, companyAcronym, periodMonth)
  - Indexed on acronym, periodMonth, tenantId

- **ClientProfile Field:** `googleAdsCustomerId`
  - Maps each client to their Google Ads customer ID
  - Indexed for fast lookups

### 2. API Routes ✅

#### `/api/clients/[acronym]/google-ads`
Returns Google Ads data for a specific client.

**Example request:**
```bash
curl http://localhost:3000/api/clients/[acronym]/google-ads?months=6
```

**Response format:**
```json
{
  "acronym": "ABC",
  "hasData": true,
  "monthlyData": [
    {
      "periodMonth": "2026-06",
      "impressions": 12500,
      "clicks": 450,
      "spend": 1250.00,
      "conversions": 25.5,
      "costPerConversion": 49.02,
      "conversionRate": 0.0567,
      "impressionShare": 0.7234,
      "activeCampaigns": 3,
      "budgetUtilization": 0.8342
    }
  ],
  "summary": {
    "periodMonth": "2026-06",
    "impressions": 12500,
    "clicks": 450,
    "spend": 1250.00,
    "conversions": 25.5,
    "costPerConversion": 49.02,
    "conversionRate": 0.0567,
    "impressionShare": 0.7234,
    "activeCampaigns": 3,
    "campaignNames": ["Campaign A", "Campaign B", "Campaign C"],
    "topKeywords": ["daycare near me", "preschool"],
    "budgetUtilization": 0.8342,
    "syncedAt": "2026-06-03T18:54:00.000Z"
  }
}
```

If no data exists, returns:
```json
{
  "acronym": "ABC",
  "hasData": false,
  "message": "No Google Ads data available yet",
  "monthlyData": [],
  "summary": null
}
```

#### `/api/metrics/leadership-ads-summary`
Aggregates Google Ads performance across all clients.

**Example request:**
```bash
curl http://localhost:3000/api/metrics/leadership-ads-summary?month=2026-06
```

**Response format:**
```json
{
  "month": "2026-06",
  "hasData": true,
  "totalClients": 45,
  "totalSpend": 52750.50,
  "totalConversions": 1023.5,
  "avgCostPerConversion": 51.54,
  "clientsAboveBenchmark": 28,
  "clientsBelowBenchmark": 17,
  "topPerformer": {
    "acronym": "ABC",
    "conversions": 85.2,
    "costPerConversion": 38.45,
    "spend": 3275.00
  },
  "needsAttention": [
    {
      "acronym": "XYZ",
      "spend": 2500.00,
      "conversions": 8.5,
      "conversionRate": 0.0135
    }
  ]
}
```

**Benchmark:** 3% conversion rate (0.03)
- `clientsAboveBenchmark`: clients with conversion rate > 3%
- `clientsBelowBenchmark`: clients with conversion rate ≤ 3%
- `needsAttention`: clients spending >$500/month with conversion rate <2%

### 3. Sync Script ✅

**Location:** `scripts/sync-google-ads.mjs`

**Purpose:** Fetches Google Ads data from MCC account and populates ClientGoogleAdsSnapshot.

**Usage:**
```bash
# Sync current month for all clients
node scripts/sync-google-ads.mjs

# Sync specific month
node scripts/sync-google-ads.mjs --month 2026-05

# Sync specific customer
node scripts/sync-google-ads.mjs --customer-id 1234567890
```

**Environment variables required:**
```
GOOGLE_ADS_DEVELOPER_TOKEN=...
GOOGLE_ADS_REFRESH_TOKEN=...
GOOGLE_ADS_CLIENT_ID=...
GOOGLE_ADS_CLIENT_SECRET=...
GOOGLE_ADS_MCC_CUSTOMER_ID=...  # Optional, for MCC account
```

**Status:** 🚧 **Skeleton ready — awaiting OAuth token from Kaci**

The script is fully scaffolded with:
- OAuth configuration placeholders
- MCC customer list fetch (commented out, ready to activate)
- Google Ads API data fetch (commented out, ready to activate)
- Full upsert logic (working)
- Customer ID → ClientProfile mapping (working)
- Error handling and logging (working)

When the OAuth token arrives, simply:
1. Add credentials to `.env.local`
2. Uncomment the Google Ads API calls in `fetchAdsData()` and `fetchMCCCustomerList()`
3. Run the script

## Testing the Current Setup (Without Real Data)

### Test 1: Verify API Routes Handle Empty State
```bash
# Should return hasData: false
curl http://localhost:3000/api/clients/ABC/google-ads

# Should return hasData: false, totalClients: 0
curl http://localhost:3000/api/metrics/leadership-ads-summary
```

### Test 2: Insert Test Data
```bash
node -e "
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

await prisma.clientGoogleAdsSnapshot.create({
  data: {
    tenantId: 'gyc',
    companyAcronym: 'TEST',
    periodMonth: '2026-06',
    impressions: 10000,
    clicks: 350,
    spend: 1000.00,
    conversions: 25.0,
    costPerConversion: 40.00,
    conversionRate: 0.0714,
    impressionShare: 0.65,
    activeCampaigns: 2,
    campaignNames: ['Test Campaign A', 'Test Campaign B'],
    topKeywords: ['test keyword'],
    budgetUtilization: 0.80,
    dataSource: 'test'
  }
});

console.log('✅ Test data inserted');
await prisma.\$disconnect();
"
```

### Test 3: Verify API Returns Data
```bash
# Should now return hasData: true
curl http://localhost:3000/api/clients/TEST/google-ads

# Should show totalClients: 1
curl http://localhost:3000/api/metrics/leadership-ads-summary?month=2026-06
```

### Test 4: Run Sync Script (Dry Run)
```bash
# Won't fetch real data without credentials, but tests the logic
node scripts/sync-google-ads.mjs
```

## Next Steps

1. **Kaci provides OAuth token** → Add to `.env.local`
2. **Uncomment API calls** in `sync-google-ads.mjs`
3. **Map customer IDs** to ClientProfile records (populate `googleAdsCustomerId`)
4. **Run sync** → `node scripts/sync-google-ads.mjs`
5. **Build dashboard UI** to display the data
6. **Schedule cron** → Daily/weekly sync

## Files Created/Modified

### Created:
- `scripts/migrate-google-ads-schema.mjs` — Migration script
- `scripts/sync-google-ads.mjs` — Data sync script
- `app/api/clients/[acronym]/google-ads/route.js` — Client-specific API
- `app/api/metrics/leadership-ads-summary/route.js` — Leadership overview API

### Modified:
- `prisma/schema.prisma` — Added ClientGoogleAdsSnapshot model + googleAdsCustomerId field

### Database:
- Created table: `ClientGoogleAdsSnapshot`
- Added column: `ClientProfile.googleAdsCustomerId`
- Created indexes: CGAS_acronym_idx, CGAS_period_idx, CGAS_tenant_idx, CP_googleAdsCustomerId_idx

## Ready State

✅ Database schema ready  
✅ Migration ran successfully  
✅ API routes functional (empty state)  
✅ Sync script scaffolded  
🚧 Awaiting OAuth credentials  
🚧 Awaiting customer ID mapping  

**Everything is ready to populate the moment auth arrives.**
