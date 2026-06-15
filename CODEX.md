# CODEX.md — GYC Dashboard

This file is the standing context for any Codex agent working on this codebase.
Read this before doing anything.

## What This Project Is
GYC (Grow Your Center) KPI Dashboard — a web app that tracks marketing performance 
metrics for GYC's childcare center clients. Built for internal GYC leadership and 
client-facing reporting.

**Live URL:** https://gyc-dashboard-ra9a.onrender.com
**GitHub:** https://github.com/integrator-coder/gyc-dashboard

## Tech Stack
- **Framework:** Next.js 14 (App Router)
- **Database:** SQLite via Prisma ORM (local file: prisma/gyc.db)
- **Auth:** NextAuth.js
- **Styling:** Tailwind CSS
- **Deployment:** Render (auto-deploy BROKEN — must use deploy script)
- **Charts:** Recharts

## Project Structure
- `app/` — Next.js app router pages and API routes
- `app/api/` — all API endpoints
- `components/` — reusable UI components
- `prisma/` — schema + migrations + gyc.db
- `data/` — static JSON data files (including presentation-library.json)
- `scripts/` — utility scripts
- `public/` — static assets

## Critical Rules — Read These Before Writing Any Code

### 🔴 NEVER put secrets in any file
- Secrets live in `.env.local` ONLY — it is gitignored
- Never create .txt, .sh, .md, or any other file containing API keys, tokens, or passwords
- Before every commit: `git diff --staged` to verify nothing sensitive is staged
- This rule exists because of a real incident on May 27, 2026 where API keys were exposed

### 🔴 NEVER push directly to main without going through the deploy script
```bash
bash scripts/git-push-and-deploy.sh
```
Render's auto-deploy is broken. Plain `git push` alone will NOT update the live site.
Always use the deploy script which also triggers a Render deploy via API.

### 🔴 Never delete the database
- `prisma/gyc.db` is the production database
- Never run `prisma migrate reset` or any destructive migration without explicit approval
- Always add new fields as optional (nullable) to avoid breaking existing records

### 🟡 Test before committing
- Run `npm run build` from the gyc-dashboard directory before committing
- Fix all TypeScript and build errors before pushing
- The build must pass cleanly

### 🟡 API routes
- All API endpoints go in `app/api/`
- Use NextResponse.json() for responses
- Always handle errors with try/catch and return appropriate HTTP status codes

## How to Run Locally
```bash
cd /Users/toddthejedigmail.com/.openclaw/workspace/gyc-dashboard
npm install
npm run dev
# Server runs at localhost:3000
```

## Database Access
```bash
# View database
npx prisma studio
# Or direct SQLite:
sqlite3 prisma/gyc.db
```

## Deployment
```bash
# ALWAYS use this script — never plain git push
bash scripts/git-push-and-deploy.sh
```

## Review Requirements (Mandatory for Every Change)

Every Codex task must produce proof before it ships:

| Change Type | Required Proof | Who Reviews |
|-------------|---------------|-------------|
| New feature / UI change | npm run build passes + screenshot or description of what changed | Wall·E reviews diff → Todd approves |
| Bug fix | Build passes + description of what was broken and what fixed it | Wall·E reviews diff |
| API endpoint change | Build passes + test the endpoint locally | Wall·E reviews |
| Database schema change | Migration file reviewed + no destructive changes | Todd must approve always |
| Any client-facing change | Build + visual verification | Todd must approve before deploy |

**The rule:** Show your work. If you can't prove it works, it doesn't ship.

## Common Patterns

### Adding a new API endpoint
Create `app/api/[route-name]/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(req: NextRequest) {
  try {
    // your logic
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

### Prisma queries
```typescript
const client = await prisma.clientProfile.findUnique({ where: { id } })
const all = await prisma.clientProfile.findMany({ where: { hasSEO: true } })
```

## Who Owns This
- **Developer:** Wall·E (AI assistant, main session)
- **Codex:** Feature builds, bug fixes, refactors — sandboxed, always reviewed before deploy
- **Owner:** Todd Lavictoire (GYC Integrator) — approves all client-facing changes
