#!/usr/bin/env python3
"""
Generate Google Ads analysis JSON with all accounts
This creates the /tmp/gyc_ads_analysis.json file that seed-google-ads-full.js needs
"""

import os
import sys
import json
from datetime import datetime, timedelta
from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException

GOOGLE_ADS_YAML = os.path.join(os.path.dirname(__file__), '..', 'google-ads.yaml')
MCC_CUSTOMER_ID = '4782502607'

def load_client():
    """Load Google Ads client"""
    if not os.path.exists(GOOGLE_ADS_YAML):
        print(f'❌ Config not found: {GOOGLE_ADS_YAML}')
        sys.exit(1)
    return GoogleAdsClient.load_from_storage(GOOGLE_ADS_YAML)

def get_enabled_accounts(client, mcc_id):
    """Get all enabled accounts"""
    ga_service = client.get_service("GoogleAdsService")
    
    query = """
        SELECT
          customer_client.id,
          customer_client.descriptive_name,
          customer_client.status
        FROM customer_client
        WHERE customer_client.status = 'ENABLED'
    """
    
    try:
        response = ga_service.search(customer_id=mcc_id, query=query)
        accounts = []
        for row in response:
            accounts.append({
                'id': str(row.customer_client.id),
                'name': row.customer_client.descriptive_name
            })
        return accounts
    except GoogleAdsException as ex:
        print(f'❌ Error: {ex}')
        return []

def get_account_metrics(client, customer_id, start_date, end_date):
    """Get metrics for date range"""
    ga_service = client.get_service("GoogleAdsService")
    
    query = f"""
        SELECT
          metrics.cost_micros,
          metrics.clicks,
          metrics.impressions
        FROM campaign
        WHERE segments.date BETWEEN '{start_date}' AND '{end_date}'
    """
    
    try:
        response = ga_service.search(customer_id=customer_id, query=query)
        
        total_cost = 0
        total_clicks = 0
        total_impressions = 0
        
        for row in response:
            total_cost += row.metrics.cost_micros / 1_000_000
            total_clicks += row.metrics.clicks
            total_impressions += row.metrics.impressions
        
        cpc = total_cost / total_clicks if total_clicks > 0 else 0
        
        return {
            'cost': total_cost,
            'clicks': total_clicks,
            'impressions': total_impressions,
            'cpc': cpc
        }
    except GoogleAdsException:
        return None

def main():
    print('📊 Generating Google Ads analysis...\n')
    
    # Date ranges
    today = datetime.now().date()
    curr_end = today - timedelta(days=1)
    curr_start = curr_end - timedelta(days=29)
    prev_end = curr_start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=29)
    
    print(f'Current: {curr_start} to {curr_end}')
    print(f'Previous: {prev_start} to {prev_end}\n')
    
    client = load_client()
    accounts = get_enabled_accounts(client, MCC_CUSTOMER_ID)
    print(f'✓ Found {len(accounts)} enabled accounts\n')
    
    all_accounts = []
    flagged_accounts = []
    
    for i, account in enumerate(accounts, 1):
        print(f'[{i}/{len(accounts)}] {account["name"]}')
        
        curr = get_account_metrics(client, account['id'], curr_start.strftime('%Y-%m-%d'), curr_end.strftime('%Y-%m-%d'))
        prev = get_account_metrics(client, account['id'], prev_start.strftime('%Y-%m-%d'), prev_end.strftime('%Y-%m-%d'))
        
        if not curr or not prev:
            print('  ⚠️  Skipped')
            continue
        
        # Calculate changes
        cpc_change = ((curr['cpc'] - prev['cpc']) / prev['cpc'] * 100) if prev['cpc'] > 0 else None
        clicks_change = ((curr['clicks'] - prev['clicks']) / prev['clicks'] * 100) if prev['clicks'] > 0 else None
        impressions_change = ((curr['impressions'] - prev['impressions']) / prev['impressions'] * 100) if prev['impressions'] > 0 else None
        
        # Determine flags
        flags = []
        flagged = False
        
        if cpc_change and cpc_change > 100:
            flags.append(f'CPC up {int(cpc_change)}%')
            flagged = True
        elif cpc_change and cpc_change > 50:
            flags.append(f'CPC up {int(cpc_change)}%')
            flagged = True
        elif cpc_change and cpc_change > 20:
            flags.append(f'CPC up {int(cpc_change)}%')
            flagged = True
        
        if clicks_change and clicks_change < -30:
            flags.append(f'Clicks down {int(abs(clicks_change))}%')
            flagged = True
        
        if impressions_change and impressions_change < -30:
            flags.append(f'Impressions down {int(abs(impressions_change))}%')
            flagged = True
        
        account_data = {
            'id': account['id'],
            'name': account['name'],
            'curr_cost': curr['cost'],
            'curr_clicks': curr['clicks'],
            'curr_impressions': curr['impressions'],
            'curr_cpc': curr['cpc'],
            'prev_clicks': prev['clicks'],
            'prev_impressions': prev['impressions'],
            'prev_cpc': prev['cpc'],
            'cpc_change': cpc_change,
            'clicks_change': clicks_change,
            'impressions_change': impressions_change,
            'flagged': flagged,
            'flags': flags
        }
        
        all_accounts.append(account_data)
        if flagged:
            flagged_accounts.append(account_data)
        
        print(f'  ✓ {"⚠️ FLAGGED" if flagged else "OK"}')
    
    # Save to JSON
    output = {
        'all': all_accounts,
        'flagged': flagged_accounts,
        'summary': {
            'total': len(all_accounts),
            'flagged': len(flagged_accounts),
            'generated': datetime.now().isoformat()
        }
    }
    
    with open('/tmp/gyc_ads_analysis.json', 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f'\n✅ Saved {len(all_accounts)} accounts to /tmp/gyc_ads_analysis.json')
    print(f'   Flagged: {len(flagged_accounts)}')

if __name__ == '__main__':
    main()
