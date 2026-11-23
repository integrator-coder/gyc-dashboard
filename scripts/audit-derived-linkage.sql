SELECT
  status,
  COUNT(*)::int AS customer_count,
  ROUND(COALESCE(SUM(mrr), 0)::numeric, 2) AS mrr
FROM "StripeCustomer"
GROUP BY status
ORDER BY status;

SELECT
  ROUND(COALESCE(SUM(mrr) FILTER (WHERE status = 'active'), 0)::numeric, 2) AS active_mrr,
  ROUND(COALESCE(SUM(mrr) FILTER (WHERE status = 'past_due'), 0)::numeric, 2) AS past_due_mrr,
  ROUND(COALESCE(SUM(mrr) FILTER (WHERE status = 'unpaid'), 0)::numeric, 2) AS unpaid_mrr,
  ROUND(COALESCE(SUM(mrr) FILTER (WHERE status IN ('active', 'past_due', 'unpaid')), 0)::numeric, 2) AS contracted_mrr,
  COUNT(*) FILTER (WHERE status = 'active')::int AS active_count,
  COUNT(*) FILTER (WHERE status IN ('active', 'past_due', 'unpaid'))::int AS contracted_count
FROM "StripeCustomer";

SELECT
  ROUND(COALESCE(SUM(amount) FILTER (WHERE date::date = CURRENT_DATE), 0)::numeric, 2) AS today_cash,
  ROUND(COALESCE(SUM(amount) FILTER (WHERE date::date = CURRENT_DATE - 1), 0)::numeric, 2) AS yesterday_cash,
  ROUND(COALESCE(SUM(amount) FILTER (WHERE date::date >= CURRENT_DATE - 6), 0)::numeric, 2) AS cash_7d,
  ROUND(COALESCE(SUM(amount) FILTER (WHERE date::date >= CURRENT_DATE - 29), 0)::numeric, 2) AS cash_30d,
  ROUND(COALESCE(SUM(amount) FILTER (WHERE date::date >= date_trunc('year', CURRENT_DATE)), 0)::numeric, 2) AS cash_ytd
FROM "DailyRevenue";

SELECT mrr, "totalRevenue", "activeCustomers", "syncedAt"
FROM "StripeMetrics"
ORDER BY "syncedAt" DESC
LIMIT 2;

SELECT id, "asOf", payload->'meta'->>'schemaVersion' AS schema_version
FROM "LeadershipSnapshot"
ORDER BY "asOf" DESC
LIMIT 3;
