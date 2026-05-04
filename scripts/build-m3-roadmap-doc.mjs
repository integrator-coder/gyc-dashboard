import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { google } from 'googleapis';
import os from 'os';

const DOC_ID = '1oUsjNBpFcsUIM7UhfGNMrrtsvVdkIKxtSyBGJIf0JtQ';
const keyFile = `${os.homedir()}/.openclaw/credentials/google-console.json`;
const auth = new google.auth.GoogleAuth({ keyFile, scopes: ['https://www.googleapis.com/auth/documents'] });
const docs = google.docs({ version: 'v1', auth });

const C = {
  deepPurple: { red: 52/255, green: 11/255, blue: 103/255 },
  purple:     { red: 115/255, green: 20/255, blue: 148/255 },
  violet:     { red: 115/255, green: 47/255, blue: 186/255 },
  gold:       { red: 193/255, green: 156/255, blue: 70/255 },
  goldLight:  { red: 180/255, green: 140/255, blue: 60/255 },
  offWhite:   { red: 245/255, green: 245/255, blue: 245/255 },
  lightPurpleBg: { red: 242/255, green: 237/255, blue: 250/255 },
  goldBg:     { red: 252/255, green: 248/255, blue: 237/255 },
  black:      { red: 0, green: 0, blue: 0 },
  gray:       { red: 100/255, green: 100/255, blue: 100/255 },
  lightGray:  { red: 155/255, green: 155/255, blue: 155/255 },
  dividerColor: { red: 200/255, green: 190/255, blue: 215/255 },
};

// Clear doc
const doc = await docs.documents.get({ documentId: DOC_ID });
let endIdx = 1;
for (const b of doc.data.body.content) if (b.endIndex) endIdx = b.endIndex;
if (endIdx > 2) await docs.documents.batchUpdate({ documentId: DOC_ID, requestBody: { requests: [{ deleteContentRange: { range: { startIndex: 1, endIndex: endIdx - 1 } } }]}});
console.log('✅ Cleared');

let idx = 1;
const reqs = [];
const fmts = [];

function ins(text) {
  const s = idx;
  reqs.push({ insertText: { location: { index: idx }, text } });
  idx += text.length;
  return { s, e: idx };
}
function ts(seg, opts) { fmts.push({ ...seg, type: 'ts', ...opts }); }
function ps(seg, opts) { fmts.push({ ...seg, type: 'ps', ...opts }); }

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function divider() {
  const r = ins('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n');
  ts(r, { color: C.dividerColor, fontSize: 5 });
}

function sectionLabel(text) {
  ins('\n');
  const r = ins(text + '\n');
  ts(r, { color: C.deepPurple, fontSize: 17, bold: true });
  ps(r, { spaceAbove: 28, spaceBelow: 8 });
}

function phaseHeader(title, sub) {
  ins('\n');
  const r = ins(title + '\n');
  ts(r, { color: C.deepPurple, fontSize: 17, bold: true });
  ps(r, { spaceAbove: 28, spaceBelow: 2 });
  const s = ins(sub + '\n');
  ts(s, { color: C.gold, fontSize: 12 });
  ps(s, { spaceBelow: 10 });
}

function exposition(text) {
  const r = ins(text + '\n\n');
  ts(r, { color: C.black, fontSize: 12 });
  ps(r, { spaceAbove: 4, spaceBelow: 4 });
}

// Pull quote — same light purple style as inlineQuote, slightly larger
function pullQuote(quote, attribution) {
  ins('\n');
  const r = ins('"' + quote + '"\n');
  ts(r, { color: C.deepPurple, fontSize: 13, italic: true, bold: false });
  ps(r, {
    spaceAbove: 12, spaceBelow: 0,
    shading: { color: C.lightPurpleBg },
    indentStart: 20, indentEnd: 20,
    borderLeft: C.violet,
  });
  if (attribution) {
    const a = ins('— ' + attribution + '\n\n');
    ts(a, { color: C.purple, fontSize: 10.5, italic: false });
    ps(a, {
      spaceAbove: 2, spaceBelow: 12,
      shading: { color: C.lightPurpleBg },
      indentStart: 20, indentEnd: 20,
      borderLeft: C.violet,
    });
  }
}

