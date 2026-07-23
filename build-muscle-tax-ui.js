const { google } = require('googleapis');
const fs = require('fs');

const key = JSON.parse(fs.readFileSync(process.env.HOME + '/.openclaw/workspace/google-service-account.json'));
const auth = new google.auth.JWT({
  email: key.client_email,
  key: key.private_key,
  scopes: ['https://www.googleapis.com/auth/presentations'],
});
const slides = google.slides({ version: 'v1', auth });
const PRES_ID = '1-Vau69I1SGuu_23eZGCpstPAgwqkMkeg6lgrEbel6lA';

// Comprehensive slide content
const slideData = [
  {
    title: 'THE MUSCLE TAX',
    subtitle: 'Why You\'re Losing Nearly Half the Muscle You Build — And How to Stop It',
    bottomTag: '@MUSCLECARTER30 | Deep Dive by Wall·E',
    bullets: null
  },
  {
    title: 'THE BIG PICTURE',
    subtitle: 'Think of Muscle Like Money',
    bottomTag: null,
    bullets: [
      'Muscle Protein Synthesis (MPS) = your income — building new muscle tissue',
      'Muscle Protein Breakdown (MPB) = the tax — muscle being broken down for fuel',
      'Net Muscle Gain = MPS − MPB (what\'s left after taxes)',
      'If you build 100 units but lose 40 to breakdown, you net only 60',
      'The goal: maximize MPS AND minimize MPB. Most people only focus on MPS.'
    ]
  },
  {
    title: 'WHAT IS MPS?',
    subtitle: 'Muscle Protein Synthesis — The Building Phase',
    bottomTag: null,
    bullets: [
      'MPS = the process where your cells assemble new muscle proteins from amino acids',
      'Triggered by: resistance training + protein intake (especially leucine)',
      'Leucine threshold: need ~2.5-3g per meal to fully trigger MPS',
      'Peaks 1-2 hours post-workout, stays elevated 24-48 hours',
      'Satellite cells donate nuclei to muscle fibers → more nuclei = more growth capacity',
      'This is what everyone talks about when they say "building muscle"'
    ]
  },
  {
    title: 'WHAT IS mTOR?',
    subtitle: 'The Master Switch for Muscle Growth',
    bottomTag: null,
    bullets: [
      'mTOR = "mechanistic target of rapamycin" — a protein complex inside cells',
      'Think of it as the growth switch: when ON, cells build protein. When OFF, they don\'t.',
      'Activated by: leucine (amino acid), insulin, mechanical tension (lifting)',
      'When activated → signals ribosomes to translate mRNA into new proteins',
      'Why it matters: mTOR is THE gateway. No mTOR activation = no MPS, regardless of protein intake.',
      'Rapamycin (a drug) shuts down mTOR — used to study its role'
    ]
  },
  {
    title: 'WHAT IS MPB?',
    subtitle: 'Muscle Protein Breakdown — The Tax Collector',
    bottomTag: null,
    bullets: [
      'MPB = the process where muscle proteins are broken down into amino acids',
      'Why it happens: body needs amino acids for energy, immune function, organ maintenance',
      'It\'s not a bug — it\'s how the body stays alive when resources are tight',
      'Driven by: cortisol, inflammation, calorie deficits, aging, stress',
      'Two main systems: ubiquitin-proteasome (tags proteins for recycling) and autophagy (cellular cleanup)',
      'The problem: after 30, MPB rises while MPS drops → anabolic resistance'
    ]
  },
  {
    title: 'KEY MPB DRIVERS',
    subtitle: 'What Actually Breaks Down Muscle',
    bottomTag: null,
    bullets: [
      'Cortisol: stress hormone — directly activates protein breakdown pathways',
      'Ubiquitin-Proteasome System: tags damaged/old proteins with ubiquitin → proteasome destroys them',
      'Autophagy: cellular recycling — breaks down proteins and organelles to reuse components',
      'IL-6 (Interleukin-6): inflammatory cytokine — rises with stress, poor sleep, aging',
      'TNF-α (Tumor Necrosis Factor Alpha): another inflammatory signal — triggers muscle wasting',
      'All five rise with age, stress, sleep deprivation, and chronic training without recovery'
    ]
  },
  {
    title: 'ANABOLIC RESISTANCE',
    subtitle: 'Why Building Muscle Gets Harder After 30',
    bottomTag: null,
    bullets: [
      'Anabolic Resistance = when the same training + protein produces LESS muscle growth',
      'Cause: aging reduces receptor sensitivity — mTOR doesn\'t respond as strongly',
      'MPS drops ~30% for the same stimulus (same workout, same protein intake)',
      'MPB rises due to chronic low-grade inflammation (inflammaging)',
      'Hormonal shifts: testosterone, GH, IGF-1 all decline with age',
      'Result: the tax rate climbs from ~20% (age 20) to ~40% (age 40+)',
      'You\'re not weaker — your biology is just taxing you harder'
    ]
  },
  {
    title: 'THE TAX RATE MATH',
    subtitle: 'What a 40% Tax Actually Looks Like',
    bottomTag: null,
    bullets: [
      'Scenario: You train hard, eat 180g protein/day, sleep okay',
      'Your body builds 100 units of muscle protein (MPS)',
      'Simultaneously, stress + age + inflammation break down 40 units (MPB)',
      'Net Gain = 100 − 40 = 60 units',
      'That\'s a 40% tax rate — you\'re losing nearly half your work',
      'A 20-year-old in the same scenario? Builds 100, loses 20 → nets 80',
      'The difference compounds: over a year, that\'s 30% more total muscle for the younger lifter'
    ]
  },
  {
    title: 'STRATEGY 1: ENHANCEMENTS',
    subtitle: 'Change the Game Entirely (PEDs)',
    bottomTag: 'Not medical advice — understand the mechanism',
    bullets: [
      'PEDs (Performance Enhancing Drugs) = anabolic steroids, SARMs, GH, peptides',
      'How they work: dramatically increase MPS AND decrease MPB simultaneously',
      'MPS effect: +300-500% — same training produces 4-5x more protein synthesis',
      'MPB effect: −50%+ — suppress cortisol signaling, block breakdown pathways',
      'Net result: Natural = build 100, lose 40 → net 60. Enhanced = build 400, lose 20 → net 380',
      'Not a supplement tweak — fundamentally rewires hormonal environment',
      'Comes with serious health tradeoffs (liver, cardiovascular, endocrine suppression)'
    ]
  },
  {
    title: 'HOW ANABOLIC STEROIDS WORK',
    subtitle: 'The Actual Mechanism',
    bottomTag: null,
    bullets: [
      'Step 1: Exogenous testosterone enters bloodstream',
      'Step 2: Binds to androgen receptors (AR) on muscle cell surface',
      'Step 3: AR-testosterone complex enters nucleus → activates gene transcription',
      'Step 4: Genes code for anabolic proteins → ribosomes produce them',
      'Step 5: Satellite cells proliferate faster → donate more nuclei to muscle fibers',
      'Simultaneously: suppresses glucocorticoid receptors (cortisol\'s docking site) → MPB drops',
      'Result: MPS skyrockets, MPB plummets — the tax rate becomes negligible'
    ]
  },
  {
    title: 'STRATEGY 2: INTRA-WORKOUT CARBS',
    subtitle: '30-60g Sugar During Training',
    bottomTag: 'Best for sessions 60+ minutes',
    bullets: [
      'Why it works: Insulin is powerfully anti-catabolic (stops breakdown, doesn\'t build)',
      'Carbs spike insulin → insulin directly inhibits the ubiquitin-proteasome pathway',
      'Reduces MPB by 30-50% during and after training',
      'Prevents gluconeogenesis: when glycogen drops, body cannibalizes muscle for glucose. Carbs prevent this.',
      'Blunts exercise cortisol spike by 15-25%',
      'Supports performance: sustained blood glucose = sustained ATP = harder, longer sets',
      'Best sources: Gatorade, dextrose, maltodextrin, gummy bears, Carb10'
    ]
  },
  {
    title: 'INSULIN\'S ANTI-CATABOLIC ROLE',
    subtitle: 'Why Insulin Matters for Muscle (But Not Why You Think)',
    bottomTag: null,
    bullets: [
      'Common myth: "Insulin builds muscle" — FALSE',
      'Reality: Insulin PREVENTS muscle breakdown. mTOR builds muscle.',
      'Mechanism 1: Insulin blocks ubiquitin-proteasome system → proteins aren\'t tagged for destruction',
      'Mechanism 2: Prevents gluconeogenesis → body doesn\'t convert muscle protein to glucose',
      'Mechanism 3: Blunts cortisol release during training → less catabolic signaling',
      'This is why intra-workout carbs work — not because they build muscle, but because they PROTECT it',
      'Leucine triggers mTOR. Insulin protects the muscle mTOR builds. Both matter.'
    ]
  },
  {
    title: 'STRATEGY 3A: SLEEP AND MUSCLE',
    subtitle: '22+ Hours of Recovery > 1 Hour of Training',
    bottomTag: null,
    bullets: [
      'Growth Hormone (GH): 70% of daily GH releases during deep sleep (stages 3-4)',
      'Cut sleep 8hrs → 6hrs = 30% less GH released',
      'Testosterone: peaks during REM. One week of 5-hour nights = 10-15% testosterone drop',
      'Cortisol regulation: sleep deprivation raises 24-hour cortisol by 20-40%',
      'Inflammatory cytokines (IL-6, TNF-α): spike with poor sleep → directly increase MPB',
      'Magnesium glycinate 200-400mg before bed: GABA agonist, improves deep sleep %',
      'The fix: 7-9 hours, consistent schedule, dark room, cool temp (65-68°F)'
    ]
  },
  {
    title: 'WHAT IS GH AND IGF-1?',
    subtitle: 'The Growth Hormone Cascade',
    bottomTag: null,
    bullets: [
      'GH (Growth Hormone): peptide hormone released by pituitary gland',
      'Primary release: during deep sleep and intense exercise',
      'GH travels to the liver → liver converts it to IGF-1 (Insulin-like Growth Factor 1)',
      'IGF-1 circulates in blood → enters muscle cells → activates mTOR pathway',
      'IGF-1 is the actual anabolic signal — GH is the messenger',
      'Why sleep matters: no deep sleep = no GH pulse = no IGF-1 = blunted mTOR = less MPS',
      'This is one reason why sleep-deprived lifters don\'t grow despite eating/training right'
    ]
  },
  {
    title: 'STRATEGY 3B: CAFFEINE MANAGEMENT',
    subtitle: 'The Hidden MPB Driver',
    bottomTag: null,
    bullets: [
      'Caffeine half-life: 5-6 hours. 3 PM coffee = 25% still active at 1 AM',
      'Blocks adenosine receptors — adenosine builds during the day to make you sleepy',
      'Chronic caffeine → brain downregulates adenosine receptors → harder to achieve deep sleep',
      'Elevates baseline cortisol throughout the day → sustained MPB increase',
      'The Protocol: Cap at 2 coffees / 2 energy drinks / 1 pre-workout per day',
      'No caffeine after 2 PM (adjust based on your bedtime)',
      'One caffeine-free day per week (Sunday) — the "crash" = adenosine clearing. Take a nap. That\'s the reset.'
    ]
  },
  {
    title: 'THE FULL PROTOCOL',
    subtitle: 'Combining All Three Strategies',
    bottomTag: 'Maximum natural gains = Maximize MPS AND Minimize MPB',
    bullets: [
      'Baseline (30+, natural, suboptimal habits): Build 100, lose 40 → NET 60',
      '+ Intra-workout carbs (30-60g): MPB drops to ~25 → NET 75 (+25% improvement)',
      '+ Sleep optimization + caffeine cap: MPB drops to ~15-20 → NET 80-85 (+42% improvement)',
      '+ Enhancements (steroids/GH): MPS 400+, MPB 10-20 → NET 380+ (different league entirely)',
      'For natural lifters: combining strategies 2 & 3 can cut tax rate from 40% → ~15-20%',
      'That\'s the difference between spinning wheels and compounding gains year over year',
      'You can\'t out-train a high MPB rate — you have to address the tax'
    ]
  },
  {
    title: 'GLOSSARY',
    subtitle: 'Every Term Explained',
    bottomTag: 'Save this slide — reference it anytime',
    bullets: [
      'MPS = Muscle Protein Synthesis (building new muscle proteins)',
      'MPB = Muscle Protein Breakdown (breaking down muscle for amino acids)',
      'mTOR = mechanistic Target of Rapamycin (master growth switch)',
      'GH = Growth Hormone (peptide hormone from pituitary)',
      'IGF-1 = Insulin-like Growth Factor 1 (converted from GH in liver, activates mTOR)',
      'IL-6 = Interleukin-6 (inflammatory cytokine, raises MPB)',
      'TNF-α = Tumor Necrosis Factor Alpha (inflammatory cytokine, triggers muscle wasting)',
      'PEDs = Performance Enhancing Drugs (steroids, SARMs, GH, peptides)',
      'ATP = Adenosine Triphosphate (cellular energy currency)',
      'GABA = Gamma-Aminobutyric Acid (neurotransmitter that promotes relaxation/sleep)',
      'HPA Axis = Hypothalamic-Pituitary-Adrenal axis (stress response system, releases cortisol)'
    ]
  }
];

