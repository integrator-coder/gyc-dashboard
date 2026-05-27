require('dotenv').config({ path: '/Users/toddthejedigmail.com/.openclaw/workspace/gyc-dashboard/.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const pairs = [
  ['ClientProfile', 'ClientProfile_id_seq'],
  ['ClientStripeLink', 'ClientStripeLink_id_seq'],
  ['GBPLocation', 'GBPLocation_id_seq'],
];

async function run() {
  for (const [tbl, seq] of pairs) {
    const maxR = await pool.query(`SELECT COALESCE(MAX(id),1) AS m FROM "${tbl}"`);
    const maxVal = maxR.rows[0].m;
    const seqR = await pool.query(`SELECT setval('"${seq}"', ${maxVal})`);
    console.log(`${tbl} → ${seqR.rows[0].setval}`);
  }
  pool.end();
}
run().catch(e => { console.error(e.message); pool.end(); });
