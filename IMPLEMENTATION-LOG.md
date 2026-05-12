# Dashboard Optimization Implementation Log

**Start Date:** 2026-05-11  
**Goal:** Automate GBP data population, fix DataForSEO limits, add time-series tracking  
**Target:** Phase 1 complete by EOD 2026-05-12, Phase 2 start 2026-05-12 afternoon

---

## Phase 1: Quick Wins (Tonight + Tomorrow Morning - 4-6 hours)

### ✅ Pre-Flight Checklist
- [ ] Google Maps Platform API key obtained
- [ ] Upstash Redis account created (free tier)
- [ ] Review current DataForSEO usage/limit status

### 🔧 Tasks

#### 1. Add Time-Series Schema (30 min)
**File:** `prisma/schema.prisma`

**Action:**
```bash
# Copy models from schema-additions-gbp.prisma into schema.prisma
# Then:
cd ~/gyc-dashboard
npx prisma migrate dev --name add-gbp-time-series
npx prisma generate
```

**Validation:**
- [ ] Migration runs successfully
- [ ] New tables created: GBPLocation, GBPSnapshot, GBPReview
- [ ] Prisma client regenerated

**Blocked by:** None  
**Status:** 🟡 Ready

---

#### 2. Add Database Indexes (15 min)
**File:** Create migration manually or add to schema

**SQL to run:**
```sql
-- GBP location lookups
CREATE INDEX IF NOT EXISTS idx_gbplocation_acronym 
  ON "GBPLocation" ("clientAcronym");

-- Snapshot range queries (critical for trend charts)
CREATE INDEX IF NOT EXISTS idx_gbpsnapshot_location_date 
  ON "GBPSnapshot" ("locationId", "snapshotDate" DESC);

-- Review lookups
CREATE INDEX IF NOT EXISTS idx_gbpreview_location_date 
  ON "GBPReview" ("locationId", "publishedAt" DESC);
```

**Validation:**
- [ ] Indexes created (check with `\d+ "GBPSnapshot"` in psql)
- [ ] Query plans show index usage (`EXPLAIN ANALYZE ...`)

**Blocked by:** Task 1 (schema must exist first)  
**Status:** 🟡 Ready

---

#### 3. Fix DataForSEO Throttling (45 min)
**File:** `scripts/refresh-gbp-live-data.js`

**Changes:**
1. Add staleness check before calling DataForSEO
2. Add daily spend tracker
3. Skip locations with data <7 days old

**Code snippet to add:**
```javascript
// At top of script
let dailySpend = 0;
const MAX_DAILY_SPEND = 4.80; // Leave buffer under $5

// Before each DataForSEO call
const cached = location.liveDataSnapshot;
const cachedAt = cached?.fetchedAt ? new Date(cached.fetchedAt) : null;
const hoursOld = cachedAt ? (Date.now() - cachedAt.getTime()) / 3600000 : Infinity;

if (hoursOld < 168) { // 7 days
  console.log(`↩ ${location.locationName} — cached data fresh (${Math.round(hoursOld)}h old)`);
  continue;
}

if (dailySpend >= MAX_DAILY_SPEND) {
  console.log(`⚠️  Daily spend limit reached ($${dailySpend.toFixed(2)})`);
  break;
}

// Make API call
const cost = 0.006; // Adjust based on actual DFSEO pricing
dailySpend += cost;
```

**Validation:**
- [ ] Script skips fresh data
- [ ] Script stops when approaching $5 limit
- [ ] Logs show spend tracking

**Blocked by:** None  
**Status:** 🟡 Ready

---

#### 4. Add Upstash Redis Caching (60 min)
**Files:** `lib/cache.js` (new), `app/api/finance/route.js`, `app/api/clients/[acronym]/route.js`

**Setup:**
1. Sign up at https://upstash.com (free tier)
2. Create Redis database
3. Get REST URL + token
4. Add to `.env.local`:
   ```
   UPSTASH_REDIS_URL=https://...
   UPSTASH_REDIS_TOKEN=...
   ```

