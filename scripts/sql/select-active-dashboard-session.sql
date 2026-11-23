SELECT s."sessionToken"
FROM "Session" s
JOIN "User" u ON u.id = s."userId"
WHERE s.expires > NOW()
  AND (u.disabled IS NULL OR u.disabled = FALSE)
  AND lower(u.role) IN ('superadmin', 'admin')
ORDER BY s.expires DESC
LIMIT 1;
