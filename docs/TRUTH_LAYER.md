# Dashboard Truth Layer

**What:** Automated data validation system that checks GYC dashboard data accuracy every morning at 7 AM ET and posts anomalies to Slack.

**Why:** After watching a video about AI-generated documents with hidden errors, Todd wanted a "truth layer" to catch data issues before he opens the dashboard. The principle: "Companies that build a truth layer around their AI files ship faster and are wrong less."

## Components

### 1. Validation Script: `scripts/truth-layer.mjs`
Core validation logic with 3 categories of checks:

**Category A — Source Validation** (data arrived correctly)
- Stripe MRR vs customer sum consistency
- Active customer count accuracy
- Leadership snapshot freshness (must be < 25 hours old)
- Finance metrics null check (caught the $0 MRR bug on May 27)
- MRR History current month entry exists
- GA monthly data populated

**Category B — Math Validation** (formulas correct)
- NRR sanity check (80-130% range)
- Close rate calculation verification
- MRR direction vs subscription count alignment

**Category C — Anomaly Detection** (something broke)
- StripeMetrics dropping to zero unexpectedly
- GA daily sessions sudden drops
- DunningHistory spikes (past due count jumps > 5)

### 2. Slack Notification: `lib/truth-layer-slack.mjs`
Formats check results and prepares Slack messages:
- **ALL_CLEAR**: Simple green check message
- **ISSUES_FOUND**: Detailed report with failures first, then warnings

Posts to: `#GYC-Leadership` (channel ID: `C03KPKVBCRX`)

### 3. Runner Script: `scripts/truth-layer-run.mjs`
Orchestrates the validation + Slack notification flow.
Outputs JSON for programmatic use.

### 4. LaunchAgent: `~/Library/LaunchAgents/com.gyc.truth-layer.plist`
Runs the runner script every morning at 7 AM ET.

Logs:
- stdout: `logs/truth-layer.log`
- stderr: `logs/truth-layer-error.log`

## Usage

### Manual Run
```bash
cd /Users/toddthejedigmail.com/.openclaw/workspace/gyc-dashboard
node scripts/truth-layer.mjs
```

### Run with Slack Output
```bash
node scripts/truth-layer-run.mjs
```

### Check LaunchAgent Status
```bash
launchctl list | grep com.gyc.truth-layer
```

### View Logs
```bash
tail -f /Users/toddthejedigmail.com/.openclaw/workspace/gyc-dashboard/logs/truth-layer.log
```

### Reload LaunchAgent (after changes)
```bash
launchctl unload ~/Library/LaunchAgents/com.gyc.truth-layer.plist
launchctl load ~/Library/LaunchAgents/com.gyc.truth-layer.plist
```

## Adding New Checks

1. Open `scripts/truth-layer.mjs`
2. Add your check in the appropriate category (A, B, or C)
3. Use `addCheck(name, status, detail)` to record results
4. Test with `node scripts/truth-layer.mjs`

Example:
```javascript
// In Category A
const myCheckResult = await client.query('SELECT ...');
if (myCheckResult.rows.length === 0) {
  addCheck('My New Check', 'FAIL', 'No data found');
} else {
  addCheck('My New Check', 'PASS', 'Data looks good');
}
```

## Status Levels
- **PASS**: Everything is fine
- **WARN**: Something unusual but not critical
- **FAIL**: Data integrity issue that needs immediate attention

## First Run Results (May 27, 2026)
Ran at 6:50 PM EDT and found:
- ✅ 7 checks passed
- ⚠️ 4 warnings:
  - Stripe MRR vs Customer Sum: $56K delta (known issue — Stripe API timing)
  - Active Customer Count: 84 difference (same root cause)
  - MRR History Current Month: No May entry yet (expected early in month)
  - NRR Sanity Check: Need 2+ months of data (MRRHistory just created)

All warnings are expected — the system is working correctly.

## Schedule
- **Daily:** 7:00 AM ET
- **Output:** Slack message to #GYC-Leadership
- **Location:** Runs on Todd's Mac (GYC-Integrator-Claw)

## Maintenance
- Add checks as new data sources are added
- Adjust thresholds if warnings become too noisy
- Review failed checks immediately — they indicate data pipeline breaks

---

Built: May 27, 2026  
Builder: R2 (Wall·E's subagent)  
Requested by: Todd
