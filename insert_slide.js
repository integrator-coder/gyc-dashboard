const { google } = require('googleapis');
const auth = new google.auth.GoogleAuth({
  keyFile: '/Users/toddthejedigmail.com/.openclaw/workspace/google-service-account.json',
  scopes: ['https://www.googleapis.com/auth/presentations']
});
const slides = google.slides({ version: 'v1', auth });
const PRES_ID = '15BjaYcC4jADSee9YYZTimGGlkfsci2DoH-htBc5quo4';
const IMG_URL = 'https://i.imgur.com/8tmnL8U.jpeg';

(async () => {
  // Step 1: Get current presentation to verify structure
  const pres = await slides.presentations.get({ presentationId: PRES_ID });
  console.log('Current slide count:', pres.data.slides.length);
  
  // Step 2: Create new slide at position 6 (0-indexed = position 7 in 1-indexed)
  const newSlideId = 'rep_engine_stack_slide_' + Date.now();
  await slides.presentations.batchUpdate({
    presentationId: PRES_ID,
    requestBody: {
      requests: [{
        createSlide: {
          objectId: newSlideId,
          insertionIndex: 6,
          slideLayoutReference: { predefinedLayout: 'BLANK' }
        }
      }]
    }
  });
  
  console.log('✓ Created blank slide at position 7 (index 6)');
  
  // Step 3: Add image to the slide (full bleed 16:9)
  // 16:9 aspect ratio: 9144000 EMU wide x 5143500 EMU tall (standard slide dimensions)
  await slides.presentations.batchUpdate({
    presentationId: PRES_ID,
    requestBody: {
      requests: [{
        createImage: {
          objectId: 'rep_engine_stack_img_' + Date.now(),
          url: IMG_URL,
          elementProperties: {
            pageObjectId: newSlideId,
            size: { 
              width: { magnitude: 9144000, unit: 'EMU' }, 
              height: { magnitude: 5143500, unit: 'EMU' } 
            },
            transform: { 
              scaleX: 1, 
              scaleY: 1, 
              translateX: 0, 
              translateY: 0, 
              unit: 'EMU' 
            }
          }
        }
      }]
    }
  });
  
  console.log('✓ Added full-bleed image to slide');
  console.log('✓ Slide inserted successfully at position 7');
  
})();
