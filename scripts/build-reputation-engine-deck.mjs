/**
 * Build Reputation Engine™ Team Briefing deck
 * GYC Brand — Deep Purple / Black / Gold / Avenir
 * Target: 1KiRIpTqh8SLNDDVG0FV33HUT0nZpqqICB-fcXp8ybOg
 */

import { google } from 'googleapis';

const PRESENTATION_ID = '1KiRIpTqh8SLNDDVG0FV33HUT0nZpqqICB-fcXp8ybOg';

// ─── GYC Brand Colors ────────────────────────────────────────────────────────
const DEEP_PURPLE  = { red: 0.200, green: 0.043, blue: 0.404 }; // #340B67
const PURPLE       = { red: 0.451, green: 0.078, blue: 0.580 }; // #731494
const VIOLET       = { red: 0.451, green: 0.184, blue: 0.729 }; // #732FBA
const BRIGHT_VIO   = { red: 0.682, green: 0.169, blue: 0.812 }; // #AE2BCF
const GOLD         = { red: 0.757, green: 0.612, blue: 0.275 }; // #C19C46
const BLACK        = { red: 0.05,  green: 0.05,  blue: 0.05  }; // ~#0D0D0D
const OFF_WHITE    = { red: 0.961, green: 0.961, blue: 0.961 }; // #F5F5F5
const GRAY         = { red: 0.612, green: 0.639, blue: 0.686 }; // #9CA3AF
const WHITE        = { red: 1,     green: 1,     blue: 1     };

// Slide dimensions — standard 16:9
const W = 9144000;
const H = 5143500;

const auth = new google.auth.GoogleAuth({
  keyFile: '/Users/toddthejedigmail.com/.openclaw/workspace/google-service-account.json',
  scopes: [
    'https://www.googleapis.com/auth/presentations',
    'https://www.googleapis.com/auth/drive',
  ],
});
const slidesApi = google.slides({ version: 'v1', auth });

// ─── Core helpers ─────────────────────────────────────────────────────────────

const rgb  = c => ({ rgbColor: c });
const oc   = c => ({ opaqueColor: rgb(c) });
const fs   = pt => ({ magnitude: pt, unit: 'PT' });
const emu  = n  => ({ magnitude: n, unit: 'EMU' });

function size(w, h)    { return { width: emu(w), height: emu(h) }; }
function pos(x, y)     { return { scaleX:1, scaleY:1, translateX:x, translateY:y, unit:'EMU' }; }
function elProps(pid, x, y, w, h) {
  return { pageObjectId: pid, size: size(w, h), transform: pos(x, y) };
}

function bgReq(pageId, color) {
  return {
    updatePageProperties: {
      objectId: pageId,
      pageProperties: { pageBackgroundFill: { solidFill: { color: rgb(color) } } },
      fields: 'pageBackgroundFill',
    },
  };
}

function addRect(id, pid, x, y, w, h) {
  return { createShape: { objectId: id, shapeType: 'RECTANGLE', elementProperties: elProps(pid,x,y,w,h) } };
}
function addTB(id, pid, x, y, w, h) {
  return { createShape: { objectId: id, shapeType: 'TEXT_BOX', elementProperties: elProps(pid,x,y,w,h) } };
}
function fillShape(id, color) {
  return {
    updateShapeProperties: {
      objectId: id,
      shapeProperties: { shapeBackgroundFill: { solidFill: { color: rgb(color) } } },
      fields: 'shapeBackgroundFill',
    },
  };
}
function noOutline(id) {
  return {
    updateShapeProperties: {
      objectId: id,
      shapeProperties: { outline: { propertyState: 'NOT_RENDERED' } },
      fields: 'outline',
    },
  };
}
function setText(id, text) { return { insertText: { objectId: id, text } }; }
function styleText(id, color, sizePt, bold=false, italic=false) {
  const style = {
    foregroundColor: oc(color),
    fontSize: fs(sizePt),
    bold,
    italic,
    fontFamily: 'Nunito Sans',
  };
  return {
    updateTextStyle: {
      objectId: id, style,
      fields: 'foregroundColor,fontSize,bold,italic,fontFamily',
      textRange: { type: 'ALL' },
    },
  };
}
const ALIGN_MAP = { 'CENTER': 'CENTER', 'LEFT': 'START', 'RIGHT': 'END', 'START': 'START', 'END': 'END' };
function align(id, a='CENTER') {
  return {
    updateParagraphStyle: {
      objectId: id,
      style: { alignment: ALIGN_MAP[a] || a },
      fields: 'alignment',
    },
  };
}
function lineSpacing(id, spacing=115) {
  return {
    updateParagraphStyle: {
      objectId: id,
      style: { lineSpacing: spacing, spaceAbove: fs(0), spaceBelow: fs(2) },
      fields: 'lineSpacing,spaceAbove,spaceBelow',
    },
  };
}

// ─── batch helpers ────────────────────────────────────────────────────────────

async function batch(requests) {
  if (!requests.length) return;
  await slidesApi.presentations.batchUpdate({
    presentationId: PRESENTATION_ID,
    requestBody: { requests },
  });
}

// ─── gold divider line ────────────────────────────────────────────────────────
function goldBar(id, pid, x, y, w, h=18000) {
  return [
    addRect(id, pid, x, y, w, h),
    fillShape(id, GOLD),
    noOutline(id),
  ];
}

// ─── label + value block ──────────────────────────────────────────────────────
function labelBlock(pid, suffix, x, y, w, label, value, valSize=13) {
  const lid = `${pid}_lbl_${suffix}`;
  const vid = `${pid}_val_${suffix}`;
  return [
    addTB(lid, pid, x, y, w, 260000),
    setText(lid, label),
    styleText(lid, GOLD, 10, true),
    align(lid, 'LEFT'),
    addTB(vid, pid, x, y + 240000, w, 380000),
    setText(vid, value),
    styleText(vid, OFF_WHITE, valSize, false),
    align(vid, 'LEFT'),
    lineSpacing(vid, 120),
  ];
}

