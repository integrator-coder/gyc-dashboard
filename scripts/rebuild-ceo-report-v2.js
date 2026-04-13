#!/usr/bin/env node
// GYC CEO Revenue Report — Full Rebuild v2
// Clears the doc, rewrites full narrative, inserts 5 QuickChart charts

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const https = require('https');

const DOC_ID = '15scnaOycWILyC3OHQTEsv--9vfF47sxlJNR0Pi4VSNQ';
const CREDS_PATH = path.join(process.env.HOME, '.openclaw/credentials/google-console.json');

// === QUICKCHART SHORT URL ===
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
          const j = JSON.parse(data);
          if (j.url) resolve(j.url);
          else reject(new Error('No URL: ' + data));
        } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// === CHART CONFIGS ===

// Chart 1 — Annual Revenue Bar
const chart1 = {
  type: 'bar',
  data: {
    labels: ['2023','2024','2025','2026 Pace','2026 Target'],
    datasets: [{
      label: 'Revenue ($M)',
      data: [3.48, 3.80, 3.73, 3.55, 4.20],
      backgroundColor: ['#731494','#731494','#731494','#C19C46','#340B67'],
      borderRadius: 4
    }]
  },
  options: {
    plugins: {
      title: { display: true, text: 'GYC Annual Revenue — 2023 to 2026', font: { size: 15, weight: 'bold' }, color: '#340B67' },
      legend: { display: false }
    },
    scales: {
      y: { min: 3.0, max: 4.5, title: { display: true, text: 'Revenue ($M)' }, ticks: { callback: "function(v){return '$'+v.toFixed(1)+'M';}" } },
      x: { grid: { display: false } }
    }
  }
};

// Chart 2 — Renewal Pipeline Bar
const renewalData = [1204,1391,0,0,765,699,11022,1298,2620,10497,3498,6835];
const renewalLabels = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan27','Feb27','Mar27'];
const bigMonths = [6, 9]; // Oct, Jan27 indices → gold
const renewalColors = renewalData.map((v, i) => {
  if (v === 0) return '#e5e7eb';
  if (bigMonths.includes(i)) return '#C19C46';
  return '#731494';
});

const chart2 = {
  type: 'bar',
  data: {
    labels: renewalLabels,
    datasets: [{
      label: 'New MRR Arriving ($)',
      data: renewalData,
      backgroundColor: renewalColors,
      borderRadius: 3
    }]
  },
  options: {
    plugins: {
      title: { display: true, text: 'Renewal MRR Pipeline — Apr 2026 to Mar 2027', font: { size: 15, weight: 'bold' }, color: '#340B67' },
      legend: { display: false }
    },
    scales: {
      y: { min: 0, max: 12000, title: { display: true, text: 'New MRR ($)' }, ticks: { callback: "function(v){return '$'+v.toLocaleString();}" } },
      x: { grid: { display: false } }
    }
  }
};

// Chart 3 — MRR Growth Lines
const mrrLabels = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan27','Feb27','Mar27'];
const baseMRR =  [218,222,226,229,232,236,250,253,258,271,276,285];
const jesseMRR = [223,233,241,250,258,267,285,294,304,321,331,344];
const fullMRR =  [228,243,256,269,282,295,318,331,346,367,382,399];
const targetMRR = mrrLabels.map(() => 350);

