#!/bin/bash
# verify-deploy.sh
# Checks if the live Render site matches the latest local commit.
# Triggers a deploy automatically if they don't match.
# Run this any time you're not sure if changes made it to live.

RENDER_KEY=$(python3 -c "import json; d=json.load(open('/Users/toddthejedigmail.com/.openclaw/secrets.json')); print(d.get('RENDER_API_KEY',''))" 2>/dev/null)
SERVICE_ID="srv-d88d7f8jo6nc73dekgog"
LIVE_URL="https://gyc-dashboard-ra9a.onrender.com"

echo "🔍 Checking deploy status..."

LOCAL_SHA=$(git rev-parse HEAD 2>/dev/null)
LOCAL_SHORT=${LOCAL_SHA:0:7}

# Get latest deploy from Render
RENDER_DATA=$(curl -s "https://api.render.com/v1/services/$SERVICE_ID/deploys?limit=1" \
  -H "Authorization: Bearer $RENDER_KEY" 2>/dev/null)

RENDER_COMMIT=$(echo "$RENDER_DATA" | python3 -c "
import sys, json
try:
  d = json.load(sys.stdin)
  if isinstance(d, list) and d:
    deploy = d[0]
    commit = deploy.get('commit', {}).get('id', '')
    status = deploy.get('status', '')
    print(f'{commit[:40]}|{status}')
  else:
    print('unknown|unknown')
except:
  print('error|error')
" 2>/dev/null)

RENDER_SHA=$(echo "$RENDER_COMMIT" | cut -d'|' -f1)
RENDER_STATUS=$(echo "$RENDER_COMMIT" | cut -d'|' -f2)
RENDER_SHORT=${RENDER_SHA:0:7}

echo "  Local:  $LOCAL_SHORT"
echo "  Render: $RENDER_SHORT (status: $RENDER_STATUS)"

if [ "$LOCAL_SHA" = "$RENDER_SHA" ] && [ "$RENDER_STATUS" = "live" ]; then
  echo "✅ Live site is current and deployed"
elif [ "$RENDER_STATUS" = "build_in_progress" ] || [ "$RENDER_STATUS" = "update_in_progress" ]; then
  echo "🔄 Deploy already in progress — wait ~3 min"
else
  echo "⚠️  MISMATCH or not live — triggering deploy now..."
  RESULT=$(curl -s -X POST "https://api.render.com/v1/services/$SERVICE_ID/deploys" \
    -H "Authorization: Bearer $RENDER_KEY" \
    -H "Content-Type: application/json" \
    -d '{"clearCache": "do_not_clear"}' 2>/dev/null)
  DEPLOY_ID=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id','error'))" 2>/dev/null)
  echo "🚀 Deploy triggered: $DEPLOY_ID"
  echo "🌐 Live in ~3 min: $LIVE_URL"
fi