// ─── section header ───────────────────────────────────────────────────────────
function sectionHead(pid, suffix, x, y, w, text) {
  const bid = `${pid}_sh_${suffix}`;
  return [
    addTB(bid, pid, x, y, w, 260000),
    setText(bid, text.toUpperCase()),
    styleText(bid, GOLD, 11, true),
    align(bid, 'LEFT'),
    lineSpacing(bid, 100),
  ];
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Clear existing slides
  const pres = await slidesApi.presentations.get({ presentationId: PRESENTATION_ID });
  const existing = pres.data.slides || [];
  console.log(`Deleting ${existing.length} existing slides...`);
  if (existing.length) {
    await batch(existing.map(s => ({ deleteObject: { objectId: s.objectId } })));
  }

  // Create 10 blank slides
  const ids = [];
  for (let i = 0; i < 10; i++) {
    const id = `sl${i+1}_${Date.now()}_${i}`;
    ids.push(id);
    await batch([{ createSlide: { objectId: id, slideLayoutReference: { predefinedLayout: 'BLANK' } } }]);
  }
  console.log('10 slides created');

  await s1(ids[0]);  console.log('Slide 1 ✓');
  await s2(ids[1]);  console.log('Slide 2 ✓');
  await s3(ids[2]);  console.log('Slide 3 ✓');
  await s4(ids[3]);  console.log('Slide 4 ✓');
  await s5(ids[4]);  console.log('Slide 5 ✓');
  await s6(ids[5]);  console.log('Slide 6 ✓');
  await s7(ids[6]);  console.log('Slide 7 ✓');
  await s8(ids[7]);  console.log('Slide 8 ✓');
  await s9(ids[8]);  console.log('Slide 9 ✓');
  await s10(ids[9]); console.log('Slide 10 ✓');

  console.log('\n✅ Done!');
  console.log(`https://docs.google.com/presentation/d/${PRESENTATION_ID}/edit`);
}

// ══════════════════════════════════════════════════════════════════════════════
//  SLIDE 1 — Cover
// ══════════════════════════════════════════════════════════════════════════════
async function s1(pid) {
  const eyebrow = `${pid}_eye`;
  const title   = `${pid}_title`;
  const sub     = `${pid}_sub`;
  const foot    = `${pid}_foot`;
  const leftBar = `${pid}_lbar`;
  const topBar  = `${pid}_tbar`;

  await batch([
    bgReq(pid, BLACK),
    // Left purple gradient band
    addRect(leftBar, pid, 0, 0, 228600, H),
    fillShape(leftBar, DEEP_PURPLE),
    noOutline(leftBar),
    // Top gold rule
    ...goldBar(`${pid}_gr1`, pid, 457200, 685800, W - 914400),
    // Bottom gold rule
    ...goldBar(`${pid}_gr2`, pid, 457200, H - 700000, W - 914400),
    // Eyebrow tag
    addTB(eyebrow, pid, 457200, 800000, W - 914400, 300000),
    setText(eyebrow, 'GYC INTERNAL — TEAM BRIEFING'),
    styleText(eyebrow, GOLD, 12, true),
    align(eyebrow, 'LEFT'),
    // Main title
    addTB(title, pid, 457200, 1200000, W - 914400, 1500000),
    setText(title, 'The Reputation Engine™'),
    styleText(title, WHITE, 54, true),
    align(title, 'LEFT'),
    // Subtitle
    addTB(sub, pid, 457200, 2800000, W - 914400, 600000),
    setText(sub, 'What We Sell · What We Promise · What We Deliver'),
    styleText(sub, GOLD, 20, false, true),
    align(sub, 'LEFT'),
    // Footer
    addTB(foot, pid, 457200, H - 650000, W - 914400, 280000),
    setText(foot, 'GYC Marketing LLC  ·  Confidential — Internal Use Only'),
    styleText(foot, GRAY, 11),
    align(foot, 'LEFT'),
  ]);
}

// ══════════════════════════════════════════════════════════════════════════════
//  SLIDE 2 — Why We Built This
// ══════════════════════════════════════════════════════════════════════════════
async function s2(pid) {
  const bullets = '→  Google Ads broke in 2025. Costs skyrocketed. The ads-only strategy stopped working for most clients.\n\n→  Gen Z and younger millennial parents trust reviews and authentic proof — not paid ads.\n\n→  Centers that stay full aren\'t spending more on ads. They\'ve built compounding trust assets.\n\n→  Our data from 850+ locations: centers with 100+ Google reviews see lower lead costs, more tours, better conversions.\n\n→  We can\'t keep selling a tool that depends entirely on ad spend. This is what lasts.';

  const callout = '"The centers that stay full have built a compounding set of trust assets that make them the obvious, safe choice in their community."';

  await batch([
    bgReq(pid, BLACK),
    ...goldBar(`${pid}_gr`, pid, 0, 820000, W, 12000),
    // Header band
    addRect(`${pid}_hband`, pid, 0, 0, W, 820000),
    fillShape(`${pid}_hband`, DEEP_PURPLE),
    noOutline(`${pid}_hband`),
    // Slide number
    addTB(`${pid}_num`, pid, W - 600000, 50000, 500000, 280000),
    setText(`${pid}_num`, '02'),
    styleText(`${pid}_num`, GOLD, 28, true),
    align(`${pid}_num`, 'RIGHT'),
    // Title
    addTB(`${pid}_title`, pid, 457200, 160000, W - 1100000, 500000),
    setText(`${pid}_title`, 'Why the Reputation Engine Exists'),
    styleText(`${pid}_title`, WHITE, 30, true),
    align(`${pid}_title`, 'LEFT'),
    // Bullets
    addTB(`${pid}_body`, pid, 457200, 900000, W * 0.58, 3000000),
    setText(`${pid}_body`, bullets),
    styleText(`${pid}_body`, OFF_WHITE, 14),
    align(`${pid}_body`, 'LEFT'),
    lineSpacing(`${pid}_body`, 130),
    // Callout box right
    addRect(`${pid}_callbg`, pid, W * 0.63, 900000, W * 0.35, 2500000),
    fillShape(`${pid}_callbg`, DEEP_PURPLE),
    noOutline(`${pid}_callbg`),
    ...goldBar(`${pid}_cbar`, pid, W * 0.63, 900000, 18000, 2500000),
    addTB(`${pid}_calltxt`, pid, W * 0.64, 1000000, W * 0.33, 2200000),
    setText(`${pid}_calltxt`, callout),
    styleText(`${pid}_calltxt`, GOLD, 15, false, true),
    align(`${pid}_calltxt`, 'LEFT'),
    lineSpacing(`${pid}_calltxt`, 140),
  ]);
}

