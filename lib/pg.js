import pkg from 'pg'

const { Pool } = pkg

const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL

const globalForPg = globalThis

export const pool = globalForPg.__gycPgPool ?? new Pool({
  connectionString,
  ssl: connectionString ? { rejectUnauthorized: false } : undefined,
})

if (process.env.NODE_ENV !== 'production') {
  globalForPg.__gycPgPool = pool
}

export async function tableExists(tableName) {
  const { rows } = await pool.query('SELECT to_regclass($1) AS regclass', [tableName])
  return Boolean(rows[0]?.regclass)
}
