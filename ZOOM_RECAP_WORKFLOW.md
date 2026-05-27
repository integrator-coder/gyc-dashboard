# Zoom Call Recap Workflow

Automated meeting recap and follow-up email generation for GYC client calls.

## Overview

This workflow analyzes Zoom call transcripts for client meetings and generates:
1. **Structured Meeting Recap** (JSON) - Summary, key points, action items, sentiment
2. **Follow-up Email Draft** - Professional email ready to send to client

## Database Schema

Three new columns added to `ZoomCall`:

```sql
ALTER TABLE "ZoomCall" ADD COLUMN IF NOT EXISTS "meetingRecap" JSONB;
ALTER TABLE "ZoomCall" ADD COLUMN IF NOT EXISTS "followUpEmailDraft" TEXT;
ALTER TABLE "ZoomCall" ADD COLUMN IF NOT EXISTS "recapGeneratedAt" TIMESTAMPTZ;
```

### meetingRecap JSON Structure

```json
{
  "summary": "2-3 sentence overview of the call",
  "keyPoints": [
    "Key discussion point 1",
    "Key discussion point 2",
    "..."
  ],
  "actionItems": [
    {
      "item": "Description of action",
      "owner": "client|ga|both",
      "deadline": "YYYY-MM-DD or 'TBD'"
    }
  ],
  "clientSentiment": "positive|neutral|concerned",
  "callType": "marketing_review|onboarding|strategy|other"
}
```

### followUpEmailDraft Format

Complete professional email including:
- Subject line
- Personalized greeting (client owner first name)
- Brief recap paragraph
- Action items section with owners and deadlines
- Warm closing signed by GA name

## Scripts

### 1. `scripts/add-recap-columns.mjs`
Adds the three new columns to ZoomCall table.

**Run once:**
```bash
cd /Users/toddthejedigmail.com/.openclaw/workspace/gyc-dashboard
node --env-file=.env.local scripts/add-recap-columns.mjs
```

### 2. `scripts/generate-call-recaps.mjs`
Main recap generation script. Processes calls that meet criteria:
- `aiClassification` IN ('client_meeting', 'onboarding', 'blueprint')
- `acronym` IS NOT NULL (linked to a client)
- `meetingRecap` IS NULL (not yet processed)
- Has matching ZoomTranscript record

**Manual run:**
```bash
node --env-file=.env.local scripts/generate-call-recaps.mjs
```

**Features:**
- OpenAI API (gpt-4o-mini) for cost efficiency
- Rate limiting: 1 second between calls
- Batch processing: max 50 calls per run
- Error handling with detailed logging
- Fetches client profile data (name, owner, GA) for personalization

### 3. `scripts/check-recap-eligibility.mjs`
Diagnostic script to check how many calls are eligible for processing.

**Run:**
```bash
node --env-file=.env.local scripts/check-recap-eligibility.mjs
```

### 4. `scripts/verify-recap-workflow.mjs`
Comprehensive verification of the entire workflow.

**Run:**
```bash
node --env-file=.env.local scripts/verify-recap-workflow.mjs
```

## API Route

### GET `/api/clients/[acronym]/meetings`

Returns meeting history for a specific client including recaps and email drafts.

**Auth:** Requires role: ga, cx, admin, or superadmin

**Response:**
```json
{
  "acronym": "CAEC",
  "meetings": [
    {
      "id": "uuid",
      "topic": "Marketing Review | Grow Your Center",
      "date": "2026-05-10",
      "duration": 45,
      "callType": "client_meeting",
      "aiSummary": "...",
      "meetingRecap": {
        "summary": "...",
        "keyPoints": [...],
        "actionItems": [...],
        "clientSentiment": "positive",
        "callType": "marketing_review"
      },
      "followUpEmailDraft": "Subject: ...\n\nHi Matt,\n\n...",
      "recapGeneratedAt": "2026-05-25T20:00:00Z",
      "recordingUrl": "...",
      "transcriptUrl": "...",
      "gaName": "Sebastian",
      "gaEmail": "sebastian@growyourcenter.com"
    }
  ],
  "count": 1
}
```

**Example:**
```bash
# Requires authentication cookie
curl http://localhost:3000/api/clients/CAEC/meetings
```

## Integration with Daily Cron

