import fs from 'node:fs'
import pg from 'pg'

const secrets = JSON.parse(fs.readFileSync(`${process.env.HOME}/.openclaw/secrets.json`, 'utf8'))
const connectionString = secrets.NEON_DATABASE_URL || secrets.DATABASE_URL
if (!connectionString) throw new Error('Database credential unavailable')

const sql = fs.readFileSync(new URL('./sql/fix-oct-nov-2026-collectible-mrr.sql', import.meta.url), 'utf8')
const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } })

try {
  const results = await pool.query(sql)
  console.log(JSON.stringify({ before: results[1].rows, corrected: results[3].rows }, null, 2))
} finally {
  await pool.end()
}
