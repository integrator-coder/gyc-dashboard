#!/usr/bin/env python3
"""
East Bank Masterclass Google Slides - Complete Rebuild v3
R2 Sub-agent: Clean rebuild with generous spacing, no overlapping text
Rules: max 4 text elements per slide, oversized text boxes, 140% line spacing
"""

import uuid
from google.oauth2 import service_account
from googleapiclient.discovery import build

# ── Credentials ──────────────────────────────────────────────────────────────
SERVICE_ACCOUNT_FILE = '/Users/toddthejedigmail.com/.openclaw/credentials/google-console.json'
SCOPES = [
    'https://www.googleapis.com/auth/presentations',
    'https://www.googleapis.com/auth/drive'
]
PRES_ID = '1_14eVjc2duCgRYysZsZS2B4y5q3uhn08xa_580GlgR8'

# ── Auth ──────────────────────────────────────────────────────────────────────
creds = service_account.Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE, scopes=SCOPES)
service = build('slides', 'v1', credentials=creds)

# ── Layout Constants ──────────────────────────────────────────────────────────
W, H = 9144000, 5143500
ML, MR = 548640, 548640
MT = 380000
CW = W - ML - MR                   # 8046720
HALF = (CW - 200000) // 2          # 3923360
COL2 = ML + HALF + 200000          # 4672000

# Colors
BG    = '#0d0014'
PURP  = '#340B67'
VIOL  = '#AE2BCF'
GOLD  = '#C19C46'
WHITE = '#FFFFFF'
BODY  = '#D4C8E8'
MUTED = '#8B7FA8'
DARK  = '#1a0535'

# ── Helpers ───────────────────────────────────────────────────────────────────
def uid():
    return 'el_' + uuid.uuid4().hex[:10]

def hex_rgb(h):
    h = h.lstrip('#')
    return int(h[:2], 16) / 255, int(h[2:4], 16) / 255, int(h[4:6], 16) / 255

def set_bg(reqs, slide_id, color):
    r, g, b = hex_rgb(color)
    reqs.append({'updatePageProperties': {
        'objectId': slide_id,
        'pageProperties': {'pageBackgroundFill': {'solidFill': {'color': {'rgbColor': {'red': r, 'green': g, 'blue': b}}}}},
        'fields': 'pageBackgroundFill'
    }})

def add_rect(reqs, slide_id, x, y, w, h, color):
    oid = uid()
    r, g, b = hex_rgb(color)
    reqs += [
        {'createShape': {'objectId': oid, 'shapeType': 'RECTANGLE', 'elementProperties': {
            'pageObjectId': slide_id,
            'size': {'width': {'magnitude': w, 'unit': 'EMU'}, 'height': {'magnitude': h, 'unit': 'EMU'}},
            'transform': {'scaleX': 1, 'scaleY': 1, 'translateX': x, 'translateY': y, 'unit': 'EMU'}}}},
        {'updateShapeProperties': {'objectId': oid, 'fields': 'shapeBackgroundFill,outline',
            'shapeProperties': {
                'shapeBackgroundFill': {'solidFill': {'color': {'rgbColor': {'red': r, 'green': g, 'blue': b}}}},
                'outline': {'propertyState': 'NOT_RENDERED'}}}}
    ]
    return oid

def add_text(reqs, slide_id, text, x, y, w, h, pt, color, bold=False, italic=False, align='START', line_spacing=140):
    oid = uid()
    r, g, b = hex_rgb(color)
    reqs += [
        {'createShape': {'objectId': oid, 'shapeType': 'TEXT_BOX', 'elementProperties': {
            'pageObjectId': slide_id,
            'size': {'width': {'magnitude': w, 'unit': 'EMU'}, 'height': {'magnitude': h, 'unit': 'EMU'}},
            'transform': {'scaleX': 1, 'scaleY': 1, 'translateX': x, 'translateY': y, 'unit': 'EMU'}}}},
        {'insertText': {'objectId': oid, 'text': text, 'insertionIndex': 0}},
        {'updateTextStyle': {'objectId': oid, 'fields': 'foregroundColor,fontSize,bold,italic,fontFamily',
            'style': {
                'foregroundColor': {'opaqueColor': {'rgbColor': {'red': r, 'green': g, 'blue': b}}},
                'fontSize': {'magnitude': pt, 'unit': 'PT'},
                'bold': bold, 'italic': italic, 'fontFamily': 'Arial'}}},
        {'updateParagraphStyle': {'objectId': oid, 'fields': 'alignment,lineSpacing,spaceAbove,spaceBelow',
            'style': {'alignment': align, 'lineSpacing': line_spacing,
                'spaceAbove': {'magnitude': 0, 'unit': 'PT'},
                'spaceBelow': {'magnitude': 6, 'unit': 'PT'}}}}
    ]
    return oid

