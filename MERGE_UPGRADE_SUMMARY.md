# GBP Merge Location Upgrade - Summary

## What Was Changed

Upgraded the GBP Merge Location modal in the GYC Dashboard to support **field-by-field conflict resolution** with a 3-step wizard interface.

---

## Files Modified

### 1. `components/ClientCard.js`

**State additions:**
- `mergeStep` (1 = select target, 2 = resolve conflicts, 3 = confirm)
- `mergeFieldChoices` (object tracking user's choice for each conflicting field)

**Modal UI completely rewritten:**
- **Step 1 - Select Target**: Choose which location to merge into (same as before)
- **Step 2 - Resolve Conflicts**: 
  - Shows side-by-side comparison for each field where BOTH records have values
  - Radio buttons to choose which value to keep
  - Auto-resolved fields (where only one record has a value) shown separately in gray with "auto" badge
  - Fields compared: locationName, address, city, state, gbpUrl, placeId, coordinates
- **Step 3 - Confirm**: Summary showing how many values will be kept from each record, with final merge button

**Styling:**
- Dark theme preserved (black/gray background, blue accents)
- Conflicting fields highlighted with blue border
- Selected radio option gets blue background
- Max width increased to `max-w-3xl` for better table layout
- Modal is scrollable (`max-h-[90vh] overflow-y-auto`)

**API call updated:**
- Now sends `fieldChoices` object along with `keepId` and `deleteId`
- Example: `{ locationName: "keep", address: "delete", placeId: "delete" }`

---

### 2. `app/api/clients/[acronym]/gbp/locations/merge/route.js`

**Request body expanded:**
- Now accepts `fieldChoices` parameter (optional, defaults to `{}`)

**Merge logic updated:**
- **Step 1**: Process explicit field choices first
  - `"keep"` → keep the keepId record's value (no change)
  - `"delete"` → overwrite keepId's field with deleteId's value
- **Step 2**: Auto-resolve remaining fields
  - If keepId has null and deleteId has a value → copy deleteId's value
  - If keepId has a value → keep it (no change)
- **Step 3**: Soft-delete the deleteId record (isActive = false)

**Special handling:**
- `coordinates` field choice applies to both `latitude` and `longitude`
- `placeId` field choice can apply to either `placeId` or `gbpPlaceId` (whichever exists)

**Fields supported for conflict resolution:**
- locationName
- address
- city
- state
- gbpUrl
- placeId (or gbpPlaceId)
- coordinates (latitude + longitude together)

**Fields still auto-merged (no UI conflict resolution):**
- capacity
- currentEnrollment
- avgTuition
- cid

---

## How It Works

### Before (Old Flow)
1. Select target location
2. See static preview
3. Click "Merge" → automatic field copy

### After (New Flow)
1. **Step 1**: Select target location → click "Compare"
2. **Step 2**: For each conflicting field (where both records have values), choose which value to keep via radio buttons
   - Fields where only one record has a value are shown as "auto" (grayed out, no choice needed)
3. **Step 3**: Review summary → click "Confirm Merge"

### Example Scenario

**Record A (will be removed):**
- Location Name: "Apple Tree - Athens"
- Address: "810 Olympic Dr"
- Place ID: "ChIJj09z..."

**Record B (will be kept):**
- Location Name: "Apple Tree Prep Athens"
- Address: null
- Place ID: "ChIJabc123..."

**What the GA sees in Step 2:**
- **Conflicting fields** (both have values):
  - Location Name: radio buttons to choose "Apple Tree - Athens" or "Apple Tree Prep Athens"
  - Place ID: radio buttons to choose "ChIJj09z..." or "ChIJabc123..."
- **Auto-resolved** (only one has value):
  - Address: "810 Olympic Dr" (auto - from Record A)

**Result after merge:**
- Record B keeps its ID and is updated with chosen values
- Record A is soft-deleted

---

## Testing Checklist

- [x] Build completes without errors
- [ ] Modal opens when clicking "Merge" on a location
- [ ] Step 1: dropdown shows other locations, "Compare" button navigates to Step 2
- [ ] Step 2: conflicting fields shown with radio buttons, auto-resolved fields shown separately
- [ ] Step 2: radio selection updates when clicked
- [ ] Step 3: summary shows correct counts
- [ ] Final merge executes and updates database correctly
- [ ] Back button works at each step
- [ ] Cancel button closes modal and resets state
- [ ] Error messages display properly if merge fails

---

## Notes

- The modal now supports a much wider modal (`max-w-3xl` instead of `max-w-2xl`) to accommodate the side-by-side comparison table
- All existing merge behavior is preserved for fields not shown in the conflict resolution UI (they auto-merge as before)
- The API is backward compatible — if `fieldChoices` is not provided, it behaves like the old auto-merge
- State is properly reset on cancel/success (mergeStep back to 1, fieldChoices cleared)
