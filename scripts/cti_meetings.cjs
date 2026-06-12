require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const ctiDates = [
  '2026-05-21','2026-04-08','2026-01-14',
  '2025-08-13','2025-07-09','2025-06-11','2025-05-14','2025-04-14','2025-04-09',
  '2024-12-11','2024-08-14','2024-07-26','2024-07-10','2024-06-12','2024-05-23',
  '2024-03-13','2024-02-14','2024-01-09',
  '2023-12-05','2023-11-08','2023-10-03','2023-11-16'
];

// Check CTI's clientProfileId
async function run() {
  const profile = await pool.query("SELECT id FROM \"ClientProfile\" WHERE acronym='CTI'");
  const ctiId = profile.rows[0]?.id;
  console.log('CTI profile ID:', ctiId);

  const existing = await pool.query('SELECT DATE("startTime") as d FROM "ZoomCall" WHERE acronym=\'CTI\'');
  const existingDates = new Set(existing.rows.map(r => r.d?.toISOString().slice(0,10)));
  console.log('Existing CTI meetings:', existingDates.size, Array.from(existingDates).join(', '));

  let created = 0;
  for (const date of ctiDates) {
    if (!existingDates.has(date)) {
      const id = 'notion_cti_' + date.replace(/-/g,'');
      await pool.query(`
        INSERT INTO "ZoomCall" (id, topic, "startTime", acronym, "tenantId", "aiClassification",
          "classifiedAs", "classificationStatus", "clientProfileId", "aiSummary", "meetingId")
        VALUES ($1, $2, $3, 'CTI', 'gyc', 'client_meeting', 'client_meeting', 'classified', $4, $5, $6)
        ON CONFLICT (id) DO NOTHING
      `, [
        id,
        'Marketing Review — Child Time Inc',
        new Date(date + 'T13:00:00'),
        ctiId,
        'Monthly marketing review (Ronnie Nelson + GYC team). From Notion records.',
        id
      ]);
      created++;
    }
  }
  
  console.log('Created', created, 'CTI Notion-sourced records');
  const total = await pool.query("SELECT COUNT(*) FROM \"ZoomCall\" WHERE acronym='CTI'");
  console.log('Total CTI meetings now:', total.rows[0].count);
  await pool.end();
}
run().catch(e => { console.error(e.message); pool.end(); });
