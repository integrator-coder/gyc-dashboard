#!/usr/bin/env node

/**
 * Truth Layer Runner with Slack Integration
 * This script:
 * 1. Runs the truth layer validation checks
 * 2. Prepares the Slack message
 * 3. Outputs the message for Wall·E to post via Slack tool
 */

import { postToSlack } from '../lib/truth-layer-slack.mjs';

async function main() {
  console.log('🤖 Truth Layer Runner\n');
  
  try {
    // Import and run the checks (this runs automatically on import)
    const { report } = await import('./truth-layer.mjs');
    
    // Prepare Slack notification
    const slackResult = await postToSlack(report);
    
    // Output JSON for programmatic use
    console.log('\n' + '═'.repeat(60));
    console.log('📋 OUTPUT FOR AUTOMATION:\n');
    console.log(JSON.stringify({
      slackChannel: slackResult.channel,
      slackMessage: slackResult.message,
      report: {
        status: report.status,
        summary: report.summary,
        issueCount: report.issues.length
      }
    }, null, 2));
    
    process.exit(report.status === 'ALL_CLEAR' ? 0 : 1);
  } catch (error) {
    console.error('❌ Error running truth layer:', error);
    process.exit(2);
  }
}

main();
