"""
Fetches top financial news from Finnhub, then asks Claude to write a
5-sentence market-sentiment summary. Saves result to public/market-summary.json.

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

def fetch_news():
    url = f'https://finnhub.io/api/v1/news?category=general&token={FINNHUB_KEY}'
    r = requests.get(url, timeout=15)
    r.raise_for_status()
    items = r.json()[:20]
    return [f"- {item['headline']} ({item['source']})" for item in items if item.get('headline')]

def generate_summary(headlines):
    client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)
    news_block = '\n'.join(headlines)
    prompt = f"""You are a concise financial analyst. Based on these recent market news headlines, write exactly 5 sentences covering:
1. Overall market mood/sentiment
2. Key macro events or economic data driving the market
3. Notable sector or stock movements
4. Risk factors or concerns investors are watching
5. Short-term outlook

Be factual, specific, and direct. No bullet points — just 5 flowing sentences as a paragraph.

Recent headlines:
{news_block}"""

    message = client.messages.create(
        model='claude-opus-4-7',
        max_tokens=700,
        thinking={'type': 'adaptive'},
        messages=[{'role': 'user', 'content': prompt}],
    )
    # Extract the text block (skip thinking blocks)
    for block in message.content:
        if block.type == 'text':
            return block.text.strip()
    raise ValueError('No text in Claude response')

if __name__ == '__main__':
    try:
        print('Fetching news headlines...')
        headlines = fetch_news()
        print(f'Got {len(headlines)} headlines')

        print('Calling Claude API...')
        summary = generate_summary(headlines)
        print(f'Summary:\n{summary}')

        out = {
            'summary': summary,
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
