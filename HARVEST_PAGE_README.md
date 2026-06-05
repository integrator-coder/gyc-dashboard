# Harvest Page - Implementation Summary

## Overview
Built a complete Harvest time tracking page for the GYC Leadership Dashboard. The page shows team productivity metrics, utilization rates, client hours, and trends over time.

## Files Created

### API Routes (all in `app/api/harvest/`)
1. **`summary/route.js`** - Monthly summary metrics (total hours, billable %, utilization, active clients, internal hours)
2. **`by-user/route.js`** - Per-user breakdown with current/last month comparison and trends
3. **`by-client/route.js`** - Top 50 clients by hours with trend indicators
4. **`by-service/route.js`** - Hours by service line (Web, SEO, Paid Media, CRM/Blueprint, Internal, Other)
5. **`trends/route.js`** - Last 6 months of data by user and total
6. **`client-mrr/route.js`** - Fetches MRR data from ClientProfile table for $/hr calculations

### Page Components
1. **`app/harvest/page.js`** - Server component with auth check (admin/superadmin only)
2. **`components/HarvestPage.js`** - Main client component with all UI sections

### Navigation
- Updated `components/Sidebar.js` to add Harvest link under Leadership section

## Features

### Summary Cards (Top of Page)
- Total Hours MTD
- Billable % (with color coding)
- Team Utilization % (with color coding)
- Active Clients count
- Internal Hours MTD

### By Employee Section
- Table showing all active Harvest users
- Columns: Name, Hours MTD, Billable Hrs, Utilization %, vs Last Month, Trend bar
- Color-coded utilization warnings (red if >90% or <30%, amber if >80% or <40%)
- Trend indicators (↑↓→) with color coding
- **Special view for Lada**: Only shows production team (Kaci, Sebastian, Suren, Raju, Briana)

### By Client - High Maintenance Detector
- Top 50 clients sorted by hours MTD
- Columns: Client name, Hours MTD, Hours Last Month, Trend, MRR, $/hr
- **High maintenance flag** (⚠️ + red text): clients with >20 hours AND MRR <$500/mo
- $/hr calculated as: client MRR ÷ hours logged this month
- Cross-references ClientProfile table for MRR data

### By Service Line
- Hours distribution across service types
- Progress bars showing percentage of total hours
- Categories: Web, SEO, Paid Media, CRM/Blueprint, Internal, Other

### Trends Chart
- Line chart showing total hours for last 6 months
- Monthly breakdown table showing hours per team member across 6 months
- Sorted by total hours descending

## Access Control

### Role-Based Access
- **Admin + Superadmin**: Full access to all sections
- **Lada (lada@growyourcenter.com)**: Limited production team view only
  - Sees only: Kaci Hawkins, Sebastian E, Surendran Haridoss, Raju Miah, Briana Stewart
  - Does NOT see: Summary cards, High Maintenance Detector, By Service Line, Trends Chart
- **Other roles**: No access (redirect to login with error message)

## Technical Details

### API Response Caching
- All API routes have `revalidate = 300` (5 minute cache)
- Reduces load on Harvest API

### Harvest API Integration
- Base URL: `https://api.harvestapp.com/api/v2`
- Headers: `Harvest-Account-ID`, `Authorization: Bearer ${token}`, `User-Agent: GYC-Dashboard`
- Pagination handled automatically (fetches all pages)
- Account ID: 1961445

### Service Line Classification Logic
Project names mapped as follows:
- **Web**: Website Build, Website Maintenance, Virtual Tour, Troubleshooting
- **SEO**: SEO
- **Paid Media**: Google Ads, Meta ads, Ads
- **CRM/Blueprint**: CRM Boost, CRM Newsletters, Blueprint
- **Internal**: Client name = "GYC - Grow Your Center" OR "BATCH UPDATES"
- **Other**: Everything else

### Database Integration
- Queries `ClientProfile` table for MRR data
- Join logic: lowercase match on company name
- Used for $/hr calculation and high-maintenance detection

## URL Path
- **Production**: `https://gyc-dashboard.vercel.app/harvest` (once deployed)
- **Local**: `http://localhost:3000/harvest`

## Next Steps / Future Enhancements
1. **Database caching**: Cache Harvest API responses in the database to speed up trends endpoint
2. **Custom date ranges**: Allow filtering by custom date range
3. **Export functionality**: CSV export of tables
4. **Drill-down views**: Click a client/user to see detailed time entry breakdown
5. **Budget tracking**: Compare actual hours vs. estimated/budgeted hours per project
6. **Alerts**: Email notifications when utilization thresholds are crossed

## Testing Checklist
- [x] Build succeeds without errors
- [x] All API routes created with proper auth checks
- [x] Sidebar navigation updated
- [x] Role-based access implemented (admin/superadmin only)
- [x] Lada special view implemented (production team only)
- [ ] Manual QA: Test as admin user
- [ ] Manual QA: Test as Lada
- [ ] Manual QA: Verify MRR lookups work correctly
- [ ] Manual QA: Verify high-maintenance flagging is accurate
- [ ] Manual QA: Test on mobile/tablet viewport

## Deployment Notes
- No new environment variables needed (HARVEST_API_TOKEN and HARVEST_ACCOUNT_ID already in .env.local)
- No database migrations needed (uses existing ClientProfile table)
- No package.json changes (all dependencies already present: recharts for charts)
