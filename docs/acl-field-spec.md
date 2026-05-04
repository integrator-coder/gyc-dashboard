# ACL Client Card — Field Specification
**Version:** 1.0  
**Date:** April 30, 2026  
**Purpose:** M3 Prototype Handoff — defines every field in the GYC Dashboard ACL client cards, including data source, definition, and update mechanism.

---

## Data Sources Legend

| Source | Description |
|--------|-------------|
| `ClientProfile` | Neon PostgreSQL table — master client record, manually maintained + Stripe sync |
| `Stripe` | Synced nightly by Eve via Stripe API → `StripeCustomer`, `StripeInvoiceSnapshot` |
| `GHL` | GoHighLevel CRM — synced via GHL API → `ClientProfile.ghlContactId` etc. |
| `Zendesk` | Support tickets — synced via Zendesk API → `ZendeskSnapshot` |
| `GBPLocation` | Neon table — GBP location records, seeded from sheet + manual input |
| `GBPAudit` | Neon table — manual audit entries by Growth Advisors |
| `DataForSEO` | Live API call — Google Maps/Places data (rating, reviews, Place ID) |
| `ClientFunnelMonth` | Neon table — monthly lead/tour/registration data from GHL |
| `ZoomCall` | Neon table — call recordings ingested from Zoom |
| `GBPSnapshot` | Neon table — reserved for future GBP API snapshots |
| `Manual` | Manually entered via dashboard UI |
| `Computed` | Calculated at query time from other fields |

---

## Tab 1: Overview

The primary client health snapshot. First tab displayed.

### Health & Alerts
| Field | Source | Definition |
|-------|--------|------------|
| Health Score | Computed | 0–10 composite score. Based on Stripe status (active/overdue), funnel trend, and service coverage. 8+ = Healthy, 5–7 = Moderate, <5 = At Risk |
| Overdue Alert | Stripe | Triggered if `ClientProfile.isOverdue = true`. Shows overdue balance amount. |
| Funnel Down Alert | ClientFunnelMonth | Triggered if `ClientProfile.funnelTrend = 'down'` |
| Payment Failed Alert | Stripe | Triggered if `stripeStatus IN ('past_due', 'unpaid')` |

### This Month's Funnel
| Field | Source | Definition |
|-------|--------|------------|
| Leads | ClientFunnelMonth | Count of leads (inquiries) received in the current month |
| Tours | ClientFunnelMonth | Count of tours completed in the current month |
| Registrations | ClientFunnelMonth | Count of new enrollments in the current month |

### Funnel Averages (Rolling)
| Field | Source | Definition |
|-------|--------|------------|
| Avg Leads/mo | Computed | Rolling average monthly leads over `funnelDataMonths` |
| Avg Tours/mo | Computed | Rolling average monthly tours over `funnelDataMonths` |
| Avg Enrollments/mo | Computed | Rolling average monthly registrations over `funnelDataMonths` |
| Lead to Tour Ratio | Computed | `avg tours / avg leads × 100` expressed as % |
| Tour to Enrollment | Computed | `avg registrations / avg tours × 100` expressed as % |
| Conversion Rate | Computed | `avg registrations / avg leads × 100` — end-to-end funnel |
| Funnel Data Months | ClientFunnelMonth | Number of months of funnel data available |
| Trend | Computed | `up` / `stable` / `down` based on recent vs. prior period comparison |

### Active Services
| Field | Source | Definition |
|-------|--------|------------|
| Website | ClientProfile.hasWebsite | Boolean — client has active website service |
| SEO | ClientProfile.hasSEO | Boolean — client has active SEO service |
| CRM | ClientProfile.hasCRM | Boolean — client has active CRM service (type stored in `crmType`) |
| Blueprint | ClientProfile.hasBlueprint | Boolean — client is on Blueprint ("done with you") program |
| Google Ads | ClientProfile.hasGoogleAds | Boolean — client has active Google Ads management |
| Paid Media | ClientProfile.hasPaidMedia | Boolean — client has active paid media (Meta/other) |

### Client Info
| Field | Source | Definition |
|-------|--------|------------|
| Owner | ClientProfile.ownerName | Business owner's name |
| Email | ClientProfile.email | Primary contact email |
| Phone | ClientProfile.phone | Primary contact phone |
| Director | ClientProfile.directorName | Center director (if different from owner) |
| Location | ClientProfile.city, state | City and state of primary location |
| Since | ClientProfile.startDate | Date client started with GYC |

---

## Tab 2: Financial

Billing, payment history, and Stripe status.

