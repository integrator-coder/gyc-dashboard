# Tonight's Implementation Tasks (Phase 1 Start)

**Date:** 2026-05-11 Evening  
**Goal:** Get schema migration + DB indexes done tonight, rest of Phase 1 tomorrow morning  
**Time Estimate:** 1-2 hours

---

## Pre-Flight (5 min)

- [ ] Commit current dashboard state to git
  ```bash
  cd ~/gyc-dashboard
  git add .
  git commit -m "Pre-optimization checkpoint"
  ```

- [ ] Backup current database (just in case)
  ```bash
  # Neon has auto-backups, but document current schema
  npx prisma db pull --print > schema-backup-2026-05-11.prisma
  ```

---

## Task 1: Add Time-Series Schema (30 min)

**Steps:**

1. **Open schema file:**
   ```bash
   code ~/gyc-dashboard/prisma/schema.prisma
   ```

2. **Add three new models at the end:**
   - Copy from: `~/gyc-dashboard/prisma/schema-additions-gbp.prisma`
   - Models: `GBPLocation`, `GBPSnapshot`, `GBPReview`

3. **Run migration:**
   ```bash
   cd ~/gyc-dashboard
   npx prisma migrate dev --name add-gbp-time-series
   ```

4. **Regenerate Prisma client:**
   ```bash
   npx prisma generate
   ```

5. **Verify:**
   ```bash
   # Check tables created
   npx prisma studio
   # Look for: GBPLocation, GBPSnapshot, GBPReview
   ```

**Success check:**
- [ ] Migration completed without errors
- [ ] New tables visible in Prisma Studio
- [ ] No breaking changes to existing tables

---

## Task 2: Add Database Indexes (15 min)

**Steps:**

1. **Create SQL file:**
   ```bash
   touch ~/gyc-dashboard/prisma/migrations/add-gbp-indexes.sql
   ```

2. **Add indexes:**
   ```sql
   -- GBP location lookups (used on every SEO page load)
   CREATE INDEX IF NOT EXISTS idx_gbplocation_acronym 
     ON "GBPLocation" ("clientAcronym");

   -- Snapshot range queries (critical for trend charts)
   CREATE INDEX IF NOT EXISTS idx_gbpsnapshot_location_date 
     ON "GBPSnapshot" ("locationId", "snapshotDate" DESC);

   -- Review lookups by location
   CREATE INDEX IF NOT EXISTS idx_gbpreview_location_date 
     ON "GBPReview" ("locationId", "publishedAt" DESC);
   ```

3. **Run SQL:**
   ```bash
   # Get DB connection string
   cat ~/gyc-dashboard/.env.local | grep DATABASE_URL
   
   # Connect with psql and run the SQL
   psql [connection_string] < prisma/migrations/add-gbp-indexes.sql
   ```

4. **Verify:**
   ```sql
   -- In psql:
   \d+ "GBPSnapshot"
   -- Should see indexes listed
   ```

**Success check:**
- [ ] All 3 indexes created
- [ ] No errors in index creation

---

## Checkpoint Before Bed

**Completed tonight:**
- [x] Schema migration (GBPLocation, GBPSnapshot, GBPReview)
- [x] Database indexes for performance

**Tomorrow morning (first thing):**
- [ ] Fix DataForSEO throttling (Task 3)
- [ ] Add Redis caching (Task 4)
- [ ] Update sync script to use snapshots (Task 5)

**Git commit before bed:**
```bash
git add .
git commit -m "Add GBP time-series schema + indexes (Phase 1 partial)"
git push
```

---

## If Something Breaks

**Rollback migration:**
```bash
npx prisma migrate resolve --rolled-back [migration_name]
npx prisma migrate reset  # Nuclear option - rebuilds entire DB
```

**Check migration status:**
```bash
npx prisma migrate status
```

**Restore from backup (if needed):**
Neon has point-in-time restore in dashboard: https://console.neon.tech

---

## Tomorrow Morning Checklist

When you wake up, these should be ✅:
- [ ] GBPLocation table exists
- [ ] GBPSnapshot table exists
- [ ] GBPReview table exists
- [ ] Indexes created
- [ ] No errors in dashboard (existing pages still work)
- [ ] Git committed and pushed

Then start Phase 1 Tasks 3-5 (DataForSEO fix, caching, snapshot sync).

---

## After Schema Migration (Optional Tonight, Required Tuesday AM)

### Understand the Source Data

**Google Sheet:** `1tjFrAJwR-SkWWYCX0nsfzT-7QUwGUKY5NxTiTil-oZ8`  
**Contains:** 113 GBP locations across 59 SEO clients

**Before building bulk-populate script tomorrow, review:**
- What columns does it have? (Client name, business name, address, city, state, etc.)
- Is data clean or does it need normalization?
- Any missing addresses or bad data?

**Quick check:**
```javascript
// scripts/inspect-seo-sheet.mjs
const { google } = require('googleapis');
const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_KEY,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
});
const sheets = google.sheets({ version: 'v4', auth });

const res = await sheets.spreadsheets.values.get({
  spreadsheetId: '1tjFrAJwR-SkWWYCX0nsfzT-7QUwGUKY5NxTiTil-oZ8',
  range: 'A1:Z10' // First 10 rows to see structure
});

console.log(res.data.values);
```

This helps plan the bulk-populate script structure for tomorrow.
