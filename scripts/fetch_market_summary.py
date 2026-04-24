"""
Fetches top financial news from Finnhub + VIX from Yahoo Finance,
then asks Claude to write a 5-sentence market-sentiment summary.
Saves result to public/market-summary.json.

Required env vars:
  ANTHROPIC_API_KEY
  FINNHUB_KEY
"""
import json
import os
import sys
from datetime import datetime, timezone

import anthropic
import requests

FINNHUB_KEY = os.environ['FINNHUB_KEY']
ANTHROPIC_KEY = os.environ['ANTHROPIC_API_KEY']

HEADERS = {'User-Agent': 'Mozilla/5.0 (compatible; stock-dashboard/1.0)'}


def fetch_vix():
    url = 'https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=1d'
    r = requests.get(url, headers=HEADERS, timeout=15)
    r.raise_for_status()
    data = r.json()
    price = data['chart']['result'][0]['meta']['regularMarketPrice']
    return round(float(price), 2)


def fetch_news():
    url = f'https://finnhub.io/api/v1/news?category=general&token={FINNHUB_KEY}'
    r = requests.get(url, timeout=15)
    r.raise_for_status()
    items = r.json()[:20]
    return [f"- {item['headline']} ({item['source']})" for item in items if item.get('headline')]


def generate_summary(headlines):
    client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)
    news_block = '\n'.join(headlines)
    prompt = (
        "You are a concise financial analyst. Based on these recent market news headlines, "
        "write exactly 5 sentences as a single paragraph covering: overall market mood, "
        "key macro events driving the market, notable sector or stock movements, "
        "main risk factors investors are watching, and the short-term outlook. "
        "Be factual, specific, and direct. No bullet points.\n\n"
        f"Recent headlines:\n{news_block}"
    )
    message = client.messages.create(
        model='claude-sonnet-4-6',
        max_tokens=700,
        messages=[{'role': 'user', 'content': prompt}],
    )
    return message.content[0].text.strip()


if __name__ == '__main__':
    try:
        print('Fetching VIX...')
        vix = fetch_vix()
        print(f'VIX: {vix}')

        print('Fetching news headlines...')
        headlines = fetch_news()
        print(f'Got {len(headlines)} headlines')

        print('Calling Claude API...')
        summary = generate_summary(headlines)
        print(f'Summary:\n{summary}')

        out = {
            'summary': summary,
            'vix': vix,
            'updatedAt': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        }
        path = 'public/market-summary.json'
        with open(path, 'w') as f:
            json.dump(out, f, indent=2)
        print(f'\nSaved to {path}')
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f'ERROR: {e}', file=sys.stderr)
        sys.exit(1)
