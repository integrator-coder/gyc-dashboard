# AI WatchBoard — JARVIS Market Stability Monitor

**Status:** ✅ LIVE  
**URL:** https://gyc-dashboard-ra9a.onrender.com/watchboard  
**Access:** Restricted to `todd@`, `bruce@`, `zac@` growyourcenter.com only  
**Deployed:** July 7, 2026

---

## What Is This?

The **AI WatchBoard** is a real-time market stability tracker monitoring 20+ signals of an AI bubble. Think Tony Stark's lab meets Bruce Wayne's operations center — a JARVIS-style interface that gives you instant visibility into whether the AI market is overheating, stabilizing, or headed for a correction.

**Current Status:** **7.0 / 10 BUBBLE RISK** (HIGH BUBBLE RISK with real underlying boom)

---

## What It Tracks

### 5 Core Categories

1. **VALUATION** — Shiller CAPE, Nvidia revenue multiple, AI sector P/E, Buffett Indicator, IPO P/S ratios
2. **INVESTMENT FLOW** — VC funding, investment-to-revenue ratio, Big Tech CAPEX, startup mortality, down rounds
3. **INFRASTRUCTURE** — Data center power growth, GPU pricing volatility, TSMC capacity, HBM supply gaps, nuclear PPAs
4. **ADOPTION** — Enterprise ROI rates, time-to-ROI, productivity growth, GenAI pilot success rates
5. **REGULATORY** — U.S.-China export control escalations, EU AI Act enforcement

### 40 AI Companies

Tracks 40 public/private AI companies across 6 categories:
- **Hardware & Compute:** Nvidia, AMD, Intel, TSMC, Broadcom, Marvell, Super Micro, ASML, Applied Materials, Arm
- **Hyperscalers:** Microsoft, Alphabet, Amazon, Meta, Oracle
- **AI-First Public:** Palantir, C3.ai, UiPath, Salesforce, ServiceNow, Snowflake, IBM
- **AI-First Private:** OpenAI, Anthropic, xAI, Databricks, Mistral
- **Physical AI:** Tesla, Vertiv, Dell
- **Energy AI:** Constellation Energy, Vistra, NextEra Energy, Eaton

---

## How to Use It

1. **Navigate to:** https://gyc-dashboard-ra9a.onrender.com/watchboard
2. **JARVIS initialization sequence** runs (2.8 seconds)
3. **Dashboard loads:**
   - **Top:** Bubble Risk Score gauge (0-10 scale, color-coded)
   - **Row 1:** 5 category health indicators (green/yellow/red status dots)
   - **Row 2:** 20 variable cards with current values, status, trends
   - **Row 3:** Company portfolio table with prices, market caps, 30d changes
   - **Row 4:** Active suspicions (none yet — shows "SYSTEM NOMINAL")
   - **Footer:** Last scan timestamp

### Color Codes

