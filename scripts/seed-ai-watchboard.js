#!/usr/bin/env node

/**
 * Seed script for AI WatchBoard
 * Seeds 29 core variables + 40 AI companies
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TENANT_ID = 'gyc';

// 20 core variables from the research brief
const variables = [
  // Category 1: Valuation Metrics
  {
    key: 'shiller_cape',
    category: 'valuation',
    label: 'Shiller CAPE Ratio',
    value: 40.0,
    unit: '',
    status: 'red',
    source: 'Macrotrends',
    sourceUrl: 'https://www.macrotrends.net/countries/USA/united-states/shiller-pe-ratio'
  },
  {
    key: 'nvidia_revenue_multiple',
    category: 'valuation',
    label: 'Nvidia Revenue Multiple',
    value: 25.0,
    unit: 'x',
    status: 'red',
    source: 'Yahoo Finance',
    sourceUrl: 'https://finance.yahoo.com/quote/NVDA'
  },
  {
    key: 'ai_sector_forward_pe',
    category: 'valuation',
    label: 'AI Sector Forward P/E',
    value: 28.0,
    unit: 'x',
    status: 'red',
    source: 'Bloomberg',
    sourceUrl: null
  },
  {
    key: 'buffett_indicator',
    category: 'valuation',
    label: 'Buffett Indicator (Market Cap/GDP)',
    value: 195.0,
    unit: '%',
    status: 'yellow',
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/'
  },
  {
    key: 'ai_ipo_ps_median',
    category: 'valuation',
    label: 'AI IPO/Late-Stage P/S Median',
    value: 22.0,
    unit: 'x',
    status: 'red',
    source: 'PitchBook',
    sourceUrl: null
  },

  // Category 2: Investment Flow & Capital Efficiency
  {
    key: 'vc_to_ai_quarterly',
    category: 'investment_flow',
    label: 'Global VC to AI (Quarterly)',
    value: 54.0,
    unit: '$B',
    status: 'yellow',
    source: 'Crunchbase',
    sourceUrl: null
  },
  {
    key: 'investment_to_revenue_ratio',
    category: 'investment_flow',
    label: 'AI Investment-to-Revenue Ratio',
    value: 5.5,
    unit: ':1',
    status: 'red',
    source: 'Stanford HAI + Industry',
    sourceUrl: null
  },
  {
    key: 'big_tech_ai_capex',
    category: 'investment_flow',
    label: 'Big Tech AI CAPEX (Quarterly)',
    value: 80.0,
    unit: '$B',
    status: 'yellow',
    source: 'Company Earnings',
    sourceUrl: null
  },
  {
    key: 'startup_mortality_rate',
    category: 'investment_flow',
    label: 'AI Startup Mortality Rate (Series A Closures)',
    value: 85.0,
    unit: '%',
    status: 'red',
    source: 'PitchBook',
    sourceUrl: null
  },
  {
    key: 'down_round_frequency',
    category: 'investment_flow',
    label: 'Down Round Frequency (Series A+)',
    value: 19.0,
    unit: '%',
    status: 'yellow',
    source: 'Carta',
    sourceUrl: null
  },

  // Category 3: Infrastructure & Physical Constraints
  {
    key: 'datacenter_power_growth',
    category: 'infrastructure',
    label: 'Data Center Power Demand Growth',
    value: 16.0,
    unit: '%',
    status: 'yellow',
    source: 'IEA',
    sourceUrl: null
  },
  {
    key: 'gpu_pricing_volatility',
    category: 'infrastructure',
    label: 'GPU Pricing Volatility (H100 Spot 90d)',
    value: 35.0,
    unit: '%',
    status: 'yellow',
    source: 'CAST.AI',
    sourceUrl: null
  },
  {
    key: 'tsmc_cowos_utilization',
    category: 'infrastructure',
    label: 'TSMC CoWoS Capacity Utilization',
    value: 98.0,
    unit: '%',
    status: 'red',
    source: 'TSMC Earnings',
    sourceUrl: null
  },
  {
    key: 'hbm_supply_gap',
    category: 'infrastructure',
    label: 'HBM Supply Gap (Generations Behind)',
    value: 2.5,
    unit: 'gen',
    status: 'green',
    source: 'Semiconductor Analysts',
    sourceUrl: null
  },
  {
    key: 'nuclear_ppa_gw',
    category: 'infrastructure',
    label: 'Nuclear PPA Announcements',
    value: 12.0,
    unit: 'GW',
    status: 'yellow',
    source: 'Energy News',
    sourceUrl: null
  },

  // Category 4: Enterprise Adoption & ROI
  {
    key: 'enterprise_roi_pct',
    category: 'adoption',
    label: '% Enterprises Reporting Significant AI ROI',
    value: 6.0,
    unit: '%',
    status: 'red',
    source: 'McKinsey',
    sourceUrl: null
  },
  {
    key: 'avg_time_to_roi',
    category: 'adoption',
    label: 'Average Time-to-ROI',
    value: 18.0,
    unit: 'months',
    status: 'yellow',
    source: 'IBM / Deloitte',
    sourceUrl: null
  },
  {
    key: 'ai_productivity_growth',
    category: 'adoption',
    label: 'AI-Attributed Productivity Growth',
    value: 0.8,
    unit: '%',
    status: 'yellow',
    source: 'NBER',
    sourceUrl: null
  },
  {
    key: 'genai_pilot_success_rate',
    category: 'adoption',
    label: 'GenAI Pilot Success Rate',
    value: 5.0,
    unit: '%',
    status: 'red',
    source: 'MIT',
    sourceUrl: null
  },

  // Category 5: Regulatory & Geopolitical Risk
  {
    key: 'export_control_escalations',
    category: 'regulatory',
    label: 'U.S.-China Export Control Escalations (Quarterly)',
    value: 2.0,
    unit: 'events',
    status: 'yellow',
    source: 'BIS / Trade News',
    sourceUrl: null
  },

  // Category 6: Dot-Com Lessons (1999–2002)
  {
    key: 'ai_ipo_health_index',
    category: 'dot_com_lessons',
    label: 'AI IPO Health Index',
    value: -8.0,
    unit: '%',
    status: 'red',
    source: 'CoreWeave IPO Data',
    sourceUrl: null,
    description: 'Tracks CoreWeave + upcoming AI IPOs vs. post-IPO 90-day performance. In dot-com, 90-day returns went negative by late 1999. WATCHING FOR: Negative post-IPO performance = market losing appetite for AI valuations. 🟢 >20% | 🟡 0–20% | 🔴 <0%'
  },
  {
    key: 'analyst_consensus_score',
    category: 'dot_com_lessons',
    label: 'Analyst Consensus Score',
    value: 87.0,
    unit: '%',
    status: 'red',
    source: 'Analyst Ratings Aggregator',
    sourceUrl: null,
    description: '% of major AI companies with "buy" ratings. Dot-com peak was ~98% buy — a contrarian warning. WATCHING FOR: Analyst unanimity = herd thinking, not due diligence. 🟢 <75% | 🟡 75–85% | 🔴 >85%'
  },
  {
    key: 'ai_mandate_roi_gap',
    category: 'dot_com_lessons',
    label: 'Corporate AI Mandate vs. ROI Gap',
    value: 8.0,
    unit: ':1',
    status: 'red',
    source: 'Corporate AI Spending Reports',
    sourceUrl: null,
    description: 'Ratio of corporate AI spending announced vs. ROI reported. The dot-com "eyeballs" metric — companies were valued on clicks, not revenue. WATCHING FOR: Spending 8x what\'s being earned back — exactly what eyeballs metrics did in 1999. 🟢 <3:1 | 🟡 3–5:1 | 🔴 >5:1'
  },
  {
    key: 'nvidia_correction_risk',
    category: 'dot_com_lessons',
    label: 'Nvidia Correction Risk Index',
    value: 55.0,
    unit: 'x P/E',
    status: 'yellow',
    source: 'Yahoo Finance',
    sourceUrl: null,
    description: 'Nvidia\'s forward P/E ratio as a proxy for Cisco 2000 risk. In dot-com, Cisco dropped 86% from peak when the sector repriced. WATCHING FOR: If Nvidia reprices, the entire AI sector reprices with it. 🟢 <40x | 🟡 40–70x | 🔴 >70x'
  },

  // Category 7: Telecom Lessons (2000–2002)
  {
    key: 'hyperscaler_capex_revenue_ratio',
    category: 'telecom_lessons',
    label: 'Hyperscaler CAPEX-to-AI-Revenue Ratio',
    value: 4.2,
    unit: ':1',
    status: 'yellow',
    source: 'Hyperscaler Earnings Reports',
    sourceUrl: null,
    description: 'Capital spend by hyperscalers (Microsoft, Google, Amazon, Meta) relative to AI-specific revenue. The "dark fiber" metric — in telecom, fiber was laid far ahead of demand, then sat unused. WATCHING FOR: Capacity being built years ahead of monetization. 🟢 <3:1 | 🟡 3–5:1 | 🔴 >5:1'
  },
  {
    key: 'datacenter_utilization_rate',
    category: 'telecom_lessons',
    label: 'Data Center Utilization Rate',
    value: 65.0,
    unit: '%',
    status: 'yellow',
    source: 'Data Center Industry Reports',
    sourceUrl: null,
    description: '% of existing data center capacity in active use before new capacity comes online. Low utilization = dark fiber analog. WATCHING FOR: New builds opening before old builds fill — oversupply spiral. 🟢 >75% | 🟡 50–75% | 🔴 <50%'
  },
  {
    key: 'nvidia_order_backlog_trend',
    category: 'telecom_lessons',
    label: 'Nvidia Order Backlog Trend',
    value: 15.0,
    unit: '% QoQ',
    status: 'green',
    source: 'Nvidia Earnings',
    sourceUrl: null,
    description: 'Quarter-over-quarter change in Nvidia\'s order backlog. Cancellations were the first signal of the telecom collapse (Nortel orders dried up before earnings reflected it). WATCHING FOR: First cancellations = canary in the coal mine. 🟢 >5% growth | 🟡 0–5% | 🔴 any decline'
  },
  {
    key: 'datacenter_geographic_concentration',
    category: 'telecom_lessons',
    label: 'Geographic Data Center Concentration',
    value: 7.0,
    unit: 'builds/grid',
    status: 'red',
    source: 'Regional Grid Analysis',
    sourceUrl: null,
    description: 'Average number of competing data center builds in the same power grid zones (Northern Virginia, Phoenix, etc.). High concentration = systemic risk if one market oversupplies. WATCHING FOR: Same-grid competition → price war → margin collapse → debt defaults. 🟢 <3 | 🟡 3–5 | 🔴 >5'
  },
  {
    key: 'ai_infrastructure_debt_load',
    category: 'telecom_lessons',
    label: 'AI Infrastructure Debt Load',
    value: 5.8,
    unit: 'x D/EBITDA',
    status: 'yellow',
    source: 'Corporate Debt Filings',
    sourceUrl: null,
    description: 'Average Debt-to-EBITDA ratio for major AI infrastructure players. Telecom bubble: WorldCom\'s D/EBITDA hit 12x before collapse. Current AI infra players already at concerning levels. WATCHING FOR: Debt servicing becomes impossible when revenue growth slows. 🟢 <4x | 🟡 4–7x | 🔴 >7x'
  }
];

// 40 AI companies to track
const companies = [
  // Hardware & Compute
  { ticker: 'NVDA', name: 'Nvidia', category: 'hardware', currentPrice: 140.0, marketCap: 3500.0 },
  { ticker: 'AMD', name: 'AMD', category: 'hardware', currentPrice: 145.0, marketCap: 235.0 },
  { ticker: 'INTC', name: 'Intel', category: 'hardware', currentPrice: 25.0, marketCap: 105.0 },
  { ticker: 'TSM', name: 'TSMC', category: 'hardware', currentPrice: 180.0, marketCap: 930.0 },
  { ticker: 'AVGO', name: 'Broadcom', category: 'hardware', currentPrice: 220.0, marketCap: 950.0 },
  { ticker: 'MRVL', name: 'Marvell', category: 'hardware', currentPrice: 75.0, marketCap: 65.0 },
  { ticker: 'SMCI', name: 'Super Micro', category: 'hardware', currentPrice: 45.0, marketCap: 26.0 },
  { ticker: 'ASML', name: 'ASML', category: 'hardware', currentPrice: 950.0, marketCap: 380.0 },
  { ticker: 'AMAT', name: 'Applied Materials', category: 'hardware', currentPrice: 200.0, marketCap: 165.0 },
  { ticker: 'ARM', name: 'Arm Holdings', category: 'hardware', currentPrice: 145.0, marketCap: 150.0 },

  // Hyperscalers
  { ticker: 'MSFT', name: 'Microsoft', category: 'hyperscaler', currentPrice: 430.0, marketCap: 3200.0 },
  { ticker: 'GOOGL', name: 'Alphabet', category: 'hyperscaler', currentPrice: 175.0, marketCap: 2200.0 },
  { ticker: 'AMZN', name: 'Amazon', category: 'hyperscaler', currentPrice: 210.0, marketCap: 2100.0 },
  { ticker: 'META', name: 'Meta', category: 'hyperscaler', currentPrice: 575.0, marketCap: 1450.0 },
  { ticker: 'ORCL', name: 'Oracle', category: 'hyperscaler', currentPrice: 155.0, marketCap: 440.0 },

  // AI-First Public
  { ticker: 'PLTR', name: 'Palantir', category: 'ai_first_public', currentPrice: 75.0, marketCap: 165.0 },
  { ticker: 'AI', name: 'C3.ai', category: 'ai_first_public', currentPrice: 28.0, marketCap: 3.2 },
  { ticker: 'PATH', name: 'UiPath', category: 'ai_first_public', currentPrice: 13.0, marketCap: 7.5 },
  { ticker: 'CRM', name: 'Salesforce', category: 'ai_first_public', currentPrice: 310.0, marketCap: 295.0 },
  { ticker: 'NOW', name: 'ServiceNow', category: 'ai_first_public', currentPrice: 950.0, marketCap: 195.0 },
  { ticker: 'SNOW', name: 'Snowflake', category: 'ai_first_public', currentPrice: 145.0, marketCap: 48.0 },
  { ticker: 'IBM', name: 'IBM', category: 'ai_first_public', currentPrice: 230.0, marketCap: 210.0 },

  // AI-First Private (no ticker — valuation only)
  { ticker: null, name: 'OpenAI', category: 'ai_first_private', currentPrice: null, marketCap: 80.0 },
  { ticker: null, name: 'Anthropic', category: 'ai_first_private', currentPrice: null, marketCap: 30.0 },
  { ticker: null, name: 'xAI', category: 'ai_first_private', currentPrice: null, marketCap: 50.0 },
  { ticker: null, name: 'Databricks', category: 'ai_first_private', currentPrice: null, marketCap: 43.0 },
  { ticker: null, name: 'Mistral', category: 'ai_first_private', currentPrice: null, marketCap: 6.0 },

  // Physical AI
  { ticker: 'TSLA', name: 'Tesla', category: 'physical_ai', currentPrice: 265.0, marketCap: 850.0 },
  { ticker: 'VRT', name: 'Vertiv Holdings', category: 'physical_ai', currentPrice: 120.0, marketCap: 46.0 },
  { ticker: 'DELL', name: 'Dell', category: 'physical_ai', currentPrice: 135.0, marketCap: 95.0 },

  // Energy AI
  { ticker: 'CEG', name: 'Constellation Energy', category: 'energy_ai', currentPrice: 230.0, marketCap: 75.0 },
  { ticker: 'VST', name: 'Vistra', category: 'energy_ai', currentPrice: 135.0, marketCap: 50.0 },
  { ticker: 'NEE', name: 'NextEra Energy', category: 'energy_ai', currentPrice: 75.0, marketCap: 150.0 },
  { ticker: 'ETN', name: 'Eaton', category: 'energy_ai', currentPrice: 340.0, marketCap: 135.0 },

  // Additional AI infrastructure/software
  { ticker: 'DDOG', name: 'Datadog', category: 'ai_first_public', currentPrice: 135.0, marketCap: 45.0 },
  { ticker: 'NET', name: 'Cloudflare', category: 'ai_first_public', currentPrice: 95.0, marketCap: 32.0 },
  { ticker: 'CRWD', name: 'CrowdStrike', category: 'ai_first_public', currentPrice: 350.0, marketCap: 85.0 },
  { ticker: 'ZS', name: 'Zscaler', category: 'ai_first_public', currentPrice: 210.0, marketCap: 31.0 },
  { ticker: 'MDB', name: 'MongoDB', category: 'ai_first_public', currentPrice: 290.0, marketCap: 21.0 },
  { ticker: 'CFLT', name: 'Confluent', category: 'ai_first_public', currentPrice: 28.0, marketCap: 8.5 }
];

async function main() {
  console.log('🤖 AI WatchBoard Seed Script');
  console.log('=============================\n');

  // Seed variables
  console.log('📊 Seeding 29 core variables (20 original + 9 bubble lessons)...');
  for (const v of variables) {
    await prisma.aIWatchVariable.upsert({
      where: {
        id: `${TENANT_ID}_${v.key}` // Composite key for idempotency
      },
      update: {
        ...v,
        tenantId: TENANT_ID,
        lastUpdated: new Date()
      },
      create: {
        id: `${TENANT_ID}_${v.key}`,
        ...v,
        tenantId: TENANT_ID
      }
    });
  }
  console.log('✅ Variables seeded\n');

  // Seed companies
  console.log('🏢 Seeding 40 AI companies...');
  for (const c of companies) {
    const id = c.ticker ? `${TENANT_ID}_${c.ticker}` : `${TENANT_ID}_${c.name.replace(/\s+/g, '_').toLowerCase()}`;
    await prisma.aIWatchCompany.upsert({
      where: { id },
      update: {
        ...c,
        tenantId: TENANT_ID,
        lastUpdated: new Date()
      },
      create: {
        id,
        ...c,
        tenantId: TENANT_ID
      }
    });
  }
  console.log('✅ Companies seeded\n');

  // Create initial snapshot
  console.log('📸 Creating initial bubble score snapshot...');
  await prisma.aIWatchSnapshot.create({
    data: {
      tenantId: TENANT_ID,
      bubbleScore: 7.0, // From research brief: 7/10 risk
      compositeStatus: 'red',
      notes: 'Initial baseline from July 2026 research brief. Score: 7/10 (HIGH BUBBLE RISK with real underlying boom). Red flags: valuation metrics at dot-com levels, massive investment-to-revenue gap (5.5:1), extremely high startup mortality (85%), productivity paradox (investment rising much faster than measurable returns).'
    }
  });
  console.log('✅ Snapshot created\n');

  console.log('🎉 AI WatchBoard seeded successfully!');
  console.log('\n📌 Next steps:');
  console.log('   - Build the API routes');
  console.log('   - Create the JARVIS-style WatchBoard page');
  console.log('   - Wire up data refresh pipelines');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