// Inline highlight quote — lighter treatment, used within phases
function inlineQuote(quote, attribution) {
  ins('\n');
  const r = ins('"' + quote + '"\n');
  ts(r, { color: C.deepPurple, fontSize: 12.5, italic: true });
  ps(r, {
    spaceAbove: 8, spaceBelow: 0,
    shading: { color: C.lightPurpleBg },
    indentStart: 16, indentEnd: 16,
    borderLeft: C.purple,
  });
  if (attribution) {
    const a = ins('— ' + attribution + '\n\n');
    ts(a, { color: C.gray, fontSize: 10, italic: false });
    ps(a, {
      spaceAbove: 0, spaceBelow: 8,
      shading: { color: C.lightPurpleBg },
      indentStart: 16, indentEnd: 16,
    });
  }
}

// Gold callout box
function calloutBox(text) {
  ins('\n');
  const r = ins(text + '\n\n');
  ts(r, { color: C.deepPurple, fontSize: 11.5, italic: false });
  ps(r, { spaceAbove: 8, spaceBelow: 8, shading: { color: C.goldBg }, indentStart: 16, indentEnd: 16, borderLeft: C.gold });
}

function bullet(label, body) {
  if (label) {
    const pre = ins('·  '); ts(pre, { color: C.black, fontSize: 12 });
    const lb = ins(label + '  '); ts(lb, { color: C.purple, fontSize: 12, bold: true });
    const bd = ins(body + '\n'); ts(bd, { color: C.black, fontSize: 12 }); ps(bd, { spaceAbove: 3, spaceBelow: 3 });
  } else {
    const pre = ins('·  '); ts(pre, { color: C.black, fontSize: 12 });
    const bd = ins(body + '\n'); ts(bd, { color: C.black, fontSize: 12 }); ps(bd, { spaceAbove: 3, spaceBelow: 3 });
  }
}

function factRow(label, val) {
  const lb = ins(label + ':  '); ts(lb, { color: C.purple, fontSize: 12, bold: true });
  const vl = ins(val + '\n'); ts(vl, { color: C.black, fontSize: 12 }); ps(vl, { spaceAbove: 3, spaceBelow: 3 });
}

function followUp(text) {
  const r = ins('[BRUCE — FOLLOW UP]  ' + text + '\n\n');
  ts(r, { color: C.goldLight, fontSize: 11, italic: true });
  ps(r, { spaceAbove: 6, spaceBelow: 6 });
}

// ══════════════════════════════════════════════════════════════════════════════
// TITLE
// ══════════════════════════════════════════════════════════════════════════════
{ const t = ins('M3 PLATFORM DEPLOYMENT ROADMAP\n'); ts(t, { color: C.deepPurple, fontSize: 30, bold: true }); ps(t, { spaceAbove: 12, spaceBelow: 4 }); }
{ const s = ins('GYC  ·  STRATEGIC PLAN  ·  APRIL 30, 2026\n'); ts(s, { color: C.purple, fontSize: 13 }); ps(s, { spaceBelow: 20 }); }
divider();

// ══════════════════════════════════════════════════════════════════════════════
// INTRODUCTION
// ══════════════════════════════════════════════════════════════════════════════
sectionLabel('INTRODUCTION');
exposition('This document is a direct record of the M3 platform strategy as described by Bruce Spurr in the GYC Leadership Meeting on April 30, 2026. It captures decisions made, priorities set, and actions assigned — drawn from Bruce\'s words without interpretation or embellishment. Where additional clarity is needed, sections are flagged [BRUCE — FOLLOW UP] for his review.');
divider();

// ══════════════════════════════════════════════════════════════════════════════
// EXECUTIVE SUMMARY — BOXED PULL QUOTES
// ══════════════════════════════════════════════════════════════════════════════
sectionLabel('EXECUTIVE SUMMARY — IN BRUCE\'S WORDS');
exposition('Bruce opened the leadership meeting with a clear articulation of M3\'s purpose. Three themes frame everything that follows.');

pullQuote('The primary focus right now is to enhance the relationship with the clients... supporting the idea of pushing down accountability to our clients... this is a partnership, and what it means is that there\'s shit you have to get done.', 'Bruce Spurr');