// ══════════════════════════════════════════════════════════════════════════════
//  SLIDE 3 — What Is the Reputation Engine
// ══════════════════════════════════════════════════════════════════════════════
async function s3(pid) {
  const col1 = 'DONE FOR YOU\n\n›  Google reviews (100+ = the magic threshold)\n›  GBP ranking (top 3 = 70–75% of all childcare search)\n›  AI search visibility (ChatGPT, Google AI, Maps)\n›  Website optimized for mobile + AI search\n›  Meta video ads — authentic, not AI-slop\n›  [Growth] Email campaigns\n›  [Growth] Google LSA';

  const col2 = 'DONE WITH YOU\n\n›  Weekly Drops — playbook delivered in M3\n›  Google Reviews copy & paste system\n›  Warm Referrals copy & paste system\n›  Offer-builder + tour + sales training\n›  Guerrilla & grassroots marketing plays\n›  Local community partnership templates\n›  Email marketing templates + workshops';

  const stat = 'Maps = ~70–75% of how parents find a childcare center.\nRank on Maps → rank everywhere.';

  await batch([
    bgReq(pid, BLACK),
    addRect(`${pid}_hband`, pid, 0, 0, W, 820000),
    fillShape(`${pid}_hband`, PURPLE),
    noOutline(`${pid}_hband`),
    ...goldBar(`${pid}_gr`, pid, 0, 820000, W, 12000),
    addTB(`${pid}_num`, pid, W - 600000, 50000, 500000, 280000),
    setText(`${pid}_num`, '03'),
    styleText(`${pid}_num`, GOLD, 28, true),
    align(`${pid}_num`, 'RIGHT'),
    addTB(`${pid}_title`, pid, 457200, 160000, W - 1100000, 500000),
    setText(`${pid}_title`, 'The Reputation Engine — Big Picture'),
    styleText(`${pid}_title`, WHITE, 30, true),
    align(`${pid}_title`, 'LEFT'),
    // Intro
    addTB(`${pid}_intro`, pid, 457200, 880000, W - 914400, 340000),
    setText(`${pid}_intro`, 'A system that builds trust assets that compound over time. Unlike ads — which stop the moment you stop paying — trust assets keep working.'),
    styleText(`${pid}_intro`, GRAY, 14),
    align(`${pid}_intro`, 'LEFT'),
    // Col 1
    addRect(`${pid}_c1bg`, pid, 228600, 1320000, W * 0.465, 3100000),
    fillShape(`${pid}_c1bg`, DEEP_PURPLE),
    noOutline(`${pid}_c1bg`),
    ...goldBar(`${pid}_c1bar`, pid, 228600, 1320000, 18000, 3100000),
    addTB(`${pid}_c1`, pid, 342900, 1400000, W * 0.445, 3000000),
    setText(`${pid}_c1`, col1),
    styleText(`${pid}_c1`, OFF_WHITE, 13),
    align(`${pid}_c1`, 'LEFT'),
    lineSpacing(`${pid}_c1`, 140),
    // Col 2
    addRect(`${pid}_c2bg`, pid, W * 0.515, 1320000, W * 0.465, 3100000),
    fillShape(`${pid}_c2bg`, DEEP_PURPLE),
    noOutline(`${pid}_c2bg`),
    ...goldBar(`${pid}_c2bar`, pid, W * 0.515, 1320000, 18000, 3100000),
    addTB(`${pid}_c2`, pid, W * 0.525, 1400000, W * 0.445, 3000000),
    setText(`${pid}_c2`, col2),
    styleText(`${pid}_c2`, OFF_WHITE, 13),
    align(`${pid}_c2`, 'LEFT'),
    lineSpacing(`${pid}_c2`, 140),
    // Stat bar
    addRect(`${pid}_statbg`, pid, 228600, 4530000, W - 457200, 420000),
    fillShape(`${pid}_statbg`, VIOLET),
    noOutline(`${pid}_statbg`),
    addTB(`${pid}_stat`, pid, 342900, 4570000, W - 685800, 360000),
    setText(`${pid}_stat`, stat),
    styleText(`${pid}_stat`, WHITE, 13, true),
    align(`${pid}_stat`, 'CENTER'),
  ]);
}