The `zoom-daily-ingestion` cron (runs weekdays at 7 AM ET) should call the recap generator after pulling new calls.

**Add to cron workflow:**
```bash
node --env-file=.env.local scripts/generate-call-recaps.mjs
```

This ensures recaps are generated automatically for all new client calls with transcripts.

## Current Status (2026-05-25)

✅ **Schema:** All columns added successfully  
✅ **Scripts:** All 4 scripts created and tested  
✅ **API:** Route created and responding  
⏳ **Data:** 20 client calls with acronyms, 0 with transcripts (waiting for transcript ingestion)  

**Next Action:** Add `generate-call-recaps.mjs` to the `zoom-daily-ingestion` cron workflow.

## Files Created

```
gyc-dashboard/
├── app/
│   └── api/
│       └── clients/
│           └── [acronym]/
│               └── meetings/
│                   └── route.js          # API endpoint
├── scripts/
│   ├── add-recap-columns.mjs            # One-time schema migration
│   ├── generate-call-recaps.mjs         # Main recap generator
│   ├── check-recap-eligibility.mjs      # Diagnostic tool
│   └── verify-recap-workflow.mjs        # Verification script
└── ZOOM_RECAP_WORKFLOW.md               # This file
```

## Cost Estimate

Using `gpt-4o-mini`:
- ~$0.15 per 1M input tokens
- ~$0.60 per 1M output tokens
- Average call transcript: ~3K tokens input
- Average response: ~800 tokens output

**Per call cost:** ~$0.0009 (less than $0.001 per recap)  
**50 calls:** ~$0.045

Very cost-effective for automated client follow-up generation.

## Sample Output

### Meeting Recap JSON
```json
{
  "summary": "Marketing review covering Q2 lead performance, upcoming summer enrollment push, and new Google Ads campaign optimizations. Client expressed satisfaction with recent website updates and is eager to launch new landing pages.",
  "keyPoints": [
    "Lead volume up 23% month-over-month from improved Google Ads targeting",
    "Tour conversion rate at 42% - above industry average",
    "New landing page for infant program approved for May deployment",
    "Summer camp enrollment campaign launching June 1st"
  ],
  "actionItems": [
    {
      "item": "Send updated keyword performance report with cost-per-lead breakdown",
      "owner": "ga",
      "deadline": "2026-05-17"
    },
    {
      "item": "Review and approve summer camp creative concepts",
      "owner": "client",
      "deadline": "2026-05-20"
    },
    {
      "item": "Schedule follow-up call to review June campaign performance",
      "owner": "both",
      "deadline": "2026-06-07"
    }
  ],
  "clientSentiment": "positive",
  "callType": "marketing_review"
}
```

### Follow-up Email Draft
```
Subject: Marketing Review Follow-Up - Action Items & Next Steps

Hi Matt,

Thank you for taking the time to connect today! It was great to review your Q2 marketing performance and discuss the exciting plans for your summer enrollment push.

I wanted to recap our key discussion points:
- Your lead volume is up 23% month-over-month thanks to the improved Google Ads targeting we implemented
- Your tour conversion rate of 42% continues to exceed industry benchmarks
- We're on track to launch your new infant program landing page in May
- Summer camp enrollment campaign is scheduled for June 1st kickoff

**Action Items:**
- I'll send you the updated keyword performance report with detailed cost-per-lead breakdown by Friday, May 17th
- Please review and approve the summer camp creative concepts by May 20th so we can finalize the campaign assets
- Let's schedule our follow-up call for June 7th to review the campaign performance

I'm excited about the momentum we're building together. If anything comes up before our next scheduled call, don't hesitate to reach out!

Best,
Sebastian
Growth Advisor
Grow Your Center
sebastian@growyourcenter.com
```

## Troubleshooting

**No calls processed:**
- Check that ZoomTranscript records exist and are linked correctly
- Verify `acronym` field is populated on ZoomCall records
- Confirm `aiClassification` is one of: client_meeting, onboarding, blueprint

**OpenAI errors:**
- Verify OPENAI_API_KEY in .env.local
- Check API quota/billing status
- Rate limits are respected (1 second between calls)

**API returns unauthorized:**
- Endpoint requires valid session cookie
- User must have role: ga, cx, admin, or superadmin
