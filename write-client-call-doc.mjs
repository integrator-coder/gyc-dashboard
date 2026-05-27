import { google } from 'googleapis';
import fs from 'fs';

const DOCUMENT_ID = '1QyUzN1Q595mcZT0MRlQKkM6dLFsv8nYKC9cSXQDPmAQ';

// Load service account credentials
const credentials = JSON.parse(
  fs.readFileSync('/Users/toddthejedigmail.com/.openclaw/workspace/google-service-account.json', 'utf8')
);

// Create auth client
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/documents'],
});

const docs = google.docs({ version: 'v1', auth });

async function writeClientCallDoc() {
  try {
    // First, get the document to find the end index
    const doc = await docs.documents.get({ documentId: DOCUMENT_ID });
    const endIndex = doc.data.body.content[doc.data.body.content.length - 1].endIndex;

    // Clear existing content (delete everything except the first character which is required)
    if (endIndex > 2) {
      await docs.documents.batchUpdate({
        documentId: DOCUMENT_ID,
        requestBody: {
          requests: [
            {
              deleteContentRange: {
                range: {
                  startIndex: 1,
                  endIndex: endIndex - 1,
                },
              },
            },
          ],
        },
      });
      console.log('✓ Cleared existing content');
    } else {
      console.log('✓ Document already empty');
    }

    // Build the content structure
    const requests = [];
    let currentIndex = 1;

    // Helper function to add text with style
    function addText(text, style = 'NORMAL_TEXT', addNewline = true) {
      const fullText = addNewline ? text + '\n' : text;
      requests.push({
        insertText: {
          location: { index: currentIndex },
          text: fullText,
        },
      });
      
      if (style !== 'NORMAL_TEXT') {
        requests.push({
          updateParagraphStyle: {
            range: {
              startIndex: currentIndex,
              endIndex: currentIndex + fullText.length,
            },
            paragraphStyle: {
              namedStyleType: style,
            },
            fields: 'namedStyleType',
          },
        });
      }
      
      currentIndex += fullText.length;
    }

    // Helper function to add bullet
    function addBullet(text, checkbox = false) {
      const fullText = text + '\n';
      const startIdx = currentIndex;
      
      requests.push({
        insertText: {
          location: { index: currentIndex },
          text: fullText,
        },
      });
      
      currentIndex += fullText.length;
      
      // Add bullet formatting - will be converted to checkbox later if needed
      requests.push({
        createParagraphBullets: {
          range: {
            startIndex: startIdx,
            endIndex: currentIndex,
          },
          bulletPreset: checkbox ? 'BULLET_CHECKBOX' : 'BULLET_DISC_CIRCLE_SQUARE',
        },
      });
    }

    // Document content starts here
    addText('Client Call — Framework, Prep Checklist & Evaluation Rubric', 'HEADING_1');
    addText('');
    
    addText('Call Header', 'HEADING_2');
    addText('Call Participants:');
    addText('Call Type: (Monthly Review / Quarterly Review / Issue Resolution / Strategy Call)');
    addText('Recording Link:');
    addText('Post-Call Summary Email: (paste here after call)');
    addText('Asana Task Link(s):');
    addText('');
    
    addText('Section 1 — Pre-Call Prep', 'HEADING_2');
    addText('Takes place 15–20 minutes before the call.');
    addText('');
    
    addText('Client Profile', 'HEADING_3');
    addBullet('How many locations do they have', true);
    addBullet('What GYC services do they have (Website / SEO / Paid Media / Blueprint / CRM)', true);
    addBullet('How long have they been a client', true);
    addBullet('Their last enrollment numbers', true);
    addBullet('Note changes in their capacity since last call', true);
    addText('');
    
    addText('Billing & MRR', 'HEADING_3');
    addText('From Client Card — Overview tab');
    addBullet('Current MRR confirmed — any drops or gaps in the last 6 months?', true);
    addBullet('Billing status: current / past due / overdue?', true);
    addBullet('Any Stripe payment failures or churn risk signals?', true);
    addText('');
    
    addText('GBP Performance', 'HEADING_3');
    addText('From Client Card — GBP tab');
    addBullet('GBP impressions: last 30 days vs. previous period', true);
    addBullet('GBP calls: last 30 days vs. previous period', true);
    addBullet('GBP direction requests: last 30 days vs. previous period', true);
    addBullet('Current star rating + total review count', true);
    addBullet('New reviews since last call (positive / negative flagged)', true);
    addBullet('Review count above 40? Average above 4?', true);
    addBullet('Photos and copy up to date and acceptable quality?', true);
    addText('');
    
    addText('SEO Performance', 'HEADING_3');
    addText('From Client Card — SEO tab');
    addBullet('Current average keyword rank vs. last call', true);
    addBullet('Share of voice % — current vs. previous period', true);
    addBullet('Biggest keyword movers up + down since last call', true);
    addBullet('Organic traffic trend (last 30 days vs. previous)', true);
    addBullet('Any SEO issues or flags in dashboard?', true);
    addText('');
    
    addText('Website Traffic', 'HEADING_3');
    addText('From Client Card — Website Traffic tab');
    addBullet('Monthly visits: last 30 days vs. previous period', true);
    addBullet('Traffic trend direction (up / down / flat)', true);
    addBullet('Top traffic sources: organic / CPC / direct / social', true);
    addBullet('Contact Us / Book a Tour pages — ranking in top pages?', true);
    addBullet('Note impact of Google Ads on traffic (if running)', true);
    addText('');
    
    addText('Demographics', 'HEADING_3');
    addText('From Client Card — Demographics tab');
    addBullet('Income heatmap reviewed — are we targeting the right radius?', true);
    addBullet('Market context noted for this client\'s location', true);
    addText('');
    
    addText('Lead Funnel', 'HEADING_3');
    addText('From Client Card — CRM/Funnel tab');
    addBullet('Lead → Tour conversion rate (latest month + trend)', true);
    addBullet('Tour → Registration rate (latest month + trend)', true);
    addBullet('Funnel trend: improving / declining / flat?', true);
    addBullet('CRM platform confirmed (LineLeader / IKS / Playground / Brightwheel)', true);
    addBullet('Do we have access to their CRM?', true);
    addBullet('Confirm inquiry forms are coming through correctly', true);
    addText('');
    
    addText('Previous Call', 'HEADING_3');
    addText('From Client Card — Meetings tab');
    addBullet('Last call recap reviewed', true);
    addBullet('Action items THEY were supposed to take — completed?', true);
    addBullet('Action items GYC was supposed to take — completed?', true);
    addBullet('Any unresolved issues or open commitments from last call?', true);
    addText('');
    
    addText('Active Work', 'HEADING_3');
    addBullet('Website or other projects in the works from us? If so, what?', true);
    addBullet('Paid media campaigns active? Note performance', true);
    addBullet('Open Asana tasks reviewed — anything overdue?', true);
    addBullet('Open Zendesk tickets reviewed', true);
    addBullet('What are their most significant issues to date?', true);
    addBullet('What might they bring up — pre-prepared responses ready?', true);
    addBullet('Highlights from Daily Data Standup pulled', true);
    addBullet('Anything else essential to note for this particular client?', true);
    addText('');
    
    addText('Section 2 — On The Call', 'HEADING_2');
    addText('');
    
    addText('Rapport-Building Open', 'HEADING_3');
    addText('Warm check-in, set agenda, establish tone. Keep brief.');
    addText('');
    
    addText('Outstanding Issues', 'HEADING_3');
    addText('Review each bullet, make notes, and have responses ready before moving to data review.');
    addBullet('Billing updates — theirs or ours', true);
    addBullet('Do we have access to their CRM?', true);
    addBullet('Confirm inquiry forms are coming through', true);
    addBullet('Review action items they were supposed to complete since last call', true);
    addText('');
    
    addText('Review Data', 'HEADING_3');
    addBullet('Get updated enrollment numbers', true);
    addBullet('Note changes in their capacity', true);
    addBullet('Review highlights from Daily Data Standup', true);
    addText('');
    
    addText('Performance Update — Order of Presentation', 'HEADING_3');
    addText('');
    
    addText('1. Google Business Profile', 'HEADING_3');
    addText('Particularly relevant for 90-Day Guarantee clients.');
    addBullet('Review count above 40', true);
    addBullet('Review average above 4', true);
    addBullet('GBP impressions trend — up or down vs. last period?', true);
    addBullet('GBP calls trend — up or down?', true);
    addBullet('GBP direction requests — up or down?', true);
    addBullet('Photos and copy up to date and acceptable quality', true);
    addBullet('Any negative reviews to address or bury?', true);
    addText('');
    
    addText('2. SEO Performance', 'HEADING_3');
    addBullet('Average keyword rank — current vs. last call', true);
    addBullet('Share of voice % — current vs. previous', true);
    addBullet('Top keywords ranked in positions 1–3', true);
    addBullet('Biggest movers up (wins to highlight to client)', true);
    addBullet('Biggest movers down (explain and contextualize)', true);
    addBullet('Organic traffic from SEO — trending direction', true);
    addBullet('Share of voice benchmark: above 30%+? (trigger for conversion spike)', true);
    addText('');
    
    addText('3. Facebook Manager', 'HEADING_3');
    addText('Where applicable or notable.');
    addBullet('The Data Standup for FB is generally all the client needs', true);
    addBullet('A presentation from the FB Manager page may be necessary when running a custom campaign', true);
    addText('');
    
    addText('4. Google Ads', 'HEADING_3');
    addBullet('Note the successes / limitations of each campaign', true);
    addBullet('Are campaigns addressing their enrollment gaps?', true);
    addBullet('Google Ads budget vs. time of year (enrollment campaigns) discussion', true);
    addBullet('Exit Google Ads after a quick stop at overall results', true);
    addText('');
    
    addText('5. Website Analytics', 'HEADING_3');
    addText('From Client Card — Website Traffic tab');
    addBullet('Website traffic sources: organic / CPC / social / direct', true);
    addBullet('Note GYC\'s direct impact (CPC and social)', true);
    addBullet('Top pages and screens — which are performing?', true);
    addBullet('Note impact of Google Ads on traffic', true);
    addBullet('Note ranking of Contact Us / Book a Tour pages', true);
    addBullet('Note funnel points in page rankings', true);
    addBullet('Contrast these points with the corresponding data in the lead funnel', true);
    addText('');
    
    addText('6. Demographics', 'HEADING_3');
    addBullet('Note income heatmap context if relevant — are ads and SEO targeting the right areas?', true);
    addBullet('Any demographic insights that explain enrollment patterns?', true);
    addText('');
    
    addText('7. Lead Funnel Tracking', 'HEADING_3');
    addText('Check rates against baseline and investigate areas of poor performance.');
    addText('');
    addText('If the Touring Rate is low — explore:');
    addBullet('Is the center full / waitlist full? No need to tour?', true);
    addBullet('Is staff following up with leads?', true);
    addBullet('Are CRM statuses being updated? Tours tracked? No-shows triggering follow-up?', true);
    addBullet('Is the CRM optimized?', true);
    addText('');
    addText('If the Closing/Registration Rate is low — explore:');
    addBullet('Is the center full?', true);
    addBullet('Is follow-up after the tour incomplete?', true);
    addBullet('Is the person running tours suitable for sales?', true);
    addBullet('What are the main objections?', true);
    addText('');
    addText('If targets are met but center still not filling — leads volume is the issue:');
    addBullet('Is there budget to increase Google Ads spend for more leads?', true);
    addBullet('Follow up with Google Ads team — anything we can do better on this account?', true);
    addBullet('Is there a GBP or reputation issue holding back leads?', true);
    addText('');
    
    addText('8. Upsell', 'HEADING_3');
    addBullet('Were there upsell opportunities? Note them here:', true);
    addText('');
    
    addText('Summarize', 'HEADING_3');
    addBullet('Summarize the above with the client on the call', true);
    addText('');
    
    addText('Section 3 — Closing', 'HEADING_2');
    addText('');
    addBullet('Email summary to client (same day)', true);
    addBullet('Is this client in their 90-Day Guarantee?', true);
    addBullet('Update 10K Guarantee Tracking Sheet (if applicable)', true);
    addBullet('Request Google review from client (if appropriate)', true);
    addBullet('Deploy action tasks for team in Asana', true);
    addBullet('Put call recording link at top of call notes', true);
    addBullet('Update Meetings tab on client card with recap + action items', true);
    addText('');
    
    addText('Section 4 — Evaluation Rubric', 'HEADING_2');
    addText('');
    addText('Use this rubric to score every client call. Score each category 1–4.');
    addText('');
    
    addText('Scoring Guide', 'HEADING_3');
    addBullet('1 — Needs Work: Item was missed or done incorrectly');
    addBullet('2 — Partial: Started but incomplete');
    addBullet('3 — Good: Completed correctly');
    addBullet('4 — Excellent: Completed with extra depth or proactive insight');
    addText('');
    
    addText('Pre-Call Preparation (1–4)', 'HEADING_3');
    addBullet('1: No prep — walked in without reviewing data');
    addBullet('2: Glanced at profile only, missed billing / funnel / GBP layers');
    addBullet('3: All major data reviewed: billing, GBP, SEO, funnel, previous action items');
    addBullet('4: Fully prepared + anticipated objections, all Client Card data layers pulled, responses ready before dial');
    addText('');
    
    addText('Outstanding Issues Handling (1–4)', 'HEADING_3');
    addBullet('1: Billing, CRM, and open items not addressed');
    addBullet('2: Raised but not resolved or followed through');
    addBullet('3: All outstanding items addressed proactively');
    addBullet('4: Issues raised before client brought them up, resolution or next steps clearly communicated');
    addText('');
    
    addText('GBP Review Quality (1–4)', 'HEADING_3');
    addBullet('1: Not discussed or only review count mentioned');
    addBullet('2: Review count + rating only');
    addBullet('3: Impressions, calls, directions, reviews — all covered with comparison');
    addBullet('4: Full GBP story told — trends explained, wins highlighted, review strategy discussed, next optimization steps given');
    addText('');
    
    addText('SEO Review Quality (1–4)', 'HEADING_3');
    addBullet('1: Not discussed');
    addBullet('2: Mentioned "rankings are improving" without data');
    addBullet('3: Average rank + share of voice + keyword movers reviewed');
    addBullet('4: Full SEO narrative — wins and drops explained with context, organic traffic tied to rankings, 30%+ share of voice benchmark referenced');
    addText('');
    
    addText('Website & Traffic Review (1–4)', 'HEADING_3');
    addBullet('1: Not discussed');
    addBullet('2: Traffic numbers mentioned without context');
    addBullet('3: Sources, top pages, CPC impact, funnel pages reviewed');
    addBullet('4: Full traffic story — GA data used, CPC impact highlighted, tour/contact page rankings noted, contrasted with funnel data');
    addText('');
    
    addText('Lead Funnel Analysis (1–4)', 'HEADING_3');
    addBullet('1: Not discussed');
    addBullet('2: Enrollment number given with no rate analysis');
    addBullet('3: Tour rate + close rate reviewed, low performers flagged');
    addBullet('4: Root cause identified for any underperformance, specific fix proposed, CRM optimization discussed if applicable');
    addText('');
    
    addText('Google Ads Review (1–4, if applicable)', 'HEADING_3');
    addBullet('1: Not discussed when it should have been');
    addBullet('2: Generic update — "ads are running"');
    addBullet('3: Campaign results, enrollment gap alignment reviewed');
    addBullet('4: Full campaign review — successes, limitations, budget vs. enrollment season discussed, optimization action items set');
    addText('');
    
    addText('Billing & MRR Coverage (1–4)', 'HEADING_3');
    addBullet('1: Not discussed even when flags existed');
    addBullet('2: Mentioned passively');
    addBullet('3: Any billing flags proactively raised and addressed');
    addBullet('4: Addressed directly, context given, escalation path clear if needed');
    addText('');
    
    addText('Upsell Awareness (1–4)', 'HEADING_3');
    addBullet('1: No upsell awareness shown');
    addBullet('2: Opportunity noted mentally but not actioned');
    addBullet('3: Opportunities identified and raised with client');
    addBullet('4: Upsell framed naturally in conversation with clear next step or follow-up booked');
    addText('');
    
    addText('Action Item Clarity (1–4)', 'HEADING_3');
    addBullet('1: No action items defined');
    addBullet('2: GYC items only, no client commitments');
    addBullet('3: Both sides have specific action items');
    addBullet('4: Action items specific, time-bound, read back to client, logged in Asana before end of day');
    addText('');
    
    addText('Client Experience (1–4)', 'HEADING_3');
    addBullet('1: Data dump — felt like a report not a conversation');
    addBullet('2: Some warmth but data-heavy without explanation');
    addBullet('3: Professional, client left informed and supported');
    addBullet('4: Client left feeling like a valued partner — understood their numbers, confident in the team, clear on next steps');
    addText('');
    
    addText('Total Score Interpretation', 'HEADING_3');
    addBullet('36–44: ✅ Strong call — execute commitments');
    addBullet('25–35: 🟡 Follow Up Needed — close gaps before next call');
    addBullet('Below 25: 🔴 Escalate — client relationship at risk');

    // Execute all requests
    await docs.documents.batchUpdate({
      documentId: DOCUMENT_ID,
      requestBody: { requests },
    });

    console.log('✓ Content written successfully');
    console.log(`Total requests: ${requests.length}`);
  } catch (error) {
    console.error('Error writing to document:', error.message);
    if (error.response) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

writeClientCallDoc();
