#!/usr/bin/env python3
"""
Pull 6 months of monthly aggregate Google Ads data
Samples first 50 accounts and scales to estimate full portfolio
"""

import sys, warnings, json
warnings.filterwarnings('ignore')
sys.path.insert(0, '/Users/toddthejedigmail.com/Library/Python/3.9/lib/python/site-packages')
from google.ads.googleads.client import GoogleAdsClient
from datetime import date, timedelta
import calendar

client = GoogleAdsClient.load_from_storage('/Users/toddthejedigmail.com/.openclaw/workspace/gyc-dashboard/google-ads.yaml')
ga = client.get_service('GoogleAdsService')

# Get all enabled accounts
customer_query = """
    SELECT customer_client.client_customer, customer_client.descriptive_name
    FROM customer_client
    WHERE customer_client.manager = False AND customer_client.status = 'ENABLED'
"""
response = ga.search(customer_id='4782502607', query=customer_query)
accounts = [(row.customer_client.client_customer.split('/')[-1], row.customer_client.descriptive_name) for row in response]

print(f'Found {len(accounts)} accounts. Sampling first 50 for speed.')

# Pull monthly aggregates for last 6 months
monthly_data = []
today = date.today()

for months_ago in range(5, -1, -1):  # 5 months ago to current
    year = today.year
    month = today.month - months_ago
    while month <= 0:
        month += 12
        year -= 1
    
    first_day = date(year, month, 1)
    last_day = date(year, month, calendar.monthrange(year, month)[1])
    if last_day > today:
        last_day = today
    
    total_cost = 0
    total_clicks = 0
    total_impressions = 0
    active = 0
    
    sample_size = min(50, len(accounts))
    print(f'\nProcessing {first_day.strftime("%b %Y")} (sampling {sample_size} accounts)...')
    
    for cid, name in accounts[:sample_size]:
        query = f"""
            SELECT metrics.cost_micros, metrics.clicks, metrics.impressions
            FROM customer
            WHERE segments.date BETWEEN '{first_day}' AND '{last_day}'
        """
        try:
            resp = ga.search(customer_id=cid, query=query)
            for row in resp:
                if row.metrics.clicks > 0:
                    total_cost += row.metrics.cost_micros / 1_000_000
                    total_clicks += row.metrics.clicks
                    total_impressions += row.metrics.impressions
                    active += 1
                    break
        except Exception as e:
            pass
    
    # Scale up from sample to full account count
    scale = len(accounts) / sample_size
    scaled_cost = total_cost * scale
    scaled_clicks = int(total_clicks * scale)
    scaled_impressions = int(total_impressions * scale)
    avg_cpc = (scaled_cost / scaled_clicks) if scaled_clicks > 0 else 0
    
    monthly_data.append({
        'month': first_day.strftime('%b %Y'),
        'monthKey': first_day.strftime('%Y-%m'),
        'spend': round(scaled_cost, 2),
        'clicks': scaled_clicks,
        'impressions': scaled_impressions,
        'avgCpc': round(avg_cpc, 2)
    })
    
    print(f'  Total: ${scaled_cost:,.0f} spend, {scaled_clicks:,} clicks, {scaled_impressions:,} impressions, ${avg_cpc:.2f} CPC')

with open('/tmp/gyc_ads_monthly.json', 'w') as f:
    json.dump(monthly_data, f, indent=2)

print(f'\n✅ Saved 6 months of data to /tmp/gyc_ads_monthly.json')
print('\nData summary:')
for month in monthly_data:
    print(f'  {month["month"]}: ${month["spend"]:,.0f} / {month["clicks"]:,} clicks / ${month["avgCpc"]:.2f} CPC')
