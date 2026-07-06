const { google } = require('googleapis');

async function addLinkToDoc() {
  const auth = new google.auth.GoogleAuth({
    keyFile: '/Users/toddthejedigmail.com/.openclaw/workspace/google-service-account.json',
    scopes: ['https://www.googleapis.com/auth/documents']
  });
  
  const docs = google.docs({ version: 'v1', auth });
  const docId = '1P8iCtcwFQbGn02EB9zXKF3-Vo4H8Ox4yiwoCKCWZS8A';
  
  try {
    // Read the document first
    const doc = await docs.documents.get({ documentId: docId });
    
    // Find the insertion point - look for "Who You're Calling" or similar heading
    let insertIndex = 1; // Default to after title
    const content = doc.data.body.content;
    
    for (let i = 0; i < content.length; i++) {
      const element = content[i];
      if (element.paragraph && element.paragraph.elements) {
        const text = element.paragraph.elements
          .map(e => e.textRun?.content || '')
          .join('')
          .toLowerCase();
        
        if (text.includes("who you're calling") || text.includes("who you're calling")) {
          insertIndex = element.startIndex;
          console.log(`Found "Who You're Calling" section at index ${insertIndex}`);
          break;
        }
      }
    }
    
    // Insert the new section
    const requests = [
      // Insert heading
      {
        insertText: {
          location: { index: insertIndex },
          text: 'Resources\n'
        }
      },
      // Style as heading
      {
        updateParagraphStyle: {
          range: {
            startIndex: insertIndex,
            endIndex: insertIndex + 10
          },
          paragraphStyle: {
            namedStyleType: 'HEADING_2'
          },
          fields: 'namedStyleType'
        }
      },
      // Insert body text
      {
        insertText: {
          location: { index: insertIndex + 10 },
          text: 'Web-Only & Blueprint Client List (target prospect sheet for upgrade calls):\n'
        }
      },
      // Insert hyperlinked text
      {
        insertText: {
          location: { index: insertIndex + 10 + 78 },
          text: 'View Client List →\n\n'
        }
      },
      // Add hyperlink
      {
        updateTextStyle: {
          range: {
            startIndex: insertIndex + 10 + 78,
            endIndex: insertIndex + 10 + 78 + 18
          },
          textStyle: {
            link: {
              url: 'https://docs.google.com/spreadsheets/d/126rOrNdseglmMe8UF4YyKGviLMNWr9pGYcviaoH2cOk/edit?usp=sharing'
            }
          },
          fields: 'link'
        }
      }
    ];
    
    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: { requests }
    });
    
    console.log('✅ Link added successfully to GA Playbook doc');
  } catch (error) {
    console.error('❌ Error updating document:', error.message);
    if (error.code === 403) {
      console.error('Service account may not have access to the document');
    }
    process.exit(1);
  }
}

addLinkToDoc();