// ══════════════════════════════════════════════════════════════════════════════
//  SLIDE 4 — Core vs Growth
// ══════════════════════════════════════════════════════════════════════════════
async function s4(pid) {
  const rows = [
    ['GBP optimization + management',         '✓','✓'],
    ['Website AI SEO buildout',                '✓','✓'],
    ['Local SEO + AI search visibility',       '✓','✓'],
    ['Local citations + listings',             '✓','✓'],
    ['Meta video ads (setup + managed)',        '✓','✓'],
    ['Monthly email campaigns (done for you)', '—','✓'],
    ['Google Local Service Ads (LSA)',          '—','✓'],
    ['9×9 heatmap ranking report',             '✓','✓'],
    ['Weekly Drops in M3',                     '✓','✓'],
    ['Review + Referral systems',              '✓','✓'],
    ['Tour + sales training',                  '✓','✓'],
    ['M3 PRO + Simple CRM',                    '✓','✓'],
    ['Quarterly 1-on-1 strategy calls',         '—','✓'],
    ['Support',              'Email','Priority'],
    ['Monthly price (CDN)',  '$2,024','$3,373'],
    ['Add\'l locations',     '+$405', '+$849'],
  ];

  const colW = W * 0.60;
  const coreW = W * 0.175;
  const growW = W * 0.175;
  const rowH = 228000;
  const startY = 1050000;

  const reqs = [
    bgReq(pid, BLACK),
    addRect(`${pid}_hband`, pid, 0, 0, W, 820000),
    fillShape(`${pid}_hband`, DEEP_PURPLE),
    noOutline(`${pid}_hband`),
    ...goldBar(`${pid}_gr`, pid, 0, 820000, W, 12000),
    addTB(`${pid}_num`, pid, W - 600000, 50000, 500000, 280000),
    setText(`${pid}_num`, '04'),
    styleText(`${pid}_num`, GOLD, 28, true),
    align(`${pid}_num`, 'RIGHT'),
    addTB(`${pid}_title`, pid, 457200, 160000, W - 1100000, 500000),
    setText(`${pid}_title`, 'Core vs Growth — What\'s the Difference?'),
    styleText(`${pid}_title`, WHITE, 30, true),
    align(`${pid}_title`, 'LEFT'),
    // Column header — CORE
    addRect(`${pid}_coreh`, pid, colW + 57000, 840000, coreW, 200000),
    fillShape(`${pid}_coreh`, VIOLET),
    noOutline(`${pid}_coreh`),
    addTB(`${pid}_coretxt`, pid, colW + 57000, 855000, coreW, 180000),
    setText(`${pid}_coretxt`, 'CORE'),
    styleText(`${pid}_coretxt`, WHITE, 14, true),
    align(`${pid}_coretxt`, 'CENTER'),
    // Column header — GROWTH
    addRect(`${pid}_growh`, pid, colW + coreW + 114000, 840000, growW, 200000),
    fillShape(`${pid}_growh`, BRIGHT_VIO),
    noOutline(`${pid}_growh`),
    addTB(`${pid}_growtxt`, pid, colW + coreW + 114000, 855000, growW, 180000),
    setText(`${pid}_growtxt`, 'GROWTH'),
    styleText(`${pid}_growtxt`, WHITE, 14, true),
    align(`${pid}_growtxt`, 'CENTER'),
  ];

  // Rows
  for (let i = 0; i < rows.length; i++) {
    const [feat, core, growth] = rows[i];
    const y = startY + i * rowH;
    const bg = i % 2 === 0 ? DEEP_PURPLE : { red:0.07, green:0.04, blue:0.12 };
    const isPricing = i >= 14;
    const featColor = isPricing ? GOLD : OFF_WHITE;

    reqs.push(
      addRect(`${pid}_row${i}`, pid, 57000, y, W - 114000, rowH - 9000),
      fillShape(`${pid}_row${i}`, bg),
      noOutline(`${pid}_row${i}`),
      addTB(`${pid}_feat${i}`, pid, 114000, y + 30000, colW - 100000, rowH - 60000),
      setText(`${pid}_feat${i}`, feat),
      styleText(`${pid}_feat${i}`, featColor, isPricing ? 12 : 12, isPricing),
      align(`${pid}_feat${i}`, 'LEFT'),
      addTB(`${pid}_core${i}`, pid, colW + 57000, y + 30000, coreW, rowH - 60000),
      setText(`${pid}_core${i}`, core),
      styleText(`${pid}_core${i}`, core === '✓' ? { red:0.5,green:1,blue:0.5 } : core === '—' ? GRAY : GOLD, 13, false),
      align(`${pid}_core${i}`, 'CENTER'),
      addTB(`${pid}_grow${i}`, pid, colW + coreW + 114000, y + 30000, growW, rowH - 60000),
      setText(`${pid}_grow${i}`, growth),
      styleText(`${pid}_grow${i}`, growth === '✓' ? { red:0.5,green:1,blue:0.5 } : growth === '—' ? GRAY : GOLD, 13, true),
      align(`${pid}_grow${i}`, 'CENTER'),
    );
  }

  reqs.push(
    addTB(`${pid}_note`, pid, 57000, H - 350000, W - 114000, 300000),
    setText(`${pid}_note`, 'Core = light-to-medium competition, team has execution capacity.  ·  Growth = heavier competition or center wants GYC carrying more of the load.  ·  Pay-in-full = locked-for-life rate.'),
    styleText(`${pid}_note`, GRAY, 10, false, true),
    align(`${pid}_note`, 'CENTER'),
  );

  await batch(reqs);
}

