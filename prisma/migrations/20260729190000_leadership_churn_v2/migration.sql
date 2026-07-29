ALTER TABLE "ChurnClassification" ADD COLUMN IF NOT EXISTS "logoOutcome" TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE "ChurnClassification" ADD COLUMN IF NOT EXISTS "programOutcome" TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE "ChurnClassification" ADD COLUMN IF NOT EXISTS "destinationProgram" TEXT;
ALTER TABLE "ChurnClassification" ADD COLUMN IF NOT EXISTS "destinationMRR" NUMERIC(12,2);
ALTER TABLE "ChurnClassification" ADD COLUMN IF NOT EXISTS "pifCash" NUMERIC(12,2);
ALTER TABLE "ChurnClassification" ADD COLUMN IF NOT EXISTS "pifTermMonths" INT;
ALTER TABLE "ChurnClassification" ADD COLUMN IF NOT EXISTS "expectedReturnDate" DATE;
ALTER TABLE "ChurnClassification" ADD COLUMN IF NOT EXISTS "reviewStatus" TEXT NOT NULL DEFAULT 'needs_review';
ALTER TABLE "ChurnClassification" ADD COLUMN IF NOT EXISTS "confidence" TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE "ChurnClassification" ADD COLUMN IF NOT EXISTS "evidence" TEXT;
ALTER TABLE "ChurnClassification" ADD COLUMN IF NOT EXISTS "reasonCategory" TEXT;
ALTER TABLE "ChurnClassification" ADD COLUMN IF NOT EXISTS "reason" TEXT;
ALTER TABLE "ChurnClassification" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'provisional';
ALTER TABLE "ChurnClassification" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "ChurnClassification" ADD COLUMN IF NOT EXISTS "pifLifecycleStatus" TEXT;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT conname FROM pg_constraint WHERE conrelid='"ChurnClassification"'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%classificationType%'
  LOOP EXECUTE format('ALTER TABLE "ChurnClassification" DROP CONSTRAINT %I',r.conname); END LOOP;
END $$;
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
ALTER TABLE "ChurnClassification" DROP CONSTRAINT IF EXISTS "ChurnClassification_taxonomy_outcome_check";
ALTER TABLE "ChurnClassification" ADD CONSTRAINT "ChurnClassification_taxonomy_outcome_check" CHECK (
 ("classificationType"='true_logo_churn' AND "logoOutcome"='exited' AND "programOutcome"='exited') OR
 ("classificationType"='program_churn' AND "logoOutcome"='retained' AND "programOutcome"='exited') OR
 ("classificationType"='internal_lateral' AND "logoOutcome"='retained' AND "programOutcome"='migrated') OR
 ("classificationType"='pif_deferred' AND "logoOutcome"='retained' AND "programOutcome"='deferred') OR
 ("classificationType" IN ('billing_replacement','duplicate_artifact') AND "logoOutcome"='retained' AND "programOutcome"='replaced') OR
 ("classificationType"='unknown' AND "logoOutcome"='unknown' AND "programOutcome"='unknown'));
ALTER TABLE "ChurnClassification" DROP CONSTRAINT IF EXISTS "ChurnClassification_pif_status_check";
ALTER TABLE "ChurnClassification" ADD CONSTRAINT "ChurnClassification_pif_status_check" CHECK ("pifLifecycleStatus" IS NULL OR "pifLifecycleStatus" IN ('proposed','pending_payment','active','return_due_60','return_due_30','return_due_7','returned','renewed_pif','true_churn_at_term','overdue_unresolved'));
