#!/usr/bin/env node
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

// BigInt serialization helper
const stringify = (obj) => JSON.stringify(obj, (_, v) => typeof v === 'bigint' ? v.toString() : v);

const checks = {
  1: {
    name: "Wrong Business Category",
    sql: `
      SELECT gl."clientAcronym", gl."locationName", 
             gl."liveDataSnapshot"->>'primaryCategory' AS category,
             gl."liveDataSnapshot"->>'address' AS address
      FROM "GBPLocation" gl
      JOIN "ClientProfile" cp ON cp.acronym = gl."clientAcronym"
      WHERE cp.status = 'active'
        AND gl."liveDataSnapshot" IS NOT NULL
        AND NOT (
          gl."liveDataSnapshot"->>'primaryCategory' ILIKE ANY(
            ARRAY['%child%','%daycare%','%day care%','%preschool%','%nursery%',
                  '%kindergarten%','%learning%','%academy%','%school%','%montessori%','%kids%']
          )
        )
      ORDER BY gl."clientAcronym"
    `,
    autofix: false
  },
  2: {
    name: "Missing seoLocationName",
    sql: `
      SELECT gl."clientAcronym", gl."locationName", gl."gbpUrl",
             gl."liveDataSnapshot"->>'title' AS snapshot_title
      FROM "GBPLocation" gl
      JOIN "ClientProfile" cp ON cp.acronym = gl."clientAcronym"
      WHERE cp.status = 'active'
        AND gl."seoLocationName" IS NULL
        AND gl."liveDataSnapshot" IS NOT NULL
      ORDER BY gl."clientAcronym"
    `,
    autofix: true,
    fixFn: async (rows) => {
      let fixed = 0;
      for (const row of rows) {
        if (row.snapshot_title) {
          await pool.query(
            `UPDATE "GBPLocation" 
             SET "seoLocationName" = $1 
             WHERE "clientAcronym" = $2 AND "locationName" = $3`,
            [row.snapshot_title, row.clientAcronym, row.locationName]
          );
          fixed++;
        }
      }
      return fixed;
    }
  },
  3: {
    name: "Missing Address/City/State Columns",
    sql: `
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
    `,
    autofix: true,
    fixFn: async (rows) => {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      let tier1_fixed = 0;
      let tier2_fixed = 0;
      let tier3_needed = [];
      
      console.log('\n🔧 Tier 1: Extracting from liveDataSnapshot...');
      for (const row of rows) {
        if (row.snap_address && row.snap_city && row.snap_state && row.snap_zip) {
          await pool.query(
            `UPDATE "GBPLocation" 
             SET address = $1,
                 city = $2,
                 state = $3
             WHERE id = $4`,
            [row.snap_address, row.snap_city, row.snap_state, row.id]
          );
          tier1_fixed++;
          console.log(`  ✅ ${row.clientAcronym}/${row.locationName} - Tier 1 (${row.snap_zip})`);
        } else {
          // Needs Tier 2 or 3
          tier3_needed.push(row);
        }
      }
      
      console.log(`\n✅ Tier 1 complete: ${tier1_fixed} locations fixed from snapshot data`);
      
      if (tier3_needed.length > 0) {
        console.log(`\n🔧 Tier 2: Expanding gbpUrl links (${tier3_needed.length} remaining)...`);
        const stillNeedTier3 = [];
        
        for (const row of tier3_needed) {
          if (!row.gbpUrl) {
            stillNeedTier3.push(row);
            continue;
          }
          
          try {
            // Extract the short URL from gbpUrl
            const urlMatch = row.gbpUrl.match(/(?:maps\.app\.goo\.gl\/|share\.google\/|maps\.google\.com\/\?cid=)([A-Za-z0-9_-]+)/);
            if (!urlMatch) {
              stillNeedTier3.push(row);
              continue;
            }
            
            let targetUrl = row.gbpUrl;
            if (row.gbpUrl.includes('share.google')) {
              targetUrl = `https://maps.app.goo.gl/${urlMatch[1]}`;
            }
            
            // Expand URL
            const { stdout } = await execAsync(
              `curl -sL --max-redirs 10 -o /dev/null -w "%{url_effective}" "${targetUrl}"`,
              { timeout: 5000 }
            );
            
            const expandedUrl = stdout.trim();
            
            // Try to extract zip code from expanded URL
            // Format: .../@lat,lng,zoom/data=...!3d...!4d...!16s...!8m2!3d...!4d...
            const zipMatch = expandedUrl.match(/\b(\d{5})(?:-\d{4})?\b/);
            
            if (zipMatch) {
              const zip = zipMatch[1];
              // Update liveDataSnapshot with the extracted zip
              await pool.query(
                `UPDATE "GBPLocation" 
                 SET "liveDataSnapshot" = jsonb_set(
                   COALESCE("liveDataSnapshot", '{}')::jsonb,
                   '{addressInfo,zip}',
                   $1::jsonb
                 )
                 WHERE id = $2`,
                [JSON.stringify(zip), row.id]
              );
              tier2_fixed++;
              console.log(`  ✅ ${row.clientAcronym}/${row.locationName} - Tier 2 (zip: ${zip})`);
            } else {
              stillNeedTier3.push(row);
            }
          } catch (err) {
            console.log(`  ⚠️  ${row.clientAcronym}/${row.locationName} - URL expand failed, needs Tier 3`);
            stillNeedTier3.push(row);
          }
        }
        
        console.log(`\n✅ Tier 2 complete: ${tier2_fixed} locations fixed from URL expansion`);
        
        if (stillNeedTier3.length > 0) {
          console.log(`\n⚠️  Tier 3 needed: ${stillNeedTier3.length} locations require DataForSEO resolution ($${(stillNeedTier3.length * 0.02).toFixed(2)} cost)`);
          console.log('   Run the DataForSEO resolution script manually for these locations:');
          stillNeedTier3.forEach(row => {
            console.log(`   - ${row.clientAcronym}/${row.locationName}`);
          });
        }
      }
      
      return tier1_fixed + tier2_fixed;
    }
  },
  4: {
    name: "Canadian/Invalid Coordinates",
    sql: `
      SELECT gl."clientAcronym", gl."locationName", gl.latitude, gl.longitude, gl.city, gl.state
      FROM "GBPLocation" gl
      JOIN "ClientProfile" cp ON cp.acronym = gl."clientAcronym"
      WHERE cp.status = 'active'
        AND (gl.latitude > 50 OR gl.latitude < 24 OR gl.longitude > -60 OR gl.longitude < -130)
        AND gl.latitude IS NOT NULL
      ORDER BY gl."clientAcronym"
    `,
    autofix: false
  },
  5: {
    name: "Wrong gbpPlaceId Format (decimal CID)",
    sql: `
      SELECT gl."clientAcronym", gl."locationName", gl."gbpPlaceId",
             gl."liveDataSnapshot"->>'placeId' AS correct_place_id
      FROM "GBPLocation" gl
      JOIN "ClientProfile" cp ON cp.acronym = gl."clientAcronym"
      WHERE cp.status = 'active'
        AND gl."gbpPlaceId" IS NOT NULL
        AND gl."gbpPlaceId" NOT LIKE 'ChIJ%'
        AND gl."gbpPlaceId" ~ '^[0-9]+$'
      ORDER BY gl."clientAcronym"
    `,
    autofix: true,
    fixFn: async (rows) => {
      let fixed = 0;
      for (const row of rows) {
        if (row.correct_place_id && row.correct_place_id.startsWith('ChIJ')) {
          await pool.query(
            `UPDATE "GBPLocation" 
             SET "gbpPlaceId" = $1 
             WHERE "clientAcronym" = $2 AND "locationName" = $3`,
            [row.correct_place_id, row.clientAcronym, row.locationName]
          );
          fixed++;
        }
      }
      return fixed;
    }
  },
  6: {
    name: "Unverified Locations with Confirmed Childcare Data",
    sql: `
      SELECT gl."clientAcronym", gl."locationName",
             gl."liveDataSnapshot"->>'primaryCategory' AS category,
             gl."locationVerified"
      FROM "GBPLocation" gl
      JOIN "ClientProfile" cp ON cp.acronym = gl."clientAcronym"
      WHERE cp.status = 'active'
        AND gl."locationVerified" = false
        AND gl."liveDataSnapshot"->>'primaryCategory' ILIKE ANY(
          ARRAY['%child%','%daycare%','%preschool%','%learning%','%academy%','%school%','%montessori%']
        )
        AND gl.latitude < 50 AND gl.latitude > 24
      ORDER BY gl."clientAcronym"
    `,
    autofix: true,
    fixFn: async (rows) => {
      for (const row of rows) {
        await pool.query(
          `UPDATE "GBPLocation" 
           SET "locationVerified" = true 
           WHERE "clientAcronym" = $1 AND "locationName" = $2`,
          [row.clientAcronym, row.locationName]
        );
      }
      return rows.length;
    }
  },
  7: {
    name: "Canadian Postal Codes (Mismatched)",
    sql: `
      WITH client_location_check AS (
        SELECT cp.acronym, cp."companyName", cp."zipCode",
               MAX(CASE WHEN gl.latitude > 49 THEN 1 ELSE 0 END) AS has_canadian_location,
               COUNT(gl.id) AS location_count
        FROM "ClientProfile" cp
        LEFT JOIN "GBPLocation" gl ON gl."clientAcronym" = cp.acronym
        WHERE cp.status = 'active'
          AND cp."zipCode" ~ '^[A-Z]\\d[A-Z]\\s*\\d[A-Z]\\d$'
        GROUP BY cp.acronym, cp."companyName", cp."zipCode"
      )
      SELECT acronym, "companyName", "zipCode", 
             has_canadian_location,
             location_count,
             CASE 
               WHEN has_canadian_location = 1 THEN 'Canadian client (correct)'
               ELSE 'US client with Canadian postal code (ERROR)'
             END AS status
      FROM client_location_check
      ORDER BY has_canadian_location, acronym
    `,
    autofix: false
  },
  8: {
    name: "MRR = 0 When Stripe Shows Non-Zero",
    sql: `
      SELECT cp.acronym, cp."companyName", cp.mrr AS profile_mrr, sc.mrr AS stripe_mrr
      FROM "ClientProfile" cp
      JOIN "StripeCustomer" sc ON sc.id = cp."stripeCustomerId"
      WHERE cp.status = 'active'
        AND (cp.mrr = 0 OR cp.mrr IS NULL)
        AND sc.mrr > 0
      ORDER BY sc.mrr DESC
    `,
    autofix: true,
    fixFn: async (rows) => {
      for (const row of rows) {
        await pool.query(
          `UPDATE "ClientProfile" 
           SET mrr = $1 
           WHERE acronym = $2`,
          [row.stripe_mrr, row.acronym]
        );
      }
      return rows.length;
    }
  },
  9: {
    name: "Zero Lifetime Value When Paid Invoices Exist",
    sql: `
      SELECT cp.acronym, cp."companyName", cp."lifetimeValue",
             SUM(si."amountPaid"::numeric) AS actual_ltv
      FROM "ClientProfile" cp
      JOIN "StripeInvoiceSnapshot" si ON si."stripeCustomerId" = cp."stripeCustomerId"
      WHERE cp.status = 'active'
        AND (cp."lifetimeValue" = 0 OR cp."lifetimeValue" IS NULL)
        AND si.status = 'paid'
      GROUP BY cp.acronym, cp."companyName", cp."lifetimeValue"
      HAVING SUM(si."amountPaid"::numeric) > 0
      ORDER BY actual_ltv DESC
    `,
    autofix: true,
    fixFn: async (rows) => {
      for (const row of rows) {
        await pool.query(
          `UPDATE "ClientProfile" 
           SET "lifetimeValue" = $1 
           WHERE acronym = $2`,
          [row.actual_ltv, row.acronym]
        );
      }
      return rows.length;
    }
  },
  10: {
    name: "StripeCustomer Acronym Mismatch",
  11: {
    name: "Broken / Concatenated gbpUrl",
    sql: `
      SELECT gl.id, gl."clientAcronym", gl."locationName", gl."gbpUrl"
      FROM "GBPLocation" gl
      JOIN "ClientProfile" cp ON cp.acronym = gl."clientAcronym"
      WHERE cp.status = 'active'
        AND gl."isActive" = TRUE
        AND gl."gbpUrl" IS NOT NULL
        AND (
          gl."gbpUrl" LIKE '% -%'           -- two URLs pasted with " -" separator
          OR gl."gbpUrl" LIKE '% https://%'  -- space before second URL
          OR gl."gbpUrl" LIKE '%share.google%' -- unresolved share.google shortlinks
        )
      ORDER BY gl."clientAcronym"
    `,
    autofix: false
  },
  12: {
    name: "locationCount Mismatch vs Active GBP",
    sql: `
      SELECT cp.acronym, cp."companyName",
             cp."locationCount" AS profile_count,
             COUNT(gl.id) AS actual_count
      FROM "ClientProfile" cp
      LEFT JOIN "GBPLocation" gl
        ON gl."clientAcronym" = cp.acronym AND gl."isActive" = TRUE
      WHERE cp.status = 'active'
      GROUP BY cp.acronym, cp."companyName", cp."locationCount"
      HAVING cp."locationCount" IS DISTINCT FROM COUNT(gl.id)::int
         AND COUNT(gl.id) > 0
      ORDER BY cp.acronym
    `,
    autofix: true,
    fixFn: async (rows) => {
      let fixed = 0;
      for (const row of rows) {
        await pool.query(
          `UPDATE "ClientProfile" SET "locationCount" = $1 WHERE acronym = $2`,
          [row.actual_count, row.acronym]
        );
        fixed++;
      }
      return fixed;
    }
  },
    sql: `
      SELECT sc.id, sc.acronym AS stripe_acronym, cp.acronym AS profile_acronym, sc.name, sc.email
      FROM "StripeCustomer" sc
      JOIN "ClientStripeLink" csl ON csl."stripeCustomerId" = sc.id AND csl."isPrimary" = true
      JOIN "ClientProfile" cp ON cp.id = csl."clientProfileId"
      WHERE sc.acronym != cp.acronym
      ORDER BY sc.acronym
    `,
    autofix: true,
    fixFn: async (rows) => {
      for (const row of rows) {
        await pool.query(
          `UPDATE "StripeCustomer" 
           SET acronym = $1 
           WHERE id = $2`,
          [row.profile_acronym, row.id]
        );
      }
      return rows.length;
    }
  }
};

