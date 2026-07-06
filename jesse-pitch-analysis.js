const { google } = require('googleapis');

const auth = new google.auth.GoogleAuth({
  keyFile: '/Users/toddthejedigmail.com/.openclaw/workspace/google-service-account.json',
  scopes: [
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/presentations'
  ]
});

const DOC_ID = '1P8iCtcwFQbGn02EB9zXKF3-Vo4H8Ox4yiwoCKCWZS8A';
const SLIDES_ID = '15BjaYcC4jADSee9YYZTimGGlkfsci2DoH-htBc5quo4';

async function writeGoogleDoc() {
  const docs = google.docs({ version: 'v1', auth });
  
  const requests = [
    // Title
    {
      insertText: {
        location: { index: 1 },
        text: 'How Jesse Closes: A Growth Advisor Playbook for Website Clients\n\n'
      }
    },
    
    // 1. Overview
    {
      insertText: {
        location: { index: 1 },
        text: '1. OVERVIEW\n\nThis document breaks down a masterclass sales call from Jesse Poirier (GYC Growth Advisor) who successfully closed Extraordinary Kids Preschool (Chad Meads) on upgrading from web-only service to full Done-For-You marketing.\n\nWhy this call is a model: Jesse used a structured 6-phase framework that moved the prospect from "curious" to "sold" in under an hour. Every phase had a specific psychological purpose. Every question deepened commitment. Every objection was pre-handled before it could surface.\n\nWho this is for: Any GA pitching web-only or web+blueprint clients on upgrading to SEO, Google Maps, or full service. The framework works because it follows how humans actually make decisions — not how we think they do.\n\n\n'
      }
    },
    
    // 2. Pre-Call Ritual
    {
      insertText: {
        location: { index: 1 },
        text: '2. THE PRE-CALL RITUAL\n\nBefore Chad joined, Jesse talked himself through the call outcome:\n\n💬 "Certainty\'s at the core of influence. I\'m certain this is going to be a great conversation. We\'re going to add a lot of value to Chad today. He\'s going to see the vision. We\'re going to help him get more enrollments."\n\nWhy this matters:\n- Outcome assumption → confidence → prospect feels it\n- Visualization primes your brain for the conversation flow\n- Sets your emotional state before the prospect can affect it\n\n✅ GA Action: Take 60 seconds before every call. Visualize the outcome. Say it out loud if you can. Enter the call certain, not hopeful.\n\n\n'
      }
    },
    
    // 3. The 6-Phase Framework
    {
      insertText: {
        location: { index: 1 },
        text: '3. THE 6-PHASE PITCH FRAMEWORK\n\n'
      }
    },
    
    // Phase 1
    {
      insertText: {
        location: { index: 1 },
        text: 'PHASE 1: AGENDA SETTING & WHY THEY\'RE HERE (1:05-7:05)\n\nPurpose: Get the prospect talking about their desire, not your pitch. Frame the agenda as mutual discovery.\n\nWhat Jesse said:\n💬 "What stood out about our ad or the research we did that made you want to hop on a call?"\n💬 "Fair enough if we ask each other questions, and if it sounds good, we can go over some options?"\n\nWhy it works:\n- Asking "what stood out" makes them sell themselves on why they\'re here\n- Permission-based agenda removes pressure, increases openness\n- Chad immediately revealed his core desire: "I want results like the other centers you showed me"\n\n✅ GA Action:\n1. Ask what stood out about the outreach (never skip this)\n2. Get permission to ask questions\n3. Let them talk first — your job is to listen for the thread to pull\n\n\n'
      }
    },
    
    // Phase 2
    {
      insertText: {
        location: { index: 1 },
        text: 'PHASE 2: SITUATION DISCOVERY (THE NUMBERS) (7:05-12:00)\n\nPurpose: Understand the gap between current state and desired state. Quantify it.\n\nWhat Jesse asked:\n💬 "What\'s your capacity?"\n💬 "What percentage full are you right now?"\n💬 "How many leads are you getting per week?"\n💬 "What are you spending on marketing right now?"\n💬 "What strategies are working for you?"\n\nWhat Chad revealed:\n- 125 capacity, 40% full (50 enrolled)\n- $2K/month on Meta ads\n- 1-2 leads/week\n- Reaching 1 person/month who shows up\n- 3 months of ads = 2 new enrollments\n\nWhy it works:\n- Numbers don\'t lie — Chad just outlined his own problem\n- Jesse didn\'t interpret or judge, just documented\n- The gap (125 capacity vs 50 enrolled) is now on the table\n\n✅ GA Action:\nGet these 5 numbers every time:\n1. Capacity\n2. Current enrollment (%)\n3. Leads/week\n4. Current marketing spend\n5. What\'s actually working\n\nWrite them down. Read them back. Let the prospect hear their own situation.\n\n\n'
      }
    },
    
    // Phase 3
    {
      insertText: {
        location: { index: 1 },
        text: 'PHASE 3: PAIN DEEPENING (STAFF, PERSONAL, FINANCIAL) (12:00-20:04)\n\nPurpose: Move from intellectual problem to emotional problem. Make the cost of inaction real.\n\nWhat Jesse asked:\n💬 "How long has this been going on?"\n💬 "Are we maybe losing money with the amount we\'re spending vs what we\'re getting back?"\n💬 "Has this affected staffing at all?"\n💬 "How has it affected you personally?"\n\nWhat Chad revealed:\n- 4-5 months of struggle\n- Not losing money but "super tight" — can\'t reinvest\n- Had to cut payroll, pressuring directors to pick up slack\n- His salary is fine but no room to grow the business\n\nWhy it works:\n- "How long" → establishes this isn\'t temporary, it\'s a pattern\n- "We" language → Jesse is in the boat with him\n- Staffing question → uncovers hidden cost (morale, burnout)\n- Personal impact → this isn\'t just business, it\'s his life\n\n✅ GA Action:\nAlways ask in this order:\n1. How long? (timeline)\n2. Financial impact? (money)\n3. Team impact? (people)\n4. Personal impact? (life)\n\nLet them answer fully. Don\'t rush. The pain deepening is where the sale happens.\n\n\n'
      }
    },
    
    // Phase 4
    {
      insertText: {
        location: { index: 1 },
        text: 'PHASE 4: FUTURE CASTING (POSITIVE THEN NEGATIVE) (15:00-25:00)\n\nPurpose: Show them both futures — the one they want and the one they\'re headed toward.\n\nPositive Future:\n💬 "If we could get you 20 more enrollments, how would that change things for you?"\n\nChad self-sold:\n- 60% gross margin on incremental revenue\n- $1K/kid/month\n- 10-15 more kids = breathing room, can reinvest\n\nJesse anchored the LTV:\n💬 "One enrollment staying 18 months — that\'s $29,000. So every tour actually matters."\n\nNegative Future:\n💬 "If nothing changes in 6 months, what\'s the likely outcome?"\n\nChad revealed:\n- Can float for a while but would eventually have to sell\n\nWhy it works:\n- Positive first → gets them emotionally invested in the upside\n- Let THEM do the math on ROI, don\'t do it for them\n- Negative second → makes inaction a decision, not a default\n- Jesse didn\'t pile on fear, just confirmed "we\'re not settling for that, right?"\n\n✅ GA Action:\n1. Ask the upside question: "If we got you X more enrollments, what would that mean for you?"\n2. Let them paint the picture\n3. Anchor the LTV: "One kid staying 18 months is $29K"\n4. Ask the downside question: "If nothing changes in 6 months, where are you?"\n5. Confirm: "We\'re not looking to settle for that, fair?"\n\n\n'
      }
    },
    
    // Phase 5
    {
      insertText: {
        location: { index: 1 },
        text: 'PHASE 5: DECISION MAKER CHECK (20:04-22:00)\n\nPurpose: Confirm who needs to say yes before presenting the offer.\n\nWhat Jesse asked:\n💬 "Are you the sole decision maker, or is there anyone else involved?"\n\nChad:\n- Wife is co-owner but defers to him on marketing\n\nWhy it works:\n- Asking this AFTER pain deepening (not before) = they\'re already invested\n- If there\'s another decision maker, you know now, not after the pitch\n- Jesse confirmed Chad could move forward without a "I need to talk to my wife" stall\n\n✅ GA Action:\nAsk this exact question after future casting, before presenting.\nIf there\'s a co-decision maker: "Would it make sense to have them on the call, or do you typically handle this and bring it to them after?"\n\n\n'
      }
    },
    
    // Phase 6
    {
      insertText: {
        location: { index: 1 },
        text: 'PHASE 6: THE PRESENTATION & OFFER (25:00-46:49)\n\nPurpose: Present the solution as a natural continuation of everything they just told you.\n\nJesse\'s bridge line:\n💬 "Based on our conversation, we absolutely have a strategy that could work for you. It\'s been tried and tested from other centers. Let me walk you through what we do."\n\nThe Offer Stack (in order):\n1. GYC website optimized for mobile + AI search\n2. Google Business Profile optimization (4-star → 4.6 goal, 48 → 75+ reviews)\n3. CRM/speed-to-lead (responds within 1 min = 400% show-up increase)\n4. Email/text marketing (3-5 campaigns/month = 2-5 enrollments, $0 ad spend)\n5. Community partnerships (templated outreach, co-branded flyers)\n6. Google Maps / AI SEO (no media budget, permanent trust asset vs Meta ads that disappear)\n7. Tour + sales training (every tour = $29K, GYC has data from 850 centers)\n8. Heatmap demo — showed Chad his current ranking vs competitors\n\nWhy this order works:\n- Starts with low/no-cost improvements (website, GBP) → builds credibility\n- Moves to high-value, no-media-budget tactics (email, partnerships)\n- Ends with the big leverage play (Google Maps, tour training)\n- Each layer removes an objection before it surfaces\n\n✅ GA Action:\nPresent the offer as a stack, not a menu.\nEach layer = "and then we also do X."\nDon\'t ask "does this make sense?" until the end.\nThe prospect should feel like they\'re getting 8 things, not choosing between them.\n\n\n'
      }
    },
    
    // 4. Language That Works
    {
      insertText: {
        location: { index: 1 },
        text: '\n\n4. LANGUAGE THAT WORKS\n\nSpecific phrases Jesse used that other GAs should steal:\n\nSituation → What Jesse Said → Why It Works\n\n• Opening the call → "What stood out about our ad or research that made you want to hop on a call?" → Makes them sell themselves on why they\'re here\n\n• Setting agenda → "Fair enough if we ask each other questions, and if it sounds good, we can go over some options?" → Permission-based, removes pressure\n\n• Validating their insight → "It was really smart of you to notice that" → Makes them feel heard, builds trust\n\n• Pain deepening → "Are WE maybe losing money?" → "We" language = you\'re in this together\n\n• Future casting positive → "If we could get you 20 more enrollments, how would that change things for you?" → Let them paint their own upside\n\n• Anchoring LTV → "One enrollment staying 18 months — that\'s $29,000" → Makes every tour feel high-stakes\n\n• Future casting negative → "If nothing changes in 6 months, what\'s the likely outcome?" → Inaction becomes a decision\n\n• Bridging to offer → "Based on our conversation, we absolutely have a strategy that could work for you" → Callback to everything they just said\n\n• Removing objections → "No media budget required for this" → Pre-handle before they ask\n\n• Social proof → "We\'ve helped 850+ childcare centers, 650,000 kids enrolled" → Proof of scale\n\n• Urgency → "Your competitor has 38% top-3 share, the window is closing" → Competition creates urgency\n\n• Minimum effective dose → "Like Tylenol — you need the right amount, not too little, not too much" → Makes the scope feel calibrated, not oversold\n\n\n'
      }
    },
    
    // 5. The Offer Stack
    {
      insertText: {
        location: { index: 1 },
        text: '5. THE OFFER STACK\n\nHow Jesse layered the offer from low-cost to full service:\n\nLayer 1: Website (mobile + AI optimized)\nLayer 2: Google Business Profile (reviews, photos, optimization)\nLayer 3: CRM (speed-to-lead, 1-minute response)\nLayer 4: Email/text marketing (3-5 campaigns/month, no ad spend)\nLayer 5: Community partnerships (templated outreach)\nLayer 6: Google Maps / AI SEO (permanent trust asset)\nLayer 7: Tour + sales training (data from 850 centers)\nLayer 8: Heatmap (visual proof of competitive gap)\n\nWhy the order matters:\n- Starts with foundational fixes (website, GBP) → credibility\n- Moves to high-ROI, no-media-budget tactics (email, CRM) → removes "this costs too much" objection\n- Ends with the strategic leverage (Maps, training) → this is the closer\n\nEach layer removes a potential objection:\n- "I don\'t have budget for more ads" → Email/partnerships = $0 spend\n- "Meta ads disappear when I stop paying" → Google Maps = permanent asset\n- "I don\'t know if my tours are good" → We train you with data from 850 centers\n\n✅ GA Action:\nPresent as a stack, not a menu. Don\'t let them pick 3 out of 8. The power is in the system.\n\n\n'
      }
    },
    
    // 6. Key Analogies
    {
      insertText: {
        location: { index: 1 },
        text: '6. KEY ANALOGIES + WHEN TO USE THEM\n\n"Leaky bucket" → Use when they\'re running ads without trust assets (reviews, website, GBP)\n💬 "Running Meta ads without optimizing your Google presence is like pouring water into a leaky bucket. Some of it works, but you\'re losing most of it."\n\n"Minimum effective dose (Tylenol)" → Use when scoping the offer\n💬 "It\'s like Tylenol — you need the right amount. Too little, it doesn\'t work. Too much, you\'re wasting money. We\'re going to give you the minimum effective dose."\n\n"Plant a tree" → Use when discussing timeline/urgency\n💬 "Best time to plant a tree was 10 years ago. Second best time is today. Google Maps takes time to build. The sooner we start, the sooner you see results."\n\n"Needle in a haystack" → Use when comparing Meta ads to Google Maps\n💬 "Meta is like finding a needle in a haystack — you\'re hoping the right person sees your ad. Google Maps is people already looking for childcare in your area. They\'re raising their hand."\n\n"Condo playbook" → Use when explaining GYC\'s process\n💬 "We\'re not reinventing the wheel. We have a proven playbook from 850+ centers. It\'s like building condos — same blueprint, different lot."\n\n"Crowds attract crowds" → Use when discussing momentum/reviews/enrollment\n💬 "Enrollment creates momentum. Families want to go where other families are going. Crowds attract crowds."\n\n✅ GA Action:\nPick 2-3 analogies per call. Don\'t use all of them. Match the analogy to the objection or gap.\n\n\n'
      }
    },
    
    // 7. Social Proof
    {
      insertText: {
        location: { index: 1 },
        text: '7. SOCIAL PROOF MOMENTS\n\nWhere Jesse dropped proof + when to use it:\n\n"850+ childcare centers helped" → Use early in the pitch to establish credibility\n\n"24 full-time staff" → Use when they ask about capacity/support\n\n"650,000 children enrolled" → Use to show scale of impact\n\n"Anil from Young Horizons: 0 to 89 enrolled in 6 months" → Use when the prospect is similar size/situation\n💬 "Anil was at 30% capacity, similar to you. We helped him go from 0 to 89 enrolled in 6 months. Now he\'s adding 5 more centers."\n\n"4-star to 4.6 average" → Use when discussing GBP optimization\n\n"400% increase in show-up rate with 1-minute response time" → Use when discussing CRM/speed-to-lead\n\n"2-5 enrollments per month from email marketing alone" → Use when presenting email campaigns\n\nWhy it works:\n- Proof at the right moment = removes doubt\n- Specific numbers > vague claims\n- Similar situation = "if it worked for them, it can work for me"\n\n✅ GA Action:\nDon\'t dump all your proof at once. Sprinkle it throughout the pitch. Match the proof to the moment.\n\n\n'
      }
    },
    
    // 8. Common Objections Pre-Handled
    {
      insertText: {
        location: { index: 1 },
        text: '8. COMMON OBJECTIONS — PRE-HANDLED\n\nHow Jesse defused objections before they came up:\n\nObjection: "I don\'t have budget for more ads"\nPre-handle: "No media budget required. Email marketing, community partnerships, and Google Maps optimization don\'t cost ad spend."\n\nObjection: "Meta ads stop working when I stop paying"\nPre-handle: "Google Maps is a permanent asset. Once you rank, you keep ranking. It\'s not pay-to-play like Meta."\n\nObjection: "I don\'t know if our tours are good enough"\nPre-handle: "We train you. We have data from 850 centers. We know what works. Every tour is a $29K opportunity — we\'re going to make sure you close them."\n\nObjection: "This sounds expensive"\nPre-handle: Jesse showed the ROI first — "10-15 more kids = $10-15K/month in revenue, 60% margin." The price becomes small compared to the upside.\n\nObjection: "I need to think about it"\nPre-handle: Jesse created urgency with competition data — "Your competitor has 38% top-3 Google Maps share. The window is closing."\n\nObjection: "I need to talk to my partner"\nPre-handle: Jesse asked the decision-maker question BEFORE presenting the offer.\n\nWhy pre-handling works:\n- Objections raised = doubt created\n- Objections pre-handled = confidence built\n- The prospect never has to voice the objection, so they don\'t get anchored to it\n\n✅ GA Action:\nKnow the top 5 objections for your offer. Weave the answers into your pitch before they ask.\n\n\n'
      }
    },
    
    // 9. Things NOT to Do
    {
      insertText: {
        location: { index: 1 },
        text: '9. THINGS NOT TO DO\n\nBased on what was (and wasn\'t) in this transcript:\n\n❌ Don\'t pitch before discovery\nJesse spent 20+ minutes on discovery before presenting anything. If you pitch too early, you\'re guessing at their pain.\n\n❌ Don\'t skip the personal impact question\n"How has this affected you personally?" is where the emotional sale happens. Don\'t skip it because it feels uncomfortable.\n\n❌ Don\'t let them off the hook on the negative future\nJesse asked: "If nothing changes in 6 months, where are you?" Chad said: "We\'d eventually have to sell." Jesse didn\'t soften it — he confirmed it. Inaction has a cost. Make it real.\n\n❌ Don\'t present the offer as a menu\nJesse presented the offer as a stack — "We do this, and this, and this." He didn\'t say "pick 3 out of 8." The power is in the system.\n\n❌ Don\'t over-explain\nJesse used analogies to simplify, not jargon to impress. If the prospect doesn\'t understand, they won\'t buy.\n\n❌ Don\'t assume they understand LTV\nJesse explicitly said: "One enrollment staying 18 months is $29,000." Don\'t assume they\'ve done this math. Do it for them.\n\n❌ Don\'t end without a clear next step\nJesse didn\'t leave it open-ended. He moved to close. If you don\'t ask, they won\'t buy.\n\n✅ GA Action:\nRecord your next 3 calls. Listen back. Did you skip any of these? Fix it on the next one.\n\n\n'
      }
    },
    
    // Closing
    {
      insertText: {
        location: { index: 1 },
        text: '\n───────────────────────────────\n\nThis document is a living playbook. Use it. Update it. Add your own wins. Share what works.\n\nJesse\'s call is a model because it\'s repeatable. The structure works. The questions work. The analogies work.\n\nYour job: make it yours.\n\n— Wall·E, June 2026\n'
      }
    }
  ];

  // Apply paragraph styles
  const styleRequests = [
    // Title
    {
      updateParagraphStyle: {
        range: { startIndex: 1, endIndex: 70 },
        paragraphStyle: {
          namedStyleType: 'HEADING_1',
          alignment: 'CENTER'
        },
        fields: 'namedStyleType,alignment'
      }
    },
    // Section headers (all "1. OVERVIEW" etc. — we'll use HEADING_2)
    {
      updateParagraphStyle: {
        range: { startIndex: 72, endIndex: 85 },
        paragraphStyle: { namedStyleType: 'HEADING_2' },
        fields: 'namedStyleType'
      }
    }
  ];

  const allRequests = requests.concat(styleRequests);

  await docs.documents.batchUpdate({
    documentId: DOC_ID,
    requestBody: { requests: allRequests }
  });

  console.log('✅ Google Doc written successfully');
}

