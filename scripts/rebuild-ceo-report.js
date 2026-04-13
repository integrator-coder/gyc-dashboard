#!/usr/bin/env node
// Rebuild GYC CEO Revenue Report — 5 charts, better table formatting

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const https = require('https');

const DOC_ID = '15scnaOycWILyC3OHQTEsv--9vfF47sxlJNR0Pi4VSNQ';
const CREDS_PATH = path.join(process.env.HOME, '.openclaw/credentials/google-console.json');

// === MRR SCENARIO CALCULATIONS ===
const startMRR = 213334;
const AVG_MRR_PER_DEAL = 864;
const months8 = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pifByMonth = {
  May: 1499, Jun: 0, Jul: 0, Aug: 765,
  Sep: 699, Oct: 0, Nov: 0, Dec: 0
};

function calcMRR(churn, dealsPerMonth, gaUpsellMRR) {
  const newMRR = dealsPerMonth * AVG_MRR_PER_DEAL + gaUpsellMRR;
  let mrr = startMRR;
  return months8.map(m => {
    mrr = mrr * (1 - churn) + newMRR + (pifByMonth[m] || 0);
    return Math.round(mrr);
  });
}

const baseMRR  = calcMRR(0.025, 10, 0);
const jesseMRR = calcMRR(0.020, 15, 0);
const fullMRR  = calcMRR(0.018, 15, 4500);

console.log('\n=== MRR SCENARIO RESULTS ===');
months8.forEach((m, i) => {
  console.log(`${m} 2026: Base=$${baseMRR[i].toLocaleString()}  Jesse=$${jesseMRR[i].toLocaleString()}  Full=$${fullMRR[i].toLocaleString()}`);
});
console.log('\nDec 2026 Summary:');
console.log(`  Base MRR: $${baseMRR[7].toLocaleString()} → ARR: $${(baseMRR[7]*12).toLocaleString()}`);
console.log(`  Jesse MRR: $${jesseMRR[7].toLocaleString()} → ARR: $${(jesseMRR[7]*12).toLocaleString()}`);
console.log(`  Full MRR: $${fullMRR[7].toLocaleString()} → ARR: $${(fullMRR[7]*12).toLocaleString()}`);

// === CHART CONFIGS ===

// Chart 1: Annual Revenue Trend
const chart1 = {
  type: 'bar',
  data: {
    labels: ['2023', '2024', '2025', '2026\nBase', '2026\nTarget'],
    datasets: [{
      label: 'Annual Revenue',
      data: [3475667, 3803233, 3729570, 3550000, 4200000],
      backgroundColor: ['#731494', '#731494', '#731494', '#C19C46', '#340B67'],
      borderRadius: 4
    }]
  },
  options: {
    plugins: {
      title: {
        display: true,
        text: 'GYC Annual Revenue — 2023 to 2026 Projection',
        font: { size: 16, weight: 'bold' },
        color: '#340B67'
      },
      legend: { display: false }
    },
    scales: {
      y: {
        ticks: {
          callback: "function(v){ return '$'+(v/1e6).toFixed(1)+'M'; }"
        },
        grid: { color: '#f3f4f6' }
      },
      x: { grid: { display: false } }
    }
  }
};

// Chart 2: PIF-to-MRR Conversion Pipeline (Jan 26 → Mar 27, 15 months)
const pif15labels = [
  'Jan 26','Feb 26','Mar 26','Apr 26','May 26','Jun 26','Jul 26',
  'Aug 26','Sep 26','Oct 26','Nov 26','Dec 26','Jan 27','Feb 27','Mar 27'
];
const pif15values = [2620, 8301, 0, 4196, 1499, 0, 0, 765, 699, 0, 0, 0, 2196, 3498, 2639];
const pif15colors = pif15values.map((v, i) => {
  if (i < 2) return '#C19C46';      // Jan-Feb 26 already converted = gold
  if (v === 0) return '#e5e7eb';    // zero months = light gray
  return '#731494';                  // remaining = violet
});

const chart2 = {
  type: 'bar',
  data: {
    labels: pif15labels,
    datasets: [{
      label: 'New MRR Arriving ($)',
      data: pif15values,
      backgroundColor: pif15colors,
      borderRadius: 3
    }]
  },
  options: {
    plugins: {
      title: {
        display: true,
        text: 'PIF-to-MRR Conversion Pipeline (Jan 2026 → Mar 2027)',
        font: { size: 15, weight: 'bold' },
        color: '#340B67'
      },
      legend: {
        display: true,
        labels: {
          generateLabels: "function(chart){ return [{text:'✅ Already Converted',fillStyle:'#C19C46'},{text:'Scheduled Conversions',fillStyle:'#731494'},{text:'No Conversion',fillStyle:'#e5e7eb'}]; }"
        }
      }
    },
    scales: {
      y: {
        title: { display: true, text: 'New MRR Arriving ($)' },
        ticks: { callback: "function(v){ return '$'+v.toLocaleString(); }" },
        grid: { color: '#f3f4f6' }
      },
      x: {
        grid: { display: false },
        ticks: { maxRotation: 45 }
      }
    }
  }
};

