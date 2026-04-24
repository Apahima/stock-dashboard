"""
Fetches AAII weekly sentiment data using a headless browser (Playwright)
so that JavaScript-rendered content is fully available.
"""
import json
import re
import sys
from datetime import datetime

from playwright.sync_api import sync_playwright

HISTORICAL_AVG = {'bullish': 37.5, 'neutral': 31.5, 'bearish': 31.0}


def pct(s):
    return round(float(str(s).strip().replace('%', '')), 1)


def fetch():
    with sync_playwright() as p:
        browser = p.chromium.launch(args=['--no-sandbox', '--disable-dev-shm-usage'])
        page = browser.new_page(user_agent=(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
            '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ))
        page.goto('https://www.aaii.com/sentimentsurvey',
                  wait_until='networkidle', timeout=30000)
        page.wait_for_timeout(2000)          # let any late renders finish
        text = page.inner_text('body')
        html = page.content()
        browser.close()

    print(f'Rendered text length: {len(text)} chars')

    # ── Strategy 1: date + 3 percentages in the same line/block ──────────────
    # Matches rows like: "4/22/2026  46.0%  19.5%  34.4%"
    date_row = re.compile(
        r'(\d{1,2}/\d{1,2}/\d{4})'
        r'[^\d%]{0,30}'
        r'(\d+\.?\d*)%'
        r'[^\d%]{0,20}'
        r'(\d+\.?\d*)%'
        r'[^\d%]{0,20}'
        r'(\d+\.?\d*)%'
    )
    matches = date_row.findall(text)
    if matches:
        date_raw, bull, neut, bear = matches[0]
        print(f'Found: {date_raw}  bull={bull}  neut={neut}  bear={bear}')
        try:
            date_str = datetime.strptime(date_raw, '%m/%d/%Y').strftime('%B %d, %Y')
        except ValueError:
            date_str = date_raw
        return {
            'date':          date_str,
            'bullish':       pct(bull),
            'neutral':       pct(neut),
            'bearish':       pct(bear),
            'historicalAvg': HISTORICAL_AVG,
            'updatedAt':     datetime.utcnow().isoformat() + 'Z',
        }

    # ── Strategy 2: look for the table in raw HTML ────────────────────────────
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, 'lxml')
    for table in soup.find_all('table'):
        header = table.find('tr')
        if not header or ('bullish' not in header.get_text().lower()):
            continue
        for row in table.find_all('tr')[1:]:
            cells = [td.get_text(strip=True) for td in row.find_all('td')]
            dates = [c for c in cells if re.match(r'\d{1,2}/\d{1,2}/\d{4}', c)]
            pcts  = [c.replace('%','') for c in cells if re.match(r'^\d+\.?\d*%$', c)]
            if dates and len(pcts) >= 3:
                date_str = datetime.strptime(dates[0], '%m/%d/%Y').strftime('%B %d, %Y')
                print(f'Found via table: {date_str}  {pcts[:3]}')
                return {
                    'date':          date_str,
                    'bullish':       pct(pcts[0]),
                    'neutral':       pct(pcts[1]),
                    'bearish':       pct(pcts[2]),
                    'historicalAvg': HISTORICAL_AVG,
                    'updatedAt':     datetime.utcnow().isoformat() + 'Z',
                }

    # Print first 2000 chars of rendered text to help debug
    print('--- rendered text sample ---')
    print(text[:2000])
    raise ValueError('Could not extract AAII sentiment data from rendered page.')


if __name__ == '__main__':
    try:
        data = fetch()
        out_path = 'public/aaii.json'
        with open(out_path, 'w') as f:
            json.dump(data, f, indent=2)
        print(f'\nSaved to {out_path}:')
        print(json.dumps(data, indent=2))
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f'ERROR: {e}', file=sys.stderr)
        sys.exit(1)
