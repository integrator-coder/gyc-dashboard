#!/usr/bin/env python3
"""
Rebuild all 3 charts in the GYC CEO Revenue Report with brand colors.
"""
import json
import urllib.parse
import requests
import warnings
warnings.filterwarnings("ignore")

from google.oauth2 import service_account
from googleapiclient.discovery import build

CREDS_FILE = "/Users/toddthejedigmail.com/.openclaw/credentials/google-console.json"
DOC_ID = "15scnaOycWILyC3OHQTEsv--9vfF47sxlJNR0Pi4VSNQ"

# Brand colors
VIOLET_MED = "#731494"
VIOLET_DEEP = "#340B67"
GOLD = "#C19C46"
GRAY = "#6b7280"

def get_creds():
    return service_account.Credentials.from_service_account_file(
        CREDS_FILE,
        scopes=[
            "https://www.googleapis.com/auth/documents",
            "https://www.googleapis.com/auth/drive"
        ]
    )

def get_quickchart_url(config):
    """Build a QuickChart URL. Fall back to a short URL when needed for Docs API."""
    compact = json.dumps(config, separators=(',', ':'))
    encoded = urllib.parse.quote(compact)
    direct_url = f"https://quickchart.io/chart?c={encoded}&backgroundColor=white&width=960&height=440"
    print(f"  Direct QuickChart URL length: {len(direct_url)} chars")

    if len(direct_url) <= 1900:
        resp = requests.get(direct_url, timeout=30)
        if resp.status_code == 200 and not resp.headers.get('content-type', '').startswith('text'):
            print(f"  Direct chart OK ({resp.status_code}, {len(resp.content)} bytes)")
            return direct_url
        print(f"  Direct URL check failed, trying short URL...")

    resp = requests.post(
        'https://quickchart.io/chart/create',
        json={
            'chart': config,
            'backgroundColor': 'white',
            'width': 960,
            'height': 440,
        },
        timeout=30,
    )
    resp.raise_for_status()
    short_url = resp.json()['url']
    print(f"  Short QuickChart URL length: {len(short_url)} chars")
    verify = requests.get(short_url, timeout=30)
    if verify.status_code != 200 or verify.headers.get('content-type', '').startswith('text'):
        raise RuntimeError(f"QuickChart short URL failed: {verify.status_code} {verify.headers.get('content-type')}")
    print(f"  Short chart OK ({verify.status_code}, {len(verify.content)} bytes)")
    return short_url

def find_paragraph_end(content, search_text):
    """Find the endIndex of a paragraph containing the given text."""
    for elem in content:
        if "paragraph" in elem:
            para = elem["paragraph"]
            text = ""
            for pe in para.get("elements", []):
                if "textRun" in pe:
                    text += pe["textRun"].get("content", "")
            if search_text in text:
                # Return the index just before the trailing newline
                # so we insert BEFORE the \n (last char of para)
                end_idx = elem.get("endIndex", 0)
                return end_idx - 1  # Insert before the final \n
    return None