// Chart 3: Cumulative MRR Growth (3 scenarios + target line)
const targetLine = months8.map(() => 350000);

const chart3 = {
  type: 'line',
  data: {
    labels: months8.map(m => m + ' 26'),
    datasets: [
      {
        label: 'Base (Current Pace)',
        data: baseMRR,
        borderColor: '#731494',
        backgroundColor: 'rgba(115,20,148,0.08)',
        borderWidth: 2.5,
        fill: false,
        tension: 0.3,
        pointRadius: 4
      },
      {
        label: 'Jesse Hits 15 Deals/Mo',
        data: jesseMRR,
        borderColor: '#C19C46',
        backgroundColor: 'rgba(193,156,70,0.08)',
        borderWidth: 2.5,
        fill: false,
        tension: 0.3,
        pointRadius: 4
      },
      {
        label: 'Jesse + GA Upsells',
        data: fullMRR,
        borderColor: '#340B67',
        backgroundColor: 'rgba(52,11,103,0.08)',
        borderWidth: 2.5,
        fill: false,
        tension: 0.3,
        pointRadius: 4
      },
      {
        label: 'Target MRR ($4.2M Year)',
        data: targetLine,
        borderColor: '#6b7280',
        borderWidth: 1.5,
        borderDash: [8, 4],
        fill: false,
        pointRadius: 0,
        tension: 0
      }
    ]
  },
  options: {
    plugins: {
      title: {
        display: true,
        text: 'Cumulative MRR Growth — May to Dec 2026',
        font: { size: 15, weight: 'bold' },
        color: '#340B67'
      },
      legend: { position: 'bottom', labels: { boxWidth: 14, padding: 12 } }
    },
    scales: {
      y: {
        ticks: { callback: "function(v){ return '$'+(v/1000).toFixed(0)+'K'; }" },
        grid: { color: '#f3f4f6' }
      },
      x: { grid: { display: false } }
    }
  }
};

// Chart 4: Monthly Revenue Picture (Stacked Bar)
const fpConstant = 20390; // 10 deals × $2,039
const pifCash = 52158;    // 6 PIFs × $8,693
const annualized = baseMRR.map(mrr => Math.round((mrr + fpConstant + pifCash) * 12));

const chart4 = {
  type: 'bar',
  data: {
    labels: months8.map(m => m + ' 26'),
    datasets: [
      {
        label: 'Recurring MRR',
        data: baseMRR,
        backgroundColor: '#731494',
        stack: 'revenue',
        order: 2
      },
      {
        label: 'New Deal First Payments',
        data: months8.map(() => fpConstant),
        backgroundColor: '#732FBA',
        stack: 'revenue',
        order: 2
      },
      {
        label: 'PIF Cash ($52K/mo)',
        data: months8.map(() => pifCash),
        backgroundColor: '#C19C46',
        stack: 'revenue',
        order: 2
      },
      {
        type: 'line',
        label: 'Annualized Revenue Run Rate',
        data: annualized,
        borderColor: '#340B67',
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 4,
        tension: 0.3,
        order: 1,
        yAxisID: 'y2'
      }
    ]
  },
  options: {
    plugins: {
      title: {
        display: true,
        text: 'Monthly Revenue Picture — Total Cash (May–Dec 2026)',
        font: { size: 15, weight: 'bold' },
        color: '#340B67'
      },
      legend: { position: 'bottom', labels: { boxWidth: 14, padding: 10 } }
    },
    scales: {
      y: {
        stacked: true,
        title: { display: true, text: 'Monthly Cash ($)' },
        ticks: { callback: "function(v){ return '$'+(v/1000).toFixed(0)+'K'; }" },
        grid: { color: '#f3f4f6' }
      },
      y2: {
        position: 'right',
        title: { display: true, text: 'Annual Run Rate ($)' },
        ticks: { callback: "function(v){ return '$'+(v/1e6).toFixed(2)+'M'; }" },
        grid: { display: false }
      },
      x: { grid: { display: false } }
    }
  }
};

