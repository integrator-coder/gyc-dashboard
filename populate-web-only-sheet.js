const { google } = require('googleapis');
const fs = require('fs');

// Load service account credentials
const credentials = JSON.parse(
  fs.readFileSync(
    '/Users/toddthejedigmail.com/.openclaw/workspace/google-service-account.json',
    'utf8'
  )
);

// Load the client data
const clients = JSON.parse(fs.readFileSync('web-only-clients.json', 'utf8'));

const SPREADSHEET_ID = '1hZpvNyI2c-o5RyiP2pKdbfVVae27ssnuOHgQvF8NETE';

async function populateSheet() {
  // Initialize auth
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // Prepare header row
  const headers = [
    'Company Name',
    'Acronym',
    'State',
    'City',
    'Zip',
    'Owner Name',
    'Owner Email',
    'Owner Phone',
    'Director Name',
    'Director Email',
    'Director Phone',
    'Website',
    'MRR',
    'Locations',
    'Start Date',
    'GA Name',
    'GA Email',
    'Service List',
    'Notes'
  ];

  // Prepare data rows
  const rows = clients.map(client => [
    client.companyName || '',
    client.acronym || '',
    client.state || '',
    client.city || '',
    client.zipCode || '',
    client.ownerName || '',
    client.email || '',
    client.phone || '',
    client.directorName || '',
    client.directorEmail || '',
    client.directorPhone || '',
    client.website || '',
    client.mrr || '0',
    client.locationCount || '',
    client.startDate || '',
    client.assignedGA || '',
    client.assignedGAEmail || '',
    (client.serviceList || []).join(', '),
    [client.notes, client.teamNotes].filter(Boolean).join(' | ')
  ]);

  // Combine header and data
  const values = [headers, ...rows];

  try {
    // Clear existing content first
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1',
    });

    // Write new data
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!A1',
      valueInputOption: 'RAW',
      resource: { values },
    });

    console.log(`✅ Sheet populated successfully`);
    console.log(`📊 Total clients: ${clients.length}`);
    console.log(`📝 Rows written: ${response.data.updatedRows}`);
    console.log(`📋 Cells updated: ${response.data.updatedCells}`);

    // Count clients with missing data
    const missingWebsite = clients.filter(c => !c.website).length;
    const missingEmail = clients.filter(c => !c.email).length;
    const missingPhone = clients.filter(c => !c.phone).length;
    const missingGA = clients.filter(c => !c.assignedGA).length;

    console.log(`\n⚠️  Data Quality Issues:`);
    console.log(`  - Missing website: ${missingWebsite}`);
    console.log(`  - Missing email: ${missingEmail}`);
    console.log(`  - Missing phone: ${missingPhone}`);
    console.log(`  - Missing GA assignment: ${missingGA}`);

  } catch (error) {
    console.error('❌ Error populating sheet:', error.message);
    if (error.code === 403) {
      console.error('\n🔐 Permission issue: Make sure the sheet is shared with:');
      console.error('   wall-e@hybrid-shine-489717-e0.iam.gserviceaccount.com');
    }
    throw error;
  }
}

populateSheet()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
