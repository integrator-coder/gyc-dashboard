const { Pool } = require('pg');
const { google } = require('googleapis');
const fs = require('fs');

async function main() {
  const env = fs.readFileSync('/Users/toddthejedigmail.com/.openclaw/workspace/gyc-dashboard/.env.local', 'utf8');
  const match = env.match(/^DATABASE_URL=(.+)$/m);
  const dbUrl = match[1].trim();
  const pool = new Pool({ connectionString: dbUrl });

  try {
    console.log('=== RUNNING CORRECTED QUERY ===\n');
    console.log('Logic: ANY client with Google Ads OR Command OR Blueprint OR MRR > $1200\n');
    
    // Join StripeCustomer with ClientServiceMap to get full picture
    const results = await pool.query(`
      SELECT 
        sc.acronym,
        COALESCE(sc."companyName", sc.name) as name,
        sc.email,
        sc.mrr,
        sc.status,
        csm."hasGoogleAds",
        csm."hasCommand",
        csm."hasBlueprint",
        csm."assignedGA",
        csm.locations
      FROM "StripeCustomer" sc
      LEFT JOIN "ClientServiceMap" csm ON sc.acronym = csm.acronym AND sc."tenantId" = csm."tenantId"
      WHERE sc.status NOT IN ('cancelled', 'churned')
        AND sc."tenantId" = 'gyc'
        AND (
          csm."hasGoogleAds" = true
          OR csm."hasCommand" = true
          OR csm."hasBlueprint" = true
          OR sc.mrr > 1200
        )
      ORDER BY sc.mrr DESC NULLS LAST
    `);

    console.log(`✓ Total clients found: ${results.rows.length}`);

    // Breakdown
    const googleAdsCount = results.rows.filter(r => r.hasGoogleAds).length;
    const commandCount = results.rows.filter(r => r.hasCommand).length;
    const blueprintCount = results.rows.filter(r => r.hasBlueprint).length;
    const highSpendCount = results.rows.filter(r => r.mrr > 1200).length;

    console.log(`\nBreakdown (clients can have multiple):`);
    console.log(`  Google Ads:     ${googleAdsCount} clients`);
    console.log(`  Command:        ${commandCount} clients`);
    console.log(`  Blueprint:      ${blueprintCount} clients`);
    console.log(`  Spend > $1,200: ${highSpendCount} clients`);

    console.log(`\nTop 5 by MRR:`);
    results.rows.slice(0, 5).forEach((r, i) => {
      const services = [];
      if (r.hasGoogleAds) services.push('Google Ads');
      if (r.hasCommand) services.push('Command');
      if (r.hasBlueprint) services.push('Blueprint');
      console.log(`  ${i + 1}. ${r.name} (${r.acronym}) - $${Number(r.mrr || 0).toFixed(2)} [${services.join(', ')}]`);
    });

    console.log('\n=== WRITING TO GOOGLE SHEET ===\n');

    // Google Sheets API setup
    const key = require('/Users/toddthejedigmail.com/.openclaw/workspace/google-service-account.json');
    const auth = new google.auth.GoogleAuth({
      credentials: key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = '1GKQDapkf7JTerSsk5zz0p6_cwh3bldYpMEV2A_BwH7o';

    // Clear existing data
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: 'Sheet1'
    });
    console.log('✓ Cleared existing sheet data');

    // Build rows
    const header = [
      'Acronym', 
      'Client Name', 
      'Email', 
      'Monthly Spend (MRR)', 
      'Status', 
      'Google Ads', 
      'Command', 
      'Blueprint',
      'Assigned GA',
      'Locations'
    ];
    
    const rows = results.rows.map(r => [
      r.acronym || '',
      r.name || '',
      r.email || '',
      r.mrr ? `$${Number(r.mrr).toFixed(2)}` : '$0',
      r.status || '',
      r.hasGoogleAds ? 'Yes' : '',
      r.hasCommand ? 'Yes' : '',
      r.hasBlueprint ? 'Yes' : '',
      r.assignedGA || '',
      r.locations ? r.locations.toString() : ''
    ]);

    // Write to sheet
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Sheet1!A1',
      valueInputOption: 'RAW',
      requestBody: { values: [header, ...rows] }
    });

    console.log(`✓ Written ${rows.length} rows to Google Sheet`);
    
    console.log('\n=== COMPLETE ===');
    console.log(`\nSheet URL: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`);

  } finally {
    await pool.end();
  }
}

main().catch(console.error);
