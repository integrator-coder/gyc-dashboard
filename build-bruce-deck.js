require('dotenv').config({ path: '.env.local' });
const { google } = require('googleapis');

const PRES_ID = '1lwpcpIumC1AjVfkntMYE5CyU2uBEukplXxsEpmDl3w0';

// All 22 imgur URLs in order
const SLIDES = [
  'https://i.imgur.com/igRlfV9.jpeg',
  'https://i.imgur.com/9A6adpe.jpeg',
  'https://i.imgur.com/H4WvoBD.jpeg',
  'https://i.imgur.com/WkSKKzW.jpeg',
  'https://i.imgur.com/nxkL4RT.jpeg',
  'https://i.imgur.com/FMx8uvP.jpeg',
  'https://i.imgur.com/D35uXlf.jpeg',
  'https://i.imgur.com/oKmQXI8.jpeg',
  'https://i.imgur.com/PJUIhJe.jpeg',
  'https://i.imgur.com/myyLcxn.jpeg',
  'https://i.imgur.com/ZLelB3X.jpeg',
  'https://i.imgur.com/v6kW11x.jpeg',
  'https://i.imgur.com/zKQrzPL.jpeg',
  'https://i.imgur.com/mK9tvlT.jpeg',
  'https://i.imgur.com/IaGlGEt.jpeg',
  'https://i.imgur.com/rH0su98.jpeg',
  'https://i.imgur.com/ua6BaOd.jpeg',
  'https://i.imgur.com/e5kCBF9.jpeg',
  'https://i.imgur.com/WK2Ds1C.jpeg',
  'https://i.imgur.com/7VYPRvs.jpeg',
  'https://i.imgur.com/mN1jnAh.jpeg',
  'https://i.imgur.com/XzPXTq1.jpeg'
];

const SIZE = { width: { magnitude: 9144000, unit: 'EMU' }, height: { magnitude: 5143500, unit: 'EMU' } };
const TRANSFORM = { scaleX: 1, scaleY: 1, translateX: 0, translateY: 0, unit: 'EMU' };

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: '/Users/toddthejedigmail.com/.openclaw/workspace/google-service-account.json',
    scopes: ['https://www.googleapis.com/auth/presentations']
  });

  const slides = google.slides({ version: 'v1', auth });

  console.log('🔍 Fetching current presentation...');
  const pres = await slides.presentations.get({ presentationId: PRES_ID });
  const existingSlides = pres.data.slides || [];

  console.log(`📊 Found ${existingSlides.length} existing slides`);

  // Step 1: Delete all existing slides except the first
  if (existingSlides.length > 1) {
    console.log('🗑️  Deleting existing slides (except first)...');
    const deleteRequests = existingSlides.slice(1).map(s => ({
      deleteObject: { objectId: s.objectId }
    }));
    await slides.presentations.batchUpdate({
      presentationId: PRES_ID,
      requestBody: { requests: deleteRequests }
    });
  }

  // Step 2: Clear the first slide
  console.log('🧹 Clearing first slide...');
  const firstSlideId = existingSlides[0].objectId;
  const firstSlideElements = existingSlides[0].pageElements || [];
  if (firstSlideElements.length > 0) {
    const clearRequests = firstSlideElements.map(el => ({
      deleteObject: { objectId: el.objectId }
    }));
    await slides.presentations.batchUpdate({
      presentationId: PRES_ID,
      requestBody: { requests: clearRequests }
    });
  }

  // Step 3: Add image to first slide
  console.log('🖼️  Adding image to slide 1...');
  await slides.presentations.batchUpdate({
    presentationId: PRES_ID,
    requestBody: {
      requests: [{
        createImage: {
          url: SLIDES[0],
          elementProperties: {
            pageObjectId: firstSlideId,
            size: SIZE,
            transform: TRANSFORM
          }
        }
      }]
    }
  });

  // Step 4: Create slides 2-22 and add images
  for (let i = 1; i < SLIDES.length; i++) {
    const slideNum = i + 1;
    console.log(`📄 Creating slide ${slideNum} and adding image...`);
    
    // Create slide at specific index
    const createResp = await slides.presentations.batchUpdate({
      presentationId: PRES_ID,
      requestBody: {
        requests: [{
          createSlide: {
            insertionIndex: i,
            slideLayoutReference: { predefinedLayout: 'BLANK' }
          }
        }]
      }
    });

    const newSlideId = createResp.data.replies[0].createSlide.objectId;

    // Add image to the new slide
    await slides.presentations.batchUpdate({
      presentationId: PRES_ID,
      requestBody: {
        requests: [{
          createImage: {
            url: SLIDES[i],
            elementProperties: {
              pageObjectId: newSlideId,
              size: SIZE,
              transform: TRANSFORM
            }
          }
        }]
      }
    });
  }

  console.log('✅ Bruce Spurr Reputation Engine deck complete!');
  console.log(`🔗 https://docs.google.com/presentation/d/${PRES_ID}/edit`);
}

main().catch(console.error);
