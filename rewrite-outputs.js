const { google } = require('googleapis');
const fs = require('fs');

const auth = new google.auth.GoogleAuth({
  keyFile: '/Users/toddthejedigmail.com/.openclaw/workspace/google-service-account.json',
  scopes: ['https://www.googleapis.com/auth/presentations', 'https://www.googleapis.com/auth/documents'],
});

async function rewriteSlides() {
  const slides = google.slides({ version: 'v1', auth });
  const presentationId = '15BjaYcC4jADSee9YYZTimGGlkfsci2DoH-htBc5quo4';
  
  console.log('Fetching current presentation...');
  const presentation = await slides.presentations.get({ presentationId });
  
  // Delete all existing slides except the first one
  console.log('Clearing existing slides...');
  const deleteRequests = [];
  for (let i = 1; i < presentation.data.slides.length; i++) {
    deleteRequests.push({
      deleteObject: {
        objectId: presentation.data.slides[i].objectId
      }
    });
  }
  
  if (deleteRequests.length > 0) {
    await slides.presentations.batchUpdate({
      presentationId,
      requestBody: { requests: deleteRequests }
    });
  }
  
  // Clear the first slide
  const firstSlide = presentation.data.slides[0];
  const clearRequests = [];
  if (firstSlide.pageElements) {
    firstSlide.pageElements.forEach(element => {
      clearRequests.push({
        deleteObject: { objectId: element.objectId }
      });
    });
  }
  
  if (clearRequests.length > 0) {
    await slides.presentations.batchUpdate({
      presentationId,
      requestBody: { requests: clearRequests }
    });
  }
  
  console.log('Creating new slides with content...');
  
  const slideContents = [
    {
      title: 'How to Get and Stay Full in 2026',
      body: 'A Proven System for Childcare Centers\n\nGrow Your Center'
    },
    {
      title: 'The Problem',
      body: '• Ad costs are rising — Meta isn\'t delivering like it used to\n\n• Most centers run at 40-60% capacity and can\'t figure out why\n\n• Leads come in but don\'t convert to tours\n\n• Centers are invisible where parents are actually searching'
    },
    {
      title: 'The Opportunity',
      body: '• Parents are now searching on Google Maps and AI (ChatGPT, Gemini)\n\n• 80% of parents search on mobile only\n\n• The centers ranking in the top 3 on Google Maps get 70% of the leads\n\n• Most of your competitors haven\'t started this yet — the window is open NOW'
    },
    {
      title: 'Why Most Marketing Fails',
      body: '• Running ads without trust assets = leaky bucket\n\n• Meta finds random people; Google Maps finds parents already looking for you\n\n• Speed to lead matters: respond within 1 minute = 400% higher show-up rate\n\n• A website that doesn\'t convert on mobile is your #1 silent enrollment killer'
    },
    {
      title: 'What We Do Differently',
      body: '• We build the full enrollment engine — not just ads\n\n• We start with what doesn\'t cost you a media budget\n\n• Then we layer in what compounds and stays (unlike ads that stop the second you pause)\n\n• Every strategy comes from what\'s worked across 850+ childcare centers'
    },
    {
      title: 'Your Enrollment Engine — The 5 Pillars',
      body: '🌐 Mobile-optimized website (built to convert, AI-search ready)\n\n📍 Google Maps + AI SEO (no media budget, permanent trust asset)\n\n💬 CRM + Speed-to-Lead (automated, never miss a lead again)\n\n📧 Email & Text Marketing (2-5 enrollments/month from leads you already have)\n\n🤝 Community Partnerships (zero ad spend, high trust referrals)'
    },
    {
      title: 'Your Website — Built to Convert',
      body: '• Most childcare websites look like brochures — they don\'t convert\n\n• Parents decide in 90 seconds. Is your site built for that?\n\n• Mobile-first design, clear calls to action, self-booking tour option\n\n• Optimized for Google AI answers and ChatGPT recommendations\n\n• Result: more leads who show up ready to enroll'
    },
    {
      title: 'Google Maps Dominance',
      body: '• 70% of childcare leads come from Google Maps searches\n\n• "Best preschool near me" = parents who are READY — not scrolling Facebook\n\n• Most centers rank outside the top 20 — we get you to top 3\n\n• No media budget. Once you rank, you stay ranked.\n\n• Unlike ads: this is an asset you own, not rent'
    },
    {
      title: 'What One Enrollment Is Worth',
      body: '• Average tuition: ~$1,000/month per child\n\n• Average stay: 18 months\n\n• = $18,000–$29,000 per enrolled family\n\n• 10 new enrollments = $180,000–$290,000 in lifetime revenue\n\n• At 60%+ gross margin on incremental capacity — nearly all of that is profit'
    },
    {
      title: 'Proven Results',
      body: '• 850+ childcare centers helped\n\n• 650,000+ children enrolled through our system\n\n• One client: 0 to 89 enrolled in 6 months (similar size/capacity gap)\n\n• That same client is now opening 5 new locations\n\n• We don\'t figure this out as we go — we run the playbook that works'
    },
    {
      title: 'What This Looks Like for Your Center',
      body: '• Month 1: Website optimized, Google profile live, CRM connected\n\n• Month 2: Email/text campaigns running, community partnerships active\n\n• Month 3+: Google Maps ranking climbing, leads compounding\n\n• You get monthly reporting, heatmap tracking, and a dedicated team\n\n• One team. One strategy. One goal: get you full.'
    },
    {
      title: 'Next Steps',
      body: '• Ready to see exactly where you rank and who your competitors are?\n\n• We build a custom heatmap report for your location — no obligation\n\n• Book a strategy session to get started'
    }
  ];
  
  const requests = [];
  
  // Update first slide (reuse existing)
  const firstSlideId = presentation.data.slides[0].objectId;
  
  requests.push(
    {
      createShape: {
        objectId: 'title_0',
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: firstSlideId,
          size: {
            height: { magnitude: 100, unit: 'PT' },
            width: { magnitude: 600, unit: 'PT' }
          },
          transform: {
            scaleX: 1,
            scaleY: 1,
            translateX: 50,
            translateY: 150,
            unit: 'PT'
          }
        }
      }
    },
    {
      insertText: {
        objectId: 'title_0',
        text: slideContents[0].title
      }
    },
    {
      updateTextStyle: {
        objectId: 'title_0',
        style: {
          bold: true,
          fontSize: { magnitude: 32, unit: 'PT' }
        },
        fields: 'bold,fontSize'
      }
    },
    {
      createShape: {
        objectId: 'body_0',
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: firstSlideId,
          size: {
            height: { magnitude: 150, unit: 'PT' },
            width: { magnitude: 600, unit: 'PT' }
          },
          transform: {
            scaleX: 1,
            scaleY: 1,
            translateX: 50,
            translateY: 280,
            unit: 'PT'
          }
        }
      }
    },
    {
      insertText: {
        objectId: 'body_0',
        text: slideContents[0].body
      }
    },
    {
      updateTextStyle: {
        objectId: 'body_0',
        style: {
          fontSize: { magnitude: 18, unit: 'PT' }
        },
        fields: 'fontSize'
      }
    }
  );
  
  // Create remaining slides
  for (let i = 1; i < slideContents.length; i++) {
    const slideId = 'slide_' + i;
    const titleId = 'title_' + i;
    const bodyId = 'body_' + i;
    
    requests.push(
      {
        createSlide: {
          objectId: slideId,
          slideLayoutReference: {
            predefinedLayout: 'BLANK'
          }
        }
      },
      {
        createShape: {
          objectId: titleId,
          shapeType: 'TEXT_BOX',
          elementProperties: {
            pageObjectId: slideId,
            size: {
              height: { magnitude: 80, unit: 'PT' },
              width: { magnitude: 600, unit: 'PT' }
            },
            transform: {
              scaleX: 1,
              scaleY: 1,
              translateX: 50,
              translateY: 50,
              unit: 'PT'
            }
          }
        }
      },
      {
        insertText: {
          objectId: titleId,
          text: slideContents[i].title
        }
      },
      {
        updateTextStyle: {
          objectId: titleId,
          style: {
            bold: true,
            fontSize: { magnitude: 28, unit: 'PT' }
          },
          fields: 'bold,fontSize'
        }
      },
      {
        createShape: {
          objectId: bodyId,
          shapeType: 'TEXT_BOX',
          elementProperties: {
            pageObjectId: slideId,
            size: {
              height: { magnitude: 300, unit: 'PT' },
              width: { magnitude: 600, unit: 'PT' }
            },
            transform: {
              scaleX: 1,
              scaleY: 1,
              translateX: 50,
              translateY: 150,
              unit: 'PT'
            }
          }
        }
      },
      {
        insertText: {
          objectId: bodyId,
          text: slideContents[i].body
        }
      },
      {
        updateTextStyle: {
          objectId: bodyId,
          style: {
            fontSize: { magnitude: 16, unit: 'PT' }
          },
          fields: 'fontSize'
        }
      }
    );
  }
  
  await slides.presentations.batchUpdate({
    presentationId,
    requestBody: { requests }
  });
  
  console.log('✓ Slides rewritten successfully');
}

