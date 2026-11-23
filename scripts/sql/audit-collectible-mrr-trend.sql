SELECT
  to_char("syncedAt" AT TIME ZONE 'America/Toronto', 'YYYY-MM') AS month,
  (array_agg(ROUND(mrr::numeric, 2) ORDER BY "syncedAt" DESC)
    FILTER (WHERE "activeCustomers" < 320))[1] AS latest_collectible_mrr,
  (array_agg("syncedAt" ORDER BY "syncedAt" DESC)
    FILTER (WHERE "activeCustomers" < 320))[1] AS snapshot_at,
  (array_agg("activeCustomers" ORDER BY "syncedAt" DESC)
    FILTER (WHERE "activeCustomers" < 320))[1] AS active_customers,
  COUNT(*) FILTER (WHERE "activeCustomers" >= 320) AS excluded_known_bad_snapshots
FROM "StripeMetrics"
WHERE "tenantId" = 'gyc'
  AND "syncedAt" >= TIMESTAMPTZ '2026-05-01 America/Toronto'
GROUP BY 1
ORDER BY 1;

SELECT month, mrr, "newMrr", "churnedMrr", "activeSubscriptions", "syncedAt"
FROM "MRRHistory"
WHERE "tenantId" = 'gyc' AND month BETWEEN '2026-05' AND '2026-11'
ORDER BY month;

WITH snapshot_overrides AS (
  SELECT DISTINCT ON (to_char("syncedAt" AT TIME ZONE 'America/Toronto', 'YYYY-MM'))
    to_char("syncedAt" AT TIME ZONE 'America/Toronto', 'YYYY-MM') AS month,
    ROUND(mrr::numeric, 2) AS mrr
  FROM "StripeMetrics"
  WHERE "tenantId" = 'gyc'
    AND "syncedAt" >= TIMESTAMPTZ '2026-09-01 America/Toronto'
    AND "syncedAt" < TIMESTAMPTZ '2026-11-01 America/Toronto'
    AND "activeCustomers" < 320
  ORDER BY 1, "syncedAt" DESC
), live_current AS (
  SELECT to_char(CURRENT_TIMESTAMP AT TIME ZONE 'America/Toronto', 'YYYY-MM') AS month,
    ROUND(COALESCE(SUM(mrr), 0)::numeric, 2) AS mrr
  FROM "StripeCustomer"
  WHERE "tenantId" = 'gyc' AND status IN ('active', 'past_due')
), chart_tail AS (
  SELECT h.month, COALESCE(s.mrr, h.mrr) AS mrr
  FROM "MRRHistory" h
  LEFT JOIN snapshot_overrides s USING (month)
  WHERE h."tenantId" = 'gyc' AND h.month BETWEEN '2026-07' AND '2026-11'
)
SELECT t.month, CASE WHEN c.month = t.month THEN c.mrr ELSE t.mrr END AS mrr
FROM chart_tail t CROSS JOIN live_current c
ORDER BY t.month;
