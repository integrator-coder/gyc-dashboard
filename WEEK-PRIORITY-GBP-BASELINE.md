# Week Priority: GBP Baseline for All SEO Clients

**Date:** 2026-05-11  
**Goal:** Get all 113 SEO program locations auto-populated, tracked, and with baseline heatmaps by EOD Friday

---

## The Master List

**Source:** Google Sheet `1uZLqNTDWXZ3wbBU7ley-81gj8Kj4h06_Ftd2utE-pjY`  
**Contains:** 113 GBP locations across 59 clients  
**Status:** Currently seeded into dashboard (from April 30 work)

---

## This Week's Mission

### Phase 1: Foundation (Tonight + Tomorrow Morning)
**Goal:** Get schema + auto-lookup working

- [ ] Tonight: Add time-series schema (GBPLocation, GBPSnapshot, GBPReview)
- [ ] Tonight: Add DB indexes
- [ ] Tomorrow AM: Get Google Places API key
- [ ] Tomorrow AM: Build auto-populate script
- [ ] Tomorrow AM: Test auto-populate with 1-2 locations from the sheet

**Success:** Can go from "business name + address" → place_id/CID/coords → DB automatically

---

### Phase 2: Bulk Population (Tomorrow Afternoon - Wednesday)
**Goal:** Auto-populate all 113 locations with map links

**Script to build:** `bulk-populate-from-sheet.mjs`

**Process:**
1. Read Google Sheet (all 113 locations)
2. For each row:
   - Business name + address from sheet
   - Call Google Places Text Search API
   - Get place_id, CID, lat/lng
   - Insert/update GBPLocation table
   - Log success/failures
3. Generate summary report

**Batch strategy:**
- Process in batches of 25 (avoid rate limits)
- Wait 2 seconds between batches
- Save progress after each batch (resume if interrupted)

**Cost estimate:**
- 113 lookups × $0.034 = **~$3.84 total**
- Well within $200/month free credit

**Tasks:**
- [ ] Build batch script
- [ ] Test with 5 locations first
- [ ] Run full 113 locations
- [ ] Verify all got place_id/CID
- [ ] Manual review of any failures

**Success:** All 113 locations in GBPLocation table with valid place_id + CID

---

### Phase 3: First Snapshots (Wednesday - Thursday)
**Goal:** Get baseline GBP data for all 113 locations

**Process:**
1. Update `refresh-gbp-live-data.js` to use new schema
2. Run for all 113 locations (initial baseline)
3. Creates first GBPSnapshot for each location

**Data captured:**
- Rating (current)
- Review count (current)
- Photo count
- Business status
- Hours (in rawData JSON)

**DataForSEO cost:**
- 113 locations × $0.006 = **~$0.68**
- Well under $5/day limit

**Tasks:**
- [ ] Update sync script to insert snapshots (not overwrite)
- [ ] Run baseline sync for all 113 locations
- [ ] Verify snapshots created
- [ ] Review any errors/missing data

**Success:** All 113 locations have initial GBPSnapshot row with baseline metrics

---

### Phase 4: First Heatmaps (Thursday - Friday)
**Goal:** Generate baseline heatmaps for all 113 locations

**Process:**
1. Use existing `sync-seo-heatmaps.js` script
2. Run for all 113 locations
3. 8 scan combinations per location (mobile/desktop, 4 competitors)

**Cost:**
- 113 locations × $0.20 = **$22.60**
- This is a ONE-TIME baseline cost
- Future updates: weekly/bi-weekly (not daily)

**Strategy to manage cost:**
- Batch 1: Top 30 priority clients (Thursday)
- Batch 2: Next 40 clients (Friday AM)
- Batch 3: Remaining 43 (Friday PM)
- Gives us time to check results between batches

**Tasks:**
- [ ] Prioritize client list (Todd input needed)
- [ ] Run heatmap batch 1 (30 locations = $6)
- [ ] Verify heatmap data quality
- [ ] Run heatmap batch 2 (40 locations = $8)
- [ ] Run heatmap batch 3 (43 locations = $8.60)
- [ ] Generate summary report