async function buildDeck() {
  console.log('Building comprehensive Muscle Tax deck (text-only version)...\n');
  
  // Get current presentation
  const pres = await slides.presentations.get({ presentationId: PRES_ID });
  const pageWidth = pres.data.pageSize.width.magnitude;
  const pageHeight = pres.data.pageSize.height.magnitude;
  
  console.log(`Page dimensions: ${pageWidth} x ${pageHeight} EMUs\n`);
  
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
    console.log(`Deleted ${deleteRequests.length} existing slides\n`);
  }
  
  // Get the remaining slide ID
  const updatedPres = await slides.presentations.get({ presentationId: PRES_ID });
  const firstSlideId = updatedPres.data.slides[0].objectId;
  
  // Build slide 1 (reuse existing)
  console.log('Building slide 1/17: Title');
  await buildSlide(firstSlideId, slideData[0], pageWidth, pageHeight, false);
  
  // Create and build remaining slides
  for (let i = 1; i < slideData.length; i++) {
    console.log(`Building slide ${i + 1}/17: ${slideData[i].title}`);
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
    await buildSlide(slideId, slideData[i], pageWidth, pageHeight, true);
  }
  
  console.log('\n✅ Text-only deck complete — 17 slides!');
  console.log(`https://docs.google.com/presentation/d/${PRES_ID}/edit`);
  console.log('\nNext: Use agent-browser to insert images on each slide.');
}

