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

  // Get columns A and R (Date + Total MRR Per Stripe) from Stripe-Tracker-2025
  // Col R = column 18 = Total MRR Per Stripe
  // Col Y = col 25 = # of Active Subscriptions in Stripe
  console.log('\n=== Stripe-Tracker-2025 Full MRR column (A + R + Y) rows 1-20 ===');
  const full = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "'Stripe-Tracker-2025'!A1:Y20",
  });
  const rows = full.data.values || [];
  rows.forEach((row, i) => {
    const date = row[0] || '';
    const mrr = row[17] || ''; // col R = index 17
    const subs = row[24] || ''; // col Y = index 24
    const newMRR = row[20] || ''; // col U
    const churn = row[18] || ''; // col S
    const netChange = row[23] || ''; // col X
    if (i === 0 || date) {
      console.log(`${date} | MRR: ${mrr} | Subs: ${subs} | New: ${newMRR} | Churn: ${churn} | Net: ${netChange}`);
    }
  });

  // Also check Stripe-Tracker-2024 for historical context
  console.log('\n=== Stripe-Tracker-2024 A1:R15 ===');
  const st24 = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "'Stripe-Tracker-2024'!A1:R15",
  });
  (st24.data.values || []).forEach((row, i) => {
    const date = row[0] || '';
    const mrr = row[17] || ''; // col R
    if (i === 0 || date) console.log(`${date} | MRR: ${mrr}`);
  });
}

run().catch(console.error);
