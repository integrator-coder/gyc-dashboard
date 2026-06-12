require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  // Find Veronica Nelson recordings not matched to CTI
  const r = await pool.query(`
    SELECT id, topic, "startTime", acronym
    FROM "ZoomCall"
    WHERE (topic ILIKE '%veronica%' OR topic ILIKE '%veronica nelson%')
      AND (acronym IS NULL OR acronym != 'CTI')
    ORDER BY "startTime" DESC
  `);
  console.log('Unmatched Veronica recordings:', r.rows.length);
  r.rows.forEach(c => console.log(' ', c.startTime?.toISOString().slice(0,10)||'?', '|', c.topic));
  
  if (r.rows.length > 0) {
    const ids = r.rows.map(r => r.id);
    const updated = await pool.query(
      `UPDATE "ZoomCall" SET acronym='CTI', "tenantId"='gyc', "aiClassification"='client_meeting',
        "classifiedAs"='client_meeting', "classificationStatus"='classified', "clientProfileId"=80
      WHERE id = ANY($1)`, [ids]
    );
    console.log('Matched to CTI:', updated.rowCount);
  }
  
  // Also check if the Zoom sync might have pulled more "Veronica Nelson" recordings 
  // from the extended sync we ran - check in transcript text too
  const inTranscript = await pool.query(`
    SELECT id, topic, "startTime", acronym
    FROM "ZoomCall"
    WHERE "transcriptText" ILIKE '%veronica nelson%'
      AND (acronym IS NULL OR acronym != 'CTI')
    ORDER BY "startTime" DESC
  `);
  console.log('Veronica in transcript (unmatched):', inTranscript.rows.length);
  if (inTranscript.rows.length > 0) {
    const ids2 = inTranscript.rows.map(r => r.id);
    await pool.query(`UPDATE "ZoomCall" SET acronym='CTI', "tenantId"='gyc', "aiClassification"='client_meeting',
      "classifiedAs"='client_meeting', "classificationStatus"='classified', "clientProfileId"=80 WHERE id = ANY($1)`, [ids2]);
    console.log('Additional Veronica matches:', ids2.length);
  }
  
  const total = await pool.query(`SELECT COUNT(*) FROM "ZoomCall" WHERE acronym='CTI'`);
  console.log('Total CTI meetings now:', total.rows[0].count);
  
  // List all CTI meetings
  const all = await pool.query(`SELECT "startTime", topic FROM "ZoomCall" WHERE acronym='CTI' ORDER BY "startTime" DESC LIMIT 35`);
  console.log('\nAll CTI meetings:');
  all.rows.forEach(c => console.log(' ', c.startTime?.toISOString().slice(0,10)||'?', '|', c.topic?.slice(0,60)));
  
  await pool.end();
})().catch(e => console.error(e.message));
