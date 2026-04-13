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

  // First get all sheet names
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  console.log('\n=== Sheet Tabs ===');
  meta.data.sheets.forEach(s => console.log(' -', s.properties.title));

  // Pull the CFO scorecard section A1:Z50 to see structure
  console.log('\n=== Monthly CFO Scorecard A1:Z10 (header area) ===');
  const header = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "'Monthly CFO Scorecard'!A1:Z10",
  });
  (header.data.values || []).forEach((row, i) => console.log(`Row ${i+1}:`, row));

  console.log('\n=== Monthly CFO Scorecard A11:Z40 (data section) ===');
  const data = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "'Monthly CFO Scorecard'!A11:Z40",
  });
  (data.data.values || []).forEach((row, i) => console.log(`Row ${i+11}:`, row));
}

run().catch(console.error);