const chart3 = {
  type: 'line',
  data: {
    labels: mrrLabels,
    datasets: [
      { label: 'Base (10 deals/mo)', data: baseMRR, borderColor: '#731494', borderWidth: 2.5, fill: false, tension: 0.3, pointRadius: 4 },
      { label: 'Jesse 15/mo', data: jesseMRR, borderColor: '#C19C46', borderWidth: 2.5, fill: false, tension: 0.3, pointRadius: 4 },
      { label: 'Jesse + GA Upsells', data: fullMRR, borderColor: '#340B67', borderWidth: 2.5, fill: false, tension: 0.3, pointRadius: 4 },
      { label: '$350K Target', data: targetMRR, borderColor: '#ef4444', borderWidth: 1.5, borderDash: [8,4], fill: false, pointRadius: 0 }
    ]
  },
  options: {
    plugins: {
      title: { display: true, text: 'MRR Growth by Scenario — Apr 2026 to Mar 2027', font: { size: 15, weight: 'bold' }, color: '#340B67' },
      legend: { position: 'bottom', labels: { boxWidth: 14, padding: 10 } }
    },
    scales: {
      y: { min: 200, max: 420, title: { display: true, text: 'MRR ($000s)' }, ticks: { callback: "function(v){return '$'+v+'K';}" } },
      x: { grid: { display: false } }
    }
  }
};

// Chart 4 — Monthly Revenue Stacked
const mrrArr =  [218,222,226,229,232,236,250,253,258,271,276,285];
const fpArr =   mrrLabels.map(() => 20);
const pifArr =  mrrLabels.map(() => 52);

const chart4 = {
  type: 'bar',
  data: {
    labels: mrrLabels,
    datasets: [
      { label: 'MRR', data: mrrArr, backgroundColor: '#731494', stack: 'rev' },
      { label: 'First Payments (~$20K)', data: fpArr, backgroundColor: '#732FBA', stack: 'rev' },
      { label: 'PIF Cash (~$52K)', data: pifArr, backgroundColor: '#C19C46', stack: 'rev' }
    ]
  },
  options: {
    plugins: {
      title: { display: true, text: 'Monthly Revenue — All Components ($000s)', font: { size: 15, weight: 'bold' }, color: '#340B67' },
      legend: { position: 'bottom', labels: { boxWidth: 14, padding: 10 } }
    },
    scales: {
      y: { stacked: true, min: 0, max: 380, title: { display: true, text: 'Revenue ($000s)' }, ticks: { callback: "function(v){return '$'+v+'K';}" } },
      x: { stacked: true, grid: { display: false } }
    }
  }
};

// Chart 5 — ARR Trajectory
const baseARR = [2.6,2.7,2.7,2.7,2.8,2.8,3.0,3.0,3.1,3.3,3.3,3.4];
const fullARR = [2.7,2.9,3.1,3.2,3.4,3.5,3.8,4.0,4.2,4.4,4.6,4.8];
const targetARR = mrrLabels.map(() => 4.2);

const chart5 = {
  type: 'line',
  data: {
    labels: mrrLabels,
    datasets: [
      { label: 'Base Scenario', data: baseARR, borderColor: '#731494', borderWidth: 2.5, fill: false, tension: 0.3, pointRadius: 4 },
      { label: 'Full Scenario (Jesse + GA)', data: fullARR, borderColor: '#340B67', borderWidth: 2.5, fill: false, tension: 0.3, pointRadius: 4 },
      { label: '$4.2M Target', data: targetARR, borderColor: '#ef4444', borderWidth: 1.5, borderDash: [8,4], fill: false, pointRadius: 0 }
    ]
  },
  options: {
    plugins: {
      title: { display: true, text: 'Annualized Revenue Trajectory — Apr 2026 to Mar 2027', font: { size: 15, weight: 'bold' }, color: '#340B67' },
      legend: { position: 'bottom', labels: { boxWidth: 14, padding: 10 } }
    },
    scales: {
      y: { min: 2.5, max: 5.0, title: { display: true, text: 'Annualized Revenue ($M)' }, ticks: { callback: "function(v){return '$'+v.toFixed(1)+'M';}" } },
      x: { grid: { display: false } }
    }
  }
};