### Key Metrics
| Field | Source | Definition |
|-------|--------|------------|
| MRR | ClientProfile.mrr (max vs Stripe) | Monthly Recurring Revenue. Uses `MAX(StripeCustomer.mrr, ClientProfile.mrr)` — Stripe may only reflect partial subscriptions |
| Lifetime Value | ClientProfile.lifetimeValue | Total paid to GYC since inception (synced from Stripe invoice history) |
| Overdue Amount | ClientProfile.overdueAmount | Current outstanding balance (from Stripe `past_due` / `unpaid` invoices) |
| PIF Indicator | Computed | Flag shown when `lifetimeValue > mrr × 10` — indicates paid-in-full client |

### Stripe Status
| Field | Source | Definition |
|-------|--------|------------|
| Stripe Status | StripeCustomer.status | `active` / `past_due` / `unpaid` / `cancelled`. All three first are considered active clients. |
| Overdue | ClientProfile.isOverdue | Boolean — client has overdue balance |
| Overdue Count | ClientProfile.overdueCount | Number of distinct overdue episodes in billing history |
| Last Overdue Date | ClientProfile.lastOverdueDate | Date of most recent overdue event |
| Last Reason | ClientProfile.lastOverdueReason | Reason captured for last overdue (card decline, etc.) |
| Catch-up Rate | ClientProfile.catchUpRate | % of overdue episodes where client eventually paid |
| Avg Days to Pay | ClientProfile.avgDaysToCatchUp | Average days between overdue and payment when recovered |

### Payment History
| Field | Source | Definition |
|-------|--------|------------|
| Payment Date | StripeInvoiceSnapshot.paidAt | Date invoice was paid |
| Amount | StripeInvoiceSnapshot.amountPaid | Amount paid in USD |
| Invoice # | StripeInvoiceSnapshot.invoiceNumber | Stripe invoice number |
| Invoice Link | StripeInvoiceSnapshot.hostedInvoiceUrl | Link to Stripe-hosted invoice PDF |

### CRM Pipeline
| Field | Source | Definition |
|-------|--------|------------|
| GHL Pipeline Stage | ClientProfile.ghlPipelineStage | Current stage in GoHighLevel CRM pipeline |
| GHL Contact ID | ClientProfile.ghlContactId | GoHighLevel contact ID (links to GHL record) |

---

## Tab 3: Website

Website status, performance, and audit history.

### Website Info
| Field | Source | Definition |
|-------|--------|------------|
| Website URL | ClientProfile.website | Client's primary website URL |
| Website Status | Manual / Computed | Whether the site is live, down, or in progress |
| Google Analytics | ClientProfile.hasGoogleAnalytics / GA API | Whether GA is connected; shows traffic data when available |

### Website Audit
| Field | Source | Definition |
|-------|--------|------------|
| Audit Score | WebsiteAudit table | Composite score from periodic website audit |
| Audit Date | WebsiteAudit.auditedAt | Date the most recent audit was run |
| Issues | WebsiteAudit | List of issues found (broken links, speed, SEO, etc.) |
| Notes | Manual | Notes from the team about website state |

---

## Tab 4: SEO

SEO service status and notes.

| Field | Source | Definition |
|-------|--------|------------|
| SEO Active | ClientProfile.hasSEO | Whether client has active SEO service |
| SEO Notes | ClientProfile.seoNotes | Team notes on SEO strategy, status, and priorities |
| Google Analytics | GA Admin API | Link to client's GA property (270 properties accessible) |
| Landing Page URL | ClientProfile.leadDataUrl | URL for client's landing page if separate from main site |

---

## Tab 5: GBP (Google Business Profile)

One section per location. Multi-location clients show a summary comparison table at top.

### Per-Location Fields
| Field | Source | Definition |
|-------|--------|------------|
| Nickname | GBPLocation.locationName | Friendly name set by GA during client call (e.g. "Downtown Location", "Westside Center") |
| Address | GBPLocation.address/city/state | Physical address of this GBP location |
| GBP Link | GBPLocation.gbpUrl | `share.google` management access link to the GBP listing |
| Star Rating | DataForSEO (live) → fallback: GBPAudit.avgRating | Current Google star rating (1–5). Auto-fetched live via DataForSEO Maps API on page load. Falls back to last manual audit if live fetch fails. |
| Reviews | DataForSEO (live) → fallback: GBPAudit.reviewCount | Total review count on the GBP listing. Same source/fallback as rating. |
| Photo Score | Computed from GBPAudit.photoCount + photoRecentMonth | 1–5 score. Algorithm: <5 photos=1, 5-9=2, 10-24 (no recent)=2, 10-24 (recent)=3, 25-49 (no recent)=3, 25-49 (recent)=4, 50+ (no recent)=4, 50+ (recent)=5 |
| Photo Score Text | Computed | Human-readable improvement tip based on photo score |
| Health Score | GBPAudit.compositeScore | 0–100 composite score from latest audit checklist. Green ≥80, Amber ≥50, Red <50. |
| Checks Passing | Computed from GBPAudit | Count of passing checklist items out of 15 total |
| Last Audited | GBPAudit.auditDate | Date of most recent manual audit. Amber badge if >30 days, Red if never audited. |
| Place ID | GBPLocation.gbpPlaceId | Google Place ID — auto-resolved via DataForSEO on first load, cached. Used for future direct API lookups. |

