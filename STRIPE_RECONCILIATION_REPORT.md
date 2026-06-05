# Stripe Multi-Subscription Reconciliation Report
**Date:** June 1, 2026  
**Investigator:** Wall·E (Subagent stripe-link-fix)

## Critical Finding: Expired Stripe API Key

**BLOCKER:** Both Stripe API keys in the codebase are expired:
- Key in `scripts/sync-stripe.js` (hardcoded): `rk_***_redacted***` ❌ EXPIRED
- Key in `.env.local`: `rk_***_redacted***` ❌ EXPIRED

**Impact:**
- Cannot run `sync-stripe.js` to refresh data
- Cannot query Stripe API directly to verify subscription counts
- Dashboard MRR data is stale (last successful sync: unknown)

**Required Action:**
1. Todd needs to generate a new Stripe API key from the Stripe dashboard
2. Update `.env.local` with the new key
3. Update `scripts/sync-stripe.js` (line 9) to use `process.env.STRIPE_SECRET_KEY` instead of hardcoded key
4. Run `node scripts/sync-stripe.js` to get fresh data

---

## Understanding the Current Architecture

### How Stripe Data Flows

1. **Stripe API** → Multiple customers, each with 1+ subscriptions
2. **sync-stripe.js** → Aggregates subscriptions **per Stripe customer ID**
3. **StripeCustomer table** → One row = one Stripe customer ID (with total MRR for all their subscriptions)
4. **ClientStripeLink table** → Maps ClientProfile (GYC's client) to StripeCustomer (Stripe's customer)
5. **Dashboard** → Sums MRR across all linked StripeCustomer records per ClientProfile

### The Design is Correct

The architecture properly handles multi-subscription scenarios:
- One Stripe customer with 2 subscriptions → sync creates 1 StripeCustomer row with combined MRR ✓
- One GYC client with 2 Stripe customer IDs → ClientStripeLink links both → dashboard sums both ✓

### Example: Alisha Ramsey / The Tot Spot

**Database state (as of investigation):**

ClientProfile ID 292: "The Tot Spot Early Education Academy"
- `hasCommand: true`
- Linked to 2 Stripe customer IDs:
  - `cus_K3orgBUqR8OaRt`: $227 MRR, active
  - `cus_MjWx2DMiZqvAAr`: $0 MRR, active ⚠️
- **Total shown:** $227

**Lex's report:** Missing $1,618.20 (command subscription)

**Diagnosis:** Either:
1. The $1,618.20 subscription exists in Stripe under a different customer ID (not yet linked), OR
2. The Stripe sync is stale and the subscription isn't in the database at all

---

## Investigation Results

### ✅ All Active StripeCustomer Records Are Linked

Checked: 286 active Stripe customers  
Unlinked: 0

**Conclusion:** The linking system is working. If a StripeCustomer exists in the DB, it's linked to a ClientProfile.

### ⚠️ Cannot Verify Stripe Source of Truth

Due to expired API key, I cannot:
- Query Stripe for actual subscription counts per customer
- Search for additional customer IDs that might match affected clients
- Verify whether missing subscriptions exist in Stripe but aren't synced

---

## Affected Clients (Per Lex's Feedback)

| Client | Missing Subscription | Amount | Notes |
|--------|---------------------|--------|-------|
| Alisha Ramsey (Tot Spot) | Command | $1,618.20 | Has 2 linked Stripe IDs, one shows $0 |
| Morgan Palmer | Google Ads | $1,195 | Lex notes: always $395 until evergreen $197 in June |
| Ruth Porta | Influence | $1,620 | |
| MCA | Paid Media 1 | $995 | Payment just resolved |
| Tamara Jefferson | Blueprint | $1,119 | |
| Situ Millawabandara (AMS) | Command | $1,349.10 | |
| AKW (akwchildcare.com) | 2 of 3 split payments | $1,201.33 each | Splits bill across 3 payment methods |
| Kelly Lauber | Blueprint | $629.10 | |
| Jennifer House | Evergreen + Social | $317 + $1,562 | Two separate subs |
| Cindi Webb | Evergreen (2nd) | $197 | Has 2 evergreen subs |
| Juan Gil | Web translator + Core | $20 + $405 | Two separate subs |
| Chad Taylor | Evergreen | $197 | |

### Additional Data Quality Issues

| Client | Issue | Notes |
|--------|-------|-------|
| HTCDC | Initial payment failed, now resolved | Verify current MRR is correct |
| Leonard Turnquist (TCLA) | Two Stripe profiles | finance@tclacademy.net - one PIF (Oct), one evergreen |
| LA (unknown acronym) | Wrong MRR in my data | I had $514, Lex says always $395 until evergreen $197 in May |
| MP (unknown acronym) | Wrong MRR in my data | I had $227 or $622, Lex says always $395 |

---

## Root Cause Analysis

### Why Are Subscriptions Missing?

**Theory 1: Stripe Sync Missed Them**
- The sync script only syncs subscriptions with status: `active`, `past_due`, `trialing`
- If a subscription had a different status during last sync, it wouldn't be captured
- Solution: Run sync with fresh API key

**Theory 2: Multiple Stripe Customer IDs Not Linked**
- Some clients use multiple emails/payment methods → multiple Stripe customer IDs
- If a ClientStripeLink wasn't created for a secondary customer ID, that subscription won't show
- Solution: Match all Stripe customers by email/name/company and ensure links exist

**Theory 3: Tiered Pricing Edge Cases**
- The `calcSubMrr()` function has special handling for tiered pricing
- If `latest_invoice.amount_due` is missing or 0, it returns $0 even if subscription is active
- Solution: Investigate StripeCustomer records with $0 MRR but `status='active'`

