# GYC Dashboard — Vercel Deployment Guide
**For: Kaci | Prepared by: Wall·E**

---

## Overview

This guide covers everything needed to deploy the GYC KPI dashboard to Vercel. The dashboard is a Next.js app hosted in a private GitHub repo. Vercel connects to that repo, builds the app, and hosts it publicly (behind a login wall).

---

## Before You Start — What You'll Need

- Access to the GitHub repo: `integrator-coder/gyc-dashboard` (private)
  - Ask Todd for collaborator access if needed
- A Vercel account (create at vercel.com — free tier is fine to start)
- The env var values from Todd (see list below — he'll provide the actual values)

---

## Step 1 — Import the Repo into Vercel

1. Go to [vercel.com](https://vercel.com) → Log in → **Add New Project**
2. Click **Import Git Repository**
3. Select `integrator-coder/gyc-dashboard`
4. Framework: **Next.js** (will be auto-detected)
5. Root directory: leave blank (default)
6. **Do NOT click Deploy yet** — set env vars first (Step 2)

---

## Step 2 — Set Environment Variables

In Vercel → your project → **Settings** → **Environment Variables**, add each of the following.

Ask Todd for the actual values — he has them all saved.

| Variable | What It Is |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `NEON_DATABASE_URL` | Same value as DATABASE_URL (required by some routes) |
| `STRIPE_SECRET_KEY` | Stripe API key (read-only) |
| `GHL_API_KEY` | GoHighLevel API key |
| `GHL_LOCATION_ID` | `hmTIYUexYXIXgmJzbx3s` |
| `ZENDESK_SUBDOMAIN` | `gycawesome` |
| `ZENDESK_EMAIL` | `todd@growyourcenter.com` |
| `ZENDESK_API_TOKEN` | Zendesk read-only token |
| `NOTION_API_KEY` | Notion integration key |
| `ASANA_PAT` | Asana personal access token |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Google credentials — see Step 3 below |
| `JWT_SECRET` | Any strong random string (32+ chars) — used to sign login sessions |
| `NEXT_PUBLIC_APP_NAME` | `GYC Dashboard` |
| `OPENCLAW_WORKSPACE` | `/tmp/openclaw-workspace` |

Set all variables for **Production**, **Preview**, and **Development** environments.

---

## Step 3 — Google Credentials (Important)

The dashboard connects to Google Sheets and Google Analytics via a service account. On Vercel there's no local file system, so the credentials must be stored as an environment variable.

### How to get the value

On the Mac Mini (GYC-Integrator-Claw), run this command in Terminal:

```bash
python3 -c "import json; print(json.dumps(json.load(open('/Users/toddthejedigmail.com/.openclaw/credentials/google-console.json'))))"
```

This outputs the credentials as a single-line string. Copy the entire output.

### Where to paste it

In Vercel → Environment Variables, add:

| Variable | Value |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Paste the entire output from above |

⚠️ **Important:** The value must be all on one line — no line breaks in the field. The string will look like: `{"type":"service_account","project_id":"...","private_key":"-----BEGIN RSA...`

---

## Step 4 — Deploy

Once all env vars are saved:

1. Go to **Deployments** tab → click **Deploy** (or push any commit to `main` to trigger auto-deploy)
2. Build usually takes 1–2 minutes
3. Vercel will give you a URL like `gyc-dashboard-xxx.vercel.app`

---

## Step 5 — Test After Deploy

1. Open the Vercel URL
2. Log in with: `todd@growyourcenter.com` / `TestSuperAdmin2026!`
3. Verify these pages load:
   - Finance dashboard
   - Sales Activity
   - Client Intel (browse a client)
   - Leadership Board
4. If any page shows an error, check Vercel → Deployments → Functions logs

---

## Step 6 — Custom Domain (Optional)

If you want to use `dashboard.growyourcenter.com` instead of the Vercel URL:

1. Vercel → project → **Settings** → **Domains** → Add `dashboard.growyourcenter.com`
2. Add a CNAME DNS record pointing to `cname.vercel-dns.com`
3. Vercel handles SSL automatically

---

## Notes on What's Fully Hosted vs Local-Only

Most of the dashboard reads from the Neon database and external APIs — these all work on Vercel.

A few features read from local workspace files and won't be fully functional on Vercel on day one:
- **Mission Control** task board, jobs history, diary (these read local JSON files — functional later once migrated to DB)
- **Brand Guide** file uploads (won't persist across deploys — needs object storage later)

Everything else — Finance, Sales, Client Intel, CX, Recon, Leadership, New Business, Sales Analysis — works fully on Vercel.

---

## Troubleshooting

| Issue | Likely cause | Fix |
|---|---|---|
| Login page redirects in a loop | `JWT_SECRET` missing or wrong | Check env var is set |
| Google Sheets data missing | `GOOGLE_SERVICE_ACCOUNT_JSON` missing or malformed | Re-paste the single-line JSON |
| Database errors | `DATABASE_URL` not set | Check Neon connection string |
| 500 errors on specific pages | Check Vercel function logs for the specific error | Functions tab → click failed request |

---

## Questions?

Reach out to Todd or message Wall·E directly on Telegram.
