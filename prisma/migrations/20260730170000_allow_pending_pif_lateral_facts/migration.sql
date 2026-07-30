-- A business-confirmed PIF lateral must be visible immediately even when
-- contract cash, term, and recurring return timing still need verification.
ALTER TABLE "ChurnLateralMovement"
  ALTER COLUMN "termMonths" DROP NOT NULL,
  ALTER COLUMN "scheduledReturnDate" DROP NOT NULL;