// ══════════════════════════════════════════════════════════════════════════════
//  SLIDE 5 — What GYC Delivers
// ══════════════════════════════════════════════════════════════════════════════
async function s5(pid) {
  const col1 = 'TECHNICAL & CREATIVE — DONE FOR YOU\n\n›  GBP optimization + ongoing management\n›  Website AI SEO buildout + optimization\n›  Local SEO + AI search visibility\n    (Maps, ChatGPT, Google AI)\n›  Local citations + listings cleanup\n›  Meta video ads — set up and managed\n›  [Growth] Email campaigns — done for you\n›  [Growth] Google LSA — set up + managed\n›  Monthly 9×9 heatmap ranking report\n\n⚠  WEBSITE NOTE\nIf GYC manages the website → changes implemented directly.\nIf not → GYC delivers content + instructions;\nclient\'s team or web developer implements.';

  const col2 = 'PLAYBOOK — DONE WITH YOU\n\n›  Weekly Drops via M3\n›  Google Reviews copy & paste system\n›  Warm Referrals copy & paste system\n›  Offer-builder + tour + sales training\n›  Guerrilla/grassroots templates + training\n›  Local partnership templates + training\n›  Email marketing templates\n›  Live workshops\n\nPLATFORM + SUPPORT\n\n›  M3 PRO platform + Simple CRM\n›  Community access\n›  Weekly open office hours\n›  [Growth] Quarterly 1-on-1 strategy calls';

  await batch([
    bgReq(pid, BLACK),
    addRect(`${pid}_hband`, pid, 0, 0, W, 820000),
    fillShape(`${pid}_hband`, DEEP_PURPLE),
    noOutline(`${pid}_hband`),
    ...goldBar(`${pid}_gr`, pid, 0, 820000, W, 12000),
    addTB(`${pid}_num`, pid, W - 600000, 50000, 500000, 280000),
    setText(`${pid}_num`, '05'),
    styleText(`${pid}_num`, GOLD, 28, true),
    align(`${pid}_num`, 'RIGHT'),
    addTB(`${pid}_title`, pid, 457200, 120000, W - 1100000, 440000),
    setText(`${pid}_title`, 'Our Side of the Contract — What GYC Delivers'),
    styleText(`${pid}_title`, WHITE, 28, true),
    align(`${pid}_title`, 'LEFT'),
    addTB(`${pid}_sub`, pid, 457200, 580000, W - 914400, 240000),
    setText(`${pid}_sub`, 'This is what the signed agreement commits us to'),
    styleText(`${pid}_sub`, GOLD, 13, false, true),
    align(`${pid}_sub`, 'LEFT'),
    // Col 1
    addRect(`${pid}_c1bg`, pid, 57000, 900000, W * 0.47, 3900000),
    fillShape(`${pid}_c1bg`, DEEP_PURPLE),
    noOutline(`${pid}_c1bg`),
    ...goldBar(`${pid}_c1b`, pid, 57000, 900000, 18000, 3900000),
    addTB(`${pid}_c1`, pid, 171000, 960000, W * 0.45, 3800000),
    setText(`${pid}_c1`, col1),
    styleText(`${pid}_c1`, OFF_WHITE, 12),
    align(`${pid}_c1`, 'LEFT'),
    lineSpacing(`${pid}_c1`, 130),
    // Col 2
    addRect(`${pid}_c2bg`, pid, W * 0.51, 900000, W * 0.47, 3900000),
    fillShape(`${pid}_c2bg`, DEEP_PURPLE),
    noOutline(`${pid}_c2bg`),
    ...goldBar(`${pid}_c2b`, pid, W * 0.51, 900000, 18000, 3900000),
    addTB(`${pid}_c2`, pid, W * 0.52, 960000, W * 0.45, 3800000),
    setText(`${pid}_c2`, col2),
    styleText(`${pid}_c2`, OFF_WHITE, 12),
    align(`${pid}_c2`, 'LEFT'),
    lineSpacing(`${pid}_c2`, 130),
    // Callout
    addRect(`${pid}_callbg`, pid, 57000, 4920000, W - 114000, 160000),
    fillShape(`${pid}_callbg`, VIOLET),
    noOutline(`${pid}_callbg`),
    addTB(`${pid}_calltxt`, pid, 171000, 4935000, W - 342000, 140000),
    setText(`${pid}_calltxt`, 'Deliverable quantities vary intentionally (Section 8). GYC sends what the situation calls for — not a fixed count.'),
    styleText(`${pid}_calltxt`, WHITE, 11, true),
    align(`${pid}_calltxt`, 'CENTER'),
  ]);
}

