# GYC Dashboard - Automated Sync Schedules

## Current Schedule (June 17, 2026)

### Monthly Syncs (5th of every month)
- **Lead Data Sync** - 10:00 AM UTC (6:00 AM ET)
- **GHL Zipcode Sync** - 11:00 AM UTC (7:00 AM ET)

### Weekly Syncs
- **Stripe Sync** - Every Thursday at 1:00 PM UTC (9:00 AM ET)

## Setup Instructions

### Option 1: Using crontab (Linux/macOS)

Run this command to install the cron schedule:

```bash
cat > /tmp/gyc_crontab.txt << 'EOF'
# Stripe sync - runs every Thursday at 1pm UTC (9am ET)
0 13 * * 4 curl -s -X POST http://localhost:3000/api/sync/stripe >> /tmp/gyc-stripe-sync-cron.log 2>&1

# Lead data sync - runs on the 5th of every month at 10am UTC (6am ET)
0 10 5 * * cd /Users/toddthejedigmail.com/.openclaw/workspace/gyc-dashboard && node scripts/sync-all-lead-data.js >> /tmp/gyc-lead-sync-cron.log 2>&1

# GHL zipcode sync - runs on the 5th of every month at 11am UTC (7am ET)
0 11 5 * * cd /Users/toddthejedigmail.com/.openclaw/workspace/gyc-dashboard && node scripts/sync-ghl-zipcodes.js >> /tmp/gyc-ghl-sync-cron.log 2>&1
EOF

crontab /tmp/gyc_crontab.txt
```

Verify it's installed:
```bash
crontab -l
```

### Option 2: Using launchd (macOS recommended)

macOS prefers launchd over cron. Create launch agents for each sync:

#### 1. Lead Data Sync (Monthly)
```bash
cat > ~/Library/LaunchAgents/com.gyc.lead-sync.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.gyc.lead-sync</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/Users/toddthejedigmail.com/.openclaw/workspace/gyc-dashboard/scripts/sync-all-lead-data.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/Users/toddthejedigmail.com/.openclaw/workspace/gyc-dashboard</string>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Day</key>
        <integer>5</integer>
        <key>Hour</key>
        <integer>6</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>/tmp/gyc-lead-sync-cron.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/gyc-lead-sync-cron.log</string>
</dict>
</plist>
EOF

launchctl load ~/Library/LaunchAgents/com.gyc.lead-sync.plist
```

#### 2. GHL Zipcode Sync (Monthly)
```bash
cat > ~/Library/LaunchAgents/com.gyc.ghl-sync.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.gyc.ghl-sync</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/Users/toddthejedigmail.com/.openclaw/workspace/gyc-dashboard/scripts/sync-ghl-zipcodes.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/Users/toddthejedigmail.com/.openclaw/workspace/gyc-dashboard</string>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Day</key>
        <integer>5</integer>
        <key>Hour</key>
        <integer>7</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>/tmp/gyc-ghl-sync-cron.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/gyc-ghl-sync-cron.log</string>
</dict>
</plist>
EOF

launchctl load ~/Library/LaunchAgents/com.gyc.ghl-sync.plist
```

#### Verify launchd jobs:
```bash
launchctl list | grep gyc
```

#### Unload/reload if you need to update:
```bash
launchctl unload ~/Library/LaunchAgents/com.gyc.lead-sync.plist
launchctl load ~/Library/LaunchAgents/com.gyc.lead-sync.plist
```

## CRM-Related Sync Scripts Found

Located in `/Users/toddthejedigmail.com/.openclaw/workspace/gyc-dashboard/scripts/`:

1. **sync-ghl-zipcodes.js** - Syncs zip codes from GHL (GoHighLevel) contacts to ClientProfile records
   - Already included in monthly schedule above
   - Fetches all GHL contacts and updates dashboard DB with zipCode, city, state

2. **sync-all-lead-data.js** - The main lead data sync (includes GHL data)
   - Already included in monthly schedule above
   - Comprehensive sync of all lead/contact data

Other sync scripts that may be relevant but don't directly mention CRM:
- sync-sales-deals.mjs
- sync-client-profiles.mjs
- sync-zendesk.js

## Manual Run Commands

To run any sync manually:

```bash
cd /Users/toddthejedigmail.com/.openclaw/workspace/gyc-dashboard

# Lead data sync
node scripts/sync-all-lead-data.js

# GHL zipcode sync
node scripts/sync-ghl-zipcodes.js

# Stripe sync (via API)
curl -X POST http://localhost:3000/api/sync/stripe
```

## Log Files

All sync logs are written to `/tmp/`:
- `/tmp/gyc-lead-sync-cron.log` - Lead data sync log
- `/tmp/gyc-ghl-sync-cron.log` - GHL zipcode sync log
- `/tmp/gyc-stripe-sync-cron.log` - Stripe sync log

View recent logs:
```bash
tail -50 /tmp/gyc-lead-sync-cron.log
tail -50 /tmp/gyc-ghl-sync-cron.log
```