pullQuote('Over the next 3 months, the goal is to try and automate as much of what Blueprint does as possible... bring the time down from 3 to 5 hours a week for clients, down to 1 or 2 hours, where it\'s just the stuff we cannot automate.', 'Bruce Spurr');

pullQuote('The goal is to have an owner dial into M3 once a week, and their staff to be in M3 multiple times a week.', 'Bruce Spurr');
divider();

// ══════════════════════════════════════════════════════════════════════════════
// ROADMAP OVERVIEW
// ══════════════════════════════════════════════════════════════════════════════
sectionLabel('ROADMAP AT A GLANCE');
exposition('Five phases spanning from today through mid-2027. The first two phases are the highest priority and already underway. Phases 3 and beyond are planned and will be sequenced based on dev capacity and strategic readiness.');
ins('\n');

const phaseRows = [
  ['PHASE 1', 'Client Relationship Platform', 'Now → July 2026', '🔴 In Progress', 'Hakeem + Devs'],
  ['PHASE 1.5', 'Sales Intelligence Tool', 'May → July 2026', '🟡 Scoping', 'Todd + Zach'],
  ['PHASE 2', 'Franchise View', 'July → Nov 2026', '⚪ Planned', 'Hakeem'],
  ['PHASE 3', 'Billing + Internal Tooling', 'Fall 2026', '⚪ Planned', 'Hakeem'],
  ['PHASE 4+', 'Art Automation + SaaS Exit', '2027', '⚪ Future', 'Bruce + Zach'],
];
for (const [ph, focus, timeline, status, owner] of phaseRows) {
  const pl = ins(ph + '  '); ts(pl, { color: C.deepPurple, fontSize: 12, bold: true });
  const fl = ins(focus + '\n'); ts(fl, { color: C.black, fontSize: 12 });
  const dl = ins(`   ${timeline}   ·   ${status}   ·   Owner: ${owner}\n\n`); ts(dl, { color: C.lightGray, fontSize: 10.5 });
}
divider();

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 1
// ══════════════════════════════════════════════════════════════════════════════
phaseHeader('PHASE 1 — CLIENT RELATIONSHIP PLATFORM', 'Now → July 2026   ·   Owner: Hakeem + Dev Team   ·   Status: In Progress');

exposition('The foundational layer of M3. Bruce described this phase as building the infrastructure for GYC to proactively manage client health at scale — automated flagging, consolidated data, and a system that brings clients back to the platform repeatedly. The goal is not just visibility, but habitual engagement.');

bullet('Automated account health flagging', 'When CRM data, ad performance, or SEO metrics drop below threshold, GAs are alerted before the next client call — proactive accountability, not reactive discovery.');
bullet('Insights engine', 'The platform continuously monitors data from all sources and surfaces meaningful changes. Underperforming accounts rise to the top without anyone having to dig for them.');
bullet('Swiss\'s manual data entry UI', 'For IKS and Playground clients who cannot be API-connected, Swiss manually enters monthly funnel data. The new interface is row-by-row with completeness checks and alerts if data is missing by the 10th of the month.');
bullet('Proactive client push notifications', 'Automated email and text messages drive clients back to M3 with specific, compelling hooks — new reviews received, lead flow changes, competitive rank updates. The goal is habit formation.');
bullet('Full marketing data consolidation', 'Meta, Google Ads, Google Analytics, CRM, GBP, and SEO data all feed into one dashboard. GAs have the complete picture before every client conversation.');

// Client compliance quote — a core design principle revealed here
inlineQuote('If we can create a customized version that\'s completely hands-free, that moves the needle... from an hour down to 2 minutes of photodumping — fuck, now we got something.', 'Bruce Spurr');
exposition('This is a design principle, not just a feature goal. Bruce was explicit throughout the meeting: clients do not do what you ask them to do. They don\'t post content, don\'t send photos, don\'t fill in templates. Every automation decision in M3 is built around this reality — remove the client from the equation wherever possible.');