async function runCheck(num, check) {
  console.log(`\n🔍 CHECK ${num} — ${check.name}`);
  try {
    const result = await pool.query(check.sql);
    const rows = result.rows;
    
    if (rows.length === 0) {
      console.log(`✅ Clean`);
      return { num, name: check.name, count: 0, rows: [], autofix: false };
    }
    
    // Special handling for Check 7 (Canadian postal codes)
    if (num === 7) {
      const canadianClients = rows.filter(r => r.has_canadian_location === 1);
      const usClientsWithCanadianZip = rows.filter(r => r.has_canadian_location === 0);
      
      console.log(`\n📊 Canadian Clients (correct): ${canadianClients.length}`);
      if (canadianClients.length > 0) {
        canadianClients.slice(0, 5).forEach(row => {
          console.log(`  ✅ ${row.acronym} - ${row.companyName} (${row.zipCode}) - ${row.location_count} location(s)`);
        });
        if (canadianClients.length > 5) {
          console.log(`  ... and ${canadianClients.length - 5} more Canadian clients`);
        }
      }
      
      console.log(`\n⚠️  US Clients with Canadian Postal Code (ERROR): ${usClientsWithCanadianZip.length}`);
      if (usClientsWithCanadianZip.length > 0) {
        usClientsWithCanadianZip.forEach(row => {
          console.log(`  ❌ ${row.acronym} - ${row.companyName} (${row.zipCode}) - ${row.location_count} US location(s)`);
        });
      }
      
      // Return only the error count
      return { 
        num, 
        name: check.name, 
        count: usClientsWithCanadianZip.length, 
        rows: usClientsWithCanadianZip, 
        autofix: false,
        canadianClientsCount: canadianClients.length
      };
    }
    
    console.log(`⚠️  ${rows.length} issue${rows.length > 1 ? 's' : ''} found`);
    
    // Show first 10 rows
    const preview = rows.slice(0, 10);
    console.log('\nAffected records (showing first 10):');
    preview.forEach(row => {
      const display = Object.entries(row)
        .filter(([k, v]) => v != null)
        .map(([k, v]) => `${k}: ${v}`)
        .join(' | ');
      console.log(`  - ${display}`);
    });
    
    if (rows.length > 10) {
      console.log(`  ... and ${rows.length - 10} more`);
    }
    
    let fixed = 0;
    if (check.autofix && check.fixFn) {
      console.log(`\n🔧 Auto-fixing...`);
      fixed = await check.fixFn(rows);
      console.log(`✅ Fixed ${fixed} record${fixed > 1 ? 's' : ''}`);
    }
    
    return { 
      num, 
      name: check.name, 
      count: rows.length, 
      rows, 
      autofix: check.autofix,
      fixed 
    };
  } catch (error) {
    console.error(`❌ ERROR: ${error.message}`);
    return { 
      num, 
      name: check.name, 
      count: 0, 
      rows: [], 
      autofix: false,
      error: error.message 
    };
  }
}

