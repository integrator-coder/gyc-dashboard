"""
Apply GYC brand formatting to the Revenue Report Google Doc.
Doc ID: 15scnaOycWILyC3OHQTEsv--9vfF47sxlJNR0Pi4VSNQ
"""

import json
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

CREDS_FILE = '/Users/toddthejedigmail.com/.openclaw/credentials/google-console.json'
DOC_ID = '15scnaOycWILyC3OHQTEsv--9vfF47sxlJNR0Pi4VSNQ'
DOC_URL = f'https://docs.google.com/document/d/{DOC_ID}/edit'

# Brand colors
VIOLET     = {'red': 0.451, 'green': 0.082, 'blue': 0.580}   # #731494
DEEP_VIOLET= {'red': 0.204, 'green': 0.043, 'blue': 0.404}   # #340B67
GRAY       = {'red': 0.420, 'green': 0.447, 'blue': 0.502}   # #6b7280
NEAR_BLACK = {'red': 0.067, 'green': 0.094, 'blue': 0.153}   # #111827
NEAR_WHITE = {'red': 0.92,  'green': 0.92,  'blue': 0.92}    # near-invisible divider

def rgb(c):
    return {'color': {'rgbColor': c}}

def text_style(start, end, bold=False, italic=False, size=11, color=NEAR_BLACK):
    return {
        'updateTextStyle': {
            'range': {'startIndex': start, 'endIndex': end},
            'textStyle': {
                'bold': bold,
                'italic': italic,
                'fontSize': {'magnitude': size, 'unit': 'PT'},
                'foregroundColor': rgb(color),
            },
            'fields': 'bold,italic,fontSize,foregroundColor'
        }
    }

def para_align(start, end, alignment):
    return {
        'updateParagraphStyle': {
            'range': {'startIndex': start, 'endIndex': end},
            'paragraphStyle': {'alignment': alignment},
            'fields': 'alignment'
        }
    }

def page_break_before(start, end):
    return {
        'updateParagraphStyle': {
            'range': {'startIndex': start, 'endIndex': end},
            'paragraphStyle': {'pageBreakBefore': True},
            'fields': 'pageBreakBefore'
        }
    }

def divider_style(start, end):
    return {
        'updateTextStyle': {
            'range': {'startIndex': start, 'endIndex': end},
            'textStyle': {
                'fontSize': {'magnitude': 2, 'unit': 'PT'},
                'foregroundColor': rgb(NEAR_WHITE),
            },
            'fields': 'fontSize,foregroundColor'
        }
    }

# ── Document structure (from pre-scan) ──────────────────────────────────────
# Title paragraph: [1-22]  → text at [1,21], \n at 21
# Subtitle 1:      [23-58]  → "**Prepared for:** Bruce Spurr, CEO\n"
# Subtitle 2:      [58-79]  → "**Date:** April 2026\n"
# Subtitle 3:      [79-124] → "**Prepared by:** Todd Lavictoire, Integrator\n"
# Divider:         [125-129]
# Blank:           [129-130]
# Exec Summary:    [130-151]
# Body starts at 152

# Section headers:
#   EXECUTIVE SUMMARY  [130-151]
#   SECTION 1          [1109-1138]
#   SECTION 2          [2818-2871]
#   SECTION 3          [4917-4979]
#   SECTION 4          [7030-7087]
#   SECTION 5          [9000-9036]
#   SECTION 6          [10494-10551]
#   SECTION 7          [12060-12091]
#   SECTION 8          [13707-13758]

# Key takeaway char ranges (within larger paragraphs):
#   "2026 is the building year…"           [860, 906]
#   "Through the first 102 days…"          [2206, 2240]
#   "Combined, GYC's true monthly…"        [3929, 3985]
#   "This pipeline is not a projection."   [5795, 5829]
#   "The base case alone exceeds…"         [7762, 7816]
#   "Every scenario crosses $4.2M…"        [11544, 11581]
#   "This report establishes…"             [14255, 14304]

# Figure captions:
#   Figure 1: [2587, 2812]
#   Figure 2: [4654, 4911]
#   Figure 3: [6770, 7025]  (note: next element starts at 7025)
#   Figure 4: [10180, 10488]
#   Figure 5: [11729, 12055]

# Dividers (--- paragraphs):
#   [125,129], [1104,1108], [2813,2817], [4912,4916], [7025,7029],
#   [8995,8999], [10489,10493], [12055,12059], [13702,13706]