ins('\n');
factRow('Engagement Target', 'Owner in M3 weekly — staff in M3 multiple times per week');
factRow('GA Ratio Target', '100:1 clients per Growth Advisor (higher for web-only, lower for ads/SEO)');
factRow('Blueprint Automation Target', '3–5 hours/week → 1–2 hours/week within 3 months');
divider();

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 1.5
// ══════════════════════════════════════════════════════════════════════════════
phaseHeader('PHASE 1.5 — SALES INTELLIGENCE TOOL', 'May → July 2026   ·   Owner: Todd + Zach   ·   Status: Scoping');

exposition('A sales-facing layer that transforms the platform into a prospect intelligence tool. Bruce described this as requiring minimal data entry — just an address, a GBP link, and a website URL — to generate a full audit for the GA before their first meeting. This is about showing up to a conversation with evidence, not assumptions.');

bullet('Instant prospect report', 'Enter a center\'s address, GBP link, and website URL — M3 generates a comprehensive readiness scorecard covering GBP health, website quality, and competitive ranking.');
bullet('Falcon Report heat map', 'The local search heat map is surfaced directly in the sales conversation to show the prospect exactly where they rank and where the gaps are.');
bullet('No heavy data entry required', 'The sales tool is designed for minimum friction. A GA should be able to generate a full prospect brief in under two minutes with publicly available information.');

ins('\n');
factRow('Input Required', 'Address, GBP link, website URL');
factRow('Output', 'Prospect score, heat map, competitive gaps');
factRow('Strategic Purpose', 'Walk into any prospect meeting with a data-backed audit');
divider();

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 2
// ══════════════════════════════════════════════════════════════════════════════
phaseHeader('PHASE 2 — FRANCHISE VIEW', 'July → November 2026   ·   Owner: Hakeem   ·   Status: Planned');

exposition('Once the client-facing platform is solid and GYC has demonstrable results with franchise clients, M3 opens up a franchise-level dashboard. This mirrors what GAs see — but at the corporate/ownership level for multi-location operators. Bruce identified this as the gateway to a fundamentally different revenue tier for GYC.');

bullet('Portfolio dashboard', 'Franchise owners see all their locations aggregated in one view — performance, health scores, lead flow, and flags — without needing to log into each location individually.');
bullet('Multi-dimensional filtering', 'Filter and compare by region, performance tier, service type, or individual location. Corporate clients can benchmark across their network.');
bullet('Automated insights', 'The same flagging and insight system that GAs use is surfaced for franchise owners — underperforming locations rise to the top automatically.');
bullet('Franchise pitch timeline', 'First presentations to Primrose and Goddard corporate are targeted for September–November 2026, following a summer of building strong results with these clients.');

ins('\n');
factRow('Primary Targets', 'Primrose, Goddard (and one additional franchise recently signed — name TBD)');
factRow('Revenue Potential', '$50,000–$150,000/month per franchise (300+ locations)');
factRow('Pitch Timeline', 'September–November 2026');

// Primrose callout
calloutBox('⚠️  PRIMROSE OPPORTUNITY\n\nPrimrose Childcare has been operating for over 50 years and has no CRM. Their website is — in Bruce\'s words — "10 years behind the fucking curve," and their SEO is declining as Google reduces the weight it gives to domain longevity. Bruce: "We are a definitive rescue path."\n\nA successful M3 demo, backed by proven results from Primrose franchise locations, positions GYC as the only credible solution. If Primrose goes to tender, Bruce believes no competitor can match our ability to deliver visibility, accountability, and integrated marketing at scale.');
followUp('How active is the Primrose corporate conversation? Do we have a specific contact name and a target date for the first executive presentation?');
divider();

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 3
// ══════════════════════════════════════════════════════════════════════════════
phaseHeader('PHASE 3 — INTERNAL TOOLING CONSOLIDATION', 'Fall 2026   ·   Owner: Hakeem   ·   Status: Planned');

exposition('With the client-facing platform mature and franchise conversations underway, Phase 3 turns inward. Bruce outlined a specific order of operations for replacing GYC\'s most expensive and fragmented operational tools with M3-native equivalents. The end state: a sale happens → M3 automatically triggers onboarding, billing, task assignment, and client communication with minimal human intervention.');