// ══════════════════════════════════════════════════════════════════════════════
//  SLIDE 6 — What the Client Must Do
// ══════════════════════════════════════════════════════════════════════════════
async function s6(pid) {
  const col1 = 'EXECUTION — NON-NEGOTIABLE\n\n›  Add team to M3, assign weekly Drops\n›  Check M3 dashboard (minutes, not hours)\n›  Send team to training + workshops\n›  Install the review + referral systems\n    GYC provides\n›  Hold tour staff accountable — record\n    tours, review transcripts\n›  Own the phone standard — run the\n    GYC script, hold the team to it';

  const col2 = 'OPERATIONS — CONTRACTUAL\n\n›  Provide timely access, credentials,\n    materials, and approvals\n›  Keep payment method active and valid\n›  Implement M3 tasks — hold team\n    accountable for completion\n›  Notify GYC within 5 business days\n    of any significant business change\n›  Participate in onboarding + coaching';

  await batch([
    bgReq(pid, BLACK),
    addRect(`${pid}_hband`, pid, 0, 0, W, 820000),
    fillShape(`${pid}_hband`, PURPLE),
    noOutline(`${pid}_hband`),
    ...goldBar(`${pid}_gr`, pid, 0, 820000, W, 12000),
    addTB(`${pid}_num`, pid, W - 600000, 50000, 500000, 280000),
    setText(`${pid}_num`, '06'),
    styleText(`${pid}_num`, GOLD, 28, true),
    align(`${pid}_num`, 'RIGHT'),
    addTB(`${pid}_title`, pid, 457200, 120000, W - 1100000, 440000),
    setText(`${pid}_title`, 'Their Side of the Contract — What the Client Must Do'),
    styleText(`${pid}_title`, WHITE, 28, true),
    align(`${pid}_title`, 'LEFT'),
    addTB(`${pid}_sub`, pid, 457200, 580000, W - 914400, 240000),
    setText(`${pid}_sub`, 'This is what the signed agreement requires of them'),
    styleText(`${pid}_sub`, GOLD, 13, false, true),
    align(`${pid}_sub`, 'LEFT'),
    // Col 1
    addRect(`${pid}_c1bg`, pid, 57000, 900000, W * 0.47, 3400000),
    fillShape(`${pid}_c1bg`, DEEP_PURPLE),
    noOutline(`${pid}_c1bg`),
    ...goldBar(`${pid}_c1b`, pid, 57000, 900000, 18000, 3400000),
    addTB(`${pid}_c1`, pid, 171000, 960000, W * 0.45, 3300000),
    setText(`${pid}_c1`, col1),
    styleText(`${pid}_c1`, OFF_WHITE, 13),
    align(`${pid}_c1`, 'LEFT'),
    lineSpacing(`${pid}_c1`, 135),
    // Col 2
    addRect(`${pid}_c2bg`, pid, W * 0.51, 900000, W * 0.47, 3400000),
    fillShape(`${pid}_c2bg`, DEEP_PURPLE),
    noOutline(`${pid}_c2bg`),
    ...goldBar(`${pid}_c2b`, pid, W * 0.51, 900000, 18000, 3400000),
    addTB(`${pid}_c2`, pid, W * 0.52, 960000, W * 0.45, 3300000),
    setText(`${pid}_c2`, col2),
    styleText(`${pid}_c2`, OFF_WHITE, 13),
    align(`${pid}_c2`, 'LEFT'),
    lineSpacing(`${pid}_c2`, 135),
    // Callout
    addRect(`${pid}_callbg`, pid, 57000, 4420000, W - 114000, 560000),
    fillShape(`${pid}_callbg`, BRIGHT_VIO),
    noOutline(`${pid}_callbg`),
    addTB(`${pid}_calltxt`, pid, 171000, 4460000, W - 342000, 490000),
    setText(`${pid}_calltxt`, '⚡  The #1 reason centers underperform: stalled tasks.\nThe fix is delegation — not the owner\'s calendar.\nWhen a client isn\'t executing, GYC is protected. Results are on them.'),
    styleText(`${pid}_calltxt`, WHITE, 14, true),
    align(`${pid}_calltxt`, 'CENTER'),
    lineSpacing(`${pid}_calltxt`, 130),
  ]);
}

// ══════════════════════════════════════════════════════════════════════════════
//  SLIDE 7 — No Results Guarantee
// ══════════════════════════════════════════════════════════════════════════════
async function s7(pid) {
  const col1 = 'WHAT WE GUARANTEE (Section 3)\n\n✓  Deliver the work described in their tier\n\n✓  Timely, professional, commercially\n    reasonable delivery\n\n✓  If we materially fail + don\'t fix\n    within 30 days of written notice →\n    client exits penalty-free + gets\n    refund on prepaid undelivered work';

  const col2 = 'WHAT WE DON\'T GUARANTEE (Section 7)\n\n✗  Lead counts or enrollment numbers\n\n✗  Revenue growth or profitability\n\n✗  Rankings on Google, Maps, or AI\n\n✗  Outcomes from third-party platforms\n\n✗  ROI of any kind';

  await batch([
    bgReq(pid, BLACK),
    addRect(`${pid}_hband`, pid, 0, 0, W, 820000),
    fillShape(`${pid}_hband`, DEEP_PURPLE),
    noOutline(`${pid}_hband`),
    ...goldBar(`${pid}_gr`, pid, 0, 820000, W, 12000),
    addTB(`${pid}_num`, pid, W - 600000, 50000, 500000, 280000),
    setText(`${pid}_num`, '07'),
    styleText(`${pid}_num`, GOLD, 28, true),
    align(`${pid}_num`, 'RIGHT'),
    addTB(`${pid}_title`, pid, 457200, 120000, W - 1100000, 480000),
    setText(`${pid}_title`, 'What We Don\'t Promise — Know This Cold'),
    styleText(`${pid}_title`, WHITE, 28, true),
    align(`${pid}_title`, 'LEFT'),
    addTB(`${pid}_sub`, pid, 457200, 600000, W - 914400, 220000),
    setText(`${pid}_sub`, 'Before every sales call and every onboarding conversation'),
    styleText(`${pid}_sub`, GOLD, 13, false, true),
    align(`${pid}_sub`, 'LEFT'),
    // Col 1 — green tint
    addRect(`${pid}_c1bg`, pid, 57000, 900000, W * 0.47, 3300000),
    fillShape(`${pid}_c1bg`, { red:0.04, green:0.16, blue:0.08 }),
    noOutline(`${pid}_c1bg`),
    ...goldBar(`${pid}_c1b`, pid, 57000, 900000, 18000, 3300000),
    addTB(`${pid}_c1`, pid, 171000, 970000, W * 0.45, 3200000),
    setText(`${pid}_c1`, col1),
    styleText(`${pid}_c1`, OFF_WHITE, 13),
    align(`${pid}_c1`, 'LEFT'),
    lineSpacing(`${pid}_c1`, 135),
    // Col 2 — red tint
    addRect(`${pid}_c2bg`, pid, W * 0.51, 900000, W * 0.47, 3300000),
    fillShape(`${pid}_c2bg`, { red:0.20, green:0.04, blue:0.04 }),
    noOutline(`${pid}_c2bg`),
    ...goldBar(`${pid}_c2b`, pid, W * 0.51, 900000, 18000, 3300000),
    addTB(`${pid}_c2`, pid, W * 0.52, 970000, W * 0.45, 3200000),
    setText(`${pid}_c2`, col2),
    styleText(`${pid}_c2`, OFF_WHITE, 13),
    align(`${pid}_c2`, 'LEFT'),
    lineSpacing(`${pid}_c2`, 135),
    // Bottom callout
    addRect(`${pid}_callbg`, pid, 57000, 4320000, W - 114000, 650000),
    fillShape(`${pid}_callbg`, VIOLET),
    noOutline(`${pid}_callbg`),
    addTB(`${pid}_calltxt`, pid, 171000, 4360000, W - 342000, 590000),
    setText(`${pid}_calltxt`, '"We deliver the machine. They turn the key.\nIf they don\'t turn the key, results are on them — not GYC."\n\nNote: The guarantee does NOT cover Drop quantity or creative count (Section 8 — intentional delivery).'),
    styleText(`${pid}_calltxt`, WHITE, 13, true),
    align(`${pid}_calltxt`, 'CENTER'),
    lineSpacing(`${pid}_calltxt`, 125),
  ]);
}

