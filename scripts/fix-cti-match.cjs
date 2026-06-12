require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  // Fix wrongly matched Crouthers Academy call
  const fix = await pool.query(`
    UPDATE "ZoomCall" SET acronym='CAEC', "clientProfileId"=NULL
    WHERE acronym='CTI' AND topic ILIKE '%crouthers%'
  `);
  console.log('Removed Crouthers from CTI:', fix.rowCount);
  
  // The "Veronica Nelson | Grow Your Center" calls are from Seb's meeting room
  // but "Veronica Nelson" shows as the meeting room name - these should already be matched
  // Check if there are any recordings in Zoom with "Veronica Nelson" in title not yet pulled
  const total = await pool.query(`SELECT COUNT(*) FROM "ZoomCall" WHERE acronym='CTI'`);
  console.log('Final CTI meeting count:', total.rows[0].count);
  
  // Show the most recent 5
  const recent = await pool.query(`SELECT "startTime", topic FROM "ZoomCall" WHERE acronym='CTI' ORDER BY "startTime" DESC LIMIT 5`);
  console.log('\nMost recent CTI meetings:');
  recent.rows.forEach(c => console.log(' ', c.startTime?.toISOString().slice(0,10), '|', c.topic?.slice(0,55)));
  
  await pool.end();
})().catch(e => console.error(e.message));
