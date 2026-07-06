const { google } = require('googleapis');
const auth = new google.auth.GoogleAuth({
  keyFile: '/Users/toddthejedigmail.com/.openclaw/workspace/google-service-account.json',
  scopes: ['https://www.googleapis.com/auth/documents']
});
const docs = google.docs({ version: 'v1', auth });

(async () => {
  const DOC_ID = '1P8iCtcwFQbGn02EB9zXKF3-Vo4H8Ox4yiwoCKCWZS8A';
  const doc = await docs.documents.get({ documentId: DOC_ID });
  console.log(JSON.stringify(doc.data, null, 2));
})();
