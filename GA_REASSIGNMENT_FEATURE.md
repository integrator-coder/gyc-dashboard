# GA Reassignment Feature

## Overview
Built a feature to allow admin/superadmin users to reassign Growth Advisors (GAs) directly from the Active Client List (ACL) dashboard page.

## Files Changed/Created

### 1. API Route (NEW)
**Path:** `app/api/clients/[acronym]/assign-ga/route.js`

**Purpose:** PATCH endpoint to update the assigned GA for a client

**Features:**
- Admin/superadmin authentication check via `requireApiUser(['admin', 'superadmin'])`
- Updates both `assignedGA` and `assignedGAEmail` fields in `ClientProfile` table
- Returns updated client data on success
- Proper error handling with appropriate HTTP status codes

**GA Email Mapping:**
```javascript
const GA_EMAILS = {
  'Stefen': 'stefen@growyourcenter.com',
  'Sebastian': 'sebastian@growyourcenter.com',
  'JC': 'jc@growyourcenter.com',
  'Briana': 'briana@growyourcenter.com',
  'Zu': 'zu@growyourcenter.com',
}
```

### 2. Frontend Component (MODIFIED)
**Path:** `components/ActiveClientList.js`

**Changes:**

#### New Component: `GASelector`
- Inline dropdown for selecting GAs
- Only visible/clickable for admin/superadmin users
- Non-admin users see static text
- Shows "Saving..." state while updating
- Dropdown with 5 GAs: Sebastian, Stefen, JC, Briana, Zu
- Prevents card navigation when clicking dropdown
- Auto-closes on selection

#### Updated Component: `ClientGridCard`
- Now accepts `user` and `onUpdate` props
- Replaced static GA name with `<GASelector>` component

#### Updated Component: `ActiveClientList`
- Added `successMessage` state for success feedback
- Added `handleGAUpdate` function for optimistic updates
- Success toast shows "Reassigned to [name]" for 3 seconds
- Passes `user` and `onUpdate` to each `ClientGridCard`

## UX Flow

1. Admin/superadmin user sees GA name as an **underlined link** (violet color)
2. Click opens dropdown with 5 GA options
3. Select new GA → dropdown shows "Saving..."
4. On success:
   - Card updates immediately (optimistic update)
   - Green success toast appears: "Reassigned to [name]"
   - Toast auto-dismisses after 3 seconds
5. On error:
   - Alert shows error message
   - Card reverts to original state (optimistic update rolls back via re-fetch if needed)

## Authorization
- **Read:** All users with access to `/clients` page (ga, cx, admin, superadmin)
- **Edit:** Admin and superadmin only
- Non-privileged users see static GA name (no edit capability)

## Testing Checklist
- [ ] Admin user can click and see dropdown
- [ ] GA user sees static text (no edit)
- [ ] Selecting a GA saves and shows success message
- [ ] Card updates immediately (optimistic)
- [ ] Error handling works (try invalid acronym)
- [ ] Clicking dropdown doesn't navigate to client detail page
- [ ] Works across all breakpoints (mobile, tablet, desktop)

## Database Schema
Updates these fields in `ClientProfile` table:
- `assignedGA` (VARCHAR)
- `assignedGAEmail` (VARCHAR)

## Notes
- No server restart required — Render will auto-deploy on git push
- Dropdown positioned absolute, z-index 50 to stay above card content
- Uses existing design system colors and styling
- Follows existing auth patterns from other admin-only routes