### Audit Checklist (15 items — all boolean, entered manually by GA)
| Field | Definition |
|-------|------------|
| GBP claimed & verified | Listing is claimed and verified with Google |
| Primary category correct | Business category accurately reflects the childcare center |
| Secondary categories set | Additional relevant categories are configured |
| Description complete | Business description is filled (up to 750 chars) |
| Website linked | Website URL is connected to the GBP listing |
| Phone number listed | Phone number is present and correct |
| Hours complete (all 7 days) | Business hours set for all days of the week |
| 50+ reviews | Listing has 50 or more Google reviews |
| 4.0+ star rating | Current average rating is 4.0 stars or higher |
| Responded to last 5 reviews | Owner/staff have replied to the 5 most recent reviews |
| Photo posted in last 30 days | At least one new photo added within the past 30 days |
| Post in last 7 days | A Google Post was published within the past 7 days |
| Q&A section active | Questions & Answers section has at least one response |
| Services listed | Services section is populated |
| Service area configured | Service area / radius is set on the listing |

### Multi-location Summary Table (2+ locations only)
Shows all locations side-by-side with: Nickname, Rating, Reviews, Photos, Health Score, Last Audited.

---

## Tab 6: CRM

Client's CRM setup and funnel data.

### CRM Info
| Field | Source | Definition |
|-------|--------|------------|
| CRM Type | ClientProfile.crmType | CRM platform in use (Line Leader, IKS, Playground, etc.) |
| CRM Active | ClientProfile.hasCRM | Whether client has active CRM service |
| CRM Notes | ClientProfile.crmNotes | Team notes on CRM setup, issues, integrations |
| CRM Data Access | Manual | Whether GYC has data access to client's CRM |

### Funnel by Location
| Field | Source | Definition |
|-------|--------|------------|
| Location Name | GBPLocation / ClientFunnelMonth | Name of the specific center location |
| Month | ClientFunnelMonth.month | Month of the funnel data (YYYY-MM) |
| Leads | ClientFunnelMonth.leads | Inquiries/leads received that month for this location |
| Tours | ClientFunnelMonth.tours | Tours completed that month |
| Registrations | ClientFunnelMonth.registered | New enrollments that month |
| Tour Rate | Computed | `tours / leads × 100` |
| Close Rate | Computed | `registrations / tours × 100` |
| Conv Rate | Computed | `registrations / leads × 100` |

### Enrollment Metrics (per location)
| Field | Source | Definition |
|-------|--------|------------|
| Capacity | GBPLocation.capacity | Licensed/comfortable capacity of the center |
| Current Enrollment | GBPLocation.currentEnrollment | Current number of enrolled children |
| Avg Tuition | GBPLocation.avgTuition | Average monthly tuition per child |
| Occupancy Rate | Computed | `enrollment / capacity × 100` |

---

## Tab 7: Blueprint

Blueprint ("done with you") program status.

| Field | Source | Definition |
|-------|--------|------------|
| Blueprint Active | ClientProfile.hasBlueprint | Whether client is on the Blueprint program |
| Blueprint Notes | Manual | Team notes on Blueprint engagement and progress |

---

## Tab 8: Paid Media

Google Ads and Meta/other paid media service status.

| Field | Source | Definition |
|-------|--------|------------|
| Google Ads Active | ClientProfile.hasGoogleAds | Whether client has active Google Ads management |
| Paid Media Active | ClientProfile.hasPaidMedia | Whether client has active Meta/other paid media |
| GA Account | ClientProfile (from Notion) | Google Ads account ID or link |
| FB Ads Manager | ClientProfile (from Notion) | Facebook/Meta Ads Manager access link |
| Paid Media Notes | Manual | Team notes on campaign strategy and performance |

---

## Tab 9: Contacts

All contact information and linked locations.

### People
| Field | Source | Definition |
|-------|--------|------------|
| Owner | ClientProfile.ownerName | Business owner name |
| Main Email | ClientProfile.email | Primary email for billing and communications |
| Main Phone | ClientProfile.phone | Primary phone |
| Director | ClientProfile.directorName | Center director (if separate from owner) |
| Director Email | ClientProfile.directorEmail | Director's direct email |
| Director Phone | ClientProfile.directorPhone | Director's direct phone |
| Assigned GA | ClientProfile.assignedGA | Growth Advisor name responsible for this account |
| Assigned GA Email | ClientProfile.assignedGAEmail | GA's email address |

