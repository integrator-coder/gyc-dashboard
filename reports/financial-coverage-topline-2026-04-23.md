# Financial coverage topline — 2026-04-23

## Executive summary

- **Top-line MRR is not missing.** `ClientProfile.mrr` and `StripeCustomer.mrr` both total **$162,922.29**.
- The problem is **client-level coverage / attribution**, not aggregate revenue.
- We currently have **396** represented clients in `ClientProfile` vs **310** live Stripe customers (`active` + `past_due`; no `trialing` rows present).
- **309 / 396** represented clients have a legacy Stripe link; **299 / 396** have a normalized `ClientStripeLink` primary mapping.
- **185 / 396** represented clients show **zero/null MRR**.
- Of those 185 zero-MRR clients:
  - **98** already have a Stripe link
  - **87** have no legacy Stripe link at all
  - **25** look like mapping/review candidates
  - **160** look like true zero / no-billing cases with current data

## Core counts

### Stripe side

- **310** live Stripe customers (`active` + `past_due`)
- **206** live Stripe customers with **positive MRR**
- Status split:
  - `active`: **288** customers / **188** with positive MRR / **$147,950.82** MRR
  - `past_due`: **22** customers / **18** with positive MRR / **$14,971.47** MRR
  - `trialing`: **0**
- Live Stripe MRR total: **$162,922.29**

### ClientProfile side

- **396** represented clients in `ClientProfile`
- **211** represented clients with positive MRR
- **185** represented clients with zero/null MRR
- ClientProfile MRR total: **$162,922.29**

### Link coverage

- Legacy `ClientProfile.stripeCustomerId` populated on **309** clients
- Normalized `ClientStripeLink` covers:
  - **299** client profiles with a primary link
  - **309** distinct Stripe customer IDs total
  - **10** secondary Stripe links across **5** profiles
- All **211** positive-MRR client profiles already have a Stripe link

## Coverage gap numbers

### How many Stripe customers are not represented cleanly?

There are two useful ways to answer this:

1. **Direct legacy mapping gap:**
   - **10 / 310** live Stripe customers are **not directly attached** to a `ClientProfile.stripeCustomerId`
   - only **1 / 206** positive-MRR live Stripe customer is in that bucket

2. **Normalized-link-table gap (cleaner answer):**
   - `ClientStripeLink` already covers **309 / 310** live Stripe customers
   - only **1** live Stripe customer is still missing from the normalized layer:
     - `cus_ShImtycdoWloNM` — **Christopher Broome / Kids Hangout** — **$395 MRR**

## What explains the mismatch

### Bucket 1 — represented clients with no current billable Stripe evidence (**160 clients**)

These are the biggest reason the client count is much higher than the billable Stripe count.

- **96** zero-MRR profiles already point to a live Stripe customer whose current Stripe MRR is **0**
- **64** zero-MRR profiles have **no live Stripe evidence** at all
- Combined: **160 / 185** zero-MRR profiles look like true zero / no-billing cases, not clean missing revenue

### Bucket 2 — manual-review mapping candidates inside zero-MRR profiles (**25 clients**)

These are the clients most likely to matter for fixing attribution.

- **22** email-only suspected matches
- **2** shared live Stripe IDs already attached to multiple profiles
- **1** mixed / multi-candidate case
- **0** safe auto-fix candidates

### Bucket 3 — direct-link misses mostly caused by multi-customer aliases / duplicate Stripe records (**10 Stripe customers**)

All **10** live Stripe customers missing from the legacy direct link can still be matched back to an existing represented client by alias/GHL/acronym.

- **True uncovered Stripe orphans:** **0**
- Only **1** of the 10 has positive MRR (**$395**)
- The other **9** are zero-MRR duplicate/alias Stripe records that already belong conceptually to existing clients

### Bucket 4 — shared / parent-account ambiguity in legacy links (**9 Stripe IDs shared across profiles**)

Legacy `ClientProfile.stripeCustomerId` is not one-to-one.

- **9** Stripe customer IDs are shared by multiple client profiles
- This makes client-level attribution ambiguous even when a Stripe ID is present
- The normalized `ClientStripeLink` layer is cleaner: **0** Stripe IDs are shared there

### Bucket 5 — Stripe metadata quality is still weak enough to slow clean matching

Among live Stripe customers (`active` + `past_due`):

- **71** are missing an acronym
- **49** are missing a company name

This is a major reason many remaining candidates are only matchable by email or GHL ID.

## Bottom line

- The dashboard is **not missing topline Stripe MRR**.
- The coverage problem is that we have **many more represented clients than billable/live Stripe customers**, and **185 clients currently show zero MRR**.
- Most of that gap is structural / expected from current data (**160 likely real zero/no-billing cases**), not a simple broken sync.
- The actual high-priority cleanup set is relatively small:
  - **25** zero-MRR client profiles needing mapping review
  - **1** positive-MRR Stripe customer still absent from the normalized link table
  - **9** legacy shared Stripe IDs creating attribution ambiguity

## Supporting artifacts

- `reports/missing-revenue-investigation.md`
- `scripts/audit-stripe-client-mapping.mjs`
- `scripts/audit-missing-revenue.mjs`
