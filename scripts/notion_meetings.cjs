require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const notionDates = [
  '2026-04-18','2026-03-28','2026-02-21','2026-01-24',
  '2025-12-16','2025-11-22','2025-10-18','2025-09-19',
  '2025-08-20','2025-08-05','2025-08-02','2025-07-18',
  '2025-07-01','2025-06-03','2025-04-17','2025-03-20',
  '2025-02-28','2025-02-21','2025-01-24',
  '2024-12-06','2024-11-06','2024-08-16','2024-03-21'
];

const richNotes = {
  '2026-05-01': 'CPC finally trending down. Indiana adding $200M back into childcare. Bendix Dr. location has tanked. Eastport finally growing.\n\nEnrollment % FTE: State Rd 23 75%, Ireland Rd 77%, Bendix Dr 65% (down), Bristol St Elkhart 80%, Goshen 56%, Campbell St Valparaiso 83%, Chesterton 63%, Warsaw 61%, Plymouth 76%, Eastport 42%.',
  '2026-03-31': 'Eastport grand opening — great turnout. Enrolling at all centers but losing some kids out of their control. CPC above $17.\n\nEnrollment % FTE: State Rd 23 71%, Ireland Rd 78%, Bendix Dr 69%, Bristol St Elkhart 80%, Goshen 58%, Campbell St Valparaiso 82%, Chesterton 63%, Warsaw 62%, Plymouth 77%, Eastport 40%.',
};

async function run() {
  // Update existing records with rich notes
  for (const [date, summary] of Object.entries(richNotes)) {
    const r = await pool.query(
      'UPDATE "ZoomCall" SET "aiSummary" = $1 WHERE acronym=\'GKLC\' AND DATE("startTime") = $2',
      [summary, date]
    );
    if (r.rowCount > 0) console.log('Updated', date, '- summary enriched');
  }

  // Check existing dates
  const existing = await pool.query('SELECT DATE("startTime") as d FROM "ZoomCall" WHERE acronym=\'GKLC\'');
  const existingDates = new Set(existing.rows.map(r => r.d?.toISOString().slice(0,10)));
  
  // Create records for Notion-only dates
  let created = 0;
  for (const date of notionDates) {
    if (!existingDates.has(date)) {
      const id = 'notion_gklc_' + date.replace(/-/g,'');
      await pool.query(`
        INSERT INTO "ZoomCall" (id, topic, "startTime", acronym, "tenantId", "aiClassification",
          "classifiedAs", "classificationStatus", "clientProfileId", "aiSummary", "meetingId")
        VALUES ($1, $2, $3, 'GKLC', 'gyc', 'client_meeting', 'client_meeting', 'classified', 112, $4, $5)
        ON CONFLICT (id) DO NOTHING
      `, [
        id,
        'Marketing Review — Growing Kids Learning Centers',
        new Date(date + 'T13:00:00'),
        'Monthly marketing review (Bridget + Stefen). Notes in Notion — Zoom recording may not be available for this date.',
        id
      ]);
      created++;
    }
  }
  
  console.log('Created', created, 'Notion-sourced records');
  const total = await pool.query('SELECT COUNT(*) FROM "ZoomCall" WHERE acronym=\'GKLC\'');
  console.log('Total GKLC meetings now:', total.rows[0].count);
  await pool.end();
}
run().catch(e => { console.error(e.message); pool.end(); });
