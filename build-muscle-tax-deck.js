const { google } = require('googleapis');
const fs = require('fs');

const key = JSON.parse(fs.readFileSync(process.env.HOME + '/.openclaw/workspace/google-service-account.json'));
const auth = new google.auth.JWT({
  email: key.client_email,
  key: key.private_key,
  scopes: ['https://www.googleapis.com/auth/presentations', 'https://www.googleapis.com/auth/drive'],
});
const slides = google.slides({ version: 'v1', auth });
const drive = google.drive({ version: 'v3', auth });
const PRES_ID = '1-Vau69I1SGuu_23eZGCpstPAgwqkMkeg6lgrEbel6lA';

// Image paths
const images = [
  { path: '/Users/toddthejedigmail.com/.openclaw/media/tool-image-generation/muscle_tax_title---e71e33d1-1fd4-4250-8a2d-0491b613b48e.png', name: 'muscle_tax_title.png' },
  { path: '/Users/toddthejedigmail.com/.openclaw/media/tool-image-generation/mps_mpb_split---ac722546-6870-42ad-8d04-0b3b08b1e6b8.png', name: 'mps_mpb_split.png' },
  { path: '/Users/toddthejedigmail.com/.openclaw/media/tool-image-generation/mtor_pathway---1ad632f1-1f88-414e-ba9d-5c6547324d2c.png', name: 'mtor_pathway.png' },
  { path: '/Users/toddthejedigmail.com/.openclaw/media/tool-image-generation/mpb_cortisol---314f0fcd-0109-461d-adfa-05914247a86f.png', name: 'mpb_cortisol.png' },
  { path: '/Users/toddthejedigmail.com/.openclaw/media/tool-image-generation/natural_vs_enhanced---3581a6ca-fc6a-4d3a-a770-7c532aa37688.png', name: 'natural_vs_enhanced.png' },
  { path: '/Users/toddthejedigmail.com/.openclaw/media/tool-image-generation/intraworkout_carbs_science---1782d354-c4b5-44b1-b56d-ef5e123db9d3.png', name: 'intraworkout_carbs_science.png' },
  { path: '/Users/toddthejedigmail.com/.openclaw/media/tool-image-generation/sleep_hormones---0d3677ab-b772-4dad-be4b-23f7b38bba0f.png', name: 'sleep_hormones.png' },
  { path: '/Users/toddthejedigmail.com/.openclaw/media/tool-image-generation/caffeine_halflife---dc55cfec-dd91-46ef-b894-139ce9d82381.png', name: 'caffeine_halflife.png' },
  { path: '/Users/toddthejedigmail.com/.openclaw/media/tool-image-generation/combined_effect_final---7c81b2f2-53ed-403f-9270-d23f6b1c3591.png', name: 'combined_effect_final.png' }
];

// Upload images to Drive and make public
async function uploadImages() {
  console.log('Uploading images to Google Drive...');
  const imageUrls = [];
  
  for (const img of images) {
    const { data: fileData } = await drive.files.create({
      requestBody: { name: img.name, mimeType: 'image/png' },
      media: { mimeType: 'image/png', body: fs.createReadStream(img.path) },
    });
    
    await drive.permissions.create({
      fileId: fileData.id,
      requestBody: { role: 'reader', type: 'anyone' },
    });
    
    const imageUrl = `https://drive.google.com/uc?export=view&id=${fileData.id}`;
    imageUrls.push(imageUrl);
    console.log(`Uploaded: ${img.name} -> ${imageUrl}`);
  }
  
  return imageUrls;
}

