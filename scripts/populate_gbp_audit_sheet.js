#!/usr/bin/env node

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SPREADSHEET_ID = '1XjuONIPrOp6fYcVYxSMVW--CtTWv9BriNhw1GjlXyl8';
const SERVICE_ACCOUNT_EMAIL = 'wall-e@hybrid-shine-489717-e0.iam.gserviceaccount.com';

async function main() {
  // Load service account credentials
  const keyPath = path.join(process.env.HOME, '.openclaw/workspace/google-service-account.json');
  const credentials = JSON.parse(fs.readFileSync(keyPath, 'utf8'));

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file'
    ]
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const drive = google.drive({ version: 'v3', auth });

  console.log('Step 1: Sharing sheet with service account...');
  
  try {
    await drive.permissions.create({
      fileId: SPREADSHEET_ID,
      requestBody: {
        type: 'user',
        role: 'writer',
        emailAddress: SERVICE_ACCOUNT_EMAIL
      }
    });
    console.log('✓ Sheet shared successfully');
  } catch (err) {
    if (err.message.includes('already has access')) {
      console.log('✓ Sheet already shared');
    } else {
      console.log('⚠ Share failed (may need manual sharing):', err.message);
    }
  }

  console.log('\nStep 2: Loading data files...');
  const fixableData = JSON.parse(fs.readFileSync('/tmp/gbp_fixable_with_website.json', 'utf8'));
  const noUrlData = JSON.parse(fs.readFileSync('/tmp/gbp_no_url.json', 'utf8'));
  console.log(`✓ Loaded ${fixableData.length} fixable locations`);
  console.log(`✓ Loaded ${noUrlData.length} locations needing GBP link`);

  console.log('\nStep 3: Preparing Tab 1 (Fixable) data...');
  
  // Tab 1 columns: Acronym | Company Name | Website | Location Name | Assigned GA | State | Issue | Current Category | Current Address | GBP URL
  const fixableRows = [
    ['Acronym', 'Company Name', 'Website', 'Location Name', 'Assigned GA', 'State', 'Issue', 'Current Category', 'Current Address', 'GBP URL']
  ];

  for (const loc of fixableData) {
    // Determine the issue
    let issue = '';
    if (!loc.current_category || loc.current_category === null) {
      issue = 'Missing Category';
    } else if (!['Child care service', 'Day care center', 'Preschool'].includes(loc.current_category)) {
      issue = 'Wrong Category';
    }
    if (!loc.current_address || loc.current_address === null || loc.current_address === '') {
      if (issue) issue += ' + Missing Address';
      else issue = 'Missing Address';
    }

    fixableRows.push([
      loc.acronym || '',
      loc.companyName || '',
      loc.website || '',
      loc.locationName || '',
      loc.assignedGA || '',
      loc.state || '',
      issue,
      loc.current_category || '',
      loc.current_address || '',
      loc.gbpUrl || ''
    ]);
  }

  console.log('\nStep 4: Preparing Tab 2 (Needs GBP Link) data...');
  
  // Tab 2 columns: Acronym | Company Name | Website | Location Name | Assigned GA | State | GBP URL (blank)
  const noUrlRows = [
    ['Acronym', 'Company Name', 'Website', 'Location Name', 'Assigned GA', 'State', 'GBP URL']
  ];

  for (const loc of noUrlData) {
    noUrlRows.push([
      loc.acronym || '',
      loc.companyName || '',
      loc.website || '',
      loc.locationName || '',
      loc.assignedGA || '',
      loc.state || '',
      '' // GBP URL is blank
    ]);
  }

  console.log('\nStep 5: Getting sheet info...');
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID
  });

  const tab1 = spreadsheet.data.sheets.find(s => s.properties.title === 'Fixable GBP Issues');
  const tab2 = spreadsheet.data.sheets.find(s => s.properties.title === 'Needs GBP Link Added');

  if (!tab1 || !tab2) {
    throw new Error('Could not find required tabs');
  }

  console.log('✓ Found both tabs');

  console.log('\nStep 6: Clearing existing data...');
  await sheets.spreadsheets.values.batchClear({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      ranges: ['Fixable GBP Issues!A:Z', 'Needs GBP Link Added!A:Z']
    }
  });
  console.log('✓ Cleared old data');

  console.log('\nStep 7: Writing new data...');
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: 'RAW',
      data: [
        {
          range: 'Fixable GBP Issues!A1',
          values: fixableRows
        },
        {
          range: 'Needs GBP Link Added!A1',
          values: noUrlRows
        }
      ]
    }
  });
  console.log('✓ Data written successfully');

  console.log('\nStep 8: Formatting headers...');
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: {
              sheetId: tab1.properties.sheetId,
              startRowIndex: 0,
              endRowIndex: 1
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.2, green: 0.2, blue: 0.2 },
                textFormat: {
                  foregroundColor: { red: 1, green: 1, blue: 1 },
                  bold: true
                }
              }
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)'
          }
        },
        {
          repeatCell: {
            range: {
              sheetId: tab2.properties.sheetId,
              startRowIndex: 0,
              endRowIndex: 1
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.2, green: 0.2, blue: 0.2 },
                textFormat: {
                  foregroundColor: { red: 1, green: 1, blue: 1 },
                  bold: true
                }
              }
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)'
          }
        },
        {
          autoResizeDimensions: {
            dimensions: {
              sheetId: tab1.properties.sheetId,
              dimension: 'COLUMNS',
              startIndex: 0,
              endIndex: 10
            }
          }
        },
        {
          autoResizeDimensions: {
            dimensions: {
              sheetId: tab2.properties.sheetId,
              dimension: 'COLUMNS',
              startIndex: 0,
              endIndex: 7
            }
          }
        }
      ]
    }
  });
  console.log('✓ Headers formatted');

  console.log('\n✅ All done!');
  console.log(`\nTab 1 (Fixable): ${fixableData.length} rows`);
  console.log(`Tab 2 (Needs GBP Link): ${noUrlData.length} rows`);
  console.log(`\nSheet URL: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`);
}

main().catch(console.error);
