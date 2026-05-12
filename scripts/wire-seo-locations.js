#!/usr/bin/env node
/**
 * wire-seo-locations.js
 * Wire seoLocationName (and heatmapEnabled) on GBPLocation records for SEO clients.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ─────────────────────────────────────────────────────────────
    // 1. SINGLE-LOCATION SEO clients — set seoLocationName = '' on their "Main" GBPLocation
    // ─────────────────────────────────────────────────────────────
    const singleLocationClients = ['AALLC', 'ACP', 'BCPA', 'CPC', 'CTAB (FF)', 'EBLC', 'HAA', 'LATX', 'PM', 'SELC'];
    console.log('\n─── SINGLE-LOCATION SEO CLIENTS ───');
    for (const acronym of singleLocationClients) {
      const res = await client.query(
        `UPDATE "GBPLocation" SET "seoLocationName" = '', "updatedAt" = NOW()
         WHERE "clientAcronym" = $1 AND "locationName" = 'Main'
         RETURNING id, "clientAcronym", "locationName"`,
        [acronym]
      );
      if (res.rowCount > 0) {
        console.log(`  ✅ ${acronym} — set seoLocationName='' on "Main" (id=${res.rows[0].id})`);
      } else {
        console.log(`  ⚠️  ${acronym} — no "Main" GBPLocation found, skipping`);
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 2. SEO clients with NO GBPLocation records — create placeholder
    // ─────────────────────────────────────────────────────────────
    const noGBPClients = ['ABBR', 'AN', 'BBLA', 'CTAB', 'FLP', 'KKPS', 'KM', 'KZCP', 'LSCDC', 'PSB', 'TCALC', 'TCLA', 'TRYCC'];
    console.log('\n─── NO GBP RECORDS — CREATING PLACEHOLDERS ───');
    for (const acronym of noGBPClients) {
      // Check if record already exists (defensive)
      const check = await client.query(
        `SELECT id FROM "GBPLocation" WHERE "clientAcronym" = $1 AND "locationName" = ''`,
        [acronym]
      );
      if (check.rowCount > 0) {
        // Update existing placeholder to ensure seoLocationName is set
        await client.query(
          `UPDATE "GBPLocation" SET "seoLocationName" = '', "updatedAt" = NOW()
           WHERE "clientAcronym" = $1 AND "locationName" = ''`,
          [acronym]
        );
        console.log(`  ℹ️  ${acronym} — placeholder already exists (id=${check.rows[0].id}), set seoLocationName=''`);
      } else {
        const res = await client.query(
          `INSERT INTO "GBPLocation" ("tenantId", "clientAcronym", "locationName", "seoLocationName", "isActive", "createdAt", "updatedAt")
           VALUES ('gyc', $1, '', '', true, NOW(), NOW())
           RETURNING id`,
          [acronym]
        );
        console.log(`  ✅ ${acronym} — created placeholder GBPLocation (id=${res.rows[0].id})`);
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 3. CTI — multi-location mapping + heatmapEnabled on all 4
    // ─────────────────────────────────────────────────────────────
    console.log('\n─── CTI — MULTI-LOCATION MAPPING ───');
    const ctiMappings = [
      { locationName: 'The Eastside Preschool by Child Time',     seoLocationName: 'Eastside',        heatmap: true },
      { locationName: 'The Second Avenues Preschool by Child Time', seoLocationName: 'Second Avenues', heatmap: true },
      { locationName: 'The Avenues Preschool by Child Time',       seoLocationName: null,              heatmap: true },
      { locationName: 'The Cottonwood Preschool by Child Time',    seoLocationName: null,              heatmap: true },
    ];
    for (const { locationName, seoLocationName, heatmap } of ctiMappings) {
      const res = await client.query(
        `UPDATE "GBPLocation" 
         SET "seoLocationName" = $1, "heatmapEnabled" = $2, "updatedAt" = NOW()
         WHERE "clientAcronym" = 'CTI' AND "locationName" = $3
         RETURNING id`,
        [seoLocationName, heatmap, locationName]
      );
      if (res.rowCount > 0) {
        console.log(`  ✅ CTI "${locationName}" → seoLocationName=${JSON.stringify(seoLocationName)}, heatmapEnabled=${heatmap} (id=${res.rows[0].id})`);
      } else {
        console.log(`  ⚠️  CTI "${locationName}" — no matching GBPLocation found`);
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 4. RMP — rename locations + set seoLocationName + heatmapEnabled
    // ─────────────────────────────────────────────────────────────
    console.log('\n─── RMP — RENAME + WIRE ───');
    const rmpMappings = [
      { oldName: 'Location 1', newName: 'Centennial', seoLocationName: 'Centennial' },
      { oldName: 'Location 2', newName: 'Parker',     seoLocationName: 'Parker' },
    ];
    for (const { oldName, newName, seoLocationName } of rmpMappings) {
      const res = await client.query(
        `UPDATE "GBPLocation"
         SET "locationName" = $1, "seoLocationName" = $2, "heatmapEnabled" = true, "updatedAt" = NOW()
         WHERE "clientAcronym" = 'RMP' AND "locationName" = $3
         RETURNING id`,
        [newName, seoLocationName, oldName]
      );
      if (res.rowCount > 0) {
        console.log(`  ✅ RMP "${oldName}" → renamed to "${newName}", seoLocationName='${seoLocationName}', heatmapEnabled=true (id=${res.rows[0].id})`);
      } else {
        console.log(`  ⚠️  RMP "${oldName}" — no matching GBPLocation found`);
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 5. MHCC — set heatmapEnabled on all 4 + WARN about manual mapping
    // ─────────────────────────────────────────────────────────────
    console.log('\n─── MHCC — HEATMAP ENABLED (MANUAL MAPPING NEEDED) ───');
    console.log('  ⚠️  WARNING: MHCC needs manual mapping!');
    console.log('      GBP locations are named "Location 1-4"');
    console.log('      SEO locations are "MHCC - Daybreak" and "MHCC - South Jordan"');
    console.log('      Cannot safely guess which GBP location = which SEO location.');
    console.log('      ACTION REQUIRED: Todd/team must identify which "Location X" maps to Daybreak vs South Jordan.');
    const mhccRes = await client.query(
      `UPDATE "GBPLocation"
       SET "heatmapEnabled" = true, "updatedAt" = NOW()
       WHERE "clientAcronym" = 'MHCC'
       RETURNING id, "locationName"`,
    );
    mhccRes.rows.forEach(r => {
      console.log(`  ✅ MHCC "${r.locationName}" (id=${r.id}) — heatmapEnabled=true (seoLocationName left NULL — needs manual mapping)`);
    });

    await client.query('COMMIT');
    console.log('\n─── ALL DONE ───\n');

    // ─────────────────────────────────────────────────────────────
    // Verification: show current state of all modified records
    // ─────────────────────────────────────────────────────────────
    const verify = await client.query(
      `SELECT "clientAcronym", "locationName", "seoLocationName", "heatmapEnabled"
       FROM "GBPLocation"
       WHERE "seoLocationName" IS NOT NULL OR "heatmapEnabled" = true
       ORDER BY "clientAcronym", "locationName"`
    );
    console.log('=== VERIFICATION — Records with seoLocationName set or heatmapEnabled ===');
    verify.rows.forEach(r => {
      console.log(`  ${r.clientAcronym} | ${r.locationName} | seoLocName=${JSON.stringify(r.seoLocationName)} | heatmap=${r.heatmapEnabled}`);
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ERROR — rolled back:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => { console.error(e); process.exit(1); });
