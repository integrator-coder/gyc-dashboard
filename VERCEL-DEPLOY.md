# GYC Dashboard — Vercel Deployment Guide

## Prerequisites
- Vercel account connected to GitHub repo (`integrator-coder/gyc-dashboard`, PRIVATE)
- All env vars set in Vercel dashboard

## Environment Variables (set in Vercel → Settings → Environment Variables)

### Required
| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string | Copy from .env.local |
| `NEON_DATABASE_URL` | Same as DATABASE_URL | Duplicate required by some routes |
| `STRIPE_SECRET_KEY` | `rk_live_51Inp...` | From .env.local |
| `GHL_API_KEY` | `pit-b135...` | From .env.local |
| `GHL_LOCATION_ID` | `hmTIYUexYXIXgmJzbx3s` | From .env.local |
| `ZENDESK_SUBDOMAIN` | `gycawesome` | |
| `ZENDESK_EMAIL` | `todd@growyourcenter.com` | |
| `ZENDESK_API_TOKEN` | From .env.local | |
| `NOTION_API_KEY` | From .env.local | |
| `ASANA_PAT` | From .env.local | |
| `NEXT_PUBLIC_APP_NAME` | `GYC Dashboard` | |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Full JSON content of `~/.openclaw/credentials/google-console.json` | Paste the entire JSON as a single line |
| `OPENCLAW_WORKSPACE` | `/tmp/openclaw-workspace` | Mission Control reads from this; most data comes from DB |
| `JWT_SECRET` | Generate a strong random string | Auth signing key |

### Optional (add when ready)
| Variable | Notes |
|---|---|
| `ANTHROPIC_BILLING_API_KEY` | For Cost Monitor |
| `OPENAI_BILLING_API_KEY` | For OpenAI cost tracking |
| `SLACK_BOT_TOKEN` | For deal-closed notifications |

## Google Credentials

The dashboard connects to Google Sheets via a service account. On Vercel there's no file system, so credentials must be passed as an environment variable.

### Step 1: Get the JSON as a single line (minified)

```bash
cat ~/.openclaw/credentials/google-console.json | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin)))"
```

Or using `jq`:
```bash
cat ~/.openclaw/credentials/google-console.json | jq -c .
```

Or using Node:
```bash
node -e "const fs=require('fs'); console.log(JSON.stringify(JSON.parse(fs.readFileSync(process.env.HOME+'/.openclaw/credentials/google-console.json','utf8'))))"
```

### Step 2: Set in Vercel

In Vercel → Settings → Environment Variables, add:

| Variable | Value |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Paste the entire minified JSON string from Step 1 |

> ⚠️ **Must be a single line** — no newlines. The private key's `\n` sequences inside the JSON string are fine (they're escaped), but the overall JSON value must not have literal newlines.

### How the code uses it

`lib/google-auth.js` checks `GOOGLE_SERVICE_ACCOUNT_JSON` first (Vercel), then falls back to `GOOGLE_CREDENTIALS_PATH` or the default local file path. All route files use `createGoogleAuth()` from this module.

## Google Service Account Setup (legacy note)
The `google-console.json` file needs to be pasted as a JSON string env var.

```bash
# Get the JSON content as a single line
cat ~/.openclaw/credentials/google-console.json | tr -d '\n'
```
Paste the output as the value of `GOOGLE_SERVICE_ACCOUNT_JSON`.

## Deploy Steps

1. **Push to GitHub** (already set up, repo is `integrator-coder/gyc-dashboard`)
   ```bash
   cd gyc-dashboard && git push origin main
   ```

2. **Import in Vercel**
   - Go to vercel.com → New Project → Import from GitHub
   - Select `integrator-coder/gyc-dashboard`
   - Framework: Next.js (auto-detected)
   - Root directory: leave as `/` (repo root is the dashboard)

3. **Set environment variables** (use the table above)

4. **Deploy** — Vercel will build and deploy automatically

5. **Set custom domain** (optional)
   - Add `dashboard.growyourcenter.com` or similar in Vercel → Domains
   - Update DNS accordingly

## What Works on Vercel vs Local-Only

### ✅ Works on Vercel
- Finance dashboard (reads from Neon)
- Sales activity (reads from Neon + Sheets)
- New Business (reads from Sheets)
- Client Intel (reads from Neon + Zendesk + GHL + Sheets)
- CX Handoff (reads from Neon)
- Recon (reads from Neon)
- Mission Control — Overview, Agents, Cost, Scheduler, Escalation Radar

### ⚠️ Partially works on Vercel
- Mission Control — Task Board, Jobs, Diary (reads from workspace JSON files — needs `OPENCLAW_WORKSPACE` pointed at a writable path or migrated to DB)
- Brand Guide (reads/writes `data/brand-guide.json` and uploads to `public/brand/` — will work but uploads won't persist across deploys without object storage)
- Idea Board (reads/writes `data/ideas.json` — same issue)

### 🔧 Needs work for full Vercel parity
- Brand Guide + Idea Board uploads → move to Vercel Blob or S3
- Task Board + Jobs History → migrate from JSON files to Neon
- Mission Control workspace reads → parameterize via `OPENCLAW_WORKSPACE`

## Recommended first deploy scope
Deploy with Finance, Sales, Client Intel, CX Handoff, and Recon working.
Keep Mission Control as localhost-only for now (it reads workspace files).
