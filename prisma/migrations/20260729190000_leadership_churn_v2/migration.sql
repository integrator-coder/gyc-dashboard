ALTER TABLE "ChurnClassification" ADD COLUMN IF NOT EXISTS "logoOutcome" TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE "ChurnClassification" ADD COLUMN IF NOT EXISTS "programOutcome" TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE "ChurnClassification" ADD COLUMN IF NOT EXISTS "destinationProgram" TEXT;
ALTER TABLE "ChurnClassification" ADD COLUMN IF NOT EXISTS "destinationMRR" NUMERIC(12,2);
ALTER TABLE "ChurnClassification" ADD COLUMN IF NOT EXISTS "pifCash" NUMERIC(12,2);
ALTER TABLE "ChurnClassification" ADD COLUMN IF NOT EXISTS "expectedReturnDate" DATE;
ALTER TABLE "ChurnClassification" ADD COLUMN IF NOT EXISTS "reviewStatus" TEXT NOT NULL DEFAULT 'needs_review';
ALTER TABLE "ChurnClassification" ADD COLUMN IF NOT EXISTS "confidence" TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE "ChurnClassification" ADD COLUMN IF NOT EXISTS "evidence" TEXT;
ALTER TABLE "ChurnClassification" ADD COLUMN IF NOT EXISTS "reasonCategory" TEXT;
UPDATE "ChurnClassification" SET "classificationType" = CASE "classificationType"
  WHEN 'logo_churn' THEN 'true_logo_churn'
  WHEN 'lateral_migration' THEN 'internal_lateral'
  WHEN 'pif_lateral' THEN 'pif_deferred'
  WHEN 'unclassified' THEN 'unknown'
  ELSE "classificationType" END;
UPDATE "ChurnClassification" SET
  "logoOutcome" = CASE WHEN "classificationType" = 'true_logo_churn' THEN 'exited' WHEN "classificationType" = 'unknown' THEN 'unknown' ELSE 'retained' END,
  "programOutcome" = CASE "classificationType" WHEN 'true_logo_churn' THEN 'exited' WHEN 'program_churn' THEN 'exited' WHEN 'internal_lateral' THEN 'migrated' WHEN 'pif_deferred' THEN 'deferred' WHEN 'billing_replacement' THEN 'replaced' WHEN 'duplicate_artifact' THEN 'replaced' ELSE 'unknown' END;
ALTER TABLE "ChurnClassification" DROP CONSTRAINT IF EXISTS "ChurnClassification_type_v2_check";
ALTER TABLE "ChurnClassification" ADD CONSTRAINT "ChurnClassification_type_v2_check" CHECK ("classificationType" IN ('true_logo_churn','program_churn','internal_lateral','pif_deferred','billing_replacement','duplicate_artifact','unknown'));
ALTER TABLE "ChurnClassification" DROP CONSTRAINT IF EXISTS "ChurnClassification_logo_outcome_check";
ALTER TABLE "ChurnClassification" ADD CONSTRAINT "ChurnClassification_logo_outcome_check" CHECK ("logoOutcome" IN ('retained','exited','unknown'));
ALTER TABLE "ChurnClassification" DROP CONSTRAINT IF EXISTS "ChurnClassification_program_outcome_check";
ALTER TABLE "ChurnClassification" ADD CONSTRAINT "ChurnClassification_program_outcome_check" CHECK ("programOutcome" IN ('retained','exited','migrated','deferred','replaced','unknown'));
