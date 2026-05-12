# GBP Time-Series: Storage & Querying Examples

## How Data Flows

```
New Client Onboarded
      ↓
auto-populate-gbp-location.mjs runs
      ↓
GBPLocation record created (one-time)
      ↓
Weekly cron: refresh-gbp-live-data.js
      ↓
New GBPSnapshot row inserted (every week)
      ↓
Dashboard queries snapshots for trends
```

---

## Sample Data Structure

### GBPLocation (Static/Rarely Changes)
```json
{
  "id": 1,
  "clientAcronym": "RMP",
  "locationName": "Centennial",
  "placeId": "ChIJwd8-LDiEbIcR9yCE9XmCAWY",
  "cid": "7350299527167090935",
  "address": "8100 S Quebec St, Centennial, CO 80112",
  "city": "Centennial",
  "state": "CO",
  "latitude": 39.5688748,
  "longitude": -104.9024434,
  "createdAt": "2026-05-01T10:00:00Z",
  "lastSyncedAt": "2026-05-11T02:00:00Z"
}
```

### GBPSnapshot (Time-Series)
```json
[
  {
    "id": 45,
    "locationId": 1,
    "snapshotDate": "2026-05-11T02:00:00Z",
    "rating": 4.8,
    "reviewCount": 156,
    "photoCount": 92,
    "postCount": 14,
    "businessStatus": "OPERATIONAL",
    "isVerified": true,
    "viewCount": 1247,
    "websiteClicks": 89,
    "callCount": 23,
    "rawData": { "hours": [...], "categories": [...] }
  },
  {
    "id": 44,
    "locationId": 1,
    "snapshotDate": "2026-05-04T02:00:00Z",
    "rating": 4.7,
    "reviewCount": 153,
    "photoCount": 91,
    "postCount": 14,
    ...
  },
  {
    "id": 43,
    "locationId": 1,
    "snapshotDate": "2026-04-27T02:00:00Z",
    "rating": 4.7,
    "reviewCount": 148,
    "photoCount": 89,
    "postCount": 12,
    ...
  }
]
```

### GBPReview (Individual Reviews)
```json
[
  {
    "id": "ChZDSUhNMG9nS0VJQ0FnSUNwNl93MEFRAA",
    "locationId": 1,
    "authorName": "Sarah Johnson",
    "rating": 5,
    "text": "Amazing preschool! My daughter loves it here...",
    "publishedAt": "2026-05-08T14:23:00Z",
    "ownerResponse": "Thank you Sarah! We're so glad she's enjoying...",
    "ownerRespondedAt": "2026-05-09T09:15:00Z",
    "firstSeenAt": "2026-05-11T02:00:00Z"
  },
  ...
]
```

---

## Dashboard Query Examples

### 1. Current Metrics (Latest Snapshot)
```typescript
// app/clients/[acronym]/seo/route.ts
const currentMetrics = await prisma.gBPSnapshot.findFirst({
  where: {
    location: {
      clientAcronym: params.acronym,
      locationName: 'Centennial' // or dynamic
    }
  },
  orderBy: { snapshotDate: 'desc' },
  include: {
    location: {
      select: {
        locationName: true,
        address: true,
        city: true,
        state: true
      }
    }
  }
});

// Response:
{
  rating: 4.8,
  reviewCount: 156,
  photoCount: 92,
  location: {
    locationName: "Centennial",
    address: "8100 S Quebec St...",
    ...
  }
}
```

### 2. Six-Month Rating Trend (for LineChart)
```typescript
const sixMonthsAgo = new Date();
sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

const trend = await prisma.gBPSnapshot.findMany({
  where: {
    location: {
      clientAcronym: params.acronym,
      locationName: 'Centennial'
    },
    snapshotDate: { gte: sixMonthsAgo }
  },
  orderBy: { snapshotDate: 'asc' },
  select: {
    snapshotDate: true,
    rating: true,
    reviewCount: true,
    viewCount: true
  }
});

// Use in Recharts:
<LineChart data={trend}>
  <XAxis dataKey="snapshotDate" tickFormatter={formatDate} />
  <YAxis yAxisId="left" domain={[0, 5]} />
  <YAxis yAxisId="right" orientation="right" />
  <Line yAxisId="left" dataKey="rating" stroke="#8884d8" name="Rating" />
  <Line yAxisId="right" dataKey="reviewCount" stroke="#82ca9d" name="Reviews" />
</LineChart>
```

### 3. Month-over-Month Comparison
```typescript
const now = new Date();
const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

const [thisMonth, lastMonth] = await Promise.all([
  prisma.gBPSnapshot.findFirst({
    where: {
      locationId: location.id,
      snapshotDate: { gte: startOfThisMonth }
    },
    orderBy: { snapshotDate: 'desc' }
  }),
  prisma.gBPSnapshot.findFirst({
    where: {
      locationId: location.id,
      snapshotDate: { gte: startOfLastMonth, lt: startOfThisMonth }
    },
    orderBy: { snapshotDate: 'desc' }
  })
]);

const changes = {
  rating: thisMonth.rating - lastMonth.rating,
  reviews: thisMonth.reviewCount - lastMonth.reviewCount,
  photos: thisMonth.photoCount - lastMonth.photoCount
};

// Display:
<div className="flex gap-2">
  {changes.rating > 0 && (
    <Badge variant="success">
      ↑ {changes.rating.toFixed(1)} rating
    </Badge>
  )}
  {changes.reviews > 0 && (
    <Badge variant="success">
      +{changes.reviews} new reviews
    </Badge>
  )}
</div>
```