{ const lbl = ins('BILLING  (first priority)\n'); ts(lbl, { color: C.purple, fontSize: 13, bold: true }); ps(lbl, { spaceAbove: 12 }); }
bullet('Stripe stays as the payment processor', 'Stripe\'s API handles the transaction. M3 manages what gets billed, how often, subscriptions, one-time charges, and confirmations. Clients never interact with Stripe directly.');
bullet('Replace PandaDocs', 'The salesperson selects services in M3, the system assembles the contract from a database of MSA and scope-of-work items, the client signs via web interface, and billing + onboarding trigger automatically.');
bullet('One-click upsells', '"Want us to do your next email? Add it for $2.99/month." Billing enablement turns every conversation into an easy-button purchase. No proposal, no follow-up, no admin chain.');

{ const lbl = ins('\nASANA REPLACEMENT  (second priority)\n'); ts(lbl, { color: C.purple, fontSize: 13, bold: true }); ps(lbl, { spaceAbove: 12 }); }
exposition('Asana is currently one of GYC\'s most expensive software costs. Today, onboarding is manually triggered by Travis in GHL and offboarding is initiated by a GA in Asana. Once billing is in M3, these triggers become automatic. All onboarding and offboarding flows migrate to M3\'s internal task system.');
bullet('Internal task management in M3', 'Every GYC team member — GAs, production, CRM, billing — accesses their work through M3 rather than Asana. Tasks are assigned, tracked, and completed inside the platform.');
bullet('Migration of existing flows', 'All onboarding and offboarding logic built in Asana must be rebuilt in M3. Existing templates and trigger conditions are preserved, not rebuilt from scratch.');

{ const lbl = ins('\nZENDESK REPLACEMENT  (third priority)\n'); ts(lbl, { color: C.purple, fontSize: 13, bold: true }); ps(lbl, { spaceAbove: 12 }); }
exposition('Zendesk is essentially a task management system connected to client communications. Replacing it means M3 becomes the single portal for all client support — email, text, phone, and in-app tickets. This requires a Google Suite API integration to route inbound client emails into M3.');
bullet('Omnichannel client comms', 'Clients can email, text, call, or open a ticket directly in M3. All channels route to the same queue inside the platform.');
bullet('One-click ticket creation', 'When a client contacts GYC outside of M3, internal team members can convert any message into a ticket with one click and assign it immediately.');
followUp('What is GYC\'s current monthly spend on Asana and Zendesk combined? This will help quantify the cost elimination opportunity for this phase.');
divider();

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 4
// ══════════════════════════════════════════════════════════════════════════════
phaseHeader('PHASE 4+ — ART AUTOMATION + SAAS EXIT', '2027   ·   Owner: Bruce + Zach (Skunkworks)   ·   Status: Future');

exposition('This phase represents both the completion of M3\'s content automation capabilities and the strategic decision point for GYC\'s long-term identity. If the Skunkworks projects deliver, M3 will be capable of producing fully customized marketing content — social posts, email campaigns, and video ads — with minimal client effort. At that point, a SaaS exit becomes viable.');

bullet('Image selector → automated social pipeline', 'Clients dump photos weekly. M3 tags, captions, and cleans them. Meta API schedules and posts. Client reviews and approves — or lets it run automatically. Bruce estimates this is "not a huge lift" given the image selection foundation already exists.');
bullet('Email customizer', 'Customized campaigns are auto-drafted directly into GHL via API. Clients review in-draft, hit schedule, and it\'s done. The 6-person fulfillment chain collapses to one step.');
bullet('CDance video ads', 'Client uploads photos of owner, staff, kids, and classrooms. AI generates fully customized video ads using those likenesses — no actors, no filming, one-time setup, reusable indefinitely. Currently being tested with Ronnie from CTI (consent secured).');
bullet('M3 as SaaS', 'Once the platform is feature-complete, GYC makes a strategic decision: expand to other verticals, sell the agency at a revenue multiple, or both. The agency sale generates the exit; M3 retains licensing revenue from every spun-up operation thereafter.');