def main():
    creds = get_creds()
    docs = build("docs", "v1", credentials=creds)

    # ─── STEP 1: Find existing inline images ───────────────────────────────
    print("Step 1: Reading doc to find inline images...")
    doc = docs.documents().get(documentId=DOC_ID).execute()
    content = doc.get("body", {}).get("content", [])

    inline_images = []
    for elem in content:
        if "paragraph" in elem:
            for pe in elem["paragraph"].get("elements", []):
                if "inlineObjectElement" in pe:
                    start = pe["startIndex"]
                    end = pe["endIndex"]
                    inline_images.append({"startIndex": start, "endIndex": end})

    # Sort descending by startIndex to delete without shifting lower indices
    inline_images.sort(key=lambda x: x["startIndex"], reverse=True)
    print(f"  Found {len(inline_images)} inline images: {inline_images}")

    # ─── STEP 2: Delete all existing images ────────────────────────────────
    print("\nStep 2: Deleting existing chart images...")
    delete_requests = [
        {
            "deleteContentRange": {
                "range": {
                    "startIndex": img["startIndex"],
                    "endIndex": img["endIndex"]
                }
            }
        }
        for img in inline_images
    ]
    if delete_requests:
        docs.documents().batchUpdate(
            documentId=DOC_ID,
            body={"requests": delete_requests}
        ).execute()
    print(f"  Deleted {len(delete_requests)} images.")

    # ─── STEP 3: Build QuickChart URLs ─────────────────────────────────────
    print("\nStep 3: Building chart images via QuickChart...")

    # Chart 1: Annual Revenue Trend
    print("  Building Chart 1 (Annual Revenue)...")
    chart1 = {
        "type": "bar",
        "data": {
            "labels": ["2023", "2024", "2025", "2026 Base", "2026 Target"],
            "datasets": [{
                "label": "Revenue ($ millions)",
                "data": [3.476, 3.803, 3.730, 3.550, 4.200],
                "backgroundColor": [VIOLET_MED, VIOLET_MED, VIOLET_MED, GOLD, VIOLET_DEEP],
                "borderColor": [VIOLET_MED, VIOLET_MED, VIOLET_MED, GOLD, VIOLET_DEEP],
                "borderWidth": 1
            }]
        },
        "options": {
            "title": {
                "display": True,
                "text": ["GYC Annual Revenue \u2014 2023\u20132026", "($ millions)"],
                "fontColor": "#111111",
                "fontSize": 15,
                "fontStyle": "bold"
            },
            "legend": {"display": False},
            "scales": {
                "yAxes": [{
                    "ticks": {
                        "min": 0,
                        "max": 5.0,
                        "stepSize": 1.0,
                        "fontColor": "#444444"
                    },
                    "gridLines": {"color": "#eeeeee"},
                    "scaleLabel": {"display": True, "labelString": "Revenue ($ millions)", "fontColor": "#666666"}
                }],
                "xAxes": [{
                    "ticks": {"fontColor": "#444444"},
                    "gridLines": {"display": False}
                }]
            },
            "layout": {"padding": {"top": 5, "bottom": 5, "left": 10, "right": 10}}
        }
    }
    chart1_url = get_quickchart_url(chart1)

    # Chart 2: PIF-to-MRR Pipeline
    print("  Building Chart 2 (PIF Pipeline)...")
    chart2 = {
        "type": "bar",
        "data": {
            "labels": ["Jan 2026", "Feb 2026", "Apr 2026", "May 2026", "Aug 2026", "Sep 2026"],
            "datasets": [{
                "label": "New Monthly MRR ($)",
                "data": [2620, 8301, 4196, 1499, 765, 699],
                "backgroundColor": [GOLD, GOLD, VIOLET_MED, VIOLET_MED, VIOLET_MED, VIOLET_MED],
                "borderColor": [GOLD, GOLD, VIOLET_MED, VIOLET_MED, VIOLET_MED, VIOLET_MED],
                "borderWidth": 1
            }]
        },
        "options": {
            "title": {
                "display": True,
                "text": ["PIF Deals Converting to Monthly MRR \u2014 2026", "Gold = Captured  |  Violet = Scheduled"],
                "fontColor": "#111111",
                "fontSize": 15,
                "fontStyle": "bold"
            },
            "legend": {"display": False},
            "scales": {
                "yAxes": [{
                    "ticks": {
                        "beginAtZero": True,
                        "fontColor": "#444444"
                    },
                    "gridLines": {"color": "#eeeeee"},
                    "scaleLabel": {"display": True, "labelString": "New Monthly MRR ($)", "fontColor": "#666666"}
                }],
                "xAxes": [{
                    "ticks": {"fontColor": "#444444"},
                    "gridLines": {"display": False}
                }]
            },
            "layout": {"padding": {"top": 5, "bottom": 5, "left": 10, "right": 10}}
        }
    }
    chart2_url = get_quickchart_url(chart2)

    # Chart 3: MRR Trajectory (May–Dec 2026)
    print("  Building Chart 3 (MRR Trajectory)...")
    chart3 = {
        "type": "line",
        "data": {
            "labels": ["May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
            "datasets": [
                {
                    "label": "Base Case",
                    "data": [218, 222, 226, 231, 235, 240, 244, 248],
                    "borderColor": VIOLET_MED,
                    "backgroundColor": "transparent",
                    "borderWidth": 2.5,
                    "pointBackgroundColor": VIOLET_MED,
                    "pointRadius": 4,
                    "fill": False
                },
                {
                    "label": "Target Case",
                    "data": [225, 240, 258, 273, 285, 298, 310, 325],
                    "borderColor": GOLD,
                    "backgroundColor": "transparent",
                    "borderWidth": 2.5,
                    "pointBackgroundColor": GOLD,
                    "pointRadius": 4,
                    "fill": False
                },
                {
                    "label": "Current MRR ($213K)",
                    "data": [213, 213, 213, 213, 213, 213, 213, 213],
                    "borderColor": GRAY,
                    "backgroundColor": "transparent",
                    "borderDash": [6, 4],
                    "borderWidth": 1.5,
                    "pointRadius": 0,
                    "fill": False
                }
            ]
        },
        "options": {
            "title": {
                "display": True,
                "text": ["MRR Growth Trajectory \u2014 May to December 2026", "($ thousands/month)"],
                "fontColor": "#111111",
                "fontSize": 15,
                "fontStyle": "bold"
            },
            "legend": {
                "display": True,
                "position": "bottom",
                "labels": {"fontColor": "#444444", "usePointStyle": True}
            },
            "scales": {
                "yAxes": [{
                    "ticks": {
                        "min": 150,
                        "max": 360,
                        "stepSize": 50,
                        "fontColor": "#444444"
                    },
                    "gridLines": {"color": "#eeeeee"},
                    "scaleLabel": {"display": True, "labelString": "MRR ($K/month)", "fontColor": "#666666"}
                }],
                "xAxes": [{
                    "ticks": {"fontColor": "#444444"},
                    "gridLines": {"display": False}
                }]
            },
            "layout": {"padding": {"top": 5, "bottom": 5, "left": 10, "right": 10}}
        }
    }
    chart3_url = get_quickchart_url(chart3)

    # ─── STEP 4: Find insertion positions ──────────────────────────────────
    print("\nStep 4: Finding insertion positions...")
    doc = docs.documents().get(documentId=DOC_ID).execute()
    content = doc.get("body", {}).get("content", [])

    # Chart 1: after the "| 2026 (pace) |" row (last revenue table row)
    pos1 = find_paragraph_end(content, "2026 (pace)")
    # Chart 2: after the "| **Total** | **16**" row (last PIF table row)
    pos2 = find_paragraph_end(content, "**Total**")
    # Chart 3: in the "LOOKING AT 2027" paragraph (insert at end, before \n)
    pos3 = find_paragraph_end(content, "LOOKING AT 2027")

    print(f"  Chart 1 insertion index: {pos1}")
    print(f"  Chart 2 insertion index: {pos2}")
    print(f"  Chart 3 insertion index: {pos3}")

    if not all([pos1, pos2, pos3]):
        raise ValueError("Could not find all insertion positions!")

    # ─── STEP 5: Insert new charts ─────────────────────────────────────────
    print("\nStep 5: Inserting new charts...")

    # Size: 480pt x 220pt (using PT units as required by Docs API)
    width_pt = 480
    height_pt = 220

    # Must insert lowest index first (each insert shifts subsequent positions)
    positions = sorted([
        (pos1, chart1_url, "Chart 1"),
        (pos2, chart2_url, "Chart 2"),
        (pos3, chart3_url, "Chart 3"),
    ], key=lambda x: x[0])

    insert_requests = []
    offset = 0
    for pos, url, name in positions:
        adjusted_pos = pos + offset
        print(f"  Inserting {name} at index {adjusted_pos} (original {pos})")
        insert_requests.append({
            "insertInlineImage": {
                "location": {"index": adjusted_pos},
                "uri": url,
                "objectSize": {
                    "height": {"magnitude": height_pt, "unit": "PT"},
                    "width": {"magnitude": width_pt, "unit": "PT"}
                }
            }
        })
        offset += 1  # Each insertion shifts subsequent indices by 1

    docs.documents().batchUpdate(
        documentId=DOC_ID,
        body={"requests": insert_requests}
    ).execute()

    print("\n✅ All 3 charts rebuilt and inserted successfully!")
    print(f"\nDoc link: https://docs.google.com/document/d/{DOC_ID}/edit")

if __name__ == "__main__":
    main()
