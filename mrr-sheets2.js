const { google } = require('googleapis');
const fs = require('fs');

const SHEET_ID = '1JAX7bhkx2Vc451kdm51a78-im0QjhLcRvRN6IeMQtws';
const CREDS_PATH = process.env.HOME + '/.openclaw/credentials/google-console.json';

async function run() {
  const creds = JSON.parse(fs.readFileSync(CREDS_PATH, 'utf8'));
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  // Stripe-Tracker-2025 - first 20 rows
  console.log('\n=== Stripe-Tracker-2025 A1:Z5 ===');
  const st = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "'Stripe-Tracker-2025'!A1:Z5",
  });
  (st.data.values || []).forEach((row, i) => console.log(`Row ${i+1}:`, row));

  // Check all 2025 MRR column more carefully
  console.log('\n=== Monthly CFO Scorecard 2025 MRR col A1:I15 ===');
  const mrr = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "'Monthly CFO Scorecard'!A1:J15",
  });
  (mrr.data.values || []).forEach((row, i) => console.log(`Row ${i+1}:`, JSON.stringify(row)));

  // Check if there are more months in 2025 section
  console.log('\n=== Monthly CFO Scorecard row 17 onwards ===');
  const l10 = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "'Monthly CFO Scorecard'!A17:Z30",
  });
  (l10.data.values || []).forEach((row, i) => console.log(`Row ${i+17}:`, JSON.stringify(row)));
}

run().catch(console.error);