**Code:**
```javascript
// lib/cache.js
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL,
  token: process.env.UPSTASH_REDIS_TOKEN,
});

export async function getCached(key, fetchFn, ttlSeconds = 3600) {
  const cached = await redis.get(key);
  if (cached) {
    console.log(`✓ Cache hit: ${key}`);
    return cached;
  }
  
  console.log(`✗ Cache miss: ${key}`);
  const fresh = await fetchFn();
  await redis.setex(key, ttlSeconds, JSON.stringify(fresh));
  return fresh;
}

export async function invalidate(pattern) {
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
    console.log(`🗑️  Invalidated ${keys.length} cache keys`);
  }
}
```

**Apply to Finance API:**
```javascript
// app/api/finance/route.js
import { getCached } from '@/lib/cache';

export async function GET() {
  const data = await getCached(
    'finance:summary',
    async () => {
      // Expensive Prisma query here
      return await prisma.$queryRaw`...`;
    },
    1800 // 30 min TTL
  );
  return Response.json(data);
}
```

**Validation:**
- [ ] Cache hits logged on second request
- [ ] Finance dashboard loads <200ms (cached)
- [ ] TTL expires and refreshes correctly

**Blocked by:** Upstash account setup  
**Status:** 🟡 Ready (needs account)

---

#### 5. Update refresh-gbp-live-data.js to Use Snapshots (60 min)
**File:** `scripts/refresh-gbp-live-data.js`

