import { google } from 'googleapis';

const auth = new google.auth.GoogleAuth({
  keyFile: '/Users/toddthejedigmail.com/.openclaw/workspace/google-service-account.json',
  scopes: ['https://www.googleapis.com/auth/presentations'],
});

const slides = google.slides({ version: 'v1', auth });
const PRES_ID = '1KiRIpTqh8SLNDDVG0FV33HUT0nZpqqICB-fcXp8ybOg';

const imageUrls = [
  'https://files.catbox.moe/i5qmaa.png',
  'https://files.catbox.moe/yvfp5g.png',
  'https://files.catbox.moe/yd4tyg.png',
  'https://files.catbox.moe/l44hu6.png',
  'https://files.catbox.moe/u2sgnl.png',
  'https://files.catbox.moe/mtjhlc.png',
  'https://files.catbox.moe/n4j5c9.png',
  'https://files.catbox.moe/o39frk.png',
  'https://files.catbox.moe/wnch5y.png',
  'https://files.catbox.moe/vv8948.png',
];

async function main() {
  console.log('1. Getting existing slides...');
  const pres = await slides.presentations.get({ presentationId: PRES_ID });
  const existingSlides = pres.data.slides || [];
  console.log(`   Found ${existingSlides.length} existing slides`);

  if (existingSlides.length > 0) {
    console.log('2. Deleting all existing slides...');
    const deleteReqs = existingSlides.map(s => ({ 
      deleteObject: { objectId: s.objectId } 
    }));
    await slides.presentations.batchUpdate({ 
      presentationId: PRES_ID, 
      requestBody: { requests: deleteReqs } 
    });
    console.log('   Deleted all existing slides');
  }

  console.log('3. Creating 10 blank slides...');
  const slideIds = [];
  for (let i = 0; i < 10; i++) {
    const id = `img_slide_${i+1}_${Date.now()}_${i}`;
    slideIds.push(id);
    await slides.presentations.batchUpdate({
      presentationId: PRES_ID,
      requestBody: { 
        requests: [{ 
          createSlide: { 
            objectId: id, 
            slideLayoutReference: { predefinedLayout: 'BLANK' } 
          } 
        }] 
      }
    });
    console.log(`   Created slide ${i+1}/10`);
  }

  console.log('4. Inserting images as full-bleed...');
  for (let i = 0; i < slideIds.length; i++) {
    const req = {
      createImage: {
        objectId: `img_${i+1}_${Date.now()}_${i}`,
        url: imageUrls[i],
        elementProperties: {
          pageObjectId: slideIds[i],
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
          },
        },
      }
    };
    
    await slides.presentations.batchUpdate({ 
      presentationId: PRES_ID, 
      requestBody: { requests: [req] } 
    });
    console.log(`   Inserted image ${i+1}/10`);
  }

  console.log('\n✅ Done! All 10 slides populated with images.');
  console.log(`   View presentation: https://docs.google.com/presentation/d/${PRES_ID}/edit`);
}

main().catch(console.error);