// "High tech + high touch" — the strategic thesis, placed here where automation peaks
inlineQuote('Things are definitely in line there, and I think it\'s fun in that happy balance between the high-tech and the high touch — if we can really nail that, we\'re just gonna hit it out of the park.', 'Jesse Poirier');
exposition('Bruce endorsed this framing immediately. The full content automation vision — CDance video, hands-free social, AI email — is not about removing the human element. It\'s about removing the friction so that the human element (the relationship between GA and client) can do its real job.');

ins('\n');
factRow('SaaS Exit Signal', 'Agency at $500K/month run rate (~$6M ARR)');
factRow('Buyer Appeal', 'Steepening month-over-month growth trajectory — VCs and PE firms want "up and to the right"');
factRow('Decision Point', 'Mid-2027, beginning or midway through the year');
factRow('Licensing Model', 'Sell the agency; M3 continues collecting licensing fees — "double-dipping"');
divider();

// ══════════════════════════════════════════════════════════════════════════════
// DEV GOVERNANCE
// ══════════════════════════════════════════════════════════════════════════════
sectionLabel('M3 DEV PROCESS — HOW FEATURES ENTER THE ROADMAP');
exposition('Hakeem owns the master roadmap and raised a concern about the risk of returning to the pre-Hakeem era — ideas thrown at the wall, nothing fully shipped. Bruce clarified the process in this meeting. All prototypes from Todd, Casey/Kaci, Lopez, or anyone outside the core dev team (Aditya + Anom) follow this four-step process before entering any sprint.');

const steps = [
  ['① BUILD', 'Create a functioning prototype with live data. It must be demo-able and clickable — not a mockup, not a description.'],
  ['② DOCUMENT', 'Provide: data sources, processing logic, edge cases (null data, division by zero, empty states), any third-party APIs used plus their cost, and access control requirements (who sees this data?).'],
  ['③ SUBMIT', 'Hand off to Hakeem. He reviews with clarifying questions, estimates dev time with Aditya and Anom, and prepares it for the roadmap meeting.'],
  ['④ SCHEDULE', 'Bruce, Hakeem, and Zach meet every two weeks to review the roadmap. Features are slotted into upcoming sprints based on strategic priority and dev capacity. A feature being built does not guarantee it gets slotted next.'],
];
for (const [lbl, body] of steps) {
  const sl = ins(lbl + '  '); ts(sl, { color: C.purple, fontSize: 13, bold: true });
  const sb = ins(body + '\n\n'); ts(sb, { color: C.black, fontSize: 12 });
}

calloutBox('Roadmap structure: 6-week set-in-stone window, then extended 2 weeks at a time. Dev sprints are 2 weeks each. A feature that requires 2 full devs for 2 sprints (4 weeks total) may be delayed or split across one dev over a longer runway.');
followUp('What is currently in the active 6-week M3 sprint? This document describes the process and future priorities, but the current sprint contents are not documented here.');
divider();

// ══════════════════════════════════════════════════════════════════════════════
// IMMEDIATE ACTIONS
// ══════════════════════════════════════════════════════════════════════════════
sectionLabel('IMMEDIATE ACTIONS');
exposition('Five actions were either explicitly assigned in this meeting or are directly implied by the decisions made. These are not aspirational — they are blockers or prerequisites for what comes next.');

