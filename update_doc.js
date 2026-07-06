const { google } = require('googleapis');
const auth = new google.auth.GoogleAuth({
  keyFile: '/Users/toddthejedigmail.com/.openclaw/workspace/google-service-account.json',
  scopes: ['https://www.googleapis.com/auth/documents']
});
const docs = google.docs({ version: 'v1', auth });
const DOC_ID = '1P8iCtcwFQbGn02EB9zXKF3-Vo4H8Ox4yiwoCKCWZS8A';

(async () => {
  // STEP 1: Update the title text (H1) from "How to Pitch the Upgrade: Web → Full Service" to "How to Pitch the Core Reputation Engine"
  await docs.documents.batchUpdate({
    documentId: DOC_ID,
    requestBody: {
      requests: [{
        deleteContentRange: {
          range: { startIndex: 1, endIndex: 45 }
        }
      }, {
        insertText: {
          location: { index: 1 },
          text: 'How to Pitch the Core Reputation Engine'
        }
      }]
    }
  });
  
  console.log('✓ Title updated');
  
  // STEP 2: Insert new section after Phase 6 (around index 6406)
  // Need to find exact insertion point - after Phase 6 section ends, before "Social Proof"
  
  const newSectionText = `

The Offer — Core Reputation Engine Stack

The Core tier at $1,499/month is the recommended starting point for web-only and web+blueprint clients. It hits the minimum effective dose — enough to move the needle without over-committing a client who's never worked with a full-service team.

What's in the Core ($1,499/month):

Foundation base (included):
• Own Your Zip Code — Blueprint strategy (done-with-you)
• Meta Ad Campaign setup (DFY — 1st ad launched for them)
• Meta Ad Creative (template drops)
• 100+ Google Reviews system (training + templates + copy-paste)
• Partnership Development playbook
• Guerrilla & Grassroots Marketing system
• Tour Sales Training
• GBP Management & Local SEO (training + templates)
• Email Campaigns (training + templates)
• M3 Standard Access — dashboard, audits, SEO reports

Core upgrades (above Foundation):
• M3 Automated Daily Posts (GBP, Facebook, Instagram)
• GYC Simple CRM
• DFY Meta Ad Campaigns (standard, fully managed)
• DFY GBP Optimization & Management
• Group support (email, group calls, 15-min on-demand)

Pricing:
• Monthly: $1,499
• PIF 6-month: $5,994 (save $3k)
• PIF 12-month: $10,989 (save ~$7k)
• Month 7+ renewal rate: $999/month

Common add-on to mention:
• GYC Mobile-Rich Website: +$399/month (lease-to-own after 24 months — clients love this structure)

How to present the tiers:
Don't overwhelm. Lead with Core. Frame Foundation as "a great start" and Growth as "where the heavy lifting happens if you want to go all-in." Most web-only upgrades land on Core.

`;

  await docs.documents.batchUpdate({
    documentId: DOC_ID,
    requestBody: {
      requests: [{
        insertText: {
          location: { index: 6406 },
          text: newSectionText
        }
      }]
    }
  });
  
  console.log('✓ New section inserted at index 6406');
  
})();