// Slide data
const slideData = [
  {
    title: 'THE MUSCLE TAX',
    subtitle: 'Why You\'re Losing Nearly Half the Muscle You Build — And How to Stop It',
    bottomTag: '@MUSCLECARTER30 | Breakdown by Wall·E',
    bullets: null,
    imageIndex: 0
  },
  {
    title: 'YOUR MUSCLE IS BEING TAXED',
    subtitle: null,
    bottomTag: null,
    bullets: [
      'Every rep you do builds muscle protein (MPS) — but the body simultaneously breaks it down (MPB)',
      'Net Muscle Gain = MPS − MPB. If MPB is high, your gains disappear.',
      '30+, natural, stressed, or sleep-deprived? Your tax rate hits ~40%',
      'That means you\'re netting only 60 units of muscle for every 100 you build',
      'This is called Anabolic Resistance — the older, more stressed you are, the worse it gets'
    ],
    imageIndex: 1
  },
  {
    title: 'MUSCLE PROTEIN SYNTHESIS (MPS)',
    subtitle: 'The Income Side',
    bottomTag: null,
    bullets: [
      'Triggered by: resistance training + protein intake (especially leucine — need ~2.5-3g per meal)',
      'Key pathway: mTOR activation → ribosomal translation → new muscle protein',
      'Satellite cells donate nuclei to muscle fibers — more nuclei = more growth potential',
      'MPS peaks 1-2 hours post-workout, stays elevated 24-48 hours',
      'After 30: MPS response to the same training drops ~30% (anabolic resistance)'
    ],
    imageIndex: 2
  },
  {
    title: 'MUSCLE PROTEIN BREAKDOWN (MPB)',
    subtitle: 'The Tax Collector',
    bottomTag: null,
    bullets: [
      'Driven by: cortisol (stress hormone), inflammatory cytokines (IL-6, TNF-α), aging',
      'Mechanisms: ubiquitin-proteasome system tags proteins for degradation; autophagy recycles them',
      'After 30: MPB increases as hormone sensitivity drops and inflammation rises',
      'Cortisol is the primary villain — elevates MPB through multiple pathways simultaneously',
      'Sleep deprivation alone raises 24-hour cortisol by 20-40%'
    ],
    imageIndex: 3
  },
  {
    title: 'STRATEGY 1: ENHANCEMENTS',
    subtitle: 'Change the Game Entirely',
    bottomTag: null,
    bullets: [
      'Anabolic steroids bind to androgen receptors → activate anabolic gene transcription',
      'MPS effect: +300-500% — the same training produces dramatically more protein synthesis',
      'MPB effect: -50%+ — suppresses glucocorticoid (cortisol) signaling directly',
      'Net result: Natural builds 60, loses 40 → nets 60. Enhanced builds 400, loses 20 → nets 380',
      'Not a supplement tweak — it fundamentally rewires the hormonal environment',
      'Comes with serious health tradeoffs not covered here'
    ],
    imageIndex: 4
  },
  {
    title: 'STRATEGY 2: INTRA-WORKOUT CARBS',
    subtitle: '30-60g of Sugar During Training',
    bottomTag: null,
    bullets: [
      'Insulin is powerfully anti-catabolic — spikes from carbs directly inhibit the ubiquitin-proteasome pathway',
      'Reduces MPB by 30-50% during and after training (insulin\'s main role here is NOT building, it\'s preventing breakdown)',
      'Prevents gluconeogenesis — when glycogen drops, the body cannibalizes muscle for fuel. Carbs stop this.',
      'Blunts cortisol: 30-60g during training reduces exercise cortisol spike by 15-25%',
      'Supports progressive overload: sustained blood glucose = sustained ATP = you push harder, longer',
      'Best sources: Gatorade, dextrose, maltodextrin, gummy bears. Best for sessions 60+ min.'
    ],
    imageIndex: 5
  },
  {
    title: 'STRATEGY 3A: SLEEP QUALITY',
    subtitle: '22+ Hours of Recovery Matters More Than 1 Hour of Training',
    bottomTag: null,
    bullets: [
      'Growth Hormone: 70% of daily GH releases during deep sleep (stages 3-4). Cut 8hrs to 6hrs = 30% less GH',
      'Testosterone: peaks during REM sleep. One week of 5-hr nights drops testosterone 10-15%',
      'Cortisol: sleep deprivation raises 24-hour cortisol 20-40% — directly increasing MPB all day',
      'Inflammatory cytokines (IL-6, TNF-α): rise with poor sleep — same ones that cause anabolic resistance',
      'Magnesium glycinate 200-400mg before bed: GABA agonist, improves deep sleep %, aids muscle relaxation',
      'A Sunday nap on caffeine-free day accelerates adenosine clearance and resets sleep drive'
    ],
    imageIndex: 6
  },
  {
    title: 'STRATEGY 3B: CAFFEINE MANAGEMENT',
    subtitle: 'The Hidden MPB Driver',
    bottomTag: null,
    bullets: [
      'Caffeine half-life: 5-6 hours. 3 PM coffee = 25% still active at 1 AM — wrecking deep sleep silently',
      'Chronic high intake keeps baseline cortisol elevated throughout the day',
      'Blocks adenosine receptors — over time brain downregulates them, harder to achieve deep sleep',
      'The Protocol: Cap at 2 coffees / 2 energy drinks / 1 pre-workout scoop per day',
      'No caffeine after 2 PM. One caffeine-free day per week (Sunday)',
      'The \'hitting the wall\' crash on caffeine-free day = adenosine clearing. Take a nap. That\'s the reset.'
    ],
    imageIndex: 7
  },
  {
    title: 'COMBINE ALL THREE: THE MATH',
    subtitle: null,
    bottomTag: 'Maximum gains = Maximize MPS AND Minimize MPB. You need both.',
    bullets: [
      'Baseline (30+, natural, suboptimal): Build 100, lose 40 → NET 60',
      '+ Intra-workout carbs: MPB drops to ~25 → NET 75 (+25%)',
      '+ Sleep + caffeine cap: MPB drops to ~15-20 → NET 80-85 (+42%)',
      '+ Enhancements: MPS 400+, MPB 10-20 → NET 380+ (different league)',
      'For natural lifters: strategies 2 & 3 can cut your tax rate from 40% down to ~15-20%',
      'That\'s the difference between spinning your wheels and actually compounding gains over years'
    ],
    imageIndex: 8
  }
];