// Chart 5: ARR Trajectory
const baseARR  = baseMRR.map(v => v * 12);
const jesseARR = jesseMRR.map(v => v * 12);
const fullARR  = fullMRR.map(v => v * 12);
const targetARR = months8.map(() => 4200000);

const chart5 = {
  type: 'line',
  data: {
    labels: months8.map(m => m + ' 26'),
    datasets: [
      {
        label: 'Base (Current Pace)',
        data: baseARR,
        borderColor: '#731494',
        backgroundColor: 'rgba(115,20,148,0.06)',
        borderWidth: 2.5,
        fill: true,
        tension: 0.3,
        pointRadius: 4
      },
      {
        label: 'Jesse Hits 15 Deals/Mo',
        data: jesseARR,
        borderColor: '#C19C46',
        backgroundColor: 'rgba(193,156,70,0.06)',
        borderWidth: 2.5,
        fill: true,
        tension: 0.3,
        pointRadius: 4
      },
      {
        label: 'Jesse + GA Upsells',
        data: fullARR,
        borderColor: '#340B67',
        backgroundColor: 'rgba(52,11,103,0.06)',
        borderWidth: 2.5,
        fill: true,
        tension: 0.3,
        pointRadius: 4
      },
      {
        label: '$4.2M ARR Target',
        data: targetARR,
        borderColor: '#6b7280',
        borderWidth: 2,
        borderDash: [8, 4],
        fill: false,
        pointRadius: 0,
        tension: 0
      }
    ]
  },
  options: {
    plugins: {
      title: {
        display: true,
        text: 'ARR Trajectory by Scenario — May to Dec 2026',
        font: { size: 15, weight: 'bold' },
        color: '#340B67'
      },
      legend: { position: 'bottom', labels: { boxWidth: 14, padding: 12 } }
    },
    scales: {
      y: {
        ticks: { callback: "function(v){ return '$'+(v/1e6).toFixed(1)+'M'; }" },
        grid: { color: '#f3f4f6' }
      },
      x: { grid: { display: false } }
    }
  }
};

// === QUICKCHART URL BUILDER ===
function buildQuickChartUrl(config) {
  const json = JSON.stringify(config);
  const encoded = encodeURIComponent(json);
  return `https://quickchart.io/chart?c=${encoded}&width=800&height=400&backgroundColor=white&version=3`;
}

function createShortUrl(config) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      chart: config,
      width: 800,
      height: 400,
      backgroundColor: 'white',
      version: '3'
    });
    const opts = {
      hostname: 'quickchart.io',
      path: '/chart/create',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.url) resolve(json.url);
          else reject(new Error('No URL: ' + data));
        } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// === GOOGLE AUTH ===
async function getAuthClient() {
  const creds = JSON.parse(fs.readFileSync(CREDS_PATH, 'utf8'));
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/documents']
  });
  return auth.getClient();
}

