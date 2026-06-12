require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const AUTH = Buffer.from(process.env.DATAFORSEO_LOGIN + ':' + process.env.DATAFORSEO_PASSWORD).toString('base64');
const H = { 'Authorization': 'Basic ' + AUTH, 'Content-Type': 'application/json' };

function parseHours(wh) {
  if (!wh?.timetable) return null;
  const days=['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
  const labels=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const r={};
  for(let i=0;i<days.length;i++){const s=(wh.timetable[days[i]]||[])[0];if(!s){r[labels[i]]='Closed';continue;}const fmt=(h,m)=>{const ap=h>=12?'PM':'AM';return(h%12||12)+':'+String(m).padStart(2,'0')+' '+ap;};r[labels[i]]=fmt(s.open.hour,s.open.minute)+' – '+fmt(s.close.hour,s.close.minute);}
  return r;
}

async function run() {
  // Extract CID from URL hex pattern
  const url = 'https://www.google.com/maps/place/1+Little+Meal+Community+Childcare+%26+Learning+Center/@34.1606009,-84.7915388,17z/data=!3m1!4b1!4m6!3m5!1s0x88f54f65d9f2ba93:0x58041f3bc5cc9dfc!8m2!3d34.1606009!4d-84.7915388!16s%2Fg%2F11v3_6b6hz';
  const hexMatch = url.match(/0x[0-9a-f]+:(0x[0-9a-f]+)/i);
  const cid = hexMatch ? BigInt(hexMatch[1]).toString(10) : null;
  console.log('CID extracted:', cid);
  console.log('Lat/lng from URL: 34.1606009, -84.7915388');

  // DataForSEO search
  const r = await fetch('https://api.dataforseo.com/v3/serp/google/maps/live/advanced', {
    method: 'POST', headers: H,
    body: JSON.stringify([{ keyword: '1 Little Meal Community Childcare Learning Center Stonewall GA', location_code: 2840, language_code: 'en', depth: 10 }])
  });
  const d = await r.json();
  const items = (d.tasks?.[0]?.result?.[0]?.items || []).filter(i => i.type === 'maps_search');
  const ckw = ['child','daycare','day care','preschool','learning','academy','school','montessori','kids','nursery'];
  const match = items.find(i => ckw.some(k => (i.title||'').toLowerCase().includes(k) || (i.category||'').toLowerCase().includes(k))) || items[0];
  
  if (match) {
    console.log('Found:', match.title, '|', match.rating?.value, '★ |', match.rating?.votes_count, 'reviews |', match.category);
    console.log('Address:', match.address);
    
    const snap = {
      placeId: match.place_id, cid: cid || match.cid?.toString(),
      rating: match.rating?.value, reviewCount: match.rating?.votes_count,
      ratingDistribution: match.rating?.rating_distribution,
      totalPhotos: match.total_photos, isClaimed: match.is_claimed,
      hours: parseHours(match.work_time), phone: match.phone,
      address: match.address, addressInfo: match.address_info || null,
      website: match.url, latitude: match.latitude || 34.1606009, longitude: match.longitude || -84.7915388,
      primaryCategory: match.category, additionalCategories: match.additional_categories || [],
      mainImage: match.main_image, keyword: '1 Little Meal Stonewall GA',
      resolvedAt: new Date().toISOString(),
      autoChecks: { isClaimed: match.is_claimed, ratingAbove4: (match.rating?.value||0)>=4, has50Reviews: (match.rating?.votes_count||0)>=50, phoneListened: !!match.phone, websiteLinked: !!match.url, hoursComplete: !!(match.work_time?.timetable), secondaryCategoriesSet: !!(match.additional_categories?.length) }
    };

    await pool.query(`
      UPDATE "GBPLocation"
      SET "liveDataSnapshot"=$1,"liveDataUpdatedAt"=NOW(),
          "placeId"=$2,"gbpPlaceId"=$2,cid=$3,
          latitude=$4,longitude=$5,
          address=COALESCE(address,$6),city=COALESCE(city,$7),state=COALESCE(state,$8),
          "locationVerified"=true,"heatmapEnabled"=true,
          "seoLocationName"='1 Little Meal Community Childcare',
          "updatedAt"=NOW()
      WHERE id=1378
    `, [JSON.stringify(snap), match.place_id, cid || match.cid?.toString(), match.latitude || 34.1606009, match.longitude || -84.7915388, match.address, match.address_info?.city||null, match.address_info?.region||null]);
    
    console.log('\n✅ 1LM cascade complete:');
    console.log('  locationVerified: true');
    console.log('  heatmapEnabled: true');
    console.log('  seoLocationName: 1 Little Meal Community Childcare');
    console.log('  Address:', match.address);
    console.log('  ZIP:', match.address_info?.zip || 'in addressInfo');
    console.log('  Rating:', match.rating?.value, '★ |', match.rating?.votes_count, 'reviews');
  } else {
    // Fallback: at least set the flags and coordinates from URL
    await pool.query(`
      UPDATE "GBPLocation"
      SET latitude=34.1606009, longitude=-84.7915388, cid=$1,
          "locationVerified"=true, "heatmapEnabled"=true,
          "seoLocationName"='1 Little Meal Community Childcare',
          "updatedAt"=NOW()
      WHERE id=1378
    `, [cid]);
    console.log('Fallback: flags set from URL coordinates');
  }
  await pool.end();
}
run().catch(e => { console.error(e.message); pool.end(); });
