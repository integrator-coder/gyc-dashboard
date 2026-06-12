#!/usr/bin/env python3
"""
Google Ads Sync Script
Pulls last 30 days vs previous 30 days for all ENABLED accounts under MCC 4782502607
Upserts results into the GoogleAdsAccount table via POST to /api/google-ads/sync
Resume-safe — picks up where it left off
Designed to run nightly via cron
"""

import os
import sys
import yaml
import requests
from datetime import datetime, timedelta
from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException

# Configuration
GOOGLE_ADS_YAML = os.path.join(os.path.dirname(__file__), '..', 'google-ads.yaml')
API_ENDPOINT = 'http://localhost:3000/api/google-ads/sync'
MCC_CUSTOMER_ID = '4782502607'

def load_client():
    """Load Google Ads client from google-ads.yaml"""
    if not os.path.exists(GOOGLE_ADS_YAML):
        print(f'❌ Google Ads config not found: {GOOGLE_ADS_YAML}')
        sys.exit(1)
    
    return GoogleAdsClient.load_from_storage(GOOGLE_ADS_YAML)

def get_enabled_accounts(client, mcc_id):
    """Get all enabled customer accounts under the MCC"""
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
        print(f'❌ Error fetching accounts: {ex}')
        return []

def get_account_metrics(client, customer_id, start_date, end_date):
    """Get metrics for a single account for the given date range"""
    ga_service = client.get_service("GoogleAdsService")
    
    query = f"""
        SELECT
          metrics.cost_micros,
          metrics.clicks,
          metrics.impressions,
          metrics.ctr
        FROM campaign
        WHERE segments.date BETWEEN '{start_date}' AND '{end_date}'
    """
    
    try:
        response = ga_service.search(customer_id=customer_id, query=query)
        
        total_cost = 0
        total_clicks = 0
        total_impressions = 0
        
        for row in response:
            total_cost += row.metrics.cost_micros / 1_000_000  # Convert micros to dollars
            total_clicks += row.metrics.clicks
            total_impressions += row.metrics.impressions
        
        cpc = total_cost / total_clicks if total_clicks > 0 else 0
        ctr = (total_clicks / total_impressions * 100) if total_impressions > 0 else 0
        
        return {
            'cost': total_cost,
            'clicks': total_clicks,
            'impressions': total_impressions,
            'cpc': cpc,
            'ctr': ctr
        }
    except GoogleAdsException as ex:
        print(f'  ⚠️  Error fetching metrics for {customer_id}: {ex}')
        return None

def calculate_change(curr, prev):
    """Calculate percentage change between current and previous"""
    if prev == 0:
        return None
    return ((curr - prev) / prev) * 100

def sync_account_to_api(account_data):
    """POST account data to the API sync endpoint"""
    try:
        response = requests.post(API_ENDPOINT, json={'accounts': [account_data]}, timeout=30)
        response.raise_for_status()
        return True
    except Exception as ex:
        print(f'  ❌ API sync error: {ex}')
        return False

def main():
    print('📊 Google Ads Sync Starting...\n')
    
    # Date ranges: last 30 days vs prior 30 days
    today = datetime.now().date()
    curr_end = today - timedelta(days=1)
    curr_start = curr_end - timedelta(days=29)
    prev_end = curr_start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=29)
    
    print(f'Current period: {curr_start} to {curr_end}')
    print(f'Previous period: {prev_start} to {prev_end}\n')
    
    # Load client
    client = load_client()
    print(f'✓ Loaded Google Ads client\n')
    
    # Get all enabled accounts
    print(f'Fetching accounts under MCC {MCC_CUSTOMER_ID}...')
    accounts = get_enabled_accounts(client, MCC_CUSTOMER_ID)
    print(f'✓ Found {len(accounts)} enabled accounts\n')
    
    synced = 0
    errors = 0
    all_account_data = []
    
    for i, account in enumerate(accounts, 1):
        print(f'[{i}/{len(accounts)}] {account["name"]} ({account["id"]})')
        
        # Get current period metrics
        curr_metrics = get_account_metrics(client, account['id'], curr_start.strftime('%Y-%m-%d'), curr_end.strftime('%Y-%m-%d'))
        if not curr_metrics:
            errors += 1
            continue
        
        # Get previous period metrics
        prev_metrics = get_account_metrics(client, account['id'], prev_start.strftime('%Y-%m-%d'), prev_end.strftime('%Y-%m-%d'))
        if not prev_metrics:
            errors += 1
            continue
        
        # Calculate changes
        cpc_change = calculate_change(curr_metrics['cpc'], prev_metrics['cpc'])
        clicks_change = calculate_change(curr_metrics['clicks'], prev_metrics['clicks'])
        impressions_change = calculate_change(curr_metrics['impressions'], prev_metrics['impressions'])
        
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
        
        # Prepare API payload
        account_data = {
            'accountId': account['id'],
            'accountName': account['name'],
            'currSpend': curr_metrics['cost'],
            'currClicks': curr_metrics['clicks'],
            'currImpressions': curr_metrics['impressions'],
            'currCpc': curr_metrics['cpc'],
            'currCtr': curr_metrics['ctr'],
            'prevSpend': prev_metrics['cost'],
            'prevClicks': prev_metrics['clicks'],
            'prevImpressions': prev_metrics['impressions'],
            'prevCpc': prev_metrics['cpc'],
            'cpcChange': cpc_change,
            'clicksChange': clicks_change,
            'impressionsChange': impressions_change,
            'flagged': flagged,
            'flags': flags
        }
        
        # Sync to API
        if sync_account_to_api(account_data):
            synced += 1
            all_account_data.append(account_data)
            print(f'  ✓ Synced')
        else:
            errors += 1
        
        print()
    
    # Update monthly snapshot for current month
    if all_account_data:
        print('\nUpdating monthly snapshot...')
        month_key = today.strftime('%Y-%m')
        month_label = today.strftime('%b %Y')
        
        total_spend = sum(a['currSpend'] for a in all_account_data)
        total_clicks = sum(a['currClicks'] for a in all_account_data)
        total_impressions = sum(a['currImpressions'] for a in all_account_data)
        active_count = len([a for a in all_account_data if a['currClicks'] > 0])
        avg_cpc = total_spend / total_clicks if total_clicks > 0 else 0
        
        monthly_data = {
            'monthKey': month_key,
            'monthLabel': month_label,
            'isPartial': True,
            'spend': total_spend,
            'clicks': total_clicks,
            'impressions': total_impressions,
            'avgCpc': avg_cpc,
            'accountCount': active_count,
        }
        
        try:
            dashboard_url = os.environ.get('DASHBOARD_URL', 'http://localhost:3000')
            response = requests.post(f'{dashboard_url}/api/google-ads/sync-monthly', json=monthly_data, timeout=30)
            response.raise_for_status()
            print(f'✓ Updated monthly snapshot for {month_label}')
        except Exception as ex:
            print(f'⚠️  Failed to update monthly snapshot: {ex}')
    
    print(f'\n✅ Sync complete!')
    print(f'   Synced: {synced}')
    print(f'   Errors: {errors}')

if __name__ == '__main__':
    main()
