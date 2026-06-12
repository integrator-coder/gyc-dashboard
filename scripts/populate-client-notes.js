#!/usr/bin/env node
/**
 * Populate ClientProfile.notes and ClientProfile.teamNotes from Notion
 * 
 * For each accessible client notes page:
 * 1. Fetch all blocks (including toggle children for dated entries)
 * 2. Extract text content
 * 3. Summarize into notes (last 3 meetings) and teamNotes (full context)
 * 4. Update ClientProfile in database
 */

require('dotenv').config({ path: '.env.local' });
const { Client } = require('@notionhq/client');
const { PrismaClient } = require('@prisma/client');

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const prisma = new PrismaClient();

// Known accessible client notes pages
const knownPages = [
  { acronym: 'CTI', pageId: 'd5c222d0-d622-44ad-b57c-5dadd4a8ae8b' },
  { acronym: 'HAA', pageId: 'a50ca865-e197-8320-93cf-8169277ae0db' },
  { acronym: 'RMP', pageId: '0381626f-22aa-4b97-8e92-9267539a491a' },
  { acronym: 'UTMPT', pageId: '175402df-fb93-431b-8e43-e8de13ffdfff' },
  { acronym: 'PPELC', pageId: '368b075c-c590-4336-9fb7-b7c2070931d8' },
  { acronym: 'LSA', pageId: '3a354c08-a41e-4368-91bd-ab5bf02ce523' },
  { acronym: 'TCLA', pageId: '4d143aa2-8565-468a-9d35-2d8e75a9f39f' },
  { acronym: 'WLC', pageId: '4fb87c6a-fb97-44ef-8e01-cdf7d47bc0bb' },
  { acronym: 'MCCC', pageId: '52c460fa-db70-45ef-90c2-f29a0f091d9b' },
  { acronym: 'BBC', pageId: '539a7786-7ae6-4152-9a06-29b30016bcbd' },
  { acronym: 'AJT', pageId: '6ad2800c-3f51-420f-ba25-69fd52090cbf' },
  { acronym: 'TATLC', pageId: '940199c1-350e-4694-9b45-d25c51d1de44' },
  { acronym: 'C2C', pageId: 'd01fee5f-0851-4484-a8e7-c6d1e03f65d6' },
  { acronym: 'RVMCC', pageId: 'e4a3b44d-dd25-4627-a729-4aff937a6743' },
  { acronym: 'CCA+CCP', pageId: 'eb3b390f-97eb-4504-b8b1-5eee4ed7f52c' },
];

/**
 * Extract plain text from a rich text array
 */
function extractRichText(richTextArray) {
  if (!richTextArray || !Array.isArray(richTextArray)) return '';
  return richTextArray.map(rt => rt.plain_text || '').join('');
}

/**
 * Recursively fetch all blocks from a page/block, including toggle children
 */
async function fetchAllBlocks(blockId, depth = 0) {
  const blocks = [];
  let hasMore = true;
  let startCursor = undefined;
  
  while (hasMore) {
    try {
      const response = await notion.blocks.children.list({
        block_id: blockId,
        start_cursor: startCursor,
        page_size: 100,
      });
      
      for (const block of response.results) {
        blocks.push(block);
        
        // If it's a toggle block (heading_3 with date), fetch its children
        if (block.type === 'toggle' || (block.has_children && depth < 3)) {
          const children = await fetchAllBlocks(block.id, depth + 1);
          block.children = children;
        }
      }
      
      hasMore = response.has_more;
      startCursor = response.next_cursor;
    } catch (error) {
      console.error(`Error fetching blocks from ${blockId}:`, error.message);
      break;
    }
  }
  
  return blocks;
}

/**
 * Extract text content from blocks recursively
 */
function extractTextFromBlocks(blocks, includeHeadings = true) {
  let text = '';
  
  for (const block of blocks) {
    const type = block.type;
    
    if (type === 'paragraph' && block.paragraph?.rich_text) {
      text += extractRichText(block.paragraph.rich_text) + '\n';
    } else if (type === 'heading_1' && includeHeadings && block.heading_1?.rich_text) {
      text += '# ' + extractRichText(block.heading_1.rich_text) + '\n';
    } else if (type === 'heading_2' && includeHeadings && block.heading_2?.rich_text) {
      text += '## ' + extractRichText(block.heading_2.rich_text) + '\n';
    } else if (type === 'heading_3' && includeHeadings && block.heading_3?.rich_text) {
      text += '### ' + extractRichText(block.heading_3.rich_text) + '\n';
    } else if (type === 'bulleted_list_item' && block.bulleted_list_item?.rich_text) {
      text += '• ' + extractRichText(block.bulleted_list_item.rich_text) + '\n';
    } else if (type === 'numbered_list_item' && block.numbered_list_item?.rich_text) {
      text += '- ' + extractRichText(block.numbered_list_item.rich_text) + '\n';
    } else if (type === 'toggle' && block.toggle?.rich_text) {
      text += '### ' + extractRichText(block.toggle.rich_text) + '\n';
    }
    
    // Process children recursively
    if (block.children && block.children.length > 0) {
      text += extractTextFromBlocks(block.children, includeHeadings);
    }
  }
  
  return text;
}

/**
 * Parse meeting entries from content
 * Looks for headings with dates and extracts content below them
 */
