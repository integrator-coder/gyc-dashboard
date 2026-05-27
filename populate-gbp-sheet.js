const { google } = require('googleapis');
const fs = require('fs');

const SA = JSON.parse(fs.readFileSync(process.env.HOME + '/.openclaw/workspace/google-service-account.json', 'utf8'));
const auth = new google.auth.GoogleAuth({ 
  credentials: SA, 
  scopes: ['https://www.googleapis.com/auth/spreadsheets'] 
});

(async () => {
  try {
    const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });
    const csv = fs.readFileSync('reports/missing-gbp-maps-urls.csv', 'utf8');
    
    // Parse CSV properly handling quoted fields
    const rows = csv.trim().split('\n').map(line => {
      const result = [];
      let cur = '';
      let inQ = false;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') {
          inQ = !inQ;
        } else if (line[i] === ',' && !inQ) {
          result.push(cur);
          cur = '';
        } else {
          cur += line[i];
        }
      }
      result.push(cur);
      return result;
    });
    
    const ssId = '1NCkB5SaR07xKg6uFxm_ij_UpYN7L0ENsXklE9qDvlQk';
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: ssId,
      range: 'Sheet1!A1',
      valueInputOption: 'RAW',
      requestBody: {
        values: rows
      }
    });
    
    console.log(`✓ Successfully populated sheet with ${rows.length} rows (including header)`);
    console.log(`✓ Sheet URL: https://docs.google.com/spreadsheets/d/${ssId}/edit`);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
