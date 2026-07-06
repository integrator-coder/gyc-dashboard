const { google } = require('googleapis');
const auth = new google.auth.GoogleAuth({
  keyFile: '/Users/toddthejedigmail.com/.openclaw/workspace/google-service-account.json',
  scopes: ['https://www.googleapis.com/auth/documents']
});
const docs = google.docs({ version: 'v1', auth });
const DOC_ID = '1P8iCtcwFQbGn02EB9zXKF3-Vo4H8Ox4yiwoCKCWZS8A';

(async () => {
  // Get updated doc to find new section indices
  const doc = await docs.documents.get({ documentId: DOC_ID });
  
  // Find "The Offer — Core Reputation Engine Stack" heading
  let offerHeadingStart, offerHeadingEnd;
  let whatInCoreStart, whatInCoreEnd;
  let foundationStart, foundationEnd;
  let coreUpgradesStart, coreUpgradesEnd;
  let pricingStart, pricingEnd;
  let addOnStart, addOnEnd;
  let howToPresentStart, howToPresentEnd;
  
  doc.data.body.content.forEach(element => {
    if (element.paragraph && element.paragraph.elements) {
      const text = element.paragraph.elements.map(e => e.textRun?.content || '').join('');
      
      if (text.includes('The Offer — Core Reputation Engine Stack')) {
        offerHeadingStart = element.startIndex;
        offerHeadingEnd = element.endIndex;
      }
      if (text.includes('What\'s in the Core ($1,499/month):')) {
        whatInCoreStart = element.startIndex;
        whatInCoreEnd = element.endIndex;
      }
      if (text.includes('Foundation base (included):')) {
        foundationStart = element.startIndex;
        foundationEnd = element.endIndex;
      }
      if (text.includes('Core upgrades (above Foundation):')) {
        coreUpgradesStart = element.startIndex;
        coreUpgradesEnd = element.endIndex;
      }
      if (text.includes('Pricing:')) {
        pricingStart = element.startIndex;
        pricingEnd = element.endIndex;
      }
      if (text.includes('Common add-on to mention:')) {
        addOnStart = element.startIndex;
        addOnEnd = element.endIndex;
      }
      if (text.includes('How to present the tiers:')) {
        howToPresentStart = element.startIndex;
        howToPresentEnd = element.endIndex;
      }
    }
  });
  
  console.log('Offer heading:', offerHeadingStart, '-', offerHeadingEnd);
  console.log('What in Core:', whatInCoreStart, '-', whatInCoreEnd);
  console.log('Foundation:', foundationStart, '-', foundationEnd);
  console.log('Core upgrades:', coreUpgradesStart, '-', coreUpgradesEnd);
  console.log('Pricing:', pricingStart, '-', pricingEnd);
  console.log('Add-on:', addOnStart, '-', addOnEnd);
  console.log('How to present:', howToPresentStart, '-', howToPresentEnd);
  
  // Apply formatting
  const requests = [];
  
  // Format main H2 heading: "The Offer — Core Reputation Engine Stack"
  if (offerHeadingStart) {
    requests.push({
      updateParagraphStyle: {
        range: { startIndex: offerHeadingStart, endIndex: offerHeadingEnd },
        paragraphStyle: {
          namedStyleType: 'HEADING_2',
          lineSpacing: 132,
          spaceAbove: { magnitude: 22, unit: 'PT' },
          spaceBelow: { magnitude: 6, unit: 'PT' },
          borderBottom: {
            color: { color: { rgbColor: { red: 0.75686276, green: 0.6117647, blue: 0.27450982 } } },
            width: { magnitude: 1, unit: 'PT' },
            padding: { magnitude: 3, unit: 'PT' },
            dashStyle: 'SOLID'
          }
        },
        fields: 'namedStyleType,lineSpacing,spaceAbove,spaceBelow,borderBottom'
      }
    });
    
    requests.push({
      updateTextStyle: {
        range: { startIndex: offerHeadingStart, endIndex: offerHeadingEnd - 1 },
        textStyle: {
          bold: true,
          foregroundColor: { color: { rgbColor: { red: 0.20392157, green: 0.043137256, blue: 0.40392157 } } },
          weightedFontFamily: { fontFamily: 'Nunito Sans', weight: 400 }
        },
        fields: 'bold,foregroundColor,weightedFontFamily'
      }
    });
  }
  
  // Format H3 sub-headers with gold color
  const h3Sections = [
    [whatInCoreStart, whatInCoreEnd],
    [foundationStart, foundationEnd],
    [coreUpgradesStart, coreUpgradesEnd],
    [pricingStart, pricingEnd],
    [addOnStart, addOnEnd],
    [howToPresentStart, howToPresentEnd]
  ];
  
  h3Sections.forEach(([start, end]) => {
    if (start && end) {
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: start, endIndex: end },
          paragraphStyle: {
            namedStyleType: 'HEADING_3',
            lineSpacing: 132,
            spaceAbove: { magnitude: 10, unit: 'PT' },
            spaceBelow: { magnitude: 4, unit: 'PT' }
          },
          fields: 'namedStyleType,lineSpacing,spaceAbove,spaceBelow'
        }
      });
      
      requests.push({
        updateTextStyle: {
          range: { startIndex: start, endIndex: end - 1 },
          textStyle: {
            bold: true,
            foregroundColor: { color: { rgbColor: { red: 0.75686276, green: 0.6117647, blue: 0.27450982 } } },
            fontSize: { magnitude: 13, unit: 'PT' },
            weightedFontFamily: { fontFamily: 'Nunito Sans', weight: 400 }
          },
          fields: 'bold,foregroundColor,fontSize,weightedFontFamily'
        }
      });
    }
  });
  
  // Apply formatting
  if (requests.length > 0) {
    await docs.documents.batchUpdate({
      documentId: DOC_ID,
      requestBody: { requests }
    });
    console.log('✓ Applied formatting to', requests.length, 'elements');
  }
  
})();
