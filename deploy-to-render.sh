#!/bin/bash

# GYC Dashboard - Render Deployment Script
# This script creates a web service on Render using their API

set -e

echo "🚀 GYC Dashboard - Render Deployment"
echo "===================================="
echo ""

# Check if RENDER_API_KEY is set
if [ -z "$RENDER_API_KEY" ]; then
    echo "❌ Error: RENDER_API_KEY environment variable is not set"
    echo ""
    echo "To get your Render API key:"
    echo "1. Go to https://dashboard.render.com/u/account/api-keys"
    echo "2. Click 'Create API Key'"
    echo "3. Give it a name (e.g., 'GYC Dashboard Deploy')"
    echo "4. Copy the key and export it:"
    echo "   export RENDER_API_KEY='your-key-here'"
    echo ""
    exit 1
fi

echo "✓ API key found"
echo ""

# Get owner ID
echo "📋 Fetching owner information..."
OWNER_RESPONSE=$(curl -s -H "Authorization: Bearer $RENDER_API_KEY" \
    https://api.render.com/v1/owners)

OWNER_ID=$(echo "$OWNER_RESPONSE" | jq -r '.[0].owner.id')

if [ -z "$OWNER_ID" ] || [ "$OWNER_ID" == "null" ]; then
    echo "❌ Error: Could not retrieve owner ID"
    echo "Response: $OWNER_RESPONSE"
    exit 1
fi

echo "✓ Owner ID: $OWNER_ID"
echo ""

# Load environment variables from .env.local
echo "📦 Loading environment variables from .env.local..."
source .env.local
echo "✓ Environment variables loaded"
echo ""

# Create the web service
echo "🔨 Creating Render web service..."

SERVICE_PAYLOAD=$(cat <<EOF
{
  "type": "web_service",
  "name": "gyc-dashboard",
  "ownerId": "$OWNER_ID",
  "repo": "https://github.com/integrator-coder/gyc-dashboard",
  "branch": "main",
  "autoDeploy": "yes",
  "serviceDetails": {
    "runtime": "node",
    "buildCommand": "npm install && npm run build",
    "startCommand": "npm run start",
    "region": "ohio",
    "plan": "starter",
    "envVars": [
      {"key": "NODE_ENV", "value": "production"},
      {"key": "NEXT_PUBLIC_APP_NAME", "value": "GYC Dashboard"},
      {"key": "DATABASE_URL", "value": "$DATABASE_URL"},
      {"key": "NEON_DATABASE_URL", "value": "$NEON_DATABASE_URL"},
      {"key": "NEXTAUTH_URL", "value": "https://gyc-dashboard.onrender.com"},
      {"key": "NEXTAUTH_SECRET", "value": "gyc-dashboard-secret-2026-secure-key-xk9m"},
      {"key": "CREDENTIALS_ENCRYPTION_KEY", "value": "2623aec9819990789ff8b216664b47d9b383e2dc8a72947bbc1b42dfb1889775"},
      {"key": "GHL_LOCATION_ID", "value": "$GHL_LOCATION_ID"},
      {"key": "ZENDESK_EMAIL", "value": "$ZENDESK_EMAIL"},
      {"key": "ZENDESK_SUBDOMAIN", "value": "$ZENDESK_SUBDOMAIN"},
      {"key": "DATAFORSEO_LOGIN", "value": "$DATAFORSEO_LOGIN"},
      {"key": "ZOOM_ACCOUNT_ID", "value": "$ZOOM_ACCOUNT_ID"},
      {"key": "ZOOM_CLIENT_ID", "value": "$ZOOM_CLIENT_ID"},
      {"key": "ANTHROPIC_API_KEY", "value": "$ANTHROPIC_API_KEY"},
      {"key": "OPENAI_API_KEY", "value": "$OPENAI_API_KEY"},
      {"key": "STRIPE_SECRET_KEY", "value": "$STRIPE_SECRET_KEY"},
      {"key": "GHL_API_KEY", "value": "$GHL_API_KEY"},
      {"key": "NOTION_API_KEY", "value": "$NOTION_API_KEY"},
      {"key": "ZOOM_CLIENT_SECRET", "value": "$ZOOM_CLIENT_SECRET"},
      {"key": "PANDADOC_API_KEY", "value": "$PANDADOC_API_KEY"},
      {"key": "ZENDESK_API_TOKEN", "value": "$ZENDESK_API_TOKEN"},
      {"key": "GOOGLE_PLACES_API_KEY", "value": "$GOOGLE_PLACES_API_KEY"},
      {"key": "ASANA_PAT", "value": "$ASANA_PAT"},
      {"key": "DATAFORSEO_PASSWORD", "value": "$DATAFORSEO_PASSWORD"},
      {"key": "CENSUS_API_KEY", "value": "$CENSUS_API_KEY"}
    ]
  }
}
EOF
)

CREATE_RESPONSE=$(curl -s -X POST \
    -H "Authorization: Bearer $RENDER_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$SERVICE_PAYLOAD" \
    https://api.render.com/v1/services)

SERVICE_ID=$(echo "$CREATE_RESPONSE" | jq -r '.service.id')

if [ -z "$SERVICE_ID" ] || [ "$SERVICE_ID" == "null" ]; then
    echo "❌ Error: Could not create service"
    echo "Response: $CREATE_RESPONSE"
    exit 1
fi

echo "✓ Service created: $SERVICE_ID"
echo ""

# Monitor deployment
echo "⏳ Monitoring deployment..."
echo ""

for i in {1..20}; do
    sleep 15
    
    DEPLOY_RESPONSE=$(curl -s -H "Authorization: Bearer $RENDER_API_KEY" \
        "https://api.render.com/v1/services/$SERVICE_ID/deploys?limit=1")
    
    DEPLOY_STATUS=$(echo "$DEPLOY_RESPONSE" | jq -r '.[0].deploy.status')
    DEPLOY_ID=$(echo "$DEPLOY_RESPONSE" | jq -r '.[0].deploy.id')
    
    echo "[$i] Deploy $DEPLOY_ID: $DEPLOY_STATUS"
    
    if [ "$DEPLOY_STATUS" == "live" ]; then
        echo ""
        echo "✅ Deployment successful!"
        break
    elif [ "$DEPLOY_STATUS" == "build_failed" ] || [ "$DEPLOY_STATUS" == "deactivated" ]; then
        echo ""
        echo "❌ Deployment failed: $DEPLOY_STATUS"
        exit 1
    fi
done

# Test the deployed URL
echo ""
echo "🧪 Testing deployed URL..."
HTTP_STATUS=$(curl -sL -o /dev/null -w "%{http_code}" "https://gyc-dashboard.onrender.com/login")

if [ "$HTTP_STATUS" == "200" ]; then
    echo "✅ Service is responding (HTTP $HTTP_STATUS)"
else
    echo "⚠️  Service returned HTTP $HTTP_STATUS"
fi

echo ""
echo "🎉 Deployment complete!"
echo "📍 URL: https://gyc-dashboard.onrender.com"
echo "🔗 Dashboard: https://dashboard.render.com/web/$SERVICE_ID"
echo ""
