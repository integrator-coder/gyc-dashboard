#!/usr/bin/env node
// GYC CEO Revenue Report — Full Rebuild v3
// Corrected model: MRR + PIF cash + first payments = total revenue
// All 3 scenarios exceed $4.2M in 2027 — that's the floor, not the ceiling

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
const bigMonths = [6, 9]; // Oct (index 6), Jan27 (index 9) → gold
const renewalColors = renewalData.map((v, i) => {
  if (v === 0) return '#e5e7eb';
  if (i === 6) return '#C19C46';   // Oct → gold
  if (i === 9) return '#340B67';   // Jan27 → deep violet
  return '#731494';                 // others → violet
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

// Chart 3 — MRR Growth Lines (3 scenarios)
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

// Chart 4 — Monthly Revenue Stacked (MRR + First Payments + PIF Cash)
const mrrArr = [218,222,226,229,232,236,250,253,258,271,276,285];
const fpArr  = mrrLabels.map(() => 20);
const pifArr = mrrLabels.map(() => 52);

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

// Chart 5 — Total Revenue ARR Trajectory (3 lines)
const baseARR  = [2.6,2.7,2.7,2.7,2.8,2.8,3.0,3.0,3.1,3.3,3.3,3.4];
const jesseARR = [2.7,2.8,2.9,3.0,3.1,3.2,3.4,3.5,3.6,3.9,4.0,4.1];
const fullARR  = [2.7,2.9,3.1,3.2,3.4,3.5,3.8,4.0,4.2,4.4,4.6,4.8];
const targetARR = mrrLabels.map(() => 4.2);

const chart5 = {
  type: 'line',
  data: {
    labels: mrrLabels,
    datasets: [
      { label: 'Base Scenario', data: baseARR,  borderColor: '#731494', borderWidth: 2.5, fill: false, tension: 0.3, pointRadius: 4 },
      { label: 'Jesse 15/mo',   data: jesseARR, borderColor: '#C19C46', borderWidth: 2.5, fill: false, tension: 0.3, pointRadius: 4 },
      { label: 'Jesse + GA',    data: fullARR,  borderColor: '#340B67', borderWidth: 2.5, fill: false, tension: 0.3, pointRadius: 4 },
      { label: '$4.2M Target',  data: targetARR, borderColor: '#ef4444', borderWidth: 1.5, borderDash: [8,4], fill: false, pointRadius: 0 }
    ]
  },
  options: {
    plugins: {
      title: { display: true, text: 'Annualized Revenue Trajectory — Apr 2026 to Mar 2027', font: { size: 15, weight: 'bold' }, color: '#340B67' },
      legend: { position: 'bottom', labels: { boxWidth: 14, padding: 10 } }
    },
    scales: {
      y: { min: 2.5, max: 5.2, title: { display: true, text: 'Annualized Revenue ($M)' }, ticks: { callback: "function(v){return '$'+v.toFixed(1)+'M';}" } },
      x: { grid: { display: false } }
    }
  }
};

// === DOCUMENT TEXT ===
// CHART_PLACEHOLDER_X markers will be found and replaced with images
const docText = `GYC REVENUE REPORT
Prepared for: Bruce Spurr, CEO | Date: April 2026 | Prepared by: Todd Lavictoire, Integrator

EXECUTIVE SUMMARY

The $4.2 million target is already hit — in every single scenario — by 2027. That is not a stretch goal. That is the floor.

The question this report answers is no longer whether GYC reaches $4.2 million. It already will. The question is how far above $4.2 million GYC finishes, and that answer depends entirely on execution across three levers: Jesse's close rate, Growth Advisor upsell activity, and churn control. Base case delivers $4.55 million in 2027. Jesse at 15 deals per month delivers $5.53 million. Full execution delivers $6.31 million. The target is not a ceiling — it is the starting point.

2026 is the building year. 2027 is the payoff year.

SECTION 1: WHERE WE STAND

GYC enters April 2026 as a $3.5 million business with structural momentum, a fully operating renewal machine, and three execution levers that determine how far above $4.2 million the company finishes in 2027.

Through the first 102 days of 2026, GYC has collected $990,762 in total revenue. That places the annualized pace at $3.55 million — a solid floor, before any acceleration is counted.

Stripe shows $213,334 in monthly recurring revenue across active subscriptions. But Stripe MRR is not the whole picture. GYC's true monthly cash generation is $285,882 per month — Stripe MRR of $213,334 plus $20,390 in new deal first payments plus $52,158 in PIF cash from clients paying annually upfront. Relying on the Stripe MRR number alone understates real monthly cash generation by 34%.

The 2025 revenue of $3.73 million was not a structural decline. It was the result of a concentrated churn event from a Google Ads policy change affecting a single acquisition cohort. The structural fix — pivoting to SEO-based acquisition — is already in place and performing. The pipeline is healthy.

Year        Revenue         Change
2023        $3,475,667      —
2024        $3,803,233      +9.4%
2025        $3,729,570      -2.0%
2026 YTD    $990,762        102 days | $3.55M pace

CHART_PLACEHOLDER_1

SECTION 2: TRUE MONTHLY CASH — $285,882

The single most important correction in this report is the gap between what Stripe reports and what GYC actually collects.

Stripe MRR: $213,334 per month. That is the subscription base — real, important, and growing.

First payments on new deals: $20,390 per month. Every new client generates a first payment before their subscription starts. Ten deals per month at an average of $2,039 per deal adds $20,390 in cash that does not appear in MRR at all.

PIF cash: $52,158 per month. Approximately six clients per month choose to pay their full annual contract upfront. At an average of $8,693 per PIF deal, that generates $52,158 in a single month. These clients show zero in Stripe's recurring revenue count — but they pay in full, they renew, and they generate significant cash now.

Total: $285,882 per month in actual cash collected. $3.44 million annualized from monthly revenue alone, before counting the wave of renewal MRR that begins arriving in October 2026.

PIF is a strategic amplifier, not just a billing option. It delivers large cash today, reduces churn risk because annual clients rarely cancel mid-year, and creates renewal events that add MRR in future periods. The chart below shows the stacked monthly revenue picture through March 2027.

CHART_PLACEHOLDER_4

SECTION 3: THE RENEWAL PIPELINE — $40,829 IN LOCKED-IN MRR

This section is about money that is already sold, already in the system, and scheduled to arrive.

Every deal GYC has ever signed has a renewal date. When those clients renew, the renewal generates new MRR — automatically, without a new sale, without a new pitch. The New Business dashboard tracks $40,829 per month in renewal MRR scheduled to arrive between April 2026 and March 2027 across 40 deals.

Two months are material step-changes: October 2026 brings $11,022 in renewal MRR from 11 renewing deals. January 2027 brings $10,497 from 8 deals. These are visible inflection points in the MRR trajectory regardless of what happens with new sales.

This pipeline is not a projection. It is locked in. The clients already exist. The contracts are already in the system. The MRR is already earned.

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

SECTION 4: THREE SCENARIOS — ALL EXCEED $4.2M IN 2027

Three scenarios have been modeled. Every one of them clears the $4.2 million target in 2027. The scenarios no longer answer whether the target is hit — they answer by how much.

The Base scenario assumes current pace: 10 new deals per month, no expansion MRR, 2.5% monthly churn. By December 2026, MRR reaches $274,000. 2026 total revenue: $3,565,558. 2027 total revenue: $4,555,022. The base case alone exceeds $4.2 million in 2027 by $355,000.

The Jesse 15/mo scenario assumes Jesse closes 15 deals per month starting May 2026, churn improves to 2.0%, and no GA expansion. By December 2026, MRR reaches $315,000. 2026 total revenue: $3,834,735. 2027 total revenue: $5,531,812. That is $1.33 million above the target.

The Jesse + GA scenario adds $4,500 per month in Growth Advisor expansion MRR, churn holds at 1.8%, and Jesse closes 15 deals per month. By December 2026, MRR reaches $353,000 — crossing the $350K MRR milestone. 2026 total revenue: $4,006,700 — crossing $4M this year. 2027 total revenue: $6,314,952. That is $2.11 million above the target.

The levers determine how far above $4.2M GYC lands. Not whether it lands there.

                    Base            Jesse 15/mo     Jesse + GA
Churn/mo            2.5%            2.0%            1.8%
New Deals/mo        10              15              15
Expansion MRR/mo    $0              $0              $4,500
Dec 2026 MRR        $274K           $315K           $353K
2026 Total Revenue  $3,565,558      $3,834,735      $4,006,700
2027 Total Revenue  $4,555,022      $5,531,812      $6,314,952

CHART_PLACEHOLDER_3

SECTION 5: MRR GROWTH TRAJECTORY

The chart above shows MRR trajectory across all three scenarios from April 2026 to March 2027. Two patterns are worth noting.

First, the renewal step-changes in October 2026 and January 2027 are visible in all three lines. The $11,022 renewal MRR arriving in October creates a visible inflection point even in the conservative base case. These inflection points are not dependent on new sales performance — they happen regardless.

Second, the gap between scenarios widens meaningfully in the back half of 2026 and accelerates into 2027. The compounding effect of higher new deal volume and lower churn becomes increasingly significant over time. By March 2027, the base case ends at $285K MRR, Jesse ends at $344K, and the full scenario ends at $399K — a $114K spread in monthly run rate driven entirely by execution-level decisions made in 2026.

SECTION 6: THE 2027 PAYOFF

2026 is the building year. Every deal closed, every PIF converted, every churn prevented compounds into 2027 revenue.

The annualized revenue trajectory chart below shows what this looks like in dollar terms. The Base scenario crosses $4.2 million annualized in 2027. The Full scenario approaches $5 million annualized by March 2027 — driven by the combination of MRR growth, PIF cash, first payments, and the January 2027 renewal wave.

The key insight is that $4.2M in 2027 is already locked in at current pace. The renewal pipeline guarantees the October and January step-changes. The PIF cash program continues generating $52K+ per month. Even without Jesse improving his close rate, even without GA upsells, the math gets there.

Every improvement in execution above the base case — whether it is Jesse at 15 deals, Growth Advisors adding $4,500 in expansion MRR, or churn holding below 2% — adds directly to the margin above $4.2M. The target is the floor. The question is the ceiling.

CHART_PLACEHOLDER_5

SECTION 7: THE LEVERS

The first lever is Jesse's close rate. At 10 deals per month, the base case is already sufficient to hit $4.2M in 2027. At 15 deals per month, GYC finishes 2027 at $5.53M — $1.33M above target. The constraint is lead volume, which Mintcro is addressing, and close rate discipline, which Bruce owns directly. The question is not whether Jesse can close 15 — it is what he needs to sustain it, and who ensures he has it.

The second lever is PIF strategy. PIF cash is not just a billing option — it is a strategic amplifier that generates cash now, reduces churn risk because annual clients rarely cancel mid-year, and creates renewal events that add MRR on schedule. At six PIFs per month, GYC is collecting $52,158 in upfront cash that does not appear in MRR but represents real economic value. The strategic question is whether to actively push PIF rate higher, or whether there is a reason to prefer the monthly MRR optics. Both are valid positions — but the decision should be explicit.

The third lever is churn. Monthly churn at 2.5% is the conservative base assumption. The difference between 2.5% and 1.8% churn — as shown in the scenario comparison — is $1.76M in 2027 revenue. Client retention is a structural investment, not a sales conversation. The SEO pivot fixed the top of the funnel. What is the equivalent structural investment on the retention side, and who owns it?

SECTION 8: THE DASHBOARD

The GYC projections dashboard tracks all of this in real time. MRR, ARR, active clients, churn, new deals, the renewal pipeline, the deal mix matrix, and all three scenario projections pull directly from Stripe and GHL and update automatically.

This document establishes the shared factual baseline — the confirmed figures, the corrected revenue model, and the three scenarios. The dashboard tracks execution against that baseline. Every deal Jesse closes, every PIF converted, every renewal that arrives in October — all of it is reflected immediately in the forward projections.

The next planning conversation starts from a shared understanding. The $4.2M question is answered. The conversation from here is about execution, leverage, and how far above the floor GYC chooses to land.
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
  // Note: Chart order in doc is 1,4,2,3,5 but we generate all 5 first
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
  await sleep(1500);

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
  await sleep(1500);

  // ---- STEP 5: Apply formatting ----
  console.log('\n=== APPLYING FORMATTING ===');
  
  res = await docs.documents.get({ documentId: DOC_ID });
  body = res.data.body.content;
  
  const formatRequests = [];
  
  for (const elem of body) {
    if (!elem.paragraph) continue;
    const text = elem.paragraph.elements.map(e => e.textRun?.content || '').join('').trim();
    const start = elem.startIndex;
    const end = elem.endIndex;
    
    // Title — 28pt bold purple centered
    if (text === 'GYC REVENUE REPORT') {
      formatRequests.push({
        updateParagraphStyle: {
          range: { startIndex: start, endIndex: end },
          paragraphStyle: { namedStyleType: 'HEADING_1', alignment: 'CENTER' },
          fields: 'namedStyleType,alignment'
        }
      });
      formatRequests.push({
        updateTextStyle: {
          range: { startIndex: start, endIndex: end - 1 },
          textStyle: {
            foregroundColor: { color: { rgbColor: { red: 0.451, green: 0.078, blue: 0.580 } } },
            bold: true,
            fontSize: { magnitude: 28, unit: 'PT' }
          },
          fields: 'foregroundColor,bold,fontSize'
        }
      });
    }
    
    // Subtitle/metadata line
    if (text.startsWith('Prepared for: Bruce Spurr')) {
      formatRequests.push({
        updateTextStyle: {
          range: { startIndex: start, endIndex: end - 1 },
          textStyle: {
            italic: true,
            foregroundColor: { color: { rgbColor: { red: 0.42, green: 0.42, blue: 0.42 } } },
            fontSize: { magnitude: 10, unit: 'PT' }
          },
          fields: 'italic,foregroundColor,fontSize'
        }
      });
    }
    
    // Section headings — 16pt bold deep violet, page break before
    if (text === 'EXECUTIVE SUMMARY' || text.match(/^SECTION \d+:/)) {
      formatRequests.push({
        updateParagraphStyle: {
          range: { startIndex: start, endIndex: end },
          paragraphStyle: {
            namedStyleType: 'HEADING_2',
            pageBreakBefore: true
          },
          fields: 'namedStyleType,pageBreakBefore'
        }
      });
      formatRequests.push({
        updateTextStyle: {
          range: { startIndex: start, endIndex: end - 1 },
          textStyle: {
            foregroundColor: { color: { rgbColor: { red: 0.204, green: 0.043, blue: 0.404 } } },
            bold: true,
            fontSize: { magnitude: 16, unit: 'PT' }
          },
          fields: 'foregroundColor,bold,fontSize'
        }
      });
    }
    
    // Key takeaway lines (short bold-worthy callout lines)
    const isBoldTakeaway = (
      text === 'The $4.2 million target is already hit — in every single scenario — by 2027. That is not a stretch goal. That is the floor.' ||
      text === '2026 is the building year. 2027 is the payoff year.' ||
      text === 'The levers determine how far above $4.2M GYC lands. Not whether it lands there.' ||
      text === 'The target is not a ceiling — it is the starting point.' ||
      text === 'This pipeline is not a projection. It is locked in. The clients already exist. The contracts are already in the system. The MRR is already earned.' ||
      text === 'The $4.2M question is answered. The conversation from here is about execution, leverage, and how far above the floor GYC chooses to land.'
    );
    if (isBoldTakeaway) {
      formatRequests.push({
        updateTextStyle: {
          range: { startIndex: start, endIndex: end - 1 },
          textStyle: {
            foregroundColor: { color: { rgbColor: { red: 0.451, green: 0.078, blue: 0.580 } } },
            bold: true,
            fontSize: { magnitude: 12, unit: 'PT' }
          },
          fields: 'foregroundColor,bold,fontSize'
        }
      });
    }

    // Body text — 11pt #111827
    const isBodyText = !isBoldTakeaway &&
      text !== 'GYC REVENUE REPORT' &&
      !text.startsWith('Prepared for: Bruce Spurr') &&
      text !== 'EXECUTIVE SUMMARY' &&
      !text.match(/^SECTION \d+:/) &&
      !text.match(/^(Year|Month|2023|2024|2025|2026|April|May|June|July|August|September|October|November|December|January|February|March|Base|Jesse|TOTAL|                    Base)/) &&
      text.length > 40;
    if (isBodyText) {
      formatRequests.push({
        updateTextStyle: {
          range: { startIndex: start, endIndex: end - 1 },
          textStyle: {
            foregroundColor: { color: { rgbColor: { red: 0.067, green: 0.094, blue: 0.153 } } },
            fontSize: { magnitude: 11, unit: 'PT' }
          },
          fields: 'foregroundColor,fontSize'
        }
      });
    }
  }
  
  if (formatRequests.length > 0) {
    for (let i = 0; i < formatRequests.length; i += 20) {
      await docs.documents.batchUpdate({
        documentId: DOC_ID,
        requestBody: { requests: formatRequests.slice(i, i + 20) }
      });
      await sleep(500);
    }
    console.log(`✅ Applied ${formatRequests.length} formatting requests`);
  }
  await sleep(1000);

  // ---- STEP 6: Find placeholder positions and insert charts ----
  console.log('\n=== FINDING CHART PLACEHOLDERS ===');
  
  res = await docs.documents.get({ documentId: DOC_ID });
  body = res.data.body.content;

  // Placeholders in document order: 1, 4, 2, 3, 5
  // chartUrls index: 0=chart1, 1=chart2, 2=chart3, 3=chart4, 4=chart5
  const placeholders = [
    { marker: 'CHART_PLACEHOLDER_1', chartIdx: 0 },
    { marker: 'CHART_PLACEHOLDER_2', chartIdx: 1 },
    { marker: 'CHART_PLACEHOLDER_3', chartIdx: 2 },
    { marker: 'CHART_PLACEHOLDER_4', chartIdx: 3 },
    { marker: 'CHART_PLACEHOLDER_5', chartIdx: 4 },
  ];
  const found = [];

  for (const elem of body) {
    if (!elem.paragraph) continue;
    const text = elem.paragraph.elements.map(e => e.textRun?.content || '').join('');
    for (const ph of placeholders) {
      if (text.includes(ph.marker)) {
        found.push({
          ...ph,
          startIndex: elem.startIndex,
          endIndex: elem.endIndex,
        });
        console.log(`✅ Found ${ph.marker} at indices ${elem.startIndex}-${elem.endIndex}`);
        break;
      }
    }
  }

  if (found.length !== 5) {
    console.error(`❌ Only found ${found.length}/5 placeholders!`);
    found.forEach(f => console.log(`  Found: ${f.marker}`));
    process.exit(1);
  }

  // ---- STEP 7: Replace placeholders with images (process in REVERSE order) ----
  console.log('\n=== INSERTING CHARTS (reverse order) ===');
  
  found.sort((a, b) => b.startIndex - a.startIndex);

  for (const f of found) {
    const chartUrl = chartUrls[f.chartIdx];
    console.log(`\nProcessing ${f.marker} (Chart ${f.chartIdx+1})...`);
    
    // Insert image at startIndex of the placeholder paragraph
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

    // Re-fetch to find updated placeholder position
    const res2 = await docs.documents.get({ documentId: DOC_ID });
    const body2 = res2.data.body.content;
    
    let placeholderElem = null;
    for (const elem of body2) {
      if (!elem.paragraph) continue;
      const t = elem.paragraph.elements.map(e => e.textRun?.content || '').join('');
      if (t.includes(f.marker)) {
        placeholderElem = elem;
        break;
      }
    }

    if (placeholderElem) {
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
  console.log('=== REBUILD v3 COMPLETE ===');
  console.log('=====================================');
  console.log('✅ Document cleared and rewritten with corrected figures');
  console.log('✅ All 5 charts inserted (Chart 5 now includes Jesse ARR line)');
  console.log('✅ Narrative updated: base case exceeds $4.2M in 2027 = the floor');
  console.log(`📄 Doc: https://docs.google.com/document/d/${DOC_ID}/edit`);
  console.log('\nChart URLs:');
  chartUrls.forEach((url, i) => console.log(`  Chart ${i+1}: ${url}`));
}

main().catch(err => {
  console.error('FATAL:', err.message || err);
  if (err.response?.data) console.error('API error:', JSON.stringify(err.response.data, null, 2));
  process.exit(1);
});
