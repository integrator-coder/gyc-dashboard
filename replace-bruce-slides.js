require('dotenv').config({ path: '.env.local' });
const { google } = require('googleapis');

const auth = new google.auth.GoogleAuth({
  keyFile: '/Users/toddthejedigmail.com/.openclaw/workspace/google-service-account.json',
  scopes: ['https://www.googleapis.com/auth/presentations']
});

const slides = google.slides({ version: 'v1', auth });
const PRES_ID = '1lwpcpIumC1AjVfkntMYE5CyU2uBEukplXxsEpmDl3w0';

const URLS = [
  'https://i.imgur.com/cdwpxVZ.jpeg',
  'https://i.imgur.com/i3wk2F3.jpeg',
  'https://i.imgur.com/t98bdS6.jpeg',
  'https://i.imgur.com/6gKP5bz.jpeg',
  'https://i.imgur.com/CZrfm0H.jpeg',
  'https://i.imgur.com/Vtz9NBn.jpeg',
  'https://i.imgur.com/nBNJQFY.jpeg',
  'https://i.imgur.com/43W8gP4.jpeg',
  'https://i.imgur.com/O1HV8wx.jpeg',
  'https://i.imgur.com/Dfs2kv0.jpeg',
  'https://i.imgur.com/0bMdcUt.jpeg'
];

async function main() {
  console.log('Fetching presentation...');
  const pres = await slides.presentations.get({ presentationId: PRES_ID });
  const currentSlides = pres.data.slides;
  
  console.log(`Found ${currentSlides.length} slides in presentation`);
  
  for (let i = 0; i < 11; i++) {
    const slide = currentSlides[i];
    if (!slide) {
      console.log(`Slide ${i + 1} not found, skipping`);
      continue;
    }
    
    console.log(`Processing slide ${i + 1} (${slide.objectId})...`);
    
    const requests = [];
    
    // Delete all existing elements on the slide
    if (slide.pageElements) {
      slide.pageElements.forEach(el => {
        requests.push({ deleteObject: { objectId: el.objectId } });
      });
    }
    
    // Add new image as full-bleed background
    requests.push({
      createImage: {
        objectId: `img_${i}_${Date.now()}`,
        url: URLS[i],
        elementProperties: {
          pageObjectId: slide.objectId,
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
    });
    
    await slides.presentations.batchUpdate({
      presentationId: PRES_ID,
      requestBody: { requests }
    });
    
    console.log(`✓ Replaced slide ${i + 1}`);
  }
  
  console.log('\n✅ All 11 slides replaced successfully!');
  console.log(`View presentation: https://docs.google.com/presentation/d/${PRES_ID}/edit`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
