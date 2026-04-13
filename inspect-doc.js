const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const DOC_ID = '15scnaOycWILyC3OHQTEsv--9vfF47sxlJNR0Pi4VSNQ';
const CREDS_PATH = path.join(process.env.HOME, '.openclaw/credentials/google-console.json');

async function main() {
  const creds = JSON.parse(fs.readFileSync(CREDS_PATH));
  const auth = new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/documents'] });
  const docs = google.docs({ version: 'v1', auth });

  const { data: doc } = await docs.documents.get({ documentId: DOC_ID });
  
  for (const elem of doc.body.content) {
    if (elem.paragraph) {
      let text = '';
      for (const run of (elem.paragraph.elements || [])) {
        if (run.textRun) text += run.textRun.content;
      }
      const trimmed = text.replace(/\n$/, '');
      if (trimmed.length < 120) {
        console.log(`[${elem.startIndex}-${elem.endIndex}] "${trimmed}"`);
      } else {
        console.log(`[${elem.startIndex}-${elem.endIndex}] "${trimmed.substring(0, 100)}..."`);
      }
    } else if (elem.table) {
      console.log(`[${elem.startIndex}-${elem.endIndex}] [TABLE ${elem.table.rows}x${elem.table.columns}]`);
    }
  }
}

main().catch(console.error);