// ══════════════════════════════════════════════════════════════════════════════
//  SLIDE 8 — Key Contract Terms
// ══════════════════════════════════════════════════════════════════════════════
async function s8(pid) {
  const terms = [
    ['Initial Term',          '6 months minimum from signing date.'],
    ['After 6 Months',        'Continues month-to-month. Cancel with 45 days\' written notice.'],
    ['Early Cancellation',    'Remaining fees for the full term become due. Contractual, not a penalty.'],
    ['Pay-in-Full Rate Lock', 'Locked-for-life. Does NOT survive cancellation — re-enroll at current rates.'],
    ['Adding Locations',      'Same owner, same brand, similar program structure. Confirmed at onboarding.'],
    ['Media Spend',           'NOT included in GYC fees. Billed direct to platform (Meta, Google).'],
    ['Changing Tiers',        'Upgrade anytime. Downgrade after initial term — next billing cycle.'],
    ['Billing Disputes',      'Must be in writing within 15 days of invoice or deemed accepted.'],
  ];

  const reqs = [
    bgReq(pid, BLACK),
    addRect(`${pid}_hband`, pid, 0, 0, W, 820000),
    fillShape(`${pid}_hband`, DEEP_PURPLE),
    noOutline(`${pid}_hband`),
    ...goldBar(`${pid}_gr`, pid, 0, 820000, W, 12000),
    addTB(`${pid}_num`, pid, W - 600000, 50000, 500000, 280000),
    setText(`${pid}_num`, '08'),
    styleText(`${pid}_num`, GOLD, 28, true),
    align(`${pid}_num`, 'RIGHT'),
    addTB(`${pid}_title`, pid, 457200, 160000, W - 1100000, 500000),
    setText(`${pid}_title`, 'Contract Terms — What the Team Needs to Know'),
    styleText(`${pid}_title`, WHITE, 30, true),
    align(`${pid}_title`, 'LEFT'),
  ];

  const rowH = 410000;
  const startY = 920000;
  for (let i = 0; i < terms.length; i++) {
    const [label, desc] = terms[i];
    const y = startY + i * rowH;
    const bg = i % 2 === 0 ? DEEP_PURPLE : { red:0.07, green:0.04, blue:0.12 };
    reqs.push(
      addRect(`${pid}_row${i}`, pid, 57000, y, W - 114000, rowH - 12000),
      fillShape(`${pid}_row${i}`, bg),
      noOutline(`${pid}_row${i}`),
      addTB(`${pid}_lbl${i}`, pid, 171000, y + 40000, W * 0.22, 300000),
      setText(`${pid}_lbl${i}`, label),
      styleText(`${pid}_lbl${i}`, GOLD, 12, true),
      align(`${pid}_lbl${i}`, 'LEFT'),
      addTB(`${pid}_desc${i}`, pid, W * 0.25, y + 40000, W * 0.70, 300000),
      setText(`${pid}_desc${i}`, desc),
      styleText(`${pid}_desc${i}`, OFF_WHITE, 12),
      align(`${pid}_desc${i}`, 'LEFT'),
    );
  }

  await batch(reqs);
}

