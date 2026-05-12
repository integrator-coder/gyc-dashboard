# GBP Time-Series Schema Design

## Problem
Need to track GBP metrics over time to show clients:
- Rating trends (month-over-month)
- Review count growth
- Photo/post activity
- Hours changes
- Response rate improvements

## Solution: Three-Table Pattern

### 1. GBPLocation (Base Record)
One row per client location. Stores static/rarely-changing data.

```prisma
model GBPLocation {
  id                Int       @id @default(autoincrement())
  clientAcronym     String    // e.g., "RMP"
  locationName      String    // e.g., "Centennial"
  
  // Google identifiers
  placeId           String    @unique  // ChIJ...
  cid               String?   // Numeric CID for Maps URL
  
  // Address
  address           String
  city              String
  state             String
  latitude          Float?
  longitude         Float?
  
  // Metadata
  createdAt         DateTime  @default(now())
  lastSyncedAt      DateTime?
  
  // Relations
  snapshots         GBPSnapshot[]
  reviews           GBPReview[]
  
  @@unique([clientAcronym, locationName])
  @@index([clientAcronym])
}
```

### 2. GBPSnapshot (Time-Series Metrics)
One row per sync per location. Stores point-in-time GBP data.

```prisma
model GBPSnapshot {
  id                Int       @id @default(autoincrement())
  locationId        Int
  snapshotDate      DateTime  @default(now())
  
  // Core GBP Metrics
  rating            Float?    // 4.7
  reviewCount       Int?      // 142
  photoCount        Int?      // 89
  postCount         Int?      // 12
  
  // Status
  businessStatus    String?   // "OPERATIONAL", "CLOSED_TEMPORARILY"
  isVerified        Boolean   @default(false)
  
  // Engagement (if available from DataForSEO/GA)
  viewCount         Int?
  searchCount       Int?
  callCount         Int?
  websiteClicks     Int?
  directionRequests Int?
  
  // Raw JSON for everything else
  rawData           Json?
  
  // Relations
  location          GBPLocation @relation(fields: [locationId], references: [id], onDelete: Cascade)
  
  @@unique([locationId, snapshotDate])
  @@index([locationId, snapshotDate(sort: Desc)])
}
```

### 3. GBPReview (Individual Reviews)
One row per review. Allows tracking new reviews, sentiment changes, response tracking.

```prisma
model GBPReview {
  id                String    @id  // Google review ID
  locationId        Int
  
  // Review content
  authorName        String
  rating            Int       // 1-5
  text              String?   @db.Text
  publishedAt       DateTime
  
  // GYC response
  ownerResponse     String?   @db.Text
  ownerRespondedAt  DateTime?
  
  // Metadata
  firstSeenAt       DateTime  @default(now())
  
  // Relations
  location          GBPLocation @relation(fields: [locationId], references: [id], onDelete: Cascade)
  
  @@index([locationId, publishedAt(sort: Desc)])
}
```

---

## Example Queries

### Rating trend (last 6 months)
```typescript
const trend = await prisma.gBPSnapshot.findMany({
  where: {
    location: { clientAcronym: 'RMP', locationName: 'Centennial' },
    snapshotDate: { gte: sixMonthsAgo }
  },
  orderBy: { snapshotDate: 'asc' },
  select: { snapshotDate: true, rating: true, reviewCount: true }
});
```

### Month-over-month comparison
```typescript
const thisMonth = await prisma.gBPSnapshot.findFirst({
  where: {
    locationId: loc.id,
    snapshotDate: { gte: startOfThisMonth, lt: startOfNextMonth }
  },
  orderBy: { snapshotDate: 'desc' }
});

const lastMonth = await prisma.gBPSnapshot.findFirst({
  where: {
    locationId: loc.id,
    snapshotDate: { gte: startOfLastMonth, lt: startOfThisMonth }
  },
  orderBy: { snapshotDate: 'desc' }
});

const change = {
  rating: thisMonth.rating - lastMonth.rating,
  reviews: thisMonth.reviewCount - lastMonth.reviewCount
};
```

### New reviews this month
```typescript
const newReviews = await prisma.gBPReview.count({
  where: {
    locationId: loc.id,
    publishedAt: { gte: startOfThisMonth }
  }
});
```

---

## Data Retention Strategy

**Snapshot Frequency:**
- **Weekly snapshots** for most clients (52/year = manageable)
- **Daily for first 30 days** when tracking active campaigns
- **Monthly archives** after 1 year (aggregate weekly → monthly)

**Storage Estimate:**
- 50 client locations × 52 snapshots/year = 2,600 rows/year
- At ~500 bytes/row (with JSON) = ~1.3 MB/year
- Totally fine for Neon free tier (10 GB)

**Pruning Logic (Future):**
```sql
-- After 1 year, keep only one snapshot per month
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

---

## Migration Path

1. **Add schema to `schema.prisma`** (copy models above)
2. **Run:** `npx prisma migrate dev --name add-gbp-time-series`
3. **Update `sync-gbp-live-data.js`:**
   - Insert new `GBPSnapshot` row on each sync (don't overwrite)
   - Upsert reviews into `GBPReview`
4. **Dashboard queries:** Use latest snapshot for current data, historical snapshots for trends

---

## Display Patterns

### Client SEO Dashboard
```typescript
// Current metrics (latest snapshot)
const current = await prisma.gBPSnapshot.findFirst({
  where: { locationId },
  orderBy: { snapshotDate: 'desc' }
});

// 6-month trend
const trend = await prisma.gBPSnapshot.findMany({
  where: {
    locationId,
    snapshotDate: { gte: sixMonthsAgo }
  },
  orderBy: { snapshotDate: 'asc' }
});

// Render as Recharts LineChart
<LineChart data={trend}>
  <Line dataKey="rating" stroke="#8884d8" />
  <Line dataKey="reviewCount" stroke="#82ca9d" />
</LineChart>
```

### Month-over-month badges
```tsx
{change.rating > 0 && (
  <Badge variant="success">
    ↑ {change.rating.toFixed(1)} rating
  </Badge>
)}
{change.reviews > 0 && (
  <Badge variant="success">
    +{change.reviews} reviews
  </Badge>
)}
```
