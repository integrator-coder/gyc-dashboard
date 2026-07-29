-- A PIF movement may remove one program from a multi-program Stripe
-- subscription. The subscription's current total is therefore not a reliable
-- source-MRR or product identifier.
ALTER TABLE "ChurnLateralMovement"
  ADD COLUMN IF NOT EXISTS "sourceProgram" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceProductId" TEXT,
  ADD COLUMN IF NOT EXISTS "sourcePriceId" TEXT,
  ALTER COLUMN "pifCashReceived" DROP NOT NULL;
