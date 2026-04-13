#!/usr/bin/env node
// Insert Charts 1 and 2 into GYC CEO Revenue Report

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const DOC_ID = '15scnaOycWILyC3OHQTEsv--9vfF47sxlJNR0Pi4VSNQ';
const CREDS_PATH = path.join(process.env.HOME, '.openclaw/credentials/google-console.json');

function buildChartUrl(config) {
  const encoded = encodeURIComponent(JSON.stringify(config));
  return `https://quickchart.io/chart?c=${encoded}&width=800&height=400&backgroundColor=white`;
}

// Chart 1: Annual Revenue Trend
const chart1Config = {
  type: 'bar',
  data: {
    labels: ['2023', '2024', '2025', '2026 Base', '2026 Target'],
    datasets: [{
      label: 'Revenue',
      data: [3475667, 3803233, 3729570, 3550000, 4200000],
      backgroundColor: ['#6366f1', '#6366f1', '#6366f1', '#f59e0b', '#10b981']
    }]
  },
  options: {
    plugins: {
      title: { display: true, text: 'GYC Annual Revenue \u2014 2023 to 2026 Projection', font: { size: 16 } },
      legend: { display: false }
    },
    scales: {
      y: {
        ticks: {
          callback: "function(value) { return '$' + (value/1000000).toFixed(1) + 'M'; }"
        }
      }
    }
  }
};

// Chart 2: PIF-to-MRR Conversion Pipeline
const chart2Config = {
  type: 'bar',
  data: {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
    datasets: [{
      label: 'New MRR ($)',
      data: [2620, 8301, 0, 4196, 1499, 0, 0, 765, 699],
      backgroundColor: [
        '#10b981', '#10b981', '#6366f1', '#6366f1',
        '#6366f1', '#6366f1', '#6366f1', '#6366f1', '#6366f1'
      ]
    }]
  },
  options: {
    plugins: {
      title: { display: true, text: 'PIF Deals Converting to Monthly MRR \u2014 2026', font: { size: 16 } },
      legend: { display: false }
    },
    scales: {
      y: {
        title: { display: true, text: 'New MRR Arriving ($)' }
      },
      x: {
        title: { display: true, text: 'Month (2026)' }
      }
    }
  }
};

const chart1Url = buildChartUrl(chart1Config);
const chart2Url = buildChartUrl(chart2Config);

async function getAuthClient() {
  const creds = JSON.parse(fs.readFileSync(CREDS_PATH, 'utf8'));
  if (creds.type === 'service_account') {
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/documents']
    });
    return auth.getClient();
  }
  const oauth2Client = new google.auth.OAuth2(
    creds.client_id || creds.installed?.client_id,
    creds.client_secret || creds.installed?.client_secret
  );
  if (creds.refresh_token) {
    oauth2Client.setCredentials({ refresh_token: creds.refresh_token });
  } else if (creds.token) {
    oauth2Client.setCredentials(creds.token);
  }
  return oauth2Client;
}

async function main() {
  const auth = await getAuthClient();
  const docs = google.docs({ version: 'v1', auth });

  console.log('Fetching current document to find fresh indices...');
  const res = await docs.documents.get({ documentId: DOC_ID });
  const content = res.data.body.content;

  // Find insertion indices by searching for specific text markers
  let chart1Index = null; // After revenue table: after "| 2026 (pace)"  row
  let chart2Index = null; // After PIF table total row: after "| **Total**"

  for (const elem of content) {
    if (elem.paragraph) {
      const text = elem.paragraph.elements.map(e => e.textRun?.content || '').join('');
      
      // Chart 1: insert after the last revenue table row (2026 pace row)
      if (text.includes('2026 (pace)') || text.includes('~$3,550,000')) {
        chart1Index = elem.endIndex - 1;
        console.log(`Chart 1 insertion: after "${text.trim().substring(0, 60)}" at index ${chart1Index}`);
      }
      
      // Chart 2: insert after the PIF table total row
      if (text.includes('**Total**') && text.includes('$18,080')) {
        chart2Index = elem.endIndex - 1;
        console.log(`Chart 2 insertion: after "${text.trim().substring(0, 60)}" at index ${chart2Index}`);
      }
    }
  }

  if (!chart1Index) {
    console.error('Could not find Chart 1 insertion point!');
  }
  if (!chart2Index) {
    console.error('Could not find Chart 2 insertion point!');
  }

  // Insert in reverse order (highest index first) to preserve earlier indices
  const insertions = [];
  if (chart2Index) insertions.push({ index: chart2Index, url: chart2Url, label: 'Chart 2 (PIF Pipeline)' });
  if (chart1Index) insertions.push({ index: chart1Index, url: chart1Url, label: 'Chart 1 (Revenue Trend)' });
  insertions.sort((a, b) => b.index - a.index);

  console.log('\nInserting charts...');
  const results = [];

  for (const ins of insertions) {
    try {
      console.log(`Inserting ${ins.label} at index ${ins.index}...`);
      await docs.documents.batchUpdate({
        documentId: DOC_ID,
        requestBody: {
          requests: [{
            insertInlineImage: {
              location: { index: ins.index },
              uri: ins.url,
              objectSize: {
                height: { magnitude: 220, unit: 'PT' },
                width: { magnitude: 480, unit: 'PT' }
              }
            }
          }]
        }
      });
      console.log(`✅ ${ins.label} inserted`);
      results.push({ label: ins.label, success: true });
    } catch (err) {
      console.error(`❌ Failed ${ins.label}: ${err.message}`);
      results.push({ label: ins.label, success: false, error: err.message });
    }
  }

  console.log('\n=== FINAL RESULTS ===');
  for (const r of results) {
    console.log(`${r.success ? '✅' : '❌'} ${r.label}${r.error ? ': ' + r.error : ''}`);
  }
  console.log(`\nDoc: https://docs.google.com/document/d/${DOC_ID}/edit`);
}

main().catch(console.error);