const actions = [
  ['1.', 'Complete GBP tab prototype', 'Todd said in this meeting: "I think it\'ll take me at least 2 weeks to get something relatively nice." The GBP tab is the first major M3 prototype deliverable. It needs to be demo-ready with live data.', 'Todd', 'Mid-May 2026'],
  ['2.', 'Deploy GYC Dashboard to external server', 'Bruce: "I think the main thing yours needs to do is live on an external server that\'s accessible by multiple people on the team." Currently at localhost only — the full GYC team cannot access it.', 'Todd + Wall·E', 'ASAP'],
  ['3.', 'LineLeader API key setup', 'Zu owns this. Lisa trains Zu at their existing Monday meeting. Hakeem trains Zu on the M3 side (a 2–3 minute Loom). ~40–70 clients, 5 minutes each = half day of work. M3 dashboard is already built — it just needs the keys.', 'Zu', 'This week'],
  ['4.', 'M3 handoff package for GBP tab', 'Per Bruce\'s dev process: the prototype must be accompanied by documentation covering data sources, processing logic, edge cases, and the cost of any third-party APIs used (DataForSEO for the GBP live data feature).', 'Todd', 'With prototype'],
  ['5.', 'Primrose/Goddard results push', 'Before any franchise pitch can happen, GYC needs a compelling success story with existing franchise clients. Bruce: "Get them to the next level... when we go to present to their boards in 3 or 4 months, we have some great results."', 'Bruce + GAs', 'Sept–Nov 2026 pitch'],
];
for (const [num, title, body, owner, timing] of actions) {
  const nl = ins(num + '  '); ts(nl, { color: C.purple, fontSize: 13, bold: true });
  const tl = ins(title + '\n'); ts(tl, { color: C.deepPurple, fontSize: 13, bold: true });
  const bd = ins(body + '\n'); ts(bd, { color: C.black, fontSize: 12 });
  const meta = ins(`Owner: ${owner}   ·   Timing: ${timing}\n\n`); ts(meta, { color: C.lightGray, fontSize: 10.5 });
}
divider();

// ══════════════════════════════════════════════════════════════════════════════
// FOLLOW-UP QUESTIONS
// ══════════════════════════════════════════════════════════════════════════════
sectionLabel('NOTES & OPEN QUESTIONS');
exposition('Context and clarifications added after the meeting, plus one open item flagged for Bruce.');

// Q1 ANSWERED — Sprint info from Skunkworks meeting Apr 28
{ const ql = ins('CURRENT M3 SPRINT  '); ts(ql, { color: C.purple, fontSize: 12, bold: true }); }
{ const qt = ins('Sprint 3 — April 29 to May 12, 2026\n'); ts(qt, { color: C.black, fontSize: 12, bold: true }); }
{ const qb = ins('Sprint 3 is focused on: AI prompt optimizations for UI/UX Analysis and Competitive Analysis output quality; Task Simplification refinements aligned with Nicky\'s Skool task format (blocked on Nicky documenting her standard); and Funnel System — Excel import/export and UI refinements. The V2.0 gate (Workspace Migration, Backend Reporting, UI/UX Overhaul, Homepage, QA pass) was due April 1 and remains in progress — all five gate items must ship to prod before V2.0 launches.\n\n'); ts(qb, { color: C.black, fontSize: 12 }); }

// Q3 ANSWERED — LineLeader API
{ const ql = ins('LINELEADER API KEY CAPTURE  '); ts(ql, { color: C.purple, fontSize: 12, bold: true }); }
{ const qt = ins('Owner: Todd + Zu\n'); ts(qt, { color: C.black, fontSize: 12, bold: true }); }
{ const qb = ins('Todd and Zu are coordinating the capture of LineLeader API keys for all applicable clients. Zu will train with Lisa (Line Leader contact) at their existing Monday meeting. Hakeem will train Zu on the M3 side. ~40–70 clients, ~5 minutes each. Added to Todd\'s to-do list.\n\n'); ts(qb, { color: C.black, fontSize: 12 }); }

// Q4 ANSWERED — Swiss identity
{ const ql = ins('WHO IS SWISS?  '); ts(ql, { color: C.purple, fontSize: 12, bold: true }); }
{ const qt = ins('GYC Staff — reports to Zu\n'); ts(qt, { color: C.black, fontSize: 12, bold: true }); }
{ const qb = ins('Swiss is a GYC team member working under Zu. Responsibilities include: running client newsletters, IKS and LineLeader customizations, and pulling IKS and LineLeader data for the Lead Data Sheets. Swiss is the right person to own the manual CRM data entry UI once it\'s built in M3.\n\n'); ts(qb, { color: C.black, fontSize: 12 }); }

// Q6 STILL OPEN
{ const ql = ins('[BRUCE — FOLLOW UP]  '); ts(ql, { color: C.gold, fontSize: 12, bold: true }); }
{ const qt = ins('Phase 1 → Phase 2 Prerequisite\n'); ts(qt, { color: C.goldLight, fontSize: 12, bold: true }); }
{ const qb = ins('What specifically needs to be complete in Phase 1 (CX framework) before Phase 2 franchise view work can begin in July? Is there a defined handoff criterion or milestone that triggers the transition?\n\n'); ts(qb, { color: C.black, fontSize: 12 }); }
divider();