def batch_update(requests):
    """Send requests in batches of 80 per call."""
    for i in range(0, len(requests), 80):
        chunk = requests[i:i + 80]
        service.presentations().batchUpdate(
            presentationId=PRES_ID,
            body={'requests': chunk}
        ).execute()

# ── Step 1: Clear existing slides ─────────────────────────────────────────────
print("Step 1: Clearing existing slides...")
pres = service.presentations().get(presentationId=PRES_ID).execute()
slides = pres['slides']
slide_ids = [s['objectId'] for s in slides]
print(f"  Found {len(slides)} existing slides")

clear_requests = []
for sid in slide_ids[1:]:
    clear_requests.append({'deleteObject': {'objectId': sid}})
for elem in slides[0].get('pageElements', []):
    clear_requests.append({'deleteObject': {'objectId': elem['objectId']}})

if clear_requests:
    batch_update(clear_requests)
    print(f"  Cleared {len(clear_requests)} objects")

SLIDE1 = slide_ids[0]
print(f"  First slide ID: {SLIDE1}")

# ── Step 2: Create slides 2–14 ────────────────────────────────────────────────
print("Step 2: Creating 13 new slides...")
create_reqs = []
for i in range(2, 15):
    create_reqs.append({'createSlide': {
        'objectId': f'slide{i:02d}',
        'slideLayoutReference': {'predefinedLayout': 'BLANK'}
    }})
batch_update(create_reqs)

SLIDES = {1: SLIDE1}
for i in range(2, 15):
    SLIDES[i] = f'slide{i:02d}'

print("  Created slides 2–14")

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 1 — Title
# ═══════════════════════════════════════════════════════════════════════════════
print("Building slide 01: Title...")
s = SLIDES[1]
reqs = []
set_bg(reqs, s, BG)
add_rect(reqs, s, ML, 2050000, CW, 8000, GOLD)
add_text(reqs, s, 'GROW YOUR CHILDCARE', ML, 1200000, CW, 300000, 13, VIOL, bold=True, align='CENTER')
add_text(reqs, s, 'East Bank Learning Center', ML, 1560000, CW, 500000, 40, WHITE, bold=True, align='CENTER')
add_text(reqs, s, 'A Masterclass in Client Growth', ML, 2130000, CW, 380000, 22, GOLD, align='CENTER')
add_text(reqs, s, 'Blueprint + Lead Maximization  \u00b7  April 10, 2026', ML, 2580000, CW, 280000, 14, MUTED, align='CENTER')
batch_update(reqs)

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 2 — Executive Summary
# ═══════════════════════════════════════════════════════════════════════════════
print("Building slide 02: Executive Summary...")
s = SLIDES[2]
reqs = []
set_bg(reqs, s, BG)
add_rect(reqs, s, 0, 0, 80000, H, PURP)
add_text(reqs, s, 'EXECUTIVE SUMMARY', ML, MT, CW, 280000, 12, VIOL, bold=True)
add_text(reqs, s,
    'East Bank is a case study in what the ideal GYC client looks like when every element of our playbook works together.',
    ML, 900000, CW, 680000, 26, WHITE, bold=True, line_spacing=130)
add_text(reqs, s,
    'This document captures what happened, why it worked, and what every Growth Advisor should take from it.\n\n'
    'The goal: define a repeatable standard.',
    ML, 1750000, CW, 500000, 16, BODY)
add_text(reqs, s,
    'Source: Bruce Spurr \u00d7 East Bank Learning Center call, April 10, 2026',
    ML, 2420000, CW, 280000, 13, MUTED, italic=True)
