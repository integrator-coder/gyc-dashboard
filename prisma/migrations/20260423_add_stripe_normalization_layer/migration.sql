CREATE TABLE IF NOT EXISTS "ClientStripeLink" (
  "id" BIGSERIAL PRIMARY KEY,
  "tenantId" TEXT NOT NULL DEFAULT 'gyc',
  "clientProfileId" INTEGER NOT NULL REFERENCES "ClientProfile"("id") ON DELETE CASCADE,
  "stripeCustomerId" TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "linkSource" TEXT NOT NULL DEFAULT 'system',
  "matchMethod" TEXT,
  "matchConfidence" TEXT NOT NULL DEFAULT 'medium',
  "matchScore" INTEGER,
  "matchSignals" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "notes" TEXT,
  "firstLinkedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "lastSeenAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE("tenantId", "clientProfileId", "stripeCustomerId")
);

CREATE TABLE IF NOT EXISTS "StripeInvoiceSnapshot" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL DEFAULT 'gyc',
  "stripeCustomerId" TEXT NOT NULL,
  "subscriptionId" TEXT,
  "chargeId" TEXT,
  "paymentIntentId" TEXT,
  "invoiceNumber" TEXT,
  "status" TEXT,
  "billingReason" TEXT,
  "currency" TEXT DEFAULT 'usd',
  "amountDue" NUMERIC(12,2),
  "amountPaid" NUMERIC(12,2),
  "amountRemaining" NUMERIC(12,2),
  "subtotal" NUMERIC(12,2),
  "total" NUMERIC(12,2),
  "attemptCount" INTEGER,
  "attempted" BOOLEAN,
  "paid" BOOLEAN,
  "forgiven" BOOLEAN,
  "collectionMethod" TEXT,
  "dueDate" TIMESTAMP,
  "periodStart" TIMESTAMP,
  "periodEnd" TIMESTAMP,
  "invoiceCreatedAt" TIMESTAMP,
  "paidAt" TIMESTAMP,
  "hostedInvoiceUrl" TEXT,
  "invoicePdf" TEXT,
  "description" TEXT,
  "rawLines" JSONB,
  "lastPaymentError" TEXT,
  "syncedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "ClientStripeLink_tenant_client_idx"
  ON "ClientStripeLink" ("tenantId", "clientProfileId");

CREATE INDEX IF NOT EXISTS "ClientStripeLink_tenant_stripe_idx"
  ON "ClientStripeLink" ("tenantId", "stripeCustomerId");

CREATE INDEX IF NOT EXISTS "ClientStripeLink_primary_idx"
  ON "ClientStripeLink" ("tenantId", "clientProfileId", "isPrimary");

CREATE UNIQUE INDEX IF NOT EXISTS "ClientStripeLink_one_primary_per_client"
  ON "ClientStripeLink" ("tenantId", "clientProfileId")
  WHERE "isPrimary" = true;

CREATE UNIQUE INDEX IF NOT EXISTS "ClientStripeLink_one_primary_per_stripe"
  ON "ClientStripeLink" ("tenantId", "stripeCustomerId")
  WHERE "isPrimary" = true;

CREATE INDEX IF NOT EXISTS "StripeInvoiceSnapshot_tenant_customer_idx"
  ON "StripeInvoiceSnapshot" ("tenantId", "stripeCustomerId");

CREATE INDEX IF NOT EXISTS "StripeInvoiceSnapshot_tenant_created_idx"
  ON "StripeInvoiceSnapshot" ("tenantId", "invoiceCreatedAt" DESC);

CREATE INDEX IF NOT EXISTS "StripeInvoiceSnapshot_tenant_status_idx"
  ON "StripeInvoiceSnapshot" ("tenantId", "status");
