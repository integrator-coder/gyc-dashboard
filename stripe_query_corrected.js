const { Pool } = require('pg');
const { google } = require('googleapis');
const fs = require('fs');

async function main() {
  // Step 1: Load DB connection
  const env = fs.readFileSync('/Users/toddthejedigmail.com/.openclaw/workspace/gyc-dashboard/.env.local', 'utf8');
  const match = env.match(/^DATABASE_URL=(.+)$/m);
  const dbUrl = match[1].trim();
  const pool = new Pool({ connectionString: dbUrl });

  try {
    console.log('=== STEP 2: EXPLORING SCHEMA ===\n');
    
    // Check what service names exist in subscriptions
    console.log('Active subscription service names:');
    const servicesResult = await pool.query(`
      SELECT DISTINCT 
        COALESCE(metadata->>'plan_name', metadata->>'service', metadata->>'product', plan_nickname, price_id) as service_name,
        COUNT(*) as count
      FROM "StripeSubscription"
      WHERE status IN ('active', 'past_due')
      GROUP BY 1
      ORDER BY 2 DESC
      LIMIT 50
    `);
    console.log(JSON.stringify(servicesResult.rows, null, 2));

    // Check Client table columns
    console.log('\n\nClient table columns:');
    const clientCols = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'Client' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    console.log(clientCols.rows.map(r => r.column_name).join(', '));

    // Sample some clients
    console.log('\n\nSample clients with MRR:');
    const sample = await pool.query(`
      SELECT name, mrr, services, "hasGoogleAds", "hasBlueprint", "hasCommand"
      FROM "Client" 
      WHERE mrr > 0
      ORDER BY mrr DESC
      LIMIT 5
    `);
    console.log(JSON.stringify(sample.rows, null, 2));

    console.log('\n\n=== STEP 3: RUNNING ACTUAL QUERY ===\n');
    
    // Run the corrected query with OR logic
    const results = await pool.query(`
      SELECT 
        name,
        email,
        mrr,
        services,
        "hasGoogleAds",
        "hasBlueprint",
        "hasCommand",
        status
      FROM "Client"
      WHERE status NOT IN ('cancelled', 'churned')
        AND (
          "hasGoogleAds" = true
          OR "hasCommand" = true
          OR "hasBlueprint" = true
          OR mrr > 1200
        )
      ORDER BY mrr DESC NULLS LAST
    `);

    console.log(`Total clients found: ${results.rows.length}`);

    // Breakdown
    const googleAdsCount = results.rows.filter(r => r.hasGoogleAds).length;
    const commandCount = results.rows.filter(r => r.hasCommand).length;
    const blueprintCount = results.rows.filter(r => r.hasBlueprint).length;
    const highSpendCount = results.rows.filter(r => r.mrr > 1200).length;

    console.log(`\nBreakdown:`);
    console.log(`- Google Ads: ${googleAdsCount}`);
    console.log(`- Command: ${commandCount}`);
    console.log(`- Blueprint: ${blueprintCount}`);
    console.log(`- Spend > $1200: ${highSpendCount}`);

    console.log(`\nTop 5 by MRR:`);
    results.rows.slice(0, 5).forEach((r, i) => {
      console.log(`${i + 1}. ${r.name} - $${Number(r.mrr).toFixed(2)}`);
    });

    console.log('\n\n=== STEP 4: WRITING TO GOOGLE SHEET ===\n');

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
    console.log('Cleared existing sheet data');

    // Build rows
    const header = ['Client Name', 'Email', 'Monthly Spend (MRR)', 'Status', 'Google Ads', 'Command', 'Blueprint', 'Services'];
    const rows = results.rows.map(r => [
      r.name || '',
      r.email || '',
      r.mrr ? `$${Number(r.mrr).toFixed(2)}` : '$0',
      r.status || '',
      r.hasGoogleAds ? 'Yes' : '',
      r.hasCommand ? 'Yes' : '',
      r.hasBlueprint ? 'Yes' : '',
      r.services || ''
    ]);

    // Write to sheet
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Sheet1!A1',
      valueInputOption: 'RAW',
      requestBody: { values: [header, ...rows] }
    });

    console.log(`✓ Written ${rows.length} rows to Google Sheet`);
    console.log(`\n=== COMPLETE ===`);

  } finally {
    await pool.end();
  }
}

main().catch(console.error);