function parseMeetingEntries(content) {
  const lines = content.split('\n');
  const meetings = [];
  let currentMeeting = null;
  
  for (const line of lines) {
    // Check if line is a heading with a date pattern (various formats)
    const datePatterns = [
      /^###?\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,  // MM/DD/YYYY or variations
      /^###?\s+(\w+\s+\d{1,2},?\s+\d{4})/,            // Month DD, YYYY
      /^###?\s+(\d{4}-\d{2}-\d{2})/,                  // YYYY-MM-DD
    ];
    
    let isDateHeading = false;
    for (const pattern of datePatterns) {
      if (pattern.test(line)) {
        // Save previous meeting if exists
        if (currentMeeting && currentMeeting.content.trim()) {
          meetings.push(currentMeeting);
        }
        
        currentMeeting = {
          date: line.replace(/^###?\s+/, '').trim(),
          content: ''
        };
        isDateHeading = true;
        break;
      }
    }
    
    if (!isDateHeading && currentMeeting && line.trim()) {
      currentMeeting.content += line + '\n';
    }
  }
  
  // Save last meeting
  if (currentMeeting && currentMeeting.content.trim()) {
    meetings.push(currentMeeting);
  }
  
  return meetings;
}

/**
 * Generate summary for last 3 meetings
 */
function generateNotesSummary(meetings) {
  if (meetings.length === 0) return '';
  
  const last3 = meetings.slice(-3);
  let summary = '';
  
  for (const meeting of last3) {
    summary += `**${meeting.date}**\n`;
    const lines = meeting.content.split('\n').filter(l => l.trim());
    for (const line of lines.slice(0, 5)) {  // First 5 lines per meeting
      summary += line + '\n';
    }
    summary += '\n';
  }
  
  return summary.trim();
}

/**
 * Generate full team notes summary
 */
function generateTeamNotes(content, meetings) {
  let teamNotes = '';
  
  // Add meeting count context
  if (meetings.length > 0) {
    teamNotes += `Total meetings documented: ${meetings.length}\n\n`;
  }
  
  // Extract key themes and issues (look for repeated keywords)
  const allContent = content.toLowerCase();
  const issues = [];
  
  // Common issue keywords
  const issueKeywords = [
    'issue', 'problem', 'concern', 'challenge', 'blocker',
    'escalation', 'complaint', 'frustrated', 'unhappy',
    'bug', 'error', 'failed', 'not working'
  ];
  
  for (const keyword of issueKeywords) {
    if (allContent.includes(keyword)) {
      issues.push(keyword);
    }
  }
  
  if (issues.length > 0) {
    teamNotes += `Keywords found: ${issues.join(', ')}\n\n`;
  }
  
  // Add condensed full content (first 1000 chars as context)
  teamNotes += content.slice(0, 1000);
  if (content.length > 1000) {
    teamNotes += '...\n\n[Content truncated - full notes in Notion]';
  }
  
  return teamNotes.trim();
}

/**
 * Process a single client's Notion page
 */
async function processClientPage(acronym, pageId) {
  console.log(`\nProcessing ${acronym}...`);
  
  try {
    // Fetch all blocks from the page
    const blocks = await fetchAllBlocks(pageId);
    console.log(`  Fetched ${blocks.length} top-level blocks`);
    
    if (blocks.length === 0) {
      console.log(`  ⚠️  No content found`);
      return { acronym, success: false, reason: 'empty' };
    }
    
    // Extract all text content
    const fullContent = extractTextFromBlocks(blocks);
    
    if (!fullContent.trim()) {
      console.log(`  ⚠️  No text content extracted`);
      return { acronym, success: false, reason: 'no-text' };
    }
    
    // Parse meeting entries
    const meetings = parseMeetingEntries(fullContent);
    console.log(`  Found ${meetings.length} meeting entries`);
    
    // Generate summaries
    const notes = generateNotesSummary(meetings);
    const teamNotes = generateTeamNotes(fullContent, meetings);
    
    // Update database
    const updated = await prisma.clientProfile.updateMany({
      where: { acronym },
      data: {
        notes: notes || 'No recent meeting notes found',
        teamNotes: teamNotes || fullContent.slice(0, 1000),
      },
    });
    
    if (updated.count === 0) {
      console.log(`  ⚠️  Client not found in database`);
      return { acronym, success: false, reason: 'not-in-db' };
    }
    
    console.log(`  ✅ Updated (${notes.length} chars notes, ${teamNotes.length} chars teamNotes)`);
    return { 
      acronym, 
      success: true, 
      meetingCount: meetings.length,
      notesLength: notes.length,
      teamNotesLength: teamNotes.length
    };
    
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return { acronym, success: false, reason: error.message };
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('Starting Notion client notes population...\n');
  console.log(`Processing ${knownPages.length} known client pages\n`);
  
  const results = [];
  
  for (const page of knownPages) {
    const result = await processClientPage(page.acronym, page.pageId);
    results.push(result);
    
    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`\n✅ Successfully updated: ${successful.length}`);
  for (const r of successful) {
    console.log(`   ${r.acronym}: ${r.meetingCount} meetings, ${r.notesLength} chars notes`);
  }
  
  if (failed.length > 0) {
    console.log(`\n❌ Failed: ${failed.length}`);
    for (const r of failed) {
      console.log(`   ${r.acronym}: ${r.reason}`);
    }
  }
  
  console.log('\nDone!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