batch_update(reqs)

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 3 — Client Profile Overview
# ═══════════════════════════════════════════════════════════════════════════════
print("Building slide 03: Client Profile...")
s = SLIDES[3]
reqs = []
set_bg(reqs, s, BG)
add_text(reqs, s, '01 /', ML, MT, 400000, 280000, 13, VIOL, bold=True)
add_text(reqs, s, 'Client Profile', ML, MT + 250000, CW, 420000, 32, WHITE, bold=True)

# Left column: business details
add_rect(reqs, s, ML, 1150000, HALF, 3400000, DARK)
add_text(reqs, s,
    'Business\nEast Bank Learning Center\nSouth Bend, Indiana\n\n'
    'Center Type\nPremium toddler childcare\nAges 1\u20132 only\n\n'
    'Price\n$450/week \u2014 private pay\n\n'
    'Enrollment\n~60 families \u00b7 90 kids',
    ML + 120000, 1250000, HALF - 200000, 3200000, 15, BODY, line_spacing=145)

# Right column: services + opportunity
add_rect(reqs, s, COL2, 1150000, HALF, 3400000, DARK)
add_text(reqs, s,
    'GYC Services\nDFY Advanced SEO\nBlueprint (gifted)\n\n'
    'Open Opportunity\nWebsite \u2014 position when timing is right\n\n'
    'Known Facts\n~60 active families\nMany with 2\u20133 children enrolled\nKeith is remote (Naperville)',
    COL2 + 120000, 1250000, HALF - 200000, 3200000, 15, BODY, line_spacing=145)
batch_update(reqs)

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 4 — SEO Results
# ═══════════════════════════════════════════════════════════════════════════════
print("Building slide 04: SEO Results...")
s = SLIDES[4]
reqs = []
set_bg(reqs, s, BG)
add_text(reqs, s, '01 /', ML, MT, 400000, 280000, 13, VIOL, bold=True)
add_text(reqs, s, 'SEO Results \u2014 Before & After', ML, MT + 250000, CW, 420000, 32, WHITE, bold=True)
add_text(reqs, s, 'January 22 \u2013 April 10, 2026', ML, 1150000, CW, 280000, 15, GOLD)

add_rect(reqs, s, ML, 1600000, HALF, 1800000, DARK)
add_text(reqs, s,
    'DAYCARE KEYWORD\n\nAvg Rank\n9.5  \u2192  6.6\n(\u2191 nearly 3 positions)\n\nShare of Voice\n8%  \u2192  22%\n(nearly 3\u00d7 increase)',
    ML + 120000, 1700000, HALF - 200000, 1600000, 16, BODY, line_spacing=145)

add_rect(reqs, s, COL2, 1600000, HALF, 1800000, DARK)
add_text(reqs, s,
    'PRESCHOOL KEYWORD\n\nAvg Rank\n8.4  \u2192  6.7\n(\u2191 2 positions)\n\nShare of Voice\n25%  \u2192  37%\n(\u2191 12 points)',
    COL2 + 120000, 1700000, HALF - 200000, 1600000, 16, BODY, line_spacing=145)

add_text(reqs, s,
    'Google Reviews: 37 at 4.9\u2605  \u00b7  Tour Close Rate: ~80%  \u00b7  Paid Ads: None (= opportunity)',
    ML, 3600000, CW, 280000, 15, GOLD)
batch_update(reqs)

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 5 — The Opening Play
# ═══════════════════════════════════════════════════════════════════════════════
print("Building slide 05: The Opening Play...")
s = SLIDES[5]
reqs = []
set_bg(reqs, s, BG)
add_text(reqs, s, '02 /', ML, MT, 400000, 280000, 13, VIOL, bold=True)
add_text(reqs, s, 'The Opening Play', ML, MT + 250000, CW, 420000, 32, WHITE, bold=True)
add_text(reqs, s, 'How to Own a Service Gap and Reset the Relationship', ML, 1150000, CW, 280000, 18, GOLD)

add_rect(reqs, s, ML, 1600000, CW, 800000, DARK)
add_text(reqs, s,
    '\u201cThis is what happens when the CEO gets involved in production and breaks all the systems. My bad.\u201d',
    ML + 160000, 1700000, CW - 320000, 620000, 22, WHITE, italic=True, align='CENTER', line_spacing=130)