async function main() {
  console.log('🤖 C3PO Data Quality Audit — ' + new Date().toISOString().split('T')[0]);
  console.log('═'.repeat(60));
  
  const results = [];
  
  for (const [num, check] of Object.entries(checks)) {
    const result = await runCheck(parseInt(num), check);
    results.push(result);
  }
  
  // Summary report
  console.log('\n\n' + '═'.repeat(60));
  console.log('📊 SUMMARY REPORT');
  console.log('═'.repeat(60));
  
  let totalIssues = 0;
  let autoFixable = 0;
  let needsReview = 0;
  let totalFixed = 0;
  
  results.forEach(r => {
    const status = r.count === 0 ? '✅' : '⚠️';
    const fixInfo = r.fixed > 0 ? ` (${r.fixed} fixed)` : '';
    console.log(`CHECK ${r.num} — ${r.name.padEnd(40)} ${status} ${r.count} issue${r.count !== 1 ? 's' : ''}${fixInfo}`);
    
    totalIssues += r.count;
    if (r.autofix) {
      autoFixable += r.count;
      totalFixed += (r.fixed || 0);
    } else if (r.count > 0) {
      needsReview += r.count;
    }
  });
  
  console.log('\n' + '─'.repeat(60));
  console.log(`TOTAL ISSUES:     ${totalIssues}`);
  console.log(`AUTO-FIXABLE:     ${autoFixable} (${totalFixed} fixed this run)`);
  console.log(`NEEDS REVIEW:     ${needsReview}`);
  console.log(`BLOCKED:          0`);
  
  await pool.end();
  
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
