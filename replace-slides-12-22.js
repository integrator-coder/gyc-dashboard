require('dotenv').config({ path: '.env.local' });
const { google } = require('googleapis');

const auth = new google.auth.GoogleAuth({
  keyFile: '/Users/toddthejedigmail.com/.openclaw/workspace/google-service-account.json',
  scopes: ['https://www.googleapis.com/auth/presentations']
});

const slides = google.slides({ version: 'v1', auth });
const PRES_ID = '1lwpcpIumC1AjVfkntMYE5CyU2uBEukplXxsEpmDl3w0';

// Imgur URLs for slides 12-22 (in order)
const URLS = [
  'https://i.imgur.com/HPQB3aJ.jpeg', // slide 12
  'https://i.imgur.com/oKD1sQZ.jpeg', // slide 13
  'https://i.imgur.com/v2GIvQs.jpeg', // slide 14
  'https://i.imgur.com/KsA0rxS.jpeg', // slide 15
  'https://i.imgur.com/kNwgUq2.jpeg', // slide 16
  'https://i.imgur.com/cvXtBuJ.jpeg', // slide 17
  'https://i.imgur.com/l0ujgMy.jpeg', // slide 18
  'https://i.imgur.com/hy5u6Kg.jpeg', // slide 19
  'https://i.imgur.com/PVsLL7a.jpeg', // slide 20
  'https://i.imgur.com/ANvfzPN.jpeg', // slide 21
  'https://i.imgur.com/T51nnTp.jpeg'  // slide 22
];

async function main() {
  console.log('Fetching presentation...');
  const pres = await slides.presentations.get({ presentationId: PRES_ID });
  const currentSlides = pres.data.slides;
  
  console.log(`Total slides in presentation: ${currentSlides.length}`);
  
  for (let i = 0; i < 11; i++) {
    const slideIndex = i + 11; // slides 12-22 are indices 11-21 (0-indexed)
    const slide = currentSlides[slideIndex];
    
    if (!slide) {
      console.log(`❌ Slide ${slideIndex + 1} not found - skipping`);
      continue;
    }
    
    console.log(`\nProcessing slide ${slideIndex + 1} (${slide.objectId})...`);
    
    const requests = [];
    
    // Delete all existing elements on the slide
    if (slide.pageElements) {
      slide.pageElements.forEach(el => {
        requests.push({ deleteObject: { objectId: el.objectId } });
      });
      console.log(`  Deleting ${slide.pageElements.length} existing elements`);
    }
    
    // Add new full-bleed image
    requests.push({
      createImage: {
        objectId: `img_${slideIndex}_${Date.now()}`,
        url: URLS[i],
        elementProperties: {
          pageObjectId: slide.objectId,
          size: {
            width: { magnitude: 9144000, unit: 'EMU' },  // 10 inches in EMUs
            height: { magnitude: 5143500, unit: 'EMU' }  // 5.625 inches in EMUs (16:9)
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
    
    console.log(`  Adding image: ${URLS[i]}`);
    
    // Execute batch update for this slide
    await slides.presentations.batchUpdate({
      presentationId: PRES_ID,
      requestBody: { requests }
    });
    
    console.log(`✅ Slide ${slideIndex + 1} replaced successfully`);
  }
  
  console.log('\n🎉 All slides 12-22 replaced successfully!');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