add_text(reqs, s, '\U0001f393  TEACHABLE MOMENT', ML, 2600000, CW, 280000, 13, VIOL, bold=True)
add_text(reqs, s,
    'Own the gap before the client brings it up. Lead with it. Be brief. Be direct.\n\n'
    'A confident acknowledgment neutralizes frustration before it can form.',
    ML, 2950000, CW, 550000, 15, BODY, line_spacing=140)
batch_update(reqs)

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 6 — The Performance Objection
# ═══════════════════════════════════════════════════════════════════════════════
print("Building slide 06: The Performance Objection...")
s = SLIDES[6]
reqs = []
set_bg(reqs, s, BG)
add_text(reqs, s, '03 /', ML, MT, 400000, 280000, 13, VIOL, bold=True)
add_text(reqs, s, 'The Performance Objection', ML, MT + 250000, CW, 420000, 32, WHITE, bold=True)
add_text(reqs, s, 'The 3-Step Framework \u2014 Validate \u2192 Contextualize \u2192 Redirect', ML, 1150000, CW, 280000, 18, GOLD)

BOX_W = 2560000
BOX_H = 1600000
BOX_Y = 1650000

add_rect(reqs, s, ML, BOX_Y, BOX_W, BOX_H, DARK)
add_text(reqs, s,
    'STEP 1\nVALIDATE\n\nAcknowledge the concern is real. Don\u2019t dismiss it. Let them feel heard.',
    ML + 80000, BOX_Y + 80000, BOX_W - 160000, BOX_H - 120000, 15, BODY, line_spacing=140)

add_rect(reqs, s, ML + 2760000, BOX_Y, BOX_W, BOX_H, DARK)
add_text(reqs, s,
    'STEP 2\nCONTEXTUALIZE\n\nBirth rates: 2.8 \u2192 2.1. The market is smaller. Every provider sees softer numbers.',
    ML + 2840000, BOX_Y + 80000, BOX_W - 160000, BOX_H - 120000, 15, BODY, line_spacing=140)

add_rect(reqs, s, ML + 5520000, BOX_Y, BOX_W, BOX_H, DARK)
add_text(reqs, s,
    'STEP 3\nREDIRECT\n\nPresent the wins. East Bank captures MORE of a smaller market \u2014 that\u2019s the right trade-off.',
    ML + 5600000, BOX_Y + 80000, BOX_W - 160000, BOX_H - 120000, 15, BODY, line_spacing=140)

add_text(reqs, s,
    'Never jump to Step 3 without Steps 1 and 2.\nMeet them emotionally before you move them logically.',
    ML, 3450000, CW, 380000, 15, BODY)
batch_update(reqs)

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 7 — The Blueprint Play
# ═══════════════════════════════════════════════════════════════════════════════
print("Building slide 07: The Blueprint Play...")
s = SLIDES[7]
reqs = []
set_bg(reqs, s, BG)
add_text(reqs, s, '04 /', ML, MT, 400000, 280000, 13, VIOL, bold=True)
add_text(reqs, s, 'The Blueprint Play', ML, MT + 250000, CW, 420000, 32, WHITE, bold=True)
add_text(reqs, s, 'Alignment, Not Charity', ML, 1150000, CW, 280000, 18, GOLD)

add_text(reqs, s,
    '1.  They asked.  Bruce\u2019s rule: \u201cGive Blueprint to anyone who raises their hand and says they\u2019re willing to do more.\u201d East Bank raised both hands.\n\n'
    '2.  Their effort accelerates results.  When clients run Blueprint \u2014 reviews, referrals, guerrilla tactics \u2014 GYC\u2019s SEO compounds faster.\n\n'
    '3.  Invested clients don\u2019t churn.  Shared systems create ownership. That\u2019s a client who renews.',
    ML, 1650000, CW, 1600000, 16, BODY, line_spacing=145)

add_rect(reqs, s, ML, 3450000, CW, 8000, GOLD)
add_text(reqs, s,
    'Blueprint is not a discount. It\u2019s an alignment tool and a retention investment.',
    ML, 3540000, CW, 280000, 18, GOLD, bold=True)
