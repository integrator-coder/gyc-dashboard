import fs from 'node:fs'
import pg from 'pg'

const secrets = JSON.parse(fs.readFileSync(`${process.env.HOME}/.openclaw/secrets.json`, 'utf8'))
const connectionString = secrets.NEON_DATABASE_URL || secrets.DATABASE_URL
if (!connectionString) throw new Error('Database credential unavailable')

const sql = fs.readFileSync(new URL('./sql/select-active-dashboard-session.sql', import.meta.url), 'utf8')
const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } })

try {
  const { rows } = await pool.query(sql)
  const sessionToken = rows[0]?.sessionToken
  if (!sessionToken) throw new Error('No active admin dashboard session is available for verification')

  const baseUrl = process.argv[2] || 'https://gyc-dashboard-ra9a.onrender.com'
  const response = await fetch(`${baseUrl}/api/metrics/finance/mrr-trend`, {
    headers: { cookie: `gyc_session=${sessionToken}` },
  })
  if (!response.ok) throw new Error(`MRR trend request failed: HTTP ${response.status}`)
  const points = await response.json()
  console.log(JSON.stringify(points.filter((point) => point.month >= '2026-07'), null, 2))
} finally {
  await pool.end()
}
