#!/bin/bash
# git-push-and-deploy.sh
# Use this instead of plain 'git push' for dashboard changes.
# Pushes to GitHub AND triggers a Render deploy in one step.
# Render's GitHub webhook is unreliable — this is the fix.

set -e

RENDER_KEY=$(python3 -c "import json; d=json.load(open('/Users/toddthejedigmail.com/.openclaw/secrets.json')); print(d.get('RENDER_API_KEY',''))")
SERVICE_ID="srv-d88d7f8jo6nc73dekgog"

echo "🚀 Pushing to GitHub..."
git push origin main

echo "🔄 Triggering Render deploy..."
RESULT=$(curl -s -X POST "https://api.render.com/v1/services/$SERVICE_ID/deploys" \
  -H "Authorization: Bearer $RENDER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"clearCache": "do_not_clear"}')

DEPLOY_ID=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id','error'))")
echo "✅ Deploy triggered: $DEPLOY_ID"
echo "🌐 Live in ~3 min: https://gyc-dashboard-ra9a.onrender.com"
