import fs from 'node:fs'
import pg from 'pg'

const secrets = JSON.parse(fs.readFileSync(`${process.env.HOME}/.openclaw/secrets.json`, 'utf8'))
const connectionString = secrets.NEON_DATABASE_URL || secrets.DATABASE_URL
if (!connectionString) throw new Error('Database credential unavailable')

const sql = fs.readFileSync(new URL('./sql/audit-collectible-mrr-trend.sql', import.meta.url), 'utf8')
const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } })

try {
  const results = await pool.query(sql)
  console.log(JSON.stringify({ snapshots: results[0].rows, mrrHistory: results[1].rows, chartTail: results[2].rows }, null, 2))
} finally {
  await pool.end()
}
