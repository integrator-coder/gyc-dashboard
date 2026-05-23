# GYC Dashboard - Render Deployment Guide

## Status: Ready to Deploy

The GYC Dashboard is ready to be deployed to Render. All environment variables have been prepared and a deployment script has been created.

## Quick Start (Automated)

### Prerequisites
1. A Render account (already logged in as todd@growyourcenter.com)
2. A Render API key

### Steps

1. **Get your Render API key:**
   - Go to https://dashboard.render.com/u/account/api-keys
   - Click "Create API Key"
   - Name it "GYC Dashboard Deploy"
   - Copy the key

2. **Run the deployment script:**
   ```bash
   cd /Users/toddthejedigmail.com/.openclaw/workspace/gyc-dashboard
   export RENDER_API_KEY='your-api-key-here'
   ./deploy-to-render.sh
   ```

3. **Done!** The script will:
   - Create the web service on Render
   - Configure all environment variables
   - Monitor the deployment
   - Test the deployed URL

## Manual Deployment (Web UI)

If you prefer to use the Render web interface:

### Step 1: Create New Web Service

1. Go to https://dashboard.render.com
2. Click "New +" → "Web Service"
3. Connect your GitHub repository: `integrator-coder/gyc-dashboard`
4. Or paste the repo URL: `https://github.com/integrator-coder/gyc-dashboard`

### Step 2: Configure Service

**Basic Settings:**
- Name: `gyc-dashboard`
- Region: `Ohio (US East)`
- Branch: `main`
- Runtime: `Node`
- Build Command: `npm install && npm run build`
- Start Command: `npm run start`
- Instance Type: `Starter` ($7/month)

### Step 3: Environment Variables

Add all of these environment variables (click "Add Environment Variable" for each):

**Production Config:**
```
NODE_ENV=production
NEXT_PUBLIC_APP_NAME=GYC Dashboard
```

**Database:**
```
DATABASE_URL=postgresql://gyc_dashboard_user:WM7wK8Q3Ut07ZinurJsq54JNWRGXFWgL@dpg-d88abqdckfvc738qd3d0-a.ohio-postgres.render.com/gyc_dashboard?sslmode=require
NEON_DATABASE_URL=postgresql://gyc_dashboard_user:WM7wK8Q3Ut07ZinurJsq54JNWRGXFWgL@dpg-d88abqdckfvc738qd3d0-a.ohio-postgres.render.com/gyc_dashboard?sslmode=require
```

**Authentication:**
```
NEXTAUTH_URL=https://gyc-dashboard.onrender.com
NEXTAUTH_SECRET=gyc-dashboard-secret-2026-secure-key-xk9m
CREDENTIALS_ENCRYPTION_KEY=2623aec9819990789ff8b216664b47d9b383e2dc8a72947bbc1b42dfb1889775
```

**Integrations - API Keys:**
```
STRIPE_SECRET_KEY=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
NOTION_API_KEY=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
GHL_API_KEY=pit-b13533eb-bcfd-49cc-a077-a942369f8f5b
ZENDESK_API_TOKEN=O6fqf44H48zRseXLaAlLhN7OxFKeV72ajTO4WI0c
PANDADOC_API_KEY=de7458c973f6f1bf8457a1d5d9f3d36d6d80f17e
GOOGLE_PLACES_API_KEY=AIzaSyDh2ZtfrT3SD0zjYl7hT2kM5pbs5Avmhro
ASANA_PAT=2/1201675974916013/1213627355179910:36e5e049718024c717c13647ee695b4e
CENSUS_API_KEY=b35158bfd9e38593a6d0a5d2456fb2c25b3986ad
ANTHROPIC_API_KEY=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
OPENAI_API_KEY=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
```

**Integrations - Config:**
```
GHL_LOCATION_ID=hmTIYUexYXIXgmJzbx3s
ZENDESK_EMAIL=todd@growyourcenter.com
ZENDESK_SUBDOMAIN=gycawesome
ZOOM_ACCOUNT_ID=XYzKiXWlQDuk6RyMxAo-rw
ZOOM_CLIENT_ID=g0MPvV35SSKKt9wMGGowA
ZOOM_CLIENT_SECRET=txxrsBslJEY2zB5j5Y8HoDfMvGIWE83o
DATAFORSEO_LOGIN=todd@growyourcenter.com
DATAFORSEO_PASSWORD=df3bba249f0b08f2
```

### Step 4: Deploy

1. Click "Create Web Service"
2. Render will automatically deploy from the `main` branch
3. Wait 5-10 minutes for the build and deployment to complete

### Step 5: Verify

Once deployed, visit: **https://gyc-dashboard.onrender.com**

## What's Already Set Up

✅ **Database:** PostgreSQL database is already created on Render
- Name: GYC-Dashboard
- Region: Ohio
- Connection string is in the environment variables above

✅ **Environment Variables:** All secrets have been extracted from `.env.local` and are ready to be configured

✅ **Repository:** https://github.com/integrator-coder/gyc-dashboard is ready to be connected

## Next Steps After Deployment

1. **Custom Domain (Optional):**
   - In Render dashboard, go to your service
   - Click "Settings" → "Custom Domains"
   - Add your custom domain (e.g., dashboard.growyourcenter.com)

2. **Auto-Deploy:**
   - Already configured to auto-deploy from the `main` branch
   - Every push to `main` will trigger a new deployment

3. **Monitoring:**
   - View logs: https://dashboard.render.com → Your Service → Logs
   - Set up alerts in Render dashboard

## Cost Estimate

- **Web Service (Starter):** $7/month
- **PostgreSQL (Free tier):** $0/month (currently)
- **Total:** ~$7/month

## Troubleshooting

### Build Fails
- Check the build logs in Render dashboard
- Verify all environment variables are set correctly
- Ensure the GitHub repository is accessible

### Service Won't Start
- Check the service logs
- Verify DATABASE_URL is correct
- Ensure PORT environment variable is not set (Render sets this automatically)

### Database Connection Issues
- The database is already created and the connection string is correct
- Verify the database is in the same region (Ohio)
- Check that the database is not suspended

## Files Created

- `deploy-to-render.sh` - Automated deployment script
- `RENDER_DEPLOYMENT.md` - This guide

## Contact

For issues or questions, contact Todd at todd@growyourcenter.com
