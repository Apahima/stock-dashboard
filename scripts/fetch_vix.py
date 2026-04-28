"""Fetches VIX from Yahoo Finance and saves to public/vix.json."""
import json, sys
from datetime import datetime, timezone
import requests

HEADERS = {'User-Agent': 'Mozilla/5.0 (compatible; stock-dashboard/1.0)'}

def fetch_vix():
    url = 'https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=1d'
    r = requests.get(url, headers=HEADERS, timeout=15)
    r.raise_for_status()
    meta = r.json()['chart']['result'][0]['meta']
    return {
        'value':     round(float(meta['regularMarketPrice']), 2),
        'updatedAt': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    }

if __name__ == '__main__':
    try:
        data = fetch_vix()
        with open('public/vix.json', 'w') as f:
            json.dump(data, f, indent=2)
        print(f"VIX: {data['value']} — saved to public/vix.json")
    except Exception as e:
        import traceback; traceback.print_exc()
        print(f'ERROR: {e}', file=sys.stderr)
        sys.exit(1)
