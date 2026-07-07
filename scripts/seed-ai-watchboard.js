#!/usr/bin/env node

/**
 * Seed script for AI WatchBoard
 * Seeds 20 core variables + 40 AI companies
 */

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
  console.log('📊 Seeding 20 core variables...');
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
