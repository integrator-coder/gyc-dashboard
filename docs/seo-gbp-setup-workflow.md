# SEO & GBP Location Setup Workflow

## Overview

This document outlines the correct workflow for setting up new SEO clients and their GBP locations in the dashboard. Following this workflow prevents wasted API costs on incorrect location data.

## Critical Rule

**⚠️ DO NOT run heatmap scans until GBP map links are verified.**

Heatmaps cost $0.20 per location per scan (25 grid points × 2 keywords × 2 radii × $0.002/point). Running scans on wrong coordinates wastes money and generates bad data.

## Workflow Steps

### 1. Get Official GBP Map Links

**Source:** Client or account manager provides Google Maps share links for each location.

**Format examples:**
- `https://www.google.com/maps?cid=7350299527167090935`
- `https://maps.app.goo.gl/xyz123` (redirects to cid link)

**What you need:**
- One map link per physical location
- Links must be for the client's actual GBP listing (not a competitor or similar business)

---

### 2. Extract & Verify Location Data

**Tools:** DataForSEO Maps API or manual Google Maps lookup

For each map link:
1. Extract the **CID** (Customer ID) from the URL
   - Example: `cid=7350299527167090935` → CID is `7350299527167090935`
2. Look up the business via DataForSEO to get:
   - `place_id` (format: `ChIJ...`)
   - Full address
   - Exact lat/lng coordinates
   - Business name (verify it matches the client)
3. **Double-check** the address matches what the client expects

**Example verification query:**
```javascript
const keyword = "Rocky Mountain Preschool 8100 S Quebec St Centennial";
// Search via DataForSEO Maps API
// Verify returned CID matches the map link CID
```

---

### 3. Create/Update GBPLocation Record

**Database:** `GBPLocation` table

**Required fields:**
- `clientAcronym` — client acronym (e.g., `RMP`)
- `locationName` — human-readable location name (e.g., `Centennial`, `Parker`)
- `gbpPlaceId` — **numeric CID** from step 2 (NOT the `ChIJ...` format)
- `address`, `city`, `state` — full address components
- `liveDataSnapshot` → `latitude`, `longitude` — exact coords from DataForSEO
- `seoLocationName` — maps to Local Falcon snapshot location name (if different from `locationName`)
- `locationVerified` — **MUST be `TRUE`** to enable heatmaps

**Example SQL:**
```sql
UPDATE "GBPLocation"
SET
  "gbpPlaceId" = '7350299527167090935',
  "address" = '8100 S Quebec St # B5',
  "city" = 'Centennial',
  "state" = 'Colorado',
  "liveDataSnapshot" = jsonb_set(
    jsonb_set(
      jsonb_set(COALESCE("liveDataSnapshot", '{}'), '{latitude}', '"39.5688748"'),
      '{longitude}', '"-104.9024434"'
    ),
    '{address}', '"8100 S Quebec St # B5, Centennial, CO 80112"'
  ),
  "locationVerified" = TRUE
WHERE "clientAcronym" = 'RMP' AND "locationName" = 'Centennial';
```

---

### 4. Run Initial Data Syncs

**Once locations are verified**, run these scripts:

#### a) Refresh GBP Live Data
Fetches current ratings, reviews, photos, hours:
```bash
node scripts/refresh-gbp-live-data.js <ACRONYM>
```

#### b) Sync SEO Sheet Data
Pulls Local Falcon snapshots + GBP monthly stats from Google Sheets:
```bash
node scripts/sync-seo-data.js
```
(Runs all clients — no single-client filter)

#### c) Sync DataForSEO Organic Data
Fetches organic keyword rankings and history:
```bash
node scripts/sync-dfseo-data.js
```
(Runs all active SEO clients — no single-client filter)

#### d) Run Heatmaps
**Only after steps 1-3 are complete:**
```bash
node scripts/sync-seo-heatmaps.js <ACRONYM>
```

Or with `--force` to override recency threshold:
```bash
node scripts/sync-seo-heatmaps.js <ACRONYM> --force
```

---

### 5. Verification Gate

The heatmap script now checks `locationVerified = TRUE` before scanning.

**Unverified locations will be skipped** with this message:
```
⚠️  [SEO] Centennial → "Centennial" — SKIPPED (location not verified)
    ❌ GBP map link must be confirmed before running heatmaps.
    Set locationVerified=TRUE in GBPLocation table to enable.
```

To verify a location:
```sql
UPDATE "GBPLocation"
SET "locationVerified" = TRUE
WHERE "clientAcronym" = 'RMP' AND "locationName" = 'Centennial';
```

---

## Cost Breakdown

| Task | Cost per Client | Frequency |
|------|----------------|-----------|
| GBP live refresh | $0.002 per location | Weekly |
| SEO sheet sync | Free (Google Sheets API) | Weekly |
| DataForSEO organic | $0.02–0.15 per domain | Monthly |
| Heatmaps | $0.20 per location | Weekly (SEO) / Monthly (Prospect) |

**Example:** 2-location SEO client → ~$0.40/week heatmaps + ~$0.004/week GBP refresh + ~$0.10/month organic = **~$2/month**

---

## Common Mistakes

❌ **Running heatmaps before verifying map links**
- Result: Scans wrong location, wastes $0.20+ per location

❌ **Using `place_id` (ChIJ...) instead of numeric CID in `gbpPlaceId`**
- Result: GBP live data refresh fails with "no results found"

❌ **Leaving address/city/state fields empty**
- Result: GBP refresh builds wrong search keyword, returns wrong business

❌ **Not double-checking coordinates match the address**
- Result: Heatmaps scan wrong geographic area

---

## RMP Example (Reference)

**Centennial:**
- GBP Link: `https://www.google.com/maps?cid=7350299527167090935`
- CID: `7350299527167090935`
- Place ID: `ChIJwd8-LDiEbIcR9yCE9XmCAWY`
- Address: `8100 S Quebec St # B5, Centennial, CO 80112`
- Coords: `39.5688748, -104.9024434`

**Parker:**
- GBP Link: `https://www.google.com/maps?cid=413115298089259914`
- CID: `413115298089259914`
- Place ID: `ChIJLSy8dwWPbIcRitPjwSyuuwU`
- Address: `15390 Canyon Rim Dr, Parker, CO 80134`
- Coords: `39.562945, -104.8107870`

Both locations verified and heatmaps run successfully on 2026-05-11.

---

## Troubleshooting

**"No results found" during GBP refresh:**
- Check `gbpPlaceId` is numeric CID, not `ChIJ...` format
- Verify address/city/state fields are populated
- Try manual DataForSEO search with business name + address

**Heatmap skipped with "location not verified":**
- Set `locationVerified = TRUE` in database
- Confirm map link was provided and verified in step 2

**Wrong business returned in searches:**
- Use full address in search keyword
- Verify CID from map link matches returned CID
- Check for duplicate/similar business names in same area

---

## Maintenance

- **Weekly:** Run heatmaps for active SEO clients (auto-scheduled)
- **Weekly:** Refresh GBP live data (ratings/reviews)
- **Monthly:** Sync DataForSEO organic data
- **As needed:** Sync SEO sheet data when Local Falcon reports are updated