batch_update(reqs)

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 8 — The Enrollment Calendar
# ═══════════════════════════════════════════════════════════════════════════════
print("Building slide 08: The Enrollment Calendar...")
s = SLIDES[8]
reqs = []
set_bg(reqs, s, BG)
add_text(reqs, s, '05 /', ML, MT, 400000, 280000, 13, VIOL, bold=True)
add_text(reqs, s, 'The Enrollment Calendar', ML, MT + 250000, CW, 420000, 32, WHITE, bold=True)
add_text(reqs, s,
    'Know this cold \u2014 anchor every client conversation to the seasonal rhythm',
    ML, 1150000, CW, 280000, 16, GOLD)

ITEMS = [
    (1620000, 'NOV \u2013 DEC   \u2b1b  QUIET SEASON', 'Lowest intent. Market dormant.', MUTED, 15),
    (2220000, 'MAR \u2013 MAY   \U0001f7e1  SETUP WINDOW   \u2190 NOW', 'Planners start researching. Build rankings now \u2014 they bloom in summer.', BODY, 15),
    (2820000, 'MAY \u2013 JUN   \U0001f7e2  UPTICK', 'Intent builds. Parents start touring. Lead volume picks up.', BODY, 15),
    (3420000, 'JULY 4TH   \U0001f31f  THE SURGE', 'Decision time. Enrollment spikes. Everything you did since March blooms here.', WHITE, 17),
    (4020000, 'AUGUST   \U0001f535  BACK TO SCHOOL', 'Enrollment finalizes. Fall cohort set.', BODY, 15),
]
for y, label, body_text, color, pt in ITEMS:
    add_text(reqs, s, label, ML, y, CW, 260000, pt, color, bold=(color == WHITE))
    add_text(reqs, s, body_text, ML + 40000, y + 270000, CW - 40000, 240000, 13, MUTED)
batch_update(reqs)

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 9 — Three Growth Levers
# ═══════════════════════════════════════════════════════════════════════════════
print("Building slide 09: Three Growth Levers...")
s = SLIDES[9]
reqs = []
set_bg(reqs, s, BG)
add_text(reqs, s, '06 /', ML, MT, 400000, 280000, 13, VIOL, bold=True)
add_text(reqs, s, 'The Three Growth Levers', ML, MT + 250000, CW, 420000, 32, WHITE, bold=True)

add_text(reqs, s, '\u2b50  REVIEWS', ML, 1200000, CW, 280000, 16, GOLD, bold=True)
add_text(reqs, s,
    'Target: 45+ reviews \u00b7 Velocity: 1\u20132/week \u00b7 Incentivize teachers ($25 gift card) \u00b7 Best timing: graduation window',
    ML + 40000, 1530000, CW - 40000, 400000, 15, BODY)

add_text(reqs, s, '\U0001f91d  REFERRALS', ML, 2080000, CW, 280000, 16, GOLD, bold=True)
add_text(reqs, s,
    '3 enrolled referrals in last 2 months. Gen Z parents need to be asked, given exact words, reminded. Blueprint has a tiered referral system.',
    ML + 40000, 2410000, CW - 40000, 400000, 15, BODY)

add_text(reqs, s, '\U0001f4cd  COMMUNITY PRESENCE', ML, 2960000, CW, 280000, 16, GOLD, bold=True)
add_text(reqs, s,
    'Premium flyers \u00b7 GBP cross-posts (= backlinks) \u00b7 Park activations (~$100/mo, 1\u20132 enrollments avg)\n'
    'Content coordinator at $20/hr owns all of this.',
    ML + 40000, 3290000, CW - 40000, 500000, 15, BODY)
batch_update(reqs)

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 10 — Freeing the Owner
# ═══════════════════════════════════════════════════════════════════════════════
print("Building slide 10: Freeing the Owner...")
s = SLIDES[10]
reqs = []
set_bg(reqs, s, BG)
add_text(reqs, s, '07 /', ML, MT, 400000, 280000, 13, VIOL, bold=True)
add_text(reqs, s, 'Freeing the Owner', ML, MT + 250000, CW, 420000, 32, WHITE, bold=True)
add_text(reqs, s, 'The 4-Column Task Audit', ML, 1150000, CW, 280000, 18, GOLD)

