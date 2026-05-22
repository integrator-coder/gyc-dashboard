# Overlay Test Tab Implementation

**Status:** ✅ Complete and deployed  
**Client:** CTI (Eastside Preschool)  
**Date:** May 20, 2026

## Summary

Built a three-layer market intelligence visualization for CTI that overlays:
1. **SEO Rankings** (where do we rank in each area)
2. **Median Household Income** (where does the money live)
3. **Theoretical Parent Origin** (where are parents likely coming from)

The insight this creates: **If we rank poorly in a high-income ZIP near the school, that's a gap to fix.**

## Architecture

### API Endpoint
**File:** `app/api/clients/[acronym]/overlay-test/route.js`

Returns three data arrays:
- `seoPoints` - Grid points from ClientSEOHeatmap table with rank data
- `incomeZips` - ZIP zones with median household income from ClientMarketIntelligence
- `parentOriginZones` - Theoretical parent distribution using distance-decay model

**Current Data (CTI):**
- 25 SEO grid points (22 ranked, 3 unranked)
- 5 income zones ($50K - $115K range)
- 5 parent origin zones (100 total theoretical parents)

### React Component
**File:** `components/OverlayTestTab.js`

Interactive Leaflet map with:
- Toggle controls for each layer
- Color-coded visualizations:
  - SEO: Green (rank 1-3) → Red (rank 16-20)
  - Income: Light purple (low) → Deep purple (high)
  - Parent Origin: Light blue (few) → Deep blue (many)
- Interactive tooltips on hover
- Legend explaining each layer

### Integration
**File:** `components/ClientCard.js`

- Added tab to `ALL_TABS` array (visible only for CTI)
- Imported `OverlayTestTab` component
- Added rendering logic in tab content section

## Three Layers Explained

### Layer 1: SEO Rankings
- **Source:** ClientSEOHeatmap table (existing)
- **Visualization:** 400m circles colored by search rank
- **Colors:** Green (excellent) → Yellow → Orange → Red (weak) → Gray (unranked)
- **Purpose:** Shows where we have SEO visibility in the market

### Layer 2: Median Household Income (by ZIP)
- **Source:** ClientMarketIntelligence table (existing)
- **Visualization:** ~800m circles (ZIP zone approximation) colored by income
- **Colors:** Light purple (lower income) → Deep purple (higher income)
- **Purpose:** Shows where the money lives in the market

### Layer 3: Theoretical Parent Origin
- **Source:** Synthetic/calculated (distance-decay model)
- **Model:** `weight = 1 / (distance^2)`, normalized to 100 parents
- **Visualization:** ~800m circles colored by parent density
- **Colors:** Light blue (few parents) → Deep blue (many parents)
- **Purpose:** Shows likely parent distribution based purely on distance from school

**Important:** Parent origin layer is theoretical/synthetic - not based on competitor data or real enrollment data. It's a plausible model to compare against SEO coverage.

## Key Technical Decisions

1. **CTI-only visibility:** Tab shows `show: acronym === 'CTI'` in ALL_TABS
   - Can be expanded to other clients once we have their data

2. **Distance-decay model:** Uses simple `1/distance²` for parent origin
   - Could be enhanced with demographic weights later
   - Currently distance-only for simplicity

3. **Consistent circle radii:** Income and parent origin use same 800m radius
   - Easier to compare layers visually
   - SEO grid uses 400m (existing standard)

4. **Gradient colors vs. bubbles:** Income and parent origin use color gradients
   - More intuitive than bubble sizes
   - Easier to spot patterns at a glance

## Testing

**API Endpoint:**
```bash
curl http://localhost:3000/api/clients/CTI/overlay-test
```

**Expected Response:**
- `seoPoints`: Array of 25 grid points
- `incomeZips`: Array of 5 ZIP zones with income data
- `parentOriginZones`: Array of 5 zones with parent counts (sum = 100)
- `center`: { lat, lng } for Eastside Preschool
- `locationName`: "Eastside Preschool"

**Browser Testing:**
1. Navigate to CTI client card: `http://localhost:3000/clients/CTI`
2. Click "🧪 Overlay Test" tab
3. Toggle each layer on/off to verify rendering
4. Hover over circles to verify tooltips
5. Check legend for correct color mappings

## Future Enhancements

1. **Expand to other clients:** Add overlay test for more locations as data becomes available
2. **Enhanced parent model:** Weight by demographics (children under 5, working parents)
3. **Gap analysis automation:** Flag high-income/poor-SEO zones programmatically
4. **Export capabilities:** Screenshot/PDF export for client presentations
5. **Time series comparison:** Show how layers change over time

## Files Changed

1. `app/api/clients/[acronym]/overlay-test/route.js` - New API endpoint
2. `components/OverlayTestTab.js` - New React component
3. `components/ClientCard.js` - Import and integrate tab (3 edits)

## Dependencies

Already installed (no new dependencies needed):
- `leaflet` - Map rendering
- `react-leaflet` - React bindings
- `pg` (Pool) - Database access

## Data Sources

- `ClientSEOHeatmap` - SEO grid rank data
- `ClientMarketIntelligence` - ZIP-level demographics (income, coordinates)
- Hardcoded: Salt Lake City ZIP centroids for CTI area
- Hardcoded: Eastside Preschool coordinates

## Notes

- No competitor data is used anywhere in this tab (per Todd's explicit requirement)
- All three layers are independent and can be toggled separately
- Map defaults to SEO layer only (income and parent origin off by default)
- Legend dynamically shows/hides based on active layers