// === DOCUMENT TEXT ===
// CHART_PLACEHOLDER_X markers will be found and replaced with images
const docText = `GYC REVENUE REPORT
Prepared for: Bruce Spurr, CEO | Date: April 2026 | Prepared by: Todd Lavictoire, Integrator

EXECUTIVE SUMMARY

GYC is a $3.7 million business with a clear line of sight to $4.2 million — and the data now exists to prove it. The 2025 dip was not structural; it was a single-event churn caused by a Google Ads policy change, and the SEO pivot that followed is already in place. Three levers drive the path to $4.2M: Jesse closing 15 deals per month, Growth Advisors driving PIF upsells at six to eight per month, and churn holding at or below 1.5% as the new SEO-based acquisition model matures. This report presents the numbers, the pipeline, and the three decisions needed to move from analysis to execution.

SECTION 1: WHERE WE STAND

GYC has grown from $3.48 million in 2023 to $3.80 million in 2024, a 9.4% increase that reflected real momentum in new client acquisition. The 2025 result of $3.73 million — a modest 2.0% decline — was not a trend reversal. A specific cohort of clients had been acquired through Google Ads in a prior year, and when a policy change disrupted that channel, those clients churned in a concentrated wave. The fix was structural: GYC pivoted to SEO-based lead generation, which is now the primary acquisition channel and is performing as designed.

Through the first 102 days of 2026, GYC has collected $990,762 in revenue, placing the full-year pace at approximately $3.55 million on current trajectory. That is the baseline — the floor before any acceleration.

There is an important nuance in how MRR appears in Stripe versus how it actually behaves. Stripe currently shows $213,334 in monthly recurring revenue across 307 active clients. However, a meaningful segment of GYC's client base chose to pay in full (PIF) upfront rather than on a monthly plan. Those clients show zero recurring revenue in Stripe, but they renew annually — and when they do, that renewal generates new MRR. True recurring economic activity, including PIF renewal contributions, is closer to $255,000 per month. The gap between what Stripe reports and what is actually recurring is a source of frequent confusion in revenue conversations; this report accounts for it throughout.

Year        Revenue         Change
2023        $3,475,667      —
2024        $3,803,233      +9.4%
2025        $3,729,570      -2.0%
2026 YTD    $990,762        On pace for ~$3.55M
(102 days)

CHART_PLACEHOLDER_1

SECTION 2: THE GAP — AND HOW WE CLOSE IT

The gap between GYC's current trajectory ($3.55M) and the $4.2M target is $690,000. That is not a rounding error — it requires real execution across three levers, working in parallel.

The first lever is sales volume. Jesse is currently closing approximately ten deals per month at an average MRR of $864 per deal. Scaling to fifteen deals per month would add $54,000 in new MRR monthly, a 50% increase in new business velocity. Mintcro is addressing the lead quality issue that has been the primary constraint, with improvements expected by May. Bruce's direct coaching of Jesse on close rate and pipeline discipline is the other half of that equation.

The second lever is PIF upsells. GYC is currently running at approximately six PIF deals per month, generating around $52,158 in cash. Growth Advisors targeting existing clients for plan upgrades and upsells — particularly clients approaching renewal — can push this to six to eight per month consistently. PIF deals do not immediately appear in MRR, but they generate significant cash and reduce churn risk, since clients who pay annually are less likely to cancel.

The third lever is churn. Monthly churn is currently running at approximately 1%, which is healthy for a subscription business of this type. Holding it there — or pushing it below 1% — requires investment in client success infrastructure. The SEO pivot is the structural fix for the top of the funnel; the equivalent investment on the retention side is what locks in compounding MRR growth over time.

SECTION 3: THE RENEWAL PIPELINE — LOCKED-IN MRR

This is the most important section of this report, and the one most commonly overlooked in revenue conversations.

Every deal GYC has ever signed has a renewal date. When a client reaches that renewal date and elects to continue, that renewal generates new MRR — automatically, without a new sale. This is not speculative. These clients already exist. Their contracts are already in the system. The MRR arriving from renewals is as close to locked-in revenue as a subscription business can have.

Looking at the next twelve months, $40,829 in new MRR is scheduled to arrive from renewals alone. Two months in particular stand out as material step-changes: October 2026 brings $11,022 in renewal MRR from eleven renewing deals, and January 2027 brings $10,497 from eight deals. These are visible inflection points in the MRR trajectory regardless of what happens with new sales.

Month           Deals Renewing  New MRR Arriving
April 2026      2               $1,204
May 2026        3               $1,391
June 2026       0               $0
July 2026       0               $0
August 2026     1               $765
September 2026  1               $699
October 2026    11              $11,022
November 2026   2               $1,298
December 2026   4               $2,620
January 2027    8               $10,497
February 2027   2               $3,498
March 2027      6               $6,835
TOTAL           40              $40,829/month

CHART_PLACEHOLDER_2

SECTION 4: THREE SCENARIOS

Three scenarios have been modeled, each representing a distinct execution outcome over the next twelve months. The scenarios are not optimistic, pessimistic, and realistic in the traditional sense — they represent three different levels of sales team performance, with churn held constant at approximately the levels each scenario implies.

The Base scenario assumes ten new deals per month, no expansion MRR from upsells, and monthly churn of 2.5%. This is a conservative view of current pace with slightly elevated churn. By December 2026, MRR reaches $258,000. By March 2027, it reaches $285,000.

The Jesse 15/mo scenario assumes Jesse closes fifteen deals per month, still no expansion MRR, and churn improves to 2.0% as a result of higher-quality client acquisition. By December 2026, MRR reaches $304,000. By March 2027, it reaches $344,000 — materially closer to the $350,000 MRR threshold that corresponds to $4.2M ARR.

The Jesse + GA Upsells scenario adds $4,500 per month in expansion MRR from Growth Advisor upsells, reduces churn further to 1.8%, and holds the fifteen-deal-per-month assumption. This is the full execution scenario. By December 2026, MRR reaches $346,000. By March 2027, it reaches $399,000 — approaching the $4.2M annualized run rate from the MRR side alone, before PIF cash and first payments are counted.

Scenario            New Deals/Month   Expansion MRR/Month   Monthly Churn   Dec 2026 MRR   Mar 2027 MRR
Base                10                $0                    2.5%            $258K          $285K
Jesse 15/mo         15                $0                    2.0%            $304K          $344K
Jesse + GA Upsells  15                $4,500                1.8%            $346K          $399K

CHART_PLACEHOLDER_3

SECTION 5: THE MONTHLY REVENUE PICTURE

MRR alone understates how much cash GYC actually collects each month. There are three distinct components to monthly revenue, and Stripe's MRR figure captures only one of them.

The first component is MRR — the base recurring subscriptions, currently $213,334 per month in Stripe, with true economic recurring closer to $255,000 when PIF renewal activity is properly accounted for.

The second component is new deal first payments. Every new client who signs generates a first payment before their subscription begins. At the current average of $2,039 per deal and ten deals per month, that is approximately $20,390 per month in first-payment cash that does not appear in MRR at all.

The third component is PIF cash. At six PIF deals per month averaging $8,693 per deal, GYC is collecting approximately $52,158 per month in lump-sum cash from clients paying annually upfront. This cash is real revenue in the month it arrives, but because these clients are on annual plans, they show zero in Stripe's monthly recurring count until renewal.

Combined, at current pace, GYC's total monthly cash collection is approximately $285,000 to $290,000 per month — roughly 35% higher than the Stripe MRR figure suggests. The chart below shows this stacked across the twelve-month forecast window.

CHART_PLACEHOLDER_4

SECTION 6: TOTAL REVENUE TRAJECTORY

When the three revenue components are combined and annualized, the path to $4.2 million becomes visible — but it requires the full execution scenario.

On the Base trajectory, annualized revenue grows slowly from approximately $2.6 million today (MRR-only basis) to $3.4 million by March 2027. The renewals in October 2026 and January 2027 create visible step-changes even in the conservative scenario.

On the Full scenario — Jesse closing fifteen deals per month, Growth Advisors driving $4,500 in monthly expansion MRR, and churn holding at 1.8% — the trajectory is meaningfully different. October 2026 crosses $3.8 million annualized. December 2026 crosses $4.2 million. March 2027 reaches approximately $4.8 million annualized from the MRR component alone. When PIF cash and first payments are layered on top, total cash collections reach or exceed the $4.2 million target earlier in the year.

The $4.2 million target is achievable. It requires full execution on all three levers simultaneously, without material slippage in any one of them.

CHART_PLACEHOLDER_5

SECTION 7: THREE DECISIONS

The first decision is about sales capacity. Jesse is the single source of new client acquisition, and fifteen deals per month is a meaningful step up from current pace. The question is not whether Jesse is capable — it is whether he has the tools, lead volume, and coaching cadence to sustain that output consistently. Mintcro is addressing lead quality. Bruce is engaged on coaching. What else does Jesse need, and who owns ensuring he has it? This conversation needs to produce a specific commitment, not a general expectation.

The second decision is about PIF versus MRR mix. PIF deals are strategically valuable in ways that the MRR chart does not capture: they generate large upfront cash, they reduce monthly churn risk because annual clients rarely cancel mid-year, and they create renewal events that add MRR in future periods. The risk is that heavy PIF adoption suppresses the Stripe MRR number, which can make the business look smaller than it is to anyone reading only that metric. The decision here is whether GYC should continue actively incentivizing PIF at the current rate, or whether there is a strategic reason to shift the mix toward monthly subscriptions to improve MRR optics.

The third decision is about churn investment. Monthly churn at 1% is a healthy number. Many subscription businesses would be pleased to hold it there. The question is whether 1% is sustainable without deliberate investment in client retention infrastructure — dedicated customer success coverage, systematic renewal outreach, proactive account reviews. The SEO pivot fixed the structural problem on the acquisition side. What is the equivalent structural investment on the retention side, and who owns building it?

SECTION 8: THE DASHBOARD

The projections dashboard is live and accessible to the leadership team. It tracks MRR, ARR, active clients, churn, new deals, and the renewal pipeline in real time, pulling directly from Stripe and GHL. The scenario models shown in this report are built into the dashboard, so any change in actuals — a better close month from Jesse, an unexpected churn event, a renewal converting ahead of schedule — is reflected immediately in the forward projections.

This document and the dashboard are designed to work together. The report sets the shared understanding: the numbers, the context behind them, the scenarios, and the decisions that need to be made. The dashboard tracks execution against that understanding. The combination means that the next monthly planning conversation starts from a common factual baseline, not from a debate about what the numbers are.
`;