COL_W = 1850000
COL_H = 1800000
COL_Y = 1620000
for i, label in enumerate(['DIRECTOR\nDOES', 'OWNER\nDOES', 'MARKETING\nNEEDS', 'COORDINATOR\nCAN OWN']):
    cx = ML + i * (COL_W + 120000)
    add_rect(reqs, s, cx, COL_Y, COL_W, COL_H, DARK)
    add_text(reqs, s, label, cx + 80000, COL_Y + 100000, COL_W - 160000, COL_H - 160000, 16, VIOL, bold=True, align='CENTER')

add_text(reqs, s, '\U0001f393  TEACHABLE MOMENT', ML, 3650000, CW, 280000, 13, VIOL, bold=True)
add_text(reqs, s,
    'Burnt-out owners cancel subscriptions. Helping clients delegate is active retention strategy.',
    ML, 3990000, CW, 380000, 15, BODY)
batch_update(reqs)

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 11 — Paid Media
# ═══════════════════════════════════════════════════════════════════════════════
print("Building slide 11: Paid Media Strategy...")
s = SLIDES[11]
reqs = []
set_bg(reqs, s, BG)
add_text(reqs, s, '08 /', ML, MT, 400000, 280000, 13, VIOL, bold=True)
add_text(reqs, s, 'Paid Media Strategy', ML, MT + 250000, CW, 420000, 32, WHITE, bold=True)
add_text(reqs, s, 'Meta First  \u00b7  Google for the Surge', ML, 1150000, CW, 280000, 18, GOLD)

add_text(reqs, s, 'THE 4:1 CONTENT RATIO', ML, 1630000, CW, 280000, 15, VIOL, bold=True)
add_text(reqs, s,
    '4 posts Educational/PSA  +  1 post Brand. Build the path before asking for the sale.',
    ML, 1970000, CW, 320000, 16, WHITE)

add_text(reqs, s, 'TIMING ROADMAP', ML, 2450000, CW, 280000, 14, VIOL, bold=True)
add_text(reqs, s,
    'May 1    \u2192  Meta strategy + content calendar\n'
    'June 1   \u2192  Meta campaigns live\n'
    'July 4   \u2192  Peak intent \u2014 campaigns live, tested, optimized\n'
    'August  \u2192  Back-to-school conversion window',
    ML + 40000, 2780000, CW - 40000, 900000, 15, BODY, line_spacing=155)
batch_update(reqs)

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 12 — Full Stack Vision
# ═══════════════════════════════════════════════════════════════════════════════
print("Building slide 12: Full Stack Vision...")
s = SLIDES[12]
reqs = []
set_bg(reqs, s, BG)
add_text(reqs, s, '09 /', ML, MT, 400000, 280000, 13, VIOL, bold=True)
add_text(reqs, s, 'The Full Stack Vision', ML, MT + 250000, CW, 420000, 32, WHITE, bold=True)
add_text(reqs, s, 'How everything compounds together', ML, 1150000, CW, 280000, 18, GOLD)

STACKS = [
    (1620000, '\U0001f3d7  DFY ADVANCED SEO  \u2192  The Foundation', 'Organic ranking. Long-term compounding asset. The engine that keeps delivering even when ad budgets pause.'),
    (2320000, '\U0001f4e3  BLUEPRINT  \u2192  The Amplifier', 'Client-operated engine. When clients implement Blueprint, SEO accelerates and brand presence compounds.'),
    (3020000, '\U0001f680  PAID MEDIA  \u2192  The Accelerator', 'Fills the pipeline immediately. Meta builds awareness; Google captures intent at the July surge.'),
    (3720000, '\U0001f310  WEBSITE  \u2192  The Converter', 'Where all channels send traffic. This is where parents decide to book a tour.'),
]
for y, label, body_text in STACKS:
    add_rect(reqs, s, ML, y, CW, 560000, DARK)
    add_text(reqs, s, label, ML + 120000, y + 70000, CW - 240000, 220000, 15, GOLD, bold=True)
    add_text(reqs, s, body_text, ML + 120000, y + 300000, CW - 240000, 220000, 14, BODY)
