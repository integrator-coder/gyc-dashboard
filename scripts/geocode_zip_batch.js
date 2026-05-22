const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_ilJbVI72fDxh@ep-red-smoke-aks7z27o-pooler.c-3.us-west-2.aws.neon.tech/neondb?sslmode=require' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function reverseGeocode(lat, lng) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
      headers: { 'User-Agent': 'GYC-Dashboard-ZipEnrich/1.0 (todd@growyourcenter.com)' }
    });
    const d = await r.json();
    return d?.address?.postcode?.split('-')[0] || null;
  } catch { return null; }
}

async function forwardGeocode(street, city, state) {
  try {
    const url = 'https://geocoding.geo.census.gov/geocoder/locations/address?' +
      `street=${encodeURIComponent(street)}&city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}&benchmark=2020&format=json`;
    const r = await fetch(url);
    const d = await r.json();
    const match = d?.result?.addressMatches?.[0];
    if (!match) return null;
    return { lat: match.coordinates.y, lng: match.coordinates.x };
  } catch { return null; }
}

async function run() {
  // Batch 1: have lat/lng, missing ZIP
  const batch1 = await pool.query(`
    SELECT id, address, city, state, latitude, longitude
    FROM "GBPLocation"
    WHERE "isActive" = true
      AND (address !~ '\\d{5}' OR address IS NULL)
      AND latitude IS NOT NULL AND longitude IS NOT NULL
      AND address IS NOT NULL
    ORDER BY state, city
  `);
  console.log(`Batch 1 (reverse geocode): ${batch1.rows.length} locations`);

  let done = 0, failed = 0;
  for (const loc of batch1.rows) {
    const zip = await reverseGeocode(loc.latitude, loc.longitude);
    if (zip && zip.match(/^\d{5}$/)) {
      const newAddr = loc.address.replace(/,?\s*\d{5}(-\d{4})?$/, '').trim() + ', ' + zip;
      await pool.query('UPDATE "GBPLocation" SET address = $1 WHERE id = $2', [newAddr, loc.id]);
      done++;
    } else {
      failed++;
    }
    await sleep(350); // Nominatim rate limit: max 3/sec, use ~2.8/sec to be safe
    if ((done + failed) % 50 === 0) console.log(`Progress: ${done + failed}/${batch1.rows.length} (${done} updated, ${failed} failed)`);
  }
  console.log(`Batch 1 done: ${done} updated, ${failed} failed`);

  // Batch 2: have address+city+state, no coords
  const batch2 = await pool.query(`
    SELECT id, address, city, state
    FROM "GBPLocation"
    WHERE "isActive" = true
      AND latitude IS NULL
      AND address IS NOT NULL AND city IS NOT NULL AND state IS NOT NULL
      AND (address !~ '\\d{5}' OR address IS NULL)
  `);
  console.log(`\nBatch 2 (forward geocode): ${batch2.rows.length} locations`);

  let done2 = 0, failed2 = 0;
  for (const loc of batch2.rows) {
    const geo = await forwardGeocode(loc.address, loc.city, loc.state);
    if (geo) {
      const zip = await reverseGeocode(geo.lat, geo.lng);
      await sleep(350);
      const newAddr = zip ? loc.address.trim() + ', ' + zip : loc.address;
      await pool.query(
        'UPDATE "GBPLocation" SET address = $1, latitude = $2, longitude = $3 WHERE id = $4',
        [newAddr, geo.lat, geo.lng, loc.id]
      );
      done2++;
    } else {
      failed2++;
    }
    await sleep(500);
  }
  console.log(`Batch 2 done: ${done2} updated, ${failed2} failed`);

  // Summary
  const check = await pool.query(`
    SELECT COUNT(*) FILTER (WHERE address ~ '\\d{5}') as with_zip,
           COUNT(*) FILTER (WHERE address !~ '\\d{5}') as without_zip
    FROM "GBPLocation" WHERE "isActive" = true AND address IS NOT NULL
  `);
  console.log('\nFinal ZIP coverage:', check.rows[0]);
  pool.end();
}

run().catch(e => { console.error('Fatal:', e.message); pool.end(); process.exit(1); });