// ══════════════════════════════════════════════════════════════════════════════
//  SLIDE 9 — Client Fit
// ══════════════════════════════════════════════════════════════════════════════
async function s9(pid) {
  const good = 'GOOD FIT\n\n✓  ECE-focused centers (education, not care-only)\n\n✓  Light-to-medium or heavy competition markets\n\n✓  Owner who can delegate 3–5 hrs/week to team\n\n✓  Center struggling to fill seats despite trying ads\n\n✓  Owner who understands this is done-WITH-you';

  const bad = 'NOT A GOOD FIT\n\n✗  Care-only daycare with no education component\n\n✗  Owner expecting GYC to do everything\n\n✗  Structural market problems (wrong demo,\n    facility issues, wrong program)\n\n✗  Owner expecting guaranteed enrollment\n    numbers within a fixed timeframe';

  await batch([
    bgReq(pid, BLACK),
    addRect(`${pid}_hband`, pid, 0, 0, W, 820000),
    fillShape(`${pid}_hband`, DEEP_PURPLE),
    noOutline(`${pid}_hband`),
    ...goldBar(`${pid}_gr`, pid, 0, 820000, W, 12000),
    addTB(`${pid}_num`, pid, W - 600000, 50000, 500000, 280000),
    setText(`${pid}_num`, '09'),
    styleText(`${pid}_num`, GOLD, 28, true),
    align(`${pid}_num`, 'RIGHT'),
    addTB(`${pid}_title`, pid, 457200, 160000, W - 1100000, 500000),
    setText(`${pid}_title`, 'Who the Reputation Engine Is Built For'),
    styleText(`${pid}_title`, WHITE, 30, true),
    align(`${pid}_title`, 'LEFT'),
    // Good fit
    addRect(`${pid}_c1bg`, pid, 57000, 900000, W * 0.47, 3600000),
    fillShape(`${pid}_c1bg`, { red:0.04, green:0.16, blue:0.08 }),
    noOutline(`${pid}_c1bg`),
    ...goldBar(`${pid}_c1b`, pid, 57000, 900000, 18000, 3600000),
    addTB(`${pid}_c1`, pid, 171000, 960000, W * 0.45, 3500000),
    setText(`${pid}_c1`, good),
    styleText(`${pid}_c1`, OFF_WHITE, 13),
    align(`${pid}_c1`, 'LEFT'),
    lineSpacing(`${pid}_c1`, 130),
    // Bad fit
    addRect(`${pid}_c2bg`, pid, W * 0.51, 900000, W * 0.47, 3600000),
    fillShape(`${pid}_c2bg`, { red:0.20, green:0.04, blue:0.04 }),
    noOutline(`${pid}_c2bg`),
    ...goldBar(`${pid}_c2b`, pid, W * 0.51, 900000, 18000, 3600000),
    addTB(`${pid}_c2`, pid, W * 0.52, 960000, W * 0.45, 3500000),
    setText(`${pid}_c2`, bad),
    styleText(`${pid}_c2`, OFF_WHITE, 13),
    align(`${pid}_c2`, 'LEFT'),
    lineSpacing(`${pid}_c2`, 130),
    // Callout
    addRect(`${pid}_callbg`, pid, 57000, 4620000, W - 114000, 380000),
    fillShape(`${pid}_callbg`, VIOLET),
    noOutline(`${pid}_callbg`),
    addTB(`${pid}_calltxt`, pid, 171000, 4650000, W - 342000, 330000),
    setText(`${pid}_calltxt`, '⚡  Our 4% failure rate over 8 years traces to two things: wrong market fit or client didn\'t execute. Vet fit before close.'),
    styleText(`${pid}_calltxt`, WHITE, 13, true),
    align(`${pid}_calltxt`, 'CENTER'),
  ]);
}

// ══════════════════════════════════════════════════════════════════════════════
//  SLIDE 10 — Questions to Know Cold
// ══════════════════════════════════════════════════════════════════════════════
async function s10(pid) {
  const qa = [
    ['Core vs Growth — what\'s the difference?',
     'How much GYC carries. Core needs more internal execution (especially email). Growth adds email done-for-you, Google LSA, quarterly 1-on-1s, priority support.'],
    ['What if they\'re not happy with results?',
     'We guarantee the WORK, not the results. Failed delivery + 30-day cure period → they can exit. Disappointing results but work delivered → client execution conversation.'],
    ['What do they have to do themselves?',
     '3–5 hrs/week of team execution: M3 tasks, training, review/referral systems, tour accountability, phone standard.'],
    ['Can they cancel early?',
     'Not without paying the remaining term. After 6 months: 45 days\' written notice.'],
    ['Is media spend included?',
     'No. Meta and Google LSA ad spend is billed directly to the platform. GYC manages campaigns; client pays the media budget.'],
  ];

  const reqs = [
    bgReq(pid, BLACK),
    addRect(`${pid}_hband`, pid, 0, 0, W, 820000),
    fillShape(`${pid}_hband`, DEEP_PURPLE),
    noOutline(`${pid}_hband`),
    ...goldBar(`${pid}_gr`, pid, 0, 820000, W, 12000),
    addTB(`${pid}_num`, pid, W - 600000, 50000, 500000, 280000),
    setText(`${pid}_num`, '10'),
    styleText(`${pid}_num`, GOLD, 28, true),
    align(`${pid}_num`, 'RIGHT'),
    addTB(`${pid}_title`, pid, 457200, 160000, W - 1100000, 500000),
    setText(`${pid}_title`, 'Questions Every Team Member Should Know Cold'),
    styleText(`${pid}_title`, WHITE, 30, true),
    align(`${pid}_title`, 'LEFT'),
  ];

  const rowH = 720000;
  const startY = 900000;
  for (let i = 0; i < qa.length; i++) {
    const [q, a] = qa[i];
    const y = startY + i * rowH;
    reqs.push(
      addRect(`${pid}_qbg${i}`, pid, 57000, y, W - 114000, rowH - 18000),
      fillShape(`${pid}_qbg${i}`, i % 2 === 0 ? DEEP_PURPLE : { red:0.07, green:0.04, blue:0.12 }),
      noOutline(`${pid}_qbg${i}`),
      ...goldBar(`${pid}_qbar${i}`, pid, 57000, y, 18000, rowH - 18000),
      addTB(`${pid}_q${i}`, pid, 171000, y + 40000, W - 342000, 240000),
      setText(`${pid}_q${i}`, `Q: ${q}`),
      styleText(`${pid}_q${i}`, GOLD, 12, true),
      align(`${pid}_q${i}`, 'LEFT'),
      addTB(`${pid}_a${i}`, pid, 171000, y + 300000, W - 342000, 350000),
      setText(`${pid}_a${i}`, `A: ${a}`),
      styleText(`${pid}_a${i}`, OFF_WHITE, 12),
      align(`${pid}_a${i}`, 'LEFT'),
      lineSpacing(`${pid}_a${i}`, 120),
    );
  }

  await batch(reqs);
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
