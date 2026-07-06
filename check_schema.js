const { Pool } = require('pg');
const fs = require('fs');

async function main() {
  const env = fs.readFileSync('/Users/toddthejedigmail.com/.openclaw/workspace/gyc-dashboard/.env.local', 'utf8');
  const match = env.match(/^DATABASE_URL=(.+)$/m);
  const dbUrl = match[1].trim();
  const pool = new Pool({ connectionString: dbUrl });

  try {
    // List all tables
    const tables = await pool.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);
    console.log('Available tables:');
    console.log(tables.rows.map(r => r.tablename).join('\n'));

  } finally {
    await pool.end();
  }
}

main().catch(console.error);
