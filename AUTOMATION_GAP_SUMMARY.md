# GYC Dashboard Automation - Executive Summary
**Generated:** 2026-05-22 12:38 EDT

## The Bottom Line

**Current State:** 35% automated | 42% manual/missing | 7 crons failing

**Root Cause of Failures:** All failing crons use `groq/llama-3.3-70b-versatile` which was removed from the model allowlist.

**Fix Time:** 5 minutes (change 5 cron models)

**Impact:** Restores 40% of automation immediately

---

## 🚨 Critical Fix (Do First)

All failing crons need model updated from `groq/llama-3.3-70b-versatile` → `anthropic/claude-sonnet-4-6`

```bash
openclaw cron edit 51ff7212-7c2d-400d-a9b8-b7441cf55469 --model anthropic/claude-sonnet-4-6  # zendesk-sync
openclaw cron edit e6118140-3040-4b2f-b795-64c72b8152cf --model anthropic/claude-sonnet-4-6  # snapshots
openclaw cron edit 32f17023-7f90-46b6-9683-a645d951d1cb --model anthropic/claude-sonnet-4-6  # zoom
openclaw cron edit 809841d6-8a69-488c-a9cc-3defe149acd7 --model anthropic/claude-sonnet-4-6  # watchdog
openclaw cron edit 880345de-e0f1-48e8-913c-491cedb712e7 --model anthropic/claude-sonnet-4-6  # c3po
```

**This fixes:** CX dashboard, Helpdesk, Finance snapshots, Zoom call tracking, Agent monitoring

---

## Quick Wins (Scripts Exist, Just Need Scheduling)

| What | Script | Proposed Cron | Impact |
|------|--------|---------------|--------|
| **Stripe Sync** | `sync-stripe.js` | Daily 6 AM | Finance dashboard auto-refresh |
| **Asana Workload** | `sync-asana.js` | M-F 9 AM | Team workload visibility |
| **HR Scorecard** | `sync-hr-scorecard.js` | Monday 8 AM | Team performance tracking |
| **Client Profiles** | `sync-client-profiles.mjs` | Daily 7 AM | Client data freshness |
| **Dunning History** | `sync-dunning-history.mjs` | Daily 6:30 AM | Past-due tracking |
| **PandaDoc Agreements** | `sync-pandadoc.mjs` | M-F 8 AM | Contract tracking |
| **Client Funnels** | `sync-funnel-to-profiles.mjs` | Weekly Mon 7 AM | Tour/lead data |

**Effort:** 30 minutes to add 7 crons
**Result:** Dashboard automation jumps from 35% → 65%

---

## Gaps That Need New Scripts

| Dashboard Section | Current Status | What's Needed |
|------------------|----------------|---------------|
| **Web Analytics** | ❌ No automation | Build GA4 sync script |
| **Sales Activity** | ❌ No automation | Build activity snapshot script |
| **Sales Analysis** | ❌ No automation | Build analysis snapshot script |
| **Production** | ❌ No automation | Build production tracking script |

**Effort:** 4-8 hours development per script
**Priority:** Medium (these pages less critical than Finance/CX)

---

## Automation Coverage Roadmap

**Today (5 min):**
- Fix model allowlist → 40% recovered

**This Week (30 min):**
- Schedule 7 existing scripts → 65% automated

**This Month (1-2 days):**
- Build 4 missing scripts → 80%+ automated

**Result:** Most of dashboard runs itself, Todd only checks exceptions

---

## Full Details

See `AUTOMATION_GAP_ANALYSIS.md` for:
- Complete 37-page mapping
- All 75 database models cross-referenced
- Detailed priority order for everything
- Cron run history and error diagnostics

---

**Next Step:** Run the 5 `openclaw cron edit` commands above, then tell Wall·E "schedule the quick wins" and I'll add all 7 crons.