**Changes:**
1. Query `GBPLocation` instead of old table
2. Insert new `GBPSnapshot` row (don't overwrite)
3. Upsert reviews into `GBPReview`

**Pseudocode:**
```javascript
// Old approach (overwrites):
// UPDATE GBPLocation SET liveDataSnapshot = {...}

// New approach (time-series):
const location = await prisma.gBPLocation.findUnique({
  where: { clientAcronym_locationName: { clientAcronym, locationName } }
});

await prisma.gBPSnapshot.create({
  data: {
    locationId: location.id,
    snapshotDate: new Date(),
    rating: freshData.rating,
    reviewCount: freshData.review_count,
    photoCount: freshData.photos_count,
    rawData: freshData
  }
});

// Upsert reviews
for (const review of freshData.reviews_data || []) {
  await prisma.gBPReview.upsert({
    where: { id: review.review_id },
    create: { ...review },
    update: { ownerResponse: review.owner_response }
  });
}
```

**Validation:**
- [ ] New snapshot created on each run
- [ ] Old snapshots preserved
- [ ] Reviews table populated
- [ ] No errors in sync logs

**Blocked by:** Task 1 (schema must exist)  
**Status:** 🟡 Ready

---

### 📊 Phase 1 Success Criteria

- [ ] All 5 tasks completed
- [ ] No breaking changes to existing dashboard
- [ ] DataForSEO spend tracking active
- [ ] Cache hit rate >70% on Finance dashboard
- [ ] Time-series data populating for at least 1 client

**Estimated Total Time:** 4-6 hours  
**Target Completion:** 2026-05-12 12:00 PM

---

## Phase 2: GBP Auto-Lookup (Tomorrow Afternoon - 8-12 hours)

### 🔧 Tasks

#### 6. Get Google Maps Platform API Key (15 min)
**Action:**
1. Go to https://console.cloud.google.com
2. Enable "Places API (New)"
3. Create API key with Places API scope
4. Add to `.env.local`: `GOOGLE_PLACES_API_KEY=...`
5. Set up billing (gets $200/month free credit)

**Validation:**
- [ ] API key works in test request
- [ ] Free tier confirmed ($200/month credit)

**Blocked by:** None  
**Status:** 🟡 Ready

---

#### 7. Build auto-populate-gbp-location Script (2-3 hours)
**File:** `scripts/auto-populate-gbp-location.mjs` (new)

**Features:**
- Input: business name, address, city, state
- Calls Google Places Text Search API
- Gets: place_id, CID, lat/lng
- Inserts into `GBPLocation` table
- Handles errors (no results, multiple results, etc.)

**Usage:**
```bash
node scripts/auto-populate-gbp-location.mjs \
  RMP \
  "Rocky Mountain Preschool" \
  "8100 S Quebec St" \
  "Centennial" \
  "CO"
```

**Validation:**
- [ ] Successfully looks up known location
- [ ] Inserts correct place_id/CID
- [ ] Error handling works (bad address, etc.)

**Blocked by:** Task 6 (needs API key)  
**Status:** 🔴 Blocked

---

#### 8. Build Dashboard UI for Adding Locations (3-4 hours)
**File:** `app/clients/[acronym]/seo/add-location/page.tsx` (new)

**Features:**
- Form: Location Name, Business Name, Address, City, State
- "Auto-Lookup" button → calls auto-populate script via API route
- Shows preview: "Found: [Business Name] at [Address], Rating: 4.7"
- "Confirm & Save" button
- Error handling and loading states

**API Route:**
```javascript
// app/api/gbp/lookup/route.ts
export async function POST(request) {
  const { businessName, address, city, state } = await request.json();
  
  // Call Google Places API
  const place = await lookupPlace(businessName, address, city, state);
  
  return Response.json({
    placeId: place.id,
    cid: extractCID(place.url),
    displayName: place.displayName,
    formattedAddress: place.formattedAddress,
    rating: place.rating,
    reviewCount: place.userRatingCount
  });
}
```

**Validation:**
- [ ] Form submits successfully
- [ ] Preview shows correct data
- [ ] Location added to database
- [ ] Error states work (no results, API failure)

**Blocked by:** Task 7 (needs auto-populate script)  
**Status:** 🔴 Blocked

---

#### 9. Add Trend Charts to SEO Dashboard (2-3 hours)
**File:** `app/clients/[acronym]/seo/page.tsx`

**Features:**
- LineChart: Rating over last 6 months
- LineChart: Review count over last 6 months
- Month-over-month comparison badges
- New reviews feed (last 10)

**Code:**
```typescript
const trendData = await prisma.gBPSnapshot.findMany({
  where: {
    location: { clientAcronym: params.acronym },
    snapshotDate: { gte: sixMonthsAgo }
  },
  orderBy: { snapshotDate: 'asc' }
});

<LineChart data={trendData} width={600} height={300}>
  <XAxis dataKey="snapshotDate" tickFormatter={formatDate} />
  <YAxis yAxisId="left" domain={[0, 5]} />
  <YAxis yAxisId="right" orientation="right" />
  <Line yAxisId="left" dataKey="rating" stroke="#8884d8" />
  <Line yAxisId="right" dataKey="reviewCount" stroke="#82ca9d" />
  <Tooltip />
  <Legend />
</LineChart>
```

**Validation:**
- [ ] Charts render with real data
- [ ] Month-over-month badges show correct deltas
- [ ] New reviews feed populates
- [ ] No performance issues (queries optimized)

**Blocked by:** Task 5 (needs snapshot data)  
**Status:** 🔴 Blocked

---

### 📊 Phase 2 Success Criteria

- [ ] Can add new SEO locations without manual map link lookup
- [ ] Client dashboards show rating/review trends over time
- [ ] New reviews automatically populate
- [ ] End-to-end flow tested with 1 real client

**Estimated Total Time:** 8-12 hours  
**Target Completion:** 2026-05-13 EOD

---

## Phase 3: Full Pipeline Automation (Week 2+)

### Tasks (Not Yet Scheduled)

- [ ] Install n8n on Mac Mini (Docker)
- [ ] Build GHL → Dashboard sync workflow
- [ ] Automate weekly GBP refresh (n8n scheduled job)
- [ ] Add Slack alerts for sync failures
- [ ] Build new client onboarding automation

**Status:** 🔵 Planned (not started)

---

## Daily Progress Log

### 2026-05-11 (Today)
- [x] Research completed (dashboard optimization + automation)
- [x] Time-series schema designed
- [x] Implementation plan documented
- [ ] Phase 1 Task 1: Schema migration (scheduled for tonight)

### 2026-05-12 (Tomorrow)
**Morning:**
- [ ] Phase 1 Tasks 1-5 (schema, indexes, caching, DataForSEO fix)

**Afternoon:**
- [ ] Phase 2 Task 6: Google API key
- [ ] Phase 2 Task 7: Auto-populate script
- [ ] Phase 2 Task 8: Dashboard UI

### 2026-05-13
- [ ] Phase 2 Task 9: Trend charts
- [ ] End-to-end testing with RMP client
- [ ] Deploy to production

---

## Blockers & Dependencies

| Task | Blocked By | Status |
|------|------------|--------|
| 1. Schema migration | None | 🟢 Ready |
| 2. DB indexes | Task 1 | 🟡 Waiting |
| 3. DataForSEO fix | None | 🟢 Ready |
| 4. Redis caching | Upstash signup | 🟡 Waiting |
| 5. Snapshot sync | Task 1 | 🟡 Waiting |
| 6. Google API key | None | 🟢 Ready |
| 7. Auto-populate script | Task 6 | 🔴 Blocked |
| 8. Dashboard UI | Task 7 | 🔴 Blocked |
| 9. Trend charts | Task 5 | 🔴 Blocked |

---

## Notes & Decisions

**2026-05-11:**
- Decision: Use Google Places API for initial lookups ($0.034/location)
- Decision: Keep DataForSEO for live GBP data (already integrated)
- Decision: Weekly snapshots (not daily) to save storage
- Decision: Upstash Redis over local Redis (serverless, free tier)

---

## Rollback Plan

If Phase 1 breaks anything:
1. Revert Prisma migration: `npx prisma migrate resolve --rolled-back [migration_name]`
2. Remove cache layer (just delete `getCached()` calls)
3. Restore old `refresh-gbp-live-data.js` from git

Critical: **Don't delete old liveDataSnapshot JSON** until Phase 2 is stable and validated.

---

## ⚠️ PRIORITY SHIFT: GBP Baseline for All 113 SEO Locations

**Date:** 2026-05-11 Evening  
**Source:** Todd clarification - the 113 locations in Google Sheet `1tjFrAJwR-SkWWYCX0nsfzT-7QUwGUKY5NxTiTil-oZ8` are the priority

**New Goal:** Get all 113 SEO program locations auto-populated with map links, baseline snapshots, and first heatmaps by EOD Friday

**See detailed weekly plan:** `WEEK-PRIORITY-GBP-BASELINE.md`

**Modified implementation:**
- Phase 1 (schema/auto-lookup) stays the same
- Phase 2 now includes: bulk-populate script for all 113 locations from Google Sheet
- Phase 3: Baseline GBP snapshots for all 113 (Wednesday)
- Phase 4: First heatmaps for all 113 (Thursday-Friday, batched to manage $22.60 cost)
- Phase 5: Dashboard display updates (Friday)

**Week budget:**
- One-time baseline setup: ~$27 (Google lookups + GBP sync + heatmaps)
- Ongoing monthly: ~$21 (weekly GBP + bi-weekly heatmaps)

**Critical path:**
1. Tonight: Schema + indexes (enables everything else)
2. Tuesday: Auto-populate working + bulk script
3. Wednesday: All 113 locations populated with place_ids
4. Thursday-Friday: Baseline snapshots + heatmaps
5. Friday: Dashboard display

**Success metric:** All 59 SEO clients can see their GBP trends + heatmaps by EOD Friday
