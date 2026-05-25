#!/bin/bash
# Syncs all GYC Dashboard env vars to Render
# Usage: RENDER_API_KEY=xxx bash render-env-sync.sh [service-id]
# Default service: srv-d88d7f8jo6nc73dekgog

set -e
RENDER_API_KEY="${RENDER_API_KEY:-$(cat ~/.openclaw/secrets.json 2>/dev/null | python3 -c 'import json,sys; print(json.load(sys.stdin).get("RENDER_API_KEY",""))' 2>/dev/null)}"
SERVICE_ID="${1:-srv-d88d7f8jo6nc73dekgog}"

if [ -z "$RENDER_API_KEY" ]; then
  echo "❌ RENDER_API_KEY not set"
  exit 1
fi

# Load env vars from .env.local
if [ ! -f ".env.local" ]; then
  echo "❌ .env.local not found. Run from gyc-dashboard directory."
  exit 1
fi

source .env.local

echo "📦 Syncing env vars to Render service: $SERVICE_ID"

curl -s -X PUT "https://api.render.com/v1/services/${SERVICE_ID}/env-vars" \
  -H "Authorization: Bearer ${RENDER_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "[
    {\"key\":\"DATABASE_URL\",\"value\":\"${DATABASE_URL}\"},
    {\"key\":\"NEON_DATABASE_URL\",\"value\":\"${DATABASE_URL}\"},
    {\"key\":\"NEXTAUTH_URL\",\"value\":\"https://gyc-dashboard-ra9a.onrender.com\"},
    {\"key\":\"NEXTAUTH_SECRET\",\"value\":\"gyc-dashboard-secret-2026-secure-key-xk9m\"},
    {\"key\":\"CREDENTIALS_ENCRYPTION_KEY\",\"value\":\"2623aec9819990789ff8b216664b47d9b383e2dc8a72947bbc1b42dfb1889775\"},
    {\"key\":\"NODE_ENV\",\"value\":\"production\"},
    {\"key\":\"STRIPE_SECRET_KEY\",\"value\":\"${STRIPE_SECRET_KEY}\"},
    {\"key\":\"NOTION_API_KEY\",\"value\":\"${NOTION_API_KEY}\"},
    {\"key\":\"GHL_API_KEY\",\"value\":\"${GHL_API_KEY}\"},
    {\"key\":\"GHL_LOCATION_ID\",\"value\":\"${GHL_LOCATION_ID}\"},
    {\"key\":\"ZENDESK_SUBDOMAIN\",\"value\":\"${ZENDESK_SUBDOMAIN}\"},
    {\"key\":\"ZENDESK_EMAIL\",\"value\":\"${ZENDESK_EMAIL}\"},
    {\"key\":\"ZENDESK_API_TOKEN\",\"value\":\"${ZENDESK_API_TOKEN}\"},
    {\"key\":\"ASANA_PAT\",\"value\":\"${ASANA_PAT}\"},
    {\"key\":\"PANDADOC_API_KEY\",\"value\":\"${PANDADOC_API_KEY}\"},
    {\"key\":\"ZOOM_ACCOUNT_ID\",\"value\":\"${ZOOM_ACCOUNT_ID}\"},
    {\"key\":\"ZOOM_CLIENT_ID\",\"value\":\"${ZOOM_CLIENT_ID}\"},
    {\"key\":\"ZOOM_CLIENT_SECRET\",\"value\":\"${ZOOM_CLIENT_SECRET}\"},
    {\"key\":\"OPENAI_API_KEY\",\"value\":\"${OPENAI_API_KEY}\"},
    {\"key\":\"ANTHROPIC_API_KEY\",\"value\":\"${ANTHROPIC_API_KEY}\"},
    {\"key\":\"DATAFORSEO_LOGIN\",\"value\":\"${DATAFORSEO_LOGIN}\"},
    {\"key\":\"DATAFORSEO_PASSWORD\",\"value\":\"${DATAFORSEO_PASSWORD}\"},
    {\"key\":\"CENSUS_API_KEY\",\"value\":\"${CENSUS_API_KEY}\"},
    {\"key\":\"GOOGLE_PLACES_API_KEY\",\"value\":\"${GOOGLE_PLACES_API_KEY}\"},
    {\"key\":\"NEXT_PUBLIC_APP_NAME\",\"value\":\"GYC Dashboard\"}
  ]" | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'✅ Set {len(d)} env vars')"

echo "🚀 Triggering deploy..."
curl -s -X POST "https://api.render.com/v1/services/${SERVICE_ID}/deploys" \
  -H "Authorization: Bearer ${RENDER_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{}' | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'Deploy: {d.get(\"id\",\"?\")} | Status: {d.get(\"status\",\"?\")}')"