async function buildDeck(imageUrls) {
  console.log('\nBuilding slide deck...');
  
  // Get current presentation
  const pres = await slides.presentations.get({ presentationId: PRES_ID });
  const pageWidth = pres.data.pageSize.width.magnitude;
  const pageHeight = pres.data.pageSize.height.magnitude;
  
  console.log(`Page dimensions: ${pageWidth} x ${pageHeight} EMUs`);
  
  // Delete all existing slides except the first one
  const existingSlides = pres.data.slides;
  if (existingSlides.length > 1) {
    const deleteRequests = existingSlides.slice(1).map(slide => ({
      deleteObject: { objectId: slide.objectId }
    }));
    
    await slides.presentations.batchUpdate({
      presentationId: PRES_ID,
      requestBody: { requests: deleteRequests }
    });
    console.log(`Deleted ${deleteRequests.length} existing slides`);
  }
  
  // Get the remaining slide ID (we'll reuse this for slide 1)
  const updatedPres = await slides.presentations.get({ presentationId: PRES_ID });
  const firstSlideId = updatedPres.data.slides[0].objectId;
  
  // Build slide 1 (reuse existing slide)
  console.log('\nBuilding slide 1...');
  await buildSlide(firstSlideId, slideData[0], imageUrls[0], pageWidth, pageHeight, false);
  
  // Create and build remaining slides
  for (let i = 1; i < slideData.length; i++) {
    console.log(`\nBuilding slide ${i + 1}...`);
    const slideId = `slide_${i}`;
    
    // Create new slide
    await slides.presentations.batchUpdate({
      presentationId: PRES_ID,
      requestBody: {
        requests: [{
          createSlide: {
            objectId: slideId,
            insertionIndex: i
          }
        }]
      }
    });
    
    // Build the slide
    await buildSlide(slideId, slideData[i], imageUrls[i], pageWidth, pageHeight, true);
  }
  
  console.log('\n✅ Deck complete!');
  console.log(`https://docs.google.com/presentation/d/${PRES_ID}/edit`);
}