def build_requests(doc_end):
    requests = []

    # ── 1. Reset entire doc to body text (11pt, near-black, not bold/italic) ──
    requests.append(text_style(1, doc_end - 1, bold=False, italic=False, size=11, color=NEAR_BLACK))

    # ── 2. Title ─────────────────────────────────────────────────────────────
    requests.append(text_style(1, 21, bold=True, italic=False, size=28, color=VIOLET))
    requests.append(para_align(1, 22, 'CENTER'))

    # ── 3. Subtitle lines ────────────────────────────────────────────────────
    for (s, e, pe) in [(23, 57, 58), (58, 78, 79), (79, 123, 124)]:
        requests.append(text_style(s, e, bold=False, italic=True, size=11, color=DEEP_VIOLET))
        requests.append(para_align(s, pe, 'CENTER'))

    # ── 4. Section headers (EXECUTIVE SUMMARY + SECTION 1-8) ─────────────────
    section_headers = [
        (130, 150, 151),    # EXECUTIVE SUMMARY
        (1109, 1137, 1138), # SECTION 1
        (2818, 2870, 2871), # SECTION 2
        (4917, 4978, 4979), # SECTION 3
        (7030, 7086, 7087), # SECTION 4
        (9000, 9035, 9036), # SECTION 5
        (10494, 10550, 10551), # SECTION 6
        (12060, 12090, 12091), # SECTION 7
        (13707, 13757, 13758), # SECTION 8
    ]
    for (s, e, pe) in section_headers:
        requests.append(text_style(s, e, bold=True, italic=False, size=16, color=DEEP_VIOLET))

    # ── 5. Page breaks before SECTION 1-8 (NOT before Executive Summary) ─────
    sections_with_break = [
        (1109, 1138), # SECTION 1
        (2818, 2871), # SECTION 2
        (4917, 4979), # SECTION 3
        (7030, 7087), # SECTION 4
        (9000, 9036), # SECTION 5
        (10494, 10551), # SECTION 6
        (12060, 12091), # SECTION 7
        (13707, 13758), # SECTION 8
    ]
    for (s, e) in sections_with_break:
        requests.append(page_break_before(s, e))

    # ── 6. Key takeaway lines ─────────────────────────────────────────────────
    key_takeaways = [
        (860, 906),     # "2026 is the building year. 2027 is the payoff."
        (2206, 2240),   # "Through the first 102 days of 2026"
        (3929, 3985),   # "Combined, GYC's true monthly cash generation is $265,492"
        (5795, 5829),   # "This pipeline is not a projection."
        (7762, 7816),   # "The base case alone exceeds $4.2M in 2027 by $355,000."
        (11544, 11581), # "Every scenario crosses $4.2M in 2027."
        (14255, 14304), # "This report establishes the shared understanding."
    ]
    for (s, e) in key_takeaways:
        requests.append(text_style(s, e, bold=True, italic=False, size=12, color=VIOLET))

    # ── 7. Figure captions ────────────────────────────────────────────────────
    figure_captions = [
        (2587, 2811),   # Figure 1
        (4654, 4910),   # Figure 2
        (6770, 7024),   # Figure 3
        (10180, 10487), # Figure 4
        (11729, 12053), # Figure 5
    ]
    for (s, e) in figure_captions:
        requests.append(text_style(s, e, bold=False, italic=True, size=10, color=GRAY))

    # ── 8. Dividers ───────────────────────────────────────────────────────────
    dividers = [
        (125, 128),
        (1104, 1107),
        (2813, 2816),
        (4912, 4915),
        (7025, 7028),
        (8995, 8998),
        (10489, 10492),
        (12055, 12058),
        (13702, 13705),
    ]
    for (s, e) in dividers:
        requests.append(divider_style(s, e))

    return requests


def main():
    creds = Credentials.from_service_account_file(
        CREDS_FILE, scopes=['https://www.googleapis.com/auth/documents']
    )
    service = build('docs', 'v1', credentials=creds)
    doc = service.documents().get(documentId=DOC_ID).execute()

    content = doc.get('body', {}).get('content', [])
    doc_end = content[-1].get('endIndex', 1) if content else 1

    requests = build_requests(doc_end)
    total = len(requests)
    print(f"Sending {total} formatting requests...")

    # Send in batches of 50 to be safe
    BATCH_SIZE = 50
    applied = 0
    for i in range(0, total, BATCH_SIZE):
        batch = requests[i:i+BATCH_SIZE]
        service.documents().batchUpdate(
            documentId=DOC_ID,
            body={'requests': batch}
        ).execute()
        applied += len(batch)
        print(f"  Applied {applied}/{total}")

    print(f"\n✅ Done — {applied} requests applied")
    print(f"\nPage breaks inserted before:")
    for name in ['SECTION 1', 'SECTION 2', 'SECTION 3', 'SECTION 4',
                 'SECTION 5', 'SECTION 6', 'SECTION 7', 'SECTION 8']:
        print(f"  ✓ {name}")
    print(f"\n📄 Doc: {DOC_URL}")


if __name__ == '__main__':
    main()