### Links & Systems
| Field | Source | Definition |
|-------|--------|------------|
| GHL Contact | ClientProfile.ghlContactId | GoHighLevel contact ID — links to GHL profile |
| Client Folder | ClientProfile.clientFolderUrl | Google Drive folder for this client |
| Lead Data Sheet | ClientProfile.leadDataUrl | Google Sheet with lead tracking data |
| Website | ClientProfile.website | Client website URL |

### Locations (GBP)
| Field | Source | Definition |
|-------|--------|------------|
| Location Nickname | GBPLocation.locationName | GA-assigned nickname for the location |
| Address | GBPLocation.address/city/state | Physical address |
| GBP Link | GBPLocation.gbpUrl | Google Business Profile management link |
| Active | GBPLocation.isActive | Whether this location is currently active |

---

## Tab 10: Notes

Free-text notes for internal team use.

| Field | Source | Definition |
|-------|--------|------------|
| Team Notes | ClientProfile.teamNotes | Internal notes for GYC team (not client-facing). Auto-updated by system for flags like ACL reconciliation notes. |
| General Notes | ClientProfile.notes | General client notes |
| Website Notes | ClientProfile.websiteNotes | Notes specific to website work |
| SEO Notes | ClientProfile.seoNotes | Notes specific to SEO work |
| CRM Notes | ClientProfile.crmNotes | Notes specific to CRM setup |

---

## Tab 11: Calls

Zoom call recordings linked to this client.

| Field | Source | Definition |
|-------|--------|------------|
| Call Date | ZoomCall.startedAt | Date and time of the call |
| Duration | ZoomCall.durationMinutes | Length of call in minutes |
| Classification | ZoomCall.classifiedAs | Type of call (Onboarding, Check-in, Strategy, etc.) |
| AI Classification | ZoomCall.aiClassification | AI-suggested classification (pending human confirmation) |
| Participants | ZoomCall.participants | JSON array of participant names/emails |
| Recording Link | ZoomCall.recordingUrl | Zoom recording URL |
| Purposes | ZoomCall.purposes | Tags/purposes assigned to the call |
| Pending Classification | Computed | Calls with no classification assigned yet |
| Potential Unlinked | Computed | Calls that may belong to this client but aren't linked (matched by email/participant) |

---

## Global Client Identifiers

These fields are on every client record and used across all tabs.

| Field | Source | Definition |
|-------|--------|------------|
| Acronym | ClientProfile.acronym | Unique short code for the client (e.g. "CTI", "KWLC"). Used as the URL slug and primary key in UI. |
| Company Name | ClientProfile.companyName | Full legal/trading name of the childcare center |
| Status | ClientProfile.status | `active` / `onboarding` / `paused` / `cancelled` |
| Stripe Status | StripeCustomer.status | `active` / `past_due` / `unpaid` / `cancelled` |
| Location Count | ClientProfile.locationCount | Number of physical center locations |
| City / State | ClientProfile.city, state | Geographic location |
| Start Date | ClientProfile.startDate | Date client joined GYC |
| Cancelled Date | ClientProfile.cancelledDate | Date of cancellation (if applicable) |
| Stripe Customer ID | ClientProfile.stripeCustomerId | Stripe customer ID for billing lookup |
| Notion Page ID | ClientProfile.notionPageId | Link to the client's Notion ACL entry |

---

## Data Freshness / Update Frequency

| Data Type | Update Frequency | Method |
|-----------|-----------------|--------|
| Stripe MRR, status, payments | Nightly | Eve sync via Stripe API |
| GBP live rating/reviews | On page load | DataForSEO API (live call) |
| GBP Place ID | First load only, then cached | DataForSEO → stored in GBPLocation |
| GBP audit data | Manual | GA runs audit on client call |
| Funnel data (leads/tours/registrations) | Monthly | Synced from GHL via API |
| Zoom calls | Daily at 7:00 AM | Eve ingestion script |
| Zendesk tickets | On-demand refresh | Manual sync via dashboard |
| Client profile fields | As needed | Manual via dashboard or Notion sync |
| Health score | Real-time | Computed on API call |

---

## Open Items / Future Enhancements

- [ ] GBP API (Google Business Profile restricted API) — apply for access to get posts, Q&A, and insights data
- [ ] Auto-sync client profiles from Notion (full Notion → Neon sync)
- [ ] Mellody Buzalski missing from system — confirm company name with Lex
- [ ] MRR for Nov 2024–Feb 2026 understated in trend chart — pre-Stripe migration period
- [ ] Larry Van (HP) and Amit Jain deduplication for accurate client count metric