async function buildSlide(slideId, data, pageWidth, pageHeight, clearSlide) {
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
            color: { rgbColor: { red: 0.06, green: 0.09, blue: 0.16 } }
          }
        }
      },
      fields: 'pageBackgroundFill'
    }
  });
  
  const titleLeft = pageWidth * 0.04;
  const titleWidth = pageWidth * 0.60;
  
  // Add title
  const titleId = `title_${slideId}`;
  const titleTop = pageHeight * 0.06;
  
  requests.push({
    createShape: {
      objectId: titleId,
      shapeType: 'TEXT_BOX',
      elementProperties: {
        pageObjectId: slideId,
        size: { 
          width: { magnitude: titleWidth, unit: 'EMU' }, 
          height: { magnitude: pageHeight * 0.12, unit: 'EMU' } 
        },
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
  
  requests.push({ insertText: { objectId: titleId, text: data.title } });
  
  requests.push({
    updateTextStyle: {
      objectId: titleId,
      style: {
        bold: true,
        fontSize: { magnitude: 32, unit: 'PT' },
        foregroundColor: { opaqueColor: { rgbColor: { red: 0.96, green: 0.62, blue: 0.04 } } }
      },
      fields: 'bold,fontSize,foregroundColor'
    }
  });
  
  // Add subtitle if present
  if (data.subtitle) {
    const subtitleId = `subtitle_${slideId}`;
    const subtitleTop = titleTop + pageHeight * 0.10;
    
    requests.push({
      createShape: {
        objectId: subtitleId,
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: slideId,
          size: { 
            width: { magnitude: titleWidth, unit: 'EMU' }, 
            height: { magnitude: pageHeight * 0.07, unit: 'EMU' } 
          },
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
    
    requests.push({ insertText: { objectId: subtitleId, text: data.subtitle } });
    
    requests.push({
      updateTextStyle: {
        objectId: subtitleId,
        style: {
          fontSize: { magnitude: 18, unit: 'PT' },
          foregroundColor: { opaqueColor: { rgbColor: { red: 0.02, green: 0.71, blue: 0.83 } } }
        },
        fields: 'fontSize,foregroundColor'
      }
    });
  }
  
  // Add bullets if present
  if (data.bullets) {
    const bulletsId = `bullets_${slideId}`;
    const bulletsTop = data.subtitle ? titleTop + pageHeight * 0.19 : titleTop + pageHeight * 0.13;
    const bulletsHeight = pageHeight * 0.62;
    
    requests.push({
      createShape: {
        objectId: bulletsId,
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: slideId,
          size: { 
            width: { magnitude: titleWidth, unit: 'EMU' }, 
            height: { magnitude: bulletsHeight, unit: 'EMU' } 
          },
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
    
    const bulletText = data.bullets.map(b => `• ${b}`).join('\n\n');
    requests.push({ insertText: { objectId: bulletsId, text: bulletText } });
    
    requests.push({
      updateTextStyle: {
        objectId: bulletsId,
        style: {
          fontSize: { magnitude: 14, unit: 'PT' },
          foregroundColor: { opaqueColor: { rgbColor: { red: 0.89, green: 0.91, blue: 0.94 } } }
        },
        fields: 'fontSize,foregroundColor'
      }
    });
  }
  
  // Add bottom tag if present
  if (data.bottomTag) {
    const tagId = `tag_${slideId}`;
    const tagTop = pageHeight * 0.91;
    
    requests.push({
      createShape: {
        objectId: tagId,
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: slideId,
          size: { 
            width: { magnitude: titleWidth, unit: 'EMU' }, 
            height: { magnitude: pageHeight * 0.06, unit: 'EMU' } 
          },
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
    
    requests.push({ insertText: { objectId: tagId, text: data.bottomTag } });
    
    requests.push({
      updateTextStyle: {
        objectId: tagId,
        style: {
          fontSize: { magnitude: 12, unit: 'PT' },
          italic: true,
          foregroundColor: { opaqueColor: { rgbColor: { red: 0.71, green: 0.75, blue: 0.82 } } }
        },
        fields: 'fontSize,italic,foregroundColor'
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
    await buildDeck();
  } catch (error) {
    console.error('Error:', error);
    if (error.response) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

main();
