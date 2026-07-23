const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const key = JSON.parse(fs.readFileSync(process.env.HOME + '/.openclaw/workspace/google-service-account.json'));
const auth = new google.auth.JWT({
  email: key.client_email,
  key: key.private_key,
  scopes: ['https://www.googleapis.com/auth/presentations'],
});
const slides = google.slides({ version: 'v1', auth });
const PRES_ID = '1-Vau69I1SGuu_23eZGCpstPAgwqkMkeg6lgrEbel6lA';

const imageMap = [
  'slide01_title---fbab9c8e-3323-4052-82df-f205c47dd27b.png',
  'slide02_big_picture---40d2d2ac-6082-4efb-8e8f-2e87b784d6fd.png',
  'slide03_what_is_mps---95027fc2-51a3-490b-adec-9bbfafcda180.png',
  'slide04_mtor_explained---df87cb12-8598-43bc-9532-50c45ba888b7.png',
  'slide05_what_is_mpb---0d8e3ec8-76c3-4706-a9ab-6cf1006cfaf0.png',
  'slide06_mpb_drivers---5b2b26c4-f25a-4186-9df3-ae99778cd960.png',
  'slide07_anabolic_resistance---2a8b6bf8-d573-4c7e-a8c9-af0d55f331ae.png',
  'slide08_tax_rate_math---1cacb9ea-e0be-42f2-830a-f4f3b0a58729.png',
  'slide09_strategy_enhancements---50612add-e6fc-493a-b2bb-9931eee25713.png',
  'slide10_steroid_mechanism---38fcc647-6a86-42c3-9d28-4ca3e1984b36.png',
  'slide11_intraworkout_carbs---36590889-6829-4bc2-ba53-1211c3690556.png',
  'slide12_insulin_anticatabolic---f62a7fa8-62cf-46c7-a633-f692e1c111b1.png',
  'slide13_sleep_and_muscle---db18bed2-4e2b-4265-9c74-3a4f4b0046d7.png',
  'slide14_gh_igf1_explained---04beb369-095b-488f-b708-e53a0f2d8413.png',
  'slide15_caffeine_management---e113afde-01f6-4d4b-a09e-7897efb10ebc.png',
  'slide16_full_protocol---239df5ed-fd88-437c-956a-68de98c0876e.png',
  'slide17_glossary---ec02d82d-ed1a-44a1-a8ed-b4eb7a7736a8.png'
];

const basePath = '/Users/toddthejedigmail.com/.openclaw/media/tool-image-generation/';

async function insertImages() {
  try {
    console.log('Fetching presentation...');
    const pres = await slides.presentations.get({ presentationId: PRES_ID });
    const slideObjects = pres.data.slides;
    const pageSize = pres.data.pageSize;
    const width = pageSize.width.magnitude;
    const height = pageSize.height.magnitude;
    const unit = pageSize.width.unit;

    console.log(`Found ${slideObjects.length} slides in presentation`);
    console.log(`Slide dimensions: ${width} x ${height} ${unit}`);

    let successCount = 0;
    let failCount = 0;
    const failures = [];

    for (let i = 0; i < imageMap.length; i++) {
      const imagePath = path.join(basePath, imageMap[i]);
      const slideId = slideObjects[i].objectId;

      console.log(`\n[${i + 1}/17] Processing slide ${i}: ${imageMap[i]}`);

      // Check if image exists
      if (!fs.existsSync(imagePath)) {
        console.log(`  ❌ Image not found: ${imagePath}`);
        failures.push({ slide: i, reason: 'Image file not found' });
        failCount++;
        continue;
      }

      try {
        // Read image and convert to base64
        console.log('  📖 Reading image file...');
        const imageBuffer = fs.readFileSync(imagePath);
        const base64Image = imageBuffer.toString('base64');
        const dataUrl = `data:image/png;base64,${base64Image}`;

        console.log(`  📏 Image size: ${(imageBuffer.length / 1024).toFixed(2)} KB`);

        // Insert image into slide
        console.log('  🖼️  Inserting into slide...');
        const imageId = `img_slide_${i}_${Date.now()}`;
        const requests = [
          {
            createImage: {
              objectId: imageId,
              url: dataUrl,
              elementProperties: {
                pageObjectId: slideId,
                size: {
                  width: { magnitude: width, unit: unit },
                  height: { magnitude: height, unit: unit }
                },
                transform: {
                  scaleX: 1, 
                  scaleY: 1,
                  translateX: 0, 
                  translateY: 0,
                  unit: unit
                }
              }
            }
          },
          {
            updatePageElementsZOrder: {
              pageElementObjectIds: [imageId],
              operation: 'SEND_TO_BACK'
            }
          }
        ];

        await slides.presentations.batchUpdate({
          presentationId: PRES_ID,
          requestBody: { requests }
        });

        console.log('  ✅ Success!');
        successCount++;

        // Rate limiting delay
        if (i < imageMap.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

      } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
        failures.push({ slide: i, reason: error.message });
        failCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully inserted: ${successCount}/17 images`);
    console.log(`❌ Failures: ${failCount}/17`);
    
    if (failures.length > 0) {
      console.log('\nFailed slides:');
      failures.forEach(f => {
        console.log(`  - Slide ${f.slide}: ${f.reason}`);
      });
    }

    console.log(`\n📊 Presentation URL: https://docs.google.com/presentation/d/${PRES_ID}/edit`);

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

insertImages();
