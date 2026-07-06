const { google } = require('googleapis');

async function renamePresentation() {
  const auth = new google.auth.GoogleAuth({
    keyFile: '/Users/toddthejedigmail.com/.openclaw/workspace/google-service-account.json',
    scopes: ['https://www.googleapis.com/auth/drive']
  });
  
  const drive = google.drive({ version: 'v3', auth });
  
  try {
    const result = await drive.files.update({
      fileId: '15BjaYcC4jADSee9YYZTimGGlkfsci2DoH-htBc5quo4',
      requestBody: { name: 'Reputation Engine Core' }
    });
    console.log('✅ Presentation renamed successfully:', result.data.name);
  } catch (error) {
    console.error('❌ Error renaming presentation:', error.message);
    process.exit(1);
  }
}

renamePresentation();
