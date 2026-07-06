const { Pool } = require('pg');
const { google } = require('googleapis');
const fs = require('fs');

// Load DB credentials
const env = fs.readFileSync('/Users/toddthejedigmail.com/.openclaw/workspace/gyc-dashboard/.env.local', 'utf8');
const match = env.match(/^DATABASE_URL=(.+)$/m);
const dbUrl = match[1].trim();
const pool = new Pool({ connectionString: dbUrl });

// Load Google service account
const key = require('/Users/toddthejedigmail.com/.openclaw/workspace/google-service-account.json');
const auth = new google.auth.GoogleAuth({
  credentials: key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});
const sheets = google.sheets({ version: 'v4', auth });

const SHEET_ID = '1GKQDapkf7JTerSsk5zz0p6_cwh3bldYpMEV2A_BwH7o';

(async () => {
  try {
    // Query for clients with Google Ads AND Command (the two services that exist)
    // Note: "Influence" does not exist as a service in the database
    const qualifyingClients = await pool.query(`
      SELECT 
        acronym,
        "companyName",
        "ownerName",
        email,
        phone,
        "serviceList",
        mrr,
        "stripeCustomerId",
        status,
        "assignedGA"
      FROM "ClientProfile"
      WHERE 
        status = 'active'
        AND "serviceList" @> ARRAY['Google Ads']
        AND "serviceList" @> ARRAY['Command']
      ORDER BY mrr DESC
    `);
    
    console.log(`\nFound ${qualifyingClients.rows.length} clients with Google Ads + Command`);
    
    // Prepare data for sheet
    const values = [
      // Header row
      ['Client Acronym', 'Company Name', 'Owner Name', 'Email', 'Phone', 'Services', 'Monthly Spend (MRR)', 'Stripe Customer ID', 'Status', 'Assigned GA'],
      // Note about Influence not existing
      ['NOTE:', 'The "Influence" service does not exist in the database. Available services are:', 'Blueprint, Command, CRM, Google Ads, GYC Website, SEO, Website', '', '', '', '', '', '', ''],
      ['NOTE:', 'No clients have Google Ads + Command + MRR > $1200. Showing all clients with Google Ads + Command below:', '', '', '', '', '', '', '', ''],
      [''], // Blank row
      // Data rows
      ...qualifyingClients.rows.map(r => [
        r.acronym || '',
        r.companyName || '',
        r.ownerName || '',
        r.email || '',
        r.phone || '',
        r.serviceList ? r.serviceList.join(', ') : '',
        `$${parseFloat(r.mrr || 0).toFixed(2)}`,
        r.stripeCustomerId || '',
        r.status || '',
        r.assignedGA || ''
      ])
    ];
    
    // Write to sheet
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!A1',
      valueInputOption: 'RAW',
      requestBody: { values }
    });
    
    console.log('\n✓ Successfully wrote results to Google Sheet');
    console.log(`  Sheet URL: https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`);
    console.log(`\n  Total clients: ${qualifyingClients.rows.length}`);
    console.log(`  Highest MRR: $${parseFloat(qualifyingClients.rows[0].mrr).toFixed(2)} (${qualifyingClients.rows[0].acronym})`);
    
  } catch (err) {
    console.error('Error:', err);
    if (err.message && err.message.includes('permission')) {
      console.error('\n⚠️  PERMISSION ERROR: The sheet must be shared with wall-e@hybrid-shine-489717-e0.iam.gserviceaccount.com');
    }
  } finally {
    await pool.end();
  }
})();