**Success:** All 113 locations have baseline heatmap data

---

### Phase 5: Dashboard Display (Friday)
**Goal:** Show time-series and heatmap data on client dashboards

**Updates needed:**
- SEO tab: Add rating/review trend charts
- SEO tab: Display heatmap grid visualization
- SEO tab: Month-over-month comparison badges

**Tasks:**
- [ ] Add LineChart for rating trend
- [ ] Add heatmap grid component
- [ ] Test with 2-3 client dashboards
- [ ] Deploy to production

**Success:** Clients can see baseline data and trends (even if only 1 week of data initially)

---

## Weekly Schedule

### Monday Evening (Tonight)
- Schema migration
- DB indexes
- Git commit

### Tuesday
**Morning:**
- Get Google Places API key
- Build auto-populate script
- Test with 3-5 locations

**Afternoon:**
- Build bulk populate script
- Test batch processing
- Start populating all 113 locations

### Wednesday
**Morning:**
- Finish bulk population (if not done)
- Verify all 113 have place_id/CID

**Afternoon:**
- Update sync script for snapshots
- Run baseline GBP data sync (all 113)
- Verify snapshot data quality

### Thursday
**Morning:**
- Heatmap batch 1 (top 30 clients)
- Review heatmap results

**Afternoon:**
- Heatmap batch 2 (next 40 clients)

### Friday
**Morning:**
- Heatmap batch 3 (final 43 clients)
- Verify all heatmaps generated

**Afternoon:**
- Dashboard UI updates (trend charts, heatmap display)
- Deploy to production
- Generate completion report

---

## Cost Summary (One-Time Baseline)

| Item | Quantity | Unit Cost | Total |
|------|----------|-----------|-------|
| Place lookups (Google) | 113 | $0.034 | $3.84 |
| GBP data sync (DataForSEO) | 113 | $0.006 | $0.68 |
| Heatmaps (Local Falcon) | 113 | $0.20 | $22.60 |
| **TOTAL** | | | **$27.12** |

**Ongoing monthly cost:**
- GBP refreshes: Weekly × 113 = ~$3/month
- Heatmap updates: Bi-weekly × 113 = ~$18/month
- **Total recurring: ~$21/month**

---

## Success Criteria (EOD Friday)

- [ ] All 113 SEO locations in GBPLocation table
- [ ] All have valid place_id + CID (automated lookup)
- [ ] All have baseline GBPSnapshot (rating, reviews, photos)
- [ ] All have baseline heatmap data (8 scan combinations)
- [ ] Time-series schema live and working
- [ ] Client dashboards display trends + heatmaps
- [ ] Total spend: <$30 for baseline setup

---

## Priority Client List (For Heatmap Batching)

**Need Todd's input:**
- Which 30 clients are highest priority for Thursday batch?
- Any clients we should skip/defer to next week?

**Potential criteria:**
- Active paid campaigns
- New clients (onboarded in last 3 months)
- Clients with performance issues
- Clients Bruce is watching

---

## Blockers & Dependencies

| What | Blocked By | ETA |
|------|------------|-----|
| Auto-populate script | Google API key | Tue AM |
| Bulk population | Auto-populate script | Tue PM |
| Baseline snapshots | Schema migration | Wed AM |
| Heatmaps | Place IDs populated | Thu AM |
| Dashboard display | Snapshot data | Fri AM |

---

## Rollback Plan

If anything breaks:
1. Schema is additive (won't break existing dashboard)
2. Can pause heatmap generation mid-batch
3. Old sync script still works until we update it
4. Git commits at each phase for easy revert

---

## Next Steps After This Week

**Week 2:**
- Add Redis caching (performance)
- Build dashboard UI for adding NEW locations
- GHL integration (Travis)
- n8n setup for automation

**But this week:** Focus 100% on getting the 113 existing SEO locations fully tracked with baseline data.
