/**
 * GYC Brand Formatting for Revenue Report Google Doc
 * Detects markdown-style structure and applies brand formatting
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const DOC_ID = '15scnaOycWILyC3OHQTEsv--9vfF47sxlJNR0Pi4VSNQ';
const CREDS_PATH = path.join(process.env.HOME, '.openclaw/credentials/google-console.json');

// GYC Brand Colors (normalized 0-1)
const C = {
  deepViolet:  { red: 0.204, green: 0.043, blue: 0.404 },  // #340B67
  medViolet:   { red: 0.451, green: 0.082, blue: 0.580 },  // #731494
  gray:        { red: 0.420, green: 0.447, blue: 0.502 },  // #6b7280
  nearBlack:   { red: 0.067, green: 0.094, blue: 0.153 },  // #111827
  lightGray:   { red: 0.820, green: 0.835, blue: 0.859 },  // #d1d5db
  white:       { red: 1.0,   green: 1.0,   blue: 1.0   },
};

function col(c) { return { color: { rgbColor: c } }; }

function textStyle(si, ei, style, fields) {
  return { updateTextStyle: { range: { startIndex: si, endIndex: ei }, textStyle: style, fields } };
}
function paraStyle(si, ei, style, fields) {
  return { updateParagraphStyle: { range: { startIndex: si, endIndex: ei }, paragraphStyle: style, fields } };
}

async function main() {
  const creds = JSON.parse(fs.readFileSync(CREDS_PATH));
  const auth = new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/documents'] });
  const docs = google.docs({ version: 'v1', auth });

  console.log('Fetching document...');
  const { data: doc } = await docs.documents.get({ documentId: DOC_ID });

  const paragraphs = [];
  for (const elem of doc.body.content) {
    if (elem.paragraph) {
      let text = '';
      for (const run of (elem.paragraph.elements || [])) {
        if (run.textRun) text += run.textRun.content;
      }
      paragraphs.push({
        text: text.replace(/\n$/, ''),
        si: elem.startIndex,
        ei: elem.endIndex,
      });
    }
  }

  console.log(`Found ${paragraphs.length} paragraphs\n`);

  const requests = [];
  const pageBreakIndices = [];

  // Track table context: after we see a `|---|` separator, the paragraph before it was a header
  // We look ahead to detect header rows
  const tableHeaderIndices = new Set();
  const tableSeparatorIndices = new Set();
  for (let i = 1; i < paragraphs.length; i++) {
    if (/^\|[-| :]+\|/.test(paragraphs[i].text)) {
      tableSeparatorIndices.add(i);
      tableHeaderIndices.add(i - 1); // previous row is header
    }
  }

  for (let idx = 0; idx < paragraphs.length; idx++) {
    const { text, si, ei } = paragraphs[idx];

    // ── H1 Title: "# GYC REVENUE REPORT" ──────────────────────────────────────
    if (text.startsWith('# ') && !text.startsWith('## ')) {
      requests.push(textStyle(si, ei,
        { bold: true, fontSize: { magnitude: 28, unit: 'PT' }, foregroundColor: col(C.medViolet) },
        'bold,fontSize,foregroundColor'
      ));
      requests.push(paraStyle(si, ei, { alignment: 'CENTER', spaceBelow: { magnitude: 8, unit: 'PT' } }, 'alignment,spaceBelow'));
      console.log(`✓ Title: "${text}"`);
      continue;
    }

    // ── H2 Section headers: "## SECTION X:..." / "## EXECUTIVE SUMMARY" ───────
    if (text.startsWith('## ')) {
      requests.push(textStyle(si, ei,
        { bold: true, fontSize: { magnitude: 16, unit: 'PT' }, foregroundColor: col(C.deepViolet) },
        'bold,fontSize,foregroundColor'
      ));
      requests.push(paraStyle(si, ei,
        { alignment: 'START', spaceAbove: { magnitude: 16, unit: 'PT' }, spaceBelow: { magnitude: 6, unit: 'PT' } },
        'alignment,spaceAbove,spaceBelow'
      ));
      // Page break before SECTION 1-8 (not EXECUTIVE SUMMARY)
      if (/^## SECTION \d+:/.test(text)) {
        pageBreakIndices.push(si);
      }
      console.log(`✓ Header: "${text}"`);
      continue;
    }

    // ── Subtitle lines (Prepared for/Date/Prepared by) ─────────────────────────
    if (
      text.startsWith('**Prepared for:') ||
      text.startsWith('**Date:') ||
      text.startsWith('**Prepared by:')
    ) {
      requests.push(textStyle(si, ei,
        { italic: true, fontSize: { magnitude: 11, unit: 'PT' }, foregroundColor: col(C.deepViolet) },
        'italic,fontSize,foregroundColor'
      ));
      requests.push(paraStyle(si, ei, { alignment: 'CENTER' }, 'alignment'));
      console.log(`✓ Subtitle: "${text}"`);
      continue;
    }

    // ── Horizontal rules "---" ──────────────────────────────────────────────────
    if (text === '---') {
      requests.push(textStyle(si, ei,
        { fontSize: { magnitude: 4, unit: 'PT' }, foregroundColor: col(C.lightGray) },
        'fontSize,foregroundColor'
      ));
      console.log(`✓ Divider [${si}-${ei}]`);
      continue;
    }

    // ── Figure captions ─────────────────────────────────────────────────────────
    if (/^\*Figure/i.test(text)) {
      requests.push(textStyle(si, ei,
        { italic: true, fontSize: { magnitude: 10, unit: 'PT' }, foregroundColor: col(C.gray) },
        'italic,fontSize,foregroundColor'
      ));
      console.log(`✓ Caption: "${text.substring(0, 60)}..."`);
      continue;
    }

    // ── Table separator rows "|---|---|" ─────────────────────────────────────────
    if (tableSeparatorIndices.has(idx)) {
      requests.push(textStyle(si, ei,
        { fontSize: { magnitude: 4, unit: 'PT' }, foregroundColor: col(C.lightGray) },
        'fontSize,foregroundColor'
      ));
      continue;
    }

    // ── Table header rows ────────────────────────────────────────────────────────
    if (tableHeaderIndices.has(idx)) {
      requests.push(textStyle(si, ei,
        { bold: true, fontSize: { magnitude: 11, unit: 'PT' }, foregroundColor: col(C.white) },
        'bold,fontSize,foregroundColor'
      ));
      // Can't set background on plain text paragraphs easily, use deep violet text instead
      requests.push(textStyle(si, ei,
        { foregroundColor: col(C.deepViolet) },
        'foregroundColor'
      ));
      // Override — bold deep violet for table headers
      requests.push(textStyle(si, ei,
        { bold: true, fontSize: { magnitude: 11, unit: 'PT' }, foregroundColor: col(C.medViolet) },
        'bold,fontSize,foregroundColor'
      ));
      console.log(`✓ Table header: "${text.substring(0, 60)}"`);
      continue;
    }

    // ── Table data rows ──────────────────────────────────────────────────────────
    if (text.startsWith('|')) {
      requests.push(textStyle(si, ei,
        { fontSize: { magnitude: 11, unit: 'PT' }, foregroundColor: col(C.nearBlack) },
        'fontSize,foregroundColor'
      ));
      continue;
    }

    // ── Key takeaway lines (markdown bold wrapper or key phrases) ───────────────
    if (
      /^\*\*/.test(text) ||
      text.startsWith('The most important') ||
      text.startsWith('The honest assessment:') ||
      text.startsWith('Combined, GYC') ||
      text.startsWith('Bottom line:') ||
      text.startsWith('Key insight:') ||
      text.startsWith('Takeaway:')
    ) {
      requests.push(textStyle(si, ei,
        { bold: true, fontSize: { magnitude: 12, unit: 'PT' }, foregroundColor: col(C.medViolet) },
        'bold,fontSize,foregroundColor'
      ));
      console.log(`✓ Key takeaway: "${text.substring(0, 60)}..."`);
      continue;
    }

    // ── Empty paragraphs — skip ──────────────────────────────────────────────────
    if (!text.trim()) continue;

    // ── Default body text ────────────────────────────────────────────────────────
    requests.push(textStyle(si, ei,
      { fontSize: { magnitude: 11, unit: 'PT' }, foregroundColor: col(C.nearBlack) },
      'fontSize,foregroundColor'
    ));
    requests.push(paraStyle(si, ei, { lineSpacing: 115 }, 'lineSpacing'));
  }

  console.log(`\nPrepared ${requests.length} formatting requests`);
  console.log(`Page break locations: ${pageBreakIndices.length}`);
  console.log('Page break indices:', pageBreakIndices);

  // Apply formatting in chunks of 300
  let totalApplied = 0;
  for (let i = 0; i < requests.length; i += 300) {
    const chunk = requests.slice(i, i + 300);
    try {
      await docs.documents.batchUpdate({ documentId: DOC_ID, requestBody: { requests: chunk } });
      totalApplied += chunk.length;
      process.stdout.write(`\rApplied ${totalApplied}/${requests.length} requests...`);
    } catch (err) {
      console.error(`\nChunk failed at ${i}: ${err.message}`);
      // Log the failed requests for debugging
      if (err.response && err.response.data) {
        console.error(JSON.stringify(err.response.data, null, 2));
      }
    }
  }
  console.log(`\n✅ Formatting done`);

  // Page breaks already inserted in a prior run — skip
  console.log('\nSkipping page break insertion (already done).');

  console.log('\n=== SUMMARY ===');
  console.log(`Total formatting requests: ${totalApplied}`);
  console.log(`Page breaks inserted: ${pageBreakIndices.length}`);
  console.log(`Doc: https://docs.google.com/document/d/${DOC_ID}/edit`);
}

main().catch(console.error);
