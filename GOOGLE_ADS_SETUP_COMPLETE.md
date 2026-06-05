# Google Ads Data Layer — Ready for OAuth Token

## Summary

Built the complete Google Ads data layer and dashboard scaffolding. Everything is ready to populate the moment Kaci provides the OAuth token tomorrow.

## What's Built

### ✅ Database Layer
- **New table:** `ClientGoogleAdsSnapshot`
  - Monthly performance snapshots per client
  - Fields: impressions, clicks, spend, conversions, cost per conversion, conversion rate, impression share, active campaigns, campaign names, keywords, budget utilization
- **New field:** `ClientProfile.googleAdsCustomerId`
  - Maps each client to their Google Ads account
- **Migration ran successfully** against live database
- **Prisma client regenerated** with new models

### ✅ API Routes

**Client-specific endpoint:**
```
GET /api/clients/[acronym]/google-ads?months=6
```
Returns last 6 months of Google Ads data + summary for a single client.

**Leadership overview endpoint:**
```
GET /api/metrics/leadership-ads-summary?month=YYYY-MM
```
Aggregates across all clients:
- Total clients with ads data
- Total spend, conversions, avg cost per conversion
- Clients above/below benchmark (3% conversion rate)
- Top performer
- Clients needing attention (high spend, low conversions)

Both routes work now — return empty state gracefully when no data exists.

### ✅ Sync Script

**Location:** `scripts/sync-google-ads.mjs`

**Full skeleton ready:**
- OAuth configuration (reads from env vars)
- MCC customer list fetch (commented, ready to activate)
- Google Ads API data fetch (commented, ready to activate)
- Customer ID → ClientProfile mapping (working)
- Full upsert logic (working)
- Error handling, logging, resume-safe

**Usage:**
```bash
# Sync current month
node scripts/sync-google-ads.mjs

# Sync specific month
node scripts/sync-google-ads.mjs --month 2026-05

# Sync specific customer
node scripts/sync-google-ads.mjs --customer-id 1234567890
```

**Environment variables needed** (add to `.env.local`):
```
GOOGLE_ADS_DEVELOPER_TOKEN=...
GOOGLE_ADS_REFRESH_TOKEN=...
GOOGLE_ADS_CLIENT_ID=...
GOOGLE_ADS_CLIENT_SECRET=...
GOOGLE_ADS_MCC_CUSTOMER_ID=...  # Optional
```

## What Happens Tomorrow

1. **Kaci provides OAuth token** → Add to `.env.local`
2. **Uncomment the Google Ads API calls** in `fetchAdsData()` and `fetchMCCCustomerList()` functions (lines marked with `TODO`)
3. **Map customer IDs** to ClientProfile records (one-time: populate `googleAdsCustomerId` field for each client)
4. **Run sync:** `node scripts/sync-google-ads.mjs`
5. **Data flows** → Dashboard ready

## Testing Right Now

Even without real data, you can test:

```bash
# Returns empty state (hasData: false)
curl http://localhost:3000/api/clients/ABC/google-ads

# Returns empty state (totalClients: 0)
curl http://localhost:3000/api/metrics/leadership-ads-summary
```

See `TEST_GOOGLE_ADS_API.md` for inserting test data and full testing workflow.

## Files

### Created:
- `scripts/migrate-google-ads-schema.mjs` — DB migration
- `scripts/sync-google-ads.mjs` — Data sync
- `app/api/clients/[acronym]/google-ads/route.js` — Client API
- `app/api/metrics/leadership-ads-summary/route.js` — Leadership API
- `TEST_GOOGLE_ADS_API.md` — Testing guide
- `GOOGLE_ADS_SETUP_COMPLETE.md` — This file

### Modified:
- `prisma/schema.prisma` — Added models + field

## Architecture Notes

### Data Flow
```
Google Ads MCC
  ↓
scripts/sync-google-ads.mjs  (OAuth → fetch → map → upsert)
  ↓
ClientGoogleAdsSnapshot table
  ↓
API routes (client-specific + leadership aggregate)
  ↓
Dashboard UI (to be built)
```

### Customer ID Mapping
The sync script maps Google Ads customer IDs to ClientProfile records:
1. First tries exact match on `googleAdsCustomerId`
2. Falls back to fuzzy match (company name, etc.)
3. Logs unmapped customers for manual review

### Upsert Logic
Monthly snapshots are upserted on `(tenantId, companyAcronym, periodMonth)`:
- If exists → update
- If new → insert
- No duplicates

### Error Handling
- Missing credentials → graceful warning, skips customer
- No matching ClientProfile → logs warning, continues
- API errors → logs, marks failed, continues with remaining customers
- Resume-safe: can re-run anytime, idempotent

## Status

🟢 **Database ready**  
🟢 **Migration complete**  
🟢 **API routes working**  
🟢 **Sync script scaffolded**  
🟡 **Awaiting OAuth token**  
🟡 **Awaiting customer ID mapping**  

**No blockers. Everything is ready for auth tomorrow.**
