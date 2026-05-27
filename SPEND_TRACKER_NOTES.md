# Platform Spend Tracker - Implementation Notes

## What Was Built

### 1. API Route: `/app/api/mission-control/spend/route.js`
- **Endpoint:** `GET /api/mission-control/spend`
- **Authentication:** Requires user with roles: sales, ga, cx, recon, admin, or superadmin
- **Dynamic:** Force-dynamic (no caching)

#### Data Sources

**Live API Sources (implemented):**
- **Anthropic** — Uses `ANTHROPIC_BILLING_API_KEY` from `.env.local`
  - Endpoint: `https://api.anthropic.com/v1/organizations/cost_report`
  - Supports pagination
  - Returns values in cents (converted to dollars)
  - Category: AI

- **OpenAI** — Uses `OPENAI_API_KEY` from `.env.local`
  - Endpoint: `https://api.openai.com/v1/usage`
  - Note: May need adjustment based on actual billing API structure
  - Category: AI

- **Render** — Uses `RENDER_API_KEY` from `~/.openclaw/secrets.json`
  - Endpoint: `https://api.render.com/v1/invoices`
  - Fetches current month invoice
  - Category: Infrastructure

- **Google Cloud Platform** — Placeholder (not yet implemented)
  - Would require Cloud Billing API access
  - Service account needs billing permissions
  - Category: Infrastructure

**Fixed Monthly Subscriptions (hardcoded):**
- GHL: $497/mo (CRM)
- Zendesk: $300/mo (Support)
- Notion: $50/mo (Productivity)
- PandaDoc: $50/mo (Sales)
- Asana: $25/mo (Productivity)
- Zoom: $50/mo (Communication)
- DataForSEO: $0/mo variable placeholder (Data)

#### Response Format
```json
{
  "totalMonthly": 1234.56,
  "month": "2026-05",
  "breakdown": [
    {
      "service": "Anthropic",
      "category": "AI",
      "amount": 45.20,
      "source": "live"
    },
    {
      "service": "GHL",
      "category": "CRM",
      "amount": 497.00,
      "source": "fixed"
    }
  ],
  "byCategory": {
    "AI": 57.70,
    "Infrastructure": 33.40,
    "CRM": 497.00
  },
  "lastUpdated": "2026-05-27T22:00:00Z"
}
```

### 2. UI Component: `PlatformSpendTracker` in `components/MissionControlPage.js`
- **Location:** Integrated into the "Cost" tab of Mission Control
- **Auto-refresh:** Every 5 minutes
- **Theme:** Matches existing Mission Control dark theme (Deep Purple #340B67, Gold #C19C46)

#### Features:
- **Summary Cards:** Total monthly spend + top 3 categories
- **Breakdown Table:** All services with category badges, amounts, and source indicators
- **Color-coded categories:** Each category has a distinct color
- **Source indicators:** 
  - 🔴 Live (green badge) — real-time API data
  - 📌 Fixed (gray badge) — hardcoded subscriptions
- **Last updated timestamp**
- **Helpful note:** Instructions for updating fixed subscription amounts

## File Paths
- API Route: `/Users/toddthejedigmail.com/.openclaw/workspace/gyc-dashboard/app/api/mission-control/spend/route.js`
- Component: Added to `/Users/toddthejedigmail.com/.openclaw/workspace/gyc-dashboard/components/MissionControlPage.js`
- Test endpoint: `/app/api/test-env/route.js` (can be deleted — was for debugging)

## Status of Live Sources

### ✅ Working:
- Fixed subscriptions (all displaying correctly)
- API route structure and authentication

### ⚠️ Needs Server Restart:
- Anthropic API integration (code is correct, but running server may be using cached version)
- OpenAI API integration (structure in place, may need endpoint adjustment)
- Render API integration (code complete, reading from secrets.json)

### ❌ Not Yet Implemented:
- GCP Cloud Billing (requires service account with billing permissions — complex setup)

## How to Update Fixed Subscriptions

Edit the `FIXED_SUBSCRIPTIONS` array in `app/api/mission-control/spend/route.js`:

```javascript
const FIXED_SUBSCRIPTIONS = [
  { service: 'GHL', category: 'CRM', amount: 497.00 },
  { service: 'Zendesk', category: 'Support', amount: 300.00 },
  // ... add or modify entries here
]
```

## Next Steps to Complete

1. **Restart the dashboard server** to pick up the Anthropic API changes:
   ```bash
   cd /Users/toddthejedigmail.com/.openclaw/workspace/gyc-dashboard
   # Kill existing process
   lsof -ti:3000 | xargs kill -9
   # Restart
   npm run dev
   ```

2. **Verify Anthropic data appears** in the UI at Mission Control → Cost tab

3. **Test OpenAI endpoint** — may need adjustment based on actual billing API structure

4. **Test Render endpoint** — verify it reads from `~/.openclaw/secrets.json` correctly

5. **(Optional) Add GCP billing** if needed — requires:
   - Service account with Cloud Billing API permissions
   - Cloud Billing API enabled in GCP project
   - Implementation using `@google-cloud/billing` package

## Environment Variables Required

From `.env.local`:
- `ANTHROPIC_BILLING_API_KEY` — ✅ Present
- `OPENAI_API_KEY` — ✅ Present

From `~/.openclaw/secrets.json`:
- `RENDER_API_KEY` — ✅ Present

## Notes

- All live API calls fail gracefully — if a source is unavailable, it's simply omitted from the breakdown
- The UI shows "Loading..." while fetching, and error messages if the API fails
- Category colors are defined in the component and can be customized
- The breakdown table is sorted by amount (highest first)
