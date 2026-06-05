import { config } from 'dotenv';
import pg from 'pg';
const { Client } = pg;

// Load environment variables
config({ path: '/Users/toddthejedigmail.com/.openclaw/workspace/gyc-dashboard/.env.local' });

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Dashboard Truth Layer
 * Validates data accuracy across 3 categories:
 * A) Source Validation - data arrived correctly
 * B) Math Validation - formulas are correct
 * C) Anomaly Detection - something broke
 */

const checks = [];

function addCheck(name, status, detail) {
  checks.push({ name, status, detail });
  const emoji = status === 'PASS' ? '✅' : status === 'WARN' ? '⚠️' : '❌';
  console.log(`${emoji} ${status} - ${name}: ${detail}`);
}

async function runChecks() {
  console.log('🔍 Running Dashboard Truth Layer checks...\n');
  console.log('═'.repeat(60));
  
  try {
    await client.connect();

    // ================================================================
    // CATEGORY A — Source Validation (data arrived correctly)
    // ================================================================
    console.log('\n📥 CATEGORY A — Source Validation\n');

    // A1: Stripe MRR consistency
    const stripeMetricsQuery = `
      SELECT mrr, "activeCustomers" 
      FROM "StripeMetrics" 
      ORDER BY "syncedAt" DESC 
      LIMIT 1
    `;
    const customerSumQuery = `
      SELECT SUM(mrr) as total_mrr, COUNT(*) as active_count
      FROM "StripeCustomer"
      WHERE status IN ('active', 'past_due')
    `;
    
    const [metricsResult, customerResult] = await Promise.all([
      client.query(stripeMetricsQuery),
      client.query(customerSumQuery)
    ]);

    if (metricsResult.rows.length > 0) {
      const metricsMRR = parseFloat(metricsResult.rows[0].mrr);
      const customersMRR = parseFloat(customerResult.rows[0].total_mrr || 0);
      const diff = Math.abs(metricsMRR - customersMRR);
      
      if (diff > 500) {
        addCheck(
          'Stripe MRR vs Customer Sum',
          'WARN',
          `$${diff.toFixed(2)} delta (Metrics: $${metricsMRR.toFixed(2)}, Customers: $${customersMRR.toFixed(2)})`
        );
      } else {
        addCheck('Stripe MRR vs Customer Sum', 'PASS', `Delta: $${diff.toFixed(2)}`);
      }
    } else {
      addCheck('Stripe MRR vs Customer Sum', 'FAIL', 'No StripeMetrics snapshot found');
    }

    // A2: Active customer count consistency
    if (metricsResult.rows.length > 0) {
      const metricsCount = parseInt(metricsResult.rows[0].activeCustomers);
      const customersCount = parseInt(customerResult.rows[0].active_count);
      const countDiff = Math.abs(metricsCount - customersCount);
      
      if (countDiff > 5) {
        addCheck(
          'Active Customer Count',
          'WARN',
          `${countDiff} customer difference (Metrics: ${metricsCount}, Customers: ${customersCount})`
        );
      } else {
        addCheck('Active Customer Count', 'PASS', `Delta: ${countDiff} customers`);
      }
    }

    // A3: Leadership snapshot freshness
    const leadershipQuery = `
      SELECT "asOf", payload
      FROM "LeadershipSnapshot"
      ORDER BY "asOf" DESC
      LIMIT 1
    `;
    const leadershipResult = await client.query(leadershipQuery);
    
    if (leadershipResult.rows.length > 0) {
      const asOf = new Date(leadershipResult.rows[0].asOf);
      const hoursSinceUpdate = (Date.now() - asOf.getTime()) / (1000 * 60 * 60);
      const payload = leadershipResult.rows[0].payload;
      
      if (hoursSinceUpdate > 25) {
        addCheck(
          'Leadership Snapshot Freshness',
          'FAIL',
          `Snapshot is ${hoursSinceUpdate.toFixed(1)}h old (updated: ${asOf.toISOString()})`
        );
      } else {
        addCheck(
          'Leadership Snapshot Freshness',
          'PASS',
          `Updated ${hoursSinceUpdate.toFixed(1)}h ago`
        );
      }

      // Check if finance.metrics is null (the issue we hit today)
      if (payload?.finance?.metrics === null || payload?.finance?.metrics === undefined) {
        addCheck(
          'Leadership Finance Metrics',
          'FAIL',
          'finance.metrics is null — dashboard will show $0 MRR. Fix: curl -X GET https://gyc-dashboard-ra9a.onrender.com/api/metrics/leadership?refresh=1'
        );
      } else {
        addCheck('Leadership Finance Metrics', 'PASS', 'finance.metrics populated');
      }
    } else {
      addCheck('Leadership Snapshot Freshness', 'FAIL', 'No LeadershipSnapshot found');
    }

    // A4: Churn data exists for current month
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const mrrHistoryQuery = `
      SELECT month, mrr, "churnedMrr", "newMrr"
      FROM "MRRHistory"
      WHERE month = $1
    `;
    const mrrHistoryResult = await client.query(mrrHistoryQuery, [currentMonth]);
    
    if (mrrHistoryResult.rows.length > 0) {
      addCheck('MRR History Current Month', 'PASS', `${currentMonth} data exists`);
    } else {
      addCheck(
        'MRR History Current Month',
        'WARN',
        `No MRRHistory entry for ${currentMonth} yet (may be early in month)`
      );
    }

    // A5: GA data for last month
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastMonthStr = lastMonth.toISOString().slice(0, 7);
    
    const gaMonthlyQuery = `
      SELECT COUNT(*) as client_count
      FROM "ClientWebsiteTrafficMonthly"
      WHERE "periodMonth" = $1
    `;
    const gaMonthlyResult = await client.query(gaMonthlyQuery, [lastMonthStr]);
    const clientCount = parseInt(gaMonthlyResult.rows[0].client_count);
    
    if (clientCount === 0) {
      addCheck(
        'GA Monthly Data',
        'WARN',
        `No ClientWebsiteTrafficMonthly entries for ${lastMonthStr}`
      );
    } else {
      addCheck('GA Monthly Data', 'PASS', `${clientCount} clients have data for ${lastMonthStr}`);
    }

    // ================================================================
    // CATEGORY B — Math Validation (formulas correct)
    // ================================================================
    console.log('\n🧮 CATEGORY B — Math Validation\n');

    // B1: NRR sanity check (should be 80-130%)
    const lastTwoMonthsQuery = `
      SELECT month, mrr
      FROM "MRRHistory"
      ORDER BY month DESC
      LIMIT 2
    `;
    const lastTwoMonths = await client.query(lastTwoMonthsQuery);
    
    if (lastTwoMonths.rows.length >= 2) {
      const currentMRR = parseFloat(lastTwoMonths.rows[0].mrr);
      const previousMRR = parseFloat(lastTwoMonths.rows[1].mrr);
      const nrr = (currentMRR / previousMRR) * 100;
      
      if (nrr < 80 || nrr > 130) {
        addCheck(
          'NRR Sanity Check',
          'WARN',
          `NRR is ${nrr.toFixed(1)}% (outside 80-130% range). Current: $${currentMRR.toFixed(2)}, Previous: $${previousMRR.toFixed(2)}`
        );
      } else {
        addCheck('NRR Sanity Check', 'PASS', `NRR is ${nrr.toFixed(1)}%`);
      }
    } else {
      addCheck('NRR Sanity Check', 'WARN', 'Not enough MRRHistory data (need 2+ months)');
    }

    // B2: Close rate math validation
    const salesActivityQuery = `
      SELECT payload
      FROM "SalesActivitySnapshot"
      ORDER BY "asOf" DESC
      LIMIT 1
    `;
    const salesResult = await client.query(salesActivityQuery);
    
    if (salesResult.rows.length > 0) {
      const payload = salesResult.rows[0].payload;
      const shown = payload?.agreementsShown || 0;
      const closed = payload?.agreementsClosed || 0;
      const reportedCloseRate = payload?.closeRate || 0;
      
      if (shown > 0 && closed > 0) {
        const calculatedCloseRate = (closed / shown) * 100;
        const diff = Math.abs(calculatedCloseRate - reportedCloseRate);
        
        if (diff > 1) {
          addCheck(
            'Close Rate Math',
            'WARN',
            `Close rate mismatch: reported ${reportedCloseRate.toFixed(1)}%, calculated ${calculatedCloseRate.toFixed(1)}%`
          );
        } else {
          addCheck('Close Rate Math', 'PASS', `${reportedCloseRate.toFixed(1)}% validated`);
        }
      } else {
        addCheck('Close Rate Math', 'PASS', 'No agreements to validate');
      }
    } else {
      addCheck('Close Rate Math', 'WARN', 'No SalesActivitySnapshot found');
    }

    // B3: MRR direction vs customer count
    const lastThreeMonthsQuery = `
      SELECT month, mrr, "activeSubscriptions"
      FROM "MRRHistory"
      ORDER BY month DESC
      LIMIT 3
    `;
    const lastThree = await client.query(lastThreeMonthsQuery);
    
    if (lastThree.rows.length >= 2) {
      const current = lastThree.rows[0];
      const previous = lastThree.rows[1];
      
      const mrrChange = ((parseFloat(current.mrr) - parseFloat(previous.mrr)) / parseFloat(previous.mrr)) * 100;
      const subsChange = current.activeSubscriptions && previous.activeSubscriptions
        ? ((current.activeSubscriptions - previous.activeSubscriptions) / previous.activeSubscriptions) * 100
        : null;
      
      if (subsChange !== null) {
        // If subscriptions increased by 10%+ but MRR dropped by 20%+, flag it
        if (subsChange > 10 && mrrChange < -20) {
          addCheck(
            'MRR vs Subscription Direction',
            'WARN',
            `Subs up ${subsChange.toFixed(1)}% but MRR down ${Math.abs(mrrChange).toFixed(1)}% — unusual divergence`
          );
        } else {
          addCheck(
            'MRR vs Subscription Direction',
            'PASS',
            `MRR ${mrrChange >= 0 ? '+' : ''}${mrrChange.toFixed(1)}%, Subs ${subsChange >= 0 ? '+' : ''}${subsChange.toFixed(1)}%`
          );
        }
      } else {
        addCheck('MRR vs Subscription Direction', 'PASS', 'No subscription count to compare');
      }
    }

    // ================================================================
    // CATEGORY C — Anomaly Detection (something broke)
    // ================================================================
    console.log('\n🚨 CATEGORY C — Anomaly Detection\n');

    // C1: StripeMetrics dropped to zero
    const lastTwoMetricsQuery = `
      SELECT mrr, "totalRevenue", "activeCustomers", "syncedAt"
      FROM "StripeMetrics"
      ORDER BY "syncedAt" DESC
      LIMIT 2
    `;
    const lastTwoMetrics = await client.query(lastTwoMetricsQuery);
    
    if (lastTwoMetrics.rows.length >= 2) {
      const current = lastTwoMetrics.rows[0];
      const previous = lastTwoMetrics.rows[1];
      
      const anomalies = [];
      if (parseFloat(current.mrr) === 0 && parseFloat(previous.mrr) > 0) {
        anomalies.push('MRR dropped to $0');
      }
      if (parseFloat(current.totalRevenue) === 0 && parseFloat(previous.totalRevenue) > 0) {
        anomalies.push('totalRevenue dropped to $0');
      }
      if (parseInt(current.activeCustomers) === 0 && parseInt(previous.activeCustomers) > 0) {
        anomalies.push('activeCustomers dropped to 0');
      }
      
      if (anomalies.length > 0) {
        addCheck(
          'StripeMetrics Zero Anomaly',
          'FAIL',
          `Detected zero values: ${anomalies.join(', ')}`
        );
      } else {
        addCheck('StripeMetrics Zero Anomaly', 'PASS', 'No unexpected zeros detected');
      }
    }

    // C2: GA daily sessions anomaly
    const gaDailyAnomalyQuery = `
      WITH ranked AS (
        SELECT 
          "propertyId",
          date,
          sessions,
          LAG(sessions, 1) OVER (PARTITION BY "propertyId" ORDER BY date DESC) as prev_sessions
        FROM "GAMetricsDaily"
        WHERE date >= CURRENT_DATE - INTERVAL '8 days'
      )
      SELECT 
        "propertyId",
        COUNT(*) as anomaly_count
      FROM ranked
      WHERE prev_sessions > 100 AND sessions = 0
      GROUP BY "propertyId"
    `;
    const gaDailyAnomaly = await client.query(gaDailyAnomalyQuery);
    
    if (gaDailyAnomaly.rows.length > 0) {
      addCheck(
        'GA Daily Sessions Anomaly',
        'WARN',
        `${gaDailyAnomaly.rows.length} properties dropped to 0 sessions after having 100+`
      );
    } else {
      addCheck('GA Daily Sessions Anomaly', 'PASS', 'No sudden session drops to zero');
    }

    // C3: DunningHistory spike
    const dunningQuery = `
      SELECT "syncedAt", COUNT(*) as past_due_count
      FROM "DunningHistory"
      WHERE "inCollections" = false
      GROUP BY "syncedAt"
      ORDER BY "syncedAt" DESC
      LIMIT 2
    `;
    const dunningResult = await client.query(dunningQuery);
    
    if (dunningResult.rows.length >= 2) {
      const current = parseInt(dunningResult.rows[0].past_due_count);
      const previous = parseInt(dunningResult.rows[1].past_due_count);
      const spike = current - previous;
      
      if (spike > 5) {
        addCheck(
          'Dunning Spike',
          'WARN',
          `Past due count jumped by ${spike} in 24h (was ${previous}, now ${current})`
        );
      } else {
        addCheck('Dunning Spike', 'PASS', `Change: ${spike >= 0 ? '+' : ''}${spike} past due accounts`);
      }
    } else {
      addCheck('Dunning Spike', 'PASS', 'Not enough dunning history to compare');
    }

  } catch (error) {
    addCheck('Script Execution', 'FAIL', `Error: ${error.message}`);
    console.error('\n❌ Fatal error:', error);
  } finally {
    await client.end();
  }

  // ================================================================
  // Generate Report
  // ================================================================
  console.log('\n' + '═'.repeat(60));
  
  const issues = checks.filter(c => c.status !== 'PASS');
  const failCount = checks.filter(c => c.status === 'FAIL').length;
  const warnCount = checks.filter(c => c.status === 'WARN').length;
  const passCount = checks.filter(c => c.status === 'PASS').length;
  
  const status = issues.length > 0 ? 'ISSUES_FOUND' : 'ALL_CLEAR';
  
  const report = {
    runAt: new Date().toISOString(),
    status,
    summary: {
      total: checks.length,
      passed: passCount,
      warnings: warnCount,
      failures: failCount
    },
    checks,
    issues
  };

  console.log('\n📊 Summary:');
  console.log(`   Total Checks: ${checks.length}`);
  console.log(`   ✅ Passed: ${passCount}`);
  console.log(`   ⚠️  Warnings: ${warnCount}`);
  console.log(`   ❌ Failures: ${failCount}`);
  console.log(`   Status: ${status}`);

  return report;
}

// Run the checks
const report = await runChecks();

// Export for Slack notification (imported by truth-layer-slack.mjs)
export { report };
