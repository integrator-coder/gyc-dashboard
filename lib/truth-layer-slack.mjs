import { config } from 'dotenv';

// Load environment variables
config({ path: '/Users/toddthejedigmail.com/.openclaw/workspace/gyc-dashboard/.env.local' });

const SLACK_CHANNEL_ID = 'C03KPKVBCRX'; // GYC-Leadership

/**
 * Post truth layer report to Slack
 * Uses OpenClaw Slack tool via exec
 */
export async function postToSlack(report) {
  const { status, summary, issues, checks } = report;

  let message = '';

  if (status === 'ALL_CLEAR') {
    // Short green message
    message = `✅ *Dashboard Truth Layer: All ${summary.total} checks passed — data looks clean.*`;
  } else {
    // Detailed issue report
    message = `🔍 *Dashboard Truth Layer — Daily Check*\n`;
    message += `⚠️ ${issues.length} issue${issues.length > 1 ? 's' : ''} found `;
    message += `(${summary.failures} FAIL, ${summary.warnings} WARN)\n\n`;

    // Show failures first
    const failures = issues.filter(i => i.status === 'FAIL');
    failures.forEach(issue => {
      message += `❌ *FAIL* — ${issue.name}\n`;
      message += `   ${issue.detail}\n\n`;
    });

    // Then warnings
    const warnings = issues.filter(i => i.status === 'WARN');
    warnings.forEach(issue => {
      message += `⚠️ *WARN* — ${issue.name}\n`;
      message += `   ${issue.detail}\n\n`;
    });

    message += `✅ ${summary.passed} check${summary.passed !== 1 ? 's' : ''} passed`;
  }

  // Post to Slack using OpenClaw Slack tool
  // This will be called by Wall·E who has access to the Slack tool
  console.log('\n📤 Posting to Slack...\n');
  console.log(message);
  console.log('\n---');
  console.log('Channel ID:', SLACK_CHANNEL_ID);
  
  return {
    channel: SLACK_CHANNEL_ID,
    message,
    report
  };
}

/**
 * Standalone runner that imports the report and posts to Slack
 */
async function main() {
  try {
    // Import the report from truth-layer.mjs (which runs the checks)
    const { report } = await import('../scripts/truth-layer.mjs');
    
    const result = await postToSlack(report);
    
    console.log('\n✅ Slack notification prepared');
    console.log('\nTo post to Slack, Wall·E needs to run:');
    console.log(`/slack send C03KPKVBCRX "${result.message}"`);
    
    return result;
  } catch (error) {
    console.error('❌ Error preparing Slack notification:', error);
    throw error;
  }
}

// If run directly (not imported), execute main
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
