#!/usr/bin/env node
// Insert QuickChart.io charts into GYC CEO Revenue Report Google Doc

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const DOC_ID = '15scnaOycWILyC3OHQTEsv--9vfF47sxlJNR0Pi4VSNQ';
const CREDS_PATH = path.join(process.env.HOME, '.openclaw/credentials/google-console.json');

// Build QuickChart URLs
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

// Chart 3: MRR Trajectory Line Chart
const chart3Config = {
  type: 'line',
  data: {
    labels: ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    datasets: [
      {
        label: 'Base Case (2.5% churn, 10 deals/mo)',
        data: [221675, 228621, 241022, 249299, 259806, 278728, 287223, 294012],
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99,102,241,0.1)',
        fill: false,
        tension: 0.3
      },
      {
        label: 'Target Case (1.8% churn, 15 deals/mo + $3K expansion)',
        data: [235000, 255000, 275000, 295000, 315000, 335000, 355000, 375000],
        borderColor: '#10b981',
        backgroundColor: 'rgba(16,185,129,0.1)',
        fill: false,
        tension: 0.3
      },
      {
        label: 'Current MRR ($213,334)',
        data: [213334, 213334, 213334, 213334, 213334, 213334, 213334, 213334],
        borderColor: '#9ca3af',
        backgroundColor: 'rgba(156,163,175,0.1)',
        borderDash: [5, 5],
        fill: false,
        tension: 0
      }
    ]
  },
  options: {
    plugins: {
      title: { display: true, text: 'Projected MRR Growth \u2014 May to December 2026', font: { size: 16 } },
      legend: { display: true }
    },
    scales: {
      y: {
        ticks: {
          callback: "function(value) { return '$' + (value/1000).toFixed(0) + 'K'; }"
        }
      },
      x: {
        title: { display: true, text: 'Month (2026)' }
      }
    }
  }
};

const chart1Url = buildChartUrl(chart1Config);
const chart2Url = buildChartUrl(chart2Config);
const chart3Url = buildChartUrl(chart3Config);

console.log('Chart 1 URL length:', chart1Url.length);
console.log('Chart 2 URL length:', chart2Url.length);
console.log('Chart 3 URL length:', chart3Url.length);

async function getAuthClient() {
  const creds = JSON.parse(fs.readFileSync(CREDS_PATH, 'utf8'));
  
  // Check if it's a service account
  if (creds.type === 'service_account') {
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: [
        'https://www.googleapis.com/auth/documents',
        'https://www.googleapis.com/auth/drive'
      ]
    });
    return auth.getClient();
  }
  
  // OAuth2 with refresh token
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

async function getDoc(docs) {
  const res = await docs.documents.get({ documentId: DOC_ID });
  return res.data;
}

function findTextIndex(content, searchText) {
  for (const elem of content) {
    if (elem.paragraph) {
      for (const pe of elem.paragraph.elements) {
        if (pe.textRun && pe.textRun.content.includes(searchText)) {
          // Return end index of this paragraph
          return elem.endIndex;
        }
      }
    }
    if (elem.table) {
      // Search within table cells
      for (const row of elem.table.tableRows) {
        for (const cell of row.tableCells) {
          for (const cellElem of cell.content) {
            if (cellElem.paragraph) {
              for (const pe of cellElem.paragraph.elements) {
                if (pe.textRun && pe.textRun.content.includes(searchText)) {
                  return elem.endIndex;
                }
              }
            }
          }
        }
      }
    }
  }
  return null;
}

function dumpDocStructure(content) {
  console.log('\n=== DOC STRUCTURE ===');
  for (let i = 0; i < content.length; i++) {
    const elem = content[i];
    if (elem.paragraph) {
      const text = elem.paragraph.elements.map(e => e.textRun?.content || '').join('');
      if (text.trim()) {
        const style = elem.paragraph.paragraphStyle?.namedStyleType || '';
        console.log(`[${elem.startIndex}-${elem.endIndex}] ${style}: ${text.substring(0, 80).replace(/\n/g, '\\n')}`);
      }
    } else if (elem.table) {
      console.log(`[${elem.startIndex}-${elem.endIndex}] TABLE (${elem.table.rows}x${elem.table.columns})`);
    } else if (elem.sectionBreak) {
      console.log(`[${elem.startIndex}-${elem.endIndex}] SECTION_BREAK`);
    }
  }
  console.log('=== END STRUCTURE ===\n');
}

