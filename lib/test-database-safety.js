function assertSafeTestDatabaseUrl(value) {
  if (!value) throw new Error('TEST_DATABASE_URL is required for DB-backed integration tests')
  let url
  try { url = new URL(value) } catch { throw new Error('TEST_DATABASE_URL must be a valid PostgreSQL URL') }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('TEST_DATABASE_URL must use PostgreSQL')

  const host = url.hostname.toLowerCase()
  const database = decodeURIComponent(url.pathname.replace(/^\//, '')).toLowerCase()
  if (/neon|render\.com|render/.test(host)) throw new Error('Refusing hosted production-like database')
  if (database === 'gyc_dashboard' || !/(^|[_-])test($|[_-])|testdb|testing/.test(database)) {
    throw new Error('TEST_DATABASE_URL database name must be explicitly test-scoped')
  }
  return value
}

module.exports = { assertSafeTestDatabaseUrl }
