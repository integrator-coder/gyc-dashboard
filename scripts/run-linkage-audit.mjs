import fs from 'node:fs'
import pg from 'pg'

const secrets = JSON.parse(fs.readFileSync(`${process.env.HOME}/.openclaw/secrets.json`, 'utf8'))
const connectionString = secrets.NEON_DATABASE_URL || secrets.DATABASE_URL
if (!connectionString) throw new Error('Database connection string is unavailable')

const sql = fs.readFileSync(new URL('./audit-derived-linkage.sql', import.meta.url), 'utf8')
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } })
await client.connect()
try {
  const results = await client.query(sql)
  results.forEach((result, index) => {
    process.stdout.write(`\nResult ${index + 1}\n`)
    console.table(result.rows)
  })
} finally {
  await client.end()
}
