# Truth Layer — Quick Reference

## 🚀 What It Does
Validates dashboard data every morning at 7 AM ET and posts issues to Slack #GYC-Leadership.

## 📍 Key Files
- **Main script:** `scripts/truth-layer.mjs` (11 validation checks)
- **Runner:** `scripts/truth-layer-run.mjs` (orchestrates + outputs JSON)
- **Slack formatter:** `lib/truth-layer-slack.mjs`
- **Scheduler:** `~/Library/LaunchAgents/com.gyc.truth-layer.plist`
- **Full docs:** `docs/TRUTH_LAYER.md`

## ▶️ Run Manually
```bash
cd /Users/toddthejedigmail.com/.openclaw/workspace/gyc-dashboard
node scripts/truth-layer.mjs
```

## 🔍 Check If It's Running
```bash
launchctl list | grep com.gyc.truth-layer
```
Should output: `-	0	com.gyc.truth-layer`

## 📋 View Logs
```bash
tail -f ~/. openclaw/workspace/gyc-dashboard/logs/truth-layer.log
```

## 🔄 Reload After Changes
```bash
launchctl unload ~/Library/LaunchAgents/com.gyc.truth-layer.plist
launchctl load ~/Library/LaunchAgents/com.gyc.truth-layer.plist
```

## ⏰ Schedule
- **When:** Every day at 7:00 AM ET
- **Where:** Runs on Todd's Mac
- **Output:** Slack #GYC-Leadership (C03KPKVBCRX)

## ✅ The 11 Checks

### Category A: Source Validation
1. Stripe MRR vs Customer Sum
2. Active Customer Count
3. Leadership Snapshot Freshness
4. Finance Metrics Not Null
5. MRR History Current Month
6. GA Monthly Data

### Category B: Math Validation
7. NRR Sanity (80-130%)
8. Close Rate Math
9. MRR vs Subscription Direction

### Category C: Anomaly Detection
10. StripeMetrics Zero Drop
11. GA Sessions Sudden Drop
12. Dunning History Spike

## 🎯 Status Levels
- **PASS** ✅ — All good
- **WARN** ⚠️ — Unusual but not critical
- **FAIL** ❌ — Data integrity issue (needs attention)

## 🛠 Add a New Check
1. Edit `scripts/truth-layer.mjs`
2. Add in appropriate category (A, B, or C)
3. Use `addCheck(name, status, detail)`
4. Test: `node scripts/truth-layer.mjs`

---

📅 Built: May 27, 2026  
🤖 Builder: R2 (Wall·E's subagent)
