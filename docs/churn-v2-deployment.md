# Churn v2 deployment order

Do not deploy or recompute until the Stripe key and stable logo mappings pass the existing data-quality gates.

1. Apply `20260729190000_leadership_churn_v2` in one database transaction. The migration is idempotent, translates legacy taxonomy before installing v2 checks, and must finish before application traffic uses v2 fields.
2. Deploy the application/API commit. The API intentionally returns `LEADERSHIP_CHURN_SCHEMA_OR_DATA_ERROR` if the schema is missing or contradictory; it never substitutes an empty leadership payload.
3. Run the monthly recompute once. Event persistence and monthly metric writes must use the same release. If any stable logo, PIF mapping, or taxonomy constraint fails, roll back the recompute transaction and leave the prior metrics visible.
4. Verify `standalone programs lost + programs lost with logo exit = MonthlyChurnMetrics.programsLost`, then enable the scheduled recompute.

Never run application-first against the legacy schema, and never run the v2 recompute with legacy application code.