batch_update(reqs)

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 13 — Growth Advisor Playbook
# ═══════════════════════════════════════════════════════════════════════════════
print("Building slide 13: Growth Advisor Playbook...")
s = SLIDES[13]
reqs = []
set_bg(reqs, s, BG)
add_text(reqs, s, '10 /', ML, MT, 400000, 280000, 13, VIOL, bold=True)
add_text(reqs, s, 'The Growth Advisor Playbook', ML, MT + 250000, CW, 420000, 32, WHITE, bold=True)

COL_W = 2500000
COLS = [
    (ML, 'BEFORE\nEVERY MEETING',
     'Review SEO metrics\nCheck the enrollment calendar\nKnow which services they have\nIdentify the bottleneck'),
    (ML + COL_W + 200000, 'IN EVERY\nMEETING',
     'Open by asking how they feel\nValidate \u2192 Contextualize \u2192 Redirect\nConnect recs to enrollment outcomes\nTAKE COPIOUS NOTES'),
    (ML + (COL_W + 200000) * 2, 'AFTER\nEVERY MEETING',
     'Document next steps + owners\nFlag upsell opps within 24h\nUpdate GHL record'),
]
for cx, header, body_text in COLS:
    add_text(reqs, s, header, cx, 1150000, COL_W, 380000, 16, GOLD, bold=True)
    add_rect(reqs, s, cx, 1650000, COL_W, 2800000, DARK)
    add_text(reqs, s, body_text, cx + 100000, 1750000, COL_W - 200000, 2600000, 15, BODY, line_spacing=155)
batch_update(reqs)

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 14 — Bruce's 10 Principles
# ═══════════════════════════════════════════════════════════════════════════════
print("Building slide 14: Bruce's 10 Principles...")
s = SLIDES[14]
reqs = []
set_bg(reqs, s, BG)
add_rect(reqs, s, 0, 0, W, 560000, PURP)
add_text(reqs, s, "BRUCE\u2019S 10 PRINCIPLES", ML, 100000, CW, 320000, 28, WHITE, bold=True, align='CENTER')
add_text(reqs, s, 'The philosophy behind the playbook', ML, 480000, CW, 250000, 15, GOLD, align='CENTER')

LEFT_P = (
    '01  Own your mistakes before the client brings them up. Lead with it. Be brief.\n\n'
    '02  Validate \u2192 Contextualize \u2192 Redirect. Always. Never skip the first two.\n\n'
    '03  Blueprint is not a discount. It\u2019s an alignment tool and a retention investment.\n\n'
    '04  Know the enrollment calendar. Setup is March\u2013May. The push is July 4th.\n\n'
    '05  Burnt-out owners cancel. Helping clients delegate is retention strategy.'
)
RIGHT_P = (
    '06  4:1 content ratio. Build the path before asking for the sale.\n\n'
    '07  Reviews: 4.8\u2605 is the magic number. Velocity over volume.\n\n'
    '08  Speed is a multiplier. First to call back wins by 4\u20136\u00d7.\n\n'
    '09  The full stack compounds. Every layer multiplies the others.\n\n'
    '10  Dream clients ask for help. Give them Blueprint. Give them your best.'
)
add_text(reqs, s, LEFT_P, ML, 920000, HALF, 4000000, 14, BODY, line_spacing=150)
add_text(reqs, s, RIGHT_P, COL2, 920000, HALF, 4000000, 14, BODY, line_spacing=150)
batch_update(reqs)

# ═══════════════════════════════════════════════════════════════════════════════
# Verify
# ═══════════════════════════════════════════════════════════════════════════════
print("\nVerifying final slide count...")
pres_final = service.presentations().get(presentationId=PRES_ID).execute()
final_count = len(pres_final['slides'])
print(f"  Total slides: {final_count}")

if final_count == 14:
    print("\n\u2705 SUCCESS \u2014 14 slides built cleanly")
    print(f"   URL: https://docs.google.com/presentation/d/{PRES_ID}/edit")
else:
    print(f"\n\u26a0\ufe0f  Expected 14 slides, got {final_count}")