- **🔵 CYAN (#00D4FF):** Green status / Positive change / Safe zone
- **🟡 AMBER (#FFB700):** Yellow status / Warning / Watch zone
- **🔴 RED (#FF2D55):** Red status / Alert / Danger zone

### Reading the Bubble Score

| Score | Risk Level | Meaning |
|-------|-----------|---------|
| **0-3** | LOW | Sustainable boom, minimal bubble characteristics |
| **4-6** | MODERATE | Some overheating, watch for correction signals |
| **7-8** | HIGH | Significant bubble characteristics, correction likely within 18-36 months |
| **9-10** | CRITICAL | Imminent crash risk, major macro/regulatory shock likely trigger |

**Current:** **7.0** — HIGH BUBBLE RISK (dot-com-level valuations, massive investment-to-revenue gap, high startup mortality)

---

## What Makes It "JARVIS"?

The aesthetic is intentionally **NOT** a standard dashboard:

- **Deep space black background** (#000308) with animated grid lines
- **Holographic panel style** — glowing cyan borders, inner shadows, subtle flicker animations
- **Monospace data values** — clean, terminal-like readability
- **Pulsing status indicators** — breathing dots for health status
- **Startup sequence** — "JARVIS INITIALIZING..." with scan line animation
- **Tony Stark lab vibe** — this is your war room, not a spreadsheet

---

## Data Sources (Research Brief)

All 20 variables are grounded in the **AI WatchBoard Research Brief** (`memory/ai-watchboard-research-brief.md`):

- **Financial Markets:** Macrotrends, Yahoo Finance, Bloomberg, Crunchbase, PitchBook
- **Industry & Tech:** Stanford HAI AI Index, IEA, Gartner, Deloitte, TSMC
- **Academic:** NBER, MIT Sloan, HBS, Wharton, Federal Reserve (FRED)
- **Regulatory:** U.S. Dept of Commerce BIS, EU AI Office, SEC filings

---

## Database Schema

### 4 New Tables

1. **AIWatchVariable** — 20 core market variables (value, status, trend, source)
2. **AIWatchCompany** — 40 AI companies (price, market cap, PE ratio, 30d change)
3. **AIWatchSuspicion** — Active bubble risk alerts (none yet)
4. **AIWatchSnapshot** — Historical bubble score records (one seeded: 7.0 baseline)

---

## API Endpoints

All endpoints return JSON:

- **GET /api/watchboard/variables** — All variables (optional `?category=valuation` filter)
- **GET /api/watchboard/companies** — All companies (optional `?category=hardware` filter)
- **GET /api/watchboard/suspicions** — Active suspicions only
- **GET /api/watchboard/snapshot** — Latest bubble score snapshot

---

## Access Control

**Hard-coded whitelist** in `app/watchboard/page.tsx`:

```typescript
const ALLOWED_EMAILS = [
  'todd@growyourcenter.com',
  'bruce@growyourcenter.com',
  'zac@growyourcenter.com'
];
```

- Anyone not in this list → redirected to `/dashboard` (no error message)
- **Not linked in sidebar** — direct URL access only
- Invisible to all other users

---

## Why This Matters for GYC

As a marketing company serving childcare centers, GYC's AI investments (Wall·E, M3 platform, automation tools) are modest compared to hyperscalers. But:

### Strategic Value

- **Competitive intelligence** — Understand when AI hype will cool, helps time product launches and pricing
- **Client education** — GYC clients ask about AI; having informed perspective = trust and authority
- **Talent decisions** — Knowing when AI talent market will soften helps hiring strategy
- **Tech stack decisions** — Bubble signals indicate when to buy (e.g., GPU costs collapsing) vs. when to wait

### Risk Management

- If AI bubble pops hard, it will affect GYC's clients (economic slowdown, VC-backed competitors struggling)
- Early warning = ability to adjust positioning, messaging, and resource allocation

---

## What's Next (Future Enhancements)

1. **Automated data refresh** — Jarvis agent pulls fresh data weekly (Stripe-style API integrations)
2. **Historical charts** — Track bubble score over time, see trends
3. **Suspicion auto-detection** — AI agent flags new risks when thresholds cross
4. **Email alerts** — Notify Todd/Bruce/Zac when bubble score jumps >1 point in a week
5. **LLM commentary** — Claude-generated analysis of what changed and why

---

## Files Created/Modified

### New Files

- `prisma/schema.prisma` — Added 4 models
- `scripts/seed-ai-watchboard.js` — Seed script (20 variables + 40 companies)
- `app/api/watchboard/variables/route.ts`
- `app/api/watchboard/companies/route.ts`
- `app/api/watchboard/suspicions/route.ts`
- `app/api/watchboard/snapshot/route.ts`
- `app/watchboard/page.tsx` — Main JARVIS interface

### Database Migration

- Ran `npx prisma db push` to add tables
- Seeded initial data successfully

---

## Troubleshooting

### "I can't access /watchboard"

- Check your logged-in email — must be `todd@`, `bruce@`, or `zac@growyourcenter.com`
- Clear browser cache and re-login
- Direct URL: https://gyc-dashboard-ra9a.onrender.com/watchboard

### "Data isn't loading"

- Check API routes are responding: `/api/watchboard/variables`
- Check browser console for errors
- Verify Neon DB connection is active

### "I want to add more people"

Edit `app/watchboard/page.tsx` line 27:

```typescript
const ALLOWED_EMAILS = [
  'todd@growyourcenter.com',
  'bruce@growyourcenter.com',
  'zac@growyourcenter.com',
  'newperson@growyourcenter.com'  // Add here
];
```

Then commit + deploy.

---

## References

- **Research Brief:** `memory/ai-watchboard-research-brief.md` (full 20-variable analysis)
- **Deployment:** Render service `srv-d88d7f8jo6nc73dekgog`
- **GitHub Commit:** `598c265` (July 7, 2026)

---

**Built by:** R2 (Wall·E's dashboard builder)  
**For:** Todd @ GYC  
**Date:** July 7, 2026  
**Status:** ✅ PRODUCTION READY
