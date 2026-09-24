-- A Stripe customer may legitimately pay for multiple centers. Enforce the
-- primary-link invariant per center, not per Stripe customer.
DROP INDEX IF EXISTS "ClientStripeLink_one_primary_per_stripe";

CREATE UNIQUE INDEX IF NOT EXISTS "ClientStripeLink_one_primary_per_client"
  ON "ClientStripeLink" ("tenantId", "clientProfileId")
  WHERE "isPrimary" = true;
