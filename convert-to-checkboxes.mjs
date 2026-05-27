import { google } from 'googleapis';
import { readFileSync } from 'fs';

const SA = JSON.parse(readFileSync(process.env.HOME + '/.openclaw/workspace/google-service-account.json', 'utf8'));
const auth = new google.auth.GoogleAuth({ credentials: SA, scopes: ['https://www.googleapis.com/auth/documents'] });

const DOC_ID = '1bydL9QZQ-026w0EaR9ue3bu7a5U7_QATI_c6w0g7b9A';

async function main() {
  const docs = google.docs({ version: 'v1', auth: await auth.getClient() });
  
  // Get the full document
  const doc = await docs.documents.get({ documentId: DOC_ID });
  const content = doc.data.body.content;
  
  // Find Section 1 range: between HEADING_1 "Vision Call — Information Checklist" heading area
  // and HEADING_2 "Section 2" 
  // Strategy: find all BULLET paragraphs that are in Section 1 (before "Section 2 — Call Structure Outline")
  
  let inSection1 = false;
  const checkboxRanges = [];
  
  for (const element of content) {
    if (!element.paragraph) continue;
    const para = element.paragraph;
    const style = para.paragraphStyle?.namedStyleType;
    const text = para.elements?.map(e => e.textRun?.content || '').join('').trim();
    
    // Start collecting after we see Section 1 heading
    if (style === 'HEADING_2' && text.includes('Section 1')) {
      inSection1 = true;
      continue;
    }
    
    // Stop when we hit Section 2
    if (style === 'HEADING_2' && text.includes('Section 2')) {
      inSection1 = false;
      break;
    }
    
    // Collect bullet paragraphs in section 1
    if (inSection1 && para.bullet) {
      const startIndex = element.startIndex;
      const endIndex = element.endIndex;
      checkboxRanges.push({ startIndex, endIndex: endIndex - 1 });
    }
  }
  
  console.log(`Found ${checkboxRanges.length} bullet items to convert to checkboxes`);
  
  if (checkboxRanges.length === 0) {
    console.log('No bullet items found. Dumping paragraph styles for debug:');
    for (const element of content) {
      if (!element.paragraph) continue;
      const para = element.paragraph;
      const style = para.paragraphStyle?.namedStyleType;
      const text = para.elements?.map(e => e.textRun?.content || '').join('').trim().substring(0, 60);
      const hasBullet = !!para.bullet;
      console.log(`  [${style}] bullet=${hasBullet} "${text}"`);
    }
    return;
  }
  
  // Build batchUpdate requests - delete existing bullets then create checkbox bullets
  const requests = [];
  
  // First remove existing bullets
  for (const range of checkboxRanges) {
    requests.push({
      deleteParagraphBullets: {
        range: { startIndex: range.startIndex, endIndex: range.endIndex }
      }
    });
  }
  
  // Then apply checkbox style
  for (const range of checkboxRanges) {
    requests.push({
      createParagraphBullets: {
        range: { startIndex: range.startIndex, endIndex: range.endIndex },
        bulletPreset: 'BULLET_CHECKBOX'
      }
    });
  }
  
  await docs.documents.batchUpdate({
    documentId: DOC_ID,
    requestBody: { requests }
  });
  
  console.log('Done! Converted all Section 1 bullets to checkboxes.');
}

main().catch(e => { console.error(e.message); process.exit(1); });
