#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });

const { Client } = require('pg');
const { Client: NotionClient } = require('@notionhq/client');

const DATABASE_URL = process.env.DATABASE_URL;
const NOTION_API_KEY = process.env.NOTION_API_KEY;

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL not found in environment');
  process.exit(1);
}

if (!NOTION_API_KEY) {
  console.error('ERROR: NOTION_API_KEY not found in environment');
  process.exit(1);
}

// Notion pages by acronym
const NOTION_PAGES = {
  'CTI': 'd5c222d0-d622-44ad-b57c-5dadd4a8ae8b',
  'HAA': 'a50ca865-e197-8320-93cf-8169277ae0db',
  'RMP': '0381626f-22aa-4b97-8e92-9267539a491a',
  'PPELC': '368b075c-c590-4336-9fb7-b7c2070931d8',
  'BBC': '539a7786-7ae6-4152-9a06-29b30016bcbd',
  'TATLC': '940199c1-350e-4694-9b45-d25c51d1de44',
  'C2C': 'd01fee5f-0851-4484-a8e7-c6d1e03f65d6',
  'WLC': '4fb87c6a-fb97-44ef-8e01-cdf7d47bc0bb',
  'MCCC': '52c460fa-db70-45ef-90c2-f29a0f091d9b',
  'AJT': '6ad2800c-3f51-420f-ba25-69fd52090cbf',
  'TCLA': '4d143aa2-8565-468a-9d35-2d8e75a9f39f',
  'UTMPT': '175402df-fb93-431b-8e43-e8de13ffdfff',
  'LSA': '3a354c08-a41e-4368-91bd-ab5bf02ce523',
  'RVMCC': 'e4a3b44d-dd25-4627-a729-4aff937a6743',
  'CCA+CCP': 'eb3b390f-97eb-4504-b8b1-5eee4ed7f52c'
};

function levenshteinDistance(a, b) {
  const matrix = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

function fuzzyMatch(str1, str2, threshold = 0.6) {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1.includes(s2) || s2.includes(s1)) return true;
  
  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);
  const similarity = 1 - (distance / maxLength);
  
  return similarity >= threshold;
}

async function task1_matchUnmatchedCalls() {
  console.log('\n=== TASK 1: Match unmatched ZoomCall records to clients ===\n');
  
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  
  try {
    // Get unmatched calls
    const unmatchedResult = await client.query(`
      SELECT id, topic, "startTime", "ghlContactId", "ghlContactName", "repName", "hostEmail", "aiSummary", "durationSecs"
      FROM "ZoomCall"
      WHERE acronym IS NULL
        AND "tenantId" = 'gyc'
        AND "aiClassification" = 'client_meeting'
      ORDER BY "startTime" DESC
    `);
    
    console.log(`Found ${unmatchedResult.rows.length} unmatched client_meeting calls\n`);
    
    // Get all client profiles
    const clientsResult = await client.query(`
      SELECT id, acronym, "companyName", "ownerName", "ghlContactId"
      FROM "ClientProfile"
      WHERE "tenantId" = 'gyc'
    `);
    
    console.log(`Found ${clientsResult.rows.length} client profiles\n`);
    
    let matchedCount = 0;
    
    for (const call of unmatchedResult.rows) {
      let matchedClient = null;
      
      // Try 1: Match by ghlContactId
      if (call.ghlContactId) {
        matchedClient = clientsResult.rows.find(c => c.ghlContactId === call.ghlContactId);
        if (matchedClient) {
          console.log(`✓ Matched by ghlContactId: ${call.topic} → ${matchedClient.acronym} (${matchedClient.companyName})`);
        }
      }
      
      // Try 2: Match by ghlContactName
      if (!matchedClient && call.ghlContactName) {
        matchedClient = clientsResult.rows.find(c => 
          (c.companyName && fuzzyMatch(call.ghlContactName, c.companyName, 0.7)) ||
          (c.ownerName && fuzzyMatch(call.ghlContactName, c.ownerName, 0.7))
        );
        if (matchedClient) {
          console.log(`✓ Matched by ghlContactName: ${call.ghlContactName} → ${matchedClient.acronym} (${matchedClient.companyName})`);
        }
      }
      
      // Try 3: Match by topic keyword
      if (!matchedClient && call.topic) {
        const topicLower = call.topic.toLowerCase();
        matchedClient = clientsResult.rows.find(c => {
          if (c.acronym && topicLower.includes(c.acronym.toLowerCase())) return true;
          if (c.companyName) {
            const companyWords = c.companyName.toLowerCase().split(/\s+/).filter(w => w.length > 3);
            return companyWords.some(word => topicLower.includes(word));
          }
          return false;
        });
        if (matchedClient) {
          console.log(`✓ Matched by topic: "${call.topic}" → ${matchedClient.acronym} (${matchedClient.companyName})`);
        }
      }
      
      // Update if matched
      if (matchedClient) {
        await client.query(`
          UPDATE "ZoomCall" 
          SET acronym = $1, "clientProfileId" = $2
          WHERE id = $3
        `, [matchedClient.acronym, matchedClient.id, call.id]);
        matchedCount++;
      } else {
        console.log(`✗ No match found for: ${call.topic || 'Untitled'} (${call.ghlContactName || 'no contact name'})`);
      }
    }
    
    console.log(`\nTask 1 complete: ${matchedCount} of ${unmatchedResult.rows.length} calls matched to clients\n`);
    
    return { total: unmatchedResult.rows.length, matched: matchedCount };
    
  } finally {
    await client.end();
  }
}