async function buildSlide(slideId, data, imageUrl, pageWidth, pageHeight, clearSlide) {
  const requests = [];
  
  // Clear the slide first if needed
  if (clearSlide) {
    const slideData = await slides.presentations.get({ presentationId: PRES_ID });
    const slide = slideData.data.slides.find(s => s.objectId === slideId);
    if (slide && slide.pageElements) {
      slide.pageElements.forEach(element => {
        requests.push({ deleteObject: { objectId: element.objectId } });
      });
    }
  }
  
  // Add dark background
  requests.push({
    updatePageProperties: {
      objectId: slideId,
      pageProperties: {
        pageBackgroundFill: {
          solidFill: {
            color: { rgbColor: { red: 0.06, green: 0.09, blue: 0.16 } } // #0f172a
          }
        }
      },
      fields: 'pageBackgroundFill'
    }
  });
  
  // Add background image (full bleed, behind text)
  const imageId = `image_${slideId}`;
  requests.push({
    createImage: {
      objectId: imageId,
      url: imageUrl,
      elementProperties: {
        pageObjectId: slideId,
        size: { width: { magnitude: pageWidth, unit: 'EMU' }, height: { magnitude: pageHeight, unit: 'EMU' } },
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
  
  // Add semi-transparent overlay on left side (60% width)
  const overlayId = `overlay_${slideId}`;
  const overlayWidth = pageWidth * 0.6;
  requests.push({
    createShape: {
      objectId: overlayId,
      shapeType: 'RECTANGLE',
      elementProperties: {
        pageObjectId: slideId,
        size: { width: { magnitude: overlayWidth, unit: 'EMU' }, height: { magnitude: pageHeight, unit: 'EMU' } },
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
  
  // Style the overlay (dark, semi-transparent)
  requests.push({
    updateShapeProperties: {
      objectId: overlayId,
      shapeProperties: {
        shapeBackgroundFill: {
          solidFill: {
            color: { rgbColor: { red: 0.06, green: 0.09, blue: 0.16 } }, // #0f172a
            alpha: 0.92
          }
        },
        outline: { dashStyle: 'SOLID', weight: { magnitude: 0, unit: 'PT' } }
      },
      fields: 'shapeBackgroundFill,outline'
    }
  });
  
  // Add title
  const titleId = `title_${slideId}`;
  const titleTop = pageHeight * 0.08;
  const titleLeft = pageWidth * 0.05;
  const titleWidth = overlayWidth * 0.9;
  
  requests.push({
    createShape: {
      objectId: titleId,
      shapeType: 'TEXT_BOX',
      elementProperties: {
        pageObjectId: slideId,
        size: { width: { magnitude: titleWidth, unit: 'EMU' }, height: { magnitude: pageHeight * 0.15, unit: 'EMU' } },
        transform: {
          scaleX: 1,
          scaleY: 1,
          translateX: titleLeft,
          translateY: titleTop,
          unit: 'EMU'
        }
      }
    }
  });
  
  requests.push({
    insertText: {
      objectId: titleId,
      text: data.title
    }
  });
  
  requests.push({
    updateTextStyle: {
      objectId: titleId,
      style: {
        bold: true,
        fontSize: { magnitude: 36, unit: 'PT' },
        foregroundColor: { opaqueColor: { rgbColor: { red: 0.96, green: 0.62, blue: 0.04 } } } // Gold #f59e0b
      },
      fields: 'bold,fontSize,foregroundColor'
    }
  });
  
  // Add subtitle if present
  if (data.subtitle) {
    const subtitleId = `subtitle_${slideId}`;
    const subtitleTop = titleTop + pageHeight * 0.12;
    
    requests.push({
      createShape: {
        objectId: subtitleId,
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: slideId,
          size: { width: { magnitude: titleWidth, unit: 'EMU' }, height: { magnitude: pageHeight * 0.08, unit: 'EMU' } },
          transform: {
            scaleX: 1,
            scaleY: 1,
            translateX: titleLeft,
            translateY: subtitleTop,
            unit: 'EMU'
          }
        }
      }
    });
    
    requests.push({
      insertText: {
        objectId: subtitleId,
        text: data.subtitle
      }
    });
    
    requests.push({
      updateTextStyle: {
        objectId: subtitleId,
        style: {
          fontSize: { magnitude: 20, unit: 'PT' },
          foregroundColor: { opaqueColor: { rgbColor: { red: 0.02, green: 0.71, blue: 0.83 } } } // Cyan #06b6d4
        },
        fields: 'fontSize,foregroundColor'
      }
    });
  }
  
  // Add bullets if present
  if (data.bullets) {
    const bulletsId = `bullets_${slideId}`;
    const bulletsTop = data.subtitle ? titleTop + pageHeight * 0.22 : titleTop + pageHeight * 0.15;
    const bulletsHeight = pageHeight * 0.55;
    
    requests.push({
      createShape: {
        objectId: bulletsId,
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: slideId,
          size: { width: { magnitude: titleWidth, unit: 'EMU' }, height: { magnitude: bulletsHeight, unit: 'EMU' } },
          transform: {
            scaleX: 1,
            scaleY: 1,
            translateX: titleLeft,
            translateY: bulletsTop,
            unit: 'EMU'
          }
        }
      }
    });
    
    const bulletText = data.bullets.map(b => `• ${b}`).join('\n');
    requests.push({
      insertText: {
        objectId: bulletsId,
        text: bulletText
      }
    });
    
    requests.push({
      updateTextStyle: {
        objectId: bulletsId,
        style: {
          fontSize: { magnitude: 16, unit: 'PT' },
          foregroundColor: { opaqueColor: { rgbColor: { red: 0.89, green: 0.91, blue: 0.94 } } } // Light gray #e2e8f0
        },
        fields: 'fontSize,foregroundColor'
      }
    });
  }
  
  // Add bottom tag if present
  if (data.bottomTag) {
    const tagId = `tag_${slideId}`;
    const tagTop = pageHeight * 0.9;
    
    requests.push({
      createShape: {
        objectId: tagId,
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: slideId,
          size: { width: { magnitude: titleWidth, unit: 'EMU' }, height: { magnitude: pageHeight * 0.08, unit: 'EMU' } },
          transform: {
            scaleX: 1,
            scaleY: 1,
            translateX: titleLeft,
            translateY: tagTop,
            unit: 'EMU'
          }
        }
      }
    });
    
    requests.push({
      insertText: {
        objectId: tagId,
        text: data.bottomTag
      }
    });
    
    requests.push({
      updateTextStyle: {
        objectId: tagId,
        style: {
          fontSize: { magnitude: 14, unit: 'PT' },
          foregroundColor: { opaqueColor: { rgbColor: { red: 0.89, green: 0.91, blue: 0.94 } } } // Light gray
        },
        fields: 'fontSize,foregroundColor'
      }
    });
  }
  
  // Execute all requests in batch
  await slides.presentations.batchUpdate({
    presentationId: PRES_ID,
    requestBody: { requests }
  });
}

async function main() {
  try {
    const imageUrls = await uploadImages();
    await buildDeck(imageUrls);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