// FOOTER
{ const ft = ins('Prepared by Wall·E for GYC Leadership   ·   April 30, 2026   ·   Confidential — Internal Use Only\n'); ts(ft, { color: C.lightGray, fontSize: 9.5, italic: true }); ps(ft, { spaceAbove: 16 }); }

// ══════════════════════════════════════════════════════════════════════════════
// APPLY ALL
// ══════════════════════════════════════════════════════════════════════════════
console.log(`Inserting ${reqs.length} blocks...`);
await docs.documents.batchUpdate({ documentId: DOC_ID, requestBody: { requests: reqs } });
console.log('✅ Text inserted');

// Build formatting requests
const fmtReqs = [];
for (const seg of fmts) {
  if (seg.type === 'ts') {
    const tStyle = {};
    const fields = [];
    if (seg.bold !== undefined) { tStyle.bold = seg.bold; fields.push('bold'); }
    if (seg.italic !== undefined) { tStyle.italic = seg.italic; fields.push('italic'); }
    if (seg.fontSize !== undefined) { tStyle.fontSize = { magnitude: seg.fontSize, unit: 'PT' }; fields.push('fontSize'); }
    if (seg.color !== undefined) { tStyle.foregroundColor = { color: { rgbColor: seg.color } }; fields.push('foregroundColor'); }
    if (fields.length) fmtReqs.push({ updateTextStyle: { range: { startIndex: seg.s, endIndex: seg.e }, textStyle: tStyle, fields: fields.join(',') }});
  } else if (seg.type === 'ps') {
    const pStyle = {};
    const fields = [];
    if (seg.spaceAbove !== undefined) { pStyle.spaceAbove = { magnitude: seg.spaceAbove, unit: 'PT' }; fields.push('spaceAbove'); }
    if (seg.spaceBelow !== undefined) { pStyle.spaceBelow = { magnitude: seg.spaceBelow, unit: 'PT' }; fields.push('spaceBelow'); }
    if (seg.indentStart !== undefined) { pStyle.indentStart = { magnitude: seg.indentStart, unit: 'PT' }; fields.push('indentStart'); }
    if (seg.indentEnd !== undefined) { pStyle.indentEnd = { magnitude: seg.indentEnd, unit: 'PT' }; fields.push('indentEnd'); }
    if (seg.shading !== undefined) { pStyle.shading = { backgroundColor: { color: { rgbColor: seg.shading.color } } }; fields.push('shading'); }
    // Borders
    const mkBorder = (c, width=1.5) => c ? { color: { color: { rgbColor: c } }, width: { magnitude: width, unit: 'PT' }, dashStyle: 'SOLID', padding: { magnitude: 6, unit: 'PT' } } : null;
    if (seg.borderTop !== undefined) { const b = mkBorder(seg.borderTop); if (b) { pStyle.borderTop = b; fields.push('borderTop'); } }
    if (seg.borderBottom !== undefined) { const b = mkBorder(seg.borderBottom); if (b) { pStyle.borderBottom = b; fields.push('borderBottom'); } }
    if (seg.borderLeft !== undefined) { const b = mkBorder(seg.borderLeft, seg.shading ? 1.5 : 3); if (b) { pStyle.borderLeft = b; fields.push('borderLeft'); } }
    if (seg.borderRight !== undefined) { const b = mkBorder(seg.borderRight); if (b) { pStyle.borderRight = b; fields.push('borderRight'); } }
    if (fields.length) fmtReqs.push({ updateParagraphStyle: { range: { startIndex: seg.s, endIndex: seg.e }, paragraphStyle: pStyle, fields: fields.join(',') }});
  }
}

// Apply in chunks
for (let i = 0; i < fmtReqs.length; i += 100) {
  await docs.documents.batchUpdate({ documentId: DOC_ID, requestBody: { requests: fmtReqs.slice(i, i + 100) } });
  process.stdout.write('.');
}
console.log(`\n✅ Document complete`);
console.log(`📄 https://docs.google.com/document/d/${DOC_ID}/edit`);