async function writeGoogleSlides() {
  const slides = google.slides({ version: 'v1', auth });
  
  // Get presentation to find existing slides
  const presentation = await slides.presentations.get({
    presentationId: SLIDES_ID
  });
  
  // Delete existing slides (except first one which we'll replace)
  const deleteRequests = presentation.data.slides.slice(1).map(slide => ({
    deleteObject: {
      objectId: slide.objectId
    }
  }));

  const requests = [
    ...deleteRequests,
    
    // Slide 2: Phase 1
    { createSlide: { insertionIndex: 1 } },
    
    // Slide 3: Phase 2
    { createSlide: { insertionIndex: 2 } },
    
    // Slide 4: Phase 3
    { createSlide: { insertionIndex: 3 } },
    
    // Slide 5: Phase 4
    { createSlide: { insertionIndex: 4 } },
    
    // Slide 6: Phase 5
    { createSlide: { insertionIndex: 5 } },
    
    // Slide 7: Phase 6
    { createSlide: { insertionIndex: 6 } },
    
    // Slide 8: Key Analogies
    { createSlide: { insertionIndex: 7 } },
    
    // Slide 9: The Offer Stack
    { createSlide: { insertionIndex: 8 } },
    
    // Slide 10: Social Proof
    { createSlide: { insertionIndex: 9 } },
    
    // Slide 11: The Close
    { createSlide: { insertionIndex: 10 } }
  ];

  await slides.presentations.batchUpdate({
    presentationId: SLIDES_ID,
    requestBody: { requests }
  });

  // Get updated presentation to get slide IDs
  const updated = await slides.presentations.get({
    presentationId: SLIDES_ID
  });

  // Now add content to each slide
  const contentRequests = [
    // Slide 2: Phase 1 - Agenda Setting
    {
      createShape: {
        objectId: 'phase1_title',
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: updated.data.slides[1].objectId,
          size: { width: { magnitude: 650, unit: 'PT' }, height: { magnitude: 50, unit: 'PT' } },
          transform: { scaleX: 1, scaleY: 1, translateX: 30, translateY: 30, unit: 'PT' }
        }
      }
    },
    {
      insertText: {
        objectId: 'phase1_title',
        text: 'PHASE 1: Agenda Setting & Why They\'re Here'
      }
    },
    {
      createShape: {
        objectId: 'phase1_body',
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: updated.data.slides[1].objectId,
          size: { width: { magnitude: 650, unit: 'PT' }, height: { magnitude: 350, unit: 'PT' } },
          transform: { scaleX: 1, scaleY: 1, translateX: 30, translateY: 100, unit: 'PT' }
        }
      }
    },
    {
      insertText: {
        objectId: 'phase1_body',
        text: '• Get the prospect talking about THEIR desire, not your pitch\n• Ask: "What stood out about our ad/research that made you want to chat?"\n• Permission-based agenda: "Fair if we ask each other questions?"\n• 💬 Chad revealed his core desire: "I want results like the other centers"\n\n✅ GA Action:\n• Never skip the "what stood out" question\n• Let them sell themselves on why they\'re here\n• Listen for the thread to pull'
      }
    },

    // Slide 3: Phase 2 - Discovery
    {
      createShape: {
        objectId: 'phase2_title',
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: updated.data.slides[2].objectId,
          size: { width: { magnitude: 650, unit: 'PT' }, height: { magnitude: 50, unit: 'PT' } },
          transform: { scaleX: 1, scaleY: 1, translateX: 30, translateY: 30, unit: 'PT' }
        }
      }
    },
    {
      insertText: {
        objectId: 'phase2_title',
        text: 'PHASE 2: Situation Discovery (The Numbers)'
      }
    },
    {
      createShape: {
        objectId: 'phase2_body',
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: updated.data.slides[2].objectId,
          size: { width: { magnitude: 650, unit: 'PT' }, height: { magnitude: 350, unit: 'PT' } },
          transform: { scaleX: 1, scaleY: 1, translateX: 30, translateY: 100, unit: 'PT' }
        }
      }
    },
    {
      insertText: {
        objectId: 'phase2_body',
        text: 'Get these 5 numbers every time:\n• Capacity → Chad: 125\n• Current enrollment (%) → Chad: 40% (50 kids)\n• Leads/week → Chad: 1-2/week\n• Current marketing spend → Chad: $2K/month on Meta\n• What\'s working → Chad: 3 months = 2 enrollments\n\n✅ GA Action:\n• Document the numbers, don\'t interpret them\n• Read them back so the prospect hears their own situation\n• The gap is now on the table'
      }
    },

    // Slide 4: Phase 3 - Pain Deepening
    {
      createShape: {
        objectId: 'phase3_title',
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: updated.data.slides[3].objectId,
          size: { width: { magnitude: 650, unit: 'PT' }, height: { magnitude: 50, unit: 'PT' } },
          transform: { scaleX: 1, scaleY: 1, translateX: 30, translateY: 30, unit: 'PT' }
        }
      }
    },
    {
      insertText: {
        objectId: 'phase3_title',
        text: 'PHASE 3: Pain Deepening (Staff, Personal, Financial)'
      }
    },
    {
      createShape: {
        objectId: 'phase3_body',
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: updated.data.slides[3].objectId,
          size: { width: { magnitude: 650, unit: 'PT' }, height: { magnitude: 350, unit: 'PT' } },
          transform: { scaleX: 1, scaleY: 1, translateX: 30, translateY: 100, unit: 'PT' }
        }
      }
    },
    {
      insertText: {
        objectId: 'phase3_body',
        text: 'Move from intellectual problem → emotional problem\n\nAsk in this order:\n• "How long has this been going on?" → 4-5 months\n• "Are WE maybe losing money?" → Super tight, can\'t reinvest\n• "Has this affected staffing?" → Cut payroll, directors under pressure\n• "How has it affected you personally?" → No room to grow\n\n💬 "We" language = you\'re in the boat together\n\n✅ GA Action: Let them answer fully. Don\'t rush. This is where the sale happens.'
      }
    },

    // Slide 5: Phase 4 - Future Casting
    {
      createShape: {
        objectId: 'phase4_title',
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: updated.data.slides[4].objectId,
          size: { width: { magnitude: 650, unit: 'PT' }, height: { magnitude: 50, unit: 'PT' } },
          transform: { scaleX: 1, scaleY: 1, translateX: 30, translateY: 30, unit: 'PT' }
        }
      }
    },
    {
      insertText: {
        objectId: 'phase4_title',
        text: 'PHASE 4: Future Casting (Positive Then Negative)'
      }
    },
    {
      createShape: {
        objectId: 'phase4_body',
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: updated.data.slides[4].objectId,
          size: { width: { magnitude: 650, unit: 'PT' }, height: { magnitude: 350, unit: 'PT' } },
          transform: { scaleX: 1, scaleY: 1, translateX: 30, translateY: 100, unit: 'PT' }
        }
      }
    },
    {
      insertText: {
        objectId: 'phase4_body',
        text: 'Positive: "If we got you 20 more enrollments, what would that mean?"\n• Chad: 60% margin, $1K/kid/month, breathing room to reinvest\n• 💬 Jesse: "One enrollment staying 18 months = $29,000. Every tour matters."\n\nNegative: "If nothing changes in 6 months, where are you?"\n• Chad: Can float for a while but would eventually have to sell\n\n✅ GA Action:\n• Let THEM do the math, don\'t do it for them\n• Anchor the LTV\n• Make inaction a decision, not a default'
      }
    },

    // Slide 6: Phase 5 - Decision Maker Check
    {
      createShape: {
        objectId: 'phase5_title',
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: updated.data.slides[5].objectId,
          size: { width: { magnitude: 650, unit: 'PT' }, height: { magnitude: 50, unit: 'PT' } },
          transform: { scaleX: 1, scaleY: 1, translateX: 30, translateY: 30, unit: 'PT' }
        }
      }
    },
    {
      insertText: {
        objectId: 'phase5_title',
        text: 'PHASE 5: Decision Maker Check'
      }
    },
    {
      createShape: {
        objectId: 'phase5_body',
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: updated.data.slides[5].objectId,
          size: { width: { magnitude: 650, unit: 'PT' }, height: { magnitude: 350, unit: 'PT' } },
          transform: { scaleX: 1, scaleY: 1, translateX: 30, translateY: 100, unit: 'PT' }
        }
      }
    },
    {
      insertText: {
        objectId: 'phase5_body',
        text: 'Ask AFTER pain deepening, BEFORE presenting:\n\n💬 "Are you the sole decision maker, or is there anyone else involved?"\n\nChad: Wife is co-owner but defers to him on marketing\n\n✅ GA Action:\n• Asking after pain = they\'re already invested\n• Know now, not after the pitch\n• If co-decision maker exists: "Should we get them on the call, or do you bring it to them after?"'
      }
    },

    // Slide 7: Phase 6 - The Presentation
    {
      createShape: {
        objectId: 'phase6_title',
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: updated.data.slides[6].objectId,
          size: { width: { magnitude: 650, unit: 'PT' }, height: { magnitude: 50, unit: 'PT' } },
          transform: { scaleX: 1, scaleY: 1, translateX: 30, translateY: 30, unit: 'PT' }
        }
      }
    },
    {
      insertText: {
        objectId: 'phase6_title',
        text: 'PHASE 6: The Presentation & Offer'
      }
    },
    {
      createShape: {
        objectId: 'phase6_body',
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: updated.data.slides[6].objectId,
          size: { width: { magnitude: 650, unit: 'PT' }, height: { magnitude: 350, unit: 'PT' } },
          transform: { scaleX: 1, scaleY: 1, translateX: 30, translateY: 100, unit: 'PT' }
        }
      }
    },
    {
      insertText: {
        objectId: 'phase6_body',
        text: '💬 Bridge: "Based on our conversation, we have a strategy that could work. Tried and tested from other centers."\n\nPresent as a STACK (not a menu):\n• Website optimization\n• GBP (reviews, photos)\n• CRM (1-min response)\n• Email/text marketing\n• Community partnerships\n• Google Maps / AI SEO\n• Tour training\n• Heatmap demo\n\n✅ GA Action: Each layer removes an objection. Don\'t let them pick 3 out of 8.'
      }
    },

    // Slide 8: Key Analogies
    {
      createShape: {
        objectId: 'analogies_title',
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: updated.data.slides[7].objectId,
          size: { width: { magnitude: 650, unit: 'PT' }, height: { magnitude: 50, unit: 'PT' } },
          transform: { scaleX: 1, scaleY: 1, translateX: 30, translateY: 30, unit: 'PT' }
        }
      }
    },
    {
      insertText: {
        objectId: 'analogies_title',
        text: 'Key Analogies Jesse Used'
      }
    },
    {
      createShape: {
        objectId: 'analogies_body',
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: updated.data.slides[7].objectId,
          size: { width: { magnitude: 650, unit: 'PT' }, height: { magnitude: 350, unit: 'PT' } },
          transform: { scaleX: 1, scaleY: 1, translateX: 30, translateY: 100, unit: 'PT' }
        }
      }
    },
    {
      insertText: {
        objectId: 'analogies_body',
        text: '🪣 Leaky bucket → Running ads without trust assets\n💊 Tylenol (minimum effective dose) → Scoping the offer\n🌳 Plant a tree → Timeline/urgency\n🔍 Needle in haystack → Meta vs Google Maps\n🏗️ Condo playbook → GYC\'s proven process\n👥 Crowds attract crowds → Enrollment momentum\n\n✅ GA Action: Pick 2-3 per call. Match analogy to objection.'
      }
    },

    // Slide 9: The Offer Stack
    {
      createShape: {
        objectId: 'stack_title',
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: updated.data.slides[8].objectId,
          size: { width: { magnitude: 650, unit: 'PT' }, height: { magnitude: 50, unit: 'PT' } },
          transform: { scaleX: 1, scaleY: 1, translateX: 30, translateY: 30, unit: 'PT' }
        }
      }
    },
    {
      insertText: {
        objectId: 'stack_title',
        text: 'The Offer Stack (Low Cost → High Value)'
      }
    },
    {
      createShape: {
        objectId: 'stack_body',
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: updated.data.slides[8].objectId,
          size: { width: { magnitude: 650, unit: 'PT' }, height: { magnitude: 350, unit: 'PT' } },
          transform: { scaleX: 1, scaleY: 1, translateX: 30, translateY: 100, unit: 'PT' }
        }
      }
    },
    {
      insertText: {
        objectId: 'stack_body',
        text: 'Layer 1: Website (mobile + AI)\nLayer 2: GBP optimization (reviews → 75+, rating → 4.6)\nLayer 3: CRM (1-min response = 400% show-up boost)\nLayer 4: Email/text (3-5 campaigns/month, $0 ad spend)\nLayer 5: Community partnerships (templated)\nLayer 6: Google Maps / AI SEO (permanent asset)\nLayer 7: Tour training (data from 850 centers)\nLayer 8: Heatmap (competitive gap proof)\n\n✅ Each layer removes an objection before it surfaces'
      }
    },

    // Slide 10: Social Proof
    {
      createShape: {
        objectId: 'proof_title',
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: updated.data.slides[9].objectId,
          size: { width: { magnitude: 650, unit: 'PT' }, height: { magnitude: 50, unit: 'PT' } },
          transform: { scaleX: 1, scaleY: 1, translateX: 30, translateY: 30, unit: 'PT' }
        }
      }
    },
    {
      insertText: {
        objectId: 'proof_title',
        text: 'Social Proof Moments'
      }
    },
    {
      createShape: {
        objectId: 'proof_body',
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: updated.data.slides[9].objectId,
          size: { width: { magnitude: 650, unit: 'PT' }, height: { magnitude: 350, unit: 'PT' } },
          transform: { scaleX: 1, scaleY: 1, translateX: 30, translateY: 100, unit: 'PT' }
        }
      }
    },
    {
      insertText: {
        objectId: 'proof_body',
        text: '📊 850+ childcare centers helped (credibility)\n👥 24 full-time staff (capacity/support)\n👶 650,000 children enrolled (scale of impact)\n🎯 Anil / Young Horizons: 0 → 89 enrolled in 6 months\n   → Similar situation to Chad, now adding 5 centers\n⭐ 4-star → 4.6 average (GBP)\n📈 400% show-up increase (1-min response)\n✉️ 2-5 enrollments/month from email alone\n\n✅ GA Action: Sprinkle proof throughout. Don\'t dump all at once.'
      }
    },

    // Slide 11: The Close
    {
      createShape: {
        objectId: 'close_title',
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: updated.data.slides[10].objectId,
          size: { width: { magnitude: 650, unit: 'PT' }, height: { magnitude: 50, unit: 'PT' } },
          transform: { scaleX: 1, scaleY: 1, translateX: 30, translateY: 30, unit: 'PT' }
        }
      }
    },
    {
      insertText: {
        objectId: 'close_title',
        text: 'The Close'
      }
    },
    {
      createShape: {
        objectId: 'close_body',
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: updated.data.slides[10].objectId,
          size: { width: { magnitude: 650, unit: 'PT' }, height: { magnitude: 350, unit: 'PT' } },
          transform: { scaleX: 1, scaleY: 1, translateX: 30, translateY: 100, unit: 'PT' }
        }
      }
    },
    {
      insertText: {
        objectId: 'close_body',
        text: 'Jesse created urgency with competition data:\n💬 "Your competitor has 38% top-3 Google Maps share. The window is closing."\n\nHe pre-handled objections:\n• "No media budget required"\n• "Permanent asset vs Meta ads that disappear"\n• "We train you with data from 850 centers"\n\nHe moved to close — didn\'t leave it open-ended.\n\n✅ GA Action:\n• If you don\'t ask, they won\'t buy\n• Record your next 3 calls and listen back'
      }
    }
  ];

  await slides.presentations.batchUpdate({
    presentationId: SLIDES_ID,
    requestBody: { requests: contentRequests }
  });

  console.log('✅ Google Slides written successfully');
  
  return [
    'Title: How Jesse Closes',
    'Slide 2: PHASE 1 - Agenda Setting & Why They\'re Here',
    'Slide 3: PHASE 2 - Situation Discovery (The Numbers)',
    'Slide 4: PHASE 3 - Pain Deepening (Staff, Personal, Financial)',
    'Slide 5: PHASE 4 - Future Casting (Positive Then Negative)',
    'Slide 6: PHASE 5 - Decision Maker Check',
    'Slide 7: PHASE 6 - The Presentation & Offer',
    'Slide 8: Key Analogies Jesse Used',
    'Slide 9: The Offer Stack (Low Cost → High Value)',
    'Slide 10: Social Proof Moments',
    'Slide 11: The Close'
  ];
}

async function main() {
  try {
    console.log('Starting Google Doc write...');
    await writeGoogleDoc();
    
    console.log('\nStarting Google Slides write...');
    const slidesTitles = await writeGoogleSlides();
    
    console.log('\n✅ TASK COMPLETE\n');
    console.log('Google Doc URL: https://docs.google.com/document/d/1P8iCtcwFQbGn02EB9zXKF3-Vo4H8Ox4yiwoCKCWZS8A/edit');
    console.log('Google Slides URL: https://docs.google.com/presentation/d/15BjaYcC4jADSee9YYZTimGGlkfsci2DoH-htBc5quo4/edit');
    console.log('\nSlides created:');
    slidesTitles.forEach(title => console.log(`  • ${title}`));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

main();