// === MAIN ===
async function main() {
  // 1) Generate short chart URLs
  console.log('\n=== GENERATING CHART URLs ===');
  const chartConfigs = [
    { name: 'Chart 1: Revenue Trend', config: chart1 },
    { name: 'Chart 2: PIF Pipeline', config: chart2 },
    { name: 'Chart 3: MRR Growth Scenarios', config: chart3 },
    { name: 'Chart 4: Monthly Revenue Picture', config: chart4 },
    { name: 'Chart 5: ARR Trajectory', config: chart5 }
  ];

  const chartUrls = [];
  for (const c of chartConfigs) {
    try {
      const url = await createShortUrl(c.config);
      chartUrls.push(url);
      console.log(`✅ ${c.name}: ${url}`);
    } catch(e) {
      console.error(`⚠️  ${c.name} short URL failed, using long URL: ${e.message}`);
      chartUrls.push(buildQuickChartUrl(c.config));
    }
  }

  // 2) Connect to Google Docs
  const auth = await getAuthClient();
  const docs = google.docs({ version: 'v1', auth });

  // 3) Fetch doc and find inline images to delete
  console.log('\n=== FETCHING DOCUMENT ===');
  let res = await docs.documents.get({ documentId: DOC_ID });
  let content = res.data.body.content;

  // Find existing inline images
  const imageElements = [];
  for (const elem of content) {
    if (elem.paragraph) {
      for (const el of elem.paragraph.elements) {
        if (el.inlineObjectElement) {
          imageElements.push({
            startIndex: el.startIndex,
            endIndex: el.endIndex,
            objectId: el.inlineObjectElement.inlineObjectId
          });
        }
      }
    }
  }
  console.log(`Found ${imageElements.length} existing inline image(s):`, imageElements.map(e => e.objectId));

  // 4) Delete existing images (in reverse order to preserve indices)
  if (imageElements.length > 0) {
    console.log('\n=== DELETING EXISTING IMAGES ===');
    const sortedImages = [...imageElements].sort((a, b) => b.startIndex - a.startIndex);
    
    for (const img of sortedImages) {
      await docs.documents.batchUpdate({
        documentId: DOC_ID,
        requestBody: {
          requests: [{
            deleteContentRange: {
              range: { startIndex: img.startIndex, endIndex: img.endIndex }
            }
          }]
        }
      });
      console.log(`✅ Deleted image ${img.objectId} (${img.startIndex}-${img.endIndex})`);
    }
  }

  // 5) Re-fetch doc with fresh indices
  console.log('\n=== REFETCHING DOCUMENT FOR FRESH INDICES ===');
  res = await docs.documents.get({ documentId: DOC_ID });
  content = res.data.body.content;

  // 6) Find insertion points by text markers
  const insertions = [
    { chartIdx: 0, marker: '~$3,550,000', matchEnd: true, label: 'Chart 1 after revenue table' },
    { chartIdx: 1, marker: '$18,080/mo', matchEnd: true, label: 'Chart 2 after PIF total' },
    { chartIdx: 2, marker: 'approximately 1%, and the SEO structural fix', matchEnd: true, label: 'Chart 3 after THE GAP section' },
    { chartIdx: 3, marker: 'the range expands to $4.3M to $4.6M', matchEnd: true, label: 'Chart 4 after LOOKING AT 2027' },
    { chartIdx: 4, marker: '## THREE QUESTIONS FOR WEDNESDAY', matchEnd: false, label: 'Chart 5 before THREE QUESTIONS' }
  ];

  const resolvedInsertions = [];
  for (const ins of insertions) {
    let found = false;
    for (const elem of content) {
      if (elem.paragraph) {
        const text = elem.paragraph.elements.map(e => e.textRun?.content || '').join('');
        if (text.includes(ins.marker)) {
          const idx = ins.matchEnd ? elem.endIndex - 1 : elem.startIndex;
          resolvedInsertions.push({ index: idx, chartIdx: ins.chartIdx, label: ins.label });
          console.log(`✅ ${ins.label}: index ${idx} (text: "${text.trim().substring(0, 60)}")`);
          found = true;
          break;
        }
      }
    }
    if (!found) {
      console.error(`❌ Could not find insertion point for: ${ins.label} (marker: "${ins.marker}")`);
    }
  }

  // 7) Insert charts from last to first (preserve index integrity)
  console.log('\n=== INSERTING CHARTS ===');
  resolvedInsertions.sort((a, b) => b.index - a.index);

  const results = [];
  for (const ins of resolvedInsertions) {
    try {
      const url = chartUrls[ins.chartIdx];
      await docs.documents.batchUpdate({
        documentId: DOC_ID,
        requestBody: {
          requests: [{
            insertInlineImage: {
              location: { index: ins.index },
              uri: url,
              objectSize: {
                height: { magnitude: 240, unit: 'PT' },
                width: { magnitude: 500, unit: 'PT' }
              }
            }
          }]
        }
      });
      console.log(`✅ ${ins.label} inserted at index ${ins.index}`);
      results.push({ label: ins.label, success: true });
    } catch(e) {
      console.error(`❌ ${ins.label} FAILED: ${e.message}`);
      results.push({ label: ins.label, success: false, error: e.message });
    }
  }

  // === FINAL SUMMARY ===
  console.log('\n=====================================');
  console.log('=== FINAL RESULTS ===');
  console.log('=====================================');
  
  // Re-sort by chart index for display
  results.sort((a, b) => {
    const order = ['Chart 1', 'Chart 2', 'Chart 3', 'Chart 4', 'Chart 5'];
    return order.findIndex(o => a.label.includes(o)) - order.findIndex(o => b.label.includes(o));
  });
  
  for (const r of results) {
    console.log(`${r.success ? '✅' : '❌'} ${r.label}${r.error ? ': ' + r.error : ''}`);
  }

  console.log('\n=== DEC 2026 MRR & ARR ===');
  console.log(`Base:   MRR $${baseMRR[7].toLocaleString()}  →  ARR $${(baseMRR[7]*12).toLocaleString()}`);
  console.log(`Jesse:  MRR $${jesseMRR[7].toLocaleString()}  →  ARR $${(jesseMRR[7]*12).toLocaleString()}`);
  console.log(`Full:   MRR $${fullMRR[7].toLocaleString()}  →  ARR $${(fullMRR[7]*12).toLocaleString()}`);

  console.log(`\n📄 Doc: https://docs.google.com/document/d/${DOC_ID}/edit`);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