---

## Recommended Action Plan

### Phase 1: Restore Stripe API Access (CRITICAL)
1. **Generate new Stripe API key** (restricted key with read-only subscription + customer access)
2. **Update .env.local:** `STRIPE_SECRET_KEY=sk_live_...`
3. **Fix sync-stripe.js:** Replace hardcoded key with `process.env.STRIPE_SECRET_KEY`
4. **Test connection:** `node -e "const s = require('stripe')(process.env.STRIPE_SECRET_KEY); s.customers.list({limit:1}).then(console.log)"`

### Phase 2: Fresh Sync
1. **Backup current data:** `pg_dump` or export StripeCustomer table
2. **Run sync:** `cd /Users/toddthejedigmail.com/.openclaw/workspace/gyc-dashboard && node scripts/sync-stripe.js`
3. **Verify:** Check SyncLog table for success message + subscription counts

### Phase 3: Match Missing Subscriptions
1. **For each affected client:**
   - Search Stripe API for all customer IDs matching their email/name/company
   - Verify each customer ID has a ClientStripeLink
   - If missing: Create the link manually
   
2. **SQL to find candidates:**
   ```sql
   -- Find Stripe customers that might belong to a client but aren't linked
   SELECT sc.id, sc.email, sc.name, sc.mrr, sc.status
   FROM "StripeCustomer" sc
   WHERE sc.email ILIKE '%alisha%'
      OR sc.email ILIKE '%totspot%'
      OR sc.name ILIKE '%alisha%'
      OR sc.name ILIKE '%tot spot%'
   ```

3. **Create missing links:**
   ```sql
   INSERT INTO "ClientStripeLink" ("clientProfileId", "stripeCustomerId", "tenantId", "createdAt")
   VALUES (292, 'cus_XYZ123ABC', 'gyc', NOW())
   ON CONFLICT DO NOTHING;
   ```

### Phase 4: Investigate $0 MRR Records
1. **Find active subs with $0 MRR:**
   ```sql
   SELECT * FROM "StripeCustomer"
   WHERE status IN ('active', 'trialing', 'past_due')
     AND mrr = 0
   ORDER BY "updatedAt" DESC
   LIMIT 50;
   ```

2. **For each:** Query Stripe API directly to check actual subscription amounts
3. **Re-calculate MRR** using corrected `calcSubMrr()` logic if needed

### Phase 5: Validate & Report
1. **For each affected client:**
   - Query dashboard API: `GET /api/clients/list?search={client name}`
   - Compare old MRR vs new MRR
   - Document what was missing

2. **Generate reconciliation report:**
   - Client name
   - Old MRR (before fix)
   - New MRR (after fix)
   - Missing subscription(s)
   - Stripe customer ID(s) added

---

## Implementation Notes

### Automated Reconciliation Script (To Be Written)

```javascript
// scripts/reconcile-multi-subscriptions.mjs
// Purpose: Find and link all Stripe customers for each ClientProfile

const { PrismaClient } = require('@prisma/client');
const Stripe = require('stripe');

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function reconcile() {
  // 1. Get all ClientProfiles
  const clients = await prisma.clientProfile.findMany({
    where: { tenantId: 'gyc', status: 'active' }
  });

  for (const client of clients) {
    console.log(`\nChecking client: ${client.companyName}`);
    
    // 2. Find all Stripe customers matching email/name
    const searchTerms = [
      client.email?.toLowerCase(),
      client.companyName?.toLowerCase(),
      client.ownerName?.toLowerCase()
    ].filter(Boolean);

    const matchedStripeIds = new Set();

    for (const term of searchTerms) {
      // Search StripeCustomer table
      const matches = await prisma.stripeCustomer.findMany({
        where: {
          OR: [
            { email: { contains: term, mode: 'insensitive' } },
            { name: { contains: term, mode: 'insensitive' } },
            { companyName: { contains: term, mode: 'insensitive' } }
          ],
          status: { in: ['active', 'trialing', 'past_due'] }
        }
      });

      matches.forEach(m => matchedStripeIds.add(m.id));
    }

    // 3. Get existing links
    const existingLinks = await prisma.clientStripeLink.findMany({
      where: { clientProfileId: client.id }
    });
    const linkedIds = new Set(existingLinks.map(l => l.stripeCustomerId));

    // 4. Find unlinked matches
    const unlinked = [...matchedStripeIds].filter(id => !linkedIds.has(id));

    if (unlinked.length > 0) {
      console.log(`  Found ${unlinked.length} unlinked Stripe customer(s):`);
      
      for (const stripeId of unlinked) {
        const stripeCustomer = await prisma.stripeCustomer.findUnique({
          where: { id: stripeId }
        });
        
        console.log(`    - ${stripeId}: ${stripeCustomer.email}, MRR: $${stripeCustomer.mrr}`);
        
        // Create link
        await prisma.clientStripeLink.create({
          data: {
            clientProfileId: client.id,
            stripeCustomerId: stripeId,
            tenantId: 'gyc',
            linkSource: 'reconciliation',
            matchMethod: 'email_or_name_match',
            matchConfidence: 'high'
          }
        });
        
        console.log(`    ✓ Linked`);
      }
    }
  }

  await prisma.$disconnect();
}

reconcile().catch(console.error);
```

---

## Status: BLOCKED

Cannot proceed without valid Stripe API key. Once key is updated, I can:
1. Run fresh sync
2. Query Stripe API to find missing customers
3. Create ClientStripeLinks for unlinked customers
4. Generate full reconciliation report

**Next step:** Todd needs to provide a valid Stripe API key.
