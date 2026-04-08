# GYC KPI Dashboard

The internal operating system for Grow Your Center. Built to give the leadership team and growth advisors real-time visibility into business performance.

---

## What's Inside

| Dashboard | Description |
|---|---|
| **Finance** | MRR, ARR, Active Clients, Daily Cash, RPE |
| **Sales Activity** | Rep-level daily KPIs, targets, leaderboard |
| **New Business** | Closed deals, contract value, MRR added |
| **Churn** | Client churn rate, revenue churn, NRR, GRR |
| **Dunning** | Past-due accounts, recovery tracking |
| **CX** | Quarterly meeting completion, client health |
| **Production** | Production team metrics |
| **Leadership** | Executive-level composite overview |
| **Agreements** | PandaDoc sent/signed, proposed/closed value, MRR |
| **Web Analytics** | Google Analytics client site performance |
| **Team Portal** | Client Intel, Recon, CX Handoff |
| **Mission Control** | Agent fleet, task board, job history, cost tracking |

---

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Database:** Neon PostgreSQL (via Prisma + pg)
- **Auth:** Custom JWT (role-based: superadmin, admin, sales, ga, cx)
- **Styling:** Tailwind CSS
- **Charts:** Recharts
- **Hosting:** Vercel
- **Data Sources:** Stripe, GoHighLevel, Google Sheets, Google Analytics, Zendesk, Asana, Zoom, PandaDoc, Notion

---

## Getting Started (Local)

```bash
npm install
cp .env.example .env.local  # fill in your env vars
npm run dev
```

Dashboard runs at `http://localhost:3000`

---

## Deployment

See `VERCEL-DEPLOY-KACI.md` for the full Vercel deployment guide including all required environment variables.

---

## Agent Architecture

This dashboard is maintained and extended by the GYC AI Agent Fleet:
- **Wall·E** — orchestrator, strategy, day-to-day
- **R2** — builds features and fixes
- **C3PO** — QA validation
- **Thrawn** — business intelligence
- **Yoda** — deep architecture analysis
- **Eve** — data sync and ingestion (Mac Studio node)

---

## Access

All routes are behind role-based auth. Default temp password for all accounts: contact Todd.

| Role | Access |
|---|---|
| superadmin | Everything |
| admin | Everything |
| sales | Sales, CX, Team Portal |
| ga | Sales, CX, Production, Team Portal |
| cx | Team Portal |

---

*Built by Wall·E 🤖 — GYC's AI Integrator*
