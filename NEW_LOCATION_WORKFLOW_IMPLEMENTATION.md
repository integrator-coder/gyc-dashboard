# New Location Workflow Implementation

## Summary
Enhanced the GBP "Add Location" feature in the GYC Dashboard with a 2-step workflow that determines whether a location is truly new (triggering an Asana project) or just a clerical update.

## Changes Made

### 1. New API Endpoint
**File:** `app/api/clients/[acronym]/gbp/locations/new-location-workflow/route.js`

This endpoint handles the New Location workflow by:
- Finding the client's assigned Growth Advisor (GA) from `ClientProfile.assignedGA`
- Looking up the GA's Asana user by name
- Getting the workspace teams to assign the project to
- Duplicating the Asana project template (from `ASANA_NEW_LOCATION_TEMPLATE_GID` env var)
- Adding the GA as a project member
- Creating an action-required task for the GA with location details
- Returning the Asana project URL for display to the user

**Error Handling:** If Asana workflow fails, the endpoint returns a warning but doesn't fail the overall request (location is already saved by this point).

### 2. UI Changes - 2-Step Add Location Flow
**File:** `components/ClientCard.js`

#### Added State Variables:
- `addLocationStep` - tracks which step the user is on (1 = form, 2 = location type)
- `pendingLocation` - stores the saved location data between steps

#### Updated `saveLocation()` Function:
- Now saves the location and moves to step 2 instead of closing the form
- Stores the saved location in `pendingLocation` state

#### New `handleLocationTypeSelection()` Function:
- Handles the user's choice between "New Location" or "Clerical Update"
- If "New Location": calls the workflow endpoint and shows success with Asana link
- If "Clerical Update": simply completes and refreshes (no Asana workflow)
- Shows appropriate alerts for success, partial success, or failure

#### UI Flow:
**Step 1:** Location details form (unchanged from original, but button text now says "Next: Location Type")

**Step 2:** Location type selection screen showing two large buttons:
- 🏢 **New Location** - "New address, new GBP listing, new service delivery point"
- 📋 **Clerical Update** - "Fixing a duplicate, correcting data, adding a missing existing location"

Success message includes:
- Confirmation that location was added
- Asana project name
- Who it was assigned to
- Direct link to the Asana project

### 3. Environment Variable
**File:** `.env.local`

Added:
```
ASANA_NEW_LOCATION_TEMPLATE_GID=1201619092827904
```

This is a placeholder value (currently pointing to the NEW CLIENT ONBOARDING template). Todd will update this to the correct New Location template GID when ready.

## How It Works

1. **GA adds a location** → fills in location name, GBP URL, etc. → clicks "Next: Location Type"
2. **Location is saved** → server calls `/api/clients/[acronym]/gbp/locations/add` (existing endpoint)
3. **Step 2 appears** → GA chooses between "New Location" or "Clerical Update"
4. **If "New Location"**:
   - Server calls `/api/clients/[acronym]/gbp/locations/new-location-workflow`
   - Asana project is created from template
   - GA is added as member and assigned a task
   - Success message shows with Asana link
5. **If "Clerical Update"**:
   - Form closes, location list refreshes
   - No Asana workflow triggered

## Asana Integration Details

### API Calls Made:
1. `GET /workspaces/{workspace_gid}/users` - find the GA's Asana user
2. `GET /workspaces/{workspace_gid}/teams` - get team for project assignment
3. `POST /project_templates/{template_gid}/instantiateProject` - duplicate template
4. `POST /projects/{project_gid}/addMembers` - add GA to project
5. `POST /tasks` - create action-required task

### Team Member Matching:
The system looks up the GA by name using the value stored in `ClientProfile.assignedGA`:
- First tries exact match (case-insensitive)
- Falls back to partial match (first name or last name)
- Returns 404 if no match found

### Task Created:
```
Title: [ACTION REQUIRED] Fill out New Location details for [LocationName]

Description:
A new location has been added to the GYC Dashboard for [ClientName] — [LocationName].

Please fill out this project with all relevant details so that Billing, Web, Paid Media, 
and SEO teams can be notified and updated.

Location Details:
- Location Name: [name]
- GBP URL: [url]
- Dashboard Location ID: [id]

Next Steps:
1. Complete the project fields with client info
2. Notify relevant teams via project tasks
3. Update the Dashboard with any additional location data
```

## Files Modified

1. **Created:** `app/api/clients/[acronym]/gbp/locations/new-location-workflow/route.js` (new endpoint)
2. **Modified:** `components/ClientCard.js` (2-step UI flow + workflow integration)
3. **Modified:** `.env.local` (added `ASANA_NEW_LOCATION_TEMPLATE_GID`)

## Build Status
✅ Build completed successfully with no errors.

## Next Steps for Todd

1. **Update the template GID** in `.env.local` once the correct "New Location" Asana template is created
2. **Test the workflow** by adding a test location and selecting "New Location"
3. **Verify GA name matching** - make sure `ClientProfile.assignedGA` values match Asana user names exactly
4. **Optional:** Customize the Asana task description template in the workflow endpoint

## Known Limitations

- GA must be assigned to the client in `ClientProfile.assignedGA`
- GA name must match an Asana user (exact or partial first/last name match)
- Uses first available team in workspace for project assignment
- Template GID is currently a placeholder (NEW CLIENT ONBOARDING template)

## Rollback Plan

If issues occur:
1. Revert changes to `components/ClientCard.js` (restore original `saveLocation` function)
2. Keep the new endpoint (it won't be called if UI is reverted)
3. Or: set a feature flag in code to use old 1-step flow vs new 2-step flow