// === GOOGLE AUTH ===
async function getAuthClient() {
  const creds = JSON.parse(fs.readFileSync(CREDS_PATH, 'utf8'));
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/documents']
  });
  return auth.getClient();
}

// === HELPER: sleep ===
const sleep = ms => new Promise(r => setTimeout(r, ms));

// === MAIN ===
async function main() {
  const auth = await getAuthClient();
  const docs = google.docs({ version: 'v1', auth });

  // ---- STEP 1: Generate chart URLs ----
  console.log('\n=== GENERATING CHART URLs ===');
  const chartConfigs = [chart1, chart2, chart3, chart4, chart5];
  const chartUrls = [];
  for (let i = 0; i < chartConfigs.length; i++) {
    try {
      const url = await createShortUrl(chartConfigs[i]);
      chartUrls.push(url);
      console.log(`✅ Chart ${i+1}: ${url}`);
    } catch(e) {
      console.error(`❌ Chart ${i+1} short URL failed: ${e.message}`);
      process.exit(1);
    }
  }

  // ---- STEP 2: Fetch doc to get current length ----
  console.log('\n=== FETCHING DOCUMENT ===');
  let res = await docs.documents.get({ documentId: DOC_ID });
  let body = res.data.body.content;
  
  // Find end index (last element's endIndex)
  let endIndex = 1;
  for (const elem of body) {
    if (elem.endIndex && elem.endIndex > endIndex) endIndex = elem.endIndex;
  }
  console.log(`Document length: ${endIndex} chars`);

  // ---- STEP 3: Delete all content except first char ----
  console.log('\n=== CLEARING DOCUMENT ===');
  if (endIndex > 2) {
    await docs.documents.batchUpdate({
      documentId: DOC_ID,
      requestBody: {
        requests: [{
          deleteContentRange: {
            range: { startIndex: 1, endIndex: endIndex - 1 }
          }
        }]
      }
    });
    console.log('✅ Document cleared');
  }
  await sleep(1000);

  // ---- STEP 4: Insert new text ----
  console.log('\n=== INSERTING NEW TEXT ===');
  await docs.documents.batchUpdate({
    documentId: DOC_ID,
    requestBody: {
      requests: [{
        insertText: {
          location: { index: 1 },
          text: docText
        }
      }]
    }
  });
  console.log('✅ Text inserted');
  await sleep(1000);

  // ---- STEP 5: Apply heading formatting ----
  console.log('\n=== APPLYING FORMATTING ===');
  
  // Re-fetch to get fresh indices
  res = await docs.documents.get({ documentId: DOC_ID });
  body = res.data.body.content;
  
  // Find paragraphs to style
  const formatRequests = [];
  
  for (const elem of body) {
    if (!elem.paragraph) continue;
    const text = elem.paragraph.elements.map(e => e.textRun?.content || '').join('').trim();
    const start = elem.startIndex;
    const end = elem.endIndex;
    
    // Title
    if (text === 'GYC REVENUE REPORT') {
      formatRequests.push({
        updateParagraphStyle: {
          range: { startIndex: start, endIndex: end },
          paragraphStyle: { namedStyleType: 'HEADING_1' },
          fields: 'namedStyleType'
        }
      });
      formatRequests.push({
        updateTextStyle: {
          range: { startIndex: start, endIndex: end - 1 },
          textStyle: { foregroundColor: { color: { rgbColor: { red: 0.451, green: 0.078, blue: 0.580 } } }, bold: true, fontSize: { magnitude: 24, unit: 'PT' } },
          fields: 'foregroundColor,bold,fontSize'
        }
      });
    }
    
    // Subtitle line
    if (text.startsWith('Prepared for: Bruce Spurr')) {
      formatRequests.push({
        updateTextStyle: {
          range: { startIndex: start, endIndex: end - 1 },
          textStyle: { italic: true, foregroundColor: { color: { rgbColor: { red: 0.4, green: 0.4, blue: 0.4 } } } },
          fields: 'italic,foregroundColor'
        }
      });
    }
    
    // Section headings
    if (text === 'EXECUTIVE SUMMARY' || text.match(/^SECTION \d+:/)) {
      formatRequests.push({
        updateParagraphStyle: {
          range: { startIndex: start, endIndex: end },
          paragraphStyle: { namedStyleType: 'HEADING_2' },
          fields: 'namedStyleType'
        }
      });
      formatRequests.push({
        updateTextStyle: {
          range: { startIndex: start, endIndex: end - 1 },
          textStyle: { foregroundColor: { color: { rgbColor: { red: 0.204, green: 0.043, blue: 0.404 } } }, bold: true },
          fields: 'foregroundColor,bold'
        }
      });
    }
  }
  
  if (formatRequests.length > 0) {
    // Batch in chunks of 20
    for (let i = 0; i < formatRequests.length; i += 20) {
      await docs.documents.batchUpdate({
        documentId: DOC_ID,
        requestBody: { requests: formatRequests.slice(i, i + 20) }
      });
    }
    console.log(`✅ Applied ${formatRequests.length} formatting requests`);
  }
  await sleep(1000);

  // ---- STEP 6: Find placeholder positions and insert charts ----
  console.log('\n=== FINDING CHART PLACEHOLDERS ===');
  
  // Re-fetch again for fresh indices
  res = await docs.documents.get({ documentId: DOC_ID });
  body = res.data.body.content;

  const placeholders = ['CHART_PLACEHOLDER_1','CHART_PLACEHOLDER_2','CHART_PLACEHOLDER_3','CHART_PLACEHOLDER_4','CHART_PLACEHOLDER_5'];
  const found = [];

  for (const elem of body) {
    if (!elem.paragraph) continue;
    const text = elem.paragraph.elements.map(e => e.textRun?.content || '').join('');
    for (let pi = 0; pi < placeholders.length; pi++) {
      if (text.includes(placeholders[pi])) {
        found.push({
          placeholder: placeholders[pi],
          chartIdx: pi,
          startIndex: elem.startIndex,
          endIndex: elem.endIndex,
          text: text.trim()
        });
        console.log(`✅ Found ${placeholders[pi]} at indices ${elem.startIndex}-${elem.endIndex}`);
        break;
      }
    }
  }

  if (found.length !== 5) {
    console.error(`❌ Only found ${found.length}/5 placeholders!`);
    found.forEach(f => console.log(`  Found: ${f.placeholder}`));
    process.exit(1);
  }

  // ---- STEP 7: Replace placeholders with images (process in REVERSE order) ----
  console.log('\n=== INSERTING CHARTS (reverse order) ===');
  
  // Sort by startIndex descending so earlier indices aren't shifted
  found.sort((a, b) => b.startIndex - a.startIndex);

  for (const f of found) {
    const chartUrl = chartUrls[f.chartIdx];
    console.log(`\nProcessing ${f.placeholder} (Chart ${f.chartIdx+1})...`);
    
    // Step A: Insert image at startIndex of the placeholder paragraph
    await docs.documents.batchUpdate({
      documentId: DOC_ID,
      requestBody: {
        requests: [{
          insertInlineImage: {
            location: { index: f.startIndex },
            uri: chartUrl,
            objectSize: {
              height: { magnitude: 240, unit: 'PT' },
              width: { magnitude: 480, unit: 'PT' }
            }
          }
        }]
      }
    });
    console.log(`  ✅ Image inserted at ${f.startIndex}`);
    await sleep(800);

    // Step B: Re-fetch to find updated placeholder position (image shifted indices)
    const res2 = await docs.documents.get({ documentId: DOC_ID });
    const body2 = res2.data.body.content;
    
    let placeholderElem = null;
    for (const elem of body2) {
      if (!elem.paragraph) continue;
      const t = elem.paragraph.elements.map(e => e.textRun?.content || '').join('');
      if (t.includes(f.placeholder)) {
        placeholderElem = elem;
        break;
      }
    }

    if (placeholderElem) {
      // Delete the placeholder paragraph
      await docs.documents.batchUpdate({
        documentId: DOC_ID,
        requestBody: {
          requests: [{
            deleteContentRange: {
              range: { startIndex: placeholderElem.startIndex, endIndex: placeholderElem.endIndex - 1 }
            }
          }]
        }
      });
      console.log(`  ✅ Placeholder text deleted`);
      await sleep(800);
    } else {
      console.log(`  ⚠️  Placeholder text not found after image insert (may have been merged)`);
    }
  }

  // ---- FINAL: Summary ----
  console.log('\n=====================================');
  console.log('=== REBUILD COMPLETE ===');
  console.log('=====================================');
  console.log('✅ Document cleared and rewritten');
  console.log('✅ All 5 charts inserted');
  console.log(`📄 Doc: https://docs.google.com/document/d/${DOC_ID}/edit`);
  console.log('\nChart URLs:');
  chartUrls.forEach((url, i) => console.log(`  Chart ${i+1}: ${url}`));
}

main().catch(err => {
  console.error('FATAL:', err.message || err);
  if (err.response?.data) console.error('API error:', JSON.stringify(err.response.data, null, 2));
  process.exit(1);
});
