#!/usr/bin/env node
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const execAsync = promisify(exec);

// Load .env.local
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const { Pool } = pg;

// Create DB pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function main() {
  console.log('🔍 CHECK 3 — Missing Address/City/State/Zip (Three-Tier Test)');
  console.log('═'.repeat(70));
  
  const query = `
    SELECT gl.id, gl."clientAcronym", gl."locationName",
           gl.address, gl.city, gl.state,
           gl."gbpUrl",
           gl."liveDataSnapshot"->'addressInfo'->>'address' AS snap_address,
           gl."liveDataSnapshot"->'addressInfo'->>'city' AS snap_city,
           gl."liveDataSnapshot"->'addressInfo'->>'state' AS snap_state,
           gl."liveDataSnapshot"->'addressInfo'->>'zip' AS snap_zip
    FROM "GBPLocation" gl
    JOIN "ClientProfile" cp ON cp.acronym = gl."clientAcronym"
    WHERE cp.status = 'active'
      AND (gl.address IS NULL OR gl.city IS NULL OR gl.state IS NULL 
           OR gl."liveDataSnapshot"->'addressInfo'->>'zip' IS NULL)
      AND gl."liveDataSnapshot" IS NOT NULL
    ORDER BY gl."clientAcronym"
    LIMIT 20
  `;
  
  const result = await pool.query(query);
  const rows = result.rows;
  
  console.log(`\n📊 Found ${rows.length} locations with missing data (showing first 20)\\n`);
  
  let tier1_fixed = 0;
  let tier2_fixed = 0;
  let tier3_needed = [];
  
  // TIER 1: Extract from liveDataSnapshot
  console.log('\ud83d\udd27 TIER 1: Extracting from liveDataSnapshot...\n');
  
  for (const row of rows) {
    const hasAll = row.snap_address && row.snap_city && row.snap_state && row.snap_zip;
    
    if (hasAll) {
      // Dry run - just report what would be fixed
      console.log(`  \u2705 ${row.clientAcronym}/${row.locationName}`);
      console.log(`     Address: ${row.snap_address}`);
      console.log(`     City: ${row.snap_city}, ${row.snap_state} ${row.snap_zip}`);
      tier1_fixed++;
    } else {
      tier3_needed.push(row);
      console.log(`  \u23ed\ufe0f  ${row.clientAcronym}/${row.locationName} - incomplete snapshot, needs Tier 2/3`);
    }
  }
  
  console.log(`\n\u2705 Tier 1 Summary: ${tier1_fixed} locations can be fixed from snapshot\\n`);
  
  // TIER 2: Expand gbpUrl
  if (tier3_needed.length > 0) {
    console.log(`\ud83d\udd27 TIER 2: Expanding gbpUrl links (${tier3_needed.length} remaining)...\\n`);
    const stillNeedTier3 = [];
    
    for (const row of tier3_needed.slice(0, 5)) { // Test on first 5 only
      if (!row.gbpUrl) {
        stillNeedTier3.push(row);
        console.log(`  \u23ed\ufe0f  ${row.clientAcronym}/${row.locationName} - no gbpUrl, needs Tier 3`);
        continue;
      }
      
      try {
        // Handle different URL formats
        let targetUrl = row.gbpUrl.split(' ')[0]; // Take first URL if multiple
        
        if (targetUrl.includes('share.google')) {
          const match = targetUrl.match(/share\.google\/([A-Za-z0-9]+)/);
          if (match) {
            targetUrl = `https://maps.app.goo.gl/${match[1]}`;
          }
        }
        
        console.log(`  \ud83d\udd17 Expanding: ${targetUrl}`)  ;
        
        const { stdout } = await execAsync(
          `curl -sL --max-redirs 10 -o /dev/null -w "%{url_effective}" "${targetUrl}"`,
          { timeout: 10000 }
        );
        
        const expandedUrl = stdout.trim();
        console.log(`  \u2192 Expanded to: ${expandedUrl.substring(0, 100)}...`);
        
        // Try to extract zip
        const zipMatch = expandedUrl.match(/\b(\d{5})(?:-\d{4})?\b/);
        
        if (zipMatch) {
          const zip = zipMatch[1];
          console.log(`  \u2705 ${row.clientAcronym}/${row.locationName} - extracted zip: ${zip}`);
          tier2_fixed++;
        } else {
          console.log(`  \u26a0\ufe0f  ${row.clientAcronym}/${row.locationName} - no zip found in URL`);
          stillNeedTier3.push(row);
        }
      } catch (err) {
        console.log(`  \u274c ${row.clientAcronym}/${row.locationName} - URL expand failed: ${err.message}`);
        stillNeedTier3.push(row);
      }
    }
    
    console.log(`\n\u2705 Tier 2 Summary: ${tier2_fixed} locations fixed from URL expansion`);
    console.log(`\u26a0\ufe0f  Still need Tier 3: ${stillNeedTier3.length} locations\\n`);
    
    if (stillNeedTier3.length > 0) {
      console.log(`\ud83d\udcb0 Tier 3 Cost Estimate: $${(stillNeedTier3.length * 0.02).toFixed(2)}`);
      console.log('\nLocations that need DataForSEO resolution:');
      stillNeedTier3.forEach(row => {
        console.log(`  - ${row.clientAcronym}/${row.locationName}`);
      });
    }
  }
  
  console.log('\n' + '═'.repeat(70));
  console.log('📊 FINAL SUMMARY');
  console.log('═'.repeat(70));
  console.log(`Tier 1 (snapshot):      ${tier1_fixed} locations`);
  console.log(`Tier 2 (URL expansion): ${tier2_fixed} locations`);
  console.log(`Tier 3 (DataForSEO):    ${tier3_needed.length - tier2_fixed} locations needed`);
  
  await pool.end();
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
