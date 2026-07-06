# Monthly Automation Scripts — ACL Sync & MRR Reconciliation

**Purpose:** Automated monthly data integrity sweeps for GYC Dashboard. These scripts run on Wall·E's Mac Mini and detect discrepancies between Stripe and the dashboard DB. They **do not write to the database** — they generate reports for Wall·E to review and approve before any changes are applied.

---

## Scripts

### 1. `monthly-acl-sync.mjs`

**What it does:**
- Reconciles Stripe subscription statuses against ClientProfile records
- Detects: new cancellations, status flips, Evergreen transitions, PIF activations
- Writes report to: `~/.openclaw/workspace/memory/acl-sync-YYYY-MM.md`
- Sends Telegram notification to Todd with change count

**Schedule:** 28th of each month at 7:00 AM ET

**Run manually:**
```bash
cd /Users/toddthejedigmail.com/.openclaw/workspace/gyc-dashboard
node scripts/monthly-acl-sync.mjs
```

**LaunchAgent:** `~/Library/LaunchAgents/com.gyc.monthly-acl-sync.plist`

---

### 2. `monthly-mrr-recon.mjs`

**What it does:**
- Compares ClientProfile.mrr against actual Stripe subscription amounts
- Flags mismatches where abs(diff) > $5
- Categories: Evergreen transition, new service added, service cancelled, unknown
- Writes report to: `~/.openclaw/workspace/memory/mrr-recon-YYYY-MM.md`
- Sends Telegram notification to Todd with mismatch count

**Schedule:** 29th of each month at 7:00 AM ET

**Run manually:**
```bash
cd /Users/toddthejedigmail.com/.openclaw/workspace/gyc-dashboard
node scripts/monthly-mrr-recon.mjs
```

**LaunchAgent:** `~/Library/LaunchAgents/com.gyc.monthly-mrr-recon.plist`

---

## How It Works

1. **Scripts run automatically** via macOS LaunchAgent on the scheduled dates
2. **Reports are generated** in `~/.openclaw/workspace/memory/`
3. **Telegram notification** sent to Todd's chat (ID: 8211292899)
4. **Wall·E reviews** the report and flags issues
5. **Todd approves** changes before any DB writes are made
6. **Wall·E applies** approved corrections to the database

**Important:** These scripts are READ-ONLY. They never modify the database directly.

---

## Logs

- **Stdout logs:** `/Users/toddthejedigmail.com/.openclaw/workspace/logs/acl-sync.log`
- **Stderr logs:** `/Users/toddthejedigmail.com/.openclaw/workspace/logs/acl-sync-error.log`
- **Stdout logs (MRR):** `/Users/toddthejedigmail.com/.openclaw/workspace/logs/mrr-recon.log`
- **Stderr logs (MRR):** `/Users/toddthejedigmail.com/.openclaw/workspace/logs/mrr-recon-error.log`

---

## Managing LaunchAgents

**Check status:**
```bash
launchctl list | grep com.gyc.monthly
```

**Unload (stop):**
```bash
launchctl unload ~/Library/LaunchAgents/com.gyc.monthly-acl-sync.plist
launchctl unload ~/Library/LaunchAgents/com.gyc.monthly-mrr-recon.plist
```

**Reload (restart):**
```bash
launchctl load ~/Library/LaunchAgents/com.gyc.monthly-acl-sync.plist
launchctl load ~/Library/LaunchAgents/com.gyc.monthly-mrr-recon.plist
```

**Validate plist:**
```bash
plutil -lint ~/Library/LaunchAgents/com.gyc.monthly-acl-sync.plist
plutil -lint ~/Library/LaunchAgents/com.gyc.monthly-mrr-recon.plist
```

---

## Environment Variables

Both scripts load from `gyc-dashboard/.env.local`:

- `DATABASE_URL` — PostgreSQL connection string (Render/Neon)
- `STRIPE_SECRET_KEY` — Stripe API key (production)

**Never commit `.env.local` to git. Never put credentials in these scripts.**

---

## Edge Cases Handled

### ACL Sync
- **Evergreen transitions:** Recognizes $395 canceled + $197 active as a downgrade (not a cancellation)
- **PIF activations:** Detects when a PIF client now has a Stripe customer ID
- **Orphaned MRR:** Flags clients with MRR in DB but no Stripe data

### MRR Recon
- **Tolerance:** $5 diff is allowed (rounding/proration)
- **Annual subscriptions:** Converted to MRR automatically
- **Multiple subscriptions:** Summed per customer
- **No customer ID:** Flagged as "NO_STRIPE_CUSTOMER"

---

## Dry Run Tests

Both scripts were tested on June 22, 2026:

**ACL Sync:**
- Fetched 542 Stripe customers
- Compared against 442 ClientProfile records
- Detected 73 changes (33 cancellations, 40 status flips)
- Report generated successfully
- Telegram notification sent ✅

**MRR Recon:**
- Fetched 280 active Stripe customers
- Compared against 431 active ClientProfile records
- Found 165 mismatches (>$5 tolerance)
- Report generated successfully
- Telegram notification sent ✅

---

## Troubleshooting

**Script fails with "DATABASE_URL not found":**
- Check `.env.local` exists in `gyc-dashboard/` directory
- Verify `DATABASE_URL=postgresql://...` is present

**Script fails with "STRIPE_SECRET_KEY not found":**
- Check `.env.local` for `STRIPE_SECRET_KEY=rk_live_...`

**LaunchAgent not running:**
- Check logs in `/Users/toddthejedigmail.com/.openclaw/workspace/logs/`
- Verify plist is loaded: `launchctl list | grep com.gyc.monthly`
- Check PATH is set in plist (required for node/homebrew)

**Telegram notification fails:**
- Verify `openclaw` CLI is at `/opt/homebrew/bin/openclaw`
- Test manually: `/opt/homebrew/bin/openclaw message send --channel telegram --target 8211292899 --message "test"`

---

## Next Steps

1. **Monitor first runs** — check Telegram notifications on July 28 and July 29, 2026
2. **Review reports** — ensure categorization logic is accurate
3. **Iterate on categories** — adjust logic based on real-world edge cases
4. **Add DB write scripts** — once Wall·E approves a report, create scripts to apply changes

---

_Created: June 22, 2026_  
_Author: Wall·E (Subagent)_  
_Location: `gyc-dashboard/scripts/`_
