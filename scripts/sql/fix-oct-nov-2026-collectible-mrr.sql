BEGIN;

SELECT month, mrr, "newMrr", "churnedMrr", "activeSubscriptions", "syncedAt"
FROM "MRRHistory"
WHERE "tenantId" = 'gyc' AND month IN ('2026-10', '2026-11')
ORDER BY month;

WITH october AS (
  SELECT ROUND(mrr::numeric, 2) AS mrr, "activeCustomers" AS customer_count
  FROM "StripeMetrics"
  WHERE "tenantId" = 'gyc'
    AND "syncedAt" >= TIMESTAMPTZ '2026-10-31 00:00:00 America/Toronto'
    AND "syncedAt" < TIMESTAMPTZ '2026-11-01 00:00:00 America/Toronto'
    AND "activeCustomers" < 320
  ORDER BY "syncedAt" DESC
  LIMIT 1
), november AS (
  SELECT ROUND(COALESCE(SUM(mrr), 0)::numeric, 2) AS mrr, COUNT(*)::int AS customer_count
  FROM "StripeCustomer"
  WHERE "tenantId" = 'gyc' AND status IN ('active', 'past_due')
), corrected(month, mrr, customer_count) AS (
  SELECT '2026-10', mrr, customer_count FROM october
  UNION ALL
  SELECT '2026-11', mrr, customer_count FROM november
)
INSERT INTO "MRRHistory"
  ("tenantId", month, mrr, "newMrr", "churnedMrr", "expansionMrr", "activeSubscriptions", "syncedAt")
SELECT 'gyc', month, mrr, NULL, NULL, NULL, customer_count, NOW()
FROM corrected
ON CONFLICT ("tenantId", month) DO UPDATE SET
  mrr = EXCLUDED.mrr,
  "newMrr" = EXCLUDED."newMrr",
  "churnedMrr" = EXCLUDED."churnedMrr",
  "expansionMrr" = EXCLUDED."expansionMrr",
  "activeSubscriptions" = EXCLUDED."activeSubscriptions",
  "syncedAt" = EXCLUDED."syncedAt";

SELECT month, mrr, "newMrr", "churnedMrr", "activeSubscriptions", "syncedAt"
FROM "MRRHistory"
WHERE "tenantId" = 'gyc' AND month IN ('2026-10', '2026-11')
ORDER BY month;

COMMIT;
