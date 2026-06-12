require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const AUTH = Buffer.from(process.env.DATAFORSEO_LOGIN + ':' + process.env.DATAFORSEO_PASSWORD).toString('base64');
const H = { 'Authorization': 'Basic ' + AUTH, 'Content-Type': 'application/json' };
const KM = 1.60934;
const RADII = [3, 5];
const KEYWORDS = ['daycare', 'preschool'];
const TODAY = new Date().toISOString().slice(0, 10);

function makeGrid(lat, lng, radiusMiles) {
  const s = (radiusMiles / 2) * KM;
  const ld = s / 111.32;
  const ldd = s / (111.32 * Math.cos(lat * Math.PI / 180));
  const pts = [];
  for (let r = -2; r <= 2; r++)
    for (let c = -2; c <= 2; c++)
      pts.push({ row: r, col: c, lat: lat + r * ld, lng: lng + c * ldd });
  return pts;
}

async function queryRank(lat, lng, kw) {
  const r = await fetch('https://api.dataforseo.com/v3/serp/google/maps/live/advanced', {
    method: 'POST', headers: H,
    body: JSON.stringify([{ keyword: kw, location_coordinate: `${lat.toFixed(6)},${lng.toFixed(6)},9km`, language_code: 'en', depth: 20 }])
  });
  const d = await r.json();
  return d.tasks?.[0]?.result?.[0]?.items || [];
}

function findRank(items, placeId, namePattern) {
  for (const i of items) {
    if ((placeId && i.place_id === placeId) || (namePattern && i.title?.toLowerCase().includes(namePattern)))
      return i.rank_group;
  }
  return null;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('🔍 GKLC SEO Heatmap Scan');
  console.log('========================\n');

  // Step 1: Query GKLC locations from DB
  console.log('📍 Fetching GKLC locations from database...');
  const locRes = await pool.query(`
    SELECT id, "locationName", "gbpPlaceId", latitude, longitude
    FROM "GBPLocation"
    WHERE "clientAcronym" = 'GKLC'
      AND latitude IS NOT NULL
      AND longitude IS NOT NULL
    ORDER BY "locationName"
  `);

  const locations = locRes.rows;
  console.log(`   Found ${locations.length} locations\n`);

  if (locations.length === 0) {
    console.log('❌ No GKLC locations found with lat/lng data');
    await pool.end();
    return;
  }

  const results = [];
  let totalScans = 0;

  // Step 2: For each location, scan grid and store
  for (const loc of locations) {
    console.log(`\n🏢 ${loc.locationName}`);
    console.log(`   Lat/Lng: ${loc.latitude}, ${loc.longitude}`);
    console.log(`   Place ID: ${loc.gbpPlaceId || 'N/A'}`);

    for (const radiusMiles of RADII) {
      for (const keyword of KEYWORDS) {
        console.log(`\n   📊 Scanning: ${keyword} @ ${radiusMiles}mi radius`);
        
        const grid = makeGrid(loc.latitude, loc.longitude, radiusMiles);
        const spacingKm = (radiusMiles / 2) * KM;
        const points = [];

        for (const pt of grid) {
          totalScans++;
          console.log(`      Grid [${pt.row},${pt.col}]... `);
          
          const items = await queryRank(pt.lat, pt.lng, keyword);
          const rank = findRank(items, loc.gbpPlaceId, 'growing kids');
          
          points.push({
            row: pt.row,
            col: pt.col,
            lat: pt.lat,
            lng: pt.lng,
            rank: rank
          });

          console.log(`rank: ${rank !== null ? rank : 'not found'}`);
          
          // Rate limiting: 250ms between calls
          await sleep(250);
        }

        // Calculate average rank for this scan
        const rankedPoints = points.filter(p => p.rank !== null);
        const avgRank = rankedPoints.length > 0 
          ? (rankedPoints.reduce((sum, p) => sum + p.rank, 0) / rankedPoints.length).toFixed(1)
          : 'N/A';

        console.log(`      ✓ Avg rank: ${avgRank} (${rankedPoints.length}/25 points)`);

        // Store in database
        await pool.query(
          `INSERT INTO "ClientSEOHeatmap"
            ("clientAcronym","locationName","keyword","centerLat","centerLng","gridSize","spacingKm","scanDate","points","radiusMiles")
           VALUES ($1,$2,$3,$4,$5,5,$6,$7,$8,$9)
           ON CONFLICT ("clientAcronym","locationName","keyword","scanDate","radiusMiles")
           DO UPDATE SET points=$8`,
          ['GKLC', loc.locationName, keyword, loc.latitude, loc.longitude, spacingKm, TODAY, JSON.stringify(points), radiusMiles]
        );

        results.push({
          location: loc.locationName,
          keyword,
          radiusMiles,
          avgRank,
          pointsFound: rankedPoints.length
        });
      }
    }
  }

  // Final report
  console.log('\n\n📈 SCAN COMPLETE');
  console.log('================\n');
  console.log(`Total locations: ${locations.length}`);
  console.log(`Total DataForSEO calls: ${totalScans}`);
  console.log(`Records stored: ${results.length}\n`);

  console.log('Results by location:\n');
  for (const loc of locations) {
    console.log(`${loc.locationName}:`);
    const locResults = results.filter(r => r.location === loc.locationName);
    for (const r of locResults) {
      console.log(`  ${r.keyword} @ ${r.radiusMiles}mi: avg rank ${r.avgRank} (${r.pointsFound}/25 points)`);
    }
    console.log('');
  }

  await pool.end();
  console.log('✅ Done');
}

main().catch(err => {
  console.error('❌ Error:', err);
  pool.end();
  process.exit(1);
});
