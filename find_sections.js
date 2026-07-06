const { google } = require('googleapis');
const auth = new google.auth.GoogleAuth({
  keyFile: '/Users/toddthejedigmail.com/.openclaw/workspace/google-service-account.json',
  scopes: ['https://www.googleapis.com/auth/documents']
});
const docs = google.docs({ version: 'v1', auth });

(async () => {
  const DOC_ID = '1P8iCtcwFQbGn02EB9zXKF3-Vo4H8Ox4yiwoCKCWZS8A';
  const doc = await docs.documents.get({ documentId: DOC_ID });
  
  // Extract all headings
  doc.data.body.content.forEach(element => {
    if (element.paragraph && element.paragraph.paragraphStyle && 
        (element.paragraph.paragraphStyle.namedStyleType === 'HEADING_1' || 
         element.paragraph.paragraphStyle.namedStyleType === 'HEADING_2')) {
      const text = element.paragraph.elements.map(e => e.textRun?.content || '').join('').trim();
      const style = element.paragraph.paragraphStyle.namedStyleType;
      const startIndex = element.startIndex;
      const endIndex = element.endIndex;
      console.log(`${style} | Index ${startIndex}-${endIndex} | "${text}"`);
    }
  });
})();