async function task2_createNotionRecords() {
  console.log('\n=== TASK 2: Create Notion-sourced meeting records ===\n');
  
  const pgClient = new Client({ connectionString: DATABASE_URL });
  await pgClient.connect();
  
  const notion = new NotionClient({ auth: NOTION_API_KEY });
  
  let totalCreated = 0;
  const createdByClient = {};
  
  try {
    // Get client profile data for company names
    const clientsResult = await pgClient.query(`
      SELECT acronym, "companyName", id
      FROM "ClientProfile"
      WHERE "tenantId" = 'gyc'
    `);
    
    const clientsByAcronym = {};
    for (const client of clientsResult.rows) {
      clientsByAcronym[client.acronym] = client;
    }
    
    for (const [acronym, pageId] of Object.entries(NOTION_PAGES)) {
      console.log(`\nProcessing ${acronym}...`);
      
      const client = clientsByAcronym[acronym];
      if (!client) {
        console.log(`  ⚠ No ClientProfile found for ${acronym}, skipping`);
        continue;
      }
      
      createdByClient[acronym] = 0;
      
      try {
        // Fetch blocks from the page
        const blocks = await notion.blocks.children.list({
          block_id: pageId,
          page_size: 100
        });
        
        console.log(`  Found ${blocks.results.length} blocks`);
        
        // Extract heading_3 dates and content
        for (let i = 0; i < blocks.results.length; i++) {
          const block = blocks.results[i];
          
          if (block.type === 'heading_3' && block.heading_3?.rich_text?.[0]?.plain_text) {
            const heading = block.heading_3.rich_text[0].plain_text.trim();
            
            // Parse date from heading (expect format like "May 15, 2024" or "2024-05-15")
            const dateMatch = heading.match(/(\w+\s+\d{1,2},\s+\d{4}|\d{4}-\d{2}-\d{2})/);
            if (!dateMatch) continue;
            
            const dateStr = dateMatch[1];
            let parsedDate;
            
            try {
              parsedDate = new Date(dateStr);
              if (isNaN(parsedDate.getTime())) continue;
            } catch (e) {
              continue;
            }
            
            // Format for ID: YYYYMMDD
            const dateForId = parsedDate.toISOString().split('T')[0].replace(/-/g, '');
            const recordId = `notion_${acronym.toLowerCase()}_${dateForId}`;
            
            // Check if already exists
            const existsResult = await pgClient.query(
              `SELECT id FROM "ZoomCall" WHERE id = $1`,
              [recordId]
            );
            
            if (existsResult.rows.length > 0) {
              console.log(`  ⊘ Already exists: ${recordId}`);
              continue;
            }
            
            // Collect content from following blocks until next heading
            let contentBlocks = [];
            for (let j = i + 1; j < blocks.results.length; j++) {
              const nextBlock = blocks.results[j];
              if (nextBlock.type.startsWith('heading')) break;
              
              if (nextBlock.type === 'paragraph' && nextBlock.paragraph?.rich_text?.[0]?.plain_text) {
                contentBlocks.push(nextBlock.paragraph.rich_text[0].plain_text);
              } else if (nextBlock.type === 'bulleted_list_item' && nextBlock.bulleted_list_item?.rich_text?.[0]?.plain_text) {
                contentBlocks.push('• ' + nextBlock.bulleted_list_item.rich_text[0].plain_text);
              }
            }
            
            const aiSummary = contentBlocks.length > 0 ? contentBlocks.join('\n') : null;
            
            // Create ZoomCall record
            await pgClient.query(`
              INSERT INTO "ZoomCall" (
                id, "tenantId", acronym, "clientProfileId", "aiClassification", "classifiedAs",
                topic, "startTime", "aiSummary", "createdAt"
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
            `, [
              recordId,
              'gyc',
              acronym,
              client.id,
              'client_meeting',
              'client_meeting',
              `Marketing Review — ${client.companyName}`,
              parsedDate.toISOString(),
              aiSummary
            ]);
            
            console.log(`  ✓ Created: ${recordId} (${dateStr})`);
            createdByClient[acronym]++;
            totalCreated++;
          }
        }
        
      } catch (err) {
        console.log(`  ✗ Error processing ${acronym}: ${err.message}`);
      }
    }
    
    console.log('\nTask 2 complete:');
    for (const [acronym, count] of Object.entries(createdByClient)) {
      if (count > 0) {
        console.log(`  ${acronym}: ${count} new records`);
      }
    }
    console.log(`Total new Notion-sourced records: ${totalCreated}\n`);
    
    return { totalCreated, createdByClient };
    
  } finally {
    await pgClient.end();
  }
}

async function main() {
  console.log('Starting meeting tabs population...\n');
  
  // Run both tasks in parallel
  const [task1Result, task2Result] = await Promise.all([
    task1_matchUnmatchedCalls(),
    task2_createNotionRecords()
  ]);
  
  // Final count
  const pgClient = new Client({ connectionString: DATABASE_URL });
  await pgClient.connect();
  
  const totalResult = await pgClient.query(`
    SELECT COUNT(*) as count
    FROM "ZoomCall"
    WHERE "tenantId" = 'gyc'
      AND "aiClassification" = 'client_meeting'
  `);
  
  await pgClient.end();
  
  console.log('\n=== SUMMARY ===');
  console.log(`Task 1: ${task1Result.matched} of ${task1Result.total} unmatched calls matched to clients`);
  console.log(`Task 2: ${task2Result.totalCreated} new Notion-sourced records created`);
  console.log(`Total meetings in DB: ${totalResult.rows[0].count}`);
  console.log('\nDone!\n');
}

main().catch(console.error);
