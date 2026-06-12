require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const AUTH = Buffer.from(process.env.DATAFORSEO_LOGIN + ':' + process.env.DATAFORSEO_PASSWORD).toString('base64');
const H = { 'Authorization': 'Basic ' + AUTH, 'Content-Type': 'application/json' };
const KM = 1.60934;
const RADII = [3, 5];
const KEYWORDS = ['daycare', 'preschool'];
const TODAY = new Date().toISOString().slice(0, 10);

function makeGrid(lat, lng, rm) {
  const s = (rm/2)*KM, ld = s/111.32, ldd = s/(111.32*Math.cos(lat*Math.PI/180));
  const pts = [];
  for (let r=-2;r<=2;r++) for (let c=-2;c<=2;c++) pts.push({row:r,col:c,lat:lat+r*ld,lng:lng+c*ldd});
  return pts;
}

async function queryRank(lat, lng, kw) {
  try {
    const r = await fetch('https://api.dataforseo.com/v3/serp/google/maps/live/advanced', {
      method:'POST', headers:H,
      body: JSON.stringify([{keyword:kw, location_coordinate:`${lat.toFixed(6)},${lng.toFixed(6)},9km`, language_code:'en', depth:20}])
    });
    const d = await r.json();
    return d.tasks?.[0]?.result?.[0]?.items || [];
  } catch { return []; }
}

function findRank(items, placeId) {
  for (const i of items) {
    if ((placeId && i.place_id === placeId) || i.title?.toLowerCase().includes('growing kids')) return i.rank_group;
  }
  return null;
}

(async () => {
  const locs = await pool.query(`SELECT "locationName", "gbpPlaceId", latitude, longitude FROM "GBPLocation" WHERE "clientAcronym"='GKLC' AND latitude IS NOT NULL ORDER BY "locationName"`);
  console.log('Locations to scan:', locs.rows.length);
  
  let total = 0;
  for (const loc of locs.rows) {
    console.log('\n→', loc.locationName);
    for (const rm of RADII) {
      for (const kw of KEYWORDS) {
        const grid = makeGrid(loc.latitude, loc.longitude, rm);
        const spacingKm = (rm/2)*KM;
        const pts = [];
        process.stdout.write(`  ${rm}mi ${kw}: `);
        for (const p of grid) {
          const items = await queryRank(p.lat, p.lng, kw);
          const rank = findRank(items, loc.gbpPlaceId);
          pts.push({row:p.row,col:p.col,lat:p.lat,lng:p.lng,rank});
          process.stdout.write(rank ? String(rank) : '.');
          await new Promise(r=>setTimeout(r,250));
        }
        const ranked = pts.filter(p=>p.rank!=null);
        const avg = ranked.length ? (ranked.reduce((s,p)=>s+p.rank,0)/ranked.length).toFixed(1) : '-';
        console.log(` | ${ranked.length}/25 ranked | avg: ${avg}`);
        await pool.query(
          `INSERT INTO "ClientSEOHeatmap" ("clientAcronym","locationName",keyword,"centerLat","centerLng","gridSize","spacingKm","scanDate",points,"radiusMiles") VALUES ($1,$2,$3,$4,$5,5,$6,$7,$8,$9) ON CONFLICT ("clientAcronym","locationName",keyword,"scanDate","radiusMiles") DO UPDATE SET points=$8`,
          ['GKLC', loc.locationName, kw, loc.latitude, loc.longitude, spacingKm, TODAY, JSON.stringify(pts), rm]
        );
        total++;
      }
    }
  }
  console.log('\n✅ Done — wrote', total, 'heatmap records');
  await pool.end();
})().catch(async e => { console.error('Error:', e.message); await pool.end(); process.exit(1); });