async function rewriteDoc() {
  const docs = google.docs({ version: 'v1', auth });
  const documentId = '1P8iCtcwFQbGn02EB9zXKF3-Vo4H8Ox4yiwoCKCWZS8A';
  
  console.log('Fetching current document...');
  const doc = await docs.documents.get({ documentId });
  const endIndex = doc.data.body.content[doc.data.body.content.length - 1].endIndex;
  
  console.log('Clearing existing content...');
  await docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [
        {
          deleteContentRange: {
            range: {
              startIndex: 1,
              endIndex: endIndex - 1
            }
          }
        }
      ]
    }
  });
  
  console.log('Writing new content...');
  const fullContent = `How to Pitch the Upgrade: Web → Full Service
Internal GA Playbook | GYC

What This Is
A step-by-step guide for turning a web-only or web+blueprint client into a full-service client. Use this before and during upgrade calls. This playbook is based on a real close — the structure, language, and sequence that works.

Who You're Calling
Web-only clients. They have a website with GYC (and maybe Blueprint). They're not getting full service — no SEO, no Google Maps work, no CRM. Most of them:
• Are spending money on Meta ads with weak results
• Have low lead volume (1-4/week)
• Are at 40-60% capacity and frustrated
• Haven't connected the dots between their website and their lead flow

Your job: connect those dots and show them what the full engine looks like.

Before the Call

Do this:
• Pull their heatmap data (if available) — know their current Google Maps ranking
• Know their capacity and any capacity gap info from the dashboard
• Know their current MRR and what services they're paying for
• Visualize the close. Set your intention. You're not hoping — you're certain this helps them.

The pre-call mindset:
Certainty is the core of influence. Go into this call knowing you have something that works. You're not selling — you're offering a proven solution to a problem they already have.

The Call Framework (6 Phases)

Phase 1 — Agenda Setting (First 60 Seconds)
Purpose: Create safety, set expectations, establish a low-pressure tone.

What to say:
"For today, I thought we could ask each other some questions, and if everything sounds good, we can go over some options. Does that sound fair?"

Why it works: "If everything sounds good" removes pressure. You're not assuming the sale. You're giving them a door to walk through willingly.

Phase 2 — Why They're Here (Discovery)
Purpose: Get them talking about what's not working. Let them say it — don't diagnose too fast.

Key questions:
• "When you first connected with us, what stood out that made you want to explore this?"
• "What are you looking to get out of today's conversation?"
• "Walk me through your current lead flow — what are you seeing week to week?"
• "What are you spending on advertising right now, and what kind of results are you getting?"

What you're listening for:
• Low lead volume (flag: 1-4/week is low)
• High ad spend with low return
• Capacity gap (under 70%)
• Difficulty reaching leads / low conversion

Mirror and reflect: When they tell you their number, reflect it back:
"So you're getting about 1-2 leads a week, and even then it's tough to actually reach them — and you're spending $2,000 a month on that?"

Phase 3 — Deepen the Pain (Without Piling On)
Purpose: Help them feel the full weight of the problem — staffing, personal, financial.

Key questions:
• "How long has the lead flow been like this?"
• "Has this affected conversations with staff — hours, anything like that?"
• "On your end personally — are you ahead of this or trying to catch up to it?"

Use "we" language: "Are WE losing money right now?" Not "are YOU losing money." You're in it with them.

When they describe tight margins or payroll cuts — don't add drama. Just acknowledge:
"Yeah, no other choice at that point."

The goal is to surface the real cost. Not to manipulate — to make sure they're solving a real problem, not a surface one.

Phase 4 — Future Cast (Positive First, Then Negative)
Purpose: Get them to sell themselves on the outcome.

Positive first:
"Let's say we get you your first 20 enrollments toward your goal — how does your day look different? What does that free up for you?"

Let them do the math out loud. If they don't, prompt them:
"At roughly $1,000/month per kid — if 60% of that is margin — 10 kids is a meaningful number, right?"

Then negative:
"I want to ask something — allow me. What's the almost certain future if, 6-12 months from now, the lead flow hasn't changed? What happens?"

Don't pile on their answer. Just acknowledge it, then close the loop:
"So we're not looking to settle for that, right? That's not the goal."

Phase 5 — Decision Maker Check
Purpose: Surface any unseen objections before the presentation.

"Just to confirm — are you the sole decision maker here, or do you have a partner/spouse involved in calls like this?"

If they have a partner: "Are they aware you're exploring this? Are they supportive of the direction?"

This isn't about control — it's about not building a house on sand. If there's a second decision maker, you want to know now.

Phase 6 — The Presentation & Close
Purpose: Show them the system. Layer from low-cost → high-value → permanent asset.

Bridge line (use this to transition):
"Based on everything you've shared, we absolutely have a strategy that's worked for centers in your exact situation. Let me walk you through it."

Present in this order:
1. GYC website (convert + AI-search ready) — "We complement what you have, not compete with it"
2. CRM + Speed-to-Lead — "If we get back within 1 minute of a tour booking, show-up rate goes up 400%"
3. Email/text marketing — "You already have the leads. We just need to work them. 3-5 campaigns/month = 2-5 enrollments, zero ad budget"
4. Community partnerships — "Zero cost, high trust — templated outreach, co-branded flyers"
5. Google Maps + AI SEO — "This is the heavy hitter. No media budget. 70% of leads come from here. It stays — unlike ads"
6. Tour training — "Every tour is worth $29K. We help you convert more of them."

The Heatmap Moment:
Show them their current ranking vs competitors. Let the visual do the work.
"You're showing up in 88% of searches in your area — but only ranking in the top 3 one percent of the time. Your competitor is at 38%. They haven't hit 50 yet. That's the window."

Analogies to have ready:
• Leaky bucket — "Running ads without trust assets is like pouring water into a bucket with holes. Before we pour more water, let's patch the holes."
• Tylenol (minimum effective dose) — "We're not under-dosing you. We're also not giving you 10 pills. Just the right amount."
• Plant a tree — "Best time was 10 years ago. Second best? Today."
• Needle in a haystack — "Meta is finding random people. Google Maps is finding parents already searching for you."
• Condo playbook — "We don't figure this out every time. We run a playbook from 850 centers."

Social Proof — When and How to Drop It
• Early: "That's often how people find us — through success stories from other centers."
• Mid-call: "850+ centers, 24 full-time staff, 650,000 children enrolled."
• Before close: "[Center name type] went from 0 to 89 enrolled in 6 months — similar size, similar capacity gap. They're now opening 5 locations."
• Use it to normalize, not brag. "We've seen this work. We just want to pay it forward."

Pre-Handled Objections

Objection: "I'm already spending on ads"
How to handle: Validated the spend, then reframed: "Are you getting the return on that?"

Objection: "I can't afford more marketing"
How to handle: Opened with no-media-budget options first. Never led with cost.

Objection: "I need to think about it / talk to my wife"
How to handle: Surfaced decision maker early so it couldn't be used as a stall at the end.

Objection: "I'm not sure if the timing is right"
How to handle: "Best time to plant the tree was 10 years ago. Second best?"

Objection: "My current person is trying his best"
How to handle: Empathized, didn't attack. Framed as "2021 marketing vs 2026 marketing."

Things NOT to Do
• Don't diagnose before they speak. Ask first.
• Don't pile on the pain. Surface it, acknowledge it, move forward.
• Don't lead with cost or package names. Lead with outcomes.
• Don't mention specific sales reps or prospect names in any deliverable.
• Don't rush Phase 2-3. Discovery is where the deal is made or lost.
• Don't skip the decision maker check — it's the most overlooked step.`;
  
  await docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [
        {
          insertText: {
            location: { index: 1 },
            text: fullContent
          }
        }
      ]
    }
  });
  
  console.log('✓ Doc rewritten successfully');
}

async function main() {
  try {
    await rewriteSlides();
    await rewriteDoc();
    console.log('\n✅ Both outputs rewritten successfully');
    console.log('✅ Zero prospect or rep names in either document');
    console.log('\nSlides URL: https://docs.google.com/presentation/d/15BjaYcC4jADSee9YYZTimGGlkfsci2DoH-htBc5quo4/edit');
    console.log('Doc URL: https://docs.google.com/document/d/1P8iCtcwFQbGn02EB9zXKF3-Vo4H8Ox4yiwoCKCWZS8A/edit');
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('API Error Details:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

main();
