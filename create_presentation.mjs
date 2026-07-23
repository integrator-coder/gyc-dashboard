import { google } from 'googleapis';
import fs from 'fs';

const key = JSON.parse(fs.readFileSync(process.env.HOME + '/.openclaw/workspace/google-service-account.json'));
const auth = new google.auth.JWT(
  key.client_email,
  null,
  key.private_key,
  ['https://www.googleapis.com/auth/presentations', 'https://www.googleapis.com/auth/drive']
);

const slides = google.slides({ version: 'v1', auth });
const drive = google.drive({ version: 'v3', auth });

async function createPresentation() {
  try {
    // Create new presentation
    const presentation = await slides.presentations.create({
      requestBody: {
        title: 'The Muscle Tax - Understanding Muscle Protein Balance'
      }
    });
    
    const presentationId = presentation.data.presentationId;
    console.log('Created presentation:', presentationId);
    console.log('URL: https://docs.google.com/presentation/d/' + presentationId);
    
    // Share with Todd
    await drive.permissions.create({
      fileId: presentationId,
      requestBody: {
        type: 'user',
        role: 'writer',
        emailAddress: 'todd@growyourcenter.com'
      }
    });
    
    console.log('Shared with todd@growyourcenter.com');
    
    // Get the first (default) slide ID
    const pres = await slides.presentations.get({ presentationId });
    const firstSlideId = pres.data.slides[0].objectId;
    
    // Update title slide
    await slides.presentations.batchUpdate({
      presentationId,
      requestBody: {
        requests: [
          {
            deleteText: {
              objectId: firstSlideId + '_title',
              textRange: { type: 'ALL' }
            }
          },
          {
            insertText: {
              objectId: firstSlideId + '_title',
              text: 'The Muscle Tax',
              insertionIndex: 0
            }
          },
          {
            deleteText: {
              objectId: firstSlideId + '_subtitle',
              textRange: { type: 'ALL' }
            }
          },
          {
            insertText: {
              objectId: firstSlideId + '_subtitle',
              text: 'Understanding Muscle Protein Balance for Maximum Gains',
              insertionIndex: 0
            }
          }
        ]
      }
    });
    
    // Create content slides
    const slideContent = [
      {
        title: "The Problem: Muscle Taxes",
        bullets: [
          "Every bit of muscle you build comes with a 'tax' - breakdown that takes it away",
          "Muscle Protein Synthesis (MPS) = Building (your income)",
          "Muscle Protein Breakdown (MPB) = Taxing (what you lose)",
          "If you're 30+, natural, stressed, or tired: ~40% taxation rate",
          "You're losing nearly half the muscle you build per workout"
        ]
      },
      {
        title: "The Science: MPS vs MPB",
        bullets: [
          "MPS: mTOR pathway activation → builds new muscle tissue",
          "MPB: Cortisol, stress, aging → breaks down muscle proteins",
          "Net Muscle Gain = MPS - MPB",
          "After age 30: MPS decreases 30%, MPB increases",
          "Result: 'Anabolic resistance' - harder to build muscle"
        ]
      },
      {
        title: "Strategy 1: Enhancements (PEDs)",
        bullets: [
          "Anabolic steroids increase MPS by 300-500%",
          "Simultaneously reduce MPB by 50%+",
          "Activate androgen receptors → anabolic gene expression",
          "Suppress cortisol signaling pathways",
          "Dramatically shifts the muscle balance equation"
        ]
      },
      {
        title: "Strategy 2: Intra-Workout Carbs",
        bullets: [
          "30-60g sugar during training reduces MPB by 30-50%",
          "Insulin directly inhibits protein breakdown pathways",
          "Prevents glycogen depletion → less muscle cannibalization",
          "Suppresses cortisol release during training",
          "Maintains dopamine for better training performance"
        ]
      },
      {
        title: "Strategy 3: Sleep + Caffeine Management",
        bullets: [
          "Sleep: 70% of growth hormone released during deep sleep",
          "Poor sleep reduces testosterone by 10-15% in just one week",
          "High caffeine elevates cortisol → increases MPB",
          "Protocol: Cap caffeine at 2 coffees/day + one caffeine-free day weekly",
          "Use magnesium (200-400mg) to improve sleep quality"
        ]
      },
      {
        title: "The Physiological Mechanisms",
        bullets: [
          "Growth Hormone: Peaks during deep sleep, stimulates IGF-1 and mTOR",
          "Testosterone: Produced during REM sleep, activates protein synthesis",
          "Cortisol: Stress hormone that activates ubiquitin-proteasome breakdown",
          "Insulin: Anti-catabolic, blocks protein breakdown pathways",
          "mTOR: Master regulator of muscle protein synthesis"
        ]
      },
      {
        title: "The Combined Effect",
        bullets: [
          "Baseline (30+ natural, poor habits): Net gain = 60 units",
          "Add intra-workout carbs: Net gain = 77 units (+28%)",
          "Add sleep/caffeine optimization: Net gain = 90 units (+50%)",
          "Add enhancements: Net gain = 390+ units (+550%)",
          "Each strategy attacks different MPB mechanisms"
        ]
      },
      {
        title: "Key Takeaways",
        bullets: [
          "Reduce your 'tax bracket' by minimizing MPB, not just maximizing MPS",
          "Sleep is non-negotiable: 7-9 hours for optimal hormones",
          "Intra-workout carbs have real anti-catabolic benefits",
          "Strategic caffeine use: cap intake, take weekly breaks",
          "For natural lifters: optimize everything to overcome age-related anabolic resistance"
        ]
      }
    ];
    
    // Create slides with content
    const createSlideRequests = [];
    const textRequests = [];
    
    for (let i = 0; i < slideContent.length; i++) {
      const slideId = `slide_${i + 2}`;
      const titleId = `${slideId}_title`;
      const bodyId = `${slideId}_body`;
      
      // Create blank slide
      createSlideRequests.push({
        createSlide: {
          objectId: slideId,
          slideLayoutReference: {
            predefinedLayout: 'TITLE_AND_BODY'
          }
        }
      });
    }
    
    // Batch create slides
    await slides.presentations.batchUpdate({
      presentationId,
      requestBody: { requests: createSlideRequests }
    });
    
    console.log('Created', slideContent.length, 'content slides');
    
    // Now add text to each slide
    for (let i = 0; i < slideContent.length; i++) {
      const slideId = `slide_${i + 2}`;
      const content = slideContent[i];
      
      // Get the slide to find text box IDs
      const updatedPres = await slides.presentations.get({ presentationId });
      const slide = updatedPres.data.slides.find(s => s.objectId === slideId);
      
      if (slide && slide.pageElements) {
        const titleBox = slide.pageElements.find(el => 
          el.shape && el.shape.shapeType === 'TEXT_BOX' && el.shape.placeholder?.type === 'TITLE'
        );
        const bodyBox = slide.pageElements.find(el => 
          el.shape && el.shape.shapeType === 'TEXT_BOX' && el.shape.placeholder?.type === 'BODY'
        );
        
        const requests = [];
        
        if (titleBox) {
          requests.push({
            insertText: {
              objectId: titleBox.objectId,
              text: content.title,
              insertionIndex: 0
            }
          });
        }
        
        if (bodyBox) {
          const bulletText = content.bullets.map(b => '• ' + b).join('\n');
          requests.push({
            insertText: {
              objectId: bodyBox.objectId,
              text: bulletText,
              insertionIndex: 0
            }
          });
        }
        
        await slides.presentations.batchUpdate({
          presentationId,
          requestBody: { requests }
        });
      }
    }
    
    console.log('\\nPresentation complete!');
    console.log('URL: https://docs.google.com/presentation/d/' + presentationId);
    console.log('\\nNext: Add images manually from ~/.openclaw/media/tool-image-generation/');
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

createPresentation();