### 4. New Reviews This Month
```typescript
const newReviews = await prisma.gBPReview.findMany({
  where: {
    locationId: location.id,
    publishedAt: { gte: startOfThisMonth }
  },
  orderBy: { publishedAt: 'desc' },
  take: 10
});

// Display:
{newReviews.map(review => (
  <ReviewCard key={review.id}>
    <p className="font-semibold">{review.authorName}</p>
    <StarRating value={review.rating} />
    <p className="text-sm text-gray-600">{review.text}</p>
    {review.ownerResponse && (
      <div className="mt-2 border-l-2 pl-3">
        <p className="text-xs font-semibold">GYC Response:</p>
        <p className="text-sm">{review.ownerResponse}</p>
      </div>
    )}
  </ReviewCard>
))}
```

### 5. Response Rate Tracking
```typescript
const stats = await prisma.gBPReview.aggregate({
  where: {
    locationId: location.id,
    publishedAt: { gte: sixMonthsAgo }
  },
  _count: { id: true },
  _sum: {
    // Count responded reviews
  }
});

const responseRate = await prisma.$queryRaw`
  SELECT 
    COUNT(*) FILTER (WHERE "ownerResponse" IS NOT NULL) * 100.0 / COUNT(*) as response_rate
  FROM "GBPReview"
  WHERE "locationId" = ${location.id}
    AND "publishedAt" >= ${sixMonthsAgo}
`;

// Display:
<MetricCard
  title="Review Response Rate"
  value={`${responseRate.toFixed(0)}%`}
  change={calculateChange(thisMonth, lastMonth)}
/>
```

---

## Sync Script Update Pattern

### Before (Overwriting liveDataSnapshot)
```javascript
// Old approach - loses history
await pool.query(`
  UPDATE "GBPLocation"
  SET "liveDataSnapshot" = $1, "lastSyncedAt" = NOW()
  WHERE "clientAcronym" = $2 AND "locationName" = $3
`, [JSON.stringify(freshData), acronym, locationName]);
```

### After (Creating New Snapshot)
```javascript
// New approach - keeps history
const location = await prisma.gBPLocation.findUnique({
  where: {
    clientAcronym_locationName: {
      clientAcronym: acronym,
      locationName: locationName
    }
  }
});

// Insert new snapshot
await prisma.gBPSnapshot.create({
  data: {
    locationId: location.id,
    snapshotDate: new Date(),
    rating: freshData.rating,
    reviewCount: freshData.review_count,
    photoCount: freshData.photos_count,
    businessStatus: freshData.business_status,
    isVerified: freshData.is_claimed,
    rawData: freshData // Store full response for reference
  }
});

// Upsert reviews
for (const review of freshData.reviews_data || []) {
  await prisma.gBPReview.upsert({
    where: { id: review.review_id },
    create: {
      id: review.review_id,
      locationId: location.id,
      authorName: review.author_name,
      rating: review.rating,
      text: review.review_text,
      publishedAt: new Date(review.published_at),
      ownerResponse: review.owner_response?.text,
      ownerRespondedAt: review.owner_response?.time 
        ? new Date(review.owner_response.time) 
        : null
    },
    update: {
      ownerResponse: review.owner_response?.text,
      ownerRespondedAt: review.owner_response?.time 
        ? new Date(review.owner_response.time) 
        : null
    }
  });
}

// Update location lastSyncedAt
await prisma.gBPLocation.update({
  where: { id: location.id },
  data: { lastSyncedAt: new Date() }
});
```

---

## Storage & Performance

### Weekly Snapshots for 50 Locations Over 1 Year
- 50 locations × 52 weeks = **2,600 snapshot rows**
- At ~500 bytes/row (with JSON) = ~**1.3 MB/year**
- After 3 years: ~**7,800 rows** (~3.9 MB)
- Totally manageable for Neon free tier (10 GB)

### Query Performance
With proper indexes:
```prisma
@@index([locationId, snapshotDate(sort: Desc)])
```
Queries like "last 6 months of snapshots for location X" are instant (index scan).

### Pruning Strategy (Optional, Year 2+)
After 1 year, keep only monthly snapshots instead of weekly:
```sql
-- Keep one snapshot per month for data older than 1 year
DELETE FROM "GBPSnapshot"
WHERE "snapshotDate" < NOW() - INTERVAL '1 year'
  AND id NOT IN (
    SELECT DISTINCT ON (DATE_TRUNC('month', "snapshotDate"), "locationId")
      id
    FROM "GBPSnapshot"
    WHERE "snapshotDate" < NOW() - INTERVAL '1 year'
    ORDER BY DATE_TRUNC('month', "snapshotDate"), "locationId", "snapshotDate" DESC
  );
```
This keeps storage lean without losing long-term trend visibility.