async function main() {
  const auth = await getAuthClient();
  const docs = google.docs({ version: 'v1', auth });
  
  console.log('Fetching document...');
  const doc = await getDoc(docs);
  const content = doc.body.content;
  
  dumpDocStructure(content);
  
  // Find insertion points by searching for key text
  // Chart 1: after revenue table in "WHERE WE STAND" section
  // Chart 2: after PIF conversion table in "THE PIF STRATEGY" section
  // Chart 3: after "LOOKING AT 2027" section header
  
  let chart1Index = null;
  let chart2Index = null;
  let chart3Index = null;
  
  // Search for key text markers
  for (const elem of content) {
    const text = elem.paragraph?.elements?.map(e => e.textRun?.content || '').join('') || '';
    
    // Look for section markers
    if (text.includes('WHERE WE STAND') || text.includes('Where We Stand')) {
      console.log('Found WHERE WE STAND at:', elem.startIndex, '-', elem.endIndex);
    }
    if (text.includes('THE PIF STRATEGY') || text.includes('Pif Strategy') || text.includes('PIF STRATEGY')) {
      console.log('Found PIF STRATEGY at:', elem.startIndex, '-', elem.endIndex);
    }
    if (text.includes('LOOKING AT 2027') || text.includes('Looking at 2027') || text.includes('2027')) {
      console.log('Found 2027 ref at:', elem.startIndex, '-', elem.endIndex, ':', text.substring(0, 60));
    }
    
    // Find tables to use as insertion reference
    if (elem.table) {
      // Check if any cell contains revenue-related text
      let tableText = '';
      for (const row of elem.table.tableRows) {
        for (const cell of row.tableCells) {
          for (const cellElem of cell.content) {
            tableText += cellElem.paragraph?.elements?.map(e => e.textRun?.content || '').join('') || '';
          }
        }
      }
      if (tableText.includes('2023') || tableText.includes('Annual') || tableText.includes('Revenue')) {
        console.log('Revenue table at:', elem.startIndex, '-', elem.endIndex);
        if (!chart1Index) chart1Index = elem.endIndex - 1;
      }
      if (tableText.includes('PIF') || tableText.includes('Jan') || tableText.includes('MRR')) {
        console.log('PIF/MRR table at:', elem.startIndex, '-', elem.endIndex);
        if (!chart2Index) chart2Index = elem.endIndex - 1;
      }
    }
  }
  
  // Find 2027 section for chart 3
  for (const elem of content) {
    const text = elem.paragraph?.elements?.map(e => e.textRun?.content || '').join('') || '';
    if (text.match(/2027/i) && (text.match(/LOOKING|PROJECTION|TOWARD|PATH/i) || elem.paragraph?.paragraphStyle?.namedStyleType?.includes('HEADING'))) {
      chart3Index = elem.endIndex - 1;
      console.log('Chart 3 insertion after:', text.substring(0, 80));
    }
  }
  
  console.log('\nInsertion indices:', { chart1Index, chart2Index, chart3Index });
  
  // If we couldn't find specific locations, use fallback positions
  // Find all table end indices
  const tableEndIndices = content
    .filter(e => e.table)
    .map(e => e.endIndex - 1);
  
  console.log('All table end indices:', tableEndIndices);
  
  // Insert charts - we'll do them in reverse order so indices don't shift
  const insertions = [];
  
  if (chart3Index) insertions.push({ index: chart3Index, url: chart3Url, label: 'Chart 3 (MRR Trajectory)' });
  if (chart2Index && chart2Index !== chart1Index) insertions.push({ index: chart2Index, url: chart2Url, label: 'Chart 2 (PIF Pipeline)' });
  if (chart1Index) insertions.push({ index: chart1Index, url: chart1Url, label: 'Chart 1 (Revenue Trend)' });
  
  // Sort by index descending (insert from end to preserve earlier indices)
  insertions.sort((a, b) => b.index - a.index);
  
  console.log('\nPlanned insertions (desc order):', insertions.map(i => `${i.label} at index ${i.index}`));
  
  const results = [];
  
  for (const insertion of insertions) {
    try {
      console.log(`\nInserting ${insertion.label} at index ${insertion.index}...`);
      await docs.documents.batchUpdate({
        documentId: DOC_ID,
        requestBody: {
          requests: [{
            insertInlineImage: {
              location: { index: insertion.index },
              uri: insertion.url,
              objectSize: {
                height: { magnitude: 220, unit: 'PT' },
                width: { magnitude: 480, unit: 'PT' }
              }
            }
          }]
        }
      });
      console.log(`✅ ${insertion.label} inserted successfully`);
      results.push({ label: insertion.label, success: true });
    } catch (err) {
      console.error(`❌ Failed to insert ${insertion.label}:`, err.message);
      results.push({ label: insertion.label, success: false, error: err.message });
    }
  }
  
  console.log('\n=== RESULTS ===');
  for (const r of results) {
    console.log(`${r.success ? '✅' : '❌'} ${r.label}${r.error ? ': ' + r.error : ''}`);
  }
  console.log(`\nDoc link: https://docs.google.com/document/d/${DOC_ID}/edit`);
}

main().catch(console.error);
