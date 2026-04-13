/**
 * GYC Brand Formatting — Revenue Report (v2)
 * Full formatting + page breaks, clean implementation
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const DOC_ID = '15scnaOycWILyC3OHQTEsv--9vfF47sxlJNR0Pi4VSNQ';
const CREDS_PATH = path.join(process.env.HOME, '.openclaw/credentials/google-console.json');

const C = {
  deepViolet: { red: 0.204, green: 0.043, blue: 0.404 },  // #340B67
  medViolet:  { red: 0.451, green: 0.082, blue: 0.580 },  // #731494
  gray:       { red: 0.420, green: 0.447, blue: 0.502 },  // #6b7280
  nearBlack:  { red: 0.067, green: 0.094, blue: 0.153 },  // #111827
  lightGray:  { red: 0.820, green: 0.835, blue: 0.859 },  // visual rule
};

function col(c) { return { color: { rgbColor: c } }; }

function textReq(si, ei, style, fields) {
  return { updateTextStyle: { range: { startIndex: si, endIndex: ei }, textStyle: style, fields } };
}
function paraReq(si, ei, style, fields) {
  return { updateParagraphStyle: { range: { startIndex: si, endIndex: ei }, paragraphStyle: style, fields } };
}

// Specific bold key lines from the spec
const KEY_BOLD_FRAGMENTS = [
  '2026 is the building year. 2027 is the payoff.',
  'Stripe reports $213,334 in MRR. But Stripe MRR understates true monthly cash generation by 34%.',
  'Total: $285,882 per month',
  'This pipeline is not a projection.',
  'Every scenario crosses $4.2M in 2027.',
  'This report establishes the shared understanding.',
];

async function batchApply(docs, requests, label) {
  let applied = 0;
  const CHUNK = 300;
  for (let i = 0; i < requests.length; i += CHUNK) {
    const chunk = requests.slice(i, i + CHUNK);
    try {
      await docs.documents.batchUpdate({
        documentId: DOC_ID,
        requestBody: { requests: chunk },
      });
      applied += chunk.length;
      process.stdout.write(`\r  ${label}: ${applied}/${requests.length}   `);
    } catch (err) {
      console.error(`\n  ERROR in chunk ${i}: ${err.message}`);
      if (err.response?.data) console.error(JSON.stringify(err.response.data, null, 2));
      throw err;
    }
  }
  console.log();
  return applied;
}

async function main() {
  const creds = JSON.parse(fs.readFileSync(CREDS_PATH));
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/documents'],
  });
  const docs = google.docs({ version: 'v1', auth });

  console.log('Fetching document...');
  const { data: doc } = await docs.documents.get({ documentId: DOC_ID });

  // Build paragraph list
  const paras = [];
  for (const elem of doc.body.content) {
    if (elem.paragraph) {
      let text = '';
      for (const run of (elem.paragraph.elements || [])) {
        if (run.textRun) text += run.textRun.content;
      }
      paras.push({
        text: text.replace(/\n$/, ''),
        si: elem.startIndex,
        ei: elem.endIndex,
      });
    }
  }
  console.log(`Found ${paras.length} paragraphs`);

  // Identify table structure
  const tableHeaderIdxs = new Set();
  const tableSepIdxs = new Set();
  for (let i = 1; i < paras.length; i++) {
    if (/^\|[-| :]+\|/.test(paras[i].text)) {
      tableSepIdxs.add(i);
      tableHeaderIdxs.add(i - 1);
    }
  }

  const fmtRequests = [];
  const sectionHeaderSIs = []; // for page breaks (SECTION 1-8 only)

  let titleCount = 0, subtitleCount = 0, sectionCount = 0, boldCount = 0,
      captionCount = 0, tableHeaderCount = 0, tableSepCount = 0,
      dividerCount = 0, bodyCount = 0;

  for (let i = 0; i < paras.length; i++) {
    const { text, si, ei } = paras[i];

    // ── TITLE ────────────────────────────────────────────────────────────────
    if (text.startsWith('# ') && !text.startsWith('## ')) {
      fmtRequests.push(textReq(si, ei,
        { bold: true, fontSize: { magnitude: 28, unit: 'PT' }, foregroundColor: col(C.medViolet), italic: false },
        'bold,fontSize,foregroundColor,italic'
      ));
      fmtRequests.push(paraReq(si, ei, { alignment: 'CENTER', spaceBelow: { magnitude: 10, unit: 'PT' } }, 'alignment,spaceBelow'));
      titleCount++;
      console.log(`  ✓ TITLE: "${text}"`);
      continue;
    }

    // ── SECTION HEADERS (##) ─────────────────────────────────────────────────
    if (text.startsWith('## ')) {
      fmtRequests.push(textReq(si, ei,
        { bold: true, fontSize: { magnitude: 16, unit: 'PT' }, foregroundColor: col(C.deepViolet), italic: false },
        'bold,fontSize,foregroundColor,italic'
      ));
      fmtRequests.push(paraReq(si, ei,
        { alignment: 'START', spaceAbove: { magnitude: 18, unit: 'PT' }, spaceBelow: { magnitude: 8, unit: 'PT' } },
        'alignment,spaceAbove,spaceBelow'
      ));
      // Page break before SECTION 1-8, not EXECUTIVE SUMMARY
      if (/^## SECTION \d+:/.test(text)) {
        sectionHeaderSIs.push(si);
        console.log(`  ✓ SECTION (page break): "${text}"`);
      } else {
        console.log(`  ✓ SECTION (no break): "${text}"`);
      }
      sectionCount++;
      continue;
    }

    // ── SUBTITLES (Prepared for / Date / Prepared by) ────────────────────────
    if (
      text.startsWith('**Prepared for:') ||
      text.startsWith('**Date:') ||
      text.startsWith('**Prepared by:')
    ) {
      fmtRequests.push(textReq(si, ei,
        { italic: true, bold: false, fontSize: { magnitude: 11, unit: 'PT' }, foregroundColor: col(C.deepViolet) },
        'italic,bold,fontSize,foregroundColor'
      ));
      fmtRequests.push(paraReq(si, ei, { alignment: 'CENTER' }, 'alignment'));
      subtitleCount++;
      continue;
    }

    // ── DIVIDERS (---) ───────────────────────────────────────────────────────
    if (text === '---') {
      fmtRequests.push(textReq(si, ei,
        { fontSize: { magnitude: 2, unit: 'PT' }, foregroundColor: col(C.lightGray) },
        'fontSize,foregroundColor'
      ));
      dividerCount++;
      continue;
    }

    // ── FIGURE CAPTIONS ──────────────────────────────────────────────────────
    if (/^\*Figure/i.test(text)) {
      fmtRequests.push(textReq(si, ei,
        { italic: true, fontSize: { magnitude: 10, unit: 'PT' }, foregroundColor: col(C.gray) },
        'italic,fontSize,foregroundColor'
      ));
      captionCount++;
      console.log(`  ✓ Caption: "${text.substring(0, 70)}"`);
      continue;
    }

    // ── TABLE SEPARATORS ─────────────────────────────────────────────────────
    if (tableSepIdxs.has(i)) {
      fmtRequests.push(textReq(si, ei,
        { fontSize: { magnitude: 3, unit: 'PT' }, foregroundColor: col(C.lightGray) },
        'fontSize,foregroundColor'
      ));
      tableSepCount++;
      continue;
    }

    // ── TABLE HEADERS ────────────────────────────────────────────────────────
    if (tableHeaderIdxs.has(i)) {
      fmtRequests.push(textReq(si, ei,
        { bold: true, fontSize: { magnitude: 11, unit: 'PT' }, foregroundColor: col(C.deepViolet) },
        'bold,fontSize,foregroundColor'
      ));
      tableHeaderCount++;
      console.log(`  ✓ Table header: "${text.substring(0, 60)}"`);
      continue;
    }

    // ── TABLE DATA ROWS ──────────────────────────────────────────────────────
    if (text.startsWith('|')) {
      fmtRequests.push(textReq(si, ei,
        { fontSize: { magnitude: 11, unit: 'PT' }, foregroundColor: col(C.nearBlack) },
        'fontSize,foregroundColor'
      ));
      continue;
    }

    // ── KEY BOLD LINES ───────────────────────────────────────────────────────
    // Check specific phrases first, then generic ** prefix
    const isKeyBold =
      KEY_BOLD_FRAGMENTS.some(f => text.includes(f)) ||
      /^\*\*/.test(text);

    if (isKeyBold) {
      fmtRequests.push(textReq(si, ei,
        { bold: true, fontSize: { magnitude: 12, unit: 'PT' }, foregroundColor: col(C.medViolet) },
        'bold,fontSize,foregroundColor'
      ));
      boldCount++;
      console.log(`  ✓ Bold key: "${text.substring(0, 70)}"`);
      continue;
    }

    // ── EMPTY PARAGRAPHS — skip ──────────────────────────────────────────────
    if (!text.trim()) continue;

    // ── BODY TEXT ────────────────────────────────────────────────────────────
    fmtRequests.push(textReq(si, ei,
      { fontSize: { magnitude: 11, unit: 'PT' }, foregroundColor: col(C.nearBlack), bold: false, italic: false },
      'fontSize,foregroundColor,bold,italic'
    ));
    fmtRequests.push(paraReq(si, ei, { alignment: 'START', lineSpacing: 115 }, 'alignment,lineSpacing'));
    bodyCount++;
  }

  console.log(`\nFormatting summary:`);
  console.log(`  Title: ${titleCount}, Subtitles: ${subtitleCount}, Sections: ${sectionCount}`);
  console.log(`  Bold key lines: ${boldCount}, Captions: ${captionCount}`);
  console.log(`  Table headers: ${tableHeaderCount}, Separators: ${tableSepCount}`);
  console.log(`  Dividers: ${dividerCount}, Body: ${bodyCount}`);
  console.log(`  Total requests: ${fmtRequests.length}`);
  console.log(`  Page breaks to insert: ${sectionHeaderSIs.length} (SECTION 1-8)`);
  console.log(`  Page break positions: ${JSON.stringify(sectionHeaderSIs)}`);

  // ── STEP 1: Apply all formatting ─────────────────────────────────────────
  console.log('\nApplying formatting...');
  const applied = await batchApply(docs, fmtRequests, 'Formatting');
  console.log(`✅ Formatting: ${applied} requests applied`);

  // ── STEP 2: Insert page breaks AFTER formatting, in reverse order ─────────
  // Reverse order so earlier insertions don't shift later indices
  const sortedBreaks = [...sectionHeaderSIs].sort((a, b) => b - a);
  console.log(`\nInserting ${sortedBreaks.length} page breaks (reverse order)...`);

  const pbRequests = sortedBreaks.map(idx => ({
    insertPageBreak: { location: { index: idx } }
  }));

  // Insert one at a time to be safe with index integrity
  let pbCount = 0;
  for (const req of pbRequests) {
    await docs.documents.batchUpdate({
      documentId: DOC_ID,
      requestBody: { requests: [req] },
    });
    pbCount++;
    process.stdout.write(`\r  Page breaks: ${pbCount}/${pbRequests.length}`);
  }
  console.log(`\n✅ Page breaks: ${pbCount} inserted`);

  console.log('\n=== FINAL SUMMARY ===');
  console.log(`Formatting requests applied: ${applied}`);
  console.log(`Page breaks inserted: ${pbCount}`);
  console.log(`Title: ✅ | Section headers: ✅ | Bold key lines: ✅ | Captions: ✅ | Subtitles: ✅`);
  console.log(`Doc: https://docs.google.com/document/d/${DOC_ID}/edit`);
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
